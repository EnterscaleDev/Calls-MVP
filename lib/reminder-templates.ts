import "server-only";

/**
 * SMS copy for the five appointment-reminder message types. Pure
 * string-building — no DB/network access — so it's easy to unit-test and
 * reused as-is by the cron dispatch route.
 */

export type ReminderMessageType =
  | "booking_confirmation"
  | "reminder_24h"
  | "reminder_1h"
  | "reschedule_confirmation"
  | "cancellation_confirmation";

export interface ReminderMessageContext {
  firstName: string;
  clientName: string;
  campaignName: string;
  /** ISO timestamp (UTC instant) of the interview start. */
  scheduledStart: string;
  /** IANA zone, e.g. "Africa/Lagos" — the IDs the participant booked in. */
  timezone: string;
  durationMinutes: number;
  incentiveTitle: string | null;
  incentiveDescription: string | null;
  /** Link to manage (view/reschedule/cancel) the booking. Omitted for
   *  cancellation_confirmation — there's nothing left to manage. */
  manageBookingLink: string | null;
}

/** "today" / "tomorrow" / "Thursday 25 September" — computed against the
 *  participant's own calendar day in their booked timezone, not the
 *  server's. Never hardcoded, since the same reminder_type can land on
 *  different relative days depending on campaign offsets. */
function relativeDayLabel(scheduledStart: Date, now: Date, timezone: string): string {
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

  const nowKey = dayKey(now);
  const targetKey = dayKey(scheduledStart);
  if (nowKey === targetKey) return "today";

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (dayKey(tomorrow) === targetKey) return "tomorrow";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(scheduledStart);
}

function timeLabel(scheduledStart: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(scheduledStart)
    .replace(" ", "");
}

function incentiveClause(ctx: ReminderMessageContext): string {
  return ctx.incentiveTitle ? ` You'll get ${ctx.incentiveTitle}.` : "";
}

/** Renders the SMS body for one reminder type. `now` is injectable for
 *  deterministic testing; defaults to the real current time. */
export function renderReminderMessage(
  type: ReminderMessageType,
  ctx: ReminderMessageContext,
  now: Date = new Date()
): string {
  const start = new Date(ctx.scheduledStart);
  const day = relativeDayLabel(start, now, ctx.timezone);
  const time = timeLabel(start, ctx.timezone);
  const linkLine = ctx.manageBookingLink ? `\nManage your booking: ${ctx.manageBookingLink}` : "";

  switch (type) {
    case "booking_confirmation":
      return (
        `Hi ${ctx.firstName}, you're booked for a ${ctx.durationMinutes}-min phone interview with ${ctx.clientName} ` +
        `(${ctx.campaignName}) ${day} at ${time}.${incentiveClause(ctx)}${linkLine}`
      );
    case "reminder_24h":
      return (
        `Hi ${ctx.firstName}, reminder: your ${ctx.clientName} interview is ${day} at ${time} ` +
        `(about ${ctx.durationMinutes} min).${incentiveClause(ctx)}${linkLine}`
      );
    case "reminder_1h":
      return (
        `Hi ${ctx.firstName}, your ${ctx.clientName} interview call starts ${day} at ${time} — just under an hour ` +
        `from now. We'll call the number you booked with.${linkLine}`
      );
    case "reschedule_confirmation":
      return (
        `Hi ${ctx.firstName}, your ${ctx.clientName} interview has been moved to ${day} at ${time}.${incentiveClause(ctx)}${linkLine}`
      );
    case "cancellation_confirmation":
      return `Hi ${ctx.firstName}, your ${ctx.clientName} interview has been cancelled. No further action needed.`;
  }
}
