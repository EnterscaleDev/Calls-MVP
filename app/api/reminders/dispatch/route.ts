import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendClaimedReminder } from "@/lib/server/reminder-dispatch";

/**
 * Cron-triggered dispatch: claims due appointment_reminders rows and sends
 * each one via the shared reminder-dispatch helper. Runs unattended (no
 * admin session — Vercel Cron hits this on a schedule), so it's gated by
 * CRON_SECRET rather than the session-based admin check every other
 * SMS/agent route uses, and it talks to Supabase via the service-role
 * client rather than a user-scoped one for the same reason
 * lib/server/participant-lookup.ts does — see also the migration that
 * revoked anon/authenticated EXECUTE on fn_claim_due_reminders /
 * fn_record_reminder_outcome, which exist for this route (and the admin
 * "resend now" route) alone.
 */

const CLAIM_BATCH_LIMIT = 25;

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

  const results = [];
  for (const reminder of due ?? []) {
    results.push(await sendClaimedReminder(supabase, reminder));
  }

  return NextResponse.json({ ok: true, claimed: (due ?? []).length, results });
}
