"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { buildInitialDatabase, type MockDatabase, ORG_ID } from "./mock-data";
import { makeId, makeSecureToken } from "./id";
import { estimateSegments, mockSmsProvider } from "./adapters/sms";
import { mockTelephonyProvider, type CallProgressEvent } from "./adapters/telephony";
import { normalizePhone } from "./csv";
import type {
  AgentProfile,
  AgentStatus,
  AssignmentStatus,
  AuditEvent,
  Campaign,
  CampaignStatus,
  CallAttemptStatus,
  CallOutcome,
  CallScriptSection,
  ConsentStatus,
  ParsedContactRow,
} from "./types";

const STORAGE_KEY = "calls-ops-mock-db-v1";

export interface CampaignInput {
  name: string;
  clientName: string;
  description: string;
  researchObjective: string;
  startDate: string;
  endDate: string;
  targetCompletions: number;
  dailyAgentTarget: number;
  estimatedDurationMinutes: number;
  incentiveTitle: string;
  incentiveDescription: string;
  senderId: string;
  recordingEnabled: boolean;
  status: CampaignStatus;
}

export interface ImportSummary {
  imported: number;
  skipped: number;
}

export interface SendInvitationsSummary {
  eligible: number;
  sent: number;
}

interface StoreContextValue {
  ready: boolean;
  db: MockDatabase;
  actions: {
    createCampaign: (input: CampaignInput) => Campaign;
    updateCampaignStatus: (campaignId: string, status: CampaignStatus, actor?: string) => void;
    importContacts: (
      campaignId: string,
      rows: ParsedContactRow[],
      actor?: string
    ) => ImportSummary;
    saveSmsDraft: (campaignId: string, body: string, incentiveText: string, senderId: string) => void;
    sendInvitations: (
      campaignId: string,
      body: string,
      senderId: string,
      actor?: string
    ) => Promise<SendInvitationsSummary>;
    recordConsent: (
      participantId: string,
      participationAgreed: boolean,
      recordingAgreed?: boolean
    ) => void;
    createBooking: (participantId: string, start: string, end: string, timezone: string) => void;
    rescheduleBooking: (
      bookingId: string,
      start: string,
      end: string,
      actor: string,
      note?: string
    ) => void;
    cancelBooking: (bookingId: string, actor: string) => void;
    inviteAgent: (input: {
      name: string;
      email: string;
      campaignId?: string;
      dailyTarget?: number;
    }) => AgentProfile;
    setAgentStatus: (agentId: string, status: AgentStatus) => void;
    attachAgentToCampaign: (campaignId: string, agentId: string, dailyTarget: number, actor?: string) => void;
    updateCampaignAgentTarget: (campaignAgentId: string, dailyTarget: number) => void;
    detachAgentFromCampaign: (campaignAgentId: string, actor?: string) => void;
    assignParticipant: (
      campaignId: string,
      participantId: string,
      agentId: string,
      actor: string
    ) => void;
    reassignParticipant: (assignmentId: string, newAgentId: string, actor: string) => void;
    startCallAttempt: (
      assignmentId: string,
      onStatus?: (status: CallAttemptStatus) => void
    ) => Promise<string>;
    endCallAttempt: (callAttemptId: string) => void;
    submitCallOutcome: (
      callAttemptId: string,
      outcome: CallOutcome,
      notes: string,
      reschedule?: { start: string; end: string }
    ) => void;
    updateCallScript: (campaignId: string, sections: CallScriptSection[]) => void;
  };
}

const StoreContext = createContext<StoreContextValue | null>(null);

