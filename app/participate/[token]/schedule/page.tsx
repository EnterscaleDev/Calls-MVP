"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useParticipantToken } from "@/lib/participant-context";
import { useStore } from "@/lib/store";
import { SlotPicker } from "../_components/SlotPicker";
import { LoadingScreen } from "@/components/ui/States";

export default function SchedulePage() {
  const router = useRouter();
  const { token, campaign, participant, hasAgreedParticipation, booking } = useParticipantToken();
  const { actions } = useStore();
  const [booking_, setBooking] = useState(false);

  const hasLiveBooking = !!booking && booking.status !== "cancelled";

  useEffect(() => {
    if (!hasAgreedParticipation) {
      router.push(`/participate/${token}/consent`);
      return;
    }
    if (hasLiveBooking) {
      router.push(`/participate/${token}/confirmation`);
    }
  }, [hasAgreedParticipation, hasLiveBooking, router, token]);

  if (!hasAgreedParticipation || hasLiveBooking) return null;

  function handleSelect(start: Date, end: Date) {
    if (booking_) return;
    setBooking(true);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    actions.createBooking(participant.id, start.toISOString(), end.toISOString(), timezone);
    router.push(`/participate/${token}/confirmation`);
  }

  if (booking_) return <LoadingScreen label="Booking your interview..." />;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Choose a time</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Pick a time that works for you. A researcher will call you at your scheduled time — it
          should take about {campaign.estimatedDurationMinutes} minutes.
        </p>
      </div>

      <SlotPicker campaign={campaign} onSelect={handleSelect} busy={booking_} />
    </div>
  );
}
