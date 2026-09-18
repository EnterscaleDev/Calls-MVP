"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAdminData } from "@/lib/hooks/useAdminData";
import { getRemindersForBooking } from "@/lib/selectors";
import { Card, CardBody } from "@/components/ui/Card";
import { Select } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingScreen, ErrorState } from "@/components/ui/States";
import { AssignmentStatusBadge } from "@/components/ui/Badge";
import { formatDateTime, formatTime, formatDate } from "../../../_lib/format";
import { useCampaignDetail } from "../campaign-context";
import { cn } from "@/lib/cn";
import { BookingReminderModal } from "./_components/BookingReminderModal";
import type { AgentProfile, InterviewBooking, CallAssignment } from "@/lib/types";

/** A short "3 sent, 1 failed"-style summary for a booking's reminders,
 *  compact enough for a board card. Undefined when there's nothing to show
 *  (no reminders exist yet, or none stand out). */
function reminderSummary(reminders: ReturnType<typeof getRemindersForBooking>): { label: string; tone: "danger" | "warning" | "neutral" } | undefined {
  if (reminders.length === 0) return undefined;
  const failed = reminders.filter((r) => r.status === "failed").length;
  if (failed > 0) return { label: `${failed} failed`, tone: "danger" };
  const pending = reminders.filter((r) => r.status === "scheduled" || r.status === "processing").length;
  if (pending > 0) return { label: `${pending} upcoming`, tone: "neutral" };
  const sent = reminders.filter((r) => r.status === "sent" || r.status === "delivered").length;
  if (sent > 0) return { label: `${sent} sent`, tone: "neutral" };
  return undefined;
}

type Bucket = "unscheduled" | "unassigned" | "today" | "upcoming" | "overdue" | "completed" | "cancelled";

const BUCKET_COLUMNS: { key: Bucket; label: string; description: string; dot: string }[] = [
  { key: "unscheduled", label: "Unscheduled", description: "Opted in, no slot chosen", dot: "bg-warning" },
  { key: "unassigned", label: "Unassigned", description: "Booked, no agent yet", dot: "bg-warning" },
  { key: "today", label: "Today", description: "Interview is today", dot: "bg-info" },
  { key: "upcoming", label: "Upcoming", description: "Booked for a future date", dot: "bg-navy" },
  { key: "overdue", label: "Overdue", description: "Slot passed, not completed", dot: "bg-danger" },
  { key: "completed", label: "Completed", description: "Interview done", dot: "bg-success" },
  { key: "cancelled", label: "Cancelled", description: "Opted out or cancelled", dot: "bg-foreground-subtle" },
];

/** Buckets with no meaningful assign-agent action — either nothing to
 *  assign against yet (no booking), or the record is settled. */
const NO_ASSIGN_BUCKETS = new Set<Bucket>(["unscheduled", "completed", "cancelled"]);

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface SchedulingRow {
  participantId: string;
  contactName: string;
  booking?: InterviewBooking;
  assignment?: CallAssignment;
  agent?: AgentProfile;
  bucket: Bucket;
}

