import type { AppData } from "./app-data";
import type {
  AssignmentStatus,
  Campaign,
  CampaignFunnel,
  CampaignMetrics,
  CallAttempt,
  Contact,
  InterviewBooking,
} from "./types";

export function getCampaign(
  db: Pick<AppData, "campaigns">,
  campaignId: string
): Campaign | undefined {
  return db.campaigns.find((c) => c.id === campaignId);
}

export function getCampaignFunnel(
  db: Pick<AppData, "participants" | "invitations" | "callAttempts">,
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
  db: Pick<AppData, "campaigns" | "participants" | "invitations" | "callAttempts">,
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
  db: Pick<AppData, "participants" | "contacts" | "invitations" | "bookings" | "assignments" | "agents">,
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
export function getAgentProfileStats(
  db: Pick<AppData, "callAttempts" | "assignments">,
  agentId: string
): AgentProfileStats {
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

export function listAgentsWithStats(
  db: Pick<AppData, "agents" | "campaignAgents" | "campaigns" | "callAttempts">
) {
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
  db: Pick<AppData, "callAttempts">,
  campaignId: string
): CallAttempt[] {
  return db.callAttempts
    .filter((a) => a.campaignId === campaignId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function getRecordingForAttempt(db: Pick<AppData, "recordings">, callAttemptId: string) {
  return db.recordings.find((r) => r.callAttemptId === callAttemptId);
}

export function getAuditLog(db: Pick<AppData, "auditEvents">, campaignId?: string) {
  return [...db.auditEvents]
    .filter((e) => !campaignId || e.campaignId === campaignId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
