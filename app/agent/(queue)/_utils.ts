// Small presentation helpers shared across the Agent queue/call/history pages.
// Colocated here (rather than in lib/) since it's Agent-surface-specific and
// this directory is the Agent's own territory.

import type { CallOutcome } from "@/lib/types";

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTimeOnly(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function formatElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const s = (safe % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export const OUTCOME_OPTIONS: { value: CallOutcome; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "no_answer", label: "No answer" },
  { value: "busy", label: "Busy" },
  { value: "reschedule_requested", label: "Reschedule requested" },
  { value: "declined", label: "Participant declined" },
  { value: "wrong_number", label: "Wrong number" },
  { value: "ineligible", label: "Ineligible" },
  { value: "follow_up_required", label: "Follow-up required" },
  { value: "technical_failure", label: "Technical failure" },
];

export function outcomeRequiresNotes(outcome: CallOutcome | ""): boolean {
  return (
    outcome === "completed" ||
    outcome === "follow_up_required" ||
    outcome === "technical_failure" ||
    outcome === "reschedule_requested"
  );
}
