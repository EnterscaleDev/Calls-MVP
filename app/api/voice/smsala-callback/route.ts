import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Public webhook SMSala calls asynchronously with call status — no user
 * session exists here, so this runs under the service-role client (same
 * trust boundary as app/api/sms/dotgo-callback/route.ts).
 *
 * UPDATE: the "confirmed not working" conclusion below turned out to be
 * wrong. An earlier real-call test never arrived, but that test's
 * callBackUrl pointed at http://localhost:3000 (from .env.local) — not
 * reachable from SMSala's servers at all, which fully explains the silence
 * on its own. A follow-up manual test (asking SMSala's own team to hit a
 * reachable endpoint directly, not through this app) confirmed the
 * callback genuinely fires, with this real payload shape:
 *   { voiceResponseId, callSubmitted, clientUniqueId, dtmfResponse,
 *     callStatusCode, callCost, remarks }
 * — camelCase, matching the lowercase fallback fields already handled
 * below. NORMAL_CLEARING + a numeric callCost was the observed "call ended
 * normally" case, which maps to "ended" here correctly.
 *
 * STILL UNVERIFIED: that test's clientUniqueId came back null, because it
 * was a manual SMSala-side test that never set one — so whether a real
 * clientUniqueId (as app/api/voice/bridge/route.ts always sends, set to
 * the call_attempts row's own id) actually round-trips back on a callback
 * from a real app-originated call is still unconfirmed. Until that's
 * tested end-to-end, treat correlation as the remaining open question, not
 * delivery — the call workspace's polling fallback
 * (app/agent/(queue)/call/[assignmentId]/page.tsx) should stay in place
 * either way, since it's needed for calls that finish inside the poll
 * window even once the webhook is fully trusted.
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
