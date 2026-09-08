"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { getCallScript } from "@/lib/selectors";
import { makeId } from "@/lib/id";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { InlineBanner } from "@/components/ui/States";
import { useCampaignDetail } from "../campaign-context";
import type { CallScriptSection } from "@/lib/types";

function emptySection(): CallScriptSection {
  return { id: makeId("section"), title: "", instructions: "", questions: [""] };
}

export default function CallScriptPage() {
  const campaign = useCampaignDetail();
  const { db, actions } = useStore();
  const existing = getCallScript(db, campaign.id);

  const [sections, setSections] = useState<CallScriptSection[]>(
    existing?.sections.length ? existing.sections : [emptySection()]
  );
  const [saved, setSaved] = useState(false);

  function mutate(updater: (prev: CallScriptSection[]) => CallScriptSection[]) {
    setSaved(false);
    setSections(updater);
  }

  function updateSection(index: number, patch: Partial<CallScriptSection>) {
    mutate((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSection() {
    mutate((prev) => [...prev, emptySection()]);
  }

  function removeSection(index: number) {
    mutate((prev) => prev.filter((_, i) => i !== index));
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

  function handleSave() {
    const cleaned = sections
      .map((s) => ({ ...s, questions: s.questions.map((q) => q.trim()).filter(Boolean) }))
      .filter((s) => s.title.trim().length > 0 || s.questions.length > 0);
    actions.updateCallScript(campaign.id, cleaned);
    setSections(cleaned.length ? cleaned : [emptySection()]);
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground-muted">
          Sections and questions the agent walks through during the call.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={addSection} icon={<Plus size={14} />}>
            Add section
          </Button>
          <Button onClick={handleSave}>Save Script</Button>
        </div>
      </div>

      {saved ? <InlineBanner kind="success">Call script saved.</InlineBanner> : null}

      <div className="flex flex-col gap-4">
        {sections.map((section, sIndex) => (
          <Card key={section.id}>
            <CardHeader
              title={`Section ${sIndex + 1}`}
              action={
                <button
                  type="button"
                  onClick={() => removeSection(sIndex)}
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
                  value={section.title}
                  onChange={(e) => updateSection(sIndex, { title: e.target.value })}
                  placeholder="e.g. Introduction & consent reminder"
                />
              </Field>
              <Field label="Instructions" hint="Notes for the agent, not read aloud verbatim.">
                <Textarea
                  rows={2}
                  value={section.instructions ?? ""}
                  onChange={(e) => updateSection(sIndex, { instructions: e.target.value })}
                />
              </Field>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">Questions</span>
                {section.questions.map((q, qIndex) => (
                  <div key={qIndex} className="flex items-center gap-2">
                    <Input
                      value={q}
                      onChange={(e) => updateQuestion(sIndex, qIndex, e.target.value)}
                      placeholder={`Question ${qIndex + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeQuestion(sIndex, qIndex)}
                      className="rounded-[5px] p-2 text-foreground-muted hover:bg-danger-soft hover:text-danger"
                      aria-label="Remove question"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addQuestion(sIndex)}
                  className="self-start text-xs font-medium text-primary hover:underline"
                >
                  + Add question
                </button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
