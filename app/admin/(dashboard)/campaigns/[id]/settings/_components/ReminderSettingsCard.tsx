"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Checkbox } from "@/components/ui/Form";
import { InlineBanner } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { renderReminderMessage, type ReminderMessageType } from "@/lib/reminder-templates";
import type { Campaign } from "@/lib/types";

const PREVIEW_TYPES: { type: ReminderMessageType; label: string }[] = [
  { type: "booking_confirmation", label: "Booking confirmation" },
  { type: "reminder_24h", label: "24-hour reminder" },
  { type: "reminder_1h", label: "1-hour reminder" },
  { type: "reschedule_confirmation", label: "Reschedule confirmation" },
  { type: "cancellation_confirmation", label: "Cancellation confirmation" },
];

/** Tomorrow at 2pm local — realistic enough for the "today/tomorrow" wording
 *  in the preview without depending on a real booking existing. */
function samplePreviewStart(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(14, 0, 0, 0);
  return d.toISOString();
}

export function ReminderSettingsCard({ campaign, onSaved }: { campaign: Campaign; onSaved: () => void }) {
  return <ReminderSettingsCardInner key={campaign.id} campaign={campaign} onSaved={onSaved} />;
}

function ReminderSettingsCardInner({ campaign, onSaved }: { campaign: Campaign; onSaved: () => void }) {
  const [sendBookingConfirmation, setSendBookingConfirmation] = useState(campaign.sendBookingConfirmation);
  const [sendReminder24h, setSendReminder24h] = useState(campaign.sendReminder24h);
  const [sendReminder1h, setSendReminder1h] = useState(campaign.sendReminder1h);
  const [offset24h, setOffset24h] = useState(String(campaign.reminder24hOffsetMinutes));
  const [offset1h, setOffset1h] = useState(String(campaign.reminder1hOffsetMinutes));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [previewType, setPreviewType] = useState<ReminderMessageType>("booking_confirmation");

  async function handleSave() {
    const offset24hNum = Number(offset24h);
    const offset1hNum = Number(offset1h);
    if (!Number.isFinite(offset24hNum) || offset24hNum < 0 || !Number.isFinite(offset1hNum) || offset1hNum < 0) {
      setError("Offsets must be zero or a positive number of minutes.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_update_campaign_reminder_settings", {
      p_campaign_id: campaign.id,
      p_send_booking_confirmation: sendBookingConfirmation,
      p_send_reminder_24h: sendReminder24h,
      p_send_reminder_1h: sendReminder1h,
      p_reminder_24h_offset_minutes: offset24hNum,
      p_reminder_1h_offset_minutes: offset1hNum,
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onSaved();
  }

  const previewText = renderReminderMessage(previewType, {
    firstName: "Amara",
    clientName: campaign.clientName,
    campaignName: campaign.name,
    scheduledStart: samplePreviewStart(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    durationMinutes: campaign.estimatedDurationMinutes,
    incentiveTitle: campaign.incentiveTitle || null,
    incentiveDescription: campaign.incentiveDescription || null,
    manageBookingLink: `${typeof window !== "undefined" ? window.location.origin : ""}/participate/preview-token`,
  });

  return (
    <Card>
      <CardHeader
        title="Appointment reminders"
        description="SMS sent automatically as interviews approach — booking confirmation, and 24h/1h reminders before the scheduled time."
      />
      <CardBody className="flex flex-col gap-5">
        {error ? <InlineBanner kind="danger">{error}</InlineBanner> : null}

        <Checkbox
          label="Send a booking confirmation SMS as soon as a slot is booked"
          checked={sendBookingConfirmation}
          onChange={(e) => setSendBookingConfirmation(e.target.checked)}
        />

        <div className="flex flex-col gap-2">
          <Checkbox
            label="Send a reminder before the interview (24h)"
            checked={sendReminder24h}
            onChange={(e) => setSendReminder24h(e.target.checked)}
          />
          {sendReminder24h ? (
            <Field label="Minutes before the interview" hint="1440 = 24 hours">
              <Input
                type="number"
                min={0}
                className="w-32"
                value={offset24h}
                onChange={(e) => setOffset24h(e.target.value)}
              />
            </Field>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Checkbox
            label="Send a reminder before the interview (1h)"
            checked={sendReminder1h}
            onChange={(e) => setSendReminder1h(e.target.checked)}
          />
          {sendReminder1h ? (
            <Field label="Minutes before the interview" hint="60 = 1 hour">
              <Input
                type="number"
                min={0}
                className="w-32"
                value={offset1h}
                onChange={(e) => setOffset1h(e.target.value)}
              />
            </Field>
          ) : null}
        </div>

        <div className="flex justify-end">
          <Button disabled={saving} onClick={handleSave}>
            {saving ? "Saving..." : "Save reminder settings"}
          </Button>
        </div>

        <div className="border-t border-border pt-4">
          <p className="label-caps text-foreground-muted">Message preview</p>
          <p className="mt-1 text-xs text-foreground-subtle">
            Rendered with this campaign&apos;s own details and a sample participant — not a real send.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PREVIEW_TYPES.map((p) => (
              <button
                key={p.type}
                type="button"
                onClick={() => setPreviewType(p.type)}
                className={cn(
                  "rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors",
                  previewType === p.type
                    ? "bg-navy text-white"
                    : "bg-surface-muted text-foreground-muted hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-3 max-w-sm whitespace-pre-wrap rounded-[8px] border border-border bg-surface-muted p-3 text-sm text-foreground">
            {previewText}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
