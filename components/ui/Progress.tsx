import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  className,
  tone = "primary",
}: {
  value: number;
  className?: string;
  tone?: "primary" | "info" | "navy";
}) {
  const pct = Math.max(0, Math.min(100, value * 100));
  const fill = tone === "info" ? "bg-info" : tone === "navy" ? "bg-navy" : "bg-primary";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-black/10", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * One row of a horizontal funnel: label, value, an optional "of previous
 * step" percentage, and a colored fill bar beneath — matches the reference
 * design's campaign-funnel layout (as opposed to a step-box diagram).
 */
export function FunnelRow({
  label,
  value,
  maxValue,
  pctOfPrevious,
  sideNote,
  tone = "primary",
  isFirst,
}: {
  label: string;
  value: number;
  /** The funnel's first-step value — every row's bar width is relative to this. */
  maxValue: number;
  pctOfPrevious?: number;
  sideNote?: string;
  tone?: "primary" | "info" | "navy";
  isFirst?: boolean;
}) {
  const fill = tone === "info" ? "bg-info" : tone === "navy" ? "bg-navy" : "bg-primary";
  const widthPct = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="flex items-baseline gap-2 tabular-nums">
          {sideNote ? <span className="text-xs text-foreground-subtle">{sideNote}</span> : null}
          <span className="font-semibold text-foreground">{value.toLocaleString()}</span>
          {!isFirst && pctOfPrevious !== undefined ? (
            <span className="text-xs text-foreground-subtle">{Math.round(pctOfPrevious * 100)}%</span>
          ) : null}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-soft">
        <div className={cn("h-full rounded-full", fill)} style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}
