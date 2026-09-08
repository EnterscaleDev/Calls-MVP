"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { getCampaignFunnel, getCampaignMetrics } from "@/lib/selectors";
import { LoadingScreen, EmptyState } from "@/components/ui/States";
import { Card, CardBody } from "@/components/ui/Card";
import { CampaignStatusBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { formatPercent } from "../_lib/format";

export default function CampaignsListPage() {
  const { ready, db } = useStore();

  if (!ready) return <LoadingScreen label="Loading campaigns..." />;

  const campaigns = [...db.campaigns].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Campaigns</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Every research campaign, active or otherwise.
          </p>
        </div>
        <ButtonLink href="/admin/campaigns/new">New Campaign</ButtonLink>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create your first campaign to start recruiting participants."
          action={<ButtonLink href="/admin/campaigns/new">New Campaign</ButtonLink>}
        />
      ) : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-subtle">
                  <th className="px-5 py-3 font-medium">Campaign</th>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Participants</th>
                  <th className="px-5 py-3 font-medium">Target</th>
                  <th className="px-5 py-3 font-medium">Completion %</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const funnel = getCampaignFunnel(db, campaign.id);
                  const metrics = getCampaignMetrics(db, campaign.id);
                  return (
                    <tr key={campaign.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/campaigns/${campaign.id}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {campaign.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-foreground-muted">{campaign.clientName}</td>
                      <td className="px-5 py-3">
                        <CampaignStatusBadge status={campaign.status} />
                      </td>
                      <td className="px-5 py-3 tabular-nums text-foreground-muted">
                        {funnel.contacts}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-foreground-muted">
                        {campaign.targetCompletions}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-foreground-muted">
                        {formatPercent(metrics.completionRate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
