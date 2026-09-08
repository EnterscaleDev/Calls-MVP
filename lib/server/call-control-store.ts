import "server-only";
import { randomBytes } from "crypto";

/**
 * Maps an opaque token to the participant number for one in-flight call, so
 * the call-control URL we hand SendChamp never carries the phone number
 * itself in a query string (personal data belongs in a body/lookup, never
 * a URL — it ends up in logs, proxies, browser history equivalents on
 * their side, etc).
 *
 * In-memory only: fine for local dev against a single running process, but
 * a real deployment on serverless (multiple instances, cold starts) needs
 * this backed by a real store (Redis, or a DB table with a short TTL) —
 * another seam waiting on real infrastructure, same as participant-lookup.
 */
const pendingCalls = new Map<string, { to: string; createdAt: number }>();

const TOKEN_TTL_MS = 10 * 60 * 1000; // calls should connect well within 10 minutes

export function createCallControlToken(to: string): string {
  const token = randomBytes(16).toString("hex");
  pendingCalls.set(token, { to, createdAt: Date.now() });
  return token;
}

export function consumeCallControlToken(token: string): string | undefined {
  const entry = pendingCalls.get(token);
  if (!entry) return undefined;
  if (Date.now() - entry.createdAt > TOKEN_TTL_MS) {
    pendingCalls.delete(token);
    return undefined;
  }
  return entry.to;
}
