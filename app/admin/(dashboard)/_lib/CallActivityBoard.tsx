"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { getCallAttemptsForCampaign, getRecordingForAttempt, getCampaign } from "@/lib/selectors";
import { Card, CardHeader, CardBody, StatCard } from "@/components/ui/Card";
import { Select } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { OutcomeBadge, Badge } from "@/components/ui/Badge";
import { formatDateTime, formatDuration, safeDiv, formatPercent, isToday, labelize } from "./format";
import type {
  Campaign,
  CampaignParticipant,
  Contact,
  InterviewBooking,
  CallAssignment,
  AgentProfile,
  CallAttempt,
  Recording,
  CallOutcome,
} from "@/lib/types";

const RECORDING_TONE: Record<string, "info" | "success" | "danger" | "neutral"> = {
  recording: "info",
  available: "success",
  failed: "danger",
  unavailable: "neutral",
};

/** Narrow, structural — satisfied by both the mock MockDatabase (still used
 * by the not-yet-migrated per-campaign Call Activity tab) and the real
 * useAdminData() shape (the org-wide page), so this shared component doesn't
 * need to know or care which one it's handed. */
export interface CallActivityBoardData {
  campaigns: Campaign[];
  participants: CampaignParticipant[];
  contacts: Contact[];
  bookings: InterviewBooking[];
  assignments: CallAssignment[];
  agents: AgentProfile[];
  callAttempts: CallAttempt[];
  recordings: Recording[];
}

