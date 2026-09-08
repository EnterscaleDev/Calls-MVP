"use client";

import { useMemo, useState } from "react";
import { format, isSameDay } from "date-fns";
import { getAvailableSlots } from "@/lib/selectors";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import type { Campaign } from "@/lib/types";

interface SlotPickerProps {
  campaign: Campaign;
  onSelect: (start: Date, end: Date) => void;
  busy?: boolean;
}

export function SlotPicker({ campaign, onSelect, busy }: SlotPickerProps) {
  const slots = useMemo(() => getAvailableSlots(campaign, 5), [campaign]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  if (slots.length === 0) {
    return (
      <EmptyState
        title="No times available right now"
        description="Please check back soon, or contact the research team for help finding a time."
      />
    );
  }

  const groups: { day: Date; slots: typeof slots }[] = [];
  for (const slot of slots) {
    const group = groups.find((g) => isSameDay(g.day, slot.start));
    if (group) group.slots.push(slot);
    else groups.push({ day: slot.start, slots: [slot] });
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.day.toISOString()}>
          <p className="mb-2 text-sm font-semibold text-foreground">
            {format(group.day, "EEEE d MMMM")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {group.slots.map((slot) => {
              const key = slot.start.toISOString();
              const isSelected = selectedKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setSelectedKey(key);
                    onSelect(slot.start, slot.end);
                  }}
                  className={
                    "rounded-[5px] border px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 " +
                    (isSelected
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-surface text-foreground hover:bg-surface-muted")
                  }
                >
                  {format(slot.start, "h:mm a")}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SlotPickerCard({ campaign, onSelect, busy }: SlotPickerProps) {
  return (
    <Card>
      <CardBody>
        <SlotPicker campaign={campaign} onSelect={onSelect} busy={busy} />
      </CardBody>
    </Card>
  );
}

// Re-export a tiny helper so pages can format a booking's date/time consistently.
export function formatSlotRange(start: Date | string, end: Date | string) {
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  return {
    day: format(s, "EEEE d MMMM"),
    time: `${format(s, "h:mm a")} – ${format(e, "h:mm a")}`,
  };
}
