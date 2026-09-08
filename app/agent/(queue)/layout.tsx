"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { ListChecks, History, LogOut } from "lucide-react";
import { clearAgentSession, useAgentSession } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { LoadingScreen } from "@/components/ui/States";
import { cn } from "@/lib/cn";

export default function AgentShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready: sessionReady, session } = useAgentSession();
  const { ready: storeReady, db } = useStore();

  useEffect(() => {
    if (sessionReady && !session) router.replace("/agent/login");
  }, [sessionReady, session, router]);

  if (!sessionReady || !storeReady || !session) return <LoadingScreen label="Checking your session..." />;

  const agent = db.agents.find((a) => a.id === session.agentId);
  if (!agent) {
    if (typeof window !== "undefined") router.replace("/agent/login");
    return <LoadingScreen label="Checking your session..." />;
  }

  const inCall = pathname.startsWith("/agent/call/");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!inCall && (
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Calls Ops</p>
            <p className="text-xs text-foreground-muted">{agent.name}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              clearAgentSession();
              router.replace("/agent/login");
            }}
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
