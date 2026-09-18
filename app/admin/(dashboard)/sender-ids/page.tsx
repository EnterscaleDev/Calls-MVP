"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAdminData } from "@/lib/hooks/useAdminData";
import { Card, CardHeader, CardBody, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { InlineBanner, EmptyState, LoadingScreen, ErrorState } from "@/components/ui/States";
import { formatDateTime } from "../_lib/format";
import type { Database } from "@/lib/supabase/database.types";

type SenderIdRow = Database["public"]["Tables"]["sender_ids"]["Row"];

const STATUS_TONE = {
  pending: "warning",
  active: "success",
  rejected: "danger",
} as const;

export default function SenderIdsPage() {
  const { data: db } = useAdminData();
  const [rows, setRows] = useState<SenderIdRow[] | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [senderId, setSenderId] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function refetch() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sender_ids")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError("");
    setRows(data ?? []);
  }

  useEffect(() => {
    refetch();
    const supabase = createClient();
    supabase
      .from("organisations")
      .select("id")
      .single()
      .then(({ data }) => setOrgId(data?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim() || !senderId.trim()) {
      setFormError("Enter a client name and the sender ID.");
      return;
    }
    setSaving(true);
    setFormError("");
    if (!orgId) {
      setSaving(false);
      setFormError("Still loading your organisation — try again in a moment.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("sender_ids").insert({
      client_name: clientName.trim(),
      sender_id: senderId.trim(),
      organisation_id: orgId,
    });
    setSaving(false);
    if (error) {
      setFormError(
        error.code === "23505"
          ? "That sender ID is already registered."
          : "Something went wrong requesting this sender ID. Try again."
      );
      return;
    }
    setRequestOpen(false);
    setClientName("");
    setSenderId("");
    await refetch();
  }

  async function setStatus(id: string, status: "active" | "rejected") {
    const supabase = createClient();
    await supabase
      .from("sender_ids")
      .update({ status, approved_at: status === "active" ? new Date().toISOString() : null })
      .eq("id", id);
    await refetch();
  }

  if (!db || rows === null) return <LoadingScreen label="Loading sender IDs..." />;
  if (loadError) return <ErrorState title="Couldn't load sender IDs" description={loadError} />;

  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const activeCount = rows.filter((r) => r.status === "active").length;

  function usedBy(row: SenderIdRow): string[] {
    return db!.campaigns.filter((c) => c.senderId === row.sender_id).map((c) => c.name);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-page-title">Sender IDs</h1>
          <p className="mt-1 text-page-subtitle">
            Sender IDs belong to a client and are reused across that client&apos;s campaigns. Carrier
            approval happens outside this product — request the ID as soon as a campaign is scoped, not
            when it&apos;s ready to send.
          </p>
        </div>
        <Button onClick={() => setRequestOpen(true)}>Request sender ID</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Registered" value={rows.length} />
        <StatCard label="Active" value={activeCount} />
        <StatCard label="Pending approval" value={pendingCount} hint="Not usable until active" tone={pendingCount > 0 ? "warning" : "default"} />
      </div>

      <Card>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No sender IDs yet" description="Request one before launching a campaign." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-subtle">
                    <th className="px-5 py-3 font-medium">Sender ID</th>
                    <th className="px-5 py-3 font-medium">Client</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Requested</th>
                    <th className="px-5 py-3 font-medium">Approved</th>
                    <th className="px-5 py-3 font-medium">Used by</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const campaigns = usedBy(row);
                    return (
                      <tr key={row.id} className="border-b border-border last:border-0">
                        <td className="px-5 py-3 font-medium text-foreground">{row.sender_id}</td>
                        <td className="px-5 py-3 text-foreground-muted">{row.client_name}</td>
                        <td className="px-5 py-3">
                          <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                        </td>
                        <td className="px-5 py-3 text-foreground-muted">{formatDateTime(row.requested_at)}</td>
                        <td className="px-5 py-3 text-foreground-muted">
                          {row.approved_at ? formatDateTime(row.approved_at) : "—"}
                        </td>
                        <td className="px-5 py-3 text-foreground-muted">
                          {campaigns.length > 0 ? campaigns.join(", ") : "Not in use"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {row.status === "pending" ? (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="secondary" onClick={() => setStatus(row.id, "active")}>
                                Mark approved
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setStatus(row.id, "rejected")}>
                                Reject
                              </Button>
                            </div>
                          ) : null}
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

      <Modal
        open={requestOpen}
        onClose={() => (saving ? undefined : setRequestOpen(false))}
        title="Request a sender ID"
        description="This just registers it here for tracking — actual carrier approval happens with your SMS provider."
      >
        <form onSubmit={handleRequest} className="flex flex-col gap-4">
          {formError ? <InlineBanner kind="danger">{formError}</InlineBanner> : null}
          <Field label="Client">
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Hexia Health" />
          </Field>
          <Field label="Sender ID" hint="Exact case matters — must match what's registered with your SMS provider.">
            <Input value={senderId} onChange={(e) => setSenderId(e.target.value)} placeholder="e.g. Hexia" />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setRequestOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Requesting..." : "Request"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
