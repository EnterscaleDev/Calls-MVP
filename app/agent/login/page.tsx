"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { Card } from "@/components/ui/Card";
import { InlineBanner } from "@/components/ui/States";
import { setAgentSession } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { LoadingScreen } from "@/components/ui/States";

export default function AgentLoginPage() {
  const router = useRouter();
  const { ready, db, actions } = useStore();
  const [email, setEmail] = useState("priya.shah@example.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!ready) return <LoadingScreen label="Loading..." />;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      setError("Enter your password to continue.");
      return;
    }
    const agent = db.agents.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
    if (!agent) {
      setError("We don't recognize that email. Ask your Admin to invite you.");
      return;
    }
    if (agent.status === "inactive") {
      setError("Your access has been deactivated. Contact your Admin.");
      return;
    }
    setError("");
    setSubmitting(true);
    setTimeout(() => {
      // First sign-in is what turns an "invited" agent "active" — this is
      // the only place that transition happens, mirroring a real accepted
      // invite rather than requiring a separate admin activation step.
      if (agent.status === "invited") {
        actions.setAgentStatus(agent.id, "active");
      }
      setAgentSession({ agentId: agent.id });
      router.push("/agent");
    }, 300);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Calls</p>
        <h1 className="mt-1 text-lg font-semibold text-foreground">Agent sign in</h1>
        <p className="mt-1 text-sm text-foreground-muted">See your daily call queue and run interviews.</p>
        <form className="mt-5 flex flex-col gap-4" onSubmit={handleSubmit}>
          {error ? <InlineBanner kind="danger">{error}</InlineBanner> : null}
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoFocus
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          <Button type="submit" disabled={submitting} className="justify-center">
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-foreground-subtle">
          Prototype build — any password works. priya.shah@example.com is already active; signing in as an
          invited agent (e.g. marcus.webb@example.com) activates their account.
        </p>
      </Card>
    </div>
  );
}
