import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Service-role client — bypasses RLS entirely. Reserved for trusted
 * server-side code that has no user session to scope a query to (e.g.
 * resolving a participant's raw phone number for telephony, where there's
 * no admin/agent/participant JWT to act as; contacts has zero RLS grant for
 * any client role by design). Never import this outside `lib/server/**`,
 * and never let its results reach the browser.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — the service-role client " +
        "can't be created without them."
    );
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
