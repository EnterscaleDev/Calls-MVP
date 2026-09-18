"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAdminData } from "@/lib/hooks/useAdminData";
import { getAuditLog } from "@/lib/selectors";
import { SENSITIVE_ACTIONS, ACCESS_ACTIONS, describeAction } from "@/lib/audit-labels";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Form";
import { CampaignStatusBadge, Badge } from "@/components/ui/Badge";
import { EmptyState, LoadingScreen, ErrorState, InlineBanner } from "@/components/ui/States";
import { formatDateTime } from "../../../_lib/format";
import { useCampaignDetail } from "../campaign-context";
import { DeleteCampaignModal } from "../../_components/DeleteCampaignModal";
import type { Campaign, CampaignStatus } from "@/lib/types";

export default function CampaignSettingsPage() {
  const router = useRouter();
  const campaign = useCampaignDetail();
  const { data: db, loading, error, refetch } = useAdminData();
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [statusError, setStatusError] = useState("");

  if (loading || !db) return <LoadingScreen label="Loading settings..." />;
  if (error) return <ErrorState title="Couldn't load settings" description={error} />;

  const auditEvents = getAuditLog(db, campaign.id);
  // useCampaignDetail() comes from the layout's own separate useAdminData()
  // call, so it won't reflect writes made through this page's refetch() —
  // fall back to this page's own fresher copy for the fields this page
  // itself can change.
  const liveCampaign = db.campaigns.find((c) => c.id === campaign.id) ?? campaign;

  async function setStatus(status: CampaignStatus) {
    setBusy(true);
    setStatusError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_update_campaign_status", {
      p_campaign_id: campaign.id,
      p_status: status,
    });
    setBusy(false);
    if (rpcError) {
      setStatusError(rpcError.message);
      return;
    }
    await refetch();
  }

  // Activate is the one transition with real minimum-requirements
  // validation (name, client, dates, target, an approved sender ID) — it
  // goes through its own RPC rather than the generic status update so that
  // validation applies here and wherever else "Activate" is offered.
  async function activateCampaign() {
    setBusy(true);
    setStatusError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_activate_campaign", {
      p_campaign_id: campaign.id,
    });
    setBusy(false);
    if (rpcError) {
      setStatusError(rpcError.message);
      return;
    }
    await refetch();
  }

  async function restoreCampaign() {
    setBusy(true);
    setStatusError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_restore_campaign", {
      p_campaign_id: campaign.id,
    });
    setBusy(false);
    if (rpcError) {
      setStatusError(rpcError.message);
      return;
    }
    await refetch();
  }

  async function setRecording(recordingEnabled: boolean) {
    setBusy(true);
    const supabase = createClient();
    await supabase.rpc("admin_update_campaign_recording", {
      p_campaign_id: campaign.id,
      p_recording_enabled: recordingEnabled,
    });
    setBusy(false);
    await refetch();
  }

  const statusActions: { label: string; onClick: () => void; variant?: "secondary" | "danger" }[] = (() => {
    switch (liveCampaign.status) {
      case "draft":
      case "ready":
        return [{ label: "Activate", onClick: activateCampaign }];
      case "active":
        return [
          { label: "Pause campaign", onClick: () => setStatus("paused"), variant: "secondary" },
          { label: "Close as completed", onClick: () => setStatus("completed"), variant: "secondary" },
          { label: "Archive", onClick: () => setStatus("archived"), variant: "secondary" },
        ];
      case "paused":
        return [
          { label: "Resume", onClick: () => setStatus("active") },
          { label: "Close as completed", onClick: () => setStatus("completed"), variant: "secondary" },
          { label: "Archive", onClick: () => setStatus("archived"), variant: "secondary" },
        ];
      case "completed":
        return [{ label: "Archive", onClick: () => setStatus("archived"), variant: "secondary" }];
      case "archived":
        return [{ label: "Restore campaign", onClick: restoreCampaign }];
      default:
        return [];
    }
  })();

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Status" />
        <CardBody className="flex flex-col gap-4">
          {statusError ? <InlineBanner kind="danger">{statusError}</InlineBanner> : null}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CampaignStatusBadge status={liveCampaign.status} />
              <p className="mt-1.5 text-xs text-foreground-muted">
                Since {formatDateTime(liveCampaign.updatedAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {statusActions.map((action) => (
                <Button
                  key={action.label}
                  variant={action.variant ?? "primary"}
                  disabled={busy}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
          {liveCampaign.status === "paused" ? (
            <InlineBanner kind="info">
              Pausing stops new activity only — no new SMS sends or contact imports. Interviews already
              booked, and any that are scheduled while paused, are not cancelled and agents can still see
              and complete them.
            </InlineBanner>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Recording"
          description="Applies to calls started after this change — already-recorded calls aren't affected."
        />
        <CardBody>
          <Field label="Call recording">
            <Select
              className="w-48"
              disabled={busy}
              value={liveCampaign.recordingEnabled ? "yes" : "no"}
              onChange={(e) => setRecording(e.target.value === "yes")}
            >
              <option value="no">Off</option>
              <option value="yes">On</option>
            </Select>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Campaign audit" description="Every recorded action for this campaign, most recent first." />
        <CardBody className="p-0">
          {auditEvents.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Nothing logged yet" description="Actions on this campaign will appear here." />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {auditEvents.map((event) => (
                <li key={event.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{describeAction(event.action)}</p>
                      {ACCESS_ACTIONS.has(event.action) ? <Badge tone="info">Access</Badge> : null}
                      {SENSITIVE_ACTIONS.has(event.action) ? <Badge tone="danger">Sensitive</Badge> : null}
                    </div>
                    <p className="text-xs text-foreground-muted">
                      {event.entityType.replace(/_/g, " ")} · {event.actorName}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-xs text-foreground-subtle">
                    {formatDateTime(event.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {liveCampaign.status !== "archived" ? (
        <Card>
          <CardHeader
            title="Danger zone"
            description="Deleting only works for campaigns with no real activity yet — no calls, consent, bookings, sent invitations or recordings. If this campaign has any of that, Archive it instead; deletion is blocked and offers Archive automatically."
          />
          <CardBody>
            <Button variant="danger" onClick={() => setDeleteTarget(liveCampaign)}>
              Delete campaign
            </Button>
          </CardBody>
        </Card>
      ) : null}

      <DeleteCampaignModal
        campaign={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null);
          router.push("/admin/campaigns");
        }}
        onArchiveInstead={() => setStatus("archived")}
      />
    </div>
  );
}
