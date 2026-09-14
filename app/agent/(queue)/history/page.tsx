"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { OutcomeBadge, Badge } from "@/components/ui/Badge";
import { Field, Select } from "@/components/ui/Form";
import { EmptyState, LoadingScreen, ErrorState } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { useAgentData } from "@/lib/hooks/useAgentData";
import { formatDateTime, formatElapsed, OUTCOME_OPTIONS } from "../_utils";
import type { CallOutcome } from "@/lib/types";

interface HistoryRow {
  callAttemptId: string;
  campaignName: string;
  participantAlias: string;
  startedAt: string;
  durationSeconds?: number;
  disposition?: CallOutcome;
  notes?: string;
  followUpRequired: boolean;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function AgentHistoryPage() {
  const { data, loading, error } = useAgentData();
  const [todayOnly, setTodayOnly] = useState(false);
  const [campaignFilter, setCampaignFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [selectedRow, setSelectedRow] = useState<HistoryRow | null>(null);

  const rows = useMemo<HistoryRow[]>(() => {
    if (!data) return [];
    const byAssignment = new Map(data.queue.map((q) => [q.assignmentId, q]));
    return data.callAttempts
      .filter((a) => a.status === "ended")
      .map((a) => {
        const queueEntry = byAssignment.get(a.assignmentId);
        return {
          callAttemptId: a.id,
          campaignName: queueEntry?.campaignName ?? "Unknown campaign",
          participantAlias: queueEntry?.participantAlias ?? "Participant",
          startedAt: a.startedAt,
          durationSeconds: a.durationSeconds,
          disposition: a.disposition,
          notes: a.notes,
          followUpRequired: a.disposition === "follow_up_required",
        };
      })
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, [data]);

  const campaignOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.campaignName))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  if (loading || !data) return <LoadingScreen label="Loading your history..." />;
  if (error) return <ErrorState title="Couldn't load your history" description={error} />;

  const filtered = rows.filter((r) => {
    if (todayOnly && !isToday(r.startedAt)) return false;
    if (campaignFilter && r.campaignName !== campaignFilter) return false;
    if (outcomeFilter && r.disposition !== outcomeFilter) return false;
    return true;
  });

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-5">
      <h1 className="text-lg font-semibold text-foreground">Call History</h1>
      <p className="mt-0.5 text-sm text-foreground-muted">Every call you&apos;ve completed.</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="When">
          <Select value={todayOnly ? "today" : "all"} onChange={(e) => setTodayOnly(e.target.value === "today")}>
            <option value="all">All time</option>
            <option value="today">Today</option>
          </Select>
        </Field>
        <Field label="Campaign">
          <Select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}>
            <option value="">All campaigns</option>
            {campaignOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Outcome">
          <Select value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value)}>
            <option value="">All outcomes</option>
            {OUTCOME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-5">
        {rows.length === 0 ? (
          <EmptyState
            title="No calls yet"
            description="Completed interviews will show up here once you've made your first call."
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No calls match these filters" description="Try widening your filters above." />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((row) => (
              <button
                key={row.callAttemptId}
                type="button"
                onClick={() => setSelectedRow(row)}
                className="w-full text-left"
              >
                <Card className="p-4 hover:bg-surface-muted">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{row.participantAlias}</p>
                      <p className="truncate text-xs text-foreground-muted">{row.campaignName}</p>
                    </div>
                    {row.disposition ? <OutcomeBadge outcome={row.disposition} /> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
                    <span>{formatDateTime(row.startedAt)}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{row.durationSeconds != null ? formatElapsed(row.durationSeconds) : "—"}</span>
                    {row.followUpRequired ? (
                      <>
                        <span aria-hidden="true">&middot;</span>
                        <Badge tone="warning">Follow-up needed</Badge>
                      </>
                    ) : null}
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!selectedRow} onClose={() => setSelectedRow(null)} title="Call details">
        {selectedRow ? (
          <div className="flex flex-col gap-3 text-sm">
            <DetailRow label="Participant" value={selectedRow.participantAlias} />
            <DetailRow label="Campaign" value={selectedRow.campaignName} />
            <DetailRow label="Date/time" value={formatDateTime(selectedRow.startedAt)} />
            <DetailRow
              label="Duration"
              value={selectedRow.durationSeconds != null ? formatElapsed(selectedRow.durationSeconds) : "—"}
            />
            <DetailRow
              label="Outcome"
              value={selectedRow.disposition ? <OutcomeBadge outcome={selectedRow.disposition} /> : "—"}
            />
            <DetailRow
              label="Follow-up"
              value={selectedRow.followUpRequired ? <Badge tone="warning">Required</Badge> : "Not required"}
            />
            <div>
              <p className="text-xs font-medium text-foreground-muted">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {selectedRow.notes?.trim() ? selectedRow.notes : "No notes recorded."}
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <span className="text-xs font-medium text-foreground-muted">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}
