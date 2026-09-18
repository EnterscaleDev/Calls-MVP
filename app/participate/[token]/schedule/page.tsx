"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createParticipantBooking, useParticipantToken } from "@/lib/participant-context";
import { SlotPicker } from "../_components/SlotPicker";
import { LoadingScreen } from "@/components/ui/States";

export default function SchedulePage() {
  const router = useRouter();
  const { token, campaign, hasAgreedParticipation, booking, refetch } = useParticipantToken();
  const [booking_, setBooking] = useState(false);

  // A cancelled booking is never `is_current` (interview_bookings.is_current's
  // trigger excludes cancelled rows from candidacy), so any booking the context
  // hands us here is already guaranteed live.
  const hasLiveBooking = !!booking;

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

  async function handleSelect(start: Date, end: Date) {
    if (booking_) return;
    setBooking(true);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    await createParticipantBooking(token, start.toISOString(), end.toISOString(), timezone);
    await refetch();
    router.push(`/participate/${token}/confirmation`);
  }

  if (booking_) return <LoadingScreen label="Booking your interview..." />;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-page-title">Choose a time</h1>
        <p className="mt-1 text-page-subtitle">
          Pick a time that works for you. A researcher will call you at your scheduled time — it
          should take about {campaign.estimatedDurationMinutes} minutes.
        </p>
      </div>

      <SlotPicker campaign={campaign} onSelect={handleSelect} busy={booking_} />
    </div>
  );
}
