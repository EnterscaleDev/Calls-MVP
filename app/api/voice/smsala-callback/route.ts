import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Public webhook SMSala calls asynchronously with call status — no user
 * session exists here, so this runs under the service-role client (same
 * trust boundary as app/api/sms/dotgo-callback/route.ts).
 *
 * CONFIRMED NOT WORKING: tested against a real, fully successful, completed
 * two-party bridge call (both legs rang, both sides actually spoke) with
 * callBackUrl set to this route on every request — nothing ever arrived.
 * SMSala's callBackUrl mechanism simply doesn't fire for Voice Bridge,
 * regardless of outcome. This route is kept in case that changes on their
 * end (worth asking their support directly), but nothing in the app may
 * depend on it actually being called — see the call workspace's polling
 * fallback (app/agent/(queue)/call/[assignmentId]/page.tsx), which treats
 * a successful bridge submission as sufficient evidence the call is
 * connected after a short grace period, specifically because of this gap.
 *
 * The status-mapping logic below is unverified for the same reason (no
 * real payload has ever been observed to test it against) — it's a
 * best-effort guess based only on the synchronous VoiceBridge response
 * shape (VoiceResponseId, CallSubmitted, ClientUniqueId, DtmfResponse,
 * CallStatusCode, CallCost, Remarks), which SMSala's docs don't confirm the
 * callback reuses.
 *
 * Correlates to a call_attempts row via ClientUniqueId, which
 * app/api/voice/bridge/route.ts sets to the attempt's own id.
 */

interface SmsalaCallbackPayload {
  ClientUniqueId?: string;
  clientUniqueId?: string;
  CallStatusCode?: number;
  callStatusCode?: number;
  CallCost?: number | string | null;
  callCost?: number | string | null;
  Remarks?: string;
  remarks?: string;
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as SmsalaCallbackPayload | null;
  const attemptId = payload?.ClientUniqueId ?? payload?.clientUniqueId;
  if (!attemptId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const remarks = payload?.Remarks ?? payload?.remarks;
  const callCost = payload?.CallCost ?? payload?.callCost;
  const statusCode = payload?.CallStatusCode ?? payload?.callStatusCode;

  const looksFailed =
    (typeof remarks === "string" && /invalid|fail|error|reject|busy|no answer/i.test(remarks)) ||
    (typeof statusCode === "number" && statusCode < 0);
  const looksEnded = callCost !== null && callCost !== undefined && callCost !== "";

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  if (looksFailed) {
    await supabase.from("call_attempts").update({ status: "failed" }).eq("id", attemptId);
  } else if (looksEnded) {
    await supabase.from("call_attempts").update({ status: "ended", ended_at: now }).eq("id", attemptId);
  } else {
    await supabase
      .from("call_attempts")
      .update({ status: "connected", connected_at: now })
      .eq("id", attemptId)
      .is("connected_at", null);
  }

  return NextResponse.json({ ok: true });
}
