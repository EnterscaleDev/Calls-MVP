import type {
  AgentProfile,
  AppointmentReminder,
  AuditEvent,
  Campaign,
  CampaignAgent,
  CampaignInvitation,
  CampaignParticipant,
  CallAssignment,
  CallAttempt,
  Contact,
  InterviewBooking,
  Recording,
} from "./types";

export interface OrgCredits {
  sms: number;
  voiceMinutes: number;
}

/**
 * The shape lib/selectors.ts's pure functions are typed against, satisfied
 * structurally by both real data hooks (lib/hooks/useAdminData.ts,
 * lib/hooks/useAgentData.ts) rather than any single concrete type — each
 * selector only ever asks for `Pick<AppData, "...">`, so a hook only needs
 * to provide the fields a given selector actually reads.
 */
export interface AppData {
  orgCredits: OrgCredits;
  campaigns: Campaign[];
  contacts: Contact[];
  participants: CampaignParticipant[];
  invitations: CampaignInvitation[];
  bookings: InterviewBooking[];
  agents: AgentProfile[];
  campaignAgents: CampaignAgent[];
  assignments: CallAssignment[];
  callAttempts: CallAttempt[];
  recordings: Recording[];
  auditEvents: AuditEvent[];
  appointmentReminders: AppointmentReminder[];
}
