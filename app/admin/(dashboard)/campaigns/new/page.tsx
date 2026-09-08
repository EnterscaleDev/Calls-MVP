"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Field, Input, Textarea, Select } from "@/components/ui/Form";
import { Button, ButtonLink } from "@/components/ui/Button";
import { InlineBanner } from "@/components/ui/States";
import type { CampaignStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: CampaignStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

interface FormState {
  name: string;
  clientName: string;
  researchObjective: string;
  description: string;
  startDate: string;
  endDate: string;
  targetCompletions: string;
  dailyAgentTarget: string;
  estimatedDurationMinutes: string;
  incentiveTitle: string;
  incentiveDescription: string;
  senderId: string;
  recordingEnabled: boolean;
  status: CampaignStatus;
}

const INITIAL_STATE: FormState = {
  name: "",
  clientName: "",
  researchObjective: "",
  description: "",
  startDate: "",
  endDate: "",
  targetCompletions: "50",
  dailyAgentTarget: "8",
  estimatedDurationMinutes: "30",
  incentiveTitle: "",
  incentiveDescription: "",
  senderId: "",
  recordingEnabled: false,
  status: "draft",
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

export default function NewCampaignPage() {
  const router = useRouter();
  const { ready, actions } = useStore();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!form.name.trim()) next.name = "Campaign name is required.";
    if (!form.clientName.trim()) next.clientName = "Client name is required.";
    if (!form.researchObjective.trim()) next.researchObjective = "Research objective is required.";
    if (!form.startDate) next.startDate = "Start date is required.";
    if (!form.endDate) next.endDate = "End date is required.";
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      next.endDate = "End date must be on or after the start date.";
    }
    const target = Number(form.targetCompletions);
    if (!form.targetCompletions || !Number.isFinite(target) || target <= 0) {
      next.targetCompletions = "Enter a target number of completed interviews.";
    }
    if (!form.senderId.trim()) next.senderId = "Sender ID is required.";
    return next;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setSubmitError("Fix the highlighted fields before continuing.");
      return;
    }
    setSubmitError("");
    if (!ready) {
      setSubmitError("Store isn't ready yet — try again in a moment.");
      return;
    }
    const campaign = actions.createCampaign({
      name: form.name.trim(),
      clientName: form.clientName.trim(),
      description: form.description.trim(),
      researchObjective: form.researchObjective.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      targetCompletions: Number(form.targetCompletions),
      dailyAgentTarget: Number(form.dailyAgentTarget) || 0,
      estimatedDurationMinutes: Number(form.estimatedDurationMinutes) || 0,
      incentiveTitle: form.incentiveTitle.trim(),
      incentiveDescription: form.incentiveDescription.trim(),
      senderId: form.senderId.trim(),
      recordingEnabled: form.recordingEnabled,
      status: form.status,
    });
    router.push(`/admin/campaigns/${campaign.id}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">New Campaign</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Set up a telephone interview campaign. You can upload contacts and invite agents next.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {submitError ? <InlineBanner kind="danger">{submitError}</InlineBanner> : null}

        <Card>
          <CardHeader title="Campaign details" />
          <CardBody className="grid gap-4 md:grid-cols-2">
            <Field label="Campaign name" required error={errors.name}>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Hexia Patient Discovery — September" />
            </Field>
            <Field label="Client name" required error={errors.clientName}>
              <Input value={form.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="e.g. Hexia Health" />
            </Field>
            <Field
              label="Research objective"
              required
              error={errors.researchObjective}
              hint="What decision or insight should this campaign produce?"
            >
              <Textarea
                rows={2}
                value={form.researchObjective}
                onChange={(e) => set("researchObjective", e.target.value)}
              />
            </Field>
            <Field label="Campaign description">
              <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <Field label="Campaign type" hint="More types may be added later.">
              <Select disabled value="telephone_interview" onChange={() => {}}>
                <option value="telephone_interview">Telephone Interview</option>
              </Select>
            </Field>
            <Field label="Campaign status">
              <Select value={form.status} onChange={(e) => set("status", e.target.value as CampaignStatus)}>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Schedule & targets" />
          <CardBody className="grid gap-4 md:grid-cols-2">
            <Field label="Start date" required error={errors.startDate}>
              <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </Field>
            <Field label="End date" required error={errors.endDate}>
              <Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </Field>
            <Field label="Target completed interviews" required error={errors.targetCompletions}>
              <Input
                type="number"
                min={1}
                value={form.targetCompletions}
                onChange={(e) => set("targetCompletions", e.target.value)}
              />
            </Field>
            <Field label="Daily agent target">
              <Input
                type="number"
                min={0}
                value={form.dailyAgentTarget}
                onChange={(e) => set("dailyAgentTarget", e.target.value)}
              />
            </Field>
            <Field label="Estimated interview duration (minutes)">
              <Input
                type="number"
                min={0}
                value={form.estimatedDurationMinutes}
                onChange={(e) => set("estimatedDurationMinutes", e.target.value)}
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Incentive" />
          <CardBody className="grid gap-4 md:grid-cols-2">
            <Field label="Incentive title">
              <Input value={form.incentiveTitle} onChange={(e) => set("incentiveTitle", e.target.value)} placeholder="e.g. $25 digital gift card" />
            </Field>
            <Field label="Incentive description">
              <Input
                value={form.incentiveDescription}
                onChange={(e) => set("incentiveDescription", e.target.value)}
                placeholder="e.g. Sent by email within 3 business days"
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Messaging & recording" />
          <CardBody className="grid gap-4 md:grid-cols-2">
            <Field label="Sender ID" required error={errors.senderId} hint="Shown as the SMS sender name.">
              <Input value={form.senderId} onChange={(e) => set("senderId", e.target.value.toUpperCase())} placeholder="e.g. HEXIA" />
            </Field>
            <Field label="Recording enabled">
              <Select
                value={form.recordingEnabled ? "yes" : "no"}
                onChange={(e) => set("recordingEnabled", e.target.value === "yes")}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
            </Field>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-3">
          <ButtonLink href="/admin/campaigns" variant="secondary">
            Cancel
          </ButtonLink>
          <Button type="submit">Create Campaign</Button>
        </div>
      </form>
    </div>
  );
}
