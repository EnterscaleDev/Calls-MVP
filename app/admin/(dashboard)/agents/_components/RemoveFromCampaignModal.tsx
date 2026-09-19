"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminData } from "@/lib/hooks/useAdminData";
import { Modal, Btn, Note } from "@/components/ros/ros-ui";
import type { AgentProfile } from "@/lib/types";

export interface RemoveCtx {
  agent: AgentProfile;
  campaignId: string;
}

export function RemoveFromCampaignModal({
  ctx,
  db,
  close,
  toast,
}: {
  ctx: RemoveCtx | null;
  db: AdminData;
  close: () => void;
  toast: (m: string) => void;
}) {
  if (!ctx) return <Modal open={false} close={close} title="" />;
  return <RemoveFromCampaignModalInner key={ctx.agent.id + ":" + ctx.campaignId} ctx={ctx} db={db} close={close} toast={toast} />;
}

function RemoveFromCampaignModalInner({
  ctx,
  db,
  close,
  toast,
}: {
  ctx: RemoveCtx;
  db: AdminData;
  close: () => void;
  toast: (m: string) => void;
}) {
  const { agent, campaignId } = ctx;
  const campaign = db.campaigns.find((c) => c.id === campaignId);
  const campaignAgent = db.campaignAgents.find((ca) => ca.campaignId === campaignId && ca.agentId === agent.id && ca.active);
  const eligible = db.campaignAgents
    .filter((ca) => ca.campaignId === campaignId && ca.active && ca.agentId !== agent.id)
    .map((ca) => db.agents.find((a) => a.id === ca.agentId))
    .filter((a): a is AgentProfile => !!a && a.status === "active");

  const [phase, setPhase] = useState<"checking" | "ready" | "error">("checking");
  const [outstandingCount, setOutstandingCount] = useState(0);
  const [mode, setMode] = useState<"reassign" | "unassign">("reassign");
  const [to, setTo] = useState("");
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
        setOutstandingCount((data ?? []).length);
        setPhase("ready");
      });
  }, [agent.id, campaignId]);

  function finish(msg: string) {
    toast(msg);
    close();
  }

  async function doSimple() {
    if (!campaignAgent) return;
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_detach_agent_from_campaign", { p_campaign_agent_id: campaignAgent.id });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    finish(agent.name.split(" ")[0] + " removed from " + (campaign?.name ?? "the campaign") + ".");
  }

  async function doReassign() {
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_reassign_campaign_agent_work", {
      p_campaign_id: campaignId,
      p_from_agent_id: agent.id,
      p_to_agent_id: to,
    });
    if (rpcError) {
      setSubmitting(false);
      setError(rpcError.message);
      return;
    }
    await doSimple();
  }

  async function doUnassign() {
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_unassign_campaign_agent_work", {
      p_campaign_id: campaignId,
      p_agent_id: agent.id,
    });
    if (rpcError) {
      setSubmitting(false);
      setError(rpcError.message);
      return;
    }
    await doSimple();
  }

  const first = agent.name.split(" ")[0];
  const title = "Remove " + first + " from " + (campaign?.name ?? "…") + "?";

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
      foot={
        !outstandingCount ? (
          <>
            <Btn onClick={close}>Cancel</Btn>
            <Btn k="r" disabled={submitting} onClick={doSimple}>
              Remove Agent
            </Btn>
          </>
        ) : (
          <>
            <Btn onClick={close}>Cancel</Btn>
            {mode === "reassign" ? (
              <Btn k="p" disabled={!to || submitting} onClick={doReassign}>
                Reassign and remove
              </Btn>
            ) : (
              <Btn k="r" disabled={submitting} onClick={doUnassign}>
                Move to Unassigned and remove
              </Btn>
            )}
          </>
        )
      }
    >
      {error ? (
        <div style={{ marginBottom: 12 }}>
          <Note tone="r">{error}</Note>
        </div>
      ) : null}
      {!outstandingCount ? (
        <p style={{ margin: 0 }}>{first} will no longer be able to access this campaign or receive new calls from it.</p>
      ) : (
        <>
          <Note tone="i">
            {first} currently has {outstandingCount} active call assignment{outstandingCount === 1 ? "" : "s"} on {campaign?.name}.
          </Note>
          <div className="field-l" style={{ marginTop: 14, marginBottom: 6 }}>
            What should happen to these calls?
          </div>
          <div className="stack-s">
            <label className="row" style={{ cursor: "pointer" }}>
              <input type="radio" style={{ width: "auto" }} checked={mode === "reassign"} onChange={() => setMode("reassign")} />
              Reassign all calls to another Agent
            </label>
            {mode === "reassign" && (
              <select value={to} onChange={(e) => setTo(e.target.value)} style={{ marginLeft: 22 }}>
                <option value="">Select Agent…</option>
                {eligible.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
            <label className="row" style={{ cursor: "pointer" }}>
              <input type="radio" style={{ width: "auto" }} checked={mode === "unassign"} onChange={() => setMode("unassign")} />
              Move calls to Unassigned
            </label>
          </div>
        </>
      )}
    </Modal>
  );
}
