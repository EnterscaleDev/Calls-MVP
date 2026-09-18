"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAdminData } from "@/lib/hooks/useAdminData";
import { getAuditLog } from "@/lib/selectors";
import { SENSITIVE_ACTIONS, ACCESS_ACTIONS, describeAction } from "@/lib/audit-labels";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select, Input } from "@/components/ui/Form";
import { CampaignStatusBadge, Badge } from "@/components/ui/Badge";
import { EmptyState, LoadingScreen, ErrorState, InlineBanner } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { formatDateTime } from "../../../_lib/format";
import { useCampaignDetail } from "../campaign-context";
import type { CampaignStatus } from "@/lib/types";

export default function CampaignSettingsPage() {
  const router = useRouter();
  const campaign = useCampaignDetail();
  const { data: db, loading, error, refetch } = useAdminData();
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
    const supabase = createClient();
    await supabase.rpc("admin_update_campaign_status", { p_campaign_id: campaign.id, p_status: status });
    setBusy(false);
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

  async function handleDeleteCampaign() {
    setDeleting(true);
    setDeleteError("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profileRow } = user
        ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
        : { data: null };
      // Logged before the delete since every other row referencing this
      // campaign (including audit_events.campaign_id) cascades/nulls once
      // the campaign itself is gone — the name in metadata is what survives.
      await supabase.from("audit_events").insert({
        organisation_id: campaign.organisationId,
        campaign_id: campaign.id,
        actor_type: "admin",
        actor_name: profileRow?.display_name ?? "Admin",
        action: "campaign_deleted",
        entity_type: "campaign",
        entity_id: campaign.id,
        metadata: { name: campaign.name },
      });
      const { error: deleteErr } = await supabase.from("campaigns").delete().eq("id", campaign.id);
      if (deleteErr) throw deleteErr;
      router.push("/admin/campaigns");
    } catch {
      setDeleteError("Something went wrong deleting this campaign. Try again.");
      setDeleting(false);
    }
  }

  const statusActions: { label: string; status: CampaignStatus; variant?: "secondary" | "danger" }[] = (() => {
    switch (liveCampaign.status) {
      case "draft":
      case "ready":
        return [{ label: "Activate", status: "active" }];
      case "active":
        return [
          { label: "Pause campaign", status: "paused", variant: "secondary" },
          { label: "Close as completed", status: "completed", variant: "secondary" },
        ];
      case "paused":
        return [
          { label: "Resume", status: "active" },
          { label: "Close as completed", status: "completed", variant: "secondary" },
        ];
      case "completed":
        return [{ label: "Archive", status: "archived", variant: "secondary" }];
      default:
        return [];
    }
  })();

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Status" />
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CampaignStatusBadge status={liveCampaign.status} />
            <p className="mt-1.5 text-xs text-foreground-muted">
              Since {formatDateTime(liveCampaign.updatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusActions.map((action) => (
              <Button
                key={action.status}
                variant={action.variant ?? "primary"}
                disabled={busy}
                onClick={() => setStatus(action.status)}
              >
                {action.label}
              </Button>
            ))}
          </div>
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

      <Card>
        <CardHeader
          title="Danger zone"
          description="Permanently deletes this campaign and everything under it — contacts' import records, invitations, bookings, call history, and recordings. This can't be undone."
        />
        <CardBody>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            Delete campaign
          </Button>
        </CardBody>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => {
          if (deleting) return;
          setDeleteOpen(false);
          setDeleteConfirmText("");
        }}
        title="Delete this campaign?"
        description={`This permanently deletes "${liveCampaign.name}" and all of its participants, invitations, bookings, and call history. This can't be undone.`}
      >
        <div className="flex flex-col gap-3">
          {deleteError ? <InlineBanner kind="danger">{deleteError}</InlineBanner> : null}
          <Field label={`Type the campaign name to confirm: "${liveCampaign.name}"`}>
            <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              disabled={deleting}
              onClick={() => {
                setDeleteOpen(false);
                setDeleteConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleting || deleteConfirmText !== liveCampaign.name}
              onClick={handleDeleteCampaign}
            >
              {deleting ? "Deleting..." : "Delete campaign"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
