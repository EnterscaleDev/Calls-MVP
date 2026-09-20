import type { Database } from "@/lib/supabase/database.types";

export type RowStatus = "Active" | "Deactivated" | "Pending" | "Expired" | "Revoked";

export interface AgentRow {
  agentId: string;
  kind: "agent" | "invite";
  status: RowStatus;
  name: string;
  email: string;
  initials: string;
  campaignNames: string[];
  target: number;
  today: number;
  completedThisWeek: number;
  last: string;
}

type AgentPageRpcRow = Database["public"]["Functions"]["admin_list_agents_page"]["Returns"][number];

function initialsOf(name: string): string {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Maps one row of admin_list_agents_page()'s server-paginated,
 *  server-aggregated result into the shape the Agents table and its
 *  modals use — replaces the old client-side buildAgentRows(), which
 *  required useAdminData()'s full org-wide fetch (every agent, every
 *  invitation, every campaign_agents row, every call_attempts row) just to
 *  render one page of a table. */
export function mapAgentPageRow(row: AgentPageRpcRow): AgentRow {
  return {
    agentId: row.agent_id,
    kind: row.kind === "invite" ? "invite" : "agent",
    status: row.row_status as RowStatus,
    name: row.name,
    email: row.email,
    initials: initialsOf(row.name),
    campaignNames: row.campaign_names ?? [],
    target: row.daily_target,
    today: row.calls_today,
    completedThisWeek: row.completed_this_week,
    last: row.last_active_at ? formatDate(row.last_active_at) : "Never",
  };
}
