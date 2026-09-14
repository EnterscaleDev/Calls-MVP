import type { MockDatabase } from "./mock-data";
import type {
  AgentParticipantView,
  AssignmentStatus,
  Campaign,
  CampaignFunnel,
  CampaignMetrics,
  CallAttempt,
  CallOutcome,
  Contact,
  InterviewBooking,
} from "./types";

export function getCampaign(
  db: Pick<MockDatabase, "campaigns">,
  campaignId: string
): Campaign | undefined {
  return db.campaigns.find((c) => c.id === campaignId);
}

export function getCampaignFunnel(
  db: Pick<MockDatabase, "participants" | "invitations" | "callAttempts">,
  campaignId: string
): CampaignFunnel {
  const participants = db.participants.filter((p) => p.campaignId === campaignId);
  const invited = participants.filter((p) => p.participationStatus !== "imported").length;
  const delivered = db.invitations.filter(
    (i) => i.campaignId === campaignId && i.status === "delivered"
  ).length;
  const optedIn = participants.filter((p) =>
    ["opted_in", "scheduled", "completed"].includes(p.participationStatus)
  ).length;
  const scheduled = participants.filter((p) =>
    ["scheduled", "completed"].includes(p.participationStatus)
  ).length;
  const attempted = new Set(
    db.callAttempts.filter((a) => a.campaignId === campaignId).map((a) => a.participantId)
  ).size;
  const completed = participants.filter((p) => p.participationStatus === "completed").length;

  return {
    contacts: participants.length,
    invited,
    delivered,
    optedIn,
    scheduled,
    attempted,
    completed,
  };
}

export function getCampaignMetrics(
  db: Pick<MockDatabase, "campaigns" | "participants" | "invitations" | "callAttempts">,
  campaignId: string
): CampaignMetrics {
  const funnel = getCampaignFunnel(db, campaignId);
  const campaign = getCampaign(db, campaignId);
  const target = campaign?.targetCompletions ?? 0;
  return {
    contacts: funnel.contacts,
    invitationsSent: funnel.invited,
    delivered: funnel.delivered,
    optedIn: funnel.optedIn,
    scheduled: funnel.scheduled,
    callsAttempted: funnel.attempted,
    completed: funnel.completed,
    completionRate: target > 0 ? funnel.completed / target : 0,
  };
}

export interface ParticipantRow {
  participantId: string;
  contact: Contact;
  segment?: string;
  participationStatus: string;
  invitationStatus?: string;
  booking?: InterviewBooking;
  assignedAgentName?: string;
  assignmentStatus?: AssignmentStatus;
  assignmentId?: string;
}

export function getCampaignParticipantRows(
  db: Pick<MockDatabase, "participants" | "contacts" | "invitations" | "bookings" | "assignments" | "agents">,
  campaignId: string
): ParticipantRow[] {
  return db.participants
    .filter((p) => p.campaignId === campaignId)
    .map((p) => {
      const contact = db.contacts.find((c) => c.id === p.contactId)!;
      const invitation = [...db.invitations]
        .filter((i) => i.participantId === p.id)
        .sort((a, b) => (a.sentAt ?? "").localeCompare(b.sentAt ?? ""))
        .at(-1);
      const booking = [...db.bookings]
        .filter((b) => b.participantId === p.id)
        .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
        .at(-1);
      const assignment = booking
        ? db.assignments.find((a) => a.bookingId === booking.id)
        : undefined;
      const agent = assignment ? db.agents.find((a) => a.id === assignment.agentId) : undefined;

      return {
        participantId: p.id,
        contact,
        segment: p.segment,
        participationStatus: p.participationStatus,
        invitationStatus: invitation?.status,
        booking,
        assignedAgentName: agent?.name,
        assignmentStatus: assignment?.status,
        assignmentId: assignment?.id,
      };
    });
}

function aliasFor(contact: Contact, participantId: string): string {
  const initial = contact.name.trim().split(/\s+/).slice(-1)[0]?.[0] ?? "";
  const first = contact.name.trim().split(/\s+/)[0] ?? "Participant";
  return `${first} ${initial ? initial + "." : ""}`.trim() || `Participant ${participantId.slice(-4)}`;
}

