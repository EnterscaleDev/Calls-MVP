"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminData } from "@/lib/hooks/useAdminData";
import { getAgentProfileStats } from "@/lib/selectors";
import { Modal } from "@/components/ui/Modal";
import { Card, CardBody, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, AgentStatusBadge, CampaignStatusBadge } from "@/components/ui/Badge";
import { Checkbox, Input } from "@/components/ui/Form";
import { InlineBanner } from "@/components/ui/States";
import type { AgentProfile } from "@/lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function AgentProfileModal({
  agent,
  db,
  refetch,
  onClose,
  onRequestDeactivate,
}: {
  agent: AgentProfile | null;
  db: AdminData | null;
  refetch: () => Promise<void>;
  onClose: () => void;
  /** Deactivation needs a cross-campaign outstanding-work check the parent
   *  page owns (DeactivateAgentModal) — this modal just hands off to it. */
  onRequestDeactivate: (agent: AgentProfile) => void;
}) {
  if (!agent || !db) return null;
  // Keyed by agent id: opening a different agent (or the same one again
  // after a refetch) mounts a fresh instance with state re-derived from the
  // current props, instead of an effect resetting state on every change.
  return (
    <AgentProfileModalInner
      key={agent.id}
      agent={agent}
      db={db}
      refetch={refetch}
      onClose={onClose}
      onRequestDeactivate={onRequestDeactivate}
    />
  );
}

function AgentProfileModalInner({
  agent,
  db,
  refetch,
  onClose,
  onRequestDeactivate,
}: {
  agent: AgentProfile;
  db: AdminData;
  refetch: () => Promise<void>;
  onClose: () => void;
  onRequestDeactivate: (agent: AgentProfile) => void;
}) {
  const [selections, setSelections] = useState<Record<string, { checked: boolean; target: string }>>(() => {
    const next: Record<string, { checked: boolean; target: string }> = {};
    for (const campaign of db.campaigns) {
      const existing = db.campaignAgents.find((ca) => ca.agentId === agent.id && ca.campaignId === campaign.id && ca.active);
      next[campaign.id] = {
        checked: !!existing,
        target: String(existing?.dailyTarget ?? campaign.dailyAgentTarget ?? 8),
      };
    }
    return next;
  });
  const [phone, setPhone] = useState(agent.phone);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

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
    setSaving(true);
    setSaveError("");
    const supabase = createClient();
    if (phone !== agent.phone) {
      await supabase.from("agent_profiles").update({ phone: phone.trim() }).eq("id", agent.id);
    }
    for (const campaign of db.campaigns) {
      const selection = selections[campaign.id];
      if (!selection) continue;
      const existing = db.campaignAgents.find((ca) => ca.agentId === agent.id && ca.campaignId === campaign.id && ca.active);
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
        const { error: detachError } = await supabase.rpc("admin_detach_agent_from_campaign", {
          p_campaign_agent_id: existing.id,
        });
        if (detachError) {
          // Has outstanding work in this campaign — admin_detach_agent_from_campaign
          // refuses to run blind. Revert the checkbox and point at the guided
          // "Remove from campaign" flow (••• menu) instead of failing silently.
          setSaving(false);
          setSaveError(`${campaign.name}: ${detachError.message}`);
          setSelections((prev) => ({ ...prev, [campaign.id]: { ...prev[campaign.id], checked: true } }));
          await refetch();
          return;
        }
      }
    }
    setSaving(false);
    await refetch();
    onClose();
  }

  async function handleReactivate() {
    setSaving(true);
    const supabase = createClient();
    await supabase.rpc("admin_reactivate_agent", { p_agent_id: agent.id });
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

        {saveError ? <InlineBanner kind="danger">{saveError}</InlineBanner> : null}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Phone (for real calls)</label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+2348012345678"
          />
          <p className="mt-1 text-xs text-foreground-subtle">
            Real telephony rings this number first, then bridges to the participant. Required before this
            agent can start a real call.
          </p>
        </div>

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
          {agent.status === "inactive" ? (
            <Button variant="danger" onClick={handleReactivate} disabled={saving}>
              {saving ? "Reactivating..." : "Reactivate"}
            </Button>
          ) : (
            <Button
              variant="danger"
              onClick={() => {
                onClose();
                onRequestDeactivate(agent);
              }}
              disabled={saving}
            >
              Deactivate
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save permissions"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
