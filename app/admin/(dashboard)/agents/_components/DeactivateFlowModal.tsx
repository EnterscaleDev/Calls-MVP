"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminData } from "@/lib/hooks/useAdminData";
import { Modal, Btn, Note } from "@/components/ros/ros-ui";
import type { AgentProfile } from "@/lib/types";

interface OutstandingRow {
  campaignId: string;
  campaignName: string;
  outstandingCount: number;
}

export function DeactivateFlowModal({
  agent,
  db,
  close,
  toast,
}: {
  agent: AgentProfile | null;
  db: AdminData;
  close: () => void;
  toast: (m: string) => void;
}) {
  if (!agent) return <Modal open={false} close={close} title="" />;
  return <DeactivateFlowModalInner key={agent.id} agent={agent} db={db} close={close} toast={toast} />;
}

function DeactivateFlowModalInner({
  agent,
  db,
  close,
  toast,
}: {
  agent: AgentProfile;
  db: AdminData;
  close: () => void;
  toast: (m: string) => void;
}) {
  const [phase, setPhase] = useState<"checking" | "ready" | "error">("checking");
  const [outstanding, setOutstanding] = useState<OutstandingRow[]>([]);
  const [mode, setMode] = useState<"reassign" | "unassign">("reassign");
  const [map, setMap] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("admin_agent_outstanding_work_summary", { p_agent_id: agent.id }).then(({ data, error: rpcError }) => {
      if (rpcError) {
        setPhase("error");
        setError(rpcError.message);
        return;
      }
      setOutstanding(
        (data ?? []).map((r) => ({ campaignId: r.campaign_id, campaignName: r.campaign_name, outstandingCount: Number(r.outstanding_count) }))
      );
      setPhase("ready");
    });
  }, [agent.id]);

  const ready = mode === "unassign" || outstanding.every((row) => map[row.campaignId]);

  async function resolve() {
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    for (const row of outstanding) {
      if (mode === "unassign") {
        const { error: rpcError } = await supabase.rpc("admin_unassign_campaign_agent_work", {
          p_campaign_id: row.campaignId,
          p_agent_id: agent.id,
        });
        if (rpcError) {
          setSubmitting(false);
          setError(row.campaignName + ": " + rpcError.message);
          return;
        }
      } else {
        const { error: rpcError } = await supabase.rpc("admin_reassign_campaign_agent_work", {
          p_campaign_id: row.campaignId,
          p_from_agent_id: agent.id,
          p_to_agent_id: map[row.campaignId],
        });
        if (rpcError) {
          setSubmitting(false);
          setError(row.campaignName + ": " + rpcError.message);
          return;
        }
      }
    }
    finish();
  }

  async function finish() {
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_deactivate_agent", { p_agent_id: agent.id });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    toast(agent.name.split(" ")[0] + " deactivated");
    close();
  }

  const first = agent.name.split(" ")[0];
  const title = "Deactivate " + first + "?";

  if (phase === "checking") {
    return (
      <Modal open close={close} title={title}>
        <p className="xs">Checking outstanding work…</p>
      </Modal>
    );
  }
  if (phase === "error") {
    return (
      <Modal open close={close} title={title} foot={<Btn onClick={close}>Close</Btn>}>
        <Note tone="r">{error}</Note>
      </Modal>
    );
  }

  return (
    <Modal
      open
      close={close}
      title={title}
      wide={outstanding.length > 0}
      foot={
        <>
          <Btn onClick={close}>Cancel</Btn>
          <Btn k="r" disabled={submitting || !ready} onClick={outstanding.length ? resolve : finish}>
            Deactivate Agent
          </Btn>
        </>
      }
    >
      {error ? (
        <div style={{ marginBottom: 12 }}>
          <Note tone="r">{error}</Note>
        </div>
      ) : null}
      <p>{first} will lose access to all assigned campaigns and will no longer be able to conduct calls. Historical calls and notes will be preserved.</p>
      {!!outstanding.length && (
        <>
          <Note tone="i">
            {first} currently has {outstanding.map((r) => r.outstandingCount + " call" + (r.outstandingCount === 1 ? "" : "s") + " in " + r.campaignName).join(", ")}.
          </Note>
          <div className="field-l" style={{ marginTop: 14, marginBottom: 6 }}>
            How should outstanding work be handled?
          </div>
          <div className="stack-s" style={{ marginBottom: 8 }}>
            <label className="row" style={{ cursor: "pointer" }}>
              <input type="radio" style={{ width: "auto" }} checked={mode === "reassign"} onChange={() => setMode("reassign")} />
              Reassign by campaign
            </label>
            {mode === "reassign" &&
              outstanding.map((row) => {
                const eligible = db.campaignAgents
                  .filter((ca) => ca.campaignId === row.campaignId && ca.active && ca.agentId !== agent.id)
                  .map((ca) => db.agents.find((a) => a.id === ca.agentId))
                  .filter((a): a is AgentProfile => !!a && a.status === "active");
                return (
                  <div key={row.campaignId} className="row" style={{ marginLeft: 22, gap: 8 }}>
                    <span className="xs" style={{ minWidth: 150 }}>
                      {row.campaignName}
                    </span>
                    <select value={map[row.campaignId] || ""} onChange={(e) => setMap((m) => ({ ...m, [row.campaignId]: e.target.value }))}>
                      <option value="">Select Agent…</option>
                      {eligible.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            <label className="row" style={{ cursor: "pointer" }}>
              <input type="radio" style={{ width: "auto" }} checked={mode === "unassign"} onChange={() => setMode("unassign")} />
              Move outstanding calls to Unassigned
            </label>
          </div>
        </>
      )}
    </Modal>
  );
}
