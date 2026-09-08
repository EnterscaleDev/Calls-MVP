import "server-only";
import { randomBytes } from "crypto";

/**
 * Ephemeral, in-memory key→phone-number stores for bridging an in-flight
 * call to a provider, so the participant's number never has to travel
 * through a URL query string (personal data belongs in a body/lookup,
 * never a URL — it ends up in logs, proxies, etc on the provider's side).
 *
 * In-memory only: fine for local dev against a single running process, but
 * a real deployment on serverless (multiple instances, cold starts) needs
 * this backed by a real store (Redis, or a DB table with a short TTL) —
 * another seam waiting on real infrastructure, same as participant-lookup.
 */

const TTL_MS = 10 * 60 * 1000; // calls should connect well within 10 minutes

function makeEphemeralStore() {
  const entries = new Map<string, { to: string; createdAt: number }>();
  return {
    set(key: string, to: string) {
      entries.set(key, { to, createdAt: Date.now() });
    },
    consume(key: string): string | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (Date.now() - entry.createdAt > TTL_MS) {
        entries.delete(key);
        return undefined;
      }
      return entry.to;
    },
  };
}

// --- SendChamp: we mint an opaque token and put it in the call-control URL ---
const sendchampStore = makeEphemeralStore();

export function createCallControlToken(to: string): string {
  const token = randomBytes(16).toString("hex");
  sendchampStore.set(token, to);
  return token;
}

export function consumeCallControlToken(token: string): string | undefined {
  return sendchampStore.consume(token);
}

// --- Africa's Talking: keyed by the sessionId *they* issue when we call
// the agent leg — nothing of ours needs to go in a URL at all. ---
const africasTalkingStore = makeEphemeralStore();

export function registerPendingBridge(sessionId: string, participantPhone: string): void {
  africasTalkingStore.set(sessionId, participantPhone);
}

export function consumePendingBridge(sessionId: string): string | undefined {
  return africasTalkingStore.consume(sessionId);
}
