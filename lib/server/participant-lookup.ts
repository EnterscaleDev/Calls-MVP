import "server-only";

/**
 * Resolves a call assignment to the participant's real phone number,
 * server-side only — this is the one function a real telephony integration
 * needs that the browser must never see the result of.
 *
 * STUB: there's no server-side database yet. Every bit of participant/
 * contact/booking data currently lives only in the browser's mock store
 * (localStorage, see lib/store.tsx) — a Next.js route handler has no way
 * to reach it. This function can't do anything useful until real
 * persistent storage exists (the deferred Supabase phase).
 *
 * This is deliberately the *only* function real call-initiation code
 * depends on for participant data, matching the adapter-boundary pattern
 * already used for lib/adapters/sms.ts and lib/adapters/telephony.ts —
 * swap this one function for a real query once that phase lands, and
 * nothing else in the SendChamp integration needs to change.
 */
export async function resolveParticipantPhone(assignmentId: string): Promise<string> {
  throw new Error(
    `resolveParticipantPhone(${assignmentId}) is not implemented: this app has no server-side ` +
      "database yet. All participant data lives client-side only. Wire this to a real query " +
      "(e.g. Supabase) before this integration can actually place a call."
  );
}
