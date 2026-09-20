"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SENSITIVE_ACTIONS, ACCESS_ACTIONS, describeAction } from "@/lib/audit-labels";
import { Card, CardBody } from "@/components/ui/Card";
import { Select } from "@/components/ui/Form";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, LoadingScreen, ErrorState } from "@/components/ui/States";
import { Pagination } from "@/components/ui/Pagination";
import { formatDateTime } from "../_lib/format";
import type { ActorType, AuditEvent } from "@/lib/types";
import type { Database } from "@/lib/supabase/database.types";

type AuditEventRow = Database["public"]["Tables"]["audit_events"]["Row"];

function mapEvent(row: AuditEventRow): AuditEvent {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    campaignId: row.campaign_id ?? undefined,
    actorType: row.actor_type,
    actorName: row.actor_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: (row.metadata as Record<string, string | number | boolean>) ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Org-wide audit log — server-paginated. audit_events is append-only and
 * grows without bound, so unlike most admin screens (which still fetch
 * everything via useAdminData at this app's current scale) this one always
 * queries only the current page, with actor/campaign filters and total
 * count computed server-side too.
 */
export default function SettingsPage() {
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [actorFilter, setActorFilter] = useState<"all" | ActorType>("all");
  const [campaignFilter, setCampaignFilter] = useState<"all" | string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("campaigns")
      .select("id, name")
      .order("name")
      .then(({ data }) => setCampaigns(data ?? []));
  }, []);

  // Any filter/page-size change resets to page 1 — done directly in these
  // setters (not a reactive effect) so there's no synchronous
  // setState-in-effect.
  function updateActorFilter(v: "all" | ActorType) {
    setActorFilter(v);
    setPage(1);
  }
  function updateCampaignFilter(v: "all" | string) {
    setCampaignFilter(v);
    setPage(1);
  }
  function updatePageSize(v: number) {
    setPageSize(v);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from("audit_events")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (actorFilter !== "all") query = query.eq("actor_type", actorFilter);
    if (campaignFilter !== "all") query = query.eq("campaign_id", campaignFilter);

    query.then(({ data, count, error: queryError }) => {
      if (cancelled) return;
      setLoading(false);
      if (queryError) {
        setError(queryError.message);
        return;
      }
      setEvents((data ?? []).map(mapEvent));
      setTotalCount(count ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, [actorFilter, campaignFilter, page, pageSize]);

  const campaignName = (id?: string) => campaigns.find((c) => c.id === id)?.name;

  if (loading && events.length === 0) return <LoadingScreen label="Loading audit log..." />;
  if (error) return <ErrorState title="Couldn't load the audit log" description={error} />;

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
          onChange={(e) => updateActorFilter(e.target.value as "all" | ActorType)}
        >
          <option value="all">Any actor</option>
          <option value="admin">Admin</option>
          <option value="agent">Agent</option>
          <option value="participant">Participant</option>
          <option value="system">System</option>
        </Select>
        <Select className="w-64" value={campaignFilter} onChange={(e) => updateCampaignFilter(e.target.value)}>
          <option value="all">All campaigns</option>
          {campaigns.map((c) => (
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
              <EmptyState
                title={actorFilter === "all" && campaignFilter === "all" ? "Nothing logged yet" : "No matches"}
                description={
                  actorFilter === "all" && campaignFilter === "all"
                    ? "Actions will appear here as they happen."
                    : "Try a different actor or campaign filter."
                }
              />
            </div>
          ) : (
            <>
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
              <div className="border-t border-border">
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  totalCount={totalCount}
                  onPageChange={setPage}
                  onPageSizeChange={updatePageSize}
                />
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