export interface AgentQueueBuckets {
  overdue: AgentParticipantView[];
  dueNow: AgentParticipantView[];
  upcoming: AgentParticipantView[];
  completedToday: AgentParticipantView[];
}

export function getAgentQueue(db: MockDatabase, agentId: string): AgentQueueBuckets {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const assignments = db.assignments.filter((a) => a.agentId === agentId);

  const buckets: AgentQueueBuckets = { overdue: [], dueNow: [], upcoming: [], completedToday: [] };

  for (const a of assignments) {
    const booking = db.bookings.find((b) => b.id === a.bookingId);
    if (!booking) continue;
    const campaign = getCampaign(db, a.campaignId);
    if (!campaign) continue;
    const contact = db.contacts.find(
      (c) => c.id === db.participants.find((p) => p.id === a.participantId)?.contactId
    );
    const lastAttempt = [...db.callAttempts]
      .filter((att) => att.assignmentId === a.id)
      .sort((x, y) => x.startedAt.localeCompare(y.startedAt))
      .at(-1);

    const view: AgentParticipantView = {
      assignmentId: a.id,
      participantAlias: contact ? aliasFor(contact, a.participantId) : `Participant`,
      campaignId: campaign.id,
      campaignName: campaign.name,
      bookingId: booking.id,
      scheduledStart: booking.scheduledStart,
      scheduledEnd: booking.scheduledEnd,
      estimatedDurationMinutes: campaign.estimatedDurationMinutes,
      status: a.status,
      lastOutcome: lastAttempt?.disposition,
    };

    const scheduled = new Date(booking.scheduledStart);

    if (a.status === "completed") {
      if (scheduled >= startOfToday && scheduled <= endOfToday) buckets.completedToday.push(view);
      continue;
    }
    if (a.status === "cancelled" || a.status === "reassigned") continue;

    if (scheduled < now && scheduled >= startOfToday) {
      buckets.dueNow.push(view);
    } else if (scheduled < startOfToday) {
      buckets.overdue.push(view);
    } else if (scheduled <= endOfToday) {
      buckets.dueNow.push(view);
    } else {
      buckets.upcoming.push(view);
    }
  }

  const byTime = (a: AgentParticipantView, b: AgentParticipantView) =>
    a.scheduledStart.localeCompare(b.scheduledStart);
  buckets.overdue.sort(byTime);
  buckets.dueNow.sort(byTime);
  buckets.upcoming.sort(byTime);
  buckets.completedToday.sort(byTime);

  return buckets;
}

export interface AgentHistoryRow {
  callAttemptId: string;
  campaignName: string;
  participantAlias: string;
  startedAt: string;
  durationSeconds?: number;
  disposition?: CallOutcome;
  notes?: string;
  followUpRequired: boolean;
}

