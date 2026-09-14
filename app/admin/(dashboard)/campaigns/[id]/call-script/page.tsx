"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { makeId } from "@/lib/id";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { InlineBanner, EmptyState, LoadingScreen, ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { useCampaignDetail } from "../campaign-context";
import type { CallScriptSection } from "@/lib/types";

function emptySection(): CallScriptSection {
  return { id: makeId("section"), title: "", instructions: "", questions: [""] };
}

export default function CallScriptPage() {
  const campaign = useCampaignDetail();
  const [sections, setSections] = useState<CallScriptSection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("call_script_sections")
      .select("id, title, instructions, questions, position")
      .eq("campaign_id", campaign.id)
      .order("position");
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    const loaded: CallScriptSection[] = (data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      instructions: r.instructions ?? undefined,
      questions: r.questions ?? [],
    }));
    setSections(loaded);
    setActiveId((prev) => (prev && loaded.some((s) => s.id === prev) ? prev : (loaded[0]?.id ?? null)));
    setLoading(false);
  }, [campaign.id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const activeIndex = sections.findIndex((s) => s.id === activeId);
  const active = activeIndex >= 0 ? sections[activeIndex] : null;

  if (loading) return <LoadingScreen label="Loading call script..." />;
  if (error) return <ErrorState title="Couldn't load the call script" description={error} />;

  function mutate(updater: (prev: CallScriptSection[]) => CallScriptSection[]) {
    setSaved(false);
    setSections(updater);
  }

  function updateSection(index: number, patch: Partial<CallScriptSection>) {
    mutate((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSection() {
    const section = emptySection();
    mutate((prev) => [...prev, section]);
    setActiveId(section.id);
  }

  function removeSection(index: number) {
    const removedId = sections[index].id;
    mutate((prev) => prev.filter((_, i) => i !== index));
    if (activeId === removedId) {
      setActiveId(sections.filter((_, i) => i !== index)[0]?.id ?? null);
    }
  }

  function addQuestion(index: number) {
    mutate((prev) =>
      prev.map((s, i) => (i === index ? { ...s, questions: [...s.questions, ""] } : s))
    );
  }

  function updateQuestion(sectionIndex: number, questionIndex: number, value: string) {
    mutate((prev) =>
      prev.map((s, i) =>
        i === sectionIndex
          ? { ...s, questions: s.questions.map((q, qi) => (qi === questionIndex ? value : q)) }
          : s
      )
    );
  }

  function removeQuestion(sectionIndex: number, questionIndex: number) {
    mutate((prev) =>
      prev.map((s, i) =>
        i === sectionIndex ? { ...s, questions: s.questions.filter((_, qi) => qi !== questionIndex) } : s
      )
    );
  }

  async function handleSave() {
    const cleaned = sections
      .map((s) => ({ ...s, questions: s.questions.map((q) => q.trim()).filter(Boolean) }))
      .filter((s) => s.title.trim().length > 0 || s.questions.length > 0);

    setSaving(true);
    setError(null);
    const supabase = createClient();

    // Wholesale replace, matching the mock's "save the whole script" model:
    // call_script_sections has no stable identity worth preserving across a
    // save, so every save just re-derives contiguous 0..n-1 positions from
    // the current array order rather than diffing per-section.
    const { error: deleteError } = await supabase
      .from("call_script_sections")
      .delete()
      .eq("campaign_id", campaign.id);
    if (deleteError) {
      setSaving(false);
      setError(deleteError.message);
      return;
    }

    if (cleaned.length === 0) {
      // call_script_sections.campaign_id FKs to call_scripts.campaign_id (its
      // own primary key) — drop the parent row too so "no script" looks the
      // same as it did before one was ever authored.
      await supabase.from("call_scripts").delete().eq("campaign_id", campaign.id);
    } else {
      const { error: upsertError } = await supabase
        .from("call_scripts")
        .upsert({ campaign_id: campaign.id, updated_at: new Date().toISOString() });
      if (upsertError) {
        setSaving(false);
        setError(upsertError.message);
        return;
      }
      const { error: insertError } = await supabase.from("call_script_sections").insert(
        cleaned.map((s, i) => ({
          campaign_id: campaign.id,
          title: s.title,
          instructions: s.instructions?.trim() ? s.instructions.trim() : null,
          questions: s.questions,
          position: i,
        }))
      );
      if (insertError) {
        setSaving(false);
        setError(insertError.message);
        return;
      }
    }

    setSaving(false);
    setSaved(true);
    await refetch();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground-muted">
          Sections and questions the agent walks through during the call.
        </p>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save script"}
        </Button>
      </div>

      {saved ? <InlineBanner kind="success">Call script saved.</InlineBanner> : null}

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Card className="h-fit">
          <CardHeader title="Sections" description={`${sections.length} section${sections.length === 1 ? "" : "s"}`} />
          <CardBody className="flex flex-col gap-1 p-2">
            {sections.map((section, index) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveId(section.id)}
                className={cn(
                  "flex items-start gap-2 rounded-[5px] px-3 py-2 text-left text-sm transition-colors",
                  activeId === section.id
                    ? "bg-navy-soft text-navy font-semibold"
                    : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                )}
              >
                <span className="tabular-nums text-xs text-foreground-subtle">{index + 1}</span>
                <span className="truncate">{section.title.trim() || "Untitled section"}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={addSection}
              className="mt-1 flex items-center gap-1.5 rounded-[5px] px-3 py-2 text-left text-xs font-medium text-primary hover:bg-primary-soft"
            >
              <Plus size={14} /> Add section
            </button>
          </CardBody>
        </Card>

        {!active ? (
          <EmptyState
            title="No sections yet"
            description="Add a section to start building the interview script."
            action={
              <Button onClick={addSection} icon={<Plus size={14} />}>
                Add section
              </Button>
            }
          />
        ) : (
          <Card>
            <CardHeader
              title={`Section ${activeIndex + 1}`}
              action={
                <button
                  type="button"
                  onClick={() => removeSection(activeIndex)}
                  className="rounded-[5px] p-1.5 text-foreground-muted hover:bg-danger-soft hover:text-danger"
                  aria-label="Remove section"
                >
                  <Trash2 size={16} />
                </button>
              }
            />
            <CardBody className="flex flex-col gap-4">
              <Field label="Title">
                <Input
                  value={active.title}
                  onChange={(e) => updateSection(activeIndex, { title: e.target.value })}
                  placeholder="e.g. Introduction & consent reminder"
                />
              </Field>
              <Field label="Instructions" hint="Notes for the agent, not read aloud verbatim.">
                <Textarea
                  rows={2}
                  value={active.instructions ?? ""}
                  onChange={(e) => updateSection(activeIndex, { instructions: e.target.value })}
                />
              </Field>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">What the agent says</span>
                {active.questions.map((q, qIndex) => (
                  <div key={qIndex} className="flex items-center gap-2">
                    <Input
                      value={q}
                      onChange={(e) => updateQuestion(activeIndex, qIndex, e.target.value)}
                      placeholder={`Question ${qIndex + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeQuestion(activeIndex, qIndex)}
                      className="rounded-[5px] p-2 text-foreground-muted hover:bg-danger-soft hover:text-danger"
                      aria-label="Remove question"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addQuestion(activeIndex)}
                  className="self-start text-xs font-medium text-primary hover:underline"
                >
                  + Add question
                </button>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
