"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Clock3, PhoneCall } from "lucide-react";
import {
  cancelParticipantBooking,
  rescheduleParticipantBooking,
  useParticipantToken,
} from "@/lib/participant-context";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InlineBanner } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { SlotPicker, formatSlotRange } from "../_components/SlotPicker";

/** Icon-in-circle info row, matching the consent page's "Good to know" treatment. */
function InfoRow({
  icon,
  tone,
  title,
  description,
}: {
  icon: ReactNode;
  tone: "primary" | "navy";
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3.5">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          tone === "primary" ? "bg-primary-soft text-primary" : "bg-navy-soft text-navy"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-foreground-muted">{description}</p>
      </div>
    </div>
  );
}

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
          <h1 className="text-page-title">Pick a new time</h1>
          <p className="mt-1 text-page-subtitle">
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
      <div className="flex flex-col items-center gap-2 rounded-[8px] bg-navy px-5 py-7 text-center text-white">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
          <CalendarCheck size={22} />
        </div>
        <p className="label-caps text-white/70">You&apos;re booked</p>
        <p className="text-2xl font-bold leading-tight text-white">{day}</p>
        <p className="text-sm text-white/85">{time}</p>
      </div>

      <Card>
        <CardBody className="divide-y divide-border py-0">
          <InfoRow
            icon={<Clock3 className="h-[18px] w-[18px]" />}
            tone="primary"
            title="Expected duration"
            description={`About ${campaign.estimatedDurationMinutes} minutes`}
          />
          <InfoRow
            icon={<PhoneCall className="h-[18px] w-[18px]" />}
            tone="navy"
            title="What to expect"
            description={`A researcher from ${campaign.clientName} will call you at your scheduled time. Please have a few quiet minutes free to talk.`}
          />
        </CardBody>
      </Card>

      {campaign.incentiveTitle ? (
        <div className="rounded-[6px] border border-primary-soft-border bg-primary-soft px-4 py-3">
          <p className="text-sm font-semibold text-primary">{campaign.incentiveTitle}</p>
          {campaign.incentiveDescription ? (
            <p className="mt-0.5 text-xs text-foreground-muted">{campaign.incentiveDescription}</p>
          ) : null}
        </div>
      ) : null}

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
