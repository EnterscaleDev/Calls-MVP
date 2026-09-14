"use client";

import { useAdminData } from "@/lib/hooks/useAdminData";
import { LoadingScreen, ErrorState } from "@/components/ui/States";
import { CallActivityBoard } from "../../../_lib/CallActivityBoard";
import { useCampaignDetail } from "../campaign-context";

export default function CampaignCallActivityPage() {
  const campaign = useCampaignDetail();
  const { data: db, loading, error } = useAdminData();

  if (loading || !db) return <LoadingScreen label="Loading call activity..." />;
  if (error) return <ErrorState title="Couldn't load call activity" description={error} />;

  return <CallActivityBoard db={db} campaignId={campaign.id} />;
}
