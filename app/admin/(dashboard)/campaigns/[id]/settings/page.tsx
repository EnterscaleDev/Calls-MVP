"use client";

import { useStore } from "@/lib/store";
import { useAdminSession } from "@/lib/auth";
import { getAuditLog } from "@/lib/selectors";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Form";
import { CampaignStatusBadge, Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { formatDateTime, labelize } from "../../../_lib/format";
import { useCampaignDetail } from "../campaign-context";
import type { CampaignStatus } from "@/lib/types";

const SENSITIVE_ACTIONS = new Set(["recording_accessed", "data_exported", "contact_numbers_revealed"]);
const ACCESS_ACTIONS = new Set(["recording_accessed", "contact_numbers_revealed"]);

function describeAction(action: string): string {
  const map: Record<string, string> = {
    campaign_created: "Campaign created",
    campaign_status_changed: "Status changed",
    campaign_recording_setting_changed: "Recording setting changed",
    contact_numbers_revealed: "Contact numbers revealed",
    contacts_imported: "Contacts imported",
    invitation_sent: "Invitation sent",
    sms_batch_sent: "SMS batch sent",
    consent_recorded: "Consent recorded",
    booking_created: "Booking created",
    booking_rescheduled: "Booking rescheduled",
    booking_cancelled: "Booking cancelled",
    agent_invited: "Agent invited",
    agent_attached_to_campaign: "Agent attached to campaign",
    agent_detached_from_campaign: "Agent removed from campaign",
    participant_assigned: "Participant assigned to agent",
    participant_reassigned: "Participant reassigned",
    call_initiated: "Call initiated",
    call_outcome_submitted: "Call outcome submitted",
  };
  return map[action] ?? labelize(action);
}

export default function CampaignSettingsPage() {
  const campaign = useCampaignDetail();
  const { db, actions } = useStore();
  const { session } = useAdminSession();
  const actor = session?.name ?? "Toni";
  const auditEvents = getAuditLog(db, campaign.id);

  function setStatus(status: CampaignStatus) {
    actions.updateCampaignStatus(campaign.id, status, actor);
  }

  const statusActions: { label: string; status: CampaignStatus; variant?: "secondary" | "danger" }[] = (() => {
    switch (campaign.status) {
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
            <CampaignStatusBadge status={campaign.status} />
            <p className="mt-1.5 text-xs text-foreground-muted">
              Since {formatDateTime(campaign.updatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusActions.map((action) => (
              <Button
                key={action.status}
                variant={action.variant ?? "primary"}
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
              value={campaign.recordingEnabled ? "yes" : "no"}
              onChange={(e) => actions.updateCampaignRecording(campaign.id, e.target.value === "yes", actor)}
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
    </div>
  );
}
