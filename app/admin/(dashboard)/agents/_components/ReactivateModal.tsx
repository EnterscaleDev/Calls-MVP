"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminData } from "@/lib/hooks/useAdminData";
import { Modal, Btn, Note } from "@/components/ros/ros-ui";
import type { AgentProfile } from "@/lib/types";

export function ReactivateModal({
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
  const [submitting, setSubmitting] = useState(false);

  async function reactivate() {
    if (!agent) return;
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_reactivate_agent", { p_agent_id: agent.id });
    setSubmitting(false);
    if (error) return;
    toast(agent.name.split(" ")[0] + " reactivated");
    close();
  }

  const formerCampaignNames = agent
    ? db.campaignAgents
        .filter((ca) => ca.agentId === agent.id && !ca.active)
        .map((ca) => db.campaigns.find((c) => c.id === ca.campaignId)?.name)
        .filter((n): n is string => !!n)
    : [];

  return (
    <Modal
      open={!!agent}
      close={close}
      title="Reactivate Agent"
      foot={
        <>
          <Btn onClick={close}>Cancel</Btn>
          <Btn k="p" disabled={submitting} onClick={reactivate}>
            Reactivate Agent
          </Btn>
        </>
      }
    >
      {agent && (
        <>
          <p style={{ marginTop: 0 }}>Restores {agent.name.split(" ")[0]}&apos;s access to the platform.</p>
          <Note tone="i">
            {formerCampaignNames.length
              ? "Previously on " + formerCampaignNames.join(", ") + " — campaigns are not restored automatically. Use Manage access to assign them again."
              : "No campaigns are assigned yet. Use Manage access to add them."}
          </Note>
        </>
      )}
    </Modal>
  );
}
