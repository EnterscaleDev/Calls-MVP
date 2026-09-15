"use client";

import { useMemo, useState } from "react";
import { estimateSegments } from "@/lib/adapters/sms";
import { createClient } from "@/lib/supabase/client";
import { useAdminData } from "@/lib/hooks/useAdminData";
import { generateSecureToken, sha256Hex } from "@/lib/supabase/tokens";
import { getAuditLog } from "@/lib/selectors";
import { Card, CardHeader, CardBody, StatCard } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { InlineBanner, EmptyState, LoadingScreen, ErrorState } from "@/components/ui/States";
import { InvitationStatusBadge } from "@/components/ui/Badge";
import { formatDateTime, formatPercent } from "../../../_lib/format";
import { SMS_CREDIT_COST_PER_SEGMENT } from "../../../_lib/credits";
import { useCampaignDetail } from "../campaign-context";

const DEFAULT_BODY =
  "Hi {{first_name}}, we'd love to hear about your experience. Book a short call here: {{campaign_link}}";
const TOKEN_EXPIRY_DAYS = 30;

export default function InvitationsPage() {
  const campaign = useCampaignDetail();
  const { data: db, loading, error, refetch } = useAdminData();

  const [senderId, setSenderId] = useState(campaign.senderId);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [incentiveText, setIncentiveText] = useState(
    campaign.incentiveTitle ? `${campaign.incentiveTitle} — ${campaign.incentiveDescription}` : ""
  );
  const [draftSaved, setDraftSaved] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendMode, setSendMode] = useState<"new" | "failed">("new");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sentBanner, setSentBanner] = useState("");

  const fullBody = incentiveText ? `${body}\n\n${incentiveText}` : body;
  const segments = estimateSegments(fullBody);
  const previewText = useMemo(() => {
    return body
      .replaceAll("{{first_name}}", "Jamie")
      .replaceAll("{{campaign_link}}", "https://calls.example/i/abc123");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);
  const fullPreviewText = incentiveText ? `${previewText}\n\n${incentiveText}` : previewText;
  const previewSegments = estimateSegments(fullPreviewText);

  const invitationRows = useMemo(() => {
    if (!db) return [];
    return [...db.invitations]
      .filter((inv) => inv.campaignId === campaign.id)
      .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""))
      .map((inv) => {
        const participant = db.participants.find((p) => p.id === inv.participantId);
        const contact = participant ? db.contacts.find((c) => c.id === participant.contactId) : undefined;
        return { invitation: inv, contactName: contact?.name ?? "Unknown contact" };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, campaign.id]);

  const sendHistory = useMemo(() => {
    if (!db) return [];
    return getAuditLog(db, campaign.id).filter((e) => e.action === "sms_batch_sent");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, campaign.id]);

  if (loading || !db) return <LoadingScreen label="Loading invitations..." />;
  if (error) return <ErrorState title="Couldn't load invitations" description={error} />;

  const participants = db.participants.filter((p) => p.campaignId === campaign.id);
  const eligibleCount = participants.filter((p) => p.participationStatus === "imported").length;
  const failedParticipants = participants.filter((p) => p.participationStatus === "invite_failed");

  const failedCount = invitationRows.filter((r) => r.invitation.status === "failed").length;
  const queuedCount = invitationRows.filter((r) => r.invitation.status === "queued").length;
  const sentTotal = invitationRows.length;
  const deliveredCount = invitationRows.filter((r) => r.invitation.status === "delivered").length;
  const deliveryRate = sentTotal > 0 ? deliveredCount / sentTotal : 0;
  const clickedCount = invitationRows.filter((r) => r.invitation.clickedAt).length;
  const clickRate = sentTotal > 0 ? clickedCount / sentTotal : 0;
  const optedInCount = participants.filter((p) =>
    ["opted_in", "scheduled", "completed"].includes(p.participationStatus)
  ).length;
  const optedInRateOfDelivered = deliveredCount > 0 ? optedInCount / deliveredCount : 0;

  const excludedCount = participants.filter((p) =>
    ["declined", "invite_failed", "ineligible"].includes(p.participationStatus)
  ).length;
  const estimatedCost = eligibleCount * segments * SMS_CREDIT_COST_PER_SEGMENT;
  const creditAfterSend = db.orgCredits.sms - estimatedCost;

  function handleSaveDraft() {
    // No real draft storage exists yet (matches the mock, which never
    // persisted this either) — purely a local acknowledgment.
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2500);
  }

  function handleSendTest() {
    setTestSent(true);
    setTimeout(() => setTestSent(false), 2500);
  }

  async function handleConfirmSend() {
    if (!db) return;
    setSending(true);
    setSendError("");
    try {
      const supabase = createClient();
      const eligible = sendMode === "new" ? participants.filter((p) => p.participationStatus === "imported") : failedParticipants;

      // Sending needs the raw phone to hand to the (still-mocked) SMS
      // adapter — reveal is the one sanctioned, audited path to it. This
      // fires one contact_numbers_revealed audit row for the batch, same as
      // clicking Reveal on the Audience tab would.
      const contactIds = eligible.map((p) => p.contactId);
      const { data: revealed, error: revealErr } = await supabase.rpc("contacts_reveal", {
        p_contact_ids: contactIds,
        p_campaign_id: campaign.id,
      });
      if (revealErr) throw revealErr;
      const phoneByContactId = new Map((revealed ?? []).map((r) => [r.id, r.phone]));

      let sentCount = 0;
      for (const participant of eligible) {
        const phone = phoneByContactId.get(participant.contactId);
        if (!phone) continue;

        // Fresh token minted at send time, not at import — link validity
        // starts counting from when it's actually distributed, not from
        // whenever the contact happened to be uploaded.
        const token = generateSecureToken();
        const tokenHash = await sha256Hex(token);
        const expiresAt = new Date(
          Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();
        await supabase
          .from("campaign_participants")
          .update({ invite_token_hash: tokenHash, token_expires_at: expiresAt })
          .eq("id", participant.id);

        // Insert the invitation row before sending so we have a real id to
        // hand Dotgo as the request's own `id` — see lib/adapters/sms-dotgo.ts
        // for why that matters for correlating its delivery-status webhook.
        const { data: invitationRow, error: insertError } = await supabase
          .from("campaign_invitations")
          .insert({
            campaign_id: campaign.id,
            participant_id: participant.id,
            provider_message_id: "",
            status: "queued",
          })
          .select("id")
          .single();
        if (insertError || !invitationRow) continue;

        const contact = db.contacts.find((c) => c.id === participant.contactId);
        const firstName = (contact?.name ?? "").trim().split(/\s+/)[0] || "there";
        const campaignLink = `${window.location.origin}/participate/${token}`;
        const personalizedBody = (incentiveText ? `${body}\n\n${incentiveText}` : body)
          .replaceAll("{{first_name}}", firstName)
          .replaceAll("{{campaign_link}}", campaignLink);

        const sendResponse = await fetch("/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: phone,
            body: personalizedBody,
            requestId: invitationRow.id,
            senderMask: senderId,
          }),
        });
        const sendResult = (await sendResponse.json().catch(() => ({
          ok: false,
          errorReason: "Unexpected response from the send endpoint.",
        }))) as { ok: true } | { ok: false; errorReason: string };
        const now = new Date().toISOString();

        await supabase
          .from("campaign_invitations")
          .update({
            status: sendResult.ok ? "sent" : "failed",
            sent_at: sendResult.ok ? now : null,
            failed_at: sendResult.ok ? null : now,
            failure_reason: sendResult.ok ? null : sendResult.errorReason,
          })
          .eq("id", invitationRow.id);

        await supabase
          .from("campaign_participants")
          .update({
            participation_status: sendResult.ok ? "invited" : "invite_failed",
          })
          .eq("id", participant.id);

        await supabase.from("audit_events").insert({
          organisation_id: campaign.organisationId,
          campaign_id: campaign.id,
          actor_type: "system",
          actor_name: "Dotgo",
          action: "invitation_sent",
          entity_type: "campaign_participant",
          entity_id: participant.id,
          metadata: { status: sendResult.ok ? "sent" : "failed" },
        });

        if (sendResult.ok) sentCount += 1;
        // Delivered/failed status now arrives via Dotgo's real delivery
        // webhook (app/api/sms/dotgo-callback/route.ts), not a client-side
        // timer — a manual reload picks up the final status once it lands.
      }

      await supabase.rpc("log_sms_batch_sent", {
        p_campaign_id: campaign.id,
        p_recipient_count: eligible.length,
      });

      setSentBanner(
        `Sent to ${sentCount} of ${eligible.length} eligible participant${eligible.length === 1 ? "" : "s"}.`
      );
      setConfirmOpen(false);
      await refetch();
    } catch {
      setSendError("Something went wrong sending invitations. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <StatCard label="Queued" value={queuedCount} />
        <StatCard label="Sent" value={sentTotal} />
        <StatCard label="Delivered" value={deliveredCount} hint={`${formatPercent(deliveryRate)} delivery rate`} />
        <StatCard label="Clicked" value={clickedCount} hint={`${formatPercent(clickRate)} click rate`} />
        <StatCard label="Failed" value={failedCount} hint="Unreachable or barred" tone={failedCount > 0 ? "danger" : "default"} />
        <StatCard label="Opted in" value={optedInCount} hint={`${formatPercent(optedInRateOfDelivered)} of delivered`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Compose invitation" description="Supports {{first_name}} and {{campaign_link}} placeholders." />
          <CardBody className="flex flex-col gap-4">
            {draftSaved ? <InlineBanner kind="success">Draft saved.</InlineBanner> : null}
            {testSent ? <InlineBanner kind="success">Test sent to your own number.</InlineBanner> : null}
            {sentBanner ? <InlineBanner kind="success">{sentBanner}</InlineBanner> : null}
            {sendError ? <InlineBanner kind="danger">{sendError}</InlineBanner> : null}

            <Field label="Sender ID">
              <Input value={senderId} onChange={(e) => setSenderId(e.target.value)} />
            </Field>
            <Field
              label="Message body"
              hint={`${body.length} characters in the template (placeholders included) · ~${segments} SMS segment${segments === 1 ? "" : "s"} before substitution — see Preview for the actual sent length`}
            >
              <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
            <Field label="Incentive text">
              <Input value={incentiveText} onChange={(e) => setIncentiveText(e.target.value)} />
            </Field>

            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={handleSaveDraft}>
                Save Draft
              </Button>
              <Button variant="secondary" onClick={handleSendTest}>
                Send Test
              </Button>
              {failedParticipants.length > 0 ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSendMode("failed");
                    setConfirmOpen(true);
                  }}
                >
                  Resend Failed ({failedParticipants.length})
                </Button>
              ) : null}
              <Button
                onClick={() => {
                  setSendMode("new");
                  setConfirmOpen(true);
                }}
                disabled={eligibleCount === 0}
              >
                Send Campaign
              </Button>
            </div>
            {eligibleCount === 0 ? (
              <p className="text-right text-xs text-foreground-subtle">
                No participants are currently eligible to be invited (import contacts on the Audience tab first).
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Preview" description="How this looks with a real participant's details filled in." />
          <CardBody className="flex flex-col gap-3">
            <p className={`text-xs font-medium ${previewSegments > 1 ? "text-warning" : "text-foreground-muted"}`}>
              {fullPreviewText.length} character{fullPreviewText.length === 1 ? "" : "s"} · ~{previewSegments} SMS segment
              {previewSegments === 1 ? "" : "s"}
              {previewSegments > 1 ? " — over the 160-character single-segment limit" : ""}
            </p>
            <div className="rounded-[8px] border border-border bg-surface-muted p-4 text-sm text-foreground">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                From: {senderId || "SENDER"}
              </p>
              <p className="whitespace-pre-wrap">{previewText}</p>
              {incentiveText ? (
                <p className="mt-3 whitespace-pre-wrap text-foreground-muted">{incentiveText}</p>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Audience & cost" description="Estimated for this send, using the current message." />
        <CardBody>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <p className="label-caps text-foreground-subtle">Eligible</p>
              <p className="mt-0.5 font-semibold text-foreground">{eligibleCount} contacts</p>
            </div>
            <div>
              <p className="label-caps text-foreground-subtle">Excluded</p>
              <p className="mt-0.5 font-semibold text-foreground">{excludedCount} opted out / failed</p>
            </div>
            <div>
              <p className="label-caps text-foreground-subtle">Parts each</p>
              <p className="mt-0.5 font-semibold text-foreground">{previewSegments}</p>
            </div>
            <div>
              <p className="label-caps text-foreground-subtle">Estimated cost</p>
              <p className="mt-0.5 font-semibold text-foreground">{estimatedCost} SMS credits</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-foreground-subtle">
            SMS credit after this send: <span className="font-medium text-foreground">{creditAfterSend.toLocaleString()}</span>.
            Charged to SMS credit only — voice credit pays for the calls themselves and tops up separately. Sends pause
            automatically if credit runs out mid-batch.
          </p>
        </CardBody>
      </Card>

      {sendHistory.length > 0 ? (
        <Card>
          <CardHeader title="Send history" />
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {sendHistory.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="text-foreground">
                    {(event.metadata?.recipientCount as number | undefined) ?? "—"} recipients
                  </span>
                  <span className="text-xs text-foreground-subtle">{formatDateTime(event.createdAt)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Delivery status"
          description={failedCount > 0 ? `${failedCount} invitation${failedCount === 1 ? "" : "s"} failed to deliver.` : undefined}
        />
        <CardBody className="p-0">
          {invitationRows.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No invitations sent yet" description="Send the campaign to see delivery status here." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-subtle">
                    <th className="px-5 py-3 font-medium">Participant</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Clicked</th>
                    <th className="px-5 py-3 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {invitationRows.map(({ invitation, contactName }) => (
                    <tr
                      key={invitation.id}
                      className={`border-b border-border last:border-0 ${
                        invitation.status === "failed" ? "bg-danger-soft/40" : ""
                      }`}
                    >
                      <td className="px-5 py-3 font-medium text-foreground">{contactName}</td>
                      <td className="px-5 py-3">
                        <InvitationStatusBadge status={invitation.status} />
                      </td>
                      <td className="px-5 py-3 text-foreground-muted">
                        {invitation.clickedAt ? formatDateTime(invitation.clickedAt) : "—"}
                      </td>
                      <td className="px-5 py-3 text-foreground-muted">
                        {invitation.status === "failed" ? invitation.failureReason ?? "Delivery failed" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={confirmOpen}
        onClose={() => (sending ? undefined : setConfirmOpen(false))}
        title={sendMode === "new" ? "Send campaign invitations" : "Resend to failed contacts"}
        description={(() => {
          const count = sendMode === "new" ? eligibleCount : failedParticipants.length;
          const verb = sendMode === "new" ? "send this invitation to" : "resend this invitation to";
          return `You are about to ${verb} ${count} participant${count === 1 ? "" : "s"}.`;
        })()}
      >
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleConfirmSend} disabled={sending}>
            {sending ? "Sending..." : "Send now"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
