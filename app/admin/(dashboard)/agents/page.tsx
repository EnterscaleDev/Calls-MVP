"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAdminData } from "@/lib/hooks/useAdminData";
import { listAgentsWithStats } from "@/lib/selectors";
import { LoadingScreen, ErrorState, EmptyState, InlineBanner } from "@/components/ui/States";
import { Card, CardBody, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Checkbox } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { OverflowMenu, type MenuAction } from "@/components/ui/Menu";
import { AgentProfileModal } from "./AgentProfileModal";
import { DeactivateAgentModal } from "./_components/DeactivateAgentModal";
import { RemoveFromCampaignModal } from "./_components/RemoveFromCampaignModal";
import { DeleteAgentModal } from "./_components/DeleteAgentModal";
import type { AgentProfile, AgentInvitation } from "@/lib/types";

type DisplayStatus = "active" | "inactive" | "pending" | "expired" | "revoked";

const STATUS_LABEL: Record<DisplayStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  pending: "Pending invite",
  expired: "Invite expired",
  revoked: "Invite revoked",
};

const STATUS_TONE: Record<DisplayStatus, "info" | "warning" | "danger" | "neutral"> = {
  active: "info",
  inactive: "neutral",
  pending: "warning",
  expired: "danger",
  revoked: "danger",
};

