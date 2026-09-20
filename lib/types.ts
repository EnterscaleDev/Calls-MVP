// Core domain view-model types for Calls MVP. Field names mirror the real
// Supabase schema (see lib/supabase/database.types.ts) — these are the
// camelCase shapes lib/hooks/*.ts map real rows into, and lib/selectors.ts's
// pure functions are typed against.

export type CampaignStatus =
  | "draft"
  | "ready"
  | "active"
  | "paused"
  | "completed"
  | "archived";

export interface Campaign {
  id: string;
  organisationId: string;
  clientName: string;
  name: string;
  description: string;
  researchObjective: string;
  campaignType: "telephone_interview";
  status: CampaignStatus;
  startDate: string; // ISO date
  endDate: string; // ISO date
  targetCompletions: number;
  dailyAgentTarget: number;
  estimatedDurationMinutes: number;
  incentiveTitle: string;
  incentiveDescription: string;
  senderId: string;
  invitationMessageBody?: string;
  recordingEnabled: boolean;
  sendBookingConfirmation: boolean;
  sendReminder24h: boolean;
  sendReminder1h: boolean;
  reminder24hOffsetMinutes: number;
  reminder1hOffsetMinutes: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  statusBeforeArchive?: CampaignStatus;
}

export interface Contact {
  id: string;
  organisationId: string;
  name: string;
  phone: string;
  email?: string;
  externalCustomerId?: string;
  createdAt: string;
}

export type RowValidationStatus =
  | "valid"
  | "invalid_phone"
  | "missing_phone"
  | "duplicate";

export interface ParsedContactRow {
  rowIndex: number;
  name: string;
  phone: string;
  email?: string;
  externalCustomerId?: string;
  segment?: string;
  validation: RowValidationStatus;
}

export type ParticipationStatus =
  | "imported"
  | "invited"
  | "delivered"
  | "invite_failed"
  | "opted_in"
  | "declined"
  | "scheduled"
  | "completed"
  | "ineligible";

export interface CampaignParticipant {
  id: string;
  campaignId: string;
  contactId: string;
  segment?: string;
  participationStatus: ParticipationStatus;
  inviteToken: string;
  tokenRevoked: boolean;
  tokenExpiresAt: string;
  createdAt: string;
}

export type InvitationStatus = "queued" | "sent" | "delivered" | "failed";

export interface CampaignInvitation {
  id: string;
  campaignId: string;
  participantId: string;
  providerMessageId: string;
  status: InvitationStatus;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  failureReason?: string;
  clickedAt?: string;
}

export type BookingStatus =
  | "scheduled"
  | "rescheduled"
  | "cancelled"
  | "completed"
  | "missed";

export interface InterviewBooking {
  id: string;
  campaignId: string;
  participantId: string;
  scheduledStart: string; // ISO datetime
  scheduledEnd: string; // ISO datetime
  timezone: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}

export type AgentStatus = "invited" | "active" | "inactive";

export interface AgentProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: AgentStatus;
  createdAt: string;
}

export type AgentInvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface AgentInvitation {
  id: string;
  agentProfileId: string;
  email: string;
  status: AgentInvitationStatus;
  expiresAt: string;
  invitedByName: string;
  createdAt: string;
}

export interface CampaignAgent {
  id: string;
  campaignId: string;
  agentId: string;
  dailyTarget: number;
  active: boolean;
}

export type AssignmentStatus =
  | "assigned"
  | "in_progress"
  | "completed"
  | "reassigned"
  | "cancelled";

export interface CallAssignment {
  id: string;
  campaignId: string;
  participantId: string;
  bookingId: string;
  agentId: string;
  assignedBy: string;
  assignedAt: string;
  status: AssignmentStatus;
}

export type CallOutcome =
  | "completed"
  | "no_answer"
  | "busy"
  | "reschedule_requested"
  | "declined"
  | "wrong_number"
  | "ineligible"
  | "follow_up_required"
  | "technical_failure";

export type CallAttemptStatus =
  | "preparing"
  | "connecting"
  | "connected"
  | "failed"
  | "ended";

export interface CallAttempt {
  id: string;
  campaignId: string;
  participantId: string;
  assignmentId: string;
  agentId: string;
  providerCallId: string;
  startedAt: string;
  connectedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  status: CallAttemptStatus;
  disposition?: CallOutcome;
  notes?: string;
  createdAt: string;
}

export type RecordingStatus =
  | "recording"
  | "available"
  | "failed"
  | "unavailable";

export interface Recording {
  id: string;
  campaignId: string;
  callAttemptId: string;
  providerRecordingId: string;
  storageReference: string;
  status: RecordingStatus;
  duration?: number;
  createdAt: string;
}

export interface CallScriptSection {
  id: string;
  title: string;
  instructions?: string;
  questions: string[];
}

export type ReminderType =
  | "booking_confirmation"
  | "reminder_24h"
  | "reminder_1h"
  | "reschedule_confirmation"
  | "cancellation_confirmation";

export type ReminderStatus =
  | "scheduled"
  | "processing"
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "cancelled"
  | "skipped";

export interface AppointmentReminder {
  id: string;
  campaignId: string;
  campaignParticipantId: string;
  bookingId: string;
  reminderType: ReminderType;
  status: ReminderStatus;
  scheduledFor: string;
  sendAttempts: number;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  failureReason?: string;
  providerMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ActorType = "admin" | "agent" | "participant" | "system";

export interface AuditEvent {
  id: string;
  organisationId: string;
  campaignId?: string;
  actorType: ActorType;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
}

// --- Derived / view-model shapes -------------------------------------------------

// What an Agent is allowed to see about a participant. No phone, no email,
// no external customer id — only what's needed to run the interview.
export interface AgentParticipantView {
  assignmentId: string;
  participantAlias: string;
  campaignId: string;
  campaignName: string;
  bookingId: string;
  scheduledStart: string;
  scheduledEnd: string;
  estimatedDurationMinutes: number;
  status: AssignmentStatus;
  lastOutcome?: CallOutcome;
}

export interface CampaignFunnel {
  contacts: number;
  invited: number;
  delivered: number;
  optedIn: number;
  scheduled: number;
  attempted: number;
  completed: number;
}

export interface CampaignMetrics {
  contacts: number;
  invitationsSent: number;
  delivered: number;
  optedIn: number;
  scheduled: number;
  callsAttempted: number;
  completed: number;
  completionRate: number;
}
