"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { Button, ButtonLink } from "@/components/ui/Button";
import { InlineBanner } from "@/components/ui/States";
import { useCampaignDetail } from "../campaign-context";

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
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

export default function EditCampaignPage() {
  const campaign = useCampaignDetail();
  const [form, setForm] = useState<FormState>({
    name: campaign.name,
    clientName: campaign.clientName,
    researchObjective: campaign.researchObjective,
    description: campaign.description,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    targetCompletions: String(campaign.targetCompletions),
    dailyAgentTarget: String(campaign.dailyAgentTarget),
    estimatedDurationMinutes: String(campaign.estimatedDurationMinutes),
    incentiveTitle: campaign.incentiveTitle,
    incentiveDescription: campaign.incentiveDescription,
    senderId: campaign.senderId,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!form.name.trim()) next.name = "Campaign name is required.";
    if (!form.clientName.trim()) next.clientName = "Client name is required.";
    if (!form.startDate) next.startDate = "Start date is required.";
    if (!form.endDate) next.endDate = "End date is required.";
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      next.endDate = "End date must be on or after the start date.";
    }
    const target = Number(form.targetCompletions);
    if (!form.targetCompletions || !Number.isFinite(target) || target <= 0) {
      next.targetCompletions = "Enter a target number of completed interviews.";
    }
    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setSubmitError("Fix the highlighted fields before continuing.");
      return;
    }
    setSubmitError("");
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_update_campaign_details", {
      p_campaign_id: campaign.id,
      p_name: form.name.trim(),
      p_client_name: form.clientName.trim(),
      p_description: form.description.trim(),
      p_research_objective: form.researchObjective.trim(),
      p_start_date: form.startDate,
      p_end_date: form.endDate,
      p_target_completions: Number(form.targetCompletions),
      p_daily_agent_target: Number(form.dailyAgentTarget) || 0,
      p_estimated_duration_minutes: Number(form.estimatedDurationMinutes) || 0,
      p_incentive_title: form.incentiveTitle.trim(),
      p_incentive_description: form.incentiveDescription.trim(),
      p_sender_id: form.senderId.trim(),
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    // A hard navigation, not router.push — the campaign-detail layout keeps
    // its own separate useAdminData() call for the header (name, status,
    // dates), and a soft navigation would leave it showing the pre-edit
    // values until something else happens to refetch it.
    window.location.assign(`/admin/campaigns/${campaign.id}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-page-title">Edit campaign</h1>
        <p className="mt-1 text-page-subtitle">
          Changes here only affect campaign configuration — contacts, consent, bookings, calls and
          notes already recorded are never touched.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {submitError ? <InlineBanner kind="danger">{submitError}</InlineBanner> : null}

        <Card>
          <CardHeader title="Campaign details" />
          <CardBody className="grid gap-4 md:grid-cols-2">
            <Field label="Campaign name" required error={errors.name}>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Client name" required error={errors.clientName}>
              <Input value={form.clientName} onChange={(e) => set("clientName", e.target.value)} />
            </Field>
            <Field label="Research objective" hint="What decision or insight should this campaign produce?">
              <Textarea
                rows={2}
                value={form.researchObjective}
                onChange={(e) => set("researchObjective", e.target.value)}
              />
            </Field>
            <Field label="Campaign description">
              <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
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
              <Input value={form.incentiveTitle} onChange={(e) => set("incentiveTitle", e.target.value)} />
            </Field>
            <Field label="Incentive description">
              <Input
                value={form.incentiveDescription}
                onChange={(e) => set("incentiveDescription", e.target.value)}
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Messaging"
            description="Recording and call script have their own tabs — Settings and Call Script."
          />
          <CardBody className="grid gap-4 md:grid-cols-2">
            <Field label="Sender ID" hint="Shown as the SMS sender name.">
              <Input value={form.senderId} onChange={(e) => set("senderId", e.target.value)} />
            </Field>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-3">
          <ButtonLink href={`/admin/campaigns/${campaign.id}`} variant="secondary">
            Cancel
          </ButtonLink>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