export function getAgentCallHistory(db: MockDatabase, agentId: string): AgentHistoryRow[] {
  return db.callAttempts
    .filter((a) => a.agentId === agentId && a.status === "ended")
    .map((a) => {
      const campaign = getCampaign(db, a.campaignId);
      const participant = db.participants.find((p) => p.id === a.participantId);
      const contact = participant ? db.contacts.find((c) => c.id === participant.contactId) : undefined;
      return {
        callAttemptId: a.id,
        campaignName: campaign?.name ?? "Unknown campaign",
        participantAlias: contact ? aliasFor(contact, a.participantId) : "Participant",
        startedAt: a.startedAt,
        durationSeconds: a.durationSeconds,
        disposition: a.disposition,
        notes: a.notes,
        followUpRequired: a.disposition === "follow_up_required",
      };
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function resolveParticipantByToken(db: MockDatabase, token: string) {
  const participant = db.participants.find((p) => p.inviteToken === token);
  if (!participant) return { kind: "not_found" as const };
  if (participant.tokenRevoked) return { kind: "revoked" as const };
  if (new Date(participant.tokenExpiresAt) < new Date()) return { kind: "expired" as const };

  const campaign = getCampaign(db, participant.campaignId);
  if (!campaign) return { kind: "not_found" as const };
  const contact = db.contacts.find((c) => c.id === participant.contactId);
  const firstName = contact?.name?.trim().split(/\s+/)[0] ?? "there";
  const booking = [...db.bookings]
    .filter((b) => b.participantId === participant.id)
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
    .at(-1);
  const consents = db.consentEvents.filter((c) => c.participantId === participant.id);

  return {
    kind: "ok" as const,
    campaign,
    participant,
    firstName,
    booking,
    hasAgreedParticipation: consents.some(
      (c) => c.consentType === "participation" && c.consentStatus === "agreed"
    ),
    hasDeclined: consents.some(
      (c) => c.consentType === "participation" && c.consentStatus === "declined"
    ),
  };
}

export function getAvailableSlots(
  campaign: { estimatedDurationMinutes: number },
  count = 5
): { start: Date; end: Date }[] {
  const slots: { start: Date; end: Date }[] = [];
  const hours = [9, 10, 11, 14, 15, 16];
  const now = new Date();
  let dayOffset = 1;
  while (slots.length < count * hours.length && dayOffset < 15) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    if (!isWeekend) {
      for (const h of hours) {
        const start = new Date(day);
        start.setHours(h, 0, 0, 0);
        if (start > now) {
          const end = new Date(start.getTime() + campaign.estimatedDurationMinutes * 60000);
          slots.push({ start, end });
        }
      }
    }
    dayOffset += 1;
  }
  return slots;
}

export interface AgentProfileStats {
  assignedToday: number;
  completedToday: number;
  completedThisWeek: number;
  completionRate: number;
}

/** Richer per-agent stats for the agent profile modal — today, this week, and an all-time completion rate. */
export function getAgentProfileStats(db: MockDatabase, agentId: string): AgentProfileStats {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const attempts = db.callAttempts.filter((a) => a.agentId === agentId && a.status === "ended");
  const assignedToday = db.assignments.filter(
    (a) => a.agentId === agentId && new Date(a.assignedAt) >= startOfToday
  ).length;
  const completedToday = attempts.filter(
    (a) => a.disposition === "completed" && new Date(a.startedAt) >= startOfToday
  ).length;
  const completedThisWeek = attempts.filter(
    (a) => a.disposition === "completed" && new Date(a.startedAt) >= startOfWeek
  ).length;
  const completedAllTime = attempts.filter((a) => a.disposition === "completed").length;

  return {
    assignedToday: Math.max(assignedToday, completedToday),
    completedToday,
    completedThisWeek,
    completionRate: attempts.length > 0 ? completedAllTime / attempts.length : 0,
  };
}

export function listAgentsWithStats(db: MockDatabase) {
  return db.agents.map((agent) => {
    const campaignIds = new Set(
      db.campaignAgents.filter((ca) => ca.agentId === agent.id).map((ca) => ca.campaignId)
    );
    const campaignNames = [...campaignIds].map((id) => getCampaign(db, id)?.name).filter(Boolean);
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const attemptsToday = db.callAttempts.filter(
      (a) => a.agentId === agent.id && new Date(a.startedAt) >= startOfToday
    );
    const completedToday = attemptsToday.filter((a) => a.disposition === "completed");
    const completedAllTime = db.callAttempts.filter(
      (a) => a.agentId === agent.id && a.disposition === "completed"
    ).length;
    return {
      agent,
      campaignNames: campaignNames as string[],
      callsToday: attemptsToday.length,
      completedToday: completedToday.length,
      completedAllTime,
    };
  });
}

export function getCallAttemptsForCampaign(
  db: Pick<MockDatabase, "callAttempts">,
  campaignId: string
): CallAttempt[] {
  return db.callAttempts
    .filter((a) => a.campaignId === campaignId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function getRecordingForAttempt(db: Pick<MockDatabase, "recordings">, callAttemptId: string) {
  return db.recordings.find((r) => r.callAttemptId === callAttemptId);
}

export function getCallScript(db: MockDatabase, campaignId: string) {
  return db.callScripts.find((s) => s.campaignId === campaignId);
}

export function getAuditLog(db: Pick<MockDatabase, "auditEvents">, campaignId?: string) {
  return [...db.auditEvents]
    .filter((e) => !campaignId || e.campaignId === campaignId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export { aliasFor };
