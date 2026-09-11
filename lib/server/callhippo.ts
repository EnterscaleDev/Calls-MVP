import "server-only";

// Real CallHippo Voice API client — same boundary pattern as
// lib/adapters/sms.ts / lib/adapters/telephony.ts: all provider specifics
// live behind this one server-only module.
//
// Confirmed straight from CallHippo's own docs, not guessed:
//   - POST /call request shape: web.callhippo.com/api-docs/
//   - Webhook payload shape: help.callhippo.com/custom-webhook/
// Re-check both before relying on this if it's been a while — CallHippo's
// API docs page is a bare Swagger UI with no published response schemas,
// so anything not explicitly called out as confirmed below is a guess.
//
// Flow this maps onto (masked calling, per lib/adapters/telephony.ts):
//   1. We call createOutboundCall({ agentId, participantPhone, crmUniqueId })
//      — CallHippo bridges its `agentId` user directly to `participantPhone`
//      in one request. Unlike Africa's Talking, there's no separate
//      "call the agent, then bridge on answer" step — CallHippo appears to
//      do both legs itself. The participant's number is passed straight in
//      this one server-side request and never touches a URL.
//   2. `crmUniqueId` is OUR OWN id (we use the CallAssignment id) passed
//      through so we get it back on the completion webhook — see the
//      CORRELATION CAVEAT below before relying on this.
//   3. When the call ends, CallHippo POSTs to a webhook URL configured
//      once, statically, in the CallHippo dashboard (Integrations > REST
//      API > Webhook > Calling Activity) — not per-call, same pattern as
//      Africa's Talking's callback URL. The payload includes `recordingUrl`
//      directly, so there's no separate recording-fetch step needed.
//
// CORRELATION CAVEAT (unconfirmed): the Swagger example body for POST /call
// only shows { toNumber, fromNumber, agentId } — it does NOT show a
// crmUniqueId field. crmUniqueId only appears confirmed in two other
// places: as a filter param on POST /activityfeed, and inside
// extraParams on the webhook payload. That's strong circumstantial
// evidence it's a real, settable field on call creation (why else would
// CallHippo let you filter call logs by it?), but until it's verified
// live (a support ticket, or a real test call) don't assume it works —
// have a fallback plan (e.g. an ephemeral token store like
// lib/server/call-control-store.ts, keyed by callSid instead of our own
// id) ready in case it doesn't round-trip.
//
// SECURITY GAP (same as Africa's Talking): no webhook signature/HMAC
// scheme is documented anywhere for CallHippo's webhooks. Don't assume an
// inbound POST to the webhook route is authentic — treat the endpoint's
// URL itself as the only real secret (long, unguessable, unpublished)
// until CallHippo documents something stronger.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}. Set it in .env.local (see .env.example).`);
  }
  return value;
}

const BASE_URL = "https://web.callhippo.com/v1";

export interface CreateCallParams {
  /** CallHippo's own user id for the agent taking this call — not our AgentProfile.id. */
  agentId: string;
  /** The participant's real phone number, resolved server-side only. */
  participantPhone: string;
  /** Our own correlation id (CallAssignment.id) — see CORRELATION CAVEAT above. */
  crmUniqueId: string;
}

export interface CreateCallResult {
  raw: unknown;
}

/**
 * Bridges `agentId` (a CallHippo user) to `participantPhone` in one call.
 * Confirmed request shape; response shape is NOT documented anywhere —
 * `raw` is returned as-is so callers can log/inspect it rather than trust
 * a guessed shape.
 */
export async function createOutboundCall(params: CreateCallParams): Promise<CreateCallResult> {
  const apiToken = requireEnv("CALLHIPPO_API_TOKEN");
  const fromNumber = requireEnv("CALLHIPPO_VIRTUAL_NUMBER");

  const response = await fetch(`${BASE_URL}/call`, {
    method: "POST",
    headers: {
      apiToken,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      toNumber: params.participantPhone,
      fromNumber,
      agentId: params.agentId,
      // Unconfirmed field — see CORRELATION CAVEAT above.
      crmUniqueId: params.crmUniqueId,
    }),
  });

  const parsed: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`CallHippo call create failed (${response.status}): ${JSON.stringify(parsed)}`);
  }

  return { raw: parsed };
}

// --- Webhook (Calling Activity) payload shape, confirmed from
// help.callhippo.com/custom-webhook/ -------------------------------------

export interface CallActivityWebhookPayload {
  type: "call";
  from: string;
  to: string;
  callType: "Incoming" | "Outgoing";
  duration: string;
  durationSeconds: number;
  status:
    | "Completed"
    | "Missed"
    | "Rejected"
    | "Voicemail"
    | "Welcome message"
    | "IVR message"
    | "Unavailable"
    | "Cancelled"
    | "No Answer";
  reason?: string;
  time: string;
  startTime: string;
  endTime: string;
  callCharge?: string;
  email?: string;
  adminEmail?: string;
  callSid: string;
  countryName?: string;
  answeredDevice?: "web" | "ios" | "android";
  billedMinutes?: number;
  hangupBy?: "Agent" | "Client";
  tags?: string[];
  dispositions?: string[];
  callQueue?: boolean;
  dialCode?: string;
  /** Present when call recording is enabled on the CallHippo account/number. */
  recordingUrl?: string;
  extraParams?: {
    virtualNumber?: string;
    campaignId?: string;
    agentId?: string;
    /** Our CallAssignment id, IF the unconfirmed request-side field round-trips. */
    crmUniqueId?: string;
  };
}

/** Type guard + light validation for the webhook route handler — not a signature check (see SECURITY GAP above). */
export function parseCallActivityWebhook(body: unknown): CallActivityWebhookPayload | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (record.type !== "call" || typeof record.callSid !== "string") return null;
  return record as unknown as CallActivityWebhookPayload;
}
