"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type {
  Campaign,
  CampaignParticipant,
  CampaignInvitation,
  CallAttempt,
  InterviewBooking,
  CallAssignment,
  Contact,
  AgentProfile,
  AgentInvitation,
  CampaignAgent,
  Recording,
  AuditEvent,
  AppointmentReminder,
} from "@/lib/types";
import type { OrgCredits } from "@/lib/app-data";

type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
type ParticipantRow = Pick<
  Database["public"]["Tables"]["campaign_participants"]["Row"],
  "id" | "campaign_id" | "contact_id" | "segment" | "participation_status" | "token_revoked" | "token_expires_at" | "created_at"
>;
type InvitationRow = Database["public"]["Tables"]["campaign_invitations"]["Row"];
type CallAttemptRow = Database["public"]["Tables"]["call_attempts"]["Row"];
type BookingRow = Database["public"]["Tables"]["interview_bookings"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["call_assignments"]["Row"];
type AgentRow = Database["public"]["Tables"]["agent_profiles"]["Row"];
type AgentInvitationRow = Database["public"]["Tables"]["user_invitations"]["Row"];
type CampaignAgentRow = Database["public"]["Tables"]["campaign_agents"]["Row"];
type RecordingRow = Database["public"]["Tables"]["recordings"]["Row"];
type AuditEventRow = Database["public"]["Tables"]["audit_events"]["Row"];
type AppointmentReminderRow = Database["public"]["Tables"]["appointment_reminders"]["Row"];
type OrgCreditsRow = Database["public"]["Tables"]["org_credits"]["Row"];
type MaskedContactRow =
  Database["public"]["Functions"]["contacts_list_masked"]["Returns"][number];

function mapCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    clientName: row.client_name,
    name: row.name,
    description: row.description,
    researchObjective: row.research_objective,
    campaignType: "telephone_interview",
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    targetCompletions: row.target_completions,
    dailyAgentTarget: row.daily_agent_target,
    estimatedDurationMinutes: row.estimated_duration_minutes,
    incentiveTitle: row.incentive_title,
    incentiveDescription: row.incentive_description,
    senderId: row.sender_id,
    recordingEnabled: row.recording_enabled,
    sendBookingConfirmation: row.send_booking_confirmation,
    sendReminder24h: row.send_reminder_24h,
    sendReminder1h: row.send_reminder_1h,
    reminder24hOffsetMinutes: row.reminder_24h_offset_minutes,
    reminder1hOffsetMinutes: row.reminder_1h_offset_minutes,
    createdBy: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
    statusBeforeArchive: row.status_before_archive ?? undefined,
  };
}

// invite_token_hash has no column grant for admin at all — it's never fetched
// here, so there's nothing real to put in the mock shape's inviteToken field.
function mapParticipant(row: ParticipantRow): CampaignParticipant {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    contactId: row.contact_id,
    segment: row.segment ?? undefined,
    participationStatus: row.participation_status,
    inviteToken: "",
    tokenRevoked: row.token_revoked,
    tokenExpiresAt: row.token_expires_at,
    createdAt: row.created_at,
  };
}

function mapInvitation(row: InvitationRow): CampaignInvitation {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    participantId: row.participant_id,
    providerMessageId: row.provider_message_id,
    status: row.status,
    sentAt: row.sent_at ?? undefined,
    deliveredAt: row.delivered_at ?? undefined,
    failedAt: row.failed_at ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    clickedAt: row.clicked_at ?? undefined,
  };
}

function mapCallAttempt(row: CallAttemptRow): CallAttempt {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    participantId: row.participant_id,
    assignmentId: row.assignment_id,
    agentId: row.agent_id,
    providerCallId: row.provider_call_id,
    startedAt: row.started_at ?? "",
    connectedAt: row.connected_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    status: row.status,
    disposition: row.disposition ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

function mapBooking(row: BookingRow): InterviewBooking {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    participantId: row.participant_id,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    timezone: row.timezone,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssignment(row: AssignmentRow): CallAssignment {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    participantId: row.participant_id,
    bookingId: row.booking_id,
    agentId: row.agent_id,
    assignedBy: row.assigned_by_name,
    assignedAt: row.assigned_at,
    status: row.status,
  };
}

function mapAgent(row: AgentRow): AgentProfile {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, status: row.status, createdAt: row.created_at };
}

function mapCampaignAgent(row: CampaignAgentRow): CampaignAgent {
  return { id: row.id, campaignId: row.campaign_id, agentId: row.agent_id, dailyTarget: row.daily_target, active: row.active };
}

// A stored status of 'pending' past its own expires_at is displayed as
// 'expired' rather than left looking falsely still-pending — there's no
// background job flipping the stored value, so this is computed on read.
function mapAgentInvitation(row: AgentInvitationRow): AgentInvitation {
  const effectiveStatus =
    row.status === "pending" && new Date(row.expires_at).getTime() < Date.now() ? "expired" : row.status;
  return {
    id: row.id,
    agentProfileId: row.agent_profile_id,
    email: row.email,
    status: effectiveStatus,
    expiresAt: row.expires_at,
    invitedByName: row.invited_by_name,
    createdAt: row.created_at,
  };
}

function mapRecording(row: RecordingRow): Recording {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    callAttemptId: row.call_attempt_id,
    providerRecordingId: row.provider_recording_id,
    storageReference: row.storage_reference,
    status: row.status,
    duration: row.duration ?? undefined,
    createdAt: row.created_at,
  };
}

