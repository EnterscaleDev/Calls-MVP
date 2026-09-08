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
import { formatDateTime } from "../../../_lib/format";
import { useCampaignDetail } from "../campaign-context";
import type { AgentProfile, InterviewBooking, CallAssignment } from "@/lib/types";

type Bucket = "unassigned" | "today" | "upcoming" | "overdue" | "completed";

const BUCKET_TABS: { key: Bucket; label: string }[] = [
  { key: "unassigned", label: "Unassigned" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

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
  const [activeBucket, setActiveBucket] = useState<Bucket>(
    BUCKET_TABS.some((t) => t.key === initialFilter) ? initialFilter : "unassigned"
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

  const counts = BUCKET_TABS.reduce<Record<Bucket, number>>((acc, tab) => {
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
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {BUCKET_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveBucket(tab.key)}
            className={`whitespace-nowrap rounded-t-[5px] px-3 py-2.5 text-[12.5px] font-semibold transition-colors ${
              activeBucket === tab.key ? "text-foreground" : "text-foreground-muted hover:text-foreground"
            }`}
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
                title={`No participants in "${BUCKET_TABS.find((t) => t.key === activeBucket)?.label}"`}
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
                          {assignableAgents.length === 0 ? (
                            <span className="text-xs text-foreground-subtle">No active agents available</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Select
                                className="w-40"
                                value={pendingAgent[row.participantId] ?? row.agent?.id ?? ""}
                                onChange={(e) =>
                                  setPendingAgent((prev) => ({ ...prev, [row.participantId]: e.target.value }))
                                }
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
                              >
                                {row.assignment ? "Reassign" : "Assign"}
                              </Button>
                            </div>
                          )}
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
