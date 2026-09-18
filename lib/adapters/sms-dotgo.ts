import "server-only";

/**
 * Real Dotgo Konnect SMS integration (https://konnect.dotgo.com/Developer,
 * Messaging API > Outbound SMS). Server-only — DOTGO_API_TOKEN must never
 * reach the browser. Endpoint, auth header shape, and request/response
 * bodies below are taken directly from Dotgo's own "How To Use > CURL"
 * sample and API Reference parameter tables, not guessed.
 *
 * Confirmed against real sends/deliveries, not just docs:
 *  1. The synchronous POST response is only ever {"status":"ok"} or
 *     {"status":"error",...} — no message id. The real provider message id
 *     (`ref_id`) only appears later, via the async callback_url webhook —
 *     see app/api/sms/dotgo-callback/route.ts, which correlates back to our
 *     own campaign_invitations row.
 *  2. Phone numbers are digits only, no leading "+", confirmed against a
 *     real delivered send — stripped before sending accordingly.
 *  3. Dotgo's advertised click-tracking (a `track_url` param, meant to
 *     auto-wrap links and fire a click callback) never actually fired on a
 *     real send+click. Click tracking is self-hosted instead — see
 *     app/r/[invitationId]/route.ts.
 */

const DOTGO_BASE_URL = process.env.DOTGO_BASE_URL || "https://konnect.dotgo.com/api/v1";

export interface SendDotgoSmsInput {
  /** E.164, e.g. "+14155550105" — converted to Dotgo's digits-only form internally. */
  to: string;
  body: string;
  /** Our own correlation id (a campaign_invitations row id) — see file header. */
  requestId: string;
  senderMask?: string;
  callbackUrl?: string;
}

export type SendDotgoSmsResult =
  | { ok: true }
  | { ok: false; errorCode?: string; errorReason: string };

function toDotgoPhone(e164: string): string {
  return e164.replace(/[^0-9]/g, "");
}

export async function sendDotgoSms(input: SendDotgoSmsInput): Promise<SendDotgoSmsResult> {
  const accountId = process.env.DOTGO_ACCOUNT_ID;
  const apiToken = process.env.DOTGO_API_TOKEN;
  if (!accountId || !apiToken) {
    return {
      ok: false,
      errorReason: "Dotgo isn't configured — set DOTGO_ACCOUNT_ID and DOTGO_API_TOKEN.",
    };
  }

  const payload: Record<string, unknown> = {
    id: input.requestId,
    to: [toDotgoPhone(input.to)],
    body: input.body,
  };
  if (input.senderMask) payload.sender_mask = input.senderMask;
  if (input.callbackUrl) payload.callback_url = input.callbackUrl;

  let response: Response;
  try {
    response = await fetch(`${DOTGO_BASE_URL}/Accounts/${accountId}/Messages`, {
      method: "POST",
      headers: {
        // Confirmed from Dotgo's curl sample: the raw token, not "Bearer <token>".
        Authorization: apiToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      ok: false,
      errorReason: error instanceof Error ? error.message : "Network error contacting Dotgo",
    };
  }

  let data: { status?: string; error_code?: string; error_reason?: string };
  try {
    data = await response.json();
  } catch {
    return { ok: false, errorReason: `Dotgo returned a non-JSON response (HTTP ${response.status})` };
  }

  if (!response.ok || data.status !== "ok") {
    return {
      ok: false,
      errorCode: data.error_code,
      errorReason: data.error_reason ?? `Dotgo rejected the request (HTTP ${response.status})`,
    };
  }

  return { ok: true };
}

/** Dotgo's callback status vocabulary (rejected/sent/failed/delivered/undelivered)
 *  collapsed onto this app's own three-state invitation_status_enum. */
export function mapDotgoCallbackStatus(status: string | undefined): "sent" | "delivered" | "failed" {
  if (status === "delivered") return "delivered";
  if (status === "sent") return "sent";
  return "failed";
}

export type DotgoBalanceResult =
  | { ok: true; mode: string; currency: string; amount: number; accountName: string }
  | { ok: false; errorReason: string };

/**
 * Real Dotgo account balance (GET .../Balance, confirmed against the real
 * account — returns e.g. {"account_balance":"NGN5,896.50"}). This is the
 * *actual* Dotgo balance in real currency — a different thing entirely from
 * this app's own internal org_credits.sms ledger (an abstract count, not
 * money), so callers should show it alongside that number, never merge the
 * two.
 */
export async function getDotgoBalance(): Promise<DotgoBalanceResult> {
  const accountId = process.env.DOTGO_ACCOUNT_ID;
  const apiToken = process.env.DOTGO_API_TOKEN;
  if (!accountId || !apiToken) {
    return { ok: false, errorReason: "Dotgo isn't configured — set DOTGO_ACCOUNT_ID and DOTGO_API_TOKEN." };
  }

  let response: Response;
  try {
    response = await fetch(`${DOTGO_BASE_URL}/Accounts/${accountId}/Balance`, {
      headers: { Authorization: apiToken },
    });
  } catch (error) {
    return { ok: false, errorReason: error instanceof Error ? error.message : "Network error contacting Dotgo" };
  }

  let data: { mode?: string; account_balance?: string; name?: string; status?: string };
  try {
    data = await response.json();
  } catch {
    return { ok: false, errorReason: `Dotgo returned a non-JSON response (HTTP ${response.status})` };
  }

  if (!response.ok || data.status !== "ok" || !data.account_balance) {
    return { ok: false, errorReason: `Dotgo rejected the balance request (HTTP ${response.status})` };
  }

  // account_balance is a formatted string like "NGN5,896.50" — split the
  // leading currency letters from the numeric amount.
  const match = data.account_balance.match(/^([A-Za-z]*)\s*([\d,]+(?:\.\d+)?)$/);
  const currency = match?.[1] || "";
  const amount = match ? Number(match[2].replace(/,/g, "")) : NaN;
  if (!match || Number.isNaN(amount)) {
    return { ok: false, errorReason: `Couldn't parse Dotgo's balance format: "${data.account_balance}"` };
  }

  return { ok: true, mode: data.mode ?? "", currency, amount, accountName: data.name ?? "" };
}
