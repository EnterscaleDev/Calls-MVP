import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AgentShell } from "./AgentShell";

export default async function AgentShellLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/agent/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, agent_profiles(status)")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "agent") redirect("/agent/login?error=wrong_role");
  // Middleware already blocks a deactivated Agent from reaching this route on
  // the next request, but this is the same check at the layout level too —
  // belt and braces, since this is the actual data-access boundary.
  if (profile.agent_profiles?.status !== "active") redirect("/agent/login?error=deactivated");

  return <AgentShell agentName={profile.display_name}>{children}</AgentShell>;
}
