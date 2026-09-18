"use client";

import { useAdminData } from "@/lib/hooks/useAdminData";
import { LoadingScreen, ErrorState } from "@/components/ui/States";
import { CallActivityBoard } from "../_lib/CallActivityBoard";

export default function CallActivityPage() {
  const { data: db, loading, error } = useAdminData();
  if (loading || !db) return <LoadingScreen label="Loading call activity..." />;
  if (error) return <ErrorState title="Couldn't load call activity" description={error} />;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-page-title">Call Activity</h1>
        <p className="mt-1 text-page-subtitle">
          Every call attempt across every campaign.
        </p>
      </div>
      <CallActivityBoard db={db} />
    </div>
  );
}
