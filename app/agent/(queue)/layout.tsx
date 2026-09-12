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
    .select("role, display_name")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "agent") redirect("/agent/login?error=wrong_role");

  return <AgentShell agentName={profile.display_name}>{children}</AgentShell>;
}
