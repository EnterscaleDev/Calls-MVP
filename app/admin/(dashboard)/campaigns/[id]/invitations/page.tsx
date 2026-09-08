"use client";

import { useMemo, useState } from "react";
import { useStore, estimateSegments } from "@/lib/store";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { InlineBanner, EmptyState } from "@/components/ui/States";
import { InvitationStatusBadge } from "@/components/ui/Badge";
import { useCampaignDetail } from "../campaign-context";

const DEFAULT_BODY =
  "Hi {{first_name}}, we'd love to hear about your experience. Book a short call here: {{campaign_link}}";

export default function InvitationsPage() {
  const campaign = useCampaignDetail();
  const { db, actions } = useStore();

  const [senderId, setSenderId] = useState(campaign.senderId);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [incentiveText, setIncentiveText] = useState(
    campaign.incentiveTitle ? `${campaign.incentiveTitle} — ${campaign.incentiveDescription}` : ""
  );
  const [draftSaved, setDraftSaved] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sentBanner, setSentBanner] = useState("");

  const participants = db.participants.filter((p) => p.campaignId === campaign.id);
  const eligibleCount = participants.filter((p) => p.participationStatus === "imported").length;

  const segments = estimateSegments(body);

  const previewText = useMemo(() => {
    return body
      .replaceAll("{{first_name}}", "Jamie")
      .replaceAll("{{campaign_link}}", "https://calls.example/i/abc123");
  }, [body]);

  const previewSegments = estimateSegments(previewText);

  const invitationRows = useMemo(() => {
    return [...db.invitations]
      .filter((inv) => inv.campaignId === campaign.id)
      .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""))
      .map((inv) => {
        const participant = db.participants.find((p) => p.id === inv.participantId);
        const contact = participant ? db.contacts.find((c) => c.id === participant.contactId) : undefined;
        return { invitation: inv, contactName: contact?.name ?? "Unknown contact" };
      });
  }, [db.invitations, db.participants, db.contacts, campaign.id]);

  const failedCount = invitationRows.filter((r) => r.invitation.status === "failed").length;

  function handleSaveDraft() {
    actions.saveSmsDraft(campaign.id, body, incentiveText, senderId);
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2500);
  }

  function handleSendTest() {
    setTestSent(true);
    setTimeout(() => setTestSent(false), 2500);
  }

  async function handleConfirmSend() {
    setSending(true);
    setSendError("");
    try {
      const summary = await actions.sendInvitations(campaign.id, body, senderId);
      setSentBanner(`Sent to ${summary.sent} of ${summary.eligible} eligible participant${summary.eligible === 1 ? "" : "s"}.`);
      setConfirmOpen(false);
    } catch {
      setSendError("Something went wrong sending invitations. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Compose invitation" description="Supports {{first_name}} and {{campaign_link}} placeholders." />
          <CardBody className="flex flex-col gap-4">
            {draftSaved ? <InlineBanner kind="success">Draft saved.</InlineBanner> : null}
            {testSent ? <InlineBanner kind="success">Test sent to your own number.</InlineBanner> : null}
            {sentBanner ? <InlineBanner kind="success">{sentBanner}</InlineBanner> : null}
            {sendError ? <InlineBanner kind="danger">{sendError}</InlineBanner> : null}

            <Field label="Sender ID">
              <Input value={senderId} onChange={(e) => setSenderId(e.target.value.toUpperCase())} />
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
              <Button onClick={() => setConfirmOpen(true)} disabled={eligibleCount === 0}>
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
              {previewText.length} character{previewText.length === 1 ? "" : "s"} · ~{previewSegments} SMS segment
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
        title="Send campaign invitations"
        description={`You are about to send this invitation to ${eligibleCount} participant${
          eligibleCount === 1 ? "" : "s"
        }.`}
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
