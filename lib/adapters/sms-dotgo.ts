import "server-only";

/**
 * Real Dotgo Konnect SMS integration (https://konnect.dotgo.com/Developer,
 * Messaging API > Outbound SMS). Server-only — DOTGO_API_TOKEN must never
 * reach the browser. Endpoint, auth header shape, and request/response
 * bodies below are taken directly from Dotgo's own "How To Use > CURL"
 * sample and API Reference parameter tables, not guessed.
 *
 * Two things their public docs leave genuinely open, called out where they
 * matter below:
 *  1. The synchronous POST response is only ever {"status":"ok"} or
 *     {"status":"error",...} — no message id. The real provider message id
 *     (`ref_id`) only appears later, via the async callback_url webhook.
 *     That callback's own parameter table doesn't list an `id` field, but a
 *     *different* Dotgo callback (URL-click tracking) does echo back the
 *     caller's own request `id` in its sample payload — so we pass our own
 *     campaign_invitations row id as the request `id` on the chance it's
 *     echoed here too, with a phone-number fallback in the webhook handler
 *     if it isn't. See app/api/sms/dotgo-callback/route.ts.
 *  2. Every example in their docs writes phone numbers as digits only, no
 *     leading "+" (e.g. "919886038842") — inferred, not stated outright, so
 *     we strip it before sending. Worth confirming against a real send.
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
