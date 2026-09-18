import "server-only";

/**
 * Real SMSala Voice integration (Voice_API_SMSala.pdf, "Voice Bridge"
 * endpoint) — bridges two real phone numbers without exposing either to the
 * other: SMSala rings `callerNumber` (the agent) first, and once answered,
 * connects the call to `calledNumber` (the participant). Server-only —
 * neither phone number nor SMSALA_AUTH_TOKEN may reach the browser.
 *
 * Confirmed against the real API (its docs get two things wrong):
 *  1. Auth is HTTP Basic — literally the string "api_key" as username, the
 *     "Secret" from SMSala's Voice/VoIP connection page as password — sent
 *     alongside the same secret as the body's `apiToken` field. The doc's
 *     example wraps the request body in a JSON array; the real endpoint
 *     rejects that and wants a plain object instead.
 *  2. `callBackUrl` is documented as optional but the API rejects a request
 *     without one — always sent here.
 * Still unconfirmed: the *response* to this endpoint does come back as an
 * array (matching the doc), but the async callBackUrl payload shape isn't
 * documented at all — see app/api/voice/smsala-callback/route.ts.
 */

const SMSALA_BASE_URL = "https://api2.smsala.com/api";

export interface BridgeCallInput {
  /** E.164 — converted to SMSala's digits-only form internally. */
  callerNumber: string;
  calledNumber: string;
  clientUniqueId: string;
  /** Required by the real API despite the doc marking it optional. */
  callbackUrl: string;
}

export type BridgeCallResult =
  | { ok: true }
  | { ok: false; errorReason: string };

function toSmsalaPhone(e164: string): string {
  return e164.replace(/[^0-9]/g, "");
}

export async function bridgeCall(input: BridgeCallInput): Promise<BridgeCallResult> {
  const apiKey = process.env.SMSALA_API_KEY;
  const authToken = process.env.SMSALA_AUTH_TOKEN;
  if (!apiKey || !authToken) {
    return {
      ok: false,
      errorReason: "SMSala isn't configured — set SMSALA_API_KEY and SMSALA_AUTH_TOKEN.",
    };
  }

  const payload = {
    apiToken: authToken,
    callerNumber: toSmsalaPhone(input.callerNumber),
    calledNumber: toSmsalaPhone(input.calledNumber),
    clientUniqueId: input.clientUniqueId,
    callBackUrl: input.callbackUrl,
  };

  let response: Response;
  try {
    response = await fetch(`${SMSALA_BASE_URL}/VoiceBridge`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      ok: false,
      errorReason: error instanceof Error ? error.message : "Network error contacting SMSala",
    };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { ok: false, errorReason: `SMSala returned a non-JSON response (HTTP ${response.status})` };
  }

  const result = (Array.isArray(data) ? data[0] : data) as
    | { CallSubmitted?: boolean; Remarks?: string }
    | undefined;

  if (!response.ok || !result?.CallSubmitted) {
    return {
      ok: false,
      errorReason: result?.Remarks ?? `SMSala rejected the call (HTTP ${response.status})`,
    };
  }

  return { ok: true };
}
