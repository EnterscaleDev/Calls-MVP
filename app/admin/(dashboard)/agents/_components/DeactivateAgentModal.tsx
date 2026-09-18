"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminData } from "@/lib/hooks/useAdminData";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { InlineBanner } from "@/components/ui/States";
import type { AgentProfile } from "@/lib/types";

interface OutstandingRow {
  campaignId: string;
  campaignName: string;
  outstandingCount: number;
}

type Resolution = { mode: "unresolved" } | { mode: "unassign" } | { mode: "reassign"; toAgentId: string };

/**
 * Deactivating an Agent blocks org-wide access, so — unlike a single
 * per-campaign removal — this has to resolve outstanding work across every
 * campaign they're on before the server will allow it. Mirrors
 * DeleteCampaignModal's phase-based shape.
 */
export function DeactivateAgentModal({
  agent,
  db,
  onClose,
  onDeactivated,
}: {
  agent: AgentProfile | null;
  db: AdminData;
  onClose: () => void;
  onDeactivated: () => void;
}) {
  if (!agent) return null;
  return <DeactivateAgentModalInner key={agent.id} agent={agent} db={db} onClose={onClose} onDeactivated={onDeactivated} />;
}

function DeactivateAgentModalInner({
  agent,
  db,
  onClose,
  onDeactivated,
}: {
  agent: AgentProfile;
  db: AdminData;
  onClose: () => void;
  onDeactivated: () => void;
}) {
  const [phase, setPhase] = useState<"checking" | "ready" | "error">("checking");
  const [outstanding, setOutstanding] = useState<OutstandingRow[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .rpc("admin_agent_outstanding_work_summary", { p_agent_id: agent.id })
      .then(({ data, error: rpcError }) => {
        if (rpcError) {
          setPhase("error");
          setError(rpcError.message);
          return;
        }
        const rows: OutstandingRow[] = (data ?? []).map((r) => ({
          campaignId: r.campaign_id,
          campaignName: r.campaign_name,
          outstandingCount: Number(r.outstanding_count),
        }));
        setOutstanding(rows);
        setResolutions(Object.fromEntries(rows.map((r) => [r.campaignId, { mode: "unresolved" as const }])));
        setPhase("ready");
      });
  }, [agent.id]);

  function eligibleAgentsFor(campaignId: string) {
    return db.campaignAgents
      .filter((ca) => ca.campaignId === campaignId && ca.active && ca.agentId !== agent.id)
      .map((ca) => db.agents.find((a) => a.id === ca.agentId))
      .filter((a): a is NonNullable<typeof a> => !!a);
  }

  const allResolved = outstanding.every((row) => resolutions[row.campaignId]?.mode !== "unresolved");

  async function handleConfirm() {
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    for (const row of outstanding) {
      const resolution = resolutions[row.campaignId];
      if (resolution?.mode === "reassign") {
        const { error: rpcError } = await supabase.rpc("admin_reassign_campaign_agent_work", {
          p_campaign_id: row.campaignId,
          p_from_agent_id: agent.id,
          p_to_agent_id: resolution.toAgentId,
        });
        if (rpcError) {
          setSubmitting(false);
          setError(`${row.campaignName}: ${rpcError.message}`);
          return;
        }
      } else if (resolution?.mode === "unassign") {
        const { error: rpcError } = await supabase.rpc("admin_unassign_campaign_agent_work", {
          p_campaign_id: row.campaignId,
          p_agent_id: agent.id,
        });
        if (rpcError) {
          setSubmitting(false);
          setError(`${row.campaignName}: ${rpcError.message}`);
          return;
        }
      }
    }

    const { error: deactivateError } = await supabase.rpc("admin_deactivate_agent", { p_agent_id: agent.id });
    setSubmitting(false);
    if (deactivateError) {
      setError(deactivateError.message);
      return;
    }
    onDeactivated();
  }

  if (phase === "checking") {
    return (
      <Modal open onClose={onClose} title={`Deactivate ${agent.name}?`} description="Checking outstanding work...">
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
      <Modal open onClose={onClose} title={`Deactivate ${agent.name}?`}>
        <InlineBanner kind="danger">{error}</InlineBanner>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={() => (submitting ? undefined : onClose())}
      title={`Deactivate ${agent.name}?`}
      description={`${agent.name} will lose access to all assigned campaigns and will no longer be able to conduct calls. Historical calls and notes will be preserved.`}
      wide={outstanding.length > 0}
    >
      <div className="flex flex-col gap-4">
        {error ? <InlineBanner kind="danger">{error}</InlineBanner> : null}

        {outstanding.length > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground">
              {agent.name} currently has:
            </p>
            <ul className="flex flex-col gap-3">
              {outstanding.map((row) => {
                const resolution = resolutions[row.campaignId] ?? { mode: "unresolved" as const };
                const eligible = eligibleAgentsFor(row.campaignId);
                return (
                  <li key={row.campaignId} className="rounded-[6px] border border-border p-3">
                    <p className="text-sm font-medium text-foreground">
                      {row.outstandingCount} outstanding call{row.outstandingCount === 1 ? "" : "s"} in {row.campaignName}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Select
                        className="w-48"
                        value={resolution.mode === "reassign" ? `reassign:${resolution.toAgentId}` : resolution.mode}
                        onChange={(e) => {
                          const value = e.target.value;
                          setResolutions((prev) => ({
                            ...prev,
                            [row.campaignId]:
                              value === "unassign"
                                ? { mode: "unassign" }
                                : value.startsWith("reassign:")
                                  ? { mode: "reassign", toAgentId: value.slice("reassign:".length) }
                                  : { mode: "unresolved" },
                          }));
                        }}
                      >
                        <option value="unresolved">Choose how to resolve...</option>
                        <option value="unassign">Move to Unassigned</option>
                        {eligible.map((a) => (
                          <option key={a.id} value={`reassign:${a.id}`}>
                            Reassign to {a.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-foreground-subtle">
              Bookings, consent, and scheduled call times are never changed — only the agent assignment.
            </p>
          </div>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={submitting || (outstanding.length > 0 && !allResolved)}
            onClick={handleConfirm}
          >
            {submitting ? "Deactivating..." : "Deactivate Agent"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
