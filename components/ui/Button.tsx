import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "navy";
type Size = "sm" | "md";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover disabled:bg-foreground-subtle",
  secondary:
    "bg-surface text-foreground border border-border hover:bg-surface-muted disabled:text-foreground-subtle",
  ghost: "text-foreground-muted hover:bg-surface-muted disabled:text-foreground-subtle",
  danger: "bg-danger text-white hover:opacity-90 disabled:bg-foreground-subtle",
  navy: "bg-navy text-navy-foreground hover:bg-navy-hover disabled:bg-foreground-subtle",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-xs px-2.5 py-1.5 rounded-[5px] gap-1.5",
  md: "text-[13.5px] px-3.5 py-2 rounded-[5px] gap-2",
};

const base =
  "inline-flex items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={cn(base, variantClasses[variant], sizeClasses[size], className)} {...props}>
      {icon}
      {children}
    </button>
  );
}

interface ButtonLinkProps {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
}: ButtonLinkProps) {
  return (
    <Link href={href} className={cn(base, variantClasses[variant], sizeClasses[size], className)}>
      {icon}
      {children}
    </Link>
  );
}
