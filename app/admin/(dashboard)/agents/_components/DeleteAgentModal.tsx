"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { InlineBanner } from "@/components/ui/States";
import type { AgentProfile } from "@/lib/types";

type Phase = "checking" | "eligible" | "ineligible" | "error";

/**
 * "Delete Agent" — never the normal way to remove a former Agent (that's
 * Remove from campaign / Deactivate). Only reachable when the agent has no
 * research history at all, re-checked server-side regardless of what the
 * eligibility pre-check said. Mirrors DeleteCampaignModal exactly.
 */
export function DeleteAgentModal({
  agent,
  onClose,
  onDeleted,
  onDeactivateInstead,
}: {
  agent: AgentProfile | null;
  onClose: () => void;
  onDeleted: () => void;
  onDeactivateInstead: (agent: AgentProfile) => void;
}) {
  if (!agent) return null;
  return (
    <DeleteAgentModalInner key={agent.id} agent={agent} onClose={onClose} onDeleted={onDeleted} onDeactivateInstead={onDeactivateInstead} />
  );
}

function DeleteAgentModalInner({
  agent,
  onClose,
  onDeleted,
  onDeactivateInstead,
}: {
  agent: AgentProfile;
  onClose: () => void;
  onDeleted: () => void;
  onDeactivateInstead: (agent: AgentProfile) => void;
}) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .rpc("admin_agent_delete_eligibility", { p_agent_id: agent.id })
      .then(({ data, error }) => {
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

  async function handleConfirmDelete() {
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
    onDeleted();
  }

  if (phase === "checking") {
    return (
      <Modal open onClose={onClose} title="Delete Agent?" description="Checking this agent for research history...">
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
      <Modal open onClose={onClose} title="Delete Agent?">
        <InlineBanner kind="danger">{reason}</InlineBanner>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </Modal>
    );
  }

  if (phase === "ineligible") {
    return (
      <Modal open onClose={onClose} title="Delete Agent?">
        <div className="flex flex-col gap-4">
          <InlineBanner kind="warning">{reason}</InlineBanner>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onDeactivateInstead(agent);
                onClose();
              }}
            >
              Deactivate Agent
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={() => (deleting ? undefined : onClose())}
      title="Delete Agent?"
      description={`You're about to permanently remove ${agent.name} from the organisation.`}
    >
      <div className="flex flex-col gap-4">
        {deleteError ? <InlineBanner kind="danger">{deleteError}</InlineBanner> : null}
        <p className="text-xs text-foreground-subtle">
          This should only be used for Agents created by mistake who have no research history.
        </p>
        <Field label={`Type "${agent.name}" to confirm`}>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" disabled={deleting} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={deleting || confirmText !== agent.name} onClick={handleConfirmDelete}>
            {deleting ? "Deleting..." : "Delete Agent"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
