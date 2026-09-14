"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { AssignmentStatus, CallAttempt, CallOutcome } from "@/lib/types";

type QueueRow = Database["public"]["Functions"]["agent_call_queue"]["Returns"][number];
type CallAttemptRow = Database["public"]["Tables"]["call_attempts"]["Row"];
type CampaignRow = Pick<
  Database["public"]["Tables"]["campaigns"]["Row"],
  "id" | "name" | "estimated_duration_minutes" | "recording_enabled"
>;

export interface AgentCampaignInfo {
  name: string;
  estimatedDurationMinutes: number;
  recordingEnabled: boolean;
}

export interface AgentQueueEntry {
  assignmentId: string;
  participantAlias: string;
  campaignId: string;
  campaignName: string;
  bookingId: string;
  scheduledStart: string;
  scheduledEnd: string;
  estimatedDurationMinutes: number;
  status: AssignmentStatus;
  bucket: string;
  lastOutcome?: CallOutcome;
}

function mapCallAttempt(row: CallAttemptRow): CallAttempt {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    participantId: row.participant_id,
    assignmentId: row.assignment_id,
    agentId: row.agent_id,
    providerCallId: row.provider_call_id,
    startedAt: row.started_at ?? "",
    connectedAt: row.connected_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    status: row.status,
    disposition: row.disposition ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

export interface AgentData {
  queue: AgentQueueEntry[];
  callAttempts: CallAttempt[];
  campaigns: Map<string, AgentCampaignInfo>;
}

/**
 * agent_call_queue() returns every one of the current agent's non-cancelled
 * assignments (own rows only — RLS-scoped, no client-side agentId needed),
 * each pre-bucketed server-side (overdue/due_now/upcoming/completed_today/
 * other). Combined with the agent's own call_attempts (for last-outcome) and
 * their attached campaigns (for display duration + recording flag), this is
 * the single data source behind both the Today queue and the History page.
 */
export function useAgentData() {
  const [data, setData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const [queueRes, attemptsRes, campaignsRes] = await Promise.all([
      supabase.rpc("agent_call_queue"),
      supabase.from("call_attempts").select("*"),
      supabase.from("campaigns").select("id, name, estimated_duration_minutes, recording_enabled"),
    ]);

    const firstError = queueRes.error || attemptsRes.error || campaignsRes.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const campaigns = new Map<string, AgentCampaignInfo>(
      ((campaignsRes.data ?? []) as CampaignRow[]).map((c) => [
        c.id,
        { name: c.name, estimatedDurationMinutes: c.estimated_duration_minutes, recordingEnabled: c.recording_enabled },
      ])
    );

    const callAttempts = ((attemptsRes.data ?? []) as CallAttemptRow[]).map(mapCallAttempt);

    const lastOutcomeByAssignment = new Map<string, CallOutcome | undefined>();
    for (const attempt of [...callAttempts].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
      lastOutcomeByAssignment.set(attempt.assignmentId, attempt.disposition);
    }

    const queue: AgentQueueEntry[] = ((queueRes.data ?? []) as QueueRow[]).map((r) => {
      const campaignInfo = campaigns.get(r.campaign_id);
      return {
        assignmentId: r.assignment_id,
        participantAlias: r.participant_alias,
        campaignId: r.campaign_id,
        campaignName: campaignInfo?.name ?? r.campaign_name,
        bookingId: r.booking_id,
        scheduledStart: r.scheduled_start,
        scheduledEnd: r.scheduled_end,
        estimatedDurationMinutes: campaignInfo?.estimatedDurationMinutes ?? 30,
        status: r.assignment_status,
        bucket: r.bucket,
        lastOutcome: lastOutcomeByAssignment.get(r.assignment_id),
      };
    });

    setData({ queue, callAttempts, campaigns });
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
