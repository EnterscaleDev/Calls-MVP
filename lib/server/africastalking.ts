import "server-only";

// Real Africa's Talking Voice API client — same boundary pattern as
// lib/adapters/sms.ts / lib/adapters/telephony.ts: all provider specifics
// live behind this one server-only module.
//
// Unlike the SendChamp scaffold (lib/server/sendchamp.ts), everything here
// is confirmed straight from their docs (developers.africastalking.com/docs/voice),
// including a real curl example and a real callback payload — not a guess.
// Endpoints/fields cited below are as published there as of this writing;
// re-check before relying on this if it's been a while.
//
// Flow this maps onto (masked calling, per lib/adapters/telephony.ts):
//   1. We call createOutboundCall({ to: agent's number }) — the participant's
//      number is NOT involved yet, so nothing sensitive is in this request.
//   2. Africa's Talking returns a `sessionId` for that call immediately.
//   3. Once the agent answers, AT POSTs to OUR callback URL (registered
//      once, statically, against our AT phone number in their dashboard —
//      not per-call) with that same `sessionId`.
//   4. Our callback handler looks up which participant this sessionId is
//      for (see registerPendingBridge/consumePendingBridge below) and
//      responds with XML `<Dial>` bridging to the participant's real
//      number, with recording turned on via the `record` attribute right
//      on that same element — no separate recording call needed.
//   5. AT relays the bridged call; on completion, AT POSTs a final webhook
//      (isActive=0) with duration/cost/recordingUrl.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}. Set it in .env.local (see .env.example).`);
  }
  return value;
}

const VOICE_BASE_URL = "https://voice.africastalking.com";

export interface CreateCallResult {
  sessionId?: string;
  status?: string;
  raw: unknown;
}

/**
 * Calls `to` (the AGENT's number) — confirmed against the real /call
 * endpoint contract. The participant's number never appears in this call.
 */
export async function createOutboundCall(to: string): Promise<CreateCallResult> {
  const apiKey = requireEnv("AFRICASTALKING_API_KEY");
  const username = requireEnv("AFRICASTALKING_USERNAME");
  const from = requireEnv("AFRICASTALKING_VIRTUAL_NUMBER");

  const body = new URLSearchParams({ username, to, from });

  const response = await fetch(`${VOICE_BASE_URL}/call`, {
    method: "POST",
    headers: {
      apiKey,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const parsed: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Africa's Talking call create failed (${response.status}): ${JSON.stringify(parsed)}`);
  }

  const record = parsed as { entries?: Array<{ status?: string; sessionId?: string }>; errorMessage?: string };
  const entry = record.entries?.[0];
  if (entry?.status && entry.status !== "Queued") {
    throw new Error(`Africa's Talking rejected the call: ${entry.status}`);
  }

  return { sessionId: entry?.sessionId, status: entry?.status, raw: parsed };
}

// --- Callback (webhook) payload shape, confirmed from their docs ----------

export interface VoiceCallbackPayload {
  isActive: "0" | "1";
  sessionId: string;
  direction: "inbound" | "outbound";
  callerNumber: string;
  destinationNumber: string;
  dtmfDigits?: string;
  recordingUrl?: string;
  durationInSeconds?: string;
  currencyCode?: string;
  amount?: string;
}

/** Parses the form-urlencoded POST body Africa's Talking sends to our callback URL. */
export function parseVoiceCallback(formData: URLSearchParams): VoiceCallbackPayload {
  return {
    isActive: (formData.get("isActive") as "0" | "1") ?? "0",
    sessionId: formData.get("sessionId") ?? "",
    direction: (formData.get("direction") as "inbound" | "outbound") ?? "outbound",
    callerNumber: formData.get("callerNumber") ?? "",
    destinationNumber: formData.get("destinationNumber") ?? "",
    dtmfDigits: formData.get("dtmfDigits") ?? undefined,
    recordingUrl: formData.get("recordingUrl") ?? undefined,
    durationInSeconds: formData.get("durationInSeconds") ?? undefined,
    currencyCode: formData.get("currencyCode") ?? undefined,
    amount: formData.get("amount") ?? undefined,
  };
}

// --- Call-control XML builders, confirmed from the <Dial> action docs -----

function escapeXmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function xmlResponse(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${inner}\n</Response>`;
}

/** Bridges the now-connected agent call to `phoneNumber`, recording the conversation. */
export function dialAndRecord(phoneNumber: string, opts?: { ringbackTone?: string; maxDuration?: number }): string {
  const attrs = [
    `phoneNumbers="${escapeXmlAttr(phoneNumber)}"`,
    `record="true"`,
    `sequential="true"`,
    opts?.ringbackTone ? `ringbackTone="${escapeXmlAttr(opts.ringbackTone)}"` : null,
    opts?.maxDuration ? `maxDuration="${opts.maxDuration}"` : null,
  ].filter(Boolean);
  return `  <Dial ${attrs.join(" ")} />`;
}

export function sayVerb(text: string): string {
  return `  <Say>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Say>`;
}