function SchedulingPageInner() {
  const campaign = useCampaignDetail();
  const { data: db, loading, error, refetch } = useAdminData();
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get("filter") as Bucket | null) ?? "unassigned";
  const [view, setView] = useState<"board" | "table">("board");
  const [activeBucket, setActiveBucket] = useState<Bucket>(
    BUCKET_COLUMNS.some((t) => t.key === initialFilter) ? initialFilter : "unassigned"
  );
  const [pendingAgent, setPendingAgent] = useState<Record<string, string>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [reminderTarget, setReminderTarget] = useState<SchedulingRow | null>(null);

  const rows = useMemo<SchedulingRow[]>(() => {
    if (!db) return [];
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const participants = db.participants.filter((p) => p.campaignId === campaign.id);
    const result: SchedulingRow[] = [];

    for (const participant of participants) {
      const contact = db.contacts.find((c) => c.id === participant.contactId);
      const contactName = contact?.name ?? "Unknown contact";
      const bookingsForParticipant = [...db.bookings]
        .filter((b) => b.participantId === participant.id)
        .sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart));
      const booking = bookingsForParticipant.find((b) => b.status !== "cancelled");

      if (!booking) {
        // No current booking — either they cancelled/were cancelled (show
        // the most recent one so there's still something to look at) or
        // they've opted in but haven't picked a slot yet.
        const mostRecentCancelled = bookingsForParticipant.find((b) => b.status === "cancelled");
        if (mostRecentCancelled) {
          result.push({ participantId: participant.id, contactName, booking: mostRecentCancelled, bucket: "cancelled" });
        } else if (participant.participationStatus === "opted_in") {
          result.push({ participantId: participant.id, contactName, bucket: "unscheduled" });
        }
        continue;
      }

      const assignment = db.assignments.find((a) => a.bookingId === booking.id);
      const agent = assignment ? db.agents.find((a) => a.id === assignment.agentId) : undefined;

      let bucket: Bucket;
      if (booking.status === "completed" || booking.status === "missed") {
        bucket = "completed";
      } else if (assignment?.status === "completed") {
        bucket = "completed";
      } else if (!assignment || assignment.status === "cancelled" || assignment.status === "reassigned") {
        bucket = "unassigned";
      } else {
        const scheduled = new Date(booking.scheduledStart);
        if (scheduled < startOfToday) bucket = "overdue";
        else if (scheduled <= endOfToday) bucket = "today";
        else bucket = "upcoming";
      }

      result.push({ participantId: participant.id, contactName, booking, assignment, agent, bucket });
    }

    return result.sort((a, b) => (a.booking?.scheduledStart ?? "").localeCompare(b.booking?.scheduledStart ?? ""));
  }, [db, campaign.id]);

  const campaignAgentIds = db
    ? db.campaignAgents.filter((ca) => ca.campaignId === campaign.id && ca.active).map((ca) => ca.agentId)
    : [];
  const activeAgents = db ? db.agents.filter((a) => a.status === "active") : [];
  const assignableAgents =
    campaignAgentIds.length > 0
      ? activeAgents.filter((a) => campaignAgentIds.includes(a.id))
      : activeAgents;

  if (loading || !db) return <LoadingScreen label="Loading scheduling board..." />;
  if (error) return <ErrorState title="Couldn't load scheduling" description={error} />;

  const counts = BUCKET_COLUMNS.reduce<Record<Bucket, number>>((acc, tab) => {
    acc[tab.key] = rows.filter((r) => r.bucket === tab.key).length;
    return acc;
  }, {} as Record<Bucket, number>);

  const visibleRows = rows.filter((r) => r.bucket === activeBucket);

  async function handleAssign(row: SchedulingRow) {
    const agentId = pendingAgent[row.participantId];
    if (!agentId) return;
    setAssigningId(row.participantId);
    const supabase = createClient();
    await supabase.rpc("admin_assign_participant", {
      p_campaign_id: campaign.id,
      p_participant_id: row.participantId,
      p_agent_id: agentId,
    });
    setAssigningId(null);
    setPendingAgent((prev) => {
      const next = { ...prev };
      delete next[row.participantId];
      return next;
    });
    await refetch();
  }

  function AssignControl({ row, compact = false }: { row: SchedulingRow; compact?: boolean }) {
    if (assignableAgents.length === 0) {
      return <span className="text-xs text-foreground-subtle">No active agents available</span>;
    }
    return (
      <div className={cn("flex items-center gap-2", compact && "flex-col items-stretch")}>
        <Select
          className={compact ? "w-full text-xs" : "w-40"}
          value={pendingAgent[row.participantId] ?? row.agent?.id ?? ""}
          onChange={(e) => setPendingAgent((prev) => ({ ...prev, [row.participantId]: e.target.value }))}
        >
          <option value="" disabled>
            Select agent
          </option>
          {assignableAgents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          onClick={() => handleAssign(row)}
          disabled={!pendingAgent[row.participantId] || assigningId === row.participantId}
          className={compact ? "w-full justify-center" : undefined}
        >
          {assigningId === row.participantId ? "Saving..." : row.assignment ? "Reassign" : "Assign"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-[5px] border border-border bg-surface p-0.5">
          <button
            type="button"
            onClick={() => setView("board")}
            className={cn(
              "rounded-[4px] px-3 py-1 text-xs font-semibold transition-colors",
              view === "board" ? "bg-navy text-white" : "text-foreground-muted hover:text-foreground"
            )}
          >
            Board
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={cn(
              "rounded-[4px] px-3 py-1 text-xs font-semibold transition-colors",
              view === "table" ? "bg-navy text-white" : "text-foreground-muted hover:text-foreground"
            )}
          >
            Table
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No interviews scheduled yet"
          description="Once participants book a time, they'll show up here to be assigned to an agent."
        />
      ) : view === "board" ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {BUCKET_COLUMNS.map((col) => {
            const colRows = rows.filter((r) => r.bucket === col.key);
            return (
              <div key={col.key} className="w-64 shrink-0">
                <div className="mb-2 flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                  <p className="label-caps text-foreground">{col.label}</p>
                  <span className="text-xs font-semibold text-foreground-subtle">{colRows.length}</span>
                </div>
                <p className="mb-2 text-xs text-foreground-subtle">{col.description}</p>
                <div className="flex flex-col gap-2">
                  {colRows.length === 0 ? (
                    <div className="rounded-[8px] border border-dashed border-border p-3 text-center text-xs text-foreground-subtle">
                      Nothing here
                    </div>
                  ) : (
                    colRows.map((row) => {
                      const reminders = row.booking ? getRemindersForBooking(db, row.booking.id) : [];
                      const summary = reminderSummary(reminders);
                      return (
                        <Card key={row.participantId} className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{row.contactName}</p>
                            {row.agent ? (
                              <span
                                title={row.agent.name}
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white"
                              >
                                {initials(row.agent.name)}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-foreground-muted">
                            {row.booking
                              ? `${formatDate(row.booking.scheduledStart)} · ${formatTime(row.booking.scheduledStart)}`
                              : "No slot chosen yet"}
                          </p>
                          {!NO_ASSIGN_BUCKETS.has(col.key) ? (
                            <div className="mt-2">
                              <AssignControl row={row} compact />
                            </div>
                          ) : row.assignment ? (
                            <div className="mt-2">
                              <AssignmentStatusBadge status={row.assignment.status} />
                            </div>
                          ) : null}
                          {row.booking && reminders.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setReminderTarget(row)}
                              className={cn(
                                "mt-2 flex items-center gap-1 text-xs font-medium hover:underline",
                                summary?.tone === "danger" ? "text-danger" : "text-foreground-muted"
                              )}
                            >
                              <Bell className="h-3 w-3" />
                              {summary ? summary.label : "Reminders"}
                            </button>
                          ) : null}
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto border-b border-border">
            {BUCKET_COLUMNS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveBucket(tab.key)}
                className={cn(
                  "whitespace-nowrap rounded-t-[5px] px-3 py-2.5 text-[12.5px] font-semibold transition-colors",
                  activeBucket === tab.key ? "text-foreground" : "text-foreground-muted hover:text-foreground"
                )}
              >
                {tab.label} ({counts[tab.key]})
              </button>
            ))}
          </div>

          <Card>
            <CardBody className="p-0">
              {visibleRows.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title={`No participants in "${BUCKET_COLUMNS.find((t) => t.key === activeBucket)?.label}"`}
                    description="Try a different tab, or check back once more interviews are booked."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-subtle">
                        <th className="px-5 py-3 font-medium">Participant</th>
                        <th className="px-5 py-3 font-medium">Scheduled time</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 font-medium">Assigned agent</th>
                        <th className="px-5 py-3 font-medium">Assignment status</th>
                        <th className="px-5 py-3 font-medium">Reminders</th>
                        {!NO_ASSIGN_BUCKETS.has(activeBucket) ? (
                          <th className="px-5 py-3 font-medium">Action</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => {
                        const reminders = row.booking ? getRemindersForBooking(db, row.booking.id) : [];
                        const summary = reminderSummary(reminders);
                        return (
                        <tr key={row.participantId} className="border-b border-border last:border-0">
                          <td className="px-5 py-3 font-medium text-foreground">{row.contactName}</td>
                          <td className="px-5 py-3 tabular-nums text-foreground-muted">
                            {row.booking ? formatDateTime(row.booking.scheduledStart) : "—"}
                          </td>
                          <td className="px-5 py-3 text-foreground-muted">{row.booking?.status ?? "—"}</td>
                          <td className="px-5 py-3 text-foreground-muted">{row.agent?.name ?? "—"}</td>
                          <td className="px-5 py-3">
                            {row.assignment ? (
                              <AssignmentStatusBadge status={row.assignment.status} />
                            ) : (
                              <span className="text-foreground-subtle">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {row.booking && reminders.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => setReminderTarget(row)}
                                className={cn(
                                  "flex items-center gap-1 text-xs font-medium hover:underline",
                                  summary?.tone === "danger" ? "text-danger" : "text-foreground-muted"
                                )}
                              >
                                <Bell className="h-3 w-3" />
                                {summary ? summary.label : "View"}
                              </button>
                            ) : (
                              <span className="text-foreground-subtle">—</span>
                            )}
                          </td>
                          {!NO_ASSIGN_BUCKETS.has(activeBucket) ? (
                            <td className="px-5 py-3">
                              <AssignControl row={row} />
                            </td>
                          ) : null}
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      <BookingReminderModal
        booking={reminderTarget?.booking ?? null}
        contactName={reminderTarget?.contactName ?? ""}
        db={db}
        onClose={() => setReminderTarget(null)}
        onChanged={() => refetch()}
      />
    </div>
  );
}

export default function SchedulingPage() {
  return (
    <Suspense fallback={null}>
      <SchedulingPageInner />
    </Suspense>
  );
}
