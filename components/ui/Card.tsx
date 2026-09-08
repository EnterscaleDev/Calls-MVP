import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-[8px] border border-border bg-surface", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-foreground-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

/**
 * Metric card. `tone="hero"` renders the filled-navy treatment reserved for
 * the single most important number on a screen (e.g. Overview's credit
 * balance, the Agent queue's today-completed count) — everything else stays
 * a plain white StatCard, matching the reference design's one-hero-per-view rule.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "hero";
  children?: ReactNode;
}) {
  if (tone === "hero") {
    return (
      <Card className="border-navy bg-navy px-5 py-4 text-navy-foreground">
        <p className="label-caps text-white/70">{label}</p>
        <p className="mt-1.5 text-[25px] font-bold tracking-[-0.035em] tabular-nums text-white">{value}</p>
        {hint ? <p className="mt-1 text-xs text-white/70">{hint}</p> : null}
        {children}
      </Card>
    );
  }

  const valueColor =
    tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <Card className="px-5 py-4">
      <p className="label-caps text-foreground-muted">{label}</p>
      <p className={cn("mt-1.5 text-[25px] font-bold tracking-[-0.035em] tabular-nums", valueColor)}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-foreground-subtle">{hint}</p> : null}
      {children}
    </Card>
  );
}
