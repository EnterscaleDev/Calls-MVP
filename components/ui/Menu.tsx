"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

export interface MenuAction {
  key: string;
  label: ReactNode;
  hint?: string;
  onSelect: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
}

/**
 * Row-level `•••` overflow menu. Positioned with `fixed` (computed from the
 * trigger's own rect, same technique Modal.tsx already uses) rather than a
 * portal — that's enough to escape a table's `overflow-x-auto` wrapper
 * without adding a new pattern to the codebase.
 */
export function OverflowMenu({ actions, ariaLabel = "Actions" }: { actions: MenuAction[]; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function handleReposition() {
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((o) => !o);
  }

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="rounded-[5px] p-1.5 text-foreground-muted hover:bg-surface-muted hover:text-foreground"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && coords ? (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: coords.top, right: coords.right }}
          className="z-50 min-w-[210px] overflow-hidden rounded-[6px] border border-border bg-surface py-1 shadow-lg"
        >
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                action.onSelect();
              }}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors",
                action.disabled
                  ? "cursor-not-allowed text-foreground-subtle"
                  : action.variant === "danger"
                    ? "text-danger hover:bg-danger-soft"
                    : "text-foreground hover:bg-surface-muted"
              )}
            >
              <span>{action.label}</span>
              {action.hint ? <span className="text-xs font-normal text-foreground-subtle">{action.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
