"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Btn, Field, Note } from "@/components/ros/ros-ui";
import type { AgentProfile } from "@/lib/types";

type Phase = "checking" | "eligible" | "ineligible" | "error";

export function DeleteAgentModal({
  agent,
  close,
  toast,
  onDeactivateInstead,
}: {
  agent: AgentProfile | null;
  close: () => void;
  toast: (m: string) => void;
  onDeactivateInstead: (agent: AgentProfile) => void;
}) {
  if (!agent) return <Modal open={false} close={close} title="" />;
  return <DeleteAgentModalInner key={agent.id} agent={agent} close={close} toast={toast} onDeactivateInstead={onDeactivateInstead} />;
}

function DeleteAgentModalInner({
  agent,
  close,
  toast,
  onDeactivateInstead,
}: {
  agent: AgentProfile;
  close: () => void;
  toast: (m: string) => void;
  onDeactivateInstead: (agent: AgentProfile) => void;
}) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("admin_agent_delete_eligibility", { p_agent_id: agent.id }).then(({ data, error }) => {
      if (error || !data || data.length === 0) {
        setPhase("error");
        setReason(error?.message ?? "Couldn't check whether this agent can be deleted.");
        return;
      }
      const row = data[0];
      if (row.eligible) {
        setPhase("eligible");
      } else {
        setPhase("ineligible");
        setReason(row.reason ?? "This agent has research history and can't be deleted.");
      }
    });
  }, [agent.id]);

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError("");
    const response = await fetch("/api/agents/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: agent.id }),
    });
    const result = (await response.json().catch(() => ({ ok: false, errorReason: "Unexpected response." }))) as
      | { ok: true }
      | { ok: false; errorReason: string };
    setDeleting(false);
    if (!result.ok) {
      if (result.errorReason.includes("cannot be permanently deleted")) {
        setPhase("ineligible");
        setReason(result.errorReason);
        return;
      }
      setDeleteError(result.errorReason);
      return;
    }
    toast(agent.name + " deleted");
    close();
  }

  if (phase === "checking") {
    return (
      <Modal open close={close} title="Delete Agent?">
        <p className="xs">Checking this agent for research history…</p>
      </Modal>
    );
  }
  if (phase === "error") {
    return (
      <Modal open close={close} title="Delete Agent?" foot={<Btn onClick={close}>Close</Btn>}>
        <Note tone="r">{reason}</Note>
      </Modal>
    );
  }
  if (phase === "ineligible") {
    return (
      <Modal
        open
        close={close}
        title="Can't delete this Agent"
        foot={
          <>
            <Btn onClick={close}>Close</Btn>
            {agent.status === "active" && (
              <Btn k="r" onClick={() => onDeactivateInstead(agent)}>
                Deactivate Agent
              </Btn>
            )}
          </>
        }
      >
        <p style={{ marginTop: 0 }}>This Agent has research history and cannot be permanently deleted. Deactivate them instead — their call history and notes stay on record.</p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      close={close}
      title="Delete Agent?"
      foot={
        <>
          <Btn onClick={close}>Cancel</Btn>
          <Btn k="r" disabled={typed.trim() !== agent.name || deleting} onClick={confirmDelete}>
            {deleting ? "Deleting..." : "Delete Agent"}
          </Btn>
        </>
      }
    >
      {deleteError ? (
        <div style={{ marginBottom: 12 }}>
          <Note tone="r">{deleteError}</Note>
        </div>
      ) : null}
      <p style={{ marginTop: 0 }}>
        You&apos;re about to permanently remove <b>{agent.name}</b> from the organisation.
      </p>
      <p className="xs">This should only be used for Agents created by mistake who have no research history.</p>
      <Field l={"Type " + agent.name + " to confirm"}>
        <input type="text" value={typed} onChange={(e) => setTyped(e.target.value)} />
      </Field>
    </Modal>
  );
}
