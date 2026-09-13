"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelParticipantBooking,
  rescheduleParticipantBooking,
  useParticipantToken,
} from "@/lib/participant-context";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InlineBanner } from "@/components/ui/States";
import { SlotPicker, formatSlotRange } from "../_components/SlotPicker";

export default function ConfirmationPage() {
  const router = useRouter();
  const { token, campaign, booking, hasAgreedParticipation, refetch } = useParticipantToken();

  const [mode, setMode] = useState<"view" | "reschedule" | "cancel-confirm" | "cancelled">("view");

  // Guard: no booking at all -> nothing to confirm, send them to schedule (or consent first).
  useEffect(() => {
    if (!booking) {
      router.push(
        hasAgreedParticipation ? `/participate/${token}/schedule` : `/participate/${token}/consent`
      );
    }
  }, [booking, hasAgreedParticipation, router, token]);

  if (!booking) return null;

  // A cancelled booking is never `is_current` (see interview_bookings.is_current's
  // trigger), so the context never hands us one — "cancelled" is purely local
  // state for the brief window right after the participant's own cancel click,
  // shown once and not persisted; reopening the link later resolves straight to
  // "no current booking" and redirects to schedule instead.
  const isCancelled = mode === "cancelled";

  async function handleReschedule(start: Date, end: Date) {
    if (!booking) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    await rescheduleParticipantBooking(token, booking.id, start.toISOString(), end.toISOString(), timezone);
    await refetch();
    setMode("view");
  }

  async function handleCancel() {
    if (!booking) return;
    await cancelParticipantBooking(token, booking.id);
    setMode("cancelled");
  }

  if (isCancelled) {
    return (
      <div className="flex flex-col gap-4">
        <InlineBanner kind="warning">
          Your interview has been cancelled. You won&apos;t be contacted at the previously scheduled
          time.
        </InlineBanner>
        <p className="text-sm text-foreground-muted">
          Changed your mind? You can still pick a new time.
        </p>
        <Button className="w-full justify-center" onClick={() => router.push(`/participate/${token}/schedule`)}>
          Choose a new time
        </Button>
      </div>
    );
  }

  if (mode === "reschedule") {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pick a new time</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            This will replace your current booking.
          </p>
        </div>
        <SlotPicker campaign={campaign} onSelect={handleReschedule} />
        <Button variant="ghost" className="w-full justify-center" onClick={() => setMode("view")}>
          Never mind, keep my current time
        </Button>
      </div>
    );
  }

  if (mode === "cancel-confirm") {
    return (
      <div className="flex flex-col gap-4">
        <InlineBanner kind="danger">
          Are you sure you want to cancel your interview? This can&apos;t be undone from this link.
        </InlineBanner>
        <div className="flex flex-col gap-2">
          <Button variant="danger" className="w-full justify-center" onClick={handleCancel}>
            Yes, cancel my interview
          </Button>
          <Button variant="secondary" className="w-full justify-center" onClick={() => setMode("view")}>
            No, keep my time
          </Button>
        </div>
      </div>
    );
  }

  const { day, time } = formatSlotRange(booking.scheduledStart, booking.scheduledEnd);

  return (
    <div className="flex flex-col gap-5">
      <InlineBanner kind="success">You&apos;re booked!</InlineBanner>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-medium text-foreground-subtle">Your interview</p>
            <p className="mt-0.5 text-lg font-semibold text-foreground">{day}</p>
            <p className="text-sm text-foreground-muted">{time}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground-subtle">Expected duration</p>
            <p className="mt-0.5 text-sm text-foreground">
              About {campaign.estimatedDurationMinutes} minutes
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground-subtle">What to expect</p>
            <p className="mt-0.5 text-sm text-foreground-muted">
              A researcher from {campaign.clientName} will call you at your scheduled time. Please
              have a few quiet minutes free to talk.
            </p>
          </div>
          {campaign.incentiveTitle ? (
            <div className="rounded-[6px] border border-primary-soft-border bg-primary-soft px-3 py-2.5">
              <p className="text-sm font-semibold text-primary">{campaign.incentiveTitle}</p>
              {campaign.incentiveDescription ? (
                <p className="mt-0.5 text-xs text-foreground-muted">{campaign.incentiveDescription}</p>
              ) : null}
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1 justify-center" onClick={() => setMode("reschedule")}>
          Reschedule
        </Button>
        <Button variant="danger" className="flex-1 justify-center" onClick={() => setMode("cancel-confirm")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
