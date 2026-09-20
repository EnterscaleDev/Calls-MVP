"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SENSITIVE_ACTIONS, ACCESS_ACTIONS, describeAction } from "@/lib/audit-labels";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, LoadingScreen, ErrorState } from "@/components/ui/States";
import { Pagination } from "@/components/ui/Pagination";
import { formatDateTime } from "../../../../_lib/format";
import type { AuditEvent } from "@/lib/types";
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

/** Server-paginated — same reasoning as the org-wide Settings & audit page:
 *  audit_events is append-only and unbounded, so this queries only the
 *  current page for this campaign rather than reading the full org-wide
 *  array useAdminData() already loaded for the rest of this page. */
export function CampaignAuditCard({ campaignId }: { campaignId: string }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function updatePageSize(v: number) {
    setPageSize(v);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    supabase
      .from("audit_events")
      .select("*", { count: "exact" })
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .range(from, to)
      .then(({ data, count, error: queryError }) => {
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
  }, [campaignId, page, pageSize]);

  return (
    <Card>
      <CardHeader title="Campaign audit" description="Every recorded action for this campaign, most recent first." />
      <CardBody className="p-0">
        {loading && events.length === 0 ? (
          <div className="p-5">
            <LoadingScreen label="Loading audit log..." />
          </div>
        ) : error ? (
          <div className="p-5">
            <ErrorState title="Couldn't load the audit log" description={error} />
          </div>
        ) : events.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Nothing logged yet" description="Actions on this campaign will appear here." />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {events.map((event) => (
                <li key={event.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{describeAction(event.action)}</p>
                      {ACCESS_ACTIONS.has(event.action) ? <Badge tone="info">Access</Badge> : null}
                      {SENSITIVE_ACTIONS.has(event.action) ? <Badge tone="danger">Sensitive</Badge> : null}
                    </div>
                    <p className="text-xs text-foreground-muted">
                      {event.entityType.replace(/_/g, " ")} · {event.actorName}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-xs text-foreground-subtle">
                    {formatDateTime(event.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="border-t border-border">
              <Pagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} onPageSizeChange={updatePageSize} />
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
