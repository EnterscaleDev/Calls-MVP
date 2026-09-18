"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAdminData } from "@/lib/hooks/useAdminData";
import { getCampaignFunnel, getCampaignMetrics } from "@/lib/selectors";
import { LoadingScreen, InlineBanner, ErrorState } from "@/components/ui/States";
import { Card, CardHeader, CardBody, StatCard } from "@/components/ui/Card";
import { CampaignStatusBadge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/Progress";
import { formatPercent, isToday } from "../_lib/format";
import { SMS_TOP_UP_PACKAGES, VOICE_TOP_UP_PACKAGES, type TopUpPackage } from "../_lib/credits";
import type { AssignmentStatus } from "@/lib/types";

const ACTIVE_ASSIGNMENT_STATUSES: AssignmentStatus[] = ["assigned", "in_progress", "completed"];

export default function AdminOverviewPage() {
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpKind, setTopUpKind] = useState<"sms" | "voice">("sms");
  const [selectedPackageId, setSelectedPackageId] = useState(SMS_TOP_UP_PACKAGES[0].id);
  const [topUpSuccess, setTopUpSuccess] = useState("");
  const [topUpError, setTopUpError] = useState("");
  const [topingUp, setTopingUp] = useState(false);

  const { data: db, loading, error, refetch } = useAdminData();

  if (loading || !db) return <LoadingScreen label="Loading overview..." />;
  if (error) return <ErrorState title="Couldn't load the overview" description={error} />;

  const packages = topUpKind === "sms" ? SMS_TOP_UP_PACKAGES : VOICE_TOP_UP_PACKAGES;
  const selectedPackage: TopUpPackage =
    packages.find((p) => p.id === selectedPackageId) ?? packages[0];

  function openTopUp(kind: "sms" | "voice") {
    setTopUpKind(kind);
    setSelectedPackageId((kind === "sms" ? SMS_TOP_UP_PACKAGES : VOICE_TOP_UP_PACKAGES)[0].id);
    setTopUpSuccess("");
    setTopUpError("");
    setTopUpOpen(true);
  }

  async function handleConfirmTopUp() {
    setTopingUp(true);
    setTopUpError("");
    const supabase = createClient();
    // org_credits is select-only for every client role — top_up_credits()
    // is the only write path, and self-audits the top-up.
    const { error: rpcError } = await supabase.rpc("top_up_credits", {
      p_kind: topUpKind,
      p_amount: selectedPackage.amount,
    });
    setTopingUp(false);
    if (rpcError) {
      setTopUpError(rpcError.message);
      return;
    }
    setTopUpSuccess(`Added ${selectedPackage.label.toLowerCase()}.`);
    await refetch();
  }

  const campaigns = db.campaigns;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;

  // Interviews scheduled today: bookings with a still-live schedule today.
  const scheduledToday = db.bookings.filter(
    (b) => (b.status === "scheduled" || b.status === "rescheduled") && isToday(b.scheduledStart)
  ).length;

  // Interviews completed today: call attempts that finished today with a completed disposition.
  const completedToday = db.callAttempts.filter(
    (a) => a.disposition === "completed" && a.endedAt && isToday(a.endedAt)
  ).length;

  // Calls requiring follow-up: latest attempt per participant has that disposition, with no later attempt.
  const followUpByParticipant = new Map<string, { attemptId: string; campaignId: string }>();
  for (const attempt of db.callAttempts) {
    const existing = followUpByParticipant.get(attempt.participantId);
    if (!existing) {
      followUpByParticipant.set(attempt.participantId, {
        attemptId: attempt.id,
        campaignId: attempt.campaignId,
      });
      continue;
    }
    const existingAttempt = db.callAttempts.find((a) => a.id === existing.attemptId);
    if (existingAttempt && attempt.startedAt > existingAttempt.startedAt) {
      followUpByParticipant.set(attempt.participantId, {
        attemptId: attempt.id,
        campaignId: attempt.campaignId,
      });
    }
  }
  const followUpEntries = [...followUpByParticipant.entries()].filter(([participantId]) => {
    const latestId = followUpByParticipant.get(participantId)?.attemptId;
    const latest = db.callAttempts.find((a) => a.id === latestId);
    return latest?.disposition === "follow_up_required";
  });
  const followUpCount = followUpEntries.length;
  const followUpCampaignIds = new Set(followUpEntries.map(([, v]) => v.campaignId));

  // Participants awaiting assignment: most recent booking still scheduled, but
  // no assignment yet or the assignment isn't in an active/completed state.
  let awaitingAssignmentCount = 0;
  const awaitingCampaignIds = new Set<string>();
  for (const participant of db.participants) {
    const booking = [...db.bookings]
      .filter((b) => b.participantId === participant.id && b.status !== "cancelled")
      .sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart))[0];
    if (!booking || booking.status === "completed" || booking.status === "missed") continue;
    const assignment = db.assignments.find((a) => a.bookingId === booking.id);
    if (!assignment || !ACTIVE_ASSIGNMENT_STATUSES.includes(assignment.status)) {
      awaitingAssignmentCount += 1;
      awaitingCampaignIds.add(participant.campaignId);
    }
  }

  // Overdue interviews: scheduled in the past, assignment not completed.
  const now = new Date();
  let overdueCount = 0;
  const overdueCampaignIds = new Set<string>();
  for (const booking of db.bookings) {
    if (booking.status !== "scheduled" && booking.status !== "rescheduled") continue;
    if (new Date(booking.scheduledStart) >= now) continue;
    const assignment = db.assignments.find((a) => a.bookingId === booking.id);
    if (assignment?.status === "completed") continue;
    overdueCount += 1;
    overdueCampaignIds.add(booking.campaignId);
  }

  // Failed SMS invitations.
  const failedInvitations = db.invitations.filter((i) => i.status === "failed");
  const failedInvitationCampaignIds = new Set(failedInvitations.map((i) => i.campaignId));

  function singleCampaignLink(ids: Set<string>, suffix: string): string {
    if (ids.size === 1) {
      const [id] = ids;
      return `/admin/campaigns/${id}${suffix}`;
    }
    return "/admin/campaigns";
  }

  const attentionItems: { label: string; href: string }[] = [];
  if (awaitingAssignmentCount > 0) {
    attentionItems.push({
      label: `${awaitingAssignmentCount} participant${awaitingAssignmentCount === 1 ? "" : "s"} awaiting agent assignment`,
      href: singleCampaignLink(awaitingCampaignIds, "/scheduling?filter=unassigned"),
    });
  }
  if (overdueCount > 0) {
    attentionItems.push({
      label: `${overdueCount} overdue interview${overdueCount === 1 ? "" : "s"}`,
      href: singleCampaignLink(overdueCampaignIds, "/scheduling?filter=overdue"),
    });
  }
  if (failedInvitations.length > 0) {
    attentionItems.push({
      label: `${failedInvitations.length} failed SMS invitation${failedInvitations.length === 1 ? "" : "s"}`,
      href: singleCampaignLink(failedInvitationCampaignIds, "/invitations"),
    });
  }
  if (followUpCount > 0) {
    attentionItems.push({
      label: `${followUpCount} call${followUpCount === 1 ? "" : "s"} requiring follow-up`,
      href: singleCampaignLink(followUpCampaignIds, "/call-activity"),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title">Overview</h1>
        <p className="mt-1 text-page-subtitle">
          What&apos;s happening across every campaign right now.
        </p>
      </div>

      <div className="md:max-w-sm">
        <StatCard
          label="SMS & voice credits"
          value={`${db.orgCredits.sms.toLocaleString()} SMS`}
          hint={`${db.orgCredits.voiceMinutes.toLocaleString()} voice minutes remaining`}
          tone="hero"
        >
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-white/70">
              <span>Monthly allotment used</span>
              <span>62%</span>
            </div>
            <ProgressBar value={0.62} tone="info" className="mt-1.5" />
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => openTopUp("sms")}>
              Top up SMS
            </Button>
            <Button size="sm" variant="secondary" onClick={() => openTopUp("voice")}>
              Top up voice
            </Button>
          </div>
        </StatCard>
      </div>

      <Modal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        title={`Top up ${topUpKind === "sms" ? "SMS" : "voice"} credits`}
        description="A mock top-up for this preview — there's no real payment provider connected, so nothing is charged. It just adds credits to keep testing sends and calls."
      >
        <div className="flex flex-col gap-4">
          {topUpSuccess ? <InlineBanner kind="success">{topUpSuccess}</InlineBanner> : null}
          {topUpError ? <InlineBanner kind="danger">{topUpError}</InlineBanner> : null}
          <div className="flex flex-col gap-2">
            {packages.map((pkg) => (
              <label
                key={pkg.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-[6px] border border-border px-3 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
              >
                <input
                  type="radio"
                  name="top-up-package"
                  className="accent-primary"
                  checked={selectedPackageId === pkg.id}
                  onChange={() => setSelectedPackageId(pkg.id)}
                />
                {pkg.label}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setTopUpOpen(false)} disabled={topingUp}>
              Close
            </Button>
            <Button onClick={handleConfirmTopUp} disabled={topingUp}>
              {topingUp ? "Adding..." : "Add credits (mock)"}
            </Button>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Active campaigns" value={activeCampaigns} />
        <StatCard label="Interviews scheduled today" value={scheduledToday} />
        <StatCard label="Interviews completed today" value={completedToday} />
        <StatCard
          label="Calls requiring follow-up"
          value={followUpCount}
          tone={followUpCount > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          label="Participants awaiting assignment"
          value={awaitingAssignmentCount}
          tone={awaitingAssignmentCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Overdue interviews"
          value={overdueCount}
          tone={overdueCount > 0 ? "danger" : "default"}
        />
      </div>

      <Card>
        <CardHeader
          title="Needs attention"
          description="Quick links into the things most likely to need a decision today."
        />
        <CardBody>
          {attentionItems.length === 0 ? (
            <p className="text-sm text-foreground-muted">
              Nothing urgent right now — every campaign is in good shape.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {attentionItems.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between rounded-[5px] border border-border px-3 py-2.5 text-sm font-medium text-foreground hover:border-primary hover:bg-primary-soft hover:text-primary"
                  >
                    {item.label}
                    <span aria-hidden>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Recent campaigns"
          action={
            <ButtonLink href="/admin/campaigns" variant="secondary" size="sm">
              View all
            </ButtonLink>
          }
        />
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-subtle">
                <th className="px-5 py-3 font-medium">Campaign</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Participants</th>
                <th className="px-5 py-3 font-medium">Scheduled</th>
                <th className="px-5 py-3 font-medium">Completed</th>
                <th className="px-5 py-3 font-medium">Completion %</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {[...campaigns]
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .map((campaign) => {
                  const funnel = getCampaignFunnel(db, campaign.id);
                  const metrics = getCampaignMetrics(db, campaign.id);
                  return (
                    <tr key={campaign.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 font-medium text-foreground">{campaign.name}</td>
                      <td className="px-5 py-3 text-foreground-muted">{campaign.clientName}</td>
                      <td className="px-5 py-3">
                        <CampaignStatusBadge status={campaign.status} />
                      </td>
                      <td className="px-5 py-3 tabular-nums text-foreground-muted">
                        {funnel.contacts}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-foreground-muted">
                        {funnel.scheduled}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-foreground-muted">
                        {funnel.completed}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-foreground-muted">
                        {formatPercent(metrics.completionRate)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/admin/campaigns/${campaign.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-foreground-muted">
                    No campaigns yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
