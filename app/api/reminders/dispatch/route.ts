import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendDotgoSms } from "@/lib/adapters/sms-dotgo";
import { renderReminderMessage, type ReminderMessageType } from "@/lib/reminder-templates";
import { generateSecureToken, sha256Hex } from "@/lib/supabase/tokens";

/**
 * Cron-triggered dispatch: claims due appointment_reminders rows and sends
 * each one via Dotgo. Runs unattended (no admin session — Vercel Cron hits
 * this on a schedule), so it's gated by CRON_SECRET rather than the
 * session-based admin check every other SMS/agent route uses, and it talks
 * to Supabase via the service-role client rather than a user-scoped one for
 * the same reason lib/server/participant-lookup.ts does — see also the
 * migration that revoked anon/authenticated EXECUTE on the two RPCs below,
 * which exist for this route alone.
 */

const CLAIM_BATCH_LIMIT = 25;
const MANAGE_LINK_EXPIRY_DAYS = 30;

async function mintManageBookingLink(
  supabase: ReturnType<typeof createServiceClient>,
  participantId: string
): Promise<string | null> {
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

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, errorReason: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: due, error: claimError } = await supabase.rpc("fn_claim_due_reminders", {
    p_limit: CLAIM_BATCH_LIMIT,
  });
  if (claimError) {
    return NextResponse.json({ ok: false, errorReason: claimError.message }, { status: 500 });
  }

  const results: Array<{ reminderId: string; ok: boolean; reason?: string }> = [];

  for (const reminder of due ?? []) {
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
          results.push({ reminderId: reminder.reminder_id, ok: false, reason: "link revoked" });
          continue;
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

      results.push({
        reminderId: reminder.reminder_id,
        ok: sendResult.ok,
        reason: sendResult.ok ? undefined : (sendResult.errorReason ?? "Send failed."),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unexpected dispatch error.";
      await supabase.rpc("fn_record_reminder_outcome", {
        p_reminder_id: reminder.reminder_id,
        p_ok: false,
        p_failure_reason: reason,
      });
      results.push({ reminderId: reminder.reminder_id, ok: false, reason });
    }
  }

  return NextResponse.json({ ok: true, claimed: (due ?? []).length, results });
}
