"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAdminData } from "@/lib/hooks/useAdminData";
import { mapAgentPageRow, type AgentRow, type RowStatus } from "./agent-rows";
import { Btn, Chip, Kpi, Table, Card, Empty, Menu, Toast, useToast, Search, Sel, Pager, type MenuItemSpec } from "@/components/ros/ros-ui";
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

function latestInvitationFor(agentInvitations: AgentInvitation[], agentId: string): AgentInvitation | undefined {
  return [...agentInvitations].filter((i) => i.agentProfileId === agentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/**
 * Agents/People list — server-paginated via admin_list_agents_page(),
 * which does the search/status filtering and every row's aggregates
 * (campaign names, daily target, today's/this-week's call counts, last
 * active) in SQL, returning only the current page plus a total count.
 * useAdminData() is still loaded here too, but only to resolve full
 * AgentProfile/AgentInvitation objects for the action modals below — those
 * need real entity objects, not row-shaped summaries, and agent_profiles/
 * user_invitations are small, bounded tables (unlike audit_events or
 * call_attempts), so keeping them in the existing org-wide fetch is fine.
 */
export default function AgentsPage() {
  const { data: db, loading, error, refetch } = useAdminData();
  const [msg, toast] = useToast();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RowStatus>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState({ active: 0, pending: 0, inactive: 0 });
  const [rowsLoading, setRowsLoading] = useState(true);
  const [rowsError, setRowsError] = useState<string | null>(null);

  const [invite, setInvite] = useState(false);
  const [manage, setManage] = useState<AgentProfile | null>(null);
  const [info, setInfo] = useState<AgentRow | null>(null);
  const [revoke, setRevoke] = useState<AgentInvitation | null>(null);
  const [removeCtx, setRemoveCtx] = useState<RemoveCtx | null>(null);
  const [deactivate, setDeactivate] = useState<AgentProfile | null>(null);
  const [reactivate, setReactivate] = useState<AgentProfile | null>(null);
  const [delAgent, setDelAgent] = useState<AgentProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [rowsVersion, setRowsVersion] = useState(0);

  // Debounces the visible input into the value the fetch effect actually
  // depends on, so rapid typing doesn't fire an RPC call per keystroke —
  // setState happens inside the timeout callback, not synchronously in the
  // effect body, so this doesn't trip the set-state-in-effect rule either.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any other filter/page-size change resets to page 1 — done directly in
  // these setters rather than a reactive effect.
  function updateStatusFilter(v: "all" | RowStatus) {
    setStatusFilter(v);
    setPage(1);
  }
  function updatePageSize(v: number) {
    setPageSize(v);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const from = (page - 1) * pageSize;
    supabase
      .rpc("admin_list_agents_page", {
        p_search: search.trim() || undefined,
        p_status: statusFilter === "all" ? undefined : statusFilter,
        p_limit: pageSize,
        p_offset: from,
      })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return;
        setRowsLoading(false);
        if (rpcError) {
          setRowsError(rpcError.message);
          return;
        }
        setRows((data ?? []).map(mapAgentPageRow));
        setTotalCount(data?.[0]?.total_count ? Number(data[0].total_count) : 0);
      });
    return () => {
      cancelled = true;
    };
  }, [search, statusFilter, page, pageSize, rowsVersion]);

  // KPIs reflect the whole org, not just the current page — three cheap
  // limit=1 calls to the same RPC, one per status bucket, reusing its
  // total_count rather than duplicating the aggregation logic client-side.
  useEffect(() => {
    const supabase = createClient();
    Promise.all(
      (["Active", "Pending", "Deactivated"] as const).map((status) =>
        supabase
          .rpc("admin_list_agents_page", { p_status: status, p_limit: 1, p_offset: 0 })
          .then(({ data }) => (data?.[0]?.total_count ? Number(data[0].total_count) : 0))
      )
    ).then(([active, pending, inactive]) => setKpis({ active, pending, inactive }));
  }, [rowsVersion]);

  async function refetchRows() {
    setRowsVersion((v) => v + 1);
  }

  if (loading || !db) return <LoadingScreen label="Loading agents..." />;
  if (error) return <ErrorState title="Couldn't load agents" description={error} />;
  if (rowsError) return <ErrorState title="Couldn't load agents" description={rowsError} />;

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
    await Promise.all([refetch(), refetchRows()]);
    toast("Invitation resent");
  }

  function menuFor(row: AgentRow): (MenuItemSpec | false)[] {
    if (row.kind === "invite") {
      const agent = db!.agents.find((a) => a.id === row.agentId);
      const invitation = latestInvitationFor(db!.agentInvitations, row.agentId);
      // Deleting an invitation record never accepts leaves the underlying
      // agent_profiles row behind — the only real removal is deleting the
      // whole Agent (admin_delete_agent takes any lingering invitation rows
      // with it too). Also the sole recovery path once an invitation has
      // already been deleted and this row has nothing left to act on.
      const deleteItem: MenuItemSpec | false = agent
        ? { label: "Delete Agent", tone: "r", onClick: () => setDelAgent(agent) }
        : false;
      if (!invitation) return [deleteItem];
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
          deleteItem,
        ];
      }
      return [deleteItem]; // Revoked
    }
    const agent = db!.agents.find((a) => a.id === row.agentId);
    if (!agent) return [];
    if (row.status === "Active") {
      return [
        { label: "View Agent", onClick: () => setInfo(row) },
        { label: "Manage access", onClick: () => setManage(agent) },
        { sep: true },
        { label: "Deactivate Agent", tone: "r", onClick: () => setDeactivate(agent) },
      ];
    }
    return [
      { label: "View Agent", onClick: () => setInfo(row) },
      { label: "Reactivate Agent", onClick: () => setReactivate(agent) },
      { sep: true },
      { label: "Delete Agent", tone: "r", onClick: () => setDelAgent(agent) },
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
    await Promise.all([refetch(), refetchRows()]);
    toast("Invitation revoked");
    setRevoke(null);
  }

  const hasAnyAgents = totalCount > 0 || search.trim() || statusFilter !== "all";

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

        {!hasAnyAgents ? (
          <Card>
            <Empty head="No Agents yet" action={<Btn k="p" icon="plus" onClick={() => setInvite(true)}>Invite your first Agent</Btn>}>
              Invite an interviewer to start assigning participant calls.
            </Empty>
          </Card>
        ) : (
          <>
            <div className="grid g3 sec">
              <Kpi l="Active agents" v={kpis.active} />
              <Kpi l="Pending invites" v={kpis.pending} d={kpis.pending ? "Awaiting acceptance" : "None outstanding"} />
              <Kpi l="Inactive agents" v={kpis.inactive} />
            </div>

            <div className="row wrap" style={{ gap: 8, marginBottom: 14 }}>
              <Search v={searchInput} set={setSearchInput} ph="Search name or email" />
              <Sel
                v={statusFilter}
                set={(v) => updateStatusFilter(v as "all" | RowStatus)}
                all="Any status"
                opts={["Active", "Pending", "Expired", "Deactivated", "Revoked"]}
              />
            </div>

            {rows.length === 0 && !rowsLoading ? (
              <Card>
                <Empty head="No matches">Try a different search or status filter.</Empty>
              </Card>
            ) : (
              <Table
                scroll
                head={["Agent", "Status", "Assigned campaigns", { l: "Daily target", num: true }, { l: "Calls today", num: true }, "Last active", ""]}
              >
                {rows.map((r) => (
                  <tr key={r.agentId}>
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
                    <td className="num mono">{r.today}</td>
                    <td className="dim xs" style={{ whiteSpace: "nowrap" }}>
                      {r.last}
                    </td>
                    <td className="act" style={{ textAlign: "right" }}>
                      <Menu items={menuFor(r)} />
                    </td>
                  </tr>
                ))}
              </Table>
            )}
            {rows.length > 0 ? (
              <div className="card" style={{ marginTop: -1, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                <Pager page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} onPageSizeChange={updatePageSize} />
              </div>
            ) : null}
          </>
        )}

        <InviteAgentModal
          open={invite}
          close={() => setInvite(false)}
          db={db}
          toast={(m) => {
            toast(m);
            refetch();
            refetchRows();
          }}
        />
        <InfoModal row={info} close={() => setInfo(null)} />
        <ManageAgentModal
          agent={manage}
          db={db}
          close={() => setManage(null)}
          toast={(m) => {
            toast(m);
            refetchRows();
          }}
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
            refetchRows();
            toast(m);
          }}
        />
        <DeactivateFlowModal
          agent={deactivate}
          db={db}
          close={() => setDeactivate(null)}
          toast={(m) => {
            refetch();
            refetchRows();
            toast(m);
          }}
        />
        <ReactivateModal
          agent={reactivate}
          db={db}
          close={() => setReactivate(null)}
          toast={(m) => {
            refetch();
            refetchRows();
            toast(m);
          }}
        />
        <DeleteAgentModal
          agent={delAgent}
          close={() => setDelAgent(null)}
          toast={(m) => {
            refetch();
            refetchRows();
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

        <Toast msg={msg} />
      </div>
    </div>
  );
}
