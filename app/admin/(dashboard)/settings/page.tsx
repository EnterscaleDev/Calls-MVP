"use client";

import { useState } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { InlineBanner } from "@/components/ui/States";

export default function SettingsPage() {
  const [orgName, setOrgName] = useState("Enterscale Research");
  const [defaultSenderId, setDefaultSenderId] = useState("CALLS");
  const [saved, setSaved] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    // Prototype phase: nothing to persist to yet — this exists so the nav
    // link isn't a dead end, and to establish the shape of the real settings
    // form once there's a backend to save it to.
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Organisation-wide defaults. Low priority for this prototype phase.
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-5">
        {saved ? <InlineBanner kind="success">Settings saved.</InlineBanner> : null}
        <Card>
          <CardHeader title="Organisation" />
          <CardBody className="grid gap-4 md:grid-cols-2">
            <Field label="Organisation name">
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </Field>
            <Field label="Default sender ID" hint="Used to prefill new campaigns.">
              <Input value={defaultSenderId} onChange={(e) => setDefaultSenderId(e.target.value.toUpperCase())} />
            </Field>
          </CardBody>
        </Card>
        <div className="flex justify-end">
          <Button type="submit">Save Settings</Button>
        </div>
      </form>
    </div>
  );
}
