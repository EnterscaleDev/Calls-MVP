"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminData } from "@/lib/hooks/useAdminData";
import { getCampaignFunnel, getCampaignMetrics } from "@/lib/selectors";
import { LoadingScreen, EmptyState, ErrorState } from "@/components/ui/States";
import { Card, CardBody } from "@/components/ui/Card";
import { CampaignStatusBadge, CampaignTypeChip } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Form";
import { ProgressBar } from "@/components/ui/Progress";
import { formatDate, formatPercent } from "../_lib/format";
import type { CampaignStatus } from "@/lib/types";

export default function CampaignsListPage() {
  const { data: db, loading, error } = useAdminData();
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | CampaignStatus>("all");

  if (loading || !db) return <LoadingScreen label="Loading campaigns..." />;
  if (error) return <ErrorState title="Couldn't load campaigns" description={error} />;

  const clients = [...new Set(db.campaigns.map((c) => c.clientName))].sort();

  const campaigns = [...db.campaigns]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .filter((c) => {
      const matchesSearch =
        !search.trim() ||
        c.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        c.clientName.toLowerCase().includes(search.trim().toLowerCase());
      const matchesClient = clientFilter === "all" || c.clientName === clientFilter;
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      return matchesSearch && matchesClient && matchesStatus;
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-caps text-foreground-subtle">All clients</p>
          <h1 className="text-page-title">Campaigns</h1>
        </div>
        <ButtonLink href="/admin/campaigns/new">New campaign</ButtonLink>
      </div>

      {db.campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create your first campaign to start recruiting participants."
          action={<ButtonLink href="/admin/campaigns/new">New campaign</ButtonLink>}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search campaigns"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="w-44">
              <option value="all">All clients</option>
              {clients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | CampaignStatus)}
              className="w-40"
            >
              <option value="all">Any status</option>
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </Select>
          </div>

          <Card>
            <CardBody className="p-0">
              {campaigns.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No matches" description="Try a different search or filter." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-subtle">
                        <th className="px-5 py-3 font-medium">Campaign</th>
                        <th className="px-5 py-3 font-medium">Type</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 font-medium">Dates</th>
                        <th className="px-5 py-3 font-medium">Contacts</th>
                        <th className="px-5 py-3 font-medium">Completed</th>
                        <th className="px-5 py-3 font-medium">Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((campaign) => {
                        const funnel = getCampaignFunnel(db, campaign.id);
                        const metrics = getCampaignMetrics(db, campaign.id);
                        const engagedRate = funnel.contacts > 0 ? funnel.optedIn / funnel.contacts : 0;
                        return (
                          <tr key={campaign.id} className="border-b border-border last:border-0 align-top">
                            <td className="max-w-[240px] px-5 py-3">
                              <Link
                                href={`/admin/campaigns/${campaign.id}`}
                                className="font-medium text-foreground hover:text-primary hover:underline"
                              >
                                {campaign.name}
                              </Link>
                              <p className="mt-0.5 truncate text-xs text-foreground-muted">
                                {campaign.clientName}
                              </p>
                              {campaign.incentiveTitle ? (
                                <p className="mt-0.5 truncate text-xs text-foreground-subtle">
                                  {campaign.incentiveTitle}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-5 py-3">
                              <CampaignTypeChip>Interview</CampaignTypeChip>
                            </td>
                            <td className="px-5 py-3">
                              <CampaignStatusBadge status={campaign.status} />
                            </td>
                            <td className="px-5 py-3 text-xs text-foreground-muted">
                              <p>{formatDate(campaign.startDate)}</p>
                              <p>{formatDate(campaign.endDate)}</p>
                            </td>
                            <td className="px-5 py-3 tabular-nums text-foreground-muted">
                              {funnel.contacts}
                              <p className="text-xs text-foreground-subtle">
                                {formatPercent(engagedRate)} opted in
                              </p>
                            </td>
                            <td className="px-5 py-3 tabular-nums text-foreground-muted">
                              {funnel.completed}
                            </td>
                            <td className="px-5 py-3">
                              <div className="w-28">
                                <ProgressBar value={metrics.completionRate} />
                                <p className="mt-1 text-xs text-foreground-subtle">
                                  {formatPercent(metrics.completionRate)} of {campaign.targetCompletions}
                                </p>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
