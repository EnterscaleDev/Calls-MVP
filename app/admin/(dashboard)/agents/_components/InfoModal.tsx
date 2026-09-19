"use client";

import { Modal, Chip, Btn } from "@/components/ros/ros-ui";
import type { AgentRow } from "../agent-rows";

const INVITE_LABEL: Record<string, string> = { Pending: "Pending invite", Expired: "Invite expired", Revoked: "Invite revoked" };
const INVITE_TONE: Record<string, "w" | "q" | "r"> = { Pending: "w", Expired: "q", Revoked: "r" };

export function InfoModal({ row, close }: { row: AgentRow | null; close: () => void }) {
  return (
    <Modal open={!!row} close={close} title={row ? row.name : ""} foot={<Btn onClick={close}>Close</Btn>}>
      {row && (
        <dl className="kv">
          <dt>Email</dt>
          <dd>{row.email}</dd>
          <dt>Status</dt>
          <dd>
            <Chip dot tone={row.kind === "invite" ? INVITE_TONE[row.status] : row.status === "Active" ? "g" : "q"}>
              {row.kind === "invite" ? INVITE_LABEL[row.status] : row.status === "Deactivated" ? "Inactive" : row.status}
            </Chip>
          </dd>
          <dt>Campaigns</dt>
          <dd>{row.campaignNames.length ? row.campaignNames.join(", ") : "None yet"}</dd>
          <dt>Daily target</dt>
          <dd>{row.target || "—"}</dd>
          {row.kind === "agent" && (
            <>
              <dt>Completed this week</dt>
              <dd>{row.completedThisWeek} attempts</dd>
            </>
          )}
          <dt>{row.kind === "invite" ? "Invited" : "Last active"}</dt>
          <dd>{row.last}</dd>
        </dl>
      )}
    </Modal>
  );
}
