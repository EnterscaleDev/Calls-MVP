import type { AdminData } from "@/lib/hooks/useAdminData";
import { getAgentProfileStats } from "@/lib/selectors";
import type { AgentProfile, AgentInvitation } from "@/lib/types";

export type RowStatus = "Active" | "Deactivated" | "Pending" | "Expired" | "Revoked";

export interface AgentRow {
  key: string;
  kind: "agent" | "invite";
  name: string;
  email: string;
  initials: string;
  status: RowStatus;
  campaignIds: string[];
  campaignNames: string[];
  target: number;
  today: number | null;
  last: string;
  completedThisWeek: number;
  agent?: AgentProfile;
  invitation?: AgentInvitation;
}

const STATUS_RANK: Record<RowStatus, number> = { Active: 0, Pending: 1, Expired: 2, Deactivated: 3, Revoked: 4 };

function initialsOf(name: string): string {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function latestInvitationFor(db: AdminData, agentId: string): AgentInvitation | undefined {
  return [...db.agentInvitations].filter((i) => i.agentProfileId === agentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** Mirrors the agent_profiles.status + latest user_invitations row
 *  combination this backend actually stores (see admin_invite_agent) — an
 *  agent row exists from the moment they're invited, unlike the
 *  prototype's mock data where AGENTS and AGENT_INVITES are two separate
 *  lists until acceptance. This derives the prototype's row "kind"/status
 *  vocabulary from that real shape instead. */
export function buildAgentRows(db: AdminData): AgentRow[] {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const rows: AgentRow[] = db.agents.map((agent) => {
    const invitation = latestInvitationFor(db, agent.id);
    let status: RowStatus;
    let kind: "agent" | "invite";
    if (agent.status === "active") {
      kind = "agent";
      status = "Active";
    } else if (agent.status === "inactive") {
      kind = "agent";
      status = "Deactivated";
    } else if (!invitation) {
      kind = "invite";
      status = "Pending";
    } else if (invitation.status === "accepted") {
      kind = "agent";
      status = "Active";
    } else {
      kind = "invite";
      status = invitation.status === "pending" ? "Pending" : invitation.status === "expired" ? "Expired" : "Revoked";
    }

    const activeAssignments = db.campaignAgents.filter((ca) => ca.agentId === agent.id && ca.active);
    const campaignIds = activeAssignments.map((ca) => ca.campaignId);
    const campaignNames = campaignIds.map((id) => db.campaigns.find((c) => c.id === id)?.name).filter((n): n is string => !!n);
    const target = activeAssignments.reduce((sum, ca) => sum + ca.dailyTarget, 0);
    const attemptsToday = db.callAttempts.filter((a) => a.agentId === agent.id && new Date(a.startedAt) >= startOfToday);
    const lastAttempt = [...db.callAttempts].filter((a) => a.agentId === agent.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    const stats = getAgentProfileStats(db, agent.id);

    return {
      key: agent.id,
      kind,
      name: agent.name,
      email: agent.email,
      initials: initialsOf(agent.name),
      status,
      campaignIds,
      campaignNames,
      target,
      today: kind === "agent" ? attemptsToday.length : null,
      last: kind === "invite" && invitation ? formatDate(invitation.createdAt) : lastAttempt ? formatDate(lastAttempt.startedAt) : "Never",
      completedThisWeek: stats.completedThisWeek,
      agent,
      invitation,
    };
  });

  return rows.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.name.localeCompare(b.name));
}
