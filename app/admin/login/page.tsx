"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { Card } from "@/components/ui/Card";
import { InlineBanner } from "@/components/ui/States";
import { setAdminSession } from "@/lib/auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("toni@enterscale.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Enter an email and password to continue.");
      return;
    }
    setError("");
    setSubmitting(true);
    // Mock auth: any non-empty credentials sign in. A real backend swaps this
    // for Supabase Auth without changing where AdminShell reads the session.
    setTimeout(() => {
      setAdminSession({ name: email.split("@")[0] });
      router.push("/admin/overview");
    }, 300);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Calls</p>
        <h1 className="mt-1 text-lg font-semibold text-foreground">Admin sign in</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Manage campaigns, contacts, invitations, and agents.
        </p>
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
          Prototype build — any email/password combination signs in.
        </p>
      </Card>
    </div>
  );
}