function StatusPill({ status }: { status: DisplayStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

function formatExpiry(iso: string): string {
  const d = new Date(iso);
  const days = Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Expired";
  if (days === 1) return "Expires in 1 day";
  if (days <= 6) return `Expires in ${days} days`;
  return `Expires ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

interface Toast {
  message: string;
}

const INITIAL_FORM = { name: "", email: "", phone: "", campaignIds: [] as string[], dailyTarget: "8" };

export default function AgentsPage() {
  const { data: db, loading, error, refetch } = useAdminData();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteStep, setInviteStep] = useState<"form" | "summary">("form");
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileAgent, setProfileAgent] = useState<AgentProfile | null>(null);
  const [viewInvitation, setViewInvitation] = useState<AgentInvitation | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AgentProfile | null>(null);
  const [removeFromCampaignTarget, setRemoveFromCampaignTarget] = useState<AgentProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgentProfile | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DisplayStatus>("all");
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const agentStats = db ? listAgentsWithStats(db) : [];

  function latestInvitationFor(agentId: string): AgentInvitation | undefined {
    if (!db) return undefined;
    return [...db.agentInvitations]
      .filter((i) => i.agentProfileId === agentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }

  function displayStatusFor(agent: AgentProfile): DisplayStatus {
    if (agent.status === "active") return "active";
    if (agent.status === "inactive") return "inactive";
    const invitation = latestInvitationFor(agent.id);
    if (!invitation) return "pending";
    if (invitation.status === "accepted") return "active";
    return invitation.status;
  }

  const rows = agentStats.map((stats) => ({ ...stats, displayStatus: displayStatusFor(stats.agent) }));
  const activeCount = rows.filter((r) => r.displayStatus === "active").length;
  const pendingCount = rows.filter((r) => r.displayStatus === "pending").length;
  const inactiveCount = rows.filter((r) => r.displayStatus === "inactive").length;

  const filtered = rows.filter(({ agent, displayStatus }) => {
    const matchesSearch =
      !search.trim() ||
      agent.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      agent.email.toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus = statusFilter === "all" || displayStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading || !db) return <LoadingScreen label="Loading agents..." />;
  if (error) return <ErrorState title="Couldn't load agents" description={error} />;

  function showToast(message: string) {
    setToast({ message });
    window.setTimeout(() => setToast((cur) => (cur?.message === message ? null : cur)), 5000);
  }

  function openInvite(prefill?: Partial<typeof INITIAL_FORM>) {
    setForm({ ...INITIAL_FORM, ...prefill });
    setFormError("");
    setInviteStep("form");
    setInviteOpen(true);
  }

  function toggleCampaign(id: string) {
    setForm((prev) => ({
      ...prev,
      campaignIds: prev.campaignIds.includes(id)
        ? prev.campaignIds.filter((c) => c !== id)
        : [...prev.campaignIds, id],
    }));
  }

  function handleReviewInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setFormError("Name and email are required.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
      setFormError("Enter a valid email address.");
      return;
    }
    setFormError("");
    setInviteStep("summary");
  }

  async function handleSendInvite() {
    setSaving(true);
    setFormError("");
    const response = await fetch("/api/agents/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        campaignIds: form.campaignIds,
        dailyTarget: Number(form.dailyTarget) || 8,
      }),
    });
    const result = (await response.json().catch(() => ({ ok: false, errorReason: "Unexpected response." }))) as
      | { ok: true }
      | { ok: false; errorReason: string };
    setSaving(false);
    if (!result.ok) {
      setFormError(result.errorReason);
      setInviteStep("form");
      return;
    }
    setInviteOpen(false);
    await refetch();
    showToast(`Invitation sent to ${form.email.trim()}`);
  }

  async function handleResend(invitation: AgentInvitation) {
    setPendingRowId(invitation.agentProfileId);
    setActionError(null);
    const response = await fetch("/api/agents/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId: invitation.id }),
    });
    const result = (await response.json().catch(() => ({ ok: false, errorReason: "Unexpected response." }))) as
      | { ok: true }
      | { ok: false; errorReason: string };
    setPendingRowId(null);
    if (!result.ok) {
      setActionError(result.errorReason);
      return;
    }
    await refetch();
    showToast("Invitation resent");
  }

  async function handleRevoke(invitation: AgentInvitation) {
    setPendingRowId(invitation.agentProfileId);
    setActionError(null);
    const response = await fetch("/api/agents/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId: invitation.id }),
    });
    const result = (await response.json().catch(() => ({ ok: false, errorReason: "Unexpected response." }))) as
      | { ok: true }
      | { ok: false; errorReason: string };
    setPendingRowId(null);
    if (!result.ok) {
      setActionError(result.errorReason);
      return;
    }
    await refetch();
    showToast("Invitation revoked");
  }

  async function handleReactivate(agent: AgentProfile) {
    setPendingRowId(agent.id);
    setActionError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_reactivate_agent", { p_agent_id: agent.id });
    setPendingRowId(null);
    if (rpcError) {
      setActionError(rpcError.message);
      return;
    }
    await refetch();
    showToast(`${agent.name} reactivated`);
  }

  async function handleDeleteInvitation(invitation: AgentInvitation) {
    setPendingRowId(invitation.agentProfileId);
    setActionError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_delete_invitation", { p_invitation_id: invitation.id });
    setPendingRowId(null);
    if (rpcError) {
      setActionError(rpcError.message);
      return;
    }
    await refetch();
    showToast("Invitation deleted");
  }

  function actionsForRow(agent: AgentProfile, displayStatus: DisplayStatus): MenuAction[] {
    const busy = pendingRowId === agent.id;
    const invitation = latestInvitationFor(agent.id);

    if (displayStatus === "pending") {
      const actions: MenuAction[] = [];
      if (invitation) {
        actions.push({ key: "view", label: "View invite", onSelect: () => setViewInvitation(invitation) });
        actions.push({
          key: "resend",
          label: "Resend invitation",
          disabled: busy,
          onSelect: () => handleResend(invitation),
        });
        actions.push({
          key: "revoke",
          label: "Revoke invitation",
          variant: "danger",
          dividerBefore: true,
          disabled: busy,
          onSelect: () => handleRevoke(invitation),
        });
      }
      return actions;
    }

    if (displayStatus === "expired" || displayStatus === "revoked") {
      const actions: MenuAction[] = [];
      if (invitation) actions.push({ key: "view", label: "View invite", onSelect: () => setViewInvitation(invitation) });
      actions.push({
        key: "reinvite",
        label: "Send new invitation",
        disabled: busy,
        onSelect: () =>
          openInvite({
            name: agent.name,
            email: agent.email,
            phone: agent.phone,
            campaignIds: db!.campaignAgents.filter((ca) => ca.agentId === agent.id && ca.active).map((ca) => ca.campaignId),
          }),
      });
      if (invitation) {
        actions.push({
          key: "delete-invitation",
          label: "Delete invitation",
          variant: "danger",
          dividerBefore: true,
          disabled: busy,
          onSelect: () => handleDeleteInvitation(invitation),
        });
      }
      actions.push({
        key: "delete-agent",
        label: "Delete Agent",
        variant: "danger",
        disabled: busy,
        onSelect: () => setDeleteTarget(agent),
      });
      return actions;
    }

    if (displayStatus === "active") {
      const hasCampaigns = db!.campaignAgents.some((ca) => ca.agentId === agent.id && ca.active);
      const actions: MenuAction[] = [
        { key: "view", label: "View Agent", onSelect: () => setProfileAgent(agent) },
        { key: "manage", label: "Manage access", onSelect: () => setProfileAgent(agent) },
      ];
      if (hasCampaigns) {
        actions.push({
          key: "remove-from-campaign",
          label: "Remove from campaign",
          dividerBefore: true,
          disabled: busy,
          onSelect: () => setRemoveFromCampaignTarget(agent),
        });
      }
      actions.push({
        key: "deactivate",
        label: "Deactivate Agent",
        variant: "danger",
        dividerBefore: !hasCampaigns,
        disabled: busy,
        onSelect: () => setDeactivateTarget(agent),
      });
      return actions;
    }

    // inactive
    return [
      { key: "view", label: "View Agent", onSelect: () => setProfileAgent(agent) },
      { key: "reactivate", label: "Reactivate Agent", disabled: busy, onSelect: () => handleReactivate(agent) },
      {
        key: "delete-agent",
        label: "Delete Agent",
        variant: "danger",
        dividerBefore: true,
        disabled: busy,
        onSelect: () => setDeleteTarget(agent),
      },
    ];
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-page-title">Agents</h1>
          <p className="mt-1 text-page-subtitle">
            Invite and manage interviewers who conduct calls for your campaigns.
          </p>
        </div>
        <Button onClick={() => openInvite()}>Invite Agent</Button>
      </div>

      {actionError ? (
        <InlineBanner kind="danger">
          <div className="flex items-start justify-between gap-3">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="shrink-0 text-xs font-semibold text-danger hover:underline"
            >
              Dismiss
            </button>
          </div>
        </InlineBanner>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Active Agents" value={activeCount} />
        <StatCard label="Pending Invites" value={pendingCount} tone={pendingCount > 0 ? "warning" : "default"} />
        <StatCard label="Inactive Agents" value={inactiveCount} />
      </div>

      {agentStats.length === 0 ? (
        <EmptyState
          title="No Agents yet"
          description="Invite an interviewer to start assigning participant calls."
          action={<Button onClick={() => openInvite()}>Invite your first Agent</Button>}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search agents"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | DisplayStatus)}
              className="w-44"
            >
              <option value="all">Any status</option>
              <option value="active">Active</option>
              <option value="pending">Pending invite</option>
              <option value="expired">Invite expired</option>
              <option value="revoked">Invite revoked</option>
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
                  <table className="w-full min-w-[920px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-subtle">
                        <th className="px-5 py-3 font-medium">Agent</th>
                        <th className="px-5 py-3 font-medium">Campaigns</th>
                        <th className="px-5 py-3 font-medium">Daily target</th>
                        <th className="px-5 py-3 font-medium">Calls today</th>
                        <th className="px-5 py-3 font-medium">Last active</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(({ agent, campaignNames, displayStatus }) => {
                        const activeAssignments = db.campaignAgents.filter((ca) => ca.agentId === agent.id && ca.active);
                        const dailyTargetTotal = activeAssignments.reduce((sum, ca) => sum + ca.dailyTarget, 0);
                        const now = new Date();
                        const startOfToday = new Date(now);
                        startOfToday.setHours(0, 0, 0, 0);
                        const callsToday = db.callAttempts.filter(
                          (a) => a.agentId === agent.id && new Date(a.startedAt) >= startOfToday
                        ).length;
                        const lastAttempt = [...db.callAttempts]
                          .filter((a) => a.agentId === agent.id)
                          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
                        const shown = campaignNames.slice(0, 2);
                        const extra = campaignNames.length - shown.length;
                        const canOpenProfile = displayStatus === "active" || displayStatus === "inactive";
                        return (
                          <tr
                            key={agent.id}
                            onClick={canOpenProfile ? () => setProfileAgent(agent) : undefined}
                            className={`border-b border-border last:border-0 ${canOpenProfile ? "cursor-pointer hover:bg-surface-muted" : ""}`}
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
                            <td className="px-5 py-3 text-foreground-muted">
                              {campaignNames.length === 0
                                ? "—"
                                : `${shown.join(", ")}${extra > 0 ? ` +${extra} more` : ""}`}
                            </td>
                            <td className="px-5 py-3 tabular-nums text-foreground-muted">
                              {dailyTargetTotal > 0 ? dailyTargetTotal : "—"}
                            </td>
                            <td className="px-5 py-3 tabular-nums text-foreground-muted">{callsToday}</td>
                            <td className="px-5 py-3 text-xs text-foreground-muted">
                              {lastAttempt ? new Date(lastAttempt.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Never"}
                            </td>
                            <td className="px-5 py-3">
                              <StatusPill status={displayStatus} />
                            </td>
                            <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <OverflowMenu
                                actions={actionsForRow(agent, displayStatus)}
                                ariaLabel={`Actions for ${agent.name}`}
                              />
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

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={inviteStep === "form" ? "Invite Agent" : "Review invitation"}
      >
        {inviteStep === "form" ? (
          <form onSubmit={handleReviewInvite} className="flex flex-col gap-4">
            {formError ? <InlineBanner kind="danger">{formError}</InlineBanner> : null}
            <Field label="Full name" required>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} autoFocus />
            </Field>
            <Field label="Email address" required>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </Field>
            <Field label="Phone" hint="Needed before this agent can bridge a real call — can add it later.">
              <Input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+2348012345678"
              />
            </Field>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-foreground">Assign to campaigns</span>
              {db.campaigns.length === 0 ? (
                <p className="text-xs text-foreground-subtle">
                  No campaigns yet — they can still accept and join, landing in an empty workspace until
                  assigned.
                </p>
              ) : (
                <div className="flex flex-col gap-2 rounded-[6px] border border-border p-3">
                  {db.campaigns.map((c) => (
                    <Checkbox
                      key={c.id}
                      checked={form.campaignIds.includes(c.id)}
                      onChange={() => toggleCampaign(c.id)}
                      label={c.name}
                    />
                  ))}
                </div>
              )}
            </div>
            {form.campaignIds.length > 0 ? (
              <Field label="Daily call target">
                <Input
                  type="number"
                  min={0}
                  value={form.dailyTarget}
                  onChange={(e) => setForm((p) => ({ ...p, dailyTarget: e.target.value }))}
                />
              </Field>
            ) : null}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Review invitation</Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            {formError ? <InlineBanner kind="danger">{formError}</InlineBanner> : null}
            <div>
              <p className="label-caps text-foreground-subtle">Inviting</p>
              <p className="mt-1 font-medium text-foreground">{form.name}</p>
              <p className="text-sm text-foreground-muted">{form.email}</p>
            </div>
            <div>
              <p className="label-caps text-foreground-subtle">Campaigns</p>
              {form.campaignIds.length === 0 ? (
                <p className="mt-1 text-sm text-foreground-muted">None yet — they&apos;ll join with no work assigned.</p>
              ) : (
                <ul className="mt-1 list-disc pl-5 text-sm text-foreground">
                  {form.campaignIds.map((id) => (
                    <li key={id}>{db.campaigns.find((c) => c.id === id)?.name}</li>
                  ))}
                </ul>
              )}
            </div>
            {form.campaignIds.length > 0 ? (
              <div>
                <p className="label-caps text-foreground-subtle">Daily target</p>
                <p className="mt-1 text-sm text-foreground">{form.dailyTarget || 0} interviews</p>
              </div>
            ) : null}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" disabled={saving} onClick={() => setInviteStep("form")}>
                Back
              </Button>
              <Button onClick={handleSendInvite} disabled={saving}>
                {saving ? "Sending..." : "Send Invitation"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!viewInvitation} onClose={() => setViewInvitation(null)} title="Invitation">
        {viewInvitation ? (
          <div className="flex flex-col gap-3 text-sm">
            <div>
              <p className="label-caps text-foreground-subtle">Email</p>
              <p className="mt-0.5 text-foreground">{viewInvitation.email}</p>
            </div>
            <div>
              <p className="label-caps text-foreground-subtle">Invited by</p>
              <p className="mt-0.5 text-foreground">{viewInvitation.invitedByName}</p>
            </div>
            <div>
              <p className="label-caps text-foreground-subtle">Status</p>
              <p className="mt-0.5 text-foreground">{formatExpiry(viewInvitation.expiresAt)}</p>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setViewInvitation(null)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <AgentProfileModal
        agent={profileAgent}
        db={db}
        refetch={refetch}
        onClose={() => setProfileAgent(null)}
        onRequestDeactivate={(a) => setDeactivateTarget(a)}
      />

      <DeactivateAgentModal
        agent={deactivateTarget}
        db={db}
        onClose={() => setDeactivateTarget(null)}
        onDeactivated={() => {
          setDeactivateTarget(null);
          refetch();
          showToast(`${deactivateTarget?.name} deactivated`);
        }}
      />

      <RemoveFromCampaignModal
        agent={removeFromCampaignTarget}
        db={db}
        onClose={() => setRemoveFromCampaignTarget(null)}
        onRemoved={() => {
          setRemoveFromCampaignTarget(null);
          refetch();
          showToast(`${removeFromCampaignTarget?.name} removed from the campaign`);
        }}
      />

      <DeleteAgentModal
        agent={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null);
          refetch();
          showToast("Agent deleted");
        }}
        onDeactivateInstead={(a) => setDeactivateTarget(a)}
      />

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-[6px] border border-success/20 bg-success-soft px-4 py-3 text-sm text-success shadow-lg">
          <span className="font-medium">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="text-success/70 hover:text-success"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
