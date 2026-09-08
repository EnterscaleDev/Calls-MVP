"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { listAgentsWithStats } from "@/lib/selectors";
import { LoadingScreen, EmptyState, InlineBanner } from "@/components/ui/States";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { AgentStatusBadge } from "@/components/ui/Badge";
import type { AgentStatus } from "@/lib/types";

export default function AgentsPage() {
  const { ready, db, actions } = useStore();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [dailyTarget, setDailyTarget] = useState("8");
  const [error, setError] = useState("");

  if (!ready) return <LoadingScreen label="Loading agents..." />;

  const agentStats = listAgentsWithStats(db);

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
      campaignId: campaignId || undefined,
      dailyTarget: Number(dailyTarget) || undefined,
    });
    setInviteOpen(false);
    setName("");
    setEmail("");
    setCampaignId("");
    setDailyTarget("8");
  }

  function toggleStatus(agentId: string, current: AgentStatus) {
    const next: AgentStatus = current === "active" ? "inactive" : "active";
    actions.setAgentStatus(agentId, next);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Agents</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Everyone across the org who can be assigned interviews.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>Invite Agent</Button>
      </div>

      {agentStats.length === 0 ? (
        <EmptyState
          title="No agents yet"
          description="Invite your first agent to start assigning interviews."
          action={<Button onClick={() => setInviteOpen(true)}>Invite Agent</Button>}
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-subtle">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Campaigns</th>
                    <th className="px-5 py-3 font-medium">Calls today</th>
                    <th className="px-5 py-3 font-medium">Completed today</th>
                    <th className="px-5 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {agentStats.map(({ agent, campaignNames, callsToday, completedToday }) => (
                    <tr key={agent.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 font-medium text-foreground">{agent.name}</td>
                      <td className="px-5 py-3 text-foreground-muted">{agent.email}</td>
                      <td className="px-5 py-3">
                        <AgentStatusBadge status={agent.status} />
                      </td>
                      <td className="px-5 py-3 text-foreground-muted">
                        {campaignNames.length > 0 ? campaignNames.join(", ") : "—"}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-foreground-muted">{callsToday}</td>
                      <td className="px-5 py-3 tabular-nums text-foreground-muted">{completedToday}</td>
                      <td className="px-5 py-3 text-right">
                        {agent.status !== "invited" ? (
                          <button
                            type="button"
                            onClick={() => toggleStatus(agent.id, agent.status)}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {agent.status === "active" ? "Mark inactive" : "Mark active"}
                          </button>
                        ) : (
                          <span className="text-xs text-foreground-subtle">Awaiting first sign-in</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite an agent">
        <form onSubmit={handleInviteSubmit} className="flex flex-col gap-4">
          {error ? <InlineBanner kind="danger">{error}</InlineBanner> : null}
          <Field label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
            <Button type="submit">Invite</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
