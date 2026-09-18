"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAdminData } from "@/lib/hooks/useAdminData";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, InlineBanner, LoadingScreen, ErrorState } from "@/components/ui/States";
import { AgentStatusBadge } from "@/components/ui/Badge";
import { RemoveFromCampaignModal } from "../../../agents/_components/RemoveFromCampaignModal";
import { useCampaignDetail } from "../campaign-context";
import type { AgentProfile } from "@/lib/types";

export default function CampaignAgentsPage() {
  const campaign = useCampaignDetail();
  const { data: db, loading, error, refetch } = useAdminData();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dailyTarget, setDailyTarget] = useState(String(campaign.dailyAgentTarget || 8));
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [attachAgentId, setAttachAgentId] = useState("");
  const [attachTarget, setAttachTarget] = useState(String(campaign.dailyAgentTarget || 8));
  const [removeTarget, setRemoveTarget] = useState<AgentProfile | null>(null);

  const campaignAgentRows = db
    ? db.campaignAgents
        .filter((ca) => ca.campaignId === campaign.id && ca.active)
        .map((ca) => ({ ca, agent: db.agents.find((a) => a.id === ca.agentId) }))
        .filter((row): row is { ca: typeof row.ca; agent: NonNullable<typeof row.agent> } => !!row.agent)
    : [];

  const attachedAgentIds = new Set(campaignAgentRows.map((r) => r.agent.id));
  const otherAgents = db ? db.agents.filter((a) => !attachedAgentIds.has(a.id)) : [];

  if (loading || !db) return <LoadingScreen label="Loading agents..." />;
  if (error) return <ErrorState title="Couldn't load agents" description={error} />;

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setFormError("Name and email are required.");
      return;
    }
    setFormError("");
    setSaving(true);
    // Routed through the API route (not a raw RPC call) so the real
    // invitation email actually sends — same path as the main Agents page.
    const response = await fetch("/api/agents/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        campaignIds: [campaign.id],
        dailyTarget: Number(dailyTarget) || 8,
      }),
    });
    const result = (await response.json().catch(() => ({ ok: false, errorReason: "Unexpected response." }))) as
      | { ok: true }
      | { ok: false; errorReason: string };
    setSaving(false);
    if (!result.ok) {
      setFormError(result.errorReason);
      return;
    }
    setInviteOpen(false);
    setName("");
    setEmail("");
    await refetch();
  }

  async function handleAttach() {
    if (!attachAgentId) return;
    const supabase = createClient();
    await supabase.rpc("admin_attach_agent_to_campaign", {
      p_campaign_id: campaign.id,
      p_agent_id: attachAgentId,
      p_daily_target: Number(attachTarget) || 0,
    });
    setAttachAgentId("");
    await refetch();
  }

  async function handleTargetBlur(campaignAgentId: string, currentTarget: number, nextValue: string) {
    const next = Number(nextValue);
    if (!Number.isFinite(next) || next < 0 || next === currentTarget) return;
    const supabase = createClient();
    await supabase.from("campaign_agents").update({ daily_target: next }).eq("id", campaignAgentId);
    await refetch();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground-muted">
          Agents working this campaign, with their daily call target.
        </p>
        <Button onClick={() => setInviteOpen(true)}>Invite New Agent</Button>
      </div>

      <Card>
        <CardHeader title="Attach an existing agent" />
        <CardBody className="flex flex-col gap-3">
          <p className="text-xs text-foreground-subtle">
            Link an agent who&apos;s already active on another campaign to this one too, with a daily target
            for this campaign specifically.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Agent">
              <Select
                className="w-56"
                value={attachAgentId}
                onChange={(e) => setAttachAgentId(e.target.value)}
                disabled={otherAgents.length === 0}
              >
                <option value="">
                  {otherAgents.length === 0 ? "No other agents in the org" : "Select an agent"}
                </option>
                {otherAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Daily target">
              <Input
                type="number"
                min={0}
                className="w-24"
                value={attachTarget}
                onChange={(e) => setAttachTarget(e.target.value)}
              />
            </Field>
            <Button variant="secondary" disabled={!attachAgentId} onClick={handleAttach}>
              Attach
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Assigned agents" />
        <CardBody className="p-0">
          {campaignAgentRows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No agents attached yet"
                description="Invite an agent to start assigning them interviews on this campaign."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-subtle">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Daily target</th>
                    <th className="px-5 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {campaignAgentRows.map(({ ca, agent }) => (
                    <tr key={ca.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 font-medium text-foreground">{agent.name}</td>
                      <td className="px-5 py-3 text-foreground-muted">{agent.email}</td>
                      <td className="px-5 py-3">
                        <AgentStatusBadge status={agent.status} />
                      </td>
                      <td className="px-5 py-3">
                        <Input
                          type="number"
                          min={0}
                          className="w-20 py-1 tabular-nums"
                          defaultValue={ca.dailyTarget}
                          onBlur={(e) => handleTargetBlur(ca.id, ca.dailyTarget, e.target.value)}
                        />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button variant="secondary" size="sm" onClick={() => setRemoveTarget(agent)}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite a new agent">
        <form onSubmit={handleInviteSubmit} className="flex flex-col gap-4">
          {formError ? <InlineBanner kind="danger">{formError}</InlineBanner> : null}
          <Field label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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

      <RemoveFromCampaignModal
        agent={removeTarget}
        db={db}
        fixedCampaignId={campaign.id}
        onClose={() => setRemoveTarget(null)}
        onRemoved={() => {
          setRemoveTarget(null);
          refetch();
        }}
      />
    </div>
  );
}