function loadFromStorage(): MockDatabase | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MockDatabase;
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<MockDatabase | null>(null);
  const dbRef = useRef<MockDatabase | null>(null);

  useEffect(() => {
    const existing = loadFromStorage();
    const initial = existing ?? buildInitialDatabase();
    dbRef.current = initial;
    setDb(initial);
  }, []);

  useEffect(() => {
    if (db && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }
  }, [db]);

  const update = useCallback((updater: (prev: MockDatabase) => MockDatabase) => {
    setDb((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      dbRef.current = next;
      return next;
    });
  }, []);

  const addAudit = useCallback(
    (
      prev: MockDatabase,
      entry: Omit<AuditEvent, "id" | "organisationId">
    ): MockDatabase => ({
      ...prev,
      auditEvents: [...prev.auditEvents, { id: makeId("audit"), organisationId: ORG_ID, ...entry }],
    }),
    []
  );

  const createCampaign = useCallback(
    (input: CampaignInput): Campaign => {
      const now = new Date().toISOString();
      const campaign: Campaign = {
        id: makeId("camp"),
        organisationId: ORG_ID,
        campaignType: "telephone_interview",
        createdBy: "Toni",
        createdAt: now,
        updatedAt: now,
        ...input,
      };
      update((prev) =>
        addAudit(
          { ...prev, campaigns: [...prev.campaigns, campaign] },
          {
            campaignId: campaign.id,
            actorType: "admin",
            actorName: "Toni",
            action: "campaign_created",
            entityType: "campaign",
            entityId: campaign.id,
            createdAt: now,
          }
        )
      );
      return campaign;
    },
    [update, addAudit]
  );

  const updateCampaignStatus = useCallback(
    (campaignId: string, status: CampaignStatus, actor = "Toni") => {
      update((prev) =>
        addAudit(
          {
            ...prev,
            campaigns: prev.campaigns.map((c) =>
              c.id === campaignId ? { ...c, status, updatedAt: new Date().toISOString() } : c
            ),
          },
          {
            campaignId,
            actorType: "admin",
            actorName: actor,
            action: "campaign_status_changed",
            entityType: "campaign",
            entityId: campaignId,
            metadata: { status },
            createdAt: new Date().toISOString(),
          }
        )
      );
    },
    [update, addAudit]
  );

  const importContacts = useCallback(
    (campaignId: string, rows: ParsedContactRow[], actor = "Toni"): ImportSummary => {
      const validRows = rows.filter((r) => r.validation === "valid");
      let imported = 0;
      update((prev) => {
        const newContacts = [...prev.contacts];
        const newParticipants = [...prev.participants];
        for (const row of validRows) {
          const contact = {
            id: makeId("contact"),
            organisationId: ORG_ID,
            name: row.name,
            phone: row.phone,
            email: row.email,
            externalCustomerId: row.externalCustomerId,
            createdAt: new Date().toISOString(),
          };
          newContacts.push(contact);
          newParticipants.push({
            id: makeId("participant"),
            campaignId,
            contactId: contact.id,
            segment: row.segment,
            participationStatus: "imported" as const,
            inviteToken: makeSecureToken(),
            tokenRevoked: false,
            tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString(),
            createdAt: new Date().toISOString(),
          });
          imported += 1;
        }
        return addAudit(
          { ...prev, contacts: newContacts, participants: newParticipants },
          {
            campaignId,
            actorType: "admin",
            actorName: actor,
            action: "contacts_imported",
            entityType: "campaign",
            entityId: campaignId,
            metadata: { imported },
            createdAt: new Date().toISOString(),
          }
        );
      });
      return { imported, skipped: rows.length - imported };
    },
    [update, addAudit]
  );

  const saveSmsDraft = useCallback(
    (_campaignId: string, _body: string, _incentiveText: string, _senderId: string) => {
      // Draft state is held by the composer component itself for this mock phase;
      // this hook exists so the action is wired the way a real backend call would be.
    },
    []
  );

  const sendInvitations = useCallback(
    async (
      campaignId: string,
      body: string,
      senderId: string,
      actor = "Toni"
    ): Promise<SendInvitationsSummary> => {
      const current = dbRef.current;
      if (!current) return { eligible: 0, sent: 0 };
      const eligible = current.participants.filter(
        (p) => p.campaignId === campaignId && p.participationStatus === "imported"
      );

      for (const participant of eligible) {
        const contact = current.contacts.find((c) => c.id === participant.contactId);
        if (!contact) continue;
        const result = await mockSmsProvider.sendSMS({
          to: contact.phone,
          body,
          senderId,
        });
        const now = new Date().toISOString();
        update((prev) =>
          addAudit(
            {
              ...prev,
              invitations: [
                ...prev.invitations,
                {
                  id: makeId("invite"),
                  campaignId,
                  participantId: participant.id,
                  providerMessageId: result.providerMessageId,
                  status: result.status === "failed" ? "failed" : "sent",
                  sentAt: result.status === "failed" ? undefined : now,
                  failedAt: result.status === "failed" ? now : undefined,
                  failureReason: result.failureReason,
                },
              ],
              participants: prev.participants.map((p) =>
                p.id === participant.id
                  ? {
                      ...p,
                      participationStatus: result.status === "failed" ? "invite_failed" : "invited",
                    }
                  : p
              ),
            },
            {
              campaignId,
              actorType: "system",
              actorName: "SMS provider (mock)",
              action: "invitation_sent",
              entityType: "campaign_participant",
              entityId: participant.id,
              metadata: { status: result.status },
              createdAt: now,
            }
          )
        );

        if (result.status !== "failed") {
          // Simulate async delivery/failure a little later, matching the mock provider's own timers.
          setTimeout(async () => {
            const status = await mockSmsProvider.getSMSStatus(result.providerMessageId);
            update((prev) => ({
              ...prev,
              invitations: prev.invitations.map((inv) =>
                inv.providerMessageId === result.providerMessageId
                  ? {
                      ...inv,
                      status,
                      deliveredAt: status === "delivered" ? new Date().toISOString() : inv.deliveredAt,
                      failedAt: status === "failed" ? new Date().toISOString() : inv.failedAt,
                    }
                  : inv
              ),
              participants: prev.participants.map((p) =>
                p.id === participant.id && status === "delivered"
                  ? { ...p, participationStatus: "delivered" }
                  : p.id === participant.id && status === "failed"
                    ? { ...p, participationStatus: "invite_failed" }
                    : p
              ),
            }));
          }, 2200);
        }
      }

      update((prev) =>
        addAudit(prev, {
          campaignId,
          actorType: "admin",
          actorName: actor,
          action: "sms_batch_sent",
          entityType: "campaign",
          entityId: campaignId,
          metadata: { recipientCount: eligible.length },
          createdAt: new Date().toISOString(),
        })
      );
      return { eligible: eligible.length, sent: eligible.length };
    },
    [update, addAudit]
  );

  const recordConsent = useCallback(
    (participantId: string, participationAgreed: boolean, recordingAgreed?: boolean) => {
      update((prev) => {
        const participant = prev.participants.find((p) => p.id === participantId);
        if (!participant) return prev;
        const now = new Date().toISOString();
        const events = [
          ...prev.consentEvents,
          {
            id: makeId("consent"),
            campaignId: participant.campaignId,
            participantId,
            consentType: "participation" as const,
            consentVersion: "v1",
            consentStatus: (participationAgreed ? "agreed" : "declined") as ConsentStatus,
            consentedAt: now,
            source: "participant_link",
          },
        ];
        if (participationAgreed && recordingAgreed !== undefined) {
          events.push({
            id: makeId("consent"),
            campaignId: participant.campaignId,
            participantId,
            consentType: "recording" as const,
            consentVersion: "v1",
            consentStatus: (recordingAgreed ? "agreed" : "declined") as ConsentStatus,
            consentedAt: now,
            source: "participant_link",
          });
        }
        return addAudit(
          {
            ...prev,
            consentEvents: events,
            participants: prev.participants.map((p) =>
              p.id === participantId
                ? { ...p, participationStatus: participationAgreed ? "opted_in" : "declined" }
                : p
            ),
          },
          {
            campaignId: participant.campaignId,
            actorType: "participant",
            actorName: "Participant",
            action: "consent_recorded",
            entityType: "campaign_participant",
            entityId: participantId,
            metadata: { agreed: participationAgreed },
            createdAt: now,
          }
        );
      });
    },
    [update, addAudit]
  );

  const createBooking = useCallback(
    (participantId: string, start: string, end: string, timezone: string) => {
      update((prev) => {
        const participant = prev.participants.find((p) => p.id === participantId);
        if (!participant) return prev;
        const now = new Date().toISOString();
        const booking = {
          id: makeId("booking"),
          campaignId: participant.campaignId,
          participantId,
          scheduledStart: start,
          scheduledEnd: end,
          timezone,
          status: "scheduled" as const,
          createdAt: now,
          updatedAt: now,
          history: [{ at: now, action: "booked" }],
        };
        return addAudit(
          {
            ...prev,
            bookings: [...prev.bookings, booking],
            participants: prev.participants.map((p) =>
              p.id === participantId ? { ...p, participationStatus: "scheduled" } : p
            ),
          },
          {
            campaignId: participant.campaignId,
            actorType: "participant",
            actorName: "Participant",
            action: "booking_created",
            entityType: "interview_booking",
            entityId: booking.id,
            createdAt: now,
          }
        );
      });
    },
    [update, addAudit]
  );

  const rescheduleBooking = useCallback(
    (bookingId: string, start: string, end: string, actor: string, note?: string) => {
      update((prev) => {
        const booking = prev.bookings.find((b) => b.id === bookingId);
        if (!booking) return prev;
        const now = new Date().toISOString();
        return addAudit(
          {
            ...prev,
            bookings: prev.bookings.map((b) =>
              b.id === bookingId
                ? {
                    ...b,
                    scheduledStart: start,
                    scheduledEnd: end,
                    status: "rescheduled" as const,
                    updatedAt: now,
                    history: [...b.history, { at: now, action: "rescheduled", note }],
                  }
                : b
            ),
          },
          {
            campaignId: booking.campaignId,
            actorType: actor === "Toni" ? "admin" : actor === "Participant" ? "participant" : "agent",
            actorName: actor,
            action: "booking_rescheduled",
            entityType: "interview_booking",
            entityId: bookingId,
            createdAt: now,
          }
        );
      });
    },
    [update, addAudit]
  );

  const cancelBooking = useCallback(
    (bookingId: string, actor: string) => {
      update((prev) => {
        const booking = prev.bookings.find((b) => b.id === bookingId);
        if (!booking) return prev;
        const now = new Date().toISOString();
        return addAudit(
          {
            ...prev,
            bookings: prev.bookings.map((b) =>
              b.id === bookingId
                ? {
                    ...b,
                    status: "cancelled" as const,
                    updatedAt: now,
                    history: [...b.history, { at: now, action: "cancelled" }],
                  }
                : b
            ),
            assignments: prev.assignments.map((a) =>
              a.bookingId === bookingId ? { ...a, status: "cancelled" as AssignmentStatus } : a
            ),
          },
          {
            campaignId: booking.campaignId,
            actorType: "participant",
            actorName: actor,
            action: "booking_cancelled",
            entityType: "interview_booking",
            entityId: bookingId,
            createdAt: now,
          }
        );
      });
    },
    [update, addAudit]
  );

  const inviteAgent = useCallback(
    (input: { name: string; email: string; campaignId?: string; dailyTarget?: number }): AgentProfile => {
      const agent: AgentProfile = {
        id: makeId("agent"),
        name: input.name,
        email: input.email,
        status: "invited",
        createdAt: new Date().toISOString(),
      };
      update((prev) =>
        addAudit(
          {
            ...prev,
            agents: [...prev.agents, agent],
            campaignAgents: input.campaignId
              ? [
                  ...prev.campaignAgents,
                  {
                    id: makeId("campaign_agent"),
                    campaignId: input.campaignId,
                    agentId: agent.id,
                    dailyTarget: input.dailyTarget ?? 8,
                    active: true,
                  },
                ]
              : prev.campaignAgents,
          },
          {
            campaignId: input.campaignId,
            actorType: "admin",
            actorName: "Toni",
            action: "agent_invited",
            entityType: "agent",
            entityId: agent.id,
            createdAt: new Date().toISOString(),
          }
        )
      );
      return agent;
    },
    [update, addAudit]
  );

  const setAgentStatus = useCallback(
    (agentId: string, status: AgentStatus) => {
      update((prev) => ({
        ...prev,
        agents: prev.agents.map((a) => (a.id === agentId ? { ...a, status } : a)),
      }));
    },
    [update]
  );

  const attachAgentToCampaign = useCallback(
    (campaignId: string, agentId: string, dailyTarget: number, actor = "Toni") => {
      update((prev) => {
        const alreadyAttached = prev.campaignAgents.some(
          (ca) => ca.campaignId === campaignId && ca.agentId === agentId
        );
        if (alreadyAttached) return prev;
        const campaignAgent = {
          id: makeId("campaign_agent"),
          campaignId,
          agentId,
          dailyTarget,
          active: true,
        };
        return addAudit(
          { ...prev, campaignAgents: [...prev.campaignAgents, campaignAgent] },
          {
            campaignId,
            actorType: "admin",
            actorName: actor,
            action: "agent_attached_to_campaign",
            entityType: "campaign_agent",
            entityId: campaignAgent.id,
            metadata: { agentId },
            createdAt: new Date().toISOString(),
          }
        );
      });
    },
    [update, addAudit]
  );

  const updateCampaignAgentTarget = useCallback(
    (campaignAgentId: string, dailyTarget: number) => {
      update((prev) => ({
        ...prev,
        campaignAgents: prev.campaignAgents.map((ca) =>
          ca.id === campaignAgentId ? { ...ca, dailyTarget } : ca
        ),
      }));
    },
    [update]
  );

  const detachAgentFromCampaign = useCallback(
    (campaignAgentId: string, actor = "Toni") => {
      update((prev) => {
        const campaignAgent = prev.campaignAgents.find((ca) => ca.id === campaignAgentId);
        if (!campaignAgent) return prev;
        return addAudit(
          {
            ...prev,
            campaignAgents: prev.campaignAgents.filter((ca) => ca.id !== campaignAgentId),
          },
          {
            campaignId: campaignAgent.campaignId,
            actorType: "admin",
            actorName: actor,
            action: "agent_detached_from_campaign",
            entityType: "campaign_agent",
            entityId: campaignAgentId,
            metadata: { agentId: campaignAgent.agentId },
            createdAt: new Date().toISOString(),
          }
        );
      });
    },
    [update, addAudit]
  );

  const assignParticipant = useCallback(
    (campaignId: string, participantId: string, agentId: string, actor: string) => {
      update((prev) => {
        const booking = [...prev.bookings]
          .filter((b) => b.participantId === participantId && b.status !== "cancelled")
          .sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart))[0];
        if (!booking) return prev;
        const existing = prev.assignments.find((a) => a.bookingId === booking.id);
        const now = new Date().toISOString();
        const nextAssignments = existing
          ? prev.assignments.map((a) =>
              a.id === existing.id
                ? { ...a, agentId, assignedBy: actor, assignedAt: now, status: "assigned" as AssignmentStatus }
                : a
            )
          : [
              ...prev.assignments,
              {
                id: makeId("assignment"),
                campaignId,
                participantId,
                bookingId: booking.id,
                agentId,
                assignedBy: actor,
                assignedAt: now,
                status: "assigned" as AssignmentStatus,
              },
            ];
        return addAudit(
          { ...prev, assignments: nextAssignments },
          {
            campaignId,
            actorType: "admin",
            actorName: actor,
            action: existing ? "participant_reassigned" : "participant_assigned",
            entityType: "call_assignment",
            entityId: existing?.id ?? nextAssignments.at(-1)!.id,
            metadata: { agentId },
            createdAt: now,
          }
        );
      });
    },
    [update, addAudit]
  );

  const reassignParticipant = useCallback(
    (assignmentId: string, newAgentId: string, actor: string) => {
      update((prev) => {
        const assignment = prev.assignments.find((a) => a.id === assignmentId);
        if (!assignment) return prev;
        const now = new Date().toISOString();
        return addAudit(
          {
            ...prev,
            assignments: prev.assignments.map((a) =>
              a.id === assignmentId
                ? { ...a, agentId: newAgentId, assignedBy: actor, assignedAt: now, status: "assigned" as AssignmentStatus }
                : a
            ),
          },
          {
            campaignId: assignment.campaignId,
            actorType: "admin",
            actorName: actor,
            action: "participant_reassigned",
            entityType: "call_assignment",
            entityId: assignmentId,
            metadata: { agentId: newAgentId },
            createdAt: now,
          }
        );
      });
    },
    [update, addAudit]
  );

  const startCallAttempt = useCallback(
    async (assignmentId: string, onStatus?: (status: CallAttemptStatus) => void): Promise<string> => {
      const current = dbRef.current;
      if (!current) throw new Error("Store not ready");
      const assignment = current.assignments.find((a) => a.id === assignmentId);
      if (!assignment) throw new Error("Assignment not found");
      const campaign = current.campaigns.find((c) => c.id === assignment.campaignId);
      const attemptId = makeId("attempt");
      const now = new Date().toISOString();

      update((prev) => ({
        ...prev,
        assignments: prev.assignments.map((a) =>
          a.id === assignmentId ? { ...a, status: "in_progress" as AssignmentStatus } : a
        ),
        callAttempts: [
          ...prev.callAttempts,
          {
            id: attemptId,
            campaignId: assignment.campaignId,
            participantId: assignment.participantId,
            assignmentId,
            agentId: assignment.agentId,
            providerCallId: "",
            startedAt: now,
            status: "preparing" as CallAttemptStatus,
            createdAt: now,
          },
        ],
      }));

      // Tracked locally rather than re-read from dbRef right after calling
      // update() — React batches state updates, so dbRef.current isn't
      // guaranteed to reflect handleProgress's own update() by the time the
      // outer async function resumes. A closure variable is reliable.
      let connected = false;

      const handleProgress = (event: CallProgressEvent) => {
        if (event === "connected") connected = true;
        update((prev) => ({
          ...prev,
          callAttempts: prev.callAttempts.map((a) =>
            a.id === attemptId
              ? {
                  ...a,
                  status: event as CallAttemptStatus,
                  connectedAt: event === "connected" ? new Date().toISOString() : a.connectedAt,
                }
              : a
          ),
        }));
        onStatus?.(event as CallAttemptStatus);
      };

      const { providerCallId } = await mockTelephonyProvider.initiateMaskedCall(
        assignmentId,
        handleProgress
      );

      update((prev) => ({
        ...prev,
        callAttempts: prev.callAttempts.map((a) => (a.id === attemptId ? { ...a, providerCallId } : a)),
      }));

      if (connected && campaign?.recordingEnabled) {
        mockTelephonyProvider.requestRecording(providerCallId).then(({ providerRecordingId }) => {
          update((prev) => ({
            ...prev,
            recordings: [
              ...prev.recordings,
              {
                id: makeId("recording"),
                campaignId: assignment.campaignId,
                callAttemptId: attemptId,
                providerRecordingId,
                storageReference: `mock://recordings/${attemptId}`,
                status: "recording" as const,
                createdAt: new Date().toISOString(),
              },
            ],
          }));
        });
      }

      update((prev) =>
        addAudit(prev, {
          campaignId: assignment.campaignId,
          actorType: "agent",
          actorName: "Agent",
          action: "call_initiated",
          entityType: "call_attempt",
          entityId: attemptId,
          createdAt: now,
        })
      );

      return attemptId;
    },
    [update, addAudit]
  );

  const endCallAttempt = useCallback(
    (callAttemptId: string) => {
      update((prev) => {
        const attempt = prev.callAttempts.find((a) => a.id === callAttemptId);
        if (!attempt || attempt.status === "ended") return prev;
        const now = new Date().toISOString();
        const durationSeconds = attempt.connectedAt
          ? Math.max(1, Math.round((Date.parse(now) - Date.parse(attempt.connectedAt)) / 1000))
          : 0;
        return {
          ...prev,
          callAttempts: prev.callAttempts.map((a) =>
            a.id === callAttemptId ? { ...a, status: "ended" as const, endedAt: now, durationSeconds } : a
          ),
          recordings: prev.recordings.map((r) =>
            r.callAttemptId === callAttemptId && r.status === "recording"
              ? { ...r, status: "available" as const, duration: durationSeconds }
              : r
          ),
        };
      });
    },
    [update]
  );

  const submitCallOutcome = useCallback(
    (
      callAttemptId: string,
      outcome: CallOutcome,
      notes: string,
      reschedule?: { start: string; end: string }
    ) => {
      update((prev) => {
        const attempt = prev.callAttempts.find((a) => a.id === callAttemptId);
        if (!attempt) return prev;
        const now = new Date().toISOString();

        let nextParticipants = prev.participants;
        let nextAssignments = prev.assignments;
        let nextBookings = prev.bookings;

        if (outcome === "completed") {
          nextParticipants = prev.participants.map((p) =>
            p.id === attempt.participantId ? { ...p, participationStatus: "completed" } : p
          );
          nextAssignments = prev.assignments.map((a) =>
            a.id === attempt.assignmentId ? { ...a, status: "completed" as AssignmentStatus } : a
          );
        } else if (outcome === "declined" || outcome === "ineligible" || outcome === "wrong_number") {
          nextParticipants = prev.participants.map((p) =>
            p.id === attempt.participantId
              ? { ...p, participationStatus: outcome === "declined" ? "declined" : "ineligible" }
              : p
          );
          nextAssignments = prev.assignments.map((a) =>
            a.id === attempt.assignmentId ? { ...a, status: "completed" as AssignmentStatus } : a
          );
        } else if (outcome === "reschedule_requested" && reschedule) {
          const newBooking = {
            id: makeId("booking"),
            campaignId: attempt.campaignId,
            participantId: attempt.participantId,
            scheduledStart: reschedule.start,
            scheduledEnd: reschedule.end,
            timezone: "Europe/London",
            status: "scheduled" as const,
            createdAt: now,
            updatedAt: now,
            history: [{ at: now, action: "rescheduled_by_agent" }],
          };
          nextBookings = [...prev.bookings, newBooking];
          nextAssignments = prev.assignments.map((a) =>
            a.id === attempt.assignmentId
              ? { ...a, bookingId: newBooking.id, status: "assigned" as AssignmentStatus }
              : a
          );
        } else {
          // no_answer, busy, follow_up_required, technical_failure: stays callable
          nextAssignments = prev.assignments.map((a) =>
            a.id === attempt.assignmentId ? { ...a, status: "assigned" as AssignmentStatus } : a
          );
        }

        return addAudit(
          {
            ...prev,
            participants: nextParticipants,
            assignments: nextAssignments,
            bookings: nextBookings,
            callAttempts: prev.callAttempts.map((a) =>
              a.id === callAttemptId ? { ...a, disposition: outcome, notes } : a
            ),
          },
          {
            campaignId: attempt.campaignId,
            actorType: "agent",
            actorName: "Agent",
            action: "call_outcome_submitted",
            entityType: "call_attempt",
            entityId: callAttemptId,
            metadata: { disposition: outcome },
            createdAt: now,
          }
        );
      });
    },
    [update, addAudit]
  );

  const updateCallScript = useCallback(
    (campaignId: string, sections: CallScriptSection[]) => {
      update((prev) => {
        const exists = prev.callScripts.some((s) => s.campaignId === campaignId);
        const now = new Date().toISOString();
        return {
          ...prev,
          callScripts: exists
            ? prev.callScripts.map((s) =>
                s.campaignId === campaignId ? { ...s, sections, updatedAt: now } : s
              )
            : [...prev.callScripts, { campaignId, sections, updatedAt: now }],
        };
      });
    },
    [update]
  );

  if (!db) {
    return <StoreContext.Provider value={null}>{children}</StoreContext.Provider>;
  }

  return (
    <StoreContext.Provider
      value={{
        ready: true,
        db,
        actions: {
          createCampaign,
          updateCampaignStatus,
          importContacts,
          saveSmsDraft,
          sendInvitations,
          recordConsent,
          createBooking,
          rescheduleBooking,
          cancelBooking,
          inviteAgent,
          setAgentStatus,
          attachAgentToCampaign,
          updateCampaignAgentTarget,
          detachAgentFromCampaign,
          assignParticipant,
          reassignParticipant,
          startCallAttempt,
          endCallAttempt,
          submitCallOutcome,
          updateCallScript,
        },
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    return { ready: false, db: null as unknown as MockDatabase, actions: null as unknown as StoreContextValue["actions"] };
  }
  return ctx;
}

export { normalizePhone };
export { estimateSegments };
