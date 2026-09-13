"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createParticipantClient } from "./supabase/participant-client";

export interface ParticipantCampaign {
  id: string;
  name: string;
  clientName: string;
  researchObjective: string;
  incentiveTitle: string;
  incentiveDescription: string;
  recordingEnabled: boolean;
  estimatedDurationMinutes: number;
}

export interface ParticipantBooking {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface ParticipantTokenData {
  token: string;
  campaign: ParticipantCampaign;
  participantId: string;
  firstName: string;
  booking?: ParticipantBooking;
  hasAgreedParticipation: boolean;
  hasDeclined: boolean;
  /** Re-resolves the token against the RPC — call after any mutation before
   * navigating, since this context (shared across the whole /participate/[token]
   * route tree via the layout) doesn't otherwise know a mutation happened. */
  refetch: () => Promise<void>;
}

type FallbackState = "loading" | "not_found" | "expired" | "revoked";
type Resolution =
  | { kind: FallbackState }
  | { kind: "ok"; data: Omit<ParticipantTokenData, "token" | "refetch"> };

async function resolveToken(token: string): Promise<Resolution> {
  const supabase = createParticipantClient();
  const { data, error } = await supabase.rpc("resolve_participant_by_token", { p_token: token });

  if (error || !data || data.length === 0) return { kind: "not_found" };
  const row = data[0];

  if (row.resolution_status === "expired") return { kind: "expired" };
  if (row.resolution_status === "revoked") return { kind: "revoked" };
  if (row.resolution_status !== "ok") return { kind: "not_found" };

  return {
    kind: "ok",
    data: {
      campaign: {
        id: row.campaign_id!,
        name: row.campaign_name!,
        clientName: row.client_name!,
        researchObjective: row.research_objective!,
        incentiveTitle: row.incentive_title!,
        incentiveDescription: row.incentive_description!,
        recordingEnabled: row.recording_enabled!,
        estimatedDurationMinutes: row.estimated_duration_minutes!,
      },
      participantId: row.participant_id!,
      firstName: row.first_name!,
      booking:
        row.booking_id && row.scheduled_start && row.scheduled_end
          ? { id: row.booking_id, scheduledStart: row.scheduled_start, scheduledEnd: row.scheduled_end }
          : undefined,
      hasAgreedParticipation: !!row.has_agreed_participation,
      hasDeclined: !!row.has_declined,
    },
  };
}

const ParticipantTokenContext = createContext<ParticipantTokenData | null>(null);

/** Renders children only once the token has resolved to a valid, live participant. */
export function ParticipantTokenProvider({
  token,
  children,
  fallback,
}: {
  token: string;
  children: ReactNode;
  fallback: (state: FallbackState) => ReactNode;
}) {
  const [resolution, setResolution] = useState<Resolution>({ kind: "loading" });

  const refetch = useCallback(async () => {
    setResolution(await resolveToken(token));
  }, [token]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  if (resolution.kind !== "ok") return <>{fallback(resolution.kind)}</>;

  const value: ParticipantTokenData = { token, refetch, ...resolution.data };

  return (
    <ParticipantTokenContext.Provider value={value}>{children}</ParticipantTokenContext.Provider>
  );
}

export function useParticipantToken(): ParticipantTokenData {
  const ctx = useContext(ParticipantTokenContext);
  if (!ctx) {
    throw new Error("useParticipantToken must be used within ParticipantTokenProvider");
  }
  return ctx;
}

// --- Participant-local mutations. Anon key only, no session, ever — the
// token itself (re-validated server-side inside each RPC on every call) is
// the sole credential. Never shared with the admin/agent data layer. -------

export async function recordParticipantConsent(
  token: string,
  consentType: "participation" | "recording",
  consentStatus: "agreed" | "declined",
  source = "participant_link"
): Promise<void> {
  const supabase = createParticipantClient();
  const { error } = await supabase.rpc("record_participant_consent", {
    p_token: token,
    p_consent_type: consentType,
    p_consent_status: consentStatus,
    p_source: source,
  });
  if (error) throw error;
}

export async function createParticipantBooking(
  token: string,
  start: string,
  end: string,
  timezone: string
): Promise<string> {
  const supabase = createParticipantClient();
  const { data, error } = await supabase.rpc("create_participant_booking", {
    p_token: token,
    p_start: start,
    p_end: end,
    p_timezone: timezone,
  });
  if (error) throw error;
  return data as string;
}

export async function rescheduleParticipantBooking(
  token: string,
  bookingId: string,
  start: string,
  end: string,
  timezone: string
): Promise<string> {
  const supabase = createParticipantClient();
  const { data, error } = await supabase.rpc("reschedule_participant_booking", {
    p_token: token,
    p_booking_id: bookingId,
    p_start: start,
    p_end: end,
    p_timezone: timezone,
  });
  if (error) throw error;
  return data as string;
}

export async function cancelParticipantBooking(token: string, bookingId: string): Promise<void> {
  const supabase = createParticipantClient();
  const { error } = await supabase.rpc("cancel_participant_booking", {
    p_token: token,
    p_booking_id: bookingId,
  });
  if (error) throw error;
}
