"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { Card } from "@/components/ui/Card";
import { InlineBanner } from "@/components/ui/States";
import { createClient } from "@/lib/supabase/client";

function AgentLoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("olutoni_dada@yahoo.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    searchParams.get("error") === "wrong_role"
      ? "That account isn't an agent. Sign in at the admin login instead."
      : ""
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Enter an email and password to continue.");
      return;
    }
    setError("");
    setSubmitting(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setSubmitting(false);
      setError(signInError.message);
      return;
    }
    router.push("/agent");
    router.refresh();
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
      </Card>
    </div>
  );
}

export default function AgentLoginPage() {
  return (
    <Suspense fallback={null}>
      <AgentLoginPageInner />
    </Suspense>
  );
}
