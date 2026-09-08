"use client";

import { useStore } from "@/lib/store";
import { LoadingScreen } from "@/components/ui/States";
import { CallActivityBoard } from "../_lib/CallActivityBoard";

export default function CallActivityPage() {
  const { ready, db } = useStore();
  if (!ready) return <LoadingScreen label="Loading call activity..." />;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Call Activity</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Every call attempt across every campaign.
        </p>
      </div>
      <CallActivityBoard db={db} />
    </div>
  );
}
