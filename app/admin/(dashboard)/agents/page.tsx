"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAdminData } from "@/lib/hooks/useAdminData";
import { buildAgentRows, type AgentRow } from "./agent-rows";
import { Btn, Chip, Kpi, Table, Card, Empty, Menu, Toast, useToast, type MenuItemSpec } from "@/components/ros/ros-ui";
import { InfoModal } from "./_components/InfoModal";
import { InviteAgentModal } from "./_components/InviteAgentModal";
import { ManageAgentModal } from "./_components/ManageAgentModal";
import { RemoveFromCampaignModal, type RemoveCtx } from "./_components/RemoveFromCampaignModal";
import { DeactivateFlowModal } from "./_components/DeactivateFlowModal";
import { ReactivateModal } from "./_components/ReactivateModal";
import { DeleteAgentModal } from "./_components/DeleteAgentModal";
import { Modal } from "@/components/ros/ros-ui";
import type { AgentProfile, AgentInvitation } from "@/lib/types";
import { LoadingScreen, ErrorState } from "@/components/ui/States";

const INVITE_LABEL: Record<string, string> = { Pending: "Pending invite", Expired: "Invite expired", Revoked: "Invite revoked" };
const INVITE_TONE: Record<string, "w" | "q" | "r"> = { Pending: "w", Expired: "q", Revoked: "r" };

