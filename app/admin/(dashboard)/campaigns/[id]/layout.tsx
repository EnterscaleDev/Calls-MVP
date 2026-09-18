"use client";

import { use } from "react";
import Link from "next/link";
import { useAdminData } from "@/lib/hooks/useAdminData";
import { getCampaign } from "@/lib/selectors";
import { LoadingScreen, ErrorState } from "@/components/ui/States";
import { CampaignStatusBadge, CampaignTypeChip } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { LinkTabs } from "@/components/ui/Tabs";
import { formatDate } from "../../_lib/format";
import { CampaignDetailProvider } from "./campaign-context";

export default function CampaignDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: db, loading, error } = useAdminData();

  if (loading || !db) return <LoadingScreen label="Loading campaign..." />;

  const campaign = error ? undefined : getCampaign(db, id);
  if (!campaign) {
    return (
      <ErrorState
        title="Campaign not found"
        description="This campaign may have been removed, or the link is out of date."
        action={
          <ButtonLink href="/admin/campaigns" variant="secondary">
            Back to campaigns
          </ButtonLink>
        }
      />
    );
  }

  const tabs = [
    { href: `/admin/campaigns/${id}`, label: "Overview" },
    { href: `/admin/campaigns/${id}/audience`, label: "Audience" },
    { href: `/admin/campaigns/${id}/invitations`, label: "Invitations" },
    { href: `/admin/campaigns/${id}/scheduling`, label: "Scheduling" },
    { href: `/admin/campaigns/${id}/agents`, label: "Agents" },
    { href: `/admin/campaigns/${id}/call-script`, label: "Call Script" },
    { href: `/admin/campaigns/${id}/call-activity`, label: "Call Activity" },
    { href: `/admin/campaigns/${id}/settings`, label: "Settings" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/admin/campaigns"
          className="text-xs font-medium text-foreground-muted hover:text-foreground"
        >
          ← All campaigns
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-page-title">{campaign.name}</h1>
              <CampaignTypeChip>Telephone Interview</CampaignTypeChip>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            <p className="mt-1 text-page-subtitle">{campaign.clientName}</p>
          </div>
          <div className="text-right text-sm text-foreground-muted">
            <p>
              {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
            </p>
            <p className="mt-0.5">Target: {campaign.targetCompletions} completions</p>
          </div>
        </div>
        {campaign.researchObjective ? (
          <p className="mt-3 max-w-3xl text-sm text-foreground-muted">
            {campaign.researchObjective}
          </p>
        ) : null}
      </div>

      <LinkTabs tabs={tabs} />

      <CampaignDetailProvider campaign={campaign}>{children}</CampaignDetailProvider>
    </div>
  );
}
