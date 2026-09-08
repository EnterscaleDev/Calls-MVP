"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, InlineBanner } from "@/components/ui/States";
import { AgentStatusBadge } from "@/components/ui/Badge";
import { useCampaignDetail } from "../campaign-context";

export default function CampaignAgentsPage() {
  const campaign = useCampaignDetail();
  const { db, actions } = useStore();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dailyTarget, setDailyTarget] = useState(String(campaign.dailyAgentTarget || 8));
  const [error, setError] = useState("");

  const [attachAgentId, setAttachAgentId] = useState("");
  const [attachTarget, setAttachTarget] = useState(String(campaign.dailyAgentTarget || 8));

  const campaignAgentRows = db.campaignAgents
    .filter((ca) => ca.campaignId === campaign.id)
    .map((ca) => ({ ca, agent: db.agents.find((a) => a.id === ca.agentId) }))
    .filter((row): row is { ca: typeof row.ca; agent: NonNullable<typeof row.agent> } => !!row.agent);

  const attachedAgentIds = new Set(campaignAgentRows.map((r) => r.agent.id));
  const otherAgents = db.agents.filter((a) => !attachedAgentIds.has(a.id));

  function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setError("");
    actions.inviteAgent({
      name: name.trim(),
      email: email.trim(),
      campaignId: campaign.id,
      dailyTarget: Number(dailyTarget) || undefined,
    });
    setInviteOpen(false);
    setName("");
    setEmail("");
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
            <Button
              variant="secondary"
              disabled={!attachAgentId}
              onClick={() => {
                actions.attachAgentToCampaign(campaign.id, attachAgentId, Number(attachTarget) || 0);
                setAttachAgentId("");
              }}
            >
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
                          onBlur={(e) => {
                            const next = Number(e.target.value);
                            if (Number.isFinite(next) && next >= 0 && next !== ca.dailyTarget) {
                              actions.updateCampaignAgentTarget(ca.id, next);
                            }
                          }}
                        />
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
          {error ? <InlineBanner kind="danger">{error}</InlineBanner> : null}
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
            <Button type="submit">Invite</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
