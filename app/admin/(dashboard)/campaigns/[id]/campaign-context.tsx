"use client";

// Shared "does this campaign id resolve" guard for every page nested under
// /admin/campaigns/[id]/*. The layout does the lookup once and every child
// page reads the result from context instead of re-resolving + re-guarding.

import { createContext, useContext, type ReactNode } from "react";
import type { Campaign } from "@/lib/types";

const CampaignDetailContext = createContext<Campaign | null>(null);

export function CampaignDetailProvider({
  campaign,
  children,
}: {
  campaign: Campaign;
  children: ReactNode;
}) {
  return (
    <CampaignDetailContext.Provider value={campaign}>{children}</CampaignDetailContext.Provider>
  );
}

/** Only ever called from a page nested under a layout that already guarded the lookup. */
export function useCampaignDetail(): Campaign {
  const campaign = useContext(CampaignDetailContext);
  if (!campaign) {
    throw new Error(
      "useCampaignDetail() called outside a campaign detail route — this is a bug in the admin surface."
    );
  }
  return campaign;
}
