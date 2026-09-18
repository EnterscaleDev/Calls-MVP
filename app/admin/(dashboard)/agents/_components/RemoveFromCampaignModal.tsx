"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminData } from "@/lib/hooks/useAdminData";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { InlineBanner } from "@/components/ui/States";
import type { AgentProfile } from "@/lib/types";

type Phase = "checking" | "confirm_clean" | "resolve_outstanding" | "error";

/**
 * "Remove from campaign" — the lighter-weight sibling of deactivation.
 * Used from both the Agents list ••• menu (campaign not yet known — picks
 * one first) and Campaign → Agents (campaign already fixed via
 * fixedCampaignId).
 */
export function RemoveFromCampaignModal({
  agent,
  db,
  fixedCampaignId,
  onClose,
  onRemoved,
}: {
  agent: AgentProfile | null;
  db: AdminData;
  fixedCampaignId?: string;
  onClose: () => void;
  onRemoved: () => void;
}) {
  if (!agent) return null;
  return (
    <RemoveFromCampaignModalInner
      key={agent.id}
      agent={agent}
      db={db}
      fixedCampaignId={fixedCampaignId}
      onClose={onClose}
      onRemoved={onRemoved}
    />
  );
}

function RemoveFromCampaignModalInner({
  agent,
  db,
  fixedCampaignId,
  onClose,
  onRemoved,
}: {
  agent: AgentProfile;
  db: AdminData;
  fixedCampaignId?: string;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const activeAssignments = db.campaignAgents.filter((ca) => ca.agentId === agent.id && ca.active);
  const eligibleCampaigns = activeAssignments
    .map((ca) => ({ ca, campaign: db.campaigns.find((c) => c.id === ca.campaignId) }))
    .filter((r): r is { ca: typeof r.ca; campaign: NonNullable<typeof r.campaign> } => !!r.campaign);

  const [campaignId, setCampaignId] = useState<string | null>(
    fixedCampaignId ?? (eligibleCampaigns.length === 1 ? eligibleCampaigns[0].campaign.id : null)
  );

  if (!campaignId) {
    return (
      <Modal open onClose={onClose} title={`Remove ${agent.name} from a campaign`}>
        <div className="flex flex-col gap-4">
          <Select value="" onChange={(e) => setCampaignId(e.target.value)}>
            <option value="" disabled>
              Choose a campaign...
            </option>
            {eligibleCampaigns.map((r) => (
              <option key={r.campaign.id} value={r.campaign.id}>
                {r.campaign.name}
              </option>
            ))}
          </Select>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  const selected = eligibleCampaigns.find((r) => r.campaign.id === campaignId);
  // Keyed by campaignId: picking a (different) campaign mounts a fresh
  // outstanding-work check instead of an effect resetting state.
  return (
    <CampaignRemovalCheck
      key={campaignId}
      agent={agent}
      db={db}
      campaignId={campaignId}
      campaignName={selected?.campaign.name ?? ""}
      campaignAgentId={selected?.ca.id ?? ""}
      onClose={onClose}
      onRemoved={onRemoved}
    />
  );
}

function CampaignRemovalCheck({
  agent,
  db,
  campaignId,
  campaignName,
  campaignAgentId,
  onClose,
  onRemoved,
}: {
  agent: AgentProfile;
  db: AdminData;
  campaignId: string;
  campaignName: string;
  campaignAgentId: string;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [outstandingCount, setOutstandingCount] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .rpc("admin_campaign_agent_outstanding_work", { p_campaign_id: campaignId, p_agent_id: agent.id })
      .then(({ data, error: rpcError }) => {
        if (rpcError) {
          setPhase("error");
          setError(rpcError.message);
          return;
        }
        setOutstandingCount(data?.length ?? 0);
        setPhase((data?.length ?? 0) > 0 ? "resolve_outstanding" : "confirm_clean");
      });
  }, [campaignId, agent.id]);

  function eligibleReplacementAgents() {
    return db.campaignAgents
      .filter((ca) => ca.campaignId === campaignId && ca.active && ca.agentId !== agent.id)
      .map((ca) => db.agents.find((a) => a.id === ca.agentId))
      .filter((a): a is NonNullable<typeof a> => !!a);
  }

  async function handleRemoveClean() {
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_detach_agent_from_campaign", {
      p_campaign_agent_id: campaignAgentId,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onRemoved();
  }

  async function handleReassign(toAgentId: string) {
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_reassign_campaign_agent_work", {
      p_campaign_id: campaignId,
      p_from_agent_id: agent.id,
      p_to_agent_id: toAgentId,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onRemoved();
  }

  async function handleMoveToUnassigned() {
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_unassign_campaign_agent_work", {
      p_campaign_id: campaignId,
      p_agent_id: agent.id,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onRemoved();
  }

  if (phase === "checking") {
    return (
      <Modal open onClose={onClose} title={`Remove ${agent.name} from ${campaignName}?`} description="Checking outstanding work...">
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Modal>
    );
  }

  if (phase === "error") {
    return (
      <Modal open onClose={onClose} title={`Remove ${agent.name} from ${campaignName}?`}>
        <InlineBanner kind="danger">{error}</InlineBanner>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </Modal>
    );
  }

  if (phase === "confirm_clean") {
    return (
      <Modal
        open
        onClose={() => (submitting ? undefined : onClose())}
        title={`Remove ${agent.name} from ${campaignName}?`}
        description={`${agent.name} will no longer be able to access this campaign or receive new calls from it.`}
      >
        <div className="flex flex-col gap-3">
          {error ? <InlineBanner kind="danger">{error}</InlineBanner> : null}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" disabled={submitting} onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" disabled={submitting} onClick={handleRemoveClean}>
              {submitting ? "Removing..." : "Remove Agent"}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // resolve_outstanding
  const eligible = eligibleReplacementAgents();
  return (
    <Modal open onClose={() => (submitting ? undefined : onClose())} title={`Remove ${agent.name} from ${campaignName}?`}>
      <div className="flex flex-col gap-4">
        {error ? <InlineBanner kind="danger">{error}</InlineBanner> : null}
        <p className="text-sm text-foreground">
          {agent.name} currently has {outstandingCount} active call assignment{outstandingCount === 1 ? "" : "s"}.
        </p>
        <div className="flex flex-col gap-2">
          {eligible.length > 0 ? (
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">Reassign all calls to</p>
              <Select
                disabled={submitting}
                defaultValue=""
                onChange={(e) => e.target.value && handleReassign(e.target.value)}
              >
                <option value="" disabled>
                  Select agent...
                </option>
                {eligible.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <p className="text-xs text-foreground-subtle">
              No other agents are attached to this campaign to reassign to.
            </p>
          )}
          <Button variant="secondary" disabled={submitting} onClick={handleMoveToUnassigned}>
            {submitting ? "Working..." : "Move calls to Unassigned"}
          </Button>
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
