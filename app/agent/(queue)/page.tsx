"use client";

import { useState } from "react";
import { ButtonLink, Button } from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
import { AssignmentStatusBadge } from "@/components/ui/Badge";
import { EmptyState, LoadingScreen, ErrorState } from "@/components/ui/States";
import { ProgressBar } from "@/components/ui/Progress";
import { Modal } from "@/components/ui/Modal";
import { useAgentData, type AgentQueueEntry } from "@/lib/hooks/useAgentData";
import { formatDateTime } from "./_utils";

function QueueCard({
  view,
  action,
}: {
  view: AgentQueueEntry;
  action?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{view.participantAlias}</p>
          <p className="truncate text-xs text-foreground-muted">{view.campaignName}</p>
        </div>
        <AssignmentStatusBadge status={view.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
        <span>{formatDateTime(view.scheduledStart)}</span>
        <span aria-hidden="true">&middot;</span>
        <span>{view.estimatedDurationMinutes} min</span>
        {view.lastOutcome ? (
          <>
            <span aria-hidden="true">&middot;</span>
            <span>Last attempt: {view.lastOutcome.replace(/_/g, " ")}</span>
          </>
        ) : null}
      </div>
      {action ? <div className="mt-3">{action}</div> : null}
    </Card>
  );
}

function Section({
  title,
  items,
  emptyLabel,
  renderAction,
}: {
  title: string;
  items: AgentQueueEntry[];
  emptyLabel: string;
  renderAction?: (view: AgentQueueEntry) => React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-xs font-medium text-foreground-subtle">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <EmptyState title={emptyLabel} />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((view) => (
            <QueueCard key={view.assignmentId} view={view} action={renderAction?.(view)} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function AgentQueuePage() {
  const { data, loading, error } = useAgentData();
  const [detailsView, setDetailsView] = useState<AgentQueueEntry | null>(null);

  if (loading || !data) return <LoadingScreen label="Loading your queue..." />;
  if (error) return <ErrorState title="Couldn't load your queue" description={error} />;

  const overdue = data.queue.filter((v) => v.bucket === "overdue");
  const dueNow = data.queue.filter((v) => v.bucket === "due_now");
  const upcoming = data.queue.filter((v) => v.bucket === "upcoming");
  const completedToday = data.queue.filter((v) => v.bucket === "completed_today");

  const totalDueToday = overdue.length + dueNow.length + completedToday.length;
  const completedCount = completedToday.length;
  const progress = totalDueToday > 0 ? completedCount / totalDueToday : 0;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-5">
      <h1 className="text-lg font-semibold text-foreground">Today</h1>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatCard
          tone="hero"
          label="Calls completed today"
          value={
            <>
              {completedCount}
              <span className="text-white/60">/{totalDueToday}</span>
            </>
          }
        >
          <ProgressBar value={progress} tone="info" className="mt-3" />
        </StatCard>
        <StatCard
          label="Overdue calls"
          value={overdue.length}
          tone={overdue.length > 0 ? "danger" : "default"}
        />
        <StatCard label="Due now" value={dueNow.length} />
        <StatCard label="Upcoming" value={upcoming.length} />
      </div>

      <Section
        title="Overdue"
        items={overdue}
        emptyLabel="No overdue interviews — nice work"
        renderAction={(view) => (
          <ButtonLink href={`/agent/call/${view.assignmentId}`} size="sm" className="w-full justify-center">
            Start Call
          </ButtonLink>
        )}
      />

      <Section
        title="Due Now"
        items={dueNow}
        emptyLabel="Nothing due right now"
        renderAction={(view) => (
          <ButtonLink href={`/agent/call/${view.assignmentId}`} size="sm" className="w-full justify-center">
            Start Call
          </ButtonLink>
        )}
      />

      <Section
        title="Upcoming"
        items={upcoming}
        emptyLabel="Nothing else scheduled yet"
        renderAction={(view) => (
          <Button
            size="sm"
            variant="secondary"
            className="w-full justify-center"
            onClick={() => setDetailsView(view)}
          >
            View Details
          </Button>
        )}
      />

      <Section title="Completed" items={completedToday} emptyLabel="Nothing completed yet today" />

      <Modal open={!!detailsView} onClose={() => setDetailsView(null)} title="Interview details">
        {detailsView ? (
          <div className="flex flex-col gap-3 text-sm">
            <Row label="Participant" value={detailsView.participantAlias} />
            <Row label="Campaign" value={detailsView.campaignName} />
            <Row label="Scheduled" value={formatDateTime(detailsView.scheduledStart)} />
            <Row label="Expected duration" value={`${detailsView.estimatedDurationMinutes} min`} />
            <Row label="Status" value={<AssignmentStatusBadge status={detailsView.status} />} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <span className="text-xs font-medium text-foreground-muted">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}