export function CallActivityBoard({
  db,
  campaignId,
}: {
  db: CallActivityBoardData;
  campaignId?: string;
}) {
  const [agentFilter, setAgentFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today">("all");
  const [campaignFilter, setCampaignFilter] = useState("");

  const scopeCampaignId = campaignId ?? (campaignFilter || undefined);

  const attempts = useMemo(() => {
    if (scopeCampaignId) return getCallAttemptsForCampaign(db, scopeCampaignId);
    return [...db.callAttempts].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, [db, scopeCampaignId]);

  const callsToday = attempts.filter((a) => isToday(a.startedAt)).length;
  const callsAttempted = attempts.length;
  const completedInterviews = attempts.filter((a) => a.disposition === "completed").length;
  const noAnswers = attempts.filter((a) => a.disposition === "no_answer").length;
  const reschedules = attempts.filter((a) => a.disposition === "reschedule_requested").length;
  const durations = attempts.map((a) => a.durationSeconds).filter((d): d is number => typeof d === "number");
  const avgDuration = durations.length
    ? durations.reduce((sum, d) => sum + d, 0) / durations.length
    : undefined;
  const completionRate = safeDiv(completedInterviews, callsAttempted);

  // One row per participant with at least one attempt in scope.
  const participantIds = [...new Set(attempts.map((a) => a.participantId))];

  const rows = participantIds
    .map((participantId) => {
      const participantAttempts = attempts
        .filter((a) => a.participantId === participantId)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      const lastAttempt = participantAttempts[0];
      const participant = db.participants.find((p) => p.id === participantId);
      const contact = participant ? db.contacts.find((c) => c.id === participant.contactId) : undefined;
      const booking = participant
        ? [...db.bookings]
            .filter((b) => b.participantId === participant.id)
            .sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart))[0]
        : undefined;
      const assignment = lastAttempt
        ? db.assignments.find((a) => a.id === lastAttempt.assignmentId)
        : undefined;
      const agent = lastAttempt ? db.agents.find((a) => a.id === lastAttempt.agentId) : undefined;
      const recording = lastAttempt ? getRecordingForAttempt(db, lastAttempt.id) : undefined;
      const campaign = participant ? getCampaign(db, participant.campaignId) : undefined;

      return {
        participantId,
        contactName: contact?.name ?? "Unknown contact",
        agentName: agent?.name ?? "—",
        agentId: agent?.id,
        scheduledStart: booking?.scheduledStart,
        attemptCount: participantAttempts.length,
        lastAttempt,
        outcome: lastAttempt?.disposition,
        duration: lastAttempt?.durationSeconds,
        recording,
        notes: lastAttempt?.notes,
        campaignName: campaign?.name,
        campaignId: campaign?.id,
        assignmentStatus: assignment?.status,
      };
    })
    .sort((a, b) => (b.lastAttempt?.startedAt ?? "").localeCompare(a.lastAttempt?.startedAt ?? ""));

  const agentOptions = [...new Set(rows.map((r) => r.agentId).filter((id): id is string => !!id))].map(
    (id) => db.agents.find((a) => a.id === id)!
  );
  const campaignOptions = campaignId ? [] : db.campaigns;

  const filteredRows = rows.filter((r) => {
    if (agentFilter && r.agentId !== agentFilter) return false;
    if (outcomeFilter && r.outcome !== outcomeFilter) return false;
    if (dateFilter === "today" && !(r.lastAttempt && isToday(r.lastAttempt.startedAt))) return false;
    return true;
  });

  const outcomeMix = useMemo(() => {
    const counts = new Map<CallOutcome, number>();
    for (const row of filteredRows) {
      if (!row.outcome) continue;
      counts.set(row.outcome, (counts.get(row.outcome) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredRows]);

  function handleExport() {
    const header = "Participant,Campaign,Agent,Scheduled,Attempts,Last Call,Outcome,Duration,Recording,Notes\n";
    const body = filteredRows
      .map((r) =>
        [
          r.contactName,
          r.campaignName ?? "",
          r.agentName,
          formatDateTime(r.scheduledStart),
          r.attemptCount,
          formatDateTime(r.lastAttempt?.startedAt),
          r.outcome ?? "",
          formatDuration(r.duration),
          r.recording?.status ?? "",
          r.notes ?? "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "call-activity.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const outcomeValues: CallOutcome[] = [
    "completed",
    "no_answer",
    "busy",
    "reschedule_requested",
    "declined",
    "wrong_number",
    "ineligible",
    "follow_up_required",
    "technical_failure",
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Calls today" value={callsToday} />
        <StatCard label="Calls attempted" value={callsAttempted} />
        <StatCard label="Completed interviews" value={completedInterviews} />
        <StatCard label="No answers" value={noAnswers} />
        <StatCard label="Reschedules" value={reschedules} />
        <StatCard label="Avg. call duration" value={formatDuration(avgDuration)} />
        <StatCard label="Completion rate" value={formatPercent(completionRate)} />
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-foreground-muted">
            Agent
            <Select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="w-40">
              <option value="">All agents</option>
              {agentOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-foreground-muted">
            Outcome
            <Select value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value)} className="w-44">
              <option value="">All outcomes</option>
              {outcomeValues.map((o) => (
                <option key={o} value={o}>
                  {labelize(o)}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-foreground-muted">
            Date
            <Select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as "all" | "today")} className="w-32">
              <option value="all">All time</option>
              <option value="today">Today</option>
            </Select>
          </label>
          {!campaignId ? (
            <label className="flex flex-col gap-1 text-xs font-medium text-foreground-muted">
              Campaign
              <Select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} className="w-48">
                <option value="">All campaigns</option>
                {campaignOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={handleExport}
            disabled={filteredRows.length === 0}
          >
            Export {filteredRows.length} row{filteredRows.length === 1 ? "" : "s"}
          </Button>
        </CardBody>
      </Card>

      {outcomeMix.length > 0 ? (
        <Card>
          <CardHeader
            title="Outcome mix"
            description={`By most recent attempt · ${filteredRows.length} participant${filteredRows.length === 1 ? "" : "s"}`}
          />
          <CardBody className="flex flex-wrap gap-x-6 gap-y-2">
            {outcomeMix.map(([outcome, count]) => (
              <div key={outcome} className="flex items-center gap-2">
                <OutcomeBadge outcome={outcome} />
                <span className="text-sm font-semibold tabular-nums text-foreground">{count}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody className="p-0">
          {filteredRows.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No call activity yet" description="Calls will show up here once agents start dialing." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-subtle">
                    <th className="px-5 py-3 font-medium">Participant</th>
                    {!campaignId ? <th className="px-5 py-3 font-medium">Campaign</th> : null}
                    <th className="px-5 py-3 font-medium">Agent</th>
                    <th className="px-5 py-3 font-medium">Scheduled time</th>
                    <th className="px-5 py-3 font-medium">Attempts</th>
                    <th className="px-5 py-3 font-medium">Last call</th>
                    <th className="px-5 py-3 font-medium">Outcome</th>
                    <th className="px-5 py-3 font-medium">Duration</th>
                    <th className="px-5 py-3 font-medium">Recording</th>
                    <th className="px-5 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.participantId} className="border-b border-border last:border-0 align-top">
                      <td className="px-5 py-3 font-medium text-foreground">{row.contactName}</td>
                      {!campaignId ? (
                        <td className="px-5 py-3 text-foreground-muted">
                          {row.campaignId ? (
                            <Link href={`/admin/campaigns/${row.campaignId}`} className="hover:text-primary hover:underline">
                              {row.campaignName}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                      ) : null}
                      <td className="px-5 py-3 text-foreground-muted">{row.agentName}</td>
                      <td className="px-5 py-3 tabular-nums text-foreground-muted">
                        {formatDateTime(row.scheduledStart)}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-foreground-muted">{row.attemptCount}</td>
                      <td className="px-5 py-3 tabular-nums text-foreground-muted">
                        {formatDateTime(row.lastAttempt?.startedAt)}
                      </td>
                      <td className="px-5 py-3">
                        {row.outcome ? <OutcomeBadge outcome={row.outcome} /> : <span className="text-foreground-subtle">—</span>}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-foreground-muted">{formatDuration(row.duration)}</td>
                      <td className="px-5 py-3">
                        {row.recording ? (
                          <Badge tone={RECORDING_TONE[row.recording.status]}>{labelize(row.recording.status)}</Badge>
                        ) : (
                          <span className="text-foreground-subtle">—</span>
                        )}
                      </td>
                      <td className="max-w-xs px-5 py-3 text-foreground-muted">
                        <span className="line-clamp-2">{row.notes || "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
