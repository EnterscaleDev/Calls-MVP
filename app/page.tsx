import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/enterscale-logo.png" alt="Enterscale" className="mx-auto h-8 w-auto" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-primary">Calls MVP</p>
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
            No account needed — participants get a private, one-time invitation link by SMS to
            consent and book a time. There&apos;s no public link to try here.
          </p>
        </Card>
      </div>
      <Link href="/admin/overview" className="text-xs text-foreground-subtle underline">
        Already signed in as Admin?
      </Link>
    </div>
  );
}
