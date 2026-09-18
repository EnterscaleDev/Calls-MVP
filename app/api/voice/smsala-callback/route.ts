import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Public webhook SMSala calls asynchronously with call status — no user
 * session exists here, so this runs under the service-role client (same
 * trust boundary as app/api/sms/dotgo-callback/route.ts).
 *
 * SMSala's docs don't give a parameter table for this callback at all —
 * only the synchronous VoiceBridge response shape is documented
 * (VoiceResponseId, CallSubmitted, ClientUniqueId, DtmfResponse,
 * CallStatusCode, CallCost, Remarks). This handler assumes the callback
 * reuses that same shape (accepting both PascalCase and the lowerCamelCase
 * request-param spelling defensively) and maps status this way, pending a
 * real call to confirm:
 *  - a numeric CallCost present  -> call ended (cost is only known once
 *    duration is known)
 *  - Remarks/CallStatusCode indicating an error -> failed
 *  - otherwise -> connected (the call is bridged/active)
 * "ended" here only marks status — duration_seconds still comes from the
 * agent's own End Call action (lib/server, call workspace), since no
 * duration field is documented in any SMSala payload.
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
