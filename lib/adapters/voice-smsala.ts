import "server-only";

/**
 * Real SMSala Voice integration (Voice_API_SMSala.pdf, "Voice Bridge"
 * endpoint) — bridges two real phone numbers without exposing either to the
 * other: SMSala rings `callerNumber` (the agent) first, and once answered,
 * connects the call to `calledNumber` (the participant). Server-only —
 * neither phone number nor SMSALA_AUTH_TOKEN may reach the browser.
 *
 * Two things the doc leaves genuinely ambiguous, called out where they
 * matter below:
 *  1. Auth is documented as HTTP Basic (username: your API key, password:
 *     "the integration authentication token"), but the example JSON body
 *     ALSO includes an `apiToken` field. Sending both — Basic Auth with
 *     key/token, and apiToken=token in the body — on the theory the body
 *     field mirrors the Basic Auth password. Worth confirming against a
 *     real call.
 *  2. The synchronous response only confirms the call was *submitted*
 *     (CallSubmitted true/false) — actual ringing/answered status arrives
 *     later via callBackUrl, whose payload shape isn't documented at all.
 *     See app/api/voice/smsala-callback/route.ts for the same caveat.
 */

const SMSALA_BASE_URL = "https://api2.smsala.com/api";

export interface BridgeCallInput {
  /** E.164 — converted to SMSala's digits-only form internally. */
  callerNumber: string;
  calledNumber: string;
  clientUniqueId: string;
  callbackUrl?: string;
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

  const payload = [
    {
      apiToken: authToken,
      callerNumber: toSmsalaPhone(input.callerNumber),
      calledNumber: toSmsalaPhone(input.calledNumber),
      clientUniqueId: input.clientUniqueId,
      ...(input.callbackUrl ? { callBackUrl: input.callbackUrl } : {}),
    },
  ];

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
