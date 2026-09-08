import Papa from "papaparse";
import type { ParsedContactRow, RowValidationStatus } from "./types";

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}

function isValidPhone(raw: string): boolean {
  const normalized = normalizePhone(raw);
  return /^\+?\d{7,15}$/.test(normalized);
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const key of Object.keys(row)) {
    if (keys.includes(key.trim().toLowerCase())) {
      return (row[key] ?? "").trim();
    }
  }
  return "";
}

export interface ParseResult {
  rows: ParsedContactRow[];
  totalRows: number;
  counts: Record<RowValidationStatus, number>;
}

/**
 * Parses + validates a contact CSV. `existingPhones` should contain
 * normalized phone numbers already present in this campaign, so a re-upload
 * correctly flags repeats as duplicates rather than silently re-importing.
 */
export function parseContactsCsv(fileText: string, existingPhones: Set<string>): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(fileText, {
    header: true,
    skipEmptyLines: true,
  });

  const seenInFile = new Set<string>();
  const rows: ParsedContactRow[] = parsed.data.map((raw, idx) => {
    const name = pick(raw, ["name", "full name", "contact name"]);
    const phoneRaw = pick(raw, ["phone", "phone number", "mobile", "telephone"]);
    const email = pick(raw, ["email", "email address"]) || undefined;
    const externalCustomerId =
      pick(raw, ["customer id", "external_customer_id", "customer_id"]) || undefined;
    const segment = pick(raw, ["segment"]) || undefined;

    const normalizedPhone = normalizePhone(phoneRaw);
    let validation: RowValidationStatus;
    if (!phoneRaw) {
      validation = "missing_phone";
    } else if (!isValidPhone(phoneRaw)) {
      validation = "invalid_phone";
    } else if (seenInFile.has(normalizedPhone) || existingPhones.has(normalizedPhone)) {
      validation = "duplicate";
    } else {
      validation = "valid";
    }
    if (validation === "valid") seenInFile.add(normalizedPhone);

    return {
      rowIndex: idx,
      name: name || "(no name provided)",
      phone: phoneRaw,
      email,
      externalCustomerId,
      segment,
      validation,
    };
  });

  const counts: Record<RowValidationStatus, number> = {
    valid: 0,
    invalid_phone: 0,
    missing_phone: 0,
    duplicate: 0,
  };
  rows.forEach((r) => {
    counts[r.validation] += 1;
  });

  return { rows, totalRows: rows.length, counts };
}

export const EXAMPLE_CSV_FIELDS = ["Name", "Phone", "Email (optional)", "Customer ID (optional)", "Segment (optional)"];

export const EXAMPLE_CSV = `Name,Phone,Email,Customer ID,Segment\nJane Doe,+14155550100,jane.doe@example.com,CUST-1001,recent-discharge\nJohn Smith,+14155550188,,CUST-1002,follow-up-cohort\n`;

export { normalizePhone };
