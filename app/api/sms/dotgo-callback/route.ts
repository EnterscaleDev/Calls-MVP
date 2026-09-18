import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { mapDotgoCallbackStatus } from "@/lib/adapters/sms-dotgo";

/**
 * Public webhook Dotgo calls asynchronously with delivery status — no user
 * session exists here, so this runs under the service-role client (same
 * trust boundary as lib/server/participant-lookup.ts).
 *
 * Correlating the callback: Dotgo's status callback doesn't document echoing
 * back our request `id`, only `ref_id` (their own generated id, useless to
 * us until we've already matched the row) and `to`. We send our own row's id
 * as `id` on the chance it *is* echoed (see lib/adapters/sms-dotgo.ts) and
 * check for that first — against both campaign_invitations (invite sends)
 * and appointment_reminders (reminder sends, see
 * app/api/reminders/dispatch/route.ts, which passes the reminder's own id
 * the same way); if it's absent, fall back to matching the oldest still-
 * "sent" row of either kind for a participant whose contact has this phone
 * number. That fallback is a best-effort heuristic, not a guarantee — worth
 * confirming once a real webhook payload has actually been observed.
 */

function normalizeDigits(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

interface DotgoCallbackPayload {
  id?: string;
  ref_id?: string;
  status?: string;
  to?: string;
  error_reason?: string;
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as DotgoCallbackPayload | null;
  if (!payload?.status) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = createServiceClient();
  const appStatus = mapDotgoCallbackStatus(payload.status);
  const now = new Date().toISOString();

  let invitationId: string | null = null;
  let reminderId: string | null = null;

  if (payload.id) {
    const { data: invitation } = await supabase
      .from("campaign_invitations")
      .select("id")
      .eq("id", payload.id)
      .maybeSingle();
    if (invitation) {
      invitationId = invitation.id;
    } else {
      const { data: reminder } = await supabase
        .from("appointment_reminders")
        .select("id")
        .eq("id", payload.id)
        .maybeSingle();
      reminderId = reminder?.id ?? null;
    }
  }

  if (!invitationId && !reminderId && payload.to) {
    const targetDigits = normalizeDigits(payload.to);
    const { data: contacts } = await supabase.from("contacts").select("id, phone");
    const matchingContactIds = (contacts ?? [])
      .filter((c) => normalizeDigits(c.phone) === targetDigits)
      .map((c) => c.id);

    if (matchingContactIds.length > 0) {
      const { data: participants } = await supabase
        .from("campaign_participants")
        .select("id")
        .in("contact_id", matchingContactIds);
      const participantIds = (participants ?? []).map((p) => p.id);

      if (participantIds.length > 0) {
        const { data: invitations } = await supabase
          .from("campaign_invitations")
          .select("id")
          .in("participant_id", participantIds)
          .eq("status", "sent")
          .order("sent_at", { ascending: true })
          .limit(1);
        invitationId = invitations?.[0]?.id ?? null;

        if (!invitationId) {
          const { data: reminders } = await supabase
            .from("appointment_reminders")
            .select("id")
            .in("campaign_participant_id", participantIds)
            .eq("status", "sent")
            .order("sent_at", { ascending: true })
            .limit(1);
          reminderId = reminders?.[0]?.id ?? null;
        }
      }
    }
  }

  if (!invitationId && !reminderId) {
    // Nothing to correlate to — ack anyway so Dotgo doesn't keep retrying.
    return NextResponse.json({ ok: true });
  }

  if (invitationId) {
    await supabase
      .from("campaign_invitations")
      .update({
        status: appStatus,
        ...(payload.ref_id ? { provider_message_id: payload.ref_id } : {}),
        delivered_at: appStatus === "delivered" ? now : null,
        failed_at: appStatus === "failed" ? now : null,
        failure_reason: appStatus === "failed" ? (payload.error_reason ?? "Delivery failed") : null,
      })
      .eq("id", invitationId);

    if (appStatus === "delivered" || appStatus === "failed") {
      const { data: invitation } = await supabase
        .from("campaign_invitations")
        .select("participant_id")
        .eq("id", invitationId)
        .maybeSingle();
      if (invitation) {
        await supabase
          .from("campaign_participants")
          .update({ participation_status: appStatus === "delivered" ? "delivered" : "invite_failed" })
          .eq("id", invitation.participant_id);
      }
    }
  } else if (reminderId && (appStatus === "delivered" || appStatus === "failed")) {
    // A webhook-reported failure here is a carrier-level delivery failure
    // after Dotgo already accepted the send — distinct from the dispatch
    // route's own retry/backoff (fn_record_reminder_outcome), which only
    // covers the synchronous accept/reject step. Terminal either way, no
    // further retry triggered from the webhook.
    await supabase
      .from("appointment_reminders")
      .update({
        status: appStatus,
        ...(payload.ref_id ? { provider_message_id: payload.ref_id } : {}),
        delivered_at: appStatus === "delivered" ? now : null,
        failed_at: appStatus === "failed" ? now : null,
        failure_reason: appStatus === "failed" ? (payload.error_reason ?? "Delivery failed") : null,
        updated_at: now,
      })
      .eq("id", reminderId)
      .eq("status", "sent");
  }

  return NextResponse.json({ ok: true });
}
