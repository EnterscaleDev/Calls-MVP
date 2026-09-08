"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Circle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Form";
import { ErrorState, LoadingScreen } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { useAgentSession } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { getAgentQueue, getAvailableSlots, getCallScript, getRecordingForAttempt } from "@/lib/selectors";
import type { CallAttemptStatus, CallOutcome } from "@/lib/types";
import { formatDateTime, formatElapsed, OUTCOME_OPTIONS, outcomeRequiresNotes } from "../../_utils";

type LocalCallState = "idle" | CallAttemptStatus;

export default function CallWorkspacePage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = use(params);
  const router = useRouter();
  const { ready: sessionReady, session } = useAgentSession();
  const { ready: storeReady, db, actions } = useStore();

  // --- All hooks are declared unconditionally, before any early return, so
  // render order never changes across the loading/error/happy paths. ---
  const [callState, setCallState] = useState<LocalCallState>("idle");
  const [callAttemptId, setCallAttemptId] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState("");
  const [doneSections, setDoneSections] = useState<Set<string>>(new Set());
  const [dispositionOpen, setDispositionOpen] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome | "">("");
  const [outcomeError, setOutcomeError] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const ready = sessionReady && storeReady && !!session;

  const assignment = ready ? db.assignments.find((a) => a.id === assignmentId) : undefined;
  const ownedByAgent = ready && !!assignment && assignment.agentId === session!.agentId;

  const queue = ready ? getAgentQueue(db, session!.agentId) : undefined;
  const view =
    ownedByAgent && queue
      ? [...queue.overdue, ...queue.dueNow, ...queue.upcoming, ...queue.completedToday].find(
          (v) => v.assignmentId === assignmentId
        )
      : undefined;

  const campaign = ready && assignment ? db.campaigns.find((c) => c.id === assignment.campaignId) : undefined;
  const script = ready && campaign ? getCallScript(db, campaign.id) : undefined;
  const recording =
    ready && campaign?.recordingEnabled && callAttemptId ? getRecordingForAttempt(db, callAttemptId) : undefined;

  const slots = useMemo(
    () => (campaign ? getAvailableSlots(campaign, 5) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [campaign?.id]
  );

  useEffect(() => {
    if (callState !== "connected" || connectedAt === null) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - connectedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [callState, connectedAt]);

  // Escape hatch for the disposition panel: Escape closes it without submitting,
  // but leaves the "submit outcome" prompt visible so it never feels like a dead end.
  useEffect(() => {
    if (!dispositionOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDispositionOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dispositionOpen]);

  if (!ready) {
    return <LoadingScreen label="Loading..." />;
  }

  if (!assignment) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <ErrorState
          title="We couldn't find that interview"
          description="This call may have been removed or the link is incorrect."
        />
      </div>
    );
  }

  if (!ownedByAgent) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <ErrorState
          title="This isn't your interview"
          description="This call is assigned to someone else. Head back to your queue to find your own calls."
        />
      </div>
    );
  }

  if (!view) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <ErrorState
          title="This interview isn't available to start"
          description="It may have already been completed, cancelled, or reassigned."
        />
      </div>
    );
  }

  async function handleStartCall() {
    setCallState("preparing");
    try {
      const id = await actions.startCallAttempt(assignmentId, (status) => {
        setCallState(status);
        if (status === "connected") setConnectedAt(Date.now());
      });
      setCallAttemptId(id);
    } catch {
      setCallState("failed");
    }
  }

  function handleEndCall(attemptId: string) {
    actions.endCallAttempt(attemptId);
    setCallState("ended");
    setDispositionOpen(true);
  }

  function handleSubmitOutcome() {
    if (!callAttemptId) return;
    if (!outcome) {
      setOutcomeError("Select an outcome.");
      return;
    }
    if (outcomeRequiresNotes(outcome) && !notes.trim()) {
      setOutcomeError("Notes are required for this outcome.");
      return;
    }
    if (outcome === "reschedule_requested" && !selectedSlot) {
      setOutcomeError("Choose a new time for this participant.");
      return;
    }
    setOutcomeError("");
    setSubmitting(true);
    actions.submitCallOutcome(
      callAttemptId,
      outcome,
      notes.trim(),
      outcome === "reschedule_requested" && selectedSlot ? selectedSlot : undefined
    );
    router.push("/agent");
  }

  const inCallWorkspace = callState !== "idle";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-4 pb-28">
      {/* Top section */}
      <div className="rounded-[8px] border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-foreground">{view.participantAlias}</p>
            <p className="text-sm text-foreground-muted">{view.campaignName}</p>
          </div>
          <CallStatusPill state={callState} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
          <span>Scheduled {formatDateTime(view.scheduledStart)}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{view.estimatedDurationMinutes} min expected</span>
        </div>
        {callState === "connected" || callState === "ended" ? (
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{formatElapsed(elapsed)}</p>
        ) : null}
        {campaign?.recordingEnabled && callState === "connected" ? (
          <RecordingIndicator status={recording?.status} />
        ) : null}
      </div>

      {/* Primary action / progress states */}
      {!inCallWorkspace ? (
        <div className="mt-4">
          <Button onClick={handleStartCall} className="w-full justify-center">
            Start Call
          </Button>
        </div>
      ) : null}

      {callState === "preparing" || callState === "connecting" ? (
        <div className="mt-4 rounded-[8px] border border-border bg-surface-muted px-4 py-6 text-center">
          <p className="text-sm font-medium text-foreground">
            {callState === "preparing" ? "Preparing the call..." : "Connecting..."}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">This usually takes a few seconds.</p>
        </div>
      ) : null}

      {callState === "failed" ? (
        <div className="mt-4 rounded-[8px] border border-danger/30 bg-danger-soft px-4 py-5">
          <p className="text-sm font-semibold text-danger">The call couldn&apos;t connect</p>
          <p className="mt-1 text-sm text-danger/80">
            The line may have been busy or unreachable. You can try again, or log an outcome for this
            attempt without retrying.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button onClick={handleStartCall} className="flex-1 justify-center">
              Retry
            </Button>
            <Button
              variant="secondary"
              className="flex-1 justify-center"
              onClick={() => callAttemptId && handleEndCall(callAttemptId)}
              disabled={!callAttemptId}
            >
              Log outcome instead
            </Button>
          </div>
        </div>
      ) : null}

      {callState === "ended" && !dispositionOpen ? (
        <div className="mt-4 rounded-[8px] border border-warning/30 bg-warning-soft px-4 py-4">
          <p className="text-sm font-semibold text-warning">Call ended — outcome not yet submitted</p>
          <p className="mt-1 text-xs text-warning/80">Submit the disposition below when you&apos;re ready.</p>
          <Button size="sm" className="mt-3" onClick={() => setDispositionOpen(true)}>
            Submit outcome
          </Button>
        </div>
      ) : null}

      {/* Script + notes workspace */}
      <div className="mt-4 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-[8px] border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-foreground">Call script</h2>
          {!script ? (
            <p className="mt-2 text-sm text-foreground-muted">No script has been set up for this campaign yet.</p>
          ) : (
            <div className="mt-3 flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
              {script.sections.map((section) => {
                const isDone = doneSections.has(section.id);
                return (
                  <div key={section.id} className="rounded-lg border border-border p-3">
                    <button
                      type="button"
                      onClick={() =>
                        setDoneSections((prev) => {
                          const next = new Set(prev);
                          if (next.has(section.id)) next.delete(section.id);
                          else next.add(section.id);
                          return next;
                        })
                      }
                      className="flex w-full items-start gap-2 text-left"
                    >
                      {isDone ? (
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
                      ) : (
                        <Circle size={16} className="mt-0.5 shrink-0 text-foreground-subtle" />
                      )}
                      <span
                        className={`text-sm font-semibold ${isDone ? "text-foreground-muted line-through" : "text-foreground"}`}
                      >
                        {section.title}
                      </span>
                    </button>
                    {section.instructions ? (
                      <p className="mt-1.5 text-xs italic text-foreground-muted">{section.instructions}</p>
                    ) : null}
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {section.questions.map((q, i) => (
                        <li key={i} className="text-sm text-foreground">
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-[8px] border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-foreground">Notes</h2>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Capture what the participant says as you go..."
            className="mt-3 min-h-[240px]"
          />
        </div>
      </div>

      {/* Bottom action bar */}
      {callState === "connected" && callAttemptId ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-4 py-3">
          <div className="mx-auto max-w-3xl">
            <Button variant="danger" className="w-full justify-center" onClick={() => handleEndCall(callAttemptId)}>
              End Call
            </Button>
          </div>
        </div>
      ) : null}

      {/* Disposition panel */}
      <Modal
        open={dispositionOpen}
        title="Call outcome"
        description="Submit how this call went before returning to your queue."
      >
        <div className="flex flex-col gap-4">
          {outcomeError ? <p className="text-sm text-danger">{outcomeError}</p> : null}
          <Field label="Outcome" required>
            <Select
              value={outcome}
              onChange={(e) => {
                setOutcome(e.target.value as CallOutcome);
                setOutcomeError("");
              }}
            >
              <option value="">Select an outcome...</option>
              {OUTCOME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          {outcome === "reschedule_requested" ? (
            <Field label="New time" required hint="Pick the next slot that works for the participant.">
              <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
                {slots.map((slot, i) => {
                  const startIso = slot.start.toISOString();
                  const isSelected = selectedSlot?.start === startIso;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedSlot({ start: startIso, end: slot.end.toISOString() })}
                      className={`rounded-[5px] border px-3 py-2 text-left text-sm ${
                        isSelected
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-surface text-foreground hover:bg-surface-muted"
                      }`}
                    >
                      {formatDateTime(startIso)}
                    </button>
                  );
                })}
              </div>
            </Field>
          ) : null}

          <Field
            label="Notes"
            required={outcomeRequiresNotes(outcome)}
            hint={
              outcomeRequiresNotes(outcome)
                ? "Required for this outcome."
                : "Optional, but helpful for anyone who picks this back up."
            }
          >
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[100px]" />
          </Field>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={handleSubmitOutcome} disabled={submitting} className="flex-1 justify-center">
              Submit &amp; Return to Queue
            </Button>
            <Button variant="ghost" className="justify-center" onClick={() => setDispositionOpen(false)}>
              I&apos;ll do this later
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CallStatusPill({ state }: { state: LocalCallState }) {
  const labels: Record<LocalCallState, string> = {
    idle: "Not started",
    preparing: "Preparing",
    connecting: "Connecting",
    connected: "Connected",
    failed: "Failed",
    ended: "Ended",
  };
  const tones: Record<LocalCallState, string> = {
    idle: "bg-neutral-soft text-foreground-muted border-border",
    preparing: "bg-info-soft text-info border-info-soft-border",
    connecting: "bg-info-soft text-info border-info-soft-border",
    connected: "bg-success-soft text-success border-success/25",
    failed: "bg-danger-soft text-danger border-danger/25",
    ended: "bg-neutral-soft text-foreground-muted border-border",
  };
  return (
    <span
      className={`label-caps inline-flex items-center whitespace-nowrap rounded-[3px] border px-[7px] py-[2.5px] ${tones[state]}`}
    >
      {labels[state]}
    </span>
  );
}

function RecordingIndicator({ status }: { status?: "recording" | "available" | "failed" | "unavailable" }) {
  if (!status || status === "recording") {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-danger">
        <Circle size={8} className="fill-current" />
        Recording
      </div>
    );
  }
  if (status === "available") {
    return <p className="mt-2 text-xs font-medium text-foreground-muted">Recording saved</p>;
  }
  return <p className="mt-2 text-xs font-medium text-foreground-muted">Recording unavailable</p>;
}
