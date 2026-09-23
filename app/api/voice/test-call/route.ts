import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bridgeCall } from "@/lib/adapters/voice-smsala";

/**
 * Admin-only: places a real SMSala VoiceBridge call between two numbers
 * you supply directly, with no campaign/booking/assignment required — the
 * normal /api/voice/bridge path can only ever be reached through a real
 * assigned call, which makes it impossible to test the telephony
 * integration itself without a full live campaign in flight.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, errorReason: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organisation_id, display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ ok: false, errorReason: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { callerNumber?: string; calledNumber?: string } | null;
  if (!body?.callerNumber || !body?.calledNumber) {
    return NextResponse.json({ ok: false, errorReason: "Missing callerNumber/calledNumber." }, { status: 400 });
  }

  const appUrl = process.env.APP_PUBLIC_URL;
  if (!appUrl) {
    return NextResponse.json(
      { ok: false, errorReason: "APP_PUBLIC_URL isn't set — SMSala requires a callback URL." },
      { status: 500 }
    );
  }

  const clientUniqueId = `test-${crypto.randomUUID()}`;
  const result = await bridgeCall({
    callerNumber: body.callerNumber,
    calledNumber: body.calledNumber,
    clientUniqueId,
    callbackUrl: `${appUrl}/api/voice/smsala-callback`,
  });

  if (profile.organisation_id) {
    await supabase.from("audit_events").insert({
      organisation_id: profile.organisation_id,
      actor_type: "admin",
      actor_user_id: user.id,
      actor_name: profile.display_name ?? "admin",
      action: result.ok ? "test_call_placed" : "test_call_failed",
      entity_type: "voice",
      entity_id: clientUniqueId,
      metadata: { callerNumber: body.callerNumber, calledNumber: body.calledNumber },
    });
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
