"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { LoadingScreen } from "@/components/ui/States";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function Home() {
  const { ready, db } = useStore();

  if (!ready) return <LoadingScreen label="Loading Calls..." />;

  const demoParticipant = db.participants.find(
    (p) => p.campaignId === "camp_hexia" && p.participationStatus === "delivered"
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Calls MVP</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Research operations, telephone interviews</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-foreground-muted">
          A prototype vertical slice: create a campaign, invite participants by SMS, book interviews,
          assign agents, and run calls — end to end.
        </p>
      </div>
      <div className="grid w-full gap-4 sm:grid-cols-3">
        <Card className="flex flex-col items-start gap-3 p-5">
          <h2 className="text-sm font-semibold">Admin</h2>
          <p className="flex-1 text-xs text-foreground-muted">
            Create campaigns, upload contacts, send invitations, assign agents, monitor progress.
          </p>
          <ButtonLink href="/admin/login" className="w-full justify-center">
            Go to Admin
          </ButtonLink>
        </Card>
        <Card className="flex flex-col items-start gap-3 p-5">
          <h2 className="text-sm font-semibold">Agent</h2>
          <p className="flex-1 text-xs text-foreground-muted">
            See today&apos;s call queue, run interviews, submit notes and outcomes.
          </p>
          <ButtonLink href="/agent/login" variant="secondary" className="w-full justify-center">
            Go to Agent
          </ButtonLink>
        </Card>
        <Card className="flex flex-col items-start gap-3 p-5">
          <h2 className="text-sm font-semibold">Participant</h2>
          <p className="flex-1 text-xs text-foreground-muted">
            No account needed — open a secure invitation link to consent and book a time.
          </p>
          {demoParticipant ? (
            <ButtonLink
              href={`/participate/${demoParticipant.inviteToken}`}
              variant="secondary"
              className="w-full justify-center"
            >
              Try a sample invite
            </ButtonLink>
          ) : (
            <Button variant="secondary" disabled className="w-full justify-center">
              No sample link yet
            </Button>
          )}
        </Card>
      </div>
      <Link href="/admin/overview" className="text-xs text-foreground-subtle underline">
        Already signed in as Admin?
      </Link>
    </div>
  );
}
