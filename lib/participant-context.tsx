"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useStore } from "./store";
import { resolveParticipantByToken } from "./selectors";
import type { Campaign, CampaignParticipant, InterviewBooking } from "./types";

export interface ParticipantTokenData {
  token: string;
  campaign: Campaign;
  participant: CampaignParticipant;
  firstName: string;
  booking?: InterviewBooking;
  hasAgreedParticipation: boolean;
  hasDeclined: boolean;
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
  fallback: (state: "loading" | "not_found" | "expired" | "revoked") => ReactNode;
}) {
  const { ready, db } = useStore();

  const resolved = useMemo(() => {
    if (!ready) return null;
    return resolveParticipantByToken(db, token);
  }, [ready, db, token]);

  if (!ready || !resolved) return <>{fallback("loading")}</>;
  if (resolved.kind === "not_found") return <>{fallback("not_found")}</>;
  if (resolved.kind === "expired") return <>{fallback("expired")}</>;
  if (resolved.kind === "revoked") return <>{fallback("revoked")}</>;

  const value: ParticipantTokenData = {
    token,
    campaign: resolved.campaign,
    participant: resolved.participant,
    firstName: resolved.firstName,
    booking: resolved.booking,
    hasAgreedParticipation: resolved.hasAgreedParticipation,
    hasDeclined: resolved.hasDeclined,
  };

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
