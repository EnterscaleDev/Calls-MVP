"use client";

import { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { parseContactsCsv, EXAMPLE_CSV, EXAMPLE_CSV_FIELDS, normalizePhone } from "@/lib/csv";
import { getCampaignParticipantRows } from "@/lib/selectors";
import type { ParseResult } from "@/lib/csv";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState, InlineBanner } from "@/components/ui/States";
import { ParticipationStatusBadge, Badge } from "@/components/ui/Badge";
import { useCampaignDetail } from "../campaign-context";

const VALIDATION_LABEL: Record<string, string> = {
  valid: "Valid",
  invalid_phone: "Invalid phone",
  missing_phone: "Missing phone",
  duplicate: "Duplicate",
};

const VALIDATION_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  valid: "success",
  invalid_phone: "danger",
  missing_phone: "danger",
  duplicate: "warning",
};

export default function AudiencePage() {
  const campaign = useCampaignDetail();
  const { db, actions } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [importing, setImporting] = useState(false);

  const participantRows = getCampaignParticipantRows(db, campaign.id);

  const existingPhones = useMemo(() => {
    const set = new Set<string>();
    for (const row of participantRows) {
      set.add(normalizePhone(row.contact.phone));
    }
    return set;
  }, [participantRows]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSuccessMessage("");
    setParseError("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const result = parseContactsCsv(text, existingPhones);
        setParseResult(result);
      } catch {
        setParseError("Couldn't read that file. Make sure it's a valid CSV.");
        setParseResult(null);
      }
    };
    reader.onerror = () => setParseError("Couldn't read that file. Try again.");
    reader.readAsText(file);
  }

  function handleConfirmImport() {
    if (!parseResult) return;
    setImporting(true);
    const summary = actions.importContacts(campaign.id, parseResult.rows);
    setImporting(false);
    setSuccessMessage(
      `Imported ${summary.imported} contact${summary.imported === 1 ? "" : "s"}${
        summary.skipped > 0 ? ` — ${summary.skipped} skipped` : ""
      }.`
    );
    setParseResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDownloadExample() {
    const blob = new Blob([EXAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "example-contacts.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader
          title="Upload contacts"
          description="Import a CSV of contacts to recruit for this campaign."
        />
        <CardBody className="flex flex-col gap-4">
          {successMessage ? <InlineBanner kind="success">{successMessage}</InlineBanner> : null}
          {parseError ? <InlineBanner kind="danger">{parseError}</InlineBanner> : null}

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="text-sm text-foreground-muted file:mr-3 file:rounded-[5px] file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-surface-muted"
            />
            <button
              type="button"
              onClick={handleDownloadExample}
              className="text-sm font-medium text-primary hover:underline"
            >
              Download example CSV
            </button>
          </div>
          <p className="text-xs text-foreground-subtle">
            Expected columns: {EXAMPLE_CSV_FIELDS.join(", ")}
          </p>

          {parseResult ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-foreground">
                {parseResult.totalRows} row{parseResult.totalRows === 1 ? "" : "s"} found,{" "}
                {parseResult.counts.valid} valid, {parseResult.counts.duplicate} duplicate,{" "}
                {parseResult.counts.invalid_phone + parseResult.counts.missing_phone} invalid.
              </p>
              <div className="max-h-80 overflow-auto rounded-[8px] border border-border">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="sticky top-0 bg-surface-muted">
                    <tr className="text-xs uppercase tracking-wide text-foreground-subtle">
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Phone</th>
                      <th className="px-4 py-2 font-medium">Segment</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.rows.map((row) => (
                      <tr key={row.rowIndex} className="border-t border-border">
                        <td className="px-4 py-2 text-foreground">{row.name}</td>
                        <td className="px-4 py-2 tabular-nums text-foreground-muted">{row.phone || "—"}</td>
                        <td className="px-4 py-2 text-foreground-muted">{row.segment ?? "—"}</td>
                        <td className="px-4 py-2">
                          <Badge tone={VALIDATION_TONE[row.validation]}>
                            {VALIDATION_LABEL[row.validation]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setParseResult(null)}>
                  Discard
                </Button>
                <Button onClick={handleConfirmImport} disabled={importing || parseResult.counts.valid === 0}>
                  {importing
                    ? "Importing..."
                    : `Confirm import (${parseResult.counts.valid} valid row${
                        parseResult.counts.valid === 1 ? "" : "s"
                      })`}
                </Button>
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Participants"
          description={`${participantRows.length} contact${participantRows.length === 1 ? "" : "s"} in this campaign.`}
        />
        <CardBody className="p-0">
          {participantRows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No contacts uploaded yet"
                description="Use the uploader above to bring in your first batch of contacts."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-subtle">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Phone</th>
                    <th className="px-5 py-3 font-medium">Segment</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {participantRows.map((row) => (
                    <tr key={row.participantId} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 font-medium text-foreground">{row.contact.name}</td>
                      <td className="px-5 py-3 tabular-nums text-foreground-muted">{row.contact.phone}</td>
                      <td className="px-5 py-3 text-foreground-muted">{row.segment ?? "—"}</td>
                      <td className="px-5 py-3">
                        <ParticipationStatusBadge status={row.participationStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
