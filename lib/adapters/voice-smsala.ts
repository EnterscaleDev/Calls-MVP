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
 * The *response* to this endpoint comes back as an array (matching the
 * doc). The async callBackUrl payload shape isn't documented anywhere, but
 * is now confirmed by a real captured example — see
 * app/api/voice/smsala-callback/route.ts.
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

export type SmsalaBalanceResult =
  | { ok: true; company: string; balance: number; creditLimit: number }
  | { ok: false; errorReason: string };

/**
 * Real SMSala account balance — CheckBalance, confirmed against the real
 * account (not in the Voice API doc; found by probing api2.smsala.com).
 * Two things confirmed live, not guessed:
 *  1. It's a plain GET at https://api2.smsala.com/CheckBalance?apiToken=...
 *     — no "/api" prefix (unlike VoiceBridge/VoiceFile/etc.), no Basic Auth.
 *  2. It takes a *separate* account-level token from SMSALA_AUTH_TOKEN (the
 *     Voice Connection's Basic Auth secret) — SMSala's dashboard has a
 *     distinct "Manage API" section (under Send SMS) issuing its own
 *     per-endpoint tokens with their own IP allowlist. SMSALA_ACCOUNT_TOKEN
 *     here is that token, not the Voice one.
 */
export async function getSmsalaBalance(): Promise<SmsalaBalanceResult> {
  const accountToken = process.env.SMSALA_ACCOUNT_TOKEN;
  if (!accountToken) {
    return { ok: false, errorReason: "SMSala isn't configured — set SMSALA_ACCOUNT_TOKEN." };
  }

  let response: Response;
  try {
    response = await fetch(`https://api2.smsala.com/CheckBalance?apiToken=${encodeURIComponent(accountToken)}`);
  } catch (error) {
    return {
      ok: false,
      errorReason: error instanceof Error ? error.message : "Network error contacting SMSala",
    };
  }

  let data: { IsSuccess?: boolean; ErrorDescription?: string; ReturnData?: { Company?: string; Balance?: number; CreditLimit?: number } | null };
  try {
    data = await response.json();
  } catch {
    return { ok: false, errorReason: `SMSala returned a non-JSON response (HTTP ${response.status})` };
  }

  if (!response.ok || !data.IsSuccess || !data.ReturnData) {
    return { ok: false, errorReason: data.ErrorDescription ?? `SMSala rejected the balance request (HTTP ${response.status})` };
  }

  return {
    ok: true,
    company: data.ReturnData.Company ?? "",
    balance: data.ReturnData.Balance ?? 0,
    creditLimit: data.ReturnData.CreditLimit ?? 0,
  };
}
