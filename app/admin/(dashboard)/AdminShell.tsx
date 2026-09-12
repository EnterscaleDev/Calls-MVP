"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Megaphone,
  Users,
  PhoneCall,
  Settings,
  Bell,
  ChevronDown,
  LogOut,
  MessageSquare,
  Mic,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { LoadingScreen } from "@/components/ui/States";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/admin/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/admin/agents", label: "People", icon: Users },
  { href: "/admin/call-activity", label: "Call Activity", icon: PhoneCall },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({
  adminName,
  children,
}: {
  adminName: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready: storeReady, db } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!storeReady) return <LoadingScreen label="Loading..." />;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-56 shrink-0 bg-navy md:flex md:flex-col">
        <div className="px-5 py-5">
          <p className="text-sm font-semibold text-white">Calls Ops</p>
          <p className="text-xs text-white/60">Research operations</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-[5px] px-3 py-2 text-[12.5px] transition-colors",
                  active
                    ? "bg-white/10 font-semibold text-white"
                    : "font-normal text-white/70 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:px-6">
          <div className="md:hidden text-sm font-semibold">Calls Ops</div>
          <div className="hidden text-sm font-medium text-foreground-muted md:block">
            Hexia Health · Northwind Insurance · Bexley Retail Group
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-[5px] border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-foreground sm:inline-flex">
              <MessageSquare size={13} className="text-foreground-subtle" />
              {db.orgCredits.sms.toLocaleString()}
            </span>
            <span className="hidden items-center gap-1.5 rounded-[5px] border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-foreground sm:inline-flex">
              <Mic size={13} className="text-foreground-subtle" />
              {db.orgCredits.voiceMinutes.toLocaleString()}
            </span>
            <button
              type="button"
              className="rounded-[5px] p-2 text-foreground-muted hover:bg-surface-muted"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-[5px] px-2 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                  {adminName.slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden sm:inline">{adminName}</span>
                <ChevronDown size={14} />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-[6px] border border-border bg-surface py-1 shadow-md">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-5 pb-20 md:px-6 md:py-6 md:pb-6">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-border bg-surface py-2 md:hidden">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 text-[10px] font-medium",
                active ? "text-primary" : "text-foreground-muted"
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
