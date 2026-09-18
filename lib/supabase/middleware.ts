import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

const ADMIN_PREFIX = "/admin";
const AGENT_PREFIX = "/agent";
const ADMIN_LOGIN = "/admin/login";
const AGENT_LOGIN = "/agent/login";

/**
 * Refreshes the Supabase session on every request (required so Server
 * Components downstream see a valid session — see lib/supabase/server.ts's
 * comment on why it can't write cookies itself), then gates /admin/** and
 * /agent/** by session + role. Role isn't in the JWT, so this costs one
 * `profiles` PK lookup per protected request — cheap at this app's scale.
 * For agent routes this also joins agent_profiles.status: deactivating an
 * Agent must actually block them at the next request, not just hide the
 * nav — a still-valid session alone can't be trusted here.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith(ADMIN_PREFIX) && pathname !== ADMIN_LOGIN;
  const isAgentRoute = pathname.startsWith(AGENT_PREFIX) && pathname !== AGENT_LOGIN;

  if (!isAdminRoute && !isAgentRoute) {
    return supabaseResponse;
  }

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = isAdminRoute ? ADMIN_LOGIN : AGENT_LOGIN;
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, agent_profiles(status)")
    .eq("id", user.id)
    .single();

  const wrongRole =
    (isAdminRoute && profile?.role !== "admin") || (isAgentRoute && profile?.role !== "agent");
  const agentDeactivated = isAgentRoute && profile?.role === "agent" && profile.agent_profiles?.status !== "active";

  if (!profile || wrongRole || agentDeactivated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = isAdminRoute ? ADMIN_LOGIN : AGENT_LOGIN;
    loginUrl.searchParams.set("error", agentDeactivated ? "deactivated" : "wrong_role");
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