function mapAppointmentReminder(row: AppointmentReminderRow): AppointmentReminder {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    campaignParticipantId: row.campaign_participant_id,
    bookingId: row.booking_id,
    reminderType: row.reminder_type,
    status: row.status,
    scheduledFor: row.scheduled_for,
    sendAttempts: row.send_attempts,
    sentAt: row.sent_at ?? undefined,
    deliveredAt: row.delivered_at ?? undefined,
    failedAt: row.failed_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    providerMessageId: row.provider_message_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAuditEvent(row: AuditEventRow): AuditEvent {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    campaignId: row.campaign_id ?? undefined,
    actorType: row.actor_type,
    actorName: row.actor_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: (row.metadata as Record<string, string | number | boolean>) ?? undefined,
    createdAt: row.created_at,
  };
}

// contacts_list_masked() is the only admin-facing read path for contact data
// (the raw `contacts` table has zero RLS grant for any client role) — real
// name, masked phone. The masked phone string doubles as this shape's `phone`
// field so nothing in Stage 3 can accidentally display a raw number; a real
// reveal is Stage 4's contacts_reveal() call, not this hook.
function mapMaskedContact(row: MaskedContactRow): Contact {
  return {
    id: row.id,
    organisationId: "",
    name: row.name,
    phone: row.phone_masked,
    email: row.has_email ? "on file" : undefined,
    externalCustomerId: row.has_external_id ? "on file" : undefined,
    createdAt: row.created_at,
  };
}

export interface AdminData {
  campaigns: Campaign[];
  participants: CampaignParticipant[];
  invitations: CampaignInvitation[];
  callAttempts: CallAttempt[];
  bookings: InterviewBooking[];
  assignments: CallAssignment[];
  contacts: Contact[];
  agents: AgentProfile[];
  agentInvitations: AgentInvitation[];
  campaignAgents: CampaignAgent[];
  recordings: Recording[];
  auditEvents: AuditEvent[];
  appointmentReminders: AppointmentReminder[];
  orgCredits: OrgCredits;
}

const PARTICIPANT_COLUMNS =
  "id, campaign_id, contact_id, segment, participation_status, token_revoked, token_expires_at, created_at";

/**
 * Org-wide admin data — campaigns plus everything needed to compute funnels/
 * metrics/interview-state breakdowns across them, in one fetch. Deliberately
 * broad rather than page-scoped: at this app's scale (single-digit campaigns,
 * tens of participants) fetching everything once and letting each page filter
 * client-side (exactly like the old mock `db`) is simpler and safer than a
 * dozen narrower queries, and keeps lib/selectors.ts's existing pure
 * functions reusable as-is.
 */
export function useAdminData() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const [
      campaigns,
      participants,
      invitations,
      callAttempts,
      bookings,
      assignments,
      agents,
      agentInvitations,
      campaignAgents,
      recordings,
      maskedContacts,
      auditEvents,
      appointmentReminders,
      orgCredits,
    ] = await Promise.all([
      supabase.from("campaigns").select("*"),
      supabase.from("campaign_participants").select(PARTICIPANT_COLUMNS),
      supabase.from("campaign_invitations").select("*"),
      supabase.from("call_attempts").select("*"),
      supabase.from("interview_bookings").select("*"),
      supabase.from("call_assignments").select("*"),
      supabase.from("agent_profiles").select("*"),
      supabase.from("user_invitations").select("*"),
      supabase.from("campaign_agents").select("*"),
      supabase.from("recordings").select("*"),
      supabase.rpc("contacts_list_masked"),
      supabase.from("audit_events").select("*"),
      supabase.from("appointment_reminders").select("*"),
      supabase.from("org_credits").select("*").single(),
    ]);

    const firstError =
      campaigns.error ||
      participants.error ||
      invitations.error ||
      callAttempts.error ||
      bookings.error ||
      assignments.error ||
      agents.error ||
      agentInvitations.error ||
      campaignAgents.error ||
      recordings.error ||
      maskedContacts.error ||
      auditEvents.error ||
      appointmentReminders.error ||
      orgCredits.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const orgCreditsRow = orgCredits.data as OrgCreditsRow;
    setData({
      campaigns: (campaigns.data ?? []).map(mapCampaign),
      participants: ((participants.data ?? []) as ParticipantRow[]).map(mapParticipant),
      invitations: (invitations.data ?? []).map(mapInvitation),
      callAttempts: (callAttempts.data ?? []).map(mapCallAttempt),
      bookings: (bookings.data ?? []).map(mapBooking),
      assignments: (assignments.data ?? []).map(mapAssignment),
      agents: (agents.data ?? []).map(mapAgent),
      agentInvitations: (agentInvitations.data ?? []).map(mapAgentInvitation),
      campaignAgents: (campaignAgents.data ?? []).map(mapCampaignAgent),
      recordings: (recordings.data ?? []).map(mapRecording),
      contacts: (maskedContacts.data ?? []).map(mapMaskedContact),
      auditEvents: (auditEvents.data ?? []).map(mapAuditEvent),
      appointmentReminders: (appointmentReminders.data ?? []).map(mapAppointmentReminder),
      orgCredits: { sms: orgCreditsRow.sms, voiceMinutes: orgCreditsRow.voice_minutes },
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
