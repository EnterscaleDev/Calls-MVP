"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneCall, ClipboardCheck, Lock, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { Card } from "@/components/ui/Card";
import { InlineBanner } from "@/components/ui/States";

type Phase =
  | "loading"
  | "invalid_link"
  | "expired"
  | "revoked"
  | "already_accepted"
  | "setup"
  | "onboarding_welcome"
  | "onboarding_how"
  | "onboarding_ready";

interface InvitationInfo {
  agentName: string;
  organisationName: string;
  campaignNames: string[];
}

/**
 * Single page driving the whole post-click Agent invitation flow. There's
 * no {token} route param here — the real, single-use security token lives
 * inside the magic link Supabase's own inviteUserByEmail() sent (see
 * app/api/agents/invite/route.ts); by the time this page's client code
 * runs, supabase-js has already turned a valid link into a real session.
 * What this page adds on top is everything Supabase's own flow doesn't
 * know about: whose invitation this is, which campaigns, and the short
 * account-setup + onboarding steps before landing in the Agent workspace.
 */
export default function InviteAcceptPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const query = new URLSearchParams(window.location.search);
        const errorCode = hash.get("error_code") || query.get("error_code");
        setPhase(errorCode === "otp_expired" ? "expired" : "invalid_link");
        return;
      }

      const { data: rows, error } = await supabase.rpc("agent_lookup_own_invitation");
      if (cancelled) return;
      const row = rows?.[0];
      if (error || !row) {
        setPhase("invalid_link");
        return;
      }

      if (row.status === "revoked") {
        setPhase("revoked");
        return;
      }
      if (row.status === "accepted") {
        setPhase("already_accepted");
        return;
      }
      if (row.status === "expired" || new Date(row.expires_at).getTime() < Date.now()) {
        setPhase("expired");
        return;
      }

      setInfo({ agentName: row.agent_name, organisationName: row.organisation_name, campaignNames: row.campaign_names ?? [] });
      setName(row.agent_name);
      setPhase("setup");
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSetupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Enter your name.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords don't match.");
      return;
    }
    setFormError("");
    setSubmitting(true);
    const supabase = createClient();
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      setSubmitting(false);
      setFormError(passwordError.message);
      return;
    }
    const { error: acceptError } = await supabase.rpc("agent_accept_invitation", { p_display_name: name.trim() });
    setSubmitting(false);
    if (acceptError) {
      setFormError(
        acceptError.message.includes("expired")
          ? "This invitation expired while you were setting up. Ask your administrator to send a new one."
          : acceptError.message
      );
      if (acceptError.message.includes("expired")) setPhase("expired");
      return;
    }
    setPhase("onboarding_welcome");
  }

  function goToWorkspace() {
    router.push("/agent");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface px-4 py-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Calls</p>
      </header>
      <div className="mx-auto w-full max-w-md px-4 py-8">
        {phase === "loading" ? (
          <p className="py-16 text-center text-sm text-foreground-muted">Opening your invitation...</p>
        ) : phase === "invalid_link" ? (
          <Card className="p-6 text-center">
            <h1 className="text-lg font-semibold text-foreground">This invitation link isn&apos;t valid</h1>
            <p className="mt-2 text-sm text-foreground-muted">
              Double-check the link from your email, or ask your administrator to send a new invitation.
            </p>
          </Card>
        ) : phase === "expired" ? (
          <Card className="p-6 text-center">
            <h1 className="text-lg font-semibold text-foreground">This invitation has expired</h1>
            <p className="mt-2 text-sm text-foreground-muted">Ask your administrator to send a new invitation.</p>
          </Card>
        ) : phase === "revoked" ? (
          <Card className="p-6 text-center">
            <h1 className="text-lg font-semibold text-foreground">This invitation is no longer active</h1>
            <p className="mt-2 text-sm text-foreground-muted">
              Contact your administrator if you think this is a mistake.
            </p>
          </Card>
        ) : phase === "already_accepted" ? (
          <Card className="p-6 text-center">
            <h1 className="text-lg font-semibold text-foreground">You&apos;ve already accepted this invitation</h1>
            <p className="mt-2 text-sm text-foreground-muted">Sign in to get to your workspace.</p>
            <Button className="mt-4 w-full justify-center" onClick={() => router.push("/agent/login")}>
              Sign in
            </Button>
          </Card>
        ) : phase === "setup" && info ? (
          <Card className="p-6">
            <h1 className="text-lg font-semibold text-foreground">You&apos;ve been invited</h1>
            <p className="mt-1 text-sm text-foreground-muted">
              {info.organisationName} has invited you to join as a Call Agent.
            </p>
            {info.campaignNames.length > 0 ? (
              <div className="mt-3 rounded-[6px] border border-border bg-surface-muted p-3">
                <p className="label-caps text-foreground-subtle">You&apos;ll be working on</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {info.campaignNames.map((n) => (
                    <li key={n} className="text-sm font-medium text-foreground">
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <form onSubmit={handleSetupSubmit} className="mt-5 flex flex-col gap-4">
              {formError ? <InlineBanner kind="danger">{formError}</InlineBanner> : null}
              <Field label="Full name" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
              <Field label="Password" required hint="At least 8 characters.">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirm password" required>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
              <Button type="submit" disabled={submitting} className="w-full justify-center">
                {submitting ? "Setting up..." : "Create account & continue"}
              </Button>
            </form>
          </Card>
        ) : phase === "onboarding_welcome" && info ? (
          <Card className="p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <CheckCircle2 size={24} />
            </div>
            <h1 className="mt-3 text-lg font-semibold text-foreground">Welcome, {name.split(" ")[0]}</h1>
            <p className="mt-1 text-sm text-foreground-muted">
              You&apos;ve joined {info.organisationName} as a Call Agent.
            </p>
            {info.campaignNames.length > 0 ? (
              <p className="mt-2 text-sm text-foreground">
                Assigned: <span className="font-medium">{info.campaignNames.join(", ")}</span>
              </p>
            ) : null}
            <Button className="mt-5 w-full justify-center" onClick={() => setPhase("onboarding_how")}>
              Continue
            </Button>
          </Card>
        ) : phase === "onboarding_how" ? (
          <Card className="p-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-navy-soft text-navy">
              <PhoneCall size={22} />
            </div>
            <h1 className="mt-3 text-center text-lg font-semibold text-foreground">How your calls work</h1>
            <ol className="mt-4 flex flex-col gap-3 text-sm text-foreground">
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                  1
                </span>
                Open an assigned interview.
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                  2
                </span>
                Start the call from the platform.
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                  3
                </span>
                Submit an outcome and notes when finished.
              </li>
            </ol>
            <div className="mt-4 flex items-start gap-2.5 rounded-[6px] border border-navy/20 bg-navy-soft p-3">
              <Lock size={16} className="mt-0.5 shrink-0 text-navy" />
              <p className="text-xs text-navy">
                Participant phone numbers remain private and are not displayed to Agents.
              </p>
            </div>
            <Button className="mt-5 w-full justify-center" onClick={() => setPhase("onboarding_ready")}>
              Continue
            </Button>
          </Card>
        ) : phase === "onboarding_ready" ? (
          <Card className="p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <ClipboardCheck size={24} />
            </div>
            <h1 className="mt-3 text-lg font-semibold text-foreground">You&apos;re ready</h1>
            <p className="mt-2 text-sm text-foreground-muted">
              Head to your workspace to see what&apos;s assigned to you today.
            </p>
            <Button className="mt-5 w-full justify-center" onClick={goToWorkspace}>
              Go to today&apos;s calls
            </Button>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
