"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminData } from "@/lib/hooks/useAdminData";
import { getAgentProfileStats } from "@/lib/selectors";
import { Modal } from "@/components/ui/Modal";
import { Card, CardBody, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, AgentStatusBadge, CampaignStatusBadge } from "@/components/ui/Badge";
import { Checkbox, Input } from "@/components/ui/Form";
import type { AgentProfile } from "@/lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function AgentProfileModal({
  agent,
  db,
  refetch,
  onClose,
}: {
  agent: AgentProfile | null;
  db: AdminData | null;
  refetch: () => Promise<void>;
  onClose: () => void;
}) {
  const [selections, setSelections] = useState<Record<string, { checked: boolean; target: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!agent || !db) return;
    const next: Record<string, { checked: boolean; target: string }> = {};
    for (const campaign of db.campaigns) {
      const existing = db.campaignAgents.find((ca) => ca.agentId === agent.id && ca.campaignId === campaign.id);
      next[campaign.id] = {
        checked: !!existing,
        target: String(existing?.dailyTarget ?? campaign.dailyAgentTarget ?? 8),
      };
    }
    setSelections(next);
    // Re-derive whenever a different agent is opened, or campaigns/attachments change underneath us.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id, db?.campaigns, db?.campaignAgents]);

  if (!agent || !db) return null;

  const stats = getAgentProfileStats(db, agent.id);

  function toggleCampaign(campaignId: string) {
    setSelections((prev) => ({
      ...prev,
      [campaignId]: { ...prev[campaignId], checked: !prev[campaignId]?.checked },
    }));
  }

  function setTarget(campaignId: string, value: string) {
    setSelections((prev) => ({ ...prev, [campaignId]: { ...prev[campaignId], target: value } }));
  }

  async function handleSave() {
    if (!agent || !db) return;
    setSaving(true);
    const supabase = createClient();
    for (const campaign of db.campaigns) {
      const selection = selections[campaign.id];
      if (!selection) continue;
      const existing = db.campaignAgents.find((ca) => ca.agentId === agent.id && ca.campaignId === campaign.id);
      const targetNumber = Number(selection.target) || 0;

      if (selection.checked && !existing) {
        await supabase.rpc("admin_attach_agent_to_campaign", {
          p_campaign_id: campaign.id,
          p_agent_id: agent.id,
          p_daily_target: targetNumber,
        });
      } else if (selection.checked && existing && existing.dailyTarget !== targetNumber) {
        await supabase.from("campaign_agents").update({ daily_target: targetNumber }).eq("id", existing.id);
      } else if (!selection.checked && existing) {
        await supabase.rpc("admin_detach_agent_from_campaign", { p_campaign_agent_id: existing.id });
      }
    }
    setSaving(false);
    await refetch();
    onClose();
  }

  async function handleDeactivate() {
    if (!agent) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("agent_profiles")
      .update({ status: agent.status === "inactive" ? "active" : "inactive" })
      .eq("id", agent.id);
    setSaving(false);
    await refetch();
    onClose();
  }

  return (
    <Modal open={!!agent} onClose={onClose} title={agent.name} wide>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
            {agent.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <Badge tone="info">Call agent</Badge>
          <AgentStatusBadge status={agent.status} />
        </div>
        <p className="-mt-2 text-xs text-foreground-muted">
          {agent.email} · joined {formatDate(agent.createdAt)}
        </p>

        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Today" value={`${stats.completedToday}/${stats.assignedToday}`} />
          <StatCard label="This week" value={stats.completedThisWeek} />
          <StatCard label="Completion" value={`${Math.round(stats.completionRate * 100)}%`} />
        </div>

        <Card>
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <input type="checkbox" checked disabled className="mt-0.5 h-4 w-4 accent-primary opacity-70" />
              <div>
                <p className="text-sm font-semibold text-foreground">Telephone interviews</p>
                <p className="text-xs text-foreground-muted">
                  Runs masked calls from a daily queue. Never sees a phone number.
                </p>
              </div>
            </div>

            <div className="ml-7 flex flex-col gap-2 border-t border-border pt-3">
              <p className="label-caps text-foreground-subtle">Call campaigns</p>
              {db.campaigns.length === 0 ? (
                <p className="text-xs text-foreground-subtle">No campaigns exist yet.</p>
              ) : (
                db.campaigns.map((campaign) => {
                  const selection = selections[campaign.id];
                  return (
                    <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-2">
                      <Checkbox
                        checked={selection?.checked ?? false}
                        onChange={() => toggleCampaign(campaign.id)}
                        label={campaign.name}
                      />
                      <div className="flex items-center gap-2">
                        {selection?.checked ? (
                          <Input
                            type="number"
                            min={0}
                            value={selection.target}
                            onChange={(e) => setTarget(campaign.id, e.target.value)}
                            className="w-16 py-1 text-xs"
                            aria-label={`Daily target for ${campaign.name}`}
                          />
                        ) : null}
                        <CampaignStatusBadge status={campaign.status} />
                      </div>
                    </div>
                  );
                })
              )}
              <p className="text-xs text-foreground-subtle">
                Daily target is a pacing aid for their queue, not a hard limit.
              </p>
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeactivate} disabled={saving}>
            {agent.status === "inactive" ? "Reactivate" : "Deactivate"}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save permissions"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
