import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendClaimedReminder } from "@/lib/server/reminder-dispatch";

/**
 * Admin-triggered "Resend now" for a failed/cancelled/skipped reminder.
 * Two steps against two different trust boundaries: admin_requeue_reminder
 * runs under the admin's own session (its own fn_is_admin() gate gets the
 * real enforcement), then the actual claim+send reuses the same
 * service-role path the cron route uses — fn_claim_reminder_by_id /
 * fn_record_reminder_outcome aren't reachable with a user session at all
 * (see the migration revoking anon/authenticated EXECUTE on them).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, errorReason: "Not signed in." }, { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ ok: false, errorReason: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { reminderId?: string } | null;
  if (!body?.reminderId) {
    return NextResponse.json({ ok: false, errorReason: "Missing reminderId." }, { status: 400 });
  }

  const { error: requeueError } = await supabase.rpc("admin_requeue_reminder", {
    p_reminder_id: body.reminderId,
  });
  if (requeueError) {
    return NextResponse.json({ ok: false, errorReason: requeueError.message }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: claimed, error: claimError } = await service.rpc("fn_claim_reminder_by_id", {
    p_reminder_id: body.reminderId,
  });
  if (claimError) {
    return NextResponse.json({ ok: false, errorReason: claimError.message }, { status: 500 });
  }
  const reminder = claimed?.[0];
  if (!reminder) {
    return NextResponse.json(
      { ok: false, errorReason: "Couldn't claim this reminder for resend — it may already be processing." },
      { status: 409 }
    );
  }

  const result = await sendClaimedReminder(service, reminder);
  return NextResponse.json({ ok: result.ok, errorReason: result.ok ? undefined : result.reason });
}
