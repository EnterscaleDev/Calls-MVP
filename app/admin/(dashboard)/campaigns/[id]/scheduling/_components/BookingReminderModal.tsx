"use client";

import { useState } from "react";
import { getRemindersForBooking } from "@/lib/selectors";
import type { AdminData } from "@/lib/hooks/useAdminData";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ReminderStatusBadge } from "@/components/ui/Badge";
import { InlineBanner } from "@/components/ui/States";
import { EmptyState } from "@/components/ui/States";
import { formatDateTime, labelize } from "../../../../_lib/format";
import type { InterviewBooking } from "@/lib/types";

// Mirrors admin_requeue_reminder's own gate exactly: only a genuinely
// failed send attempt is resendable. A cancelled/skipped reminder means
// "this message should not go out" (interview moved/cancelled, or the
// window passed) — resending those would send a stale or contradictory
// message, which the spec explicitly calls out as something to prevent.
const RESENDABLE = new Set(["failed"]);

/**
 * Per-booking reminder history — what's been scheduled/sent for this
 * interview and, for anything that didn't go out, a manual "Resend now".
 * Booking-scoped rather than participant-scoped since a rescheduled booking
 * gets its own fresh reminder rows (see fn_schedule_appointment_reminders).
 */
export function BookingReminderModal({
  booking,
  contactName,
  db,
  onClose,
  onChanged,
}: {
  booking: InterviewBooking | null;
  contactName: string;
  db: AdminData;
  onClose: () => void;
  onChanged: () => void;
}) {
  if (!booking) return null;
  return (
    <BookingReminderModalInner
      key={booking.id}
      booking={booking}
      contactName={contactName}
      db={db}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function BookingReminderModalInner({
  booking,
  contactName,
  db,
  onClose,
  onChanged,
}: {
  booking: InterviewBooking;
  contactName: string;
  db: AdminData;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendError, setResendError] = useState("");

  const reminders = getRemindersForBooking(db, booking.id);

  async function handleResend(reminderId: string) {
    setResendingId(reminderId);
    setResendError("");
    const response = await fetch("/api/reminders/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderId }),
    });
    const result = (await response.json().catch(() => ({
      ok: false,
      errorReason: "Unexpected response from the resend endpoint.",
    }))) as { ok: true } | { ok: false; errorReason: string };
    setResendingId(null);
    if (!result.ok) {
      setResendError(result.errorReason);
      return;
    }
    onChanged();
  }

  return (
    <Modal open onClose={onClose} title={`Reminders for ${contactName}`} description={formatDateTime(booking.scheduledStart)}>
      <div className="flex flex-col gap-4">
        {resendError ? <InlineBanner kind="danger">{resendError}</InlineBanner> : null}

        {reminders.length === 0 ? (
          <EmptyState
            title="No reminders scheduled"
            description="This booking has no confirmation or reminder messages recorded."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {reminders.map((reminder) => (
              <li key={reminder.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{labelize(reminder.reminderType)}</p>
                  <ReminderStatusBadge status={reminder.status} />
                </div>
                <p className="text-xs text-foreground-muted">
                  Due {formatDateTime(reminder.scheduledFor)}
                  {reminder.sentAt ? ` · Sent ${formatDateTime(reminder.sentAt)}` : ""}
                  {reminder.deliveredAt ? ` · Delivered ${formatDateTime(reminder.deliveredAt)}` : ""}
                </p>
                {reminder.failureReason ? (
                  <p className="text-xs text-danger">{reminder.failureReason}</p>
                ) : null}
                {reminder.sendAttempts > 0 ? (
                  <p className="text-xs text-foreground-subtle">
                    {reminder.sendAttempts} send attempt{reminder.sendAttempts === 1 ? "" : "s"}
                  </p>
                ) : null}
                {RESENDABLE.has(reminder.status) ? (
                  <div className="mt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={resendingId === reminder.id}
                      onClick={() => handleResend(reminder.id)}
                    >
                      {resendingId === reminder.id ? "Resending..." : "Resend now"}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
