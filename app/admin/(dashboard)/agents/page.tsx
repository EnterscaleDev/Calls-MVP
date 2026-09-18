"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAdminData } from "@/lib/hooks/useAdminData";
import { listAgentsWithStats } from "@/lib/selectors";
import { LoadingScreen, ErrorState, EmptyState, InlineBanner } from "@/components/ui/States";
import { Card, CardBody, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { AgentProfileModal } from "./AgentProfileModal";
import type { AgentProfile, AgentStatus } from "@/lib/types";

const STATUS_DOT: Record<AgentStatus, string> = {
  active: "bg-info",
  invited: "bg-warning",
  inactive: "bg-foreground-subtle",
};

function StatusPill({ status }: { status: AgentStatus }) {
  const tone = status === "active" ? "info" : status === "invited" ? "warning" : "neutral";
  return (
    <Badge tone={tone}>
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {status}
    </Badge>
  );
}

export default function AgentsPage() {
  const { data: db, loading, error, refetch } = useAdminData();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [dailyTarget, setDailyTarget] = useState("8");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileAgent, setProfileAgent] = useState<AgentProfile | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AgentStatus>("all");

  const agentStats = db ? listAgentsWithStats(db) : [];
  const activeCount = agentStats.filter((a) => a.agent.status === "active").length;
  const invitedCount = agentStats.filter((a) => a.agent.status === "invited").length;
  const inactiveCount = agentStats.filter((a) => a.agent.status === "inactive").length;

  const filtered = agentStats.filter(({ agent }) => {
    const matchesSearch =
      !search.trim() ||
      agent.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      agent.email.toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus = statusFilter === "all" || agent.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading || !db) return <LoadingScreen label="Loading people..." />;
  if (error) return <ErrorState title="Couldn't load people" description={error} />;

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setFormError("Name and email are required.");
      return;
    }
    setFormError("");
    setSaving(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_invite_agent", {
      p_name: name.trim(),
      p_email: email.trim(),
      p_phone: phone.trim() || undefined,
      p_campaign_id: campaignId || undefined,
      p_daily_target: Number(dailyTarget) || undefined,
    });
    setSaving(false);
    if (rpcError) {
      setFormError(rpcError.message);
      return;
    }
    setInviteOpen(false);
    setName("");
    setEmail("");
    setPhone("");
    setCampaignId("");
    setDailyTarget("8");
    await refetch();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-caps text-foreground-subtle">Agency team</p>
          <h1 className="text-xl font-semibold text-foreground">People</h1>
        </div>
        <Button onClick={() => setInviteOpen(true)}>Invite someone</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active people"
          value={activeCount}
          hint={invitedCount > 0 ? `${invitedCount} invitation${invitedCount === 1 ? "" : "s"} outstanding` : "Everyone invited has signed in"}
        />
        <StatCard label="Call agents" value={agentStats.length} hint="Everyone here can run interviews" />
        <StatCard label="Invited" value={invitedCount} hint="Awaiting first sign-in" />
        <StatCard label="Inactive" value={inactiveCount} hint="Access revoked" />
      </div>

      {agentStats.length === 0 ? (
        <EmptyState
          title="No people yet"
          description="Invite your first agent to start assigning interviews."
          action={<Button onClick={() => setInviteOpen(true)}>Invite someone</Button>}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search people"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | AgentStatus)}
              className="w-40"
            >
              <option value="all">Any status</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>

          <Card>
            <CardBody className="p-0">
              {filtered.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No matches" description="Try a different search or status filter." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-subtle">
                        <th className="px-5 py-3 font-medium">Person</th>
                        <th className="px-5 py-3 font-medium">Role</th>
                        <th className="px-5 py-3 font-medium">Campaigns</th>
                        <th className="px-5 py-3 font-medium">Sessions</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(({ agent, campaignNames, completedAllTime }) => {
                        const shown = campaignNames.slice(0, 2);
                        const extra = campaignNames.length - shown.length;
                        return (
                          <tr
                            key={agent.id}
                            onClick={() => setProfileAgent(agent)}
                            className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-muted"
                          >
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2.5">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                                  {agent.name
                                    .split(" ")
                                    .map((p) => p[0])
                                    .slice(0, 2)
                                    .join("")
                                    .toUpperCase()}
                                </span>
                                <div>
                                  <p className="font-medium text-foreground">{agent.name}</p>
                                  <p className="text-xs text-foreground-muted">{agent.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <Badge tone="info">Call agent</Badge>
                            </td>
                            <td className="px-5 py-3 text-foreground-muted">
                              {campaignNames.length === 0
                                ? "—"
                                : `${shown.join(", ")}${extra > 0 ? ` +${extra} more` : ""}`}
                            </td>
                            <td className="px-5 py-3 tabular-nums text-foreground-muted">
                              {completedAllTime > 0 ? completedAllTime : "—"}
                            </td>
                            <td className="px-5 py-3">
                              <StatusPill status={agent.status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite someone">
        <form onSubmit={handleInviteSubmit} className="flex flex-col gap-4">
          {formError ? <InlineBanner kind="danger">{formError}</InlineBanner> : null}
          <Field label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Phone" hint="Needed before this agent can start a real call — can add it later.">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2348012345678" />
          </Field>
          <Field label="Assigned campaign" hint="Optional — leave blank to invite them org-wide.">
            <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">No campaign yet</option>
              {db.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Daily target">
            <Input type="number" min={0} value={dailyTarget} onChange={(e) => setDailyTarget(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Inviting..." : "Invite"}
            </Button>
          </div>
        </form>
      </Modal>

      <AgentProfileModal agent={profileAgent} db={db} refetch={refetch} onClose={() => setProfileAgent(null)} />
    </div>
  );
}
