"use client";

import { useStore } from "@/lib/store";
import { CallActivityBoard } from "../../../_lib/CallActivityBoard";
import { useCampaignDetail } from "../campaign-context";

export default function CampaignCallActivityPage() {
  const campaign = useCampaignDetail();
  const { db } = useStore();
  return <CallActivityBoard db={db} campaignId={campaign.id} />;
}