export default function AgentsPage() {
  const { data: db, loading, error, refetch } = useAdminData();
  const [msg, toast] = useToast();

  const [invite, setInvite] = useState(false);
  const [manage, setManage] = useState<AgentProfile | null>(null);
  const [info, setInfo] = useState<AgentRow | null>(null);
  const [revoke, setRevoke] = useState<AgentInvitation | null>(null);
  const [delInv, setDelInv] = useState<AgentInvitation | null>(null);
  const [removeCtx, setRemoveCtx] = useState<RemoveCtx | null>(null);
  const [deactivate, setDeactivate] = useState<AgentProfile | null>(null);
  const [reactivate, setReactivate] = useState<AgentProfile | null>(null);
  const [delAgent, setDelAgent] = useState<AgentProfile | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading || !db) return <LoadingScreen label="Loading agents..." />;
  if (error) return <ErrorState title="Couldn't load agents" description={error} />;

  const rows = buildAgentRows(db);
  const active = db.agents.filter((a) => a.status === "active").length;
  const pending = db.agentInvitations.filter((i) => i.status === "pending").length;
  const inactive = db.agents.filter((a) => a.status === "inactive").length;

  async function resendInvitation(invitation: AgentInvitation) {
    setBusy(true);
    const response = await fetch("/api/agents/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId: invitation.id }),
    });
    const result = (await response.json().catch(() => ({ ok: false, errorReason: "Unexpected response." }))) as
      | { ok: true }
      | { ok: false; errorReason: string };
    setBusy(false);
    if (!result.ok) {
      toast(result.errorReason);
      return;
    }
    await refetch();
    toast("Invitation resent");
  }

  function menuFor(row: AgentRow): (MenuItemSpec | false)[] {
    if (row.kind === "invite") {
      const invitation = row.invitation;
      if (!invitation) return [];
      if (row.status === "Pending") {
        return [
          { label: "View invite", onClick: () => setInfo(row) },
          { label: "Resend invitation", onClick: () => resendInvitation(invitation) },
          { sep: true },
          { label: "Revoke invitation", tone: "r", onClick: () => setRevoke(invitation) },
        ];
      }
      if (row.status === "Expired") {
        return [
          { label: "View invite", onClick: () => setInfo(row) },
          { label: "Send new invitation", onClick: () => resendInvitation(invitation) },
          { sep: true },
          { label: "Delete invitation", tone: "r", onClick: () => setDelInv(invitation) },
        ];
      }
      return [{ label: "Delete invitation", tone: "r", onClick: () => setDelInv(invitation) }]; // Revoked
    }
    if (!row.agent) return [];
    if (row.status === "Active") {
      return [
        { label: "View Agent", onClick: () => setInfo(row) },
        { label: "Manage access", onClick: () => setManage(row.agent!) },
        { sep: true },
        { label: "Deactivate Agent", tone: "r", onClick: () => setDeactivate(row.agent!) },
      ];
    }
    return [
      { label: "View Agent", onClick: () => setInfo(row) },
      { label: "Reactivate Agent", onClick: () => setReactivate(row.agent!) },
      { sep: true },
      { label: "Delete Agent", tone: "r", onClick: () => setDelAgent(row.agent!) },
    ];
  }

  async function handleRevoke() {
    if (!revoke) return;
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_revoke_invitation", { p_invitation_id: revoke.id });
    if (rpcError) {
      toast(rpcError.message);
      setRevoke(null);
      return;
    }
    await refetch();
    toast("Invitation revoked");
    setRevoke(null);
  }

  async function handleDeleteInvitation() {
    if (!delInv) return;
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_delete_invitation", { p_invitation_id: delInv.id });
    if (rpcError) {
      toast(rpcError.message);
      setDelInv(null);
      return;
    }
    await refetch();
    toast("Invitation deleted");
    setDelInv(null);
  }

  return (
    <div className="ros-root">
      <div className="page">
        <div className="spread" style={{ marginBottom: 16, alignItems: "flex-start" }}>
          <p className="sm mut" style={{ maxWidth: 480, margin: 0 }}>
            Invite and manage interviewers who conduct calls for your campaigns.
          </p>
          <Btn k="p" icon="plus" onClick={() => setInvite(true)}>
            Invite Agent
          </Btn>
        </div>

        {!rows.length ? (
          <Card>
            <Empty head="No Agents yet" action={<Btn k="p" icon="plus" onClick={() => setInvite(true)}>Invite your first Agent</Btn>}>
              Invite an interviewer to start assigning participant calls.
            </Empty>
          </Card>
        ) : (
          <>
            <div className="grid g3 sec">
              <Kpi l="Active agents" v={active} />
              <Kpi l="Pending invites" v={pending} d={pending ? "Awaiting acceptance" : "None outstanding"} />
              <Kpi l="Inactive agents" v={inactive} />
            </div>
            <Table
              scroll
              head={["Agent", "Status", "Assigned campaigns", { l: "Daily target", num: true }, { l: "Calls today", num: true }, "Last active", ""]}
            >
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>
                    <div className="row" style={{ gap: 9 }}>
                      <span className="av" style={{ width: 26, height: 26, fontSize: 10.4 }}>
                        {r.initials}
                      </span>
                      <div>
                        <div className="prim" style={{ fontWeight: 600 }}>
                          {r.name}
                        </div>
                        <div className="xs">{r.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Chip dot tone={r.kind === "invite" ? INVITE_TONE[r.status] : r.status === "Active" ? "g" : "q"}>
                      {r.kind === "invite" ? INVITE_LABEL[r.status] : r.status === "Deactivated" ? "Inactive" : r.status}
                    </Chip>
                  </td>
                  <td className="dim">{r.campaignNames.length ? r.campaignNames.join(", ") : <span className="xs">None yet</span>}</td>
                  <td className="num mono">{r.target || <span className="xs">—</span>}</td>
                  <td className="num mono">{r.today != null ? r.today : <span className="xs">—</span>}</td>
                  <td className="dim xs" style={{ whiteSpace: "nowrap" }}>
                    {r.last}
                  </td>
                  <td className="act" style={{ textAlign: "right" }}>
                    <Menu items={menuFor(r)} />
                  </td>
                </tr>
              ))}
            </Table>
          </>
        )}

        <InviteAgentModal open={invite} close={() => setInvite(false)} db={db} toast={toast} />
        <InfoModal row={info} close={() => setInfo(null)} />
        <ManageAgentModal
          agent={manage}
          db={db}
          close={() => setManage(null)}
          toast={toast}
          onRemoveCampaign={(a, k) => setRemoveCtx({ agent: a, campaignId: k })}
          onDeactivate={(a) => {
            setManage(null);
            setDeactivate(a);
          }}
          onDelete={(a) => {
            setManage(null);
            setDelAgent(a);
          }}
        />
        <RemoveFromCampaignModal
          ctx={removeCtx}
          db={db}
          close={() => setRemoveCtx(null)}
          toast={(m) => {
            refetch();
            toast(m);
          }}
        />
        <DeactivateFlowModal
          agent={deactivate}
          db={db}
          close={() => setDeactivate(null)}
          toast={(m) => {
            refetch();
            toast(m);
          }}
        />
        <ReactivateModal
          agent={reactivate}
          db={db}
          close={() => setReactivate(null)}
          toast={(m) => {
            refetch();
            toast(m);
          }}
        />
        <DeleteAgentModal
          agent={delAgent}
          close={() => setDelAgent(null)}
          toast={(m) => {
            refetch();
            toast(m);
          }}
          onDeactivateInstead={(a) => {
            setDelAgent(null);
            setDeactivate(a);
          }}
        />

        <Modal
          open={!!revoke}
          close={() => setRevoke(null)}
          title="Revoke invitation?"
          foot={
            <>
              <Btn onClick={() => setRevoke(null)}>Cancel</Btn>
              <Btn k="r" disabled={busy} onClick={handleRevoke}>
                Revoke invitation
              </Btn>
            </>
          }
        >
          {revoke && <p style={{ margin: 0 }}>{revoke.email.split("@")[0]} will no longer be able to use this invitation to join your team.</p>}
        </Modal>
        <Modal
          open={!!delInv}
          close={() => setDelInv(null)}
          title="Delete invitation?"
          foot={
            <>
              <Btn onClick={() => setDelInv(null)}>Cancel</Btn>
              <Btn k="r" disabled={busy} onClick={handleDeleteInvitation}>
                Delete invitation
              </Btn>
            </>
          }
        >
          <p style={{ margin: 0 }}>Removes this invitation from the list. This cannot be undone.</p>
        </Modal>

        <Toast msg={msg} />
      </div>
    </div>
  );
}
