import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Resolves a call assignment to the participant's real phone number,
 * server-side only — this is the one function a real telephony integration
 * needs that the browser must never see the result of.
 *
 * Uses the service-role client deliberately: contacts has zero RLS grant
 * for any client role (admin included — admin only ever gets there through
 * the audited contacts_reveal() RPC), and there's no admin/agent/participant
 * session to act as here anyway. Three short sequential lookups rather than
 * one embedded PostgREST select, so a "not found" at any step in the chain
 * (bad assignment id, participant with no contact, etc.) gets a clear,
 * specific error instead of a silent null.
 *
 * This is deliberately the *only* function real call-initiation code
 * depends on for participant data, matching the adapter-boundary pattern
 * already used for lib/adapters/sms.ts and lib/adapters/telephony.ts — no
 * caller exists yet (telephony adapters stay mocked for now); this is
 * verified standalone against the real seed data, not through the UI.
 */
export async function resolveParticipantPhone(assignmentId: string): Promise<string> {
  const supabase = createServiceClient();

  const { data: assignment, error: assignmentError } = await supabase
    .from("call_assignments")
    .select("participant_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (assignmentError) throw new Error(`Failed to look up call assignment: ${assignmentError.message}`);
  if (!assignment) throw new Error(`No call assignment found for id ${assignmentId}`);

  const { data: participant, error: participantError } = await supabase
    .from("campaign_participants")
    .select("contact_id")
    .eq("id", assignment.participant_id)
    .maybeSingle();
  if (participantError) throw new Error(`Failed to look up participant: ${participantError.message}`);
  if (!participant) throw new Error(`No participant found for assignment ${assignmentId}`);

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("phone")
    .eq("id", participant.contact_id)
    .maybeSingle();
  if (contactError) throw new Error(`Failed to look up contact: ${contactError.message}`);
  if (!contact) throw new Error(`No contact found for assignment ${assignmentId}`);

  return contact.phone;
}
