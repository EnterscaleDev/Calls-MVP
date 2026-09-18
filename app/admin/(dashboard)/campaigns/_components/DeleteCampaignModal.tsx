"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { InlineBanner } from "@/components/ui/States";
import type { Campaign } from "@/lib/types";

type Phase = "checking" | "eligible" | "ineligible" | "error";

/**
 * Single source of truth for "Delete campaign" — used from both the
 * Campaigns list row menu and the per-campaign Settings page, so there's
 * exactly one delete flow rather than two that could drift apart.
 *
 * Never performs a real DELETE. The eligibility check (and the delete RPC
 * itself, re-checked server-side) only allows it when the campaign has no
 * calls, consent, bookings, sent invitations or recordings — otherwise this
 * offers Archive instead, per the "prefer Archive over cascading permanent
 * deletion" rule.
 */
export function DeleteCampaignModal({
  campaign,
  onClose,
  onDeleted,
  onArchiveInstead,
}: {
  campaign: Campaign | null;
  onClose: () => void;
  onDeleted: () => void;
  onArchiveInstead: (campaign: Campaign) => void;
}) {
  if (!campaign) return null;
  // Keyed by campaign id: reopening for a different campaign (or the same
  // one again) mounts a fresh instance with clean state, instead of an
  // effect resetting state on every prop change.
  return (
    <DeleteCampaignModalInner
      key={campaign.id}
      campaign={campaign}
      onClose={onClose}
      onDeleted={onDeleted}
      onArchiveInstead={onArchiveInstead}
    />
  );
}

function DeleteCampaignModalInner({
  campaign,
  onClose,
  onDeleted,
  onArchiveInstead,
}: {
  campaign: Campaign;
  onClose: () => void;
  onDeleted: () => void;
  onArchiveInstead: (campaign: Campaign) => void;
}) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .rpc("admin_campaign_delete_eligibility", { p_campaign_id: campaign.id })
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          setPhase("error");
          setReason(error?.message ?? "Couldn't check whether this campaign can be deleted.");
          return;
        }
        const row = data[0];
        if (row.eligible) {
          setPhase("eligible");
        } else {
          setPhase("ineligible");
          setReason(row.reason ?? "This campaign contains activity and can't be deleted.");
        }
      });
  }, [campaign.id]);

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError("");
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_delete_campaign", { p_campaign_id: campaign.id });
    setDeleting(false);
    if (error) {
      // The RPC re-checks activity fresh at delete time (not just trusting
      // the earlier eligibility call) — if something changed in another tab
      // in between, this is where that shows up.
      if (error.message.includes("cannot be permanently deleted")) {
        setPhase("ineligible");
        setReason(error.message);
        return;
      }
      setDeleteError(error.message);
      return;
    }
    onDeleted();
  }

  if (phase === "checking") {
    return (
      <Modal open onClose={onClose} title="Delete campaign?" description="Checking this campaign for research activity...">
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Modal>
    );
  }

  if (phase === "error") {
    return (
      <Modal open onClose={onClose} title="Delete campaign?">
        <div className="flex flex-col gap-3">
          <InlineBanner kind="danger">{reason}</InlineBanner>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  if (phase === "ineligible") {
    return (
      <Modal open onClose={onClose} title="Delete campaign?">
        <div className="flex flex-col gap-4">
          <InlineBanner kind="warning">{reason}</InlineBanner>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onArchiveInstead(campaign);
                onClose();
              }}
            >
              Archive campaign
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={() => (deleting ? undefined : onClose())}
      title="Delete campaign?"
      description={`You're about to delete "${campaign.name}". This campaign will be removed from your campaign list.`}
    >
      <div className="flex flex-col gap-4">
        {deleteError ? <InlineBanner kind="danger">{deleteError}</InlineBanner> : null}
        <p className="text-xs text-foreground-subtle">
          This action should only be used for campaigns that were created by mistake or are no longer
          needed.
        </p>
        <Field label={`Type "${campaign.name}" to confirm`}>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" disabled={deleting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={deleting || confirmText !== campaign.name}
            onClick={handleConfirmDelete}
          >
            {deleting ? "Deleting..." : "Delete campaign"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
