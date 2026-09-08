"use client";

import { useStore } from "@/lib/store";
import { getCampaignFunnel, getCampaignMetrics } from "@/lib/selectors";
import { Card, CardHeader, CardBody, StatCard } from "@/components/ui/Card";
import { FunnelRow, ProgressBar } from "@/components/ui/Progress";
import { EmptyState } from "@/components/ui/States";
import { ButtonLink } from "@/components/ui/Button";
import { safeDiv, formatPercent } from "../../_lib/format";
import { useCampaignDetail } from "./campaign-context";

export default function CampaignOverviewPage() {
  const campaign = useCampaignDetail();
  const { db } = useStore();

  const funnel = getCampaignFunnel(db, campaign.id);
  const metrics = getCampaignMetrics(db, campaign.id);

  if (funnel.contacts === 0) {
    return (
      <EmptyState
        title="No participants have been uploaded yet"
        description="Upload a contact list to start recruiting for this campaign."
        action={
          <ButtonLink href={`/admin/campaigns/${campaign.id}/audience`}>
            Go to Audience
          </ButtonLink>
        }
      />
    );
  }

  const steps = [
    { label: "Uploaded", count: funnel.contacts },
    { label: "Invited", count: funnel.invited },
    { label: "Opted In", count: funnel.optedIn },
    { label: "Scheduled", count: funnel.scheduled },
    { label: "Completed", count: funnel.completed },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Contacts" value={metrics.contacts} />
        <StatCard label="Invitations sent" value={metrics.invitationsSent} />
        <StatCard label="Delivered" value={metrics.delivered} />
        <StatCard label="Opted in" value={metrics.optedIn} />
        <StatCard label="Scheduled" value={metrics.scheduled} />
        <StatCard label="Calls attempted" value={metrics.callsAttempted} />
        <StatCard label="Completed" value={metrics.completed} />
        <StatCard label="Completion rate" value={formatPercent(metrics.completionRate)} />
      </div>

      <Card>
        <CardHeader title="Recruitment funnel" description="Each step as a share of the step before it." />
        <CardBody className="flex flex-col gap-4">
          {steps.map((step, i) => (
            <FunnelRow
              key={step.label}
              label={step.label}
              value={step.count}
              maxValue={steps[0].count}
              isFirst={i === 0}
              pctOfPrevious={i === 0 ? undefined : safeDiv(step.count, steps[i - 1].count)}
              tone={i % 3 === 0 ? "primary" : i % 3 === 1 ? "info" : "navy"}
            />
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Target progress" />
        <CardBody>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              {metrics.completed} / {campaign.targetCompletions}
            </span>
            <span className="text-foreground-muted">
              {formatPercent(safeDiv(metrics.completed, campaign.targetCompletions))} of target
            </span>
          </div>
          <ProgressBar value={safeDiv(metrics.completed, campaign.targetCompletions)} className="mt-2" />
        </CardBody>
      </Card>
    </div>
  );
}
