import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Participant-surface client — anon key only, no session ever. The invite
 * token itself is the credential (validated server-side by the RPCs), so
 * there's nothing to persist and nothing to refresh.
 */
export function createParticipantClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
