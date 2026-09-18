"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAdminData } from "@/lib/hooks/useAdminData";
import { Card, CardHeader, CardBody, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Form";
import { InlineBanner, EmptyState, LoadingScreen, ErrorState } from "@/components/ui/States";
import { formatDateTime } from "../_lib/format";
import type { Database } from "@/lib/supabase/database.types";

type CreditTransactionRow = Database["public"]["Tables"]["credit_transactions"]["Row"];
type DotgoBalanceState =
  | { status: "idle" | "loading" }
  | { status: "ok"; currency: string; amount: number; mode: string; accountName: string }
  | { status: "error"; errorReason: string };

export default function CreditsPage() {
  const { data: db, loading: dbLoading, error: dbError } = useAdminData();
  const [transactions, setTransactions] = useState<CreditTransactionRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [accountFilter, setAccountFilter] = useState<"all" | "sms" | "voice">("all");
  const [dotgoBalance, setDotgoBalance] = useState<DotgoBalanceState>({ status: "idle" });

  async function fetchDotgoBalance() {
    setDotgoBalance({ status: "loading" });
    const response = await fetch("/api/credits/dotgo-balance");
    const result = await response.json().catch(() => ({ ok: false, errorReason: "Unexpected response." }));
    if (result.ok) {
      setDotgoBalance({
        status: "ok",
        currency: result.currency,
        amount: result.amount,
        mode: result.mode,
        accountName: result.accountName,
      });
    } else {
      setDotgoBalance({ status: "error", errorReason: result.errorReason ?? "Couldn't fetch Dotgo balance." });
    }
  }

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("credit_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setLoadError(error.message);
          return;
        }
        setTransactions(data ?? []);
      });
  }, []);

  const campaignName = (id: string | null) => db?.campaigns.find((c) => c.id === id)?.name;

  const filtered = useMemo(() => {
    if (!transactions) return [];
    return accountFilter === "all" ? transactions : transactions.filter((t) => t.account === accountFilter);
  }, [transactions, accountFilter]);

  const spendByCampaign = useMemo(() => {
    if (!transactions) return [];
    const totals = new Map<string, { sms: number; voice: number }>();
    for (const t of transactions) {
      if (t.amount >= 0 || !t.campaign_id) continue;
      const entry = totals.get(t.campaign_id) ?? { sms: 0, voice: 0 };
      entry[t.account as "sms" | "voice"] += -t.amount;
      totals.set(t.campaign_id, entry);
    }
    return [...totals.entries()]
      .map(([campaignId, spend]) => ({
        campaignId,
        name: campaignName(campaignId) ?? "Deleted campaign",
        ...spend,
        total: spend.sms + spend.voice,
      }))
      .sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, db]);

  if (dbLoading || !db || transactions === null) return <LoadingScreen label="Loading credits..." />;
  if (dbError) return <ErrorState title="Couldn't load credits" description={dbError} />;
  if (loadError) return <ErrorState title="Couldn't load the credit ledger" description={loadError} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-page-title">Credits &amp; billing</h1>
          <p className="mt-1 text-page-subtitle">
            Messaging and voice are bought and spent separately — running out of one doesn&apos;t stop the
            other.
          </p>
        </div>
        <Link
          href="/admin/overview"
          className="text-[13.5px] font-semibold text-primary hover:underline"
        >
          Top up →
        </Link>
      </div>

      <StatCard label="Voice credit" value={`${db.orgCredits.voiceMinutes.toLocaleString()} min`} />

      <Card>
        <CardHeader
          title="Real Dotgo balance"
          description="Your actual SMS provider balance, fetched live — not automatically kept in sync with anything else in this app."
        />
        <CardBody className="flex flex-col gap-3">
          {dotgoBalance.status === "ok" ? (
            <div>
              <p className="text-stat-value text-foreground">
                {dotgoBalance.currency} {dotgoBalance.amount.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-foreground-muted">
                {dotgoBalance.accountName} · {dotgoBalance.mode === "paid" ? "Paid account" : dotgoBalance.mode}
              </p>
            </div>
          ) : dotgoBalance.status === "error" ? (
            <InlineBanner kind="danger">{dotgoBalance.errorReason}</InlineBanner>
          ) : (
            <p className="text-sm text-foreground-muted">Not fetched yet.</p>
          )}
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchDotgoBalance}
              disabled={dotgoBalance.status === "loading"}
            >
              {dotgoBalance.status === "loading" ? "Fetching..." : "Fetch real balance"}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Spend by campaign"
          description="SMS sends are charged automatically. Voice isn't yet — real call billing isn't wired up."
        />
        <CardBody className="p-0">
          {spendByCampaign.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No spend recorded yet" description="Send a campaign's invitations to see spend here." />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {spendByCampaign.map((row) => (
                <li key={row.campaignId} className="flex items-center justify-between gap-3 px-5 py-3">
                  <p className="text-card-title">{row.name}</p>
                  <p className="text-supporting">
                    {row.sms > 0 ? `SMS ${row.sms.toLocaleString()}` : null}
                    {row.sms > 0 && row.voice > 0 ? " · " : null}
                    {row.voice > 0 ? `Voice ${row.voice.toLocaleString()}` : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Ledger" description="Every top-up and charge, newest first." />
        <CardBody className="flex flex-col gap-4">
          <Select className="w-44" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value as typeof accountFilter)}>
            <option value="all">All accounts</option>
            <option value="sms">SMS</option>
            <option value="voice">Voice</option>
          </Select>
          {filtered.length === 0 ? (
            <EmptyState title="Nothing in the ledger yet" description="Top-ups and SMS sends will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-subtle">
                    <th className="px-5 py-3 font-medium">When</th>
                    <th className="px-5 py-3 font-medium">Account</th>
                    <th className="px-5 py-3 font-medium">Detail</th>
                    <th className="px-5 py-3 font-medium">Campaign</th>
                    <th className="px-5 py-3 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 text-foreground-muted">{formatDateTime(t.created_at)}</td>
                      <td className="px-5 py-3 uppercase text-foreground-muted">{t.account}</td>
                      <td className="px-5 py-3 text-foreground">{t.detail}</td>
                      <td className="px-5 py-3 text-foreground-muted">{campaignName(t.campaign_id) ?? "—"}</td>
                      <td
                        className={`px-5 py-3 text-right font-medium tabular-nums ${
                          t.amount >= 0 ? "text-success" : "text-foreground"
                        }`}
                      >
                        {t.amount >= 0 ? "+" : ""}
                        {t.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
