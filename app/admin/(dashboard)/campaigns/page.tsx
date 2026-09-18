"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAdminData } from "@/lib/hooks/useAdminData";
import { getCampaignFunnel, getCampaignMetrics } from "@/lib/selectors";
import { LoadingScreen, EmptyState, ErrorState, InlineBanner } from "@/components/ui/States";
import { Card, CardBody } from "@/components/ui/Card";
import { CampaignStatusBadge, CampaignTypeChip } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { OverflowMenu, type MenuAction } from "@/components/ui/Menu";
import { ProgressBar } from "@/components/ui/Progress";
import { formatDate, formatPercent } from "../_lib/format";
import { DeleteCampaignModal } from "./_components/DeleteCampaignModal";
import type { Campaign, CampaignStatus } from "@/lib/types";

interface ActionError {
  campaignName: string;
  message: string;
}

interface Toast {
  message: string;
  href?: string;
  hrefLabel?: string;
}

export default function CampaignsListPage() {
  const router = useRouter();
  const { data: db, loading, error, refetch } = useAdminData();
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | CampaignStatus>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [completeTarget, setCompleteTarget] = useState<Campaign | null>(null);
  const [completing, setCompleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);

  if (loading || !db) return <LoadingScreen label="Loading campaigns..." />;
  if (error) return <ErrorState title="Couldn't load campaigns" description={error} />;

  const clients = [...new Set(db.campaigns.map((c) => c.clientName))].sort();

  // "Any status" is the default, focused-on-current-work view — archived
  // campaigns only show up once the Admin explicitly picks the Archived
  // filter, per the campaign-actions spec ("Archived campaigns should
  // disappear from the default campaign list").
  const campaigns = [...db.campaigns]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .filter((c) => {
      const matchesSearch =
        !search.trim() ||
        c.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        c.clientName.toLowerCase().includes(search.trim().toLowerCase());
      const matchesClient = clientFilter === "all" || c.clientName === clientFilter;
      const matchesStatus =
        statusFilter === "all" ? c.status !== "archived" : c.status === statusFilter;
      return matchesSearch && matchesClient && matchesStatus;
    });

  function showToast(t: Toast) {
    setToast(t);
    window.setTimeout(() => setToast((current) => (current === t ? null : current)), 8000);
  }

  async function handleDuplicate(campaign: Campaign) {
    setPendingId(campaign.id);
    setActionError(null);
    const supabase = createClient();
    const { data: newId, error: rpcError } = await supabase.rpc("admin_duplicate_campaign", {
      p_campaign_id: campaign.id,
    });
    setPendingId(null);
    if (rpcError || !newId) {
      setActionError({
        campaignName: campaign.name,
        message: rpcError?.message ?? "Something went wrong duplicating this campaign.",
      });
      return;
    }
    await refetch();
    showToast({ message: "Campaign duplicated", href: `/admin/campaigns/${newId}/edit`, hrefLabel: "Edit new draft" });
  }

  async function handleActivate(campaign: Campaign) {
    setPendingId(campaign.id);
    setActionError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_activate_campaign", {
      p_campaign_id: campaign.id,
    });
    setPendingId(null);
    if (rpcError) {
      setActionError({ campaignName: campaign.name, message: rpcError.message });
      return;
    }
    await refetch();
    showToast({ message: "Campaign activated." });
  }

  async function handleSetStatus(campaign: Campaign, status: CampaignStatus, successMessage: string) {
    setPendingId(campaign.id);
    setActionError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_update_campaign_status", {
      p_campaign_id: campaign.id,
      p_status: status,
    });
    setPendingId(null);
    if (rpcError) {
      setActionError({ campaignName: campaign.name, message: rpcError.message });
      return;
    }
    await refetch();
    showToast({ message: successMessage });
  }

  async function handleRestore(campaign: Campaign) {
    setPendingId(campaign.id);
    setActionError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_restore_campaign", {
      p_campaign_id: campaign.id,
    });
    setPendingId(null);
    if (rpcError) {
      setActionError({ campaignName: campaign.name, message: rpcError.message });
      return;
    }
    await refetch();
    showToast({ message: "Campaign restored." });
  }

  async function handleConfirmComplete() {
    if (!completeTarget) return;
    setCompleting(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_update_campaign_status", {
      p_campaign_id: completeTarget.id,
      p_status: "completed",
    });
    setCompleting(false);
    if (rpcError) {
      setActionError({ campaignName: completeTarget.name, message: rpcError.message });
      setCompleteTarget(null);
      return;
    }
    setCompleteTarget(null);
    await refetch();
    showToast({ message: "Campaign marked as completed." });
  }

  function actionsFor(campaign: Campaign): MenuAction[] {
    const busy = pendingId === campaign.id;
    const status = campaign.status;

    // Group 1: always-available, non-destructive navigation.
    const primary: MenuAction[] = [
      { key: "view", label: "View campaign", onSelect: () => router.push(`/admin/campaigns/${campaign.id}`) },
    ];
    // Edit isn't offered once a campaign is Completed or Archived — those
    // are closed-out states; config changes belong to campaigns still being
    // set up or run.
    if (status === "draft" || status === "ready" || status === "active" || status === "paused") {
      primary.push({ key: "edit", label: "Edit campaign", onSelect: () => router.push(`/admin/campaigns/${campaign.id}/edit`) });
    }
    primary.push({
      key: "duplicate",
      label: "Duplicate",
      hint: "Creates a new Draft — no contacts or history copied",
      disabled: busy,
      onSelect: () => handleDuplicate(campaign),
    });

    // Group 2: lifecycle transitions.
    const lifecycle: MenuAction[] = [];
    if (status === "draft" || status === "ready") {
      lifecycle.push({ key: "activate", label: "Activate campaign", disabled: busy, onSelect: () => handleActivate(campaign) });
    }
    if (status === "active") {
      lifecycle.push({
        key: "pause",
        label: "Pause campaign",
        disabled: busy,
        onSelect: () => handleSetStatus(campaign, "paused", "Campaign paused."),
      });
      lifecycle.push({ key: "complete", label: "Mark as completed", disabled: busy, onSelect: () => setCompleteTarget(campaign) });
    }
    if (status === "paused") {
      lifecycle.push({
        key: "resume",
        label: "Resume campaign",
        disabled: busy,
        onSelect: () => handleSetStatus(campaign, "active", "Campaign resumed."),
      });
      lifecycle.push({ key: "complete", label: "Mark as completed", disabled: busy, onSelect: () => setCompleteTarget(campaign) });
    }
    if (status !== "archived") {
      lifecycle.push({
        key: "archive",
        label: "Archive campaign",
        disabled: busy,
        onSelect: () => handleSetStatus(campaign, "archived", "Campaign archived."),
      });
    }
    if (status === "archived") {
      lifecycle.push({ key: "restore", label: "Restore campaign", disabled: busy, onSelect: () => handleRestore(campaign) });
    }
    if (lifecycle.length > 0) lifecycle[0].dividerBefore = true;

    // Group 3: destructive, always last, visually separated. Not offered
    // for Archived — once archived, Restore/Duplicate/View is the full set.
    const destructive: MenuAction[] =
      status === "archived"
        ? []
        : [
            {
              key: "delete",
              label: "Delete campaign",
              variant: "danger",
              dividerBefore: true,
              disabled: busy,
              onSelect: () => setDeleteTarget(campaign),
            },
          ];

    return [...primary, ...lifecycle, ...destructive];
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-caps text-foreground-subtle">All clients</p>
          <h1 className="text-page-title">Campaigns</h1>
        </div>
        <ButtonLink href="/admin/campaigns/new">New campaign</ButtonLink>
      </div>

      {actionError ? (
        <InlineBanner kind="danger">
          <div className="flex items-start justify-between gap-3">
            <span>
              <strong>{actionError.campaignName}:</strong> {actionError.message}
            </span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="shrink-0 text-xs font-semibold text-danger hover:underline"
            >
              Dismiss
            </button>
          </div>
        </InlineBanner>
      ) : null}

      {db.campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create your first campaign to start recruiting participants."
          action={<ButtonLink href="/admin/campaigns/new">New campaign</ButtonLink>}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search campaigns"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="w-44">
              <option value="all">All clients</option>
              {clients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | CampaignStatus)}
              className="w-40"
            >
              <option value="all">Any status</option>
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </Select>
          </div>

          <Card>
            <CardBody className="p-0">
              {campaigns.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No matches" description="Try a different search or filter." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-subtle">
                        <th className="px-5 py-3 font-medium">Campaign</th>
                        <th className="px-5 py-3 font-medium">Type</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 font-medium">Dates</th>
                        <th className="px-5 py-3 font-medium">Contacts</th>
                        <th className="px-5 py-3 font-medium">Completed</th>
                        <th className="px-5 py-3 font-medium">Progress</th>
                        <th className="px-5 py-3 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((campaign) => {
                        const funnel = getCampaignFunnel(db, campaign.id);
                        const metrics = getCampaignMetrics(db, campaign.id);
                        const engagedRate = funnel.contacts > 0 ? funnel.optedIn / funnel.contacts : 0;
                        return (
                          <tr key={campaign.id} className="border-b border-border last:border-0 align-top">
                            <td className="max-w-[240px] px-5 py-3">
                              <Link
                                href={`/admin/campaigns/${campaign.id}`}
                                className="font-medium text-foreground hover:text-primary hover:underline"
                              >
                                {campaign.name}
                              </Link>
                              <p className="mt-0.5 truncate text-xs text-foreground-muted">
                                {campaign.clientName}
                              </p>
                              {campaign.incentiveTitle ? (
                                <p className="mt-0.5 truncate text-xs text-foreground-subtle">
                                  {campaign.incentiveTitle}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-5 py-3">
                              <CampaignTypeChip>Interview</CampaignTypeChip>
                            </td>
                            <td className="px-5 py-3">
                              <CampaignStatusBadge status={campaign.status} />
                            </td>
                            <td className="px-5 py-3 text-xs text-foreground-muted">
                              <p>{formatDate(campaign.startDate)}</p>
                              <p>{formatDate(campaign.endDate)}</p>
                            </td>
                            <td className="px-5 py-3 tabular-nums text-foreground-muted">
                              {funnel.contacts}
                              <p className="text-xs text-foreground-subtle">
                                {formatPercent(engagedRate)} opted in
                              </p>
                            </td>
                            <td className="px-5 py-3 tabular-nums text-foreground-muted">
                              {funnel.completed}
                            </td>
                            <td className="px-5 py-3">
                              <div className="w-28">
                                <ProgressBar value={metrics.completionRate} />
                                <p className="mt-1 text-xs text-foreground-subtle">
                                  {formatPercent(metrics.completionRate)} of {campaign.targetCompletions}
                                </p>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <OverflowMenu actions={actionsFor(campaign)} ariaLabel={`Actions for ${campaign.name}`} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      <Modal
        open={completeTarget !== null}
        onClose={() => (completing ? undefined : setCompleteTarget(null))}
        title="Mark this campaign as completed?"
        description="Existing campaign data will remain available, but the campaign will no longer be treated as active."
      >
        <div className="flex justify-end gap-3">
          <Button variant="secondary" disabled={completing} onClick={() => setCompleteTarget(null)}>
            Cancel
          </Button>
          <Button disabled={completing} onClick={handleConfirmComplete}>
            {completing ? "Marking..." : "Mark as completed"}
          </Button>
        </div>
      </Modal>

      <DeleteCampaignModal
        campaign={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null);
          refetch();
          showToast({ message: "Campaign deleted." });
        }}
        onArchiveInstead={(c) => handleSetStatus(c, "archived", "Campaign archived.")}
      />

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-[6px] border border-success/20 bg-success-soft px-4 py-3 text-sm text-success shadow-lg">
          <span className="font-medium">{toast.message}</span>
          {toast.href ? (
            <Link href={toast.href} className="font-semibold underline underline-offset-2">
              {toast.hrefLabel ?? "Open"} →
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="text-success/70 hover:text-success"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
