"use client";

import { useMemo, useState } from "react";
import { useAdminData } from "@/lib/hooks/useAdminData";
import { getAuditLog } from "@/lib/selectors";
import { SENSITIVE_ACTIONS, ACCESS_ACTIONS, describeAction } from "@/lib/audit-labels";
import { Card, CardBody } from "@/components/ui/Card";
import { Select } from "@/components/ui/Form";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, LoadingScreen, ErrorState } from "@/components/ui/States";
import { formatDateTime } from "../_lib/format";
import type { ActorType } from "@/lib/types";

export default function SettingsPage() {
  const { data: db, loading, error } = useAdminData();
  const [actorFilter, setActorFilter] = useState<"all" | ActorType>("all");
  const [campaignFilter, setCampaignFilter] = useState<"all" | string>("all");

  const events = useMemo(() => {
    if (!db) return [];
    return getAuditLog(db).filter(
      (e) =>
        (actorFilter === "all" || e.actorType === actorFilter) &&
        (campaignFilter === "all" || e.campaignId === campaignFilter)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, actorFilter, campaignFilter]);

  if (loading || !db) return <LoadingScreen label="Loading audit log..." />;
  if (error) return <ErrorState title="Couldn't load the audit log" description={error} />;

  const campaignName = (id?: string) => db.campaigns.find((c) => c.id === id)?.name;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-page-title">Settings &amp; audit</h1>
        <p className="mt-1 text-page-subtitle">
          Every recorded action across every campaign, newest first. Audit entries are written by the
          database and can&apos;t be edited or deleted by any role in this product.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select
          className="w-44"
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value as "all" | ActorType)}
        >
          <option value="all">Any actor</option>
          <option value="admin">Admin</option>
          <option value="agent">Agent</option>
          <option value="participant">Participant</option>
          <option value="system">System</option>
        </Select>
        <Select className="w-64" value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}>
          <option value="all">All campaigns</option>
          {db.campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <CardBody className="p-0">
          {events.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Nothing logged yet" description="Actions will appear here as they happen." />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {events.map((event) => (
                <li key={event.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{describeAction(event.action)}</p>
                      {ACCESS_ACTIONS.has(event.action) ? <Badge tone="info">Access</Badge> : null}
                      {SENSITIVE_ACTIONS.has(event.action) ? <Badge tone="danger">Sensitive</Badge> : null}
                    </div>
                    <p className="text-xs text-foreground-muted">
                      {event.entityType.replace(/_/g, " ")} · {event.actorName}
                      {campaignName(event.campaignId) ? ` · ${campaignName(event.campaignId)}` : ""}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-xs text-foreground-subtle">
                    {formatDateTime(event.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
