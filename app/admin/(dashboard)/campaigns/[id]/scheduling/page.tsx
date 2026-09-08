"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { useAdminSession } from "@/lib/auth";
import { Card, CardBody } from "@/components/ui/Card";
import { Select } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { AssignmentStatusBadge } from "@/components/ui/Badge";
import { formatDateTime, formatTime, formatDate } from "../../../_lib/format";
import { useCampaignDetail } from "../campaign-context";
import { cn } from "@/lib/cn";
import type { AgentProfile, InterviewBooking, CallAssignment } from "@/lib/types";

type Bucket = "unassigned" | "today" | "upcoming" | "overdue" | "completed";

const BUCKET_COLUMNS: { key: Bucket; label: string; description: string; dot: string }[] = [
  { key: "unassigned", label: "Unassigned", description: "Booked, no agent yet", dot: "bg-warning" },
  { key: "today", label: "Today", description: "Interview is today", dot: "bg-info" },
  { key: "upcoming", label: "Upcoming", description: "Booked for a future date", dot: "bg-navy" },
  { key: "overdue", label: "Overdue", description: "Slot passed, not completed", dot: "bg-danger" },
  { key: "completed", label: "Completed", description: "Interview done", dot: "bg-success" },
];

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
  booking: InterviewBooking;
  assignment?: CallAssignment;
  agent?: AgentProfile;
  bucket: Bucket;
}

function SchedulingPageInner() {
  const campaign = useCampaignDetail();
  const { db, actions } = useStore();
  const { session } = useAdminSession();
  const actor = session?.name ?? "Toni";
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get("filter") as Bucket | null) ?? "unassigned";
  const [view, setView] = useState<"board" | "table">("board");
  const [activeBucket, setActiveBucket] = useState<Bucket>(
    BUCKET_COLUMNS.some((t) => t.key === initialFilter) ? initialFilter : "unassigned"
  );
  const [pendingAgent, setPendingAgent] = useState<Record<string, string>>({});

  const campaignAgentIds = db.campaignAgents
    .filter((ca) => ca.campaignId === campaign.id && ca.active)
    .map((ca) => ca.agentId);
  const activeAgents = db.agents.filter((a) => a.status === "active");
  const assignableAgents =
    campaignAgentIds.length > 0
      ? activeAgents.filter((a) => campaignAgentIds.includes(a.id))
      : activeAgents;

  const rows = useMemo<SchedulingRow[]>(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const participants = db.participants.filter((p) => p.campaignId === campaign.id);
    const result: SchedulingRow[] = [];

    for (const participant of participants) {
      const booking = [...db.bookings]
        .filter((b) => b.participantId === participant.id && b.status !== "cancelled")
        .sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart))[0];
      if (!booking) continue;

      const contact = db.contacts.find((c) => c.id === participant.contactId);
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

      result.push({
        participantId: participant.id,
        contactName: contact?.name ?? "Unknown contact",
        booking,
        assignment,
        agent,
        bucket,
      });
    }

    return result.sort((a, b) => a.booking.scheduledStart.localeCompare(b.booking.scheduledStart));
  }, [db, campaign.id]);

  const counts = BUCKET_COLUMNS.reduce<Record<Bucket, number>>((acc, tab) => {
    acc[tab.key] = rows.filter((r) => r.bucket === tab.key).length;
    return acc;
  }, {} as Record<Bucket, number>);

  const visibleRows = rows.filter((r) => r.bucket === activeBucket);

  function handleAssign(row: SchedulingRow) {
    const agentId = pendingAgent[row.participantId];
    if (!agentId) return;
    if (row.assignment) {
      actions.reassignParticipant(row.assignment.id, agentId, actor);
    } else {
      actions.assignParticipant(campaign.id, row.participantId, agentId, actor);
    }
    setPendingAgent((prev) => ({ ...prev, [row.participantId]: "" }));
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
          disabled={!pendingAgent[row.participantId]}
          className={compact ? "w-full justify-center" : undefined}
        >
          {row.assignment ? "Reassign" : "Assign"}
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
                    colRows.map((row) => (
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
                          {formatDate(row.booking.scheduledStart)} · {formatTime(row.booking.scheduledStart)}
                        </p>
                        {col.key !== "completed" ? (
                          <div className="mt-2">
                            <AssignControl row={row} compact />
                          </div>
                        ) : row.assignment ? (
                          <div className="mt-2">
                            <AssignmentStatusBadge status={row.assignment.status} />
                          </div>
                        ) : null}
                      </Card>
                    ))
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
                        {activeBucket !== "completed" ? (
                          <th className="px-5 py-3 font-medium">Action</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => (
                        <tr key={row.participantId} className="border-b border-border last:border-0">
                          <td className="px-5 py-3 font-medium text-foreground">{row.contactName}</td>
                          <td className="px-5 py-3 tabular-nums text-foreground-muted">
                            {formatDateTime(row.booking.scheduledStart)}
                          </td>
                          <td className="px-5 py-3 text-foreground-muted">{row.booking.status}</td>
                          <td className="px-5 py-3 text-foreground-muted">{row.agent?.name ?? "—"}</td>
                          <td className="px-5 py-3">
                            {row.assignment ? (
                              <AssignmentStatusBadge status={row.assignment.status} />
                            ) : (
                              <span className="text-foreground-subtle">—</span>
                            )}
                          </td>
                          {activeBucket !== "completed" ? (
                            <td className="px-5 py-3">
                              <AssignControl row={row} />
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
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
