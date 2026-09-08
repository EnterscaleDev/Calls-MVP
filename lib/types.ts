// Core domain types for the Calls MVP mock backend.
// Field names intentionally mirror the eventual Supabase schema so the
// backend phase can map onto these shapes with minimal translation.

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
  recordingEnabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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
}

export interface SmsTemplate {
  campaignId: string;
  senderId: string;
  body: string;
  incentiveText: string;
  savedAsDraft: boolean;
}

export type ConsentType = "participation" | "recording";
export type ConsentStatus = "agreed" | "declined";

export interface ConsentEvent {
  id: string;
  campaignId: string;
  participantId: string;
  consentType: ConsentType;
  consentVersion: string;
  consentStatus: ConsentStatus;
  consentedAt: string;
  source: string;
}

export type BookingStatus =
  | "scheduled"
  | "rescheduled"
  | "cancelled"
  | "completed"
  | "missed";

export interface BookingHistoryEntry {
  at: string;
  action: string;
  note?: string;
}

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
  history: BookingHistoryEntry[];
}

export type AgentStatus = "invited" | "active" | "inactive";

export interface AgentProfile {
  id: string;
  name: string;
  email: string;
  status: AgentStatus;
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

export interface CallScript {
  campaignId: string;
  sections: CallScriptSection[];
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
