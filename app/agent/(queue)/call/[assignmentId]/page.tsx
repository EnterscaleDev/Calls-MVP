"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Circle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Form";
import { ErrorState, LoadingScreen } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import type { AssignmentStatus, CallAttemptStatus, CallOutcome, CallScriptSection } from "@/lib/types";
import { formatDateTime, formatElapsed, OUTCOME_OPTIONS, outcomeRequiresNotes } from "../../_utils";

type LocalCallState = "idle" | CallAttemptStatus;

interface CallDetail {
  participantAlias: string;
  campaignName: string;
  scheduledStart: string;
  estimatedDurationMinutes: number;
  recordingEnabled: boolean;
  organisationId: string;
}

interface AssignmentRow {
  id: string;
  participantId: string;
  agentId: string;
  campaignId: string;
  status: AssignmentStatus;
}

type LoadState = "loading" | "ready" | "unavailable" | "error";

export default function CallWorkspacePage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = use(params);
  const router = useRouter();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [detail, setDetail] = useState<CallDetail | null>(null);
  const [assignment, setAssignment] = useState<AssignmentRow | null>(null);
  const [scriptSections, setScriptSections] = useState<CallScriptSection[]>([]);
  const [actorUserId, setActorUserId] = useState<string | null>(null);
  const [actorName, setActorName] = useState<string>("Agent");

  const [callState, setCallState] = useState<LocalCallState>("idle");
  const [callAttemptId, setCallAttemptId] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState("");
  const [doneSections, setDoneSections] = useState<Set<string>>(new Set());
  const [dispositionOpen, setDispositionOpen] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome | "">("");
  const [outcomeError, setOutcomeError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const connectedAtRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadState("loading");
      const supabase = createClient();
      const [detailRes, assignmentRes, userRes] = await Promise.all([
        supabase.rpc("agent_participant_detail", { p_assignment_id: assignmentId }),
        supabase
          .from("call_assignments")
          .select("id, participant_id, agent_id, campaign_id, status")
          .eq("id", assignmentId)
          .maybeSingle(),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;

      const detailRow = detailRes.data?.[0];
      if (detailRes.error || assignmentRes.error || !detailRow || !assignmentRes.data) {
        setLoadState("error");
        return;
      }

      const user = userRes.data.user;
      const [{ data: campaignRow }, { data: sectionRows }, { data: profileRow }] = await Promise.all([
        supabase
          .from("campaigns")
          .select("estimated_duration_minutes, organisation_id")
          .eq("id", detailRow.campaign_id)
          .maybeSingle(),
        supabase
          .from("call_script_sections")
          .select("id, title, instructions, questions, position")
          .eq("campaign_id", detailRow.campaign_id)
          .order("position"),
        user
          ? supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;

      setDetail({
        participantAlias: detailRow.participant_alias,
        campaignName: detailRow.campaign_name,
        scheduledStart: detailRow.scheduled_start,
        estimatedDurationMinutes: campaignRow?.estimated_duration_minutes ?? 30,
        recordingEnabled: detailRow.recording_enabled,
        organisationId: campaignRow?.organisation_id ?? "",
      });
      const row: AssignmentRow = {
        id: assignmentRes.data.id,
        participantId: assignmentRes.data.participant_id,
        agentId: assignmentRes.data.agent_id,
        campaignId: assignmentRes.data.campaign_id,
        status: assignmentRes.data.status,
      };
      setAssignment(row);
      setScriptSections(
        (sectionRows ?? []).map((r) => ({
          id: r.id,
          title: r.title,
          instructions: r.instructions ?? undefined,
          questions: r.questions ?? [],
        }))
      );
      setActorUserId(user?.id ?? null);
      setActorName(profileRow?.display_name ?? "Agent");
      setLoadState(row.status === "assigned" || row.status === "in_progress" ? "ready" : "unavailable");
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

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

  if (loadState === "loading") {
    return <LoadingScreen label="Loading..." />;
  }

  if (loadState === "error") {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <ErrorState
          title="We couldn't find that interview"
          description="This call may have been removed, reassigned, or isn't yours to view."
        />
      </div>
    );
  }

  if (loadState === "unavailable" || !detail || !assignment) {
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
    if (!assignment || !detail) return;
    setCallState("preparing");
    try {
      const supabase = createClient();
      const { data: attemptRow, error: insertError } = await supabase
        .from("call_attempts")
        .insert({
          campaign_id: assignment.campaignId,
          participant_id: assignment.participantId,
          assignment_id: assignment.id,
          agent_id: assignment.agentId,
          status: "preparing",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insertError || !attemptRow) throw insertError ?? new Error("Failed to start call");
      const attemptId = attemptRow.id;
      setCallAttemptId(attemptId);
      connectedAtRef.current = null;

      await supabase.from("call_assignments").update({ status: "in_progress" }).eq("id", assignment.id);

      if (detail.organisationId) {
        await supabase.from("audit_events").insert({
          organisation_id: detail.organisationId,
          campaign_id: assignment.campaignId,
          actor_type: "agent",
          actor_user_id: actorUserId,
          actor_name: actorName,
          action: "call_initiated",
          entity_type: "call_attempt",
          entity_id: attemptId,
        });
      }

      setCallState("connecting");
      await supabase.from("call_attempts").update({ status: "connecting" }).eq("id", attemptId);

      const bridgeResponse = await fetch("/api/voice/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: assignment.id, clientUniqueId: attemptId }),
      });
      const bridgeResult = (await bridgeResponse.json().catch(() => ({
        ok: false,
        errorReason: "Unexpected response from the call endpoint.",
      }))) as { ok: true } | { ok: false; errorReason: string };

      if (!bridgeResult.ok) {
        setCallState("failed");
        await supabase.from("call_attempts").update({ status: "failed" }).eq("id", attemptId);
        return;
      }

      // Real ringing/answered status arrives async via SMSala's callBackUrl
      // (app/api/voice/smsala-callback/route.ts), which writes straight to
      // this call_attempts row — poll it rather than a synchronous
      // progress callback like the old mock provider gave us.
      let elapsedPollMs = 0;
      pollRef.current = setInterval(async () => {
        elapsedPollMs += 2000;
        const { data: row } = await supabase
          .from("call_attempts")
          .select("status, connected_at")
          .eq("id", attemptId)
          .maybeSingle();

        if (row?.status === "connected" && row.connected_at) {
          const now = new Date(row.connected_at).getTime();
          connectedAtRef.current = now;
          setConnectedAt(now);
          setCallState("connected");
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (row?.status === "failed" || row?.status === "ended") {
          setCallState(row.status);
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (elapsedPollMs >= 60000) {
          // No status update from SMSala in 60s — stop polling rather than
          // spin forever; the agent can still end/retry manually.
          setCallState("failed");
          await supabase.from("call_attempts").update({ status: "failed" }).eq("id", attemptId);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 2000);
    } catch {
      setCallState("failed");
    }
  }

  async function handleEndCall(attemptId: string) {
    const supabase = createClient();
    const now = new Date().toISOString();
    const durationSeconds = connectedAtRef.current
      ? Math.max(1, Math.round((Date.now() - connectedAtRef.current) / 1000))
      : 0;
    await supabase
      .from("call_attempts")
      .update({ status: "ended", ended_at: now, duration_seconds: durationSeconds })
      .eq("id", attemptId);
    setCallState("ended");
    setDispositionOpen(true);
  }

  async function handleSubmitOutcome() {
    if (!callAttemptId) return;
    if (!outcome) {
      setOutcomeError("Select an outcome.");
      return;
    }
    if (outcomeRequiresNotes(outcome) && !notes.trim()) {
      setOutcomeError("Notes are required for this outcome.");
      return;
    }
    setOutcomeError("");
    setSubmitting(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("agent_submit_call_outcome", {
      p_call_attempt_id: callAttemptId,
      p_disposition: outcome,
      p_notes: notes.trim(),
    });
    setSubmitting(false);
    if (rpcError) {
      setOutcomeError(rpcError.message);
      return;
    }
    router.push("/agent");
  }

  const inCallWorkspace = callState !== "idle";
  const isRecording = detail.recordingEnabled && callState === "connected";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-4 pb-28">
      {/* Top section */}
      <div className="rounded-[8px] border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-foreground">{detail.participantAlias}</p>
            <p className="text-sm text-foreground-muted">{detail.campaignName}</p>
          </div>
          <CallStatusPill state={callState} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
          <span>Scheduled {formatDateTime(detail.scheduledStart)}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{detail.estimatedDurationMinutes} min expected</span>
        </div>
        {callState === "connected" || callState === "ended" ? (
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{formatElapsed(elapsed)}</p>
        ) : null}
        {isRecording ? <RecordingIndicator /> : null}
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
          {scriptSections.length === 0 ? (
            <p className="mt-2 text-sm text-foreground-muted">No script has been set up for this campaign yet.</p>
          ) : (
            <div className="mt-3 flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
              {scriptSections.map((section) => {
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
            <p className="rounded-[6px] border border-border bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
              This won&apos;t book a new time automatically — note what the participant asked for below. They
              can pick a new time from their own link, or an admin can reschedule them.
            </p>
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

function RecordingIndicator() {
  return (
    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-danger">
      <Circle size={8} className="fill-current" />
      Recording
    </div>
  );
}
