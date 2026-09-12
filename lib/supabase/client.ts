import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/** Admin/Agent browser client — session-backed, cookie-persisted. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
