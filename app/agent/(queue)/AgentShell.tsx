"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ListChecks, History, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

export function AgentShell({
  agentName,
  children,
}: {
  agentName: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/agent/login");
    router.refresh();
  }

  const inCall = pathname.startsWith("/agent/call/");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!inCall && (
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Calls Ops</p>
            <p className="text-xs text-foreground-muted">{agentName}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground-muted hover:bg-surface-muted"
          >
            <LogOut size={14} /> Sign out
          </button>
        </header>
      )}
      <main className="flex-1 pb-16">{children}</main>
      {!inCall && (
        <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-border bg-surface py-2">
          <Link
            href="/agent"
            className={cn(
              "flex flex-col items-center gap-0.5 px-6 text-[11px] font-medium",
              pathname === "/agent" ? "text-primary" : "text-foreground-muted"
            )}
          >
            <ListChecks size={18} />
            Queue
          </Link>
          <Link
            href="/agent/history"
            className={cn(
              "flex flex-col items-center gap-0.5 px-6 text-[11px] font-medium",
              pathname === "/agent/history" ? "text-primary" : "text-foreground-muted"
            )}
          >
            <History size={18} />
            History
          </Link>
        </nav>
      )}
    </div>
  );
}
