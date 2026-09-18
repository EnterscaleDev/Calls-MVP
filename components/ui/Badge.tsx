import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary" | "navy";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-neutral-soft text-foreground-muted border-border",
  success: "bg-success-soft text-success border-success/25",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/25",
  info: "bg-info-soft text-info border-info-soft-border",
  primary: "bg-primary-soft text-primary border-primary-soft-border",
  navy: "bg-navy-soft text-navy border-navy/25",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "label-caps inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] border px-[7px] py-[2.5px]",
        toneClasses[tone]
      )}
    >
      {children}
    </span>
  );
}

const CAMPAIGN_STATUS_TONE: Record<string, Tone> = {
  draft: "neutral",
  ready: "info",
  active: "info",
  paused: "warning",
  completed: "navy",
  archived: "neutral",
};

const PARTICIPATION_STATUS_TONE: Record<string, Tone> = {
  imported: "neutral",
  invited: "info",
  delivered: "info",
  invite_failed: "danger",
  opted_in: "primary",
  declined: "danger",
  scheduled: "success",
  completed: "success",
  ineligible: "neutral",
};

const ASSIGNMENT_STATUS_TONE: Record<string, Tone> = {
  assigned: "info",
  in_progress: "warning",
  completed: "success",
  reassigned: "neutral",
  cancelled: "neutral",
};

const OUTCOME_TONE: Record<string, Tone> = {
  completed: "success",
  no_answer: "warning",
  busy: "warning",
  reschedule_requested: "info",
  declined: "danger",
  wrong_number: "danger",
  ineligible: "neutral",
  follow_up_required: "warning",
  technical_failure: "danger",
};

const INVITATION_STATUS_TONE: Record<string, Tone> = {
  queued: "neutral",
  sent: "info",
  delivered: "success",
  failed: "danger",
};

const AGENT_STATUS_TONE: Record<string, Tone> = {
  invited: "info",
  active: "success",
  inactive: "neutral",
};

const REMINDER_STATUS_TONE: Record<string, Tone> = {
  scheduled: "neutral",
  processing: "info",
  queued: "info",
  sent: "info",
  delivered: "success",
  failed: "danger",
  cancelled: "neutral",
  skipped: "warning",
};

function labelize(value: string): string {
  return value
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export function StatusBadge({
  status,
  map,
}: {
  status: string;
  map: Record<string, Tone>;
}) {
  return <Badge tone={map[status] ?? "neutral"}>{labelize(status)}</Badge>;
}

export function CampaignStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} map={CAMPAIGN_STATUS_TONE} />;
}
export function ParticipationStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} map={PARTICIPATION_STATUS_TONE} />;
}
export function AssignmentStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} map={ASSIGNMENT_STATUS_TONE} />;
}
export function OutcomeBadge({ outcome }: { outcome: string }) {
  return <StatusBadge status={outcome} map={OUTCOME_TONE} />;
}
export function InvitationStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} map={INVITATION_STATUS_TONE} />;
}
export function AgentStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} map={AGENT_STATUS_TONE} />;
}
export function ReminderStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} map={REMINDER_STATUS_TONE} />;
}

/** The navy-outlined "campaign type" chip, e.g. "INTERVIEW" — a distinct treatment from status pills. */
export function CampaignTypeChip({ children }: { children: ReactNode }) {
  return (
    <span className="label-caps inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] border border-navy bg-navy-soft px-[7px] py-[2.5px] text-navy">
      {children}
    </span>
  );
}
