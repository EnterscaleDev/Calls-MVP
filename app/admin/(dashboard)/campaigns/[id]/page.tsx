"use client";

import { useAdminData } from "@/lib/hooks/useAdminData";
import { getCampaignFunnel, getCampaignMetrics, getCallAttemptsForCampaign } from "@/lib/selectors";
import { Card, CardHeader, CardBody, StatCard } from "@/components/ui/Card";
import { FunnelRow, ProgressBar } from "@/components/ui/Progress";
import { EmptyState, LoadingScreen, ErrorState } from "@/components/ui/States";
import { ButtonLink } from "@/components/ui/Button";
import { safeDiv, formatPercent } from "../../_lib/format";
import { useCampaignDetail } from "./campaign-context";

interface StateCount {
  label: string;
  count: number;
  dot: string;
}

export default function CampaignOverviewPage() {
  const campaign = useCampaignDetail();
  const { data: db, loading, error } = useAdminData();

  if (loading || !db) return <LoadingScreen label="Loading campaign overview..." />;
  if (error) return <ErrorState title="Couldn't load this campaign" description={error} />;

  const funnel = getCampaignFunnel(db, campaign.id);
  const metrics = getCampaignMetrics(db, campaign.id);
  const attempts = getCallAttemptsForCampaign(db, campaign.id);
  const endedAttempts = attempts.filter((a) => a.status === "ended");
  const noAnswerRate = safeDiv(
    endedAttempts.filter((a) => a.disposition === "no_answer").length,
    endedAttempts.length
  );
  const outstanding = Math.max(0, funnel.scheduled - funnel.completed);

  const interviewStates: StateCount[] = (() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const counts = { unassigned: 0, today: 0, upcoming: 0, overdue: 0, completed: 0, cancelled: 0 };
    const participants = db.participants.filter((p) => p.campaignId === campaign.id);
    for (const participant of participants) {
      const bookings = db.bookings.filter((b) => b.participantId === participant.id);
      const activeBooking = [...bookings]
        .filter((b) => b.status !== "cancelled")
        .sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart))[0];
      const wasCancelled = bookings.some((b) => b.status === "cancelled") && !activeBooking;
      if (wasCancelled) {
        counts.cancelled += 1;
        continue;
      }
      if (!activeBooking) continue;
      const assignment = db.assignments.find((a) => a.bookingId === activeBooking.id);
      if (activeBooking.status === "completed" || activeBooking.status === "missed" || assignment?.status === "completed") {
        counts.completed += 1;
      } else if (!assignment || assignment.status === "cancelled" || assignment.status === "reassigned") {
        counts.unassigned += 1;
      } else {
        const scheduled = new Date(activeBooking.scheduledStart);
        if (scheduled < startOfToday) counts.overdue += 1;
        else if (scheduled <= endOfToday) counts.today += 1;
        else counts.upcoming += 1;
      }
    }
    return [
      { label: "Unassigned", count: counts.unassigned, dot: "bg-warning" },
      { label: "Today", count: counts.today, dot: "bg-info" },
      { label: "Upcoming", count: counts.upcoming, dot: "bg-navy" },
      { label: "Overdue", count: counts.overdue, dot: "bg-danger" },
      { label: "Completed", count: counts.completed, dot: "bg-success" },
      { label: "Cancelled", count: counts.cancelled, dot: "bg-foreground-subtle" },
    ];
  })();

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
        <StatCard
          label="No answer rate"
          value={formatPercent(noAnswerRate)}
          hint="Across ended attempts"
        />
        <StatCard label="Outstanding" value={outstanding} hint="Scheduled but not yet done" />
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
        <CardHeader
          title="Interview states"
          action={
            <ButtonLink href={`/admin/campaigns/${campaign.id}/scheduling`} variant="secondary" size="sm">
              Open scheduling
            </ButtonLink>
          }
        />
        <CardBody className="flex flex-wrap gap-x-6 gap-y-3">
          {interviewStates.map((state) => (
            <div key={state.label} className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${state.dot}`} />
              <span className="label-caps text-foreground-subtle">{state.label}</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{state.count}</span>
            </div>
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
