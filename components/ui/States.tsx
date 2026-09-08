import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed border-border bg-surface-muted px-6 py-12 text-center">
      {icon ? <div className="text-foreground-subtle">{icon}</div> : null}
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? <p className="mt-1 text-sm text-foreground-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something didn't work",
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[8px] border border-danger/30 bg-danger-soft px-6 py-10 text-center">
      <div>
        <p className="text-sm font-semibold text-danger">{title}</p>
        <p className="mt-1 text-sm text-danger/80">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function InlineBanner({
  kind = "info",
  children,
}: {
  kind?: "info" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  const toneClasses = {
    info: "bg-info-soft text-info border-info/20",
    success: "bg-success-soft text-success border-success/20",
    warning: "bg-warning-soft text-warning border-warning/20",
    danger: "bg-danger-soft text-danger border-danger/20",
  }[kind];
  return (
    <div className={cn("rounded-[6px] border px-4 py-3 text-sm", toneClasses)}>{children}</div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-neutral-soft", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-[8px] border border-border bg-surface px-5 py-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-16" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}

export function LoadingScreen({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center py-24 text-sm text-foreground-muted">
      {label}
    </div>
  );
}
