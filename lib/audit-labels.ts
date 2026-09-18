// Shared between the per-campaign audit tab and the global audit log —
// same action vocabulary either way.
export const SENSITIVE_ACTIONS = new Set([
  "recording_accessed",
  "data_exported",
  "contact_numbers_revealed",
]);
export const ACCESS_ACTIONS = new Set(["recording_accessed", "contact_numbers_revealed"]);

const ACTION_LABELS: Record<string, string> = {
  campaign_created: "Campaign created",
  campaign_deleted: "Campaign deleted",
  campaign_status_changed: "Status changed",
  campaign_duplicated: "Campaign duplicated",
  campaign_restored: "Campaign restored from archive",
  campaign_details_updated: "Campaign details edited",
  campaign_recording_setting_changed: "Recording setting changed",
  contact_numbers_revealed: "Contact numbers revealed",
  credits_topped_up: "Credits topped up",
  contacts_imported: "Contacts imported",
  invitation_sent: "Invitation sent",
  sms_batch_sent: "SMS batch sent",
  consent_recorded: "Consent recorded",
  booking_created: "Booking created",
  booking_rescheduled: "Booking rescheduled",
  booking_cancelled: "Booking cancelled",
  agent_invited: "Agent invited",
  agent_attached_to_campaign: "Agent attached to campaign",
  agent_detached_from_campaign: "Agent removed from campaign",
  participant_assigned: "Participant assigned to agent",
  participant_reassigned: "Participant reassigned",
  call_initiated: "Call initiated",
  call_outcome_submitted: "Call outcome submitted",
};

function labelize(action: string): string {
  return action
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function describeAction(action: string): string {
  return ACTION_LABELS[action] ?? labelize(action);
}
