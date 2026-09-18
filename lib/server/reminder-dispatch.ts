import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { sendDotgoSms } from "@/lib/adapters/sms-dotgo";
import { renderReminderMessage, type ReminderMessageType } from "@/lib/reminder-templates";
import { generateSecureToken, sha256Hex } from "@/lib/supabase/tokens";

/**
 * The one place that actually sends a claimed appointment_reminders row —
 * shared by the cron dispatch route (app/api/reminders/dispatch) and the
 * admin "Resend now" route (app/api/reminders/resend), so requeue-then-send
 * behaves identically whether it's the scheduler or an admin click that
 * triggered it. Both call sites claim the row first (fn_claim_due_reminders
 * / fn_claim_reminder_by_id) and hand the same shape here.
 */

const MANAGE_LINK_EXPIRY_DAYS = 30;

export interface ClaimedReminder {
  reminder_id: string;
  reminder_type: string;
  campaign_participant_id: string;
  booking_id: string;
  phone: string;
  first_name: string | null;
  client_name: string;
  campaign_name: string;
  scheduled_start: string;
  timezone: string;
  duration_minutes: number;
  incentive_title: string | null;
  incentive_description: string | null;
  send_attempts: number;
}

export interface ReminderSendResult {
  reminderId: string;
  ok: boolean;
  reason?: string;
}

type ServiceClient = ReturnType<typeof createServiceClient>;

async function mintManageBookingLink(supabase: ServiceClient, participantId: string): Promise<string | null> {
  const { data: participant } = await supabase
    .from("campaign_participants")
    .select("token_revoked")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.token_revoked) return null;

  const token = generateSecureToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + MANAGE_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("campaign_participants")
    .update({ invite_token_hash: tokenHash, token_expires_at: expiresAt })
    .eq("id", participantId);

  const appUrl = process.env.APP_PUBLIC_URL;
  return appUrl ? `${appUrl}/participate/${token}` : `/participate/${token}`;
}

export async function sendClaimedReminder(
  supabase: ServiceClient,
  reminder: ClaimedReminder
): Promise<ReminderSendResult> {
  try {
    let manageBookingLink: string | null = null;
    if (reminder.reminder_type !== "cancellation_confirmation") {
      manageBookingLink = await mintManageBookingLink(supabase, reminder.campaign_participant_id);
      if (manageBookingLink === null) {
        await supabase.rpc("fn_record_reminder_outcome", {
          p_reminder_id: reminder.reminder_id,
          p_ok: false,
          p_failure_reason: "Participant's booking link has been revoked.",
        });
        return { reminderId: reminder.reminder_id, ok: false, reason: "Booking link has been revoked." };
      }
    }

    const body = renderReminderMessage(reminder.reminder_type as ReminderMessageType, {
      firstName: reminder.first_name ?? "there",
      clientName: reminder.client_name,
      campaignName: reminder.campaign_name,
      scheduledStart: reminder.scheduled_start,
      timezone: reminder.timezone,
      durationMinutes: reminder.duration_minutes,
      incentiveTitle: reminder.incentive_title,
      incentiveDescription: reminder.incentive_description,
      manageBookingLink,
    });

    const sendResult = await sendDotgoSms({
      to: reminder.phone,
      body,
      requestId: reminder.reminder_id,
    });

    await supabase.rpc("fn_record_reminder_outcome", {
      p_reminder_id: reminder.reminder_id,
      p_ok: sendResult.ok,
      p_failure_reason: sendResult.ok ? undefined : sendResult.errorReason,
    });

    return {
      reminderId: reminder.reminder_id,
      ok: sendResult.ok,
      reason: sendResult.ok ? undefined : (sendResult.errorReason ?? "Send failed."),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unexpected dispatch error.";
    await supabase.rpc("fn_record_reminder_outcome", {
      p_reminder_id: reminder.reminder_id,
      p_ok: false,
      p_failure_reason: reason,
    });
    return { reminderId: reminder.reminder_id, ok: false, reason };
  }
}
