import "server-only";

// Real SendChamp Voice API client — mirrors the boundary pattern of
// lib/adapters/sms.ts and lib/adapters/telephony.ts (all provider-specific
// logic lives behind this one module), but this one is genuinely
// server-only: it holds a live secret key and must never be imported from
// client code. The `server-only` import above makes that a build error,
// not just a convention.
//
// IMPORTANT — schema confidence: SendChamp's published API reference for
// POST /number/call/create shows an empty request/response schema (checked
// directly against their docs), so the field names below are a best-effort
// guess based on their general API conventions (their SMS endpoints use
// snake_case: `to`, `sender_id`, etc.) and the "Virtual Number + XML Bin
// URL" prerequisites stated in their guide — NOT a confirmed contract.
// Everything marked UNVERIFIED below needs a real test call (or their
// support / Postman collection) before this is trustworthy in production.
// Auth is confirmed from their Authentication page: `Authorization: Bearer
// <key>` (note their create-call page's prose separately says "Basic
// Auth", which conflicts — Bearer is what I'm going with since it's from
// the dedicated auth doc, but flag this discrepancy if a real call 401s).

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}. Set it in .env.local (see .env.example).`);
  }
  return value;
}

function baseUrl(): string {
  return process.env.SENDCHAMP_BASE_URL ?? "https://api.sendchamp.com/api/v1";
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${requireEnv("SENDCHAMP_API_KEY")}`,
    "Content-Type": "application/json",
  };
}

export interface CreateCallParams {
  /** Participant's real E.164 number. Server-side only — never log this or echo it in any response. */
  to: string;
  /** URL SendChamp fetches for call-control XML once the call is answered. */
  callControlUrl: string;
}

export interface CreateCallResult {
  /** Best-effort extraction — UNVERIFIED field path, response schema wasn't published. */
  providerCallId?: string;
  /** Full raw response, kept so the first real call's actual shape can be inspected/logged. */
  raw: unknown;
}

export async function createOutboundCall(params: CreateCallParams): Promise<CreateCallResult> {
  const from = requireEnv("SENDCHAMP_VIRTUAL_NUMBER");

  const response = await fetch(`${baseUrl()}/number/call/create`, {
    method: "POST",
    headers: authHeaders(),
    // UNVERIFIED request body — see module-level note above.
    body: JSON.stringify({
      to: params.to,
      from,
      xml_bin_url: params.callControlUrl,
    }),
  });

  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Deliberately stringify `body` only — never interpolate params.to here,
    // so a thrown/logged error can't leak the participant's number.
    throw new Error(`SendChamp call create failed (${response.status}): ${JSON.stringify(body)}`);
  }

  const record = body as Record<string, unknown>;
  const data = record.data as Record<string, unknown> | undefined;
  const providerCallId =
    (data?.call_id as string | undefined) ??
    (data?.id as string | undefined) ??
    (record.call_id as string | undefined);

  return { providerCallId, raw: body };
}

export async function getCall(providerCallId: string): Promise<unknown> {
  const response = await fetch(`${baseUrl()}/number/call/${encodeURIComponent(providerCallId)}`, {
    headers: authHeaders(),
  });
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`SendChamp get call failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

// --- XML bin (call-control) builders ---------------------------------------
// SendChamp reads these top-to-bottom and executes each instruction in
// order. Confirmed verbs from their docs: Play, Say, Dial (with a Number
// child), Record, Hangup.

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function xmlResponse(...verbs: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${verbs.join("\n")}\n</Response>`;
}

export function sayVerb(text: string): string {
  return `  <Say>${escapeXml(text)}</Say>`;
}

/**
 * Bridges the call to `number`. `record: true` is UNVERIFIED placement —
 * their docs mention Record as an available verb but not its exact
 * attributes/nesting; confirm whether recording is a sibling <Record/>
 * verb, a <Dial record="true"> attribute, or configured elsewhere (e.g.
 * per-Virtual-Number dashboard setting) before relying on this.
 */
export function dialVerb(number: string, opts?: { record?: boolean }): string {
  const record = opts?.record ? "\n    <Record/>" : "";
  return `  <Dial>${record}\n    <Number>${escapeXml(number)}</Number>\n  </Dial>`;
}

export function hangupVerb(): string {
  return "  <Hangup/>";
}
