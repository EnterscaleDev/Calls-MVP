"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminData } from "@/lib/hooks/useAdminData";
import { Modal, Btn, Field, Note, Icon } from "@/components/ros/ros-ui";
import type { AgentProfile } from "@/lib/types";

export function ManageAgentModal({
  agent,
  db,
  close,
  toast,
  onRemoveCampaign,
  onDeactivate,
  onDelete,
}: {
  agent: AgentProfile | null;
  db: AdminData;
  close: () => void;
  toast: (m: string) => void;
  onRemoveCampaign: (agent: AgentProfile, campaignId: string) => void;
  onDeactivate: (agent: AgentProfile) => void;
  onDelete: (agent: AgentProfile) => void;
}) {
  if (!agent) return <Modal open={false} close={close} title="" />;
  return (
    <ManageAgentModalInner
      key={agent.id}
      agent={agent}
      db={db}
      close={close}
      toast={toast}
      onRemoveCampaign={onRemoveCampaign}
      onDeactivate={onDeactivate}
      onDelete={onDelete}
    />
  );
}

function ManageAgentModalInner({
  agent,
  db,
  close,
  toast,
  onRemoveCampaign,
  onDeactivate,
  onDelete,
}: {
  agent: AgentProfile;
  db: AdminData;
  close: () => void;
  toast: (m: string) => void;
  onRemoveCampaign: (agent: AgentProfile, campaignId: string) => void;
  onDeactivate: (agent: AgentProfile) => void;
  onDelete: (agent: AgentProfile) => void;
}) {
  const activeAssignments = db.campaignAgents.filter((ca) => ca.agentId === agent.id && ca.active);
  const [target, setTarget] = useState(String(activeAssignments.reduce((s, ca) => s + ca.dailyTarget, 0) || 8));
  const [phone, setPhone] = useState(agent.phone);
  const [add, setAdd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [outstanding, setOutstanding] = useState<Record<string, number>>({});

  const available = db.campaigns.filter((c) => !activeAssignments.some((ca) => ca.campaignId === c.id));

  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("admin_agent_delete_eligibility", { p_agent_id: agent.id }).then(({ data }) => {
      setEligible(data?.[0]?.eligible ?? false);
    });
    Promise.all(
      activeAssignments.map((ca) =>
        supabase
          .rpc("admin_campaign_agent_outstanding_work", { p_campaign_id: ca.campaignId, p_agent_id: agent.id })
          .then(({ data }) => [ca.campaignId, (data ?? []).length] as const)
      )
    ).then((pairs) => setOutstanding(Object.fromEntries(pairs)));
    // Only ever needs to run once per agent (this component remounts via
    // ManageAgentModal's key={agent.id}), not on every campaignAgents change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  async function saveChanges() {
    setSaving(true);
    setError("");
    const supabase = createClient();
    if (phone !== agent.phone) {
      await supabase.from("agent_profiles").update({ phone: phone.trim() }).eq("id", agent.id);
    }
    // Split evenly-ish isn't meaningful here — the prototype's single
    // "daily call target" field maps to each active campaign_agents row's
    // own target; set them all to the same value, matching what a single
    // combined field implies.
    for (const ca of activeAssignments) {
      await supabase.from("campaign_agents").update({ daily_target: Number(target) || 0 }).eq("id", ca.id);
    }
    setSaving(false);
    toast("Changes saved");
  }

  async function handleAdd() {
    if (!add) return;
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_attach_agent_to_campaign", {
      p_campaign_id: add,
      p_agent_id: agent.id,
      p_daily_target: Number(target) || 0,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    toast("Added to " + db.campaigns.find((c) => c.id === add)?.name);
    setAdd("");
  }

  return (
    <Modal
      open
      close={close}
      title={"Manage access — " + agent.name}
      foot={
        <>
          <Btn k="r" onClick={() => onDeactivate(agent)}>
            Deactivate Agent
          </Btn>
          <div style={{ marginLeft: "auto" }} className="btns">
            <Btn onClick={close}>Close</Btn>
            <Btn k="p" disabled={saving} onClick={saveChanges}>
              {saving ? "Saving..." : "Save changes"}
            </Btn>
          </div>
        </>
      }
    >
      {error ? (
        <div style={{ marginBottom: 12 }}>
          <Note tone="r">{error}</Note>
        </div>
      ) : null}
      <Field l="Daily call target">
        <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
      </Field>
      <Field l="Phone (for real calls)" hint="Real telephony rings this number first, then bridges to the participant. Required before this agent can start a real call.">
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2348012345678" />
      </Field>
      <div className="rule" />
      <div className="field-l" style={{ marginBottom: 6 }}>
        Campaign access
      </div>
      {activeAssignments.length ? (
        <div className="stack-s" style={{ marginBottom: 12 }}>
          {activeAssignments.map((ca) => {
            const campaign = db.campaigns.find((c) => c.id === ca.campaignId);
            if (!campaign) return null;
            return (
              <div
                key={ca.campaignId}
                className="row"
                style={{ gap: 8, background: "#FBFAF9", border: "1px solid var(--line)", borderRadius: 5, padding: "7px 10px" }}
              >
                <Icon n="layers" size={13} />
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{campaign.name}</span>
                <span className="xs" style={{ marginLeft: "auto" }}>
                  {outstanding[ca.campaignId] ?? 0} outstanding
                </span>
                <Btn sm onClick={() => onRemoveCampaign(agent, ca.campaignId)}>
                  Remove
                </Btn>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="xs" style={{ marginBottom: 12 }}>
          Not assigned to any campaign yet.
        </div>
      )}
      {!!available.length && (
        <div className="row" style={{ gap: 8 }}>
          <select value={add} onChange={(e) => setAdd(e.target.value)} style={{ flex: 1 }}>
            <option value="">Add to a campaign…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Btn sm disabled={!add} onClick={handleAdd}>
            Add
          </Btn>
        </div>
      )}
      <div className="rule" />
      <Note tone="i">Removing a campaign here checks for outstanding work first. Past call history and notes always stay on record.</Note>
      {eligible === false ? (
        <div style={{ marginTop: 10 }}>
          <Note tone="i">This Agent has research history and cannot be permanently deleted.</Note>
        </div>
      ) : eligible === true ? (
        <div style={{ marginTop: 10 }}>
          <Btn sm k="r" onClick={() => onDelete(agent)}>
            Delete Agent
          </Btn>
        </div>
      ) : null}
    </Modal>
  );
}
