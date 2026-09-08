import { makeId, makeSecureToken } from "./id";
import type {
  AgentProfile,
  AuditEvent,
  Campaign,
  CampaignAgent,
  CampaignInvitation,
  CampaignParticipant,
  CallAssignment,
  CallAttempt,
  CallScript,
  ConsentEvent,
  Contact,
  InterviewBooking,
  Recording,
} from "./types";

const ORG_ID = "org_singleton";

function atTime(daysOffset: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function isoNow(): string {
  return new Date().toISOString();
}

export interface OrgCredits {
  sms: number;
  voiceMinutes: number;
}

export interface MockDatabase {
  orgCredits: OrgCredits;
  campaigns: Campaign[];
  contacts: Contact[];
  participants: CampaignParticipant[];
  invitations: CampaignInvitation[];
  consentEvents: ConsentEvent[];
  bookings: InterviewBooking[];
  agents: AgentProfile[];
  campaignAgents: CampaignAgent[];
  assignments: CallAssignment[];
  callAttempts: CallAttempt[];
  recordings: Recording[];
  callScripts: CallScript[];
  auditEvents: AuditEvent[];
}

const CONTACT_NAMES: Array<{ name: string; phone: string; email?: string }> = [
  { name: "Maria Alvarez", phone: "+14155550101", email: "maria.alvarez@example.com" },
  { name: "James Whitfield", phone: "+14155550102", email: "james.whitfield@example.com" },
  { name: "Priya Nair", phone: "+14155550103" },
  { name: "Tom Okafor", phone: "+14155550104", email: "tom.okafor@example.com" },
  { name: "Sana Malik", phone: "+14155550105" },
  { name: "Derek Chan", phone: "+14155550106", email: "derek.chan@example.com" },
  { name: "Ellie Brookes", phone: "+14155550107" },
  { name: "Victor Osei", phone: "+14155550108", email: "victor.osei@example.com" },
  { name: "Naomi Fischer", phone: "+14155550109" },
  { name: "Callum Reid", phone: "+14155550110", email: "callum.reid@example.com" },
  { name: "010 bad number", phone: "not-a-phone" },
  { name: "Ruth Bergman", phone: "+14155550112" },
  { name: "Owen Patel", phone: "+14155550113", email: "owen.patel@example.com" },
  { name: "Chloe Dumont", phone: "+14155550114" },
  { name: "Isaac Muriithi", phone: "+14155550115", email: "isaac.muriithi@example.com" },
  { name: "Hana Suzuki", phone: "+14155550116" },
  { name: "Leo Marchetti", phone: "+14155550117", email: "leo.marchetti@example.com" },
  { name: "Grace Ondieki", phone: "+14155550118" },
  { name: "Peter van Dijk", phone: "+14155550119", email: "peter.vandijk@example.com" },
  { name: "Ayesha Rahman", phone: "+14155550120" },
];

// index-aligned participation status plan for the flagship campaign
const STATUS_PLAN = [
  "completed",
  "completed",
  "scheduled",
  "scheduled",
  "scheduled",
  "scheduled",
  "opted_in",
  "delivered",
  "delivered",
  "delivered",
  "invite_failed",
  "declined",
  "imported",
  "imported",
  "imported",
  "imported",
  "imported",
  "imported",
  "imported",
  "imported",
] as const;

export function buildInitialDatabase(): MockDatabase {
  const now = isoNow();

  const agentPriya: AgentProfile = {
    id: "agent_priya",
    name: "Priya Shah",
    email: "priya.shah@example.com",
    status: "active",
    createdAt: atTime(-10, 9),
  };
  const agentMarcus: AgentProfile = {
    id: "agent_marcus",
    name: "Marcus Webb",
    email: "marcus.webb@example.com",
    status: "invited",
    createdAt: atTime(-2, 9),
  };

  const campaignHexia: Campaign = {
    id: "camp_hexia",
    organisationId: ORG_ID,
    clientName: "Hexia Health",
    name: "Hexia Patient Discovery — September",
    description:
      "Telephone interviews with recently discharged patients to understand gaps in the post-discharge follow-up experience.",
    researchObjective:
      "Identify the top three friction points patients hit between discharge and their first follow-up appointment.",
    campaignType: "telephone_interview",
    status: "active",
    startDate: atTime(-6, 0).slice(0, 10),
    endDate: atTime(24, 0).slice(0, 10),
    targetCompletions: 50,
    dailyAgentTarget: 8,
    estimatedDurationMinutes: 30,
    incentiveTitle: "$25 digital gift card",
    incentiveDescription: "Sent by email within 3 business days of a completed interview.",
    senderId: "HEXIA",
    recordingEnabled: true,
    createdBy: "Toni",
    createdAt: atTime(-6, 9),
    updatedAt: atTime(-1, 15),
  };

  const campaignNorthwind: Campaign = {
    id: "camp_northwind",
    organisationId: ORG_ID,
    clientName: "Northwind Insurance",
    name: "Northwind Renewal Study",
    description: "Understanding why members do or don't renew their policy at year end.",
    researchObjective: "Surface the top reasons members lapse instead of renewing.",
    campaignType: "telephone_interview",
    status: "draft",
    startDate: atTime(3, 0).slice(0, 10),
    endDate: atTime(33, 0).slice(0, 10),
    targetCompletions: 30,
    dailyAgentTarget: 6,
    estimatedDurationMinutes: 20,
    incentiveTitle: "£15 shopping voucher",
    incentiveDescription: "",
    senderId: "NWIND",
    recordingEnabled: false,
    createdBy: "Toni",
    createdAt: atTime(-1, 11),
    updatedAt: atTime(-1, 11),
  };

  const campaignBexley: Campaign = {
    id: "camp_bexley",
    organisationId: ORG_ID,
    clientName: "Bexley Retail Group",
    name: "Bexley Onboarding Feedback",
    description: "Early feedback from new store managers on the onboarding programme.",
    researchObjective: "Find the weakest point in the first-30-days onboarding journey.",
    campaignType: "telephone_interview",
    status: "completed",
    startDate: atTime(-40, 0).slice(0, 10),
    endDate: atTime(-8, 0).slice(0, 10),
    targetCompletions: 15,
    dailyAgentTarget: 5,
    estimatedDurationMinutes: 25,
    incentiveTitle: "None",
    incentiveDescription: "",
    senderId: "BEXLEY",
    recordingEnabled: true,
    createdBy: "Toni",
    createdAt: atTime(-40, 9),
    updatedAt: atTime(-8, 17),
  };

  const contacts: Contact[] = CONTACT_NAMES.map((c, i) => ({
    id: `contact_${i}`,
    organisationId: ORG_ID,
    name: c.name,
    phone: c.phone,
    email: c.email,
    createdAt: atTime(-6, 9),
  }));

  const participants: CampaignParticipant[] = [];
  const invitations: CampaignInvitation[] = [];
  const consentEvents: ConsentEvent[] = [];
  const bookings: InterviewBooking[] = [];
  const assignments: CallAssignment[] = [];
  const callAttempts: CallAttempt[] = [];
  const recordings: Recording[] = [];
  const auditEvents: AuditEvent[] = [];

  function pushAudit(entry: Omit<AuditEvent, "id" | "organisationId">) {
    auditEvents.push({ id: makeId("audit"), organisationId: ORG_ID, ...entry });
  }

  STATUS_PLAN.forEach((status, i) => {
    const contact = contacts[i];
    const participant: CampaignParticipant = {
      id: `participant_${i}`,
      campaignId: campaignHexia.id,
      contactId: contact.id,
      segment: i % 3 === 0 ? "recent-discharge" : "follow-up-cohort",
      participationStatus: status,
      inviteToken: makeSecureToken(),
      tokenRevoked: false,
      tokenExpiresAt: atTime(30, 23, 59),
      createdAt: atTime(-6, 10),
    };
    participants.push(participant);

    if (status === "imported") return;

    const providerMessageId = `mock_sms_seed_${i}`;
    const invitation: CampaignInvitation = {
      id: `invite_${i}`,
      campaignId: campaignHexia.id,
      participantId: participant.id,
      providerMessageId,
      status: status === "invite_failed" ? "failed" : "delivered",
      sentAt: atTime(-5, 10),
      deliveredAt: status === "invite_failed" ? undefined : atTime(-5, 10, 5),
      failedAt: status === "invite_failed" ? atTime(-5, 10) : undefined,
      failureReason: status === "invite_failed" ? "Invalid destination number" : undefined,
    };
    invitations.push(invitation);
    pushAudit({
      campaignId: campaignHexia.id,
      actorType: "system",
      actorName: "SMS provider",
      action: "invitation_sent",
      entityType: "campaign_participant",
      entityId: participant.id,
      createdAt: atTime(-5, 10),
    });

    if (status === "invite_failed") return;

    if (status === "declined") {
      consentEvents.push({
        id: `consent_${i}`,
        campaignId: campaignHexia.id,
        participantId: participant.id,
        consentType: "participation",
        consentVersion: "v1",
        consentStatus: "declined",
        consentedAt: atTime(-4, 13),
        source: "participant_link",
      });
      return;
    }

    if (status === "delivered") return;

    // opted_in, scheduled, completed all consented
    consentEvents.push({
      id: `consent_${i}`,
      campaignId: campaignHexia.id,
      participantId: participant.id,
      consentType: "participation",
      consentVersion: "v1",
      consentStatus: "agreed",
      consentedAt: atTime(-4, 13),
      source: "participant_link",
    });
    if (campaignHexia.recordingEnabled) {
      consentEvents.push({
        id: `consent_rec_${i}`,
        campaignId: campaignHexia.id,
        participantId: participant.id,
        consentType: "recording",
        consentVersion: "v1",
        consentStatus: "agreed",
        consentedAt: atTime(-4, 13),
        source: "participant_link",
      });
    }

    if (status === "opted_in") return;

    // scheduled or completed: has a booking
    let scheduledStart: string;
    let scheduledEnd: string;
    let bookingStatus: InterviewBooking["status"] = "scheduled";
    if (status === "completed") {
      scheduledStart = atTime(i === 0 ? -2 : -3, 10);
      scheduledEnd = atTime(i === 0 ? -2 : -3, 10, 30);
      bookingStatus = "completed";
    } else if (i === 4) {
      // overdue: yesterday, never attempted
      scheduledStart = atTime(-1, 11);
      scheduledEnd = atTime(-1, 11, 30);
    } else if (i === 5) {
      // upcoming, unassigned
      scheduledStart = atTime(1, 14);
      scheduledEnd = atTime(1, 14, 30);
    } else {
      // due today
      scheduledStart = atTime(0, i === 2 ? 9 : 16);
      scheduledEnd = atTime(0, i === 2 ? 9 : 16, 30);
    }

    const booking: InterviewBooking = {
      id: `booking_${i}`,
      campaignId: campaignHexia.id,
      participantId: participant.id,
      scheduledStart,
      scheduledEnd,
      timezone: "Europe/London",
      status: bookingStatus,
      createdAt: atTime(-4, 13, 5),
      updatedAt: atTime(-4, 13, 5),
      history: [{ at: atTime(-4, 13, 5), action: "booked", note: "Participant selected slot" }],
    };
    bookings.push(booking);

    if (status === "scheduled" && i !== 5) {
      const assignment: CallAssignment = {
        id: `assignment_${i}`,
        campaignId: campaignHexia.id,
        participantId: participant.id,
        bookingId: booking.id,
        agentId: agentPriya.id,
        assignedBy: "Toni",
        assignedAt: atTime(-3, 9),
        status: "assigned",
      };
      assignments.push(assignment);
      pushAudit({
        campaignId: campaignHexia.id,
        actorType: "admin",
        actorName: "Toni",
        action: "participant_assigned",
        entityType: "call_assignment",
        entityId: assignment.id,
        metadata: { agentId: agentPriya.id },
        createdAt: atTime(-3, 9),
      });
    }

    if (status === "completed") {
      const assignment: CallAssignment = {
        id: `assignment_${i}`,
        campaignId: campaignHexia.id,
        participantId: participant.id,
        bookingId: booking.id,
        agentId: agentPriya.id,
        assignedBy: "Toni",
        assignedAt: atTime(-3, 9),
        status: "completed",
      };
      assignments.push(assignment);

      const attempt: CallAttempt = {
        id: `attempt_${i}`,
        campaignId: campaignHexia.id,
        participantId: participant.id,
        assignmentId: assignment.id,
        agentId: agentPriya.id,
        providerCallId: `mock_call_seed_${i}`,
        startedAt: scheduledStart,
        connectedAt: atTime(i === 0 ? -2 : -3, i === 0 ? 10 : 10, 1),
        endedAt: atTime(i === 0 ? -2 : -3, i === 0 ? 10 : 10, 28),
        durationSeconds: 27 * 60,
        status: "ended",
        disposition: "completed",
        notes:
          i === 0
            ? "Patient said the discharge paperwork didn't mention how to book the follow-up. Had to call the GP twice. Would prefer a text reminder with a direct booking link."
            : "Smooth discharge, but the follow-up letter arrived after the appointment date had already passed. Suggested email + SMS both going out same day as discharge.",
        createdAt: scheduledStart,
      };
      callAttempts.push(attempt);

      if (campaignHexia.recordingEnabled) {
        recordings.push({
          id: `recording_${i}`,
          campaignId: campaignHexia.id,
          callAttemptId: attempt.id,
          providerRecordingId: `mock_rec_seed_${i}`,
          storageReference: `mock://recordings/${attempt.id}`,
          status: i === 0 ? "available" : "failed",
          duration: i === 0 ? 27 * 60 : undefined,
          createdAt: attempt.endedAt!,
        });
      }

      pushAudit({
        campaignId: campaignHexia.id,
        actorType: "agent",
        actorName: agentPriya.name,
        action: "call_outcome_submitted",
        entityType: "call_attempt",
        entityId: attempt.id,
        metadata: { disposition: "completed" },
        createdAt: attempt.endedAt!,
      });
    }
  });

  const campaignAgents: CampaignAgent[] = [
    {
      id: "campaign_agent_1",
      campaignId: campaignHexia.id,
      agentId: agentPriya.id,
      dailyTarget: campaignHexia.dailyAgentTarget,
      active: true,
    },
  ];

  const callScripts: CallScript[] = [
    {
      campaignId: campaignHexia.id,
      updatedAt: atTime(-5, 9),
      sections: [
        {
          id: "section_intro",
          title: "Introduction & consent reminder",
          instructions:
            "Confirm you're speaking to the right person. Remind them the call may be recorded if they agreed to that on the invitation link.",
          questions: [
            "Can I confirm I'm speaking with {{first_name}}?",
            "Is now still a good time for a 30-minute call?",
          ],
        },
        {
          id: "section_discharge",
          title: "Discharge experience",
          instructions: "Let them tell the story in their own words before probing specifics.",
          questions: [
            "Walk me through what happened between being discharged and your first follow-up appointment.",
            "What, if anything, was confusing or unclear at the point of discharge?",
            "How did you find out when and how to book your follow-up?",
          ],
        },
        {
          id: "section_followup",
          title: "Follow-up scheduling",
          questions: [
            "How easy or difficult was it to actually book the follow-up appointment?",
            "Was there ever a point you considered not booking it at all? Why?",
          ],
        },
        {
          id: "section_close",
          title: "Wrap up",
          instructions: "Thank them and confirm incentive delivery details.",
          questions: [
            "Is there anything else about the discharge-to-follow-up experience you think we should know?",
            "Confirm the best email for the gift card to be sent to.",
          ],
        },
      ],
    },
  ];

  pushAudit({
    campaignId: campaignHexia.id,
    actorType: "admin",
    actorName: "Toni",
    action: "campaign_created",
    entityType: "campaign",
    entityId: campaignHexia.id,
    createdAt: campaignHexia.createdAt,
  });
  pushAudit({
    campaignId: campaignHexia.id,
    actorType: "system",
    actorName: "Contact import",
    action: "contacts_imported",
    entityType: "campaign",
    entityId: campaignHexia.id,
    metadata: { imported: contacts.length },
    createdAt: atTime(-6, 10),
  });

  return {
    orgCredits: { sms: 4180, voiceMinutes: 860 },
    campaigns: [campaignHexia, campaignNorthwind, campaignBexley],
    contacts,
    participants,
    invitations,
    consentEvents,
    bookings,
    agents: [agentPriya, agentMarcus],
    campaignAgents,
    assignments,
    callAttempts,
    recordings,
    callScripts,
    auditEvents,
  };
}

export { ORG_ID };
