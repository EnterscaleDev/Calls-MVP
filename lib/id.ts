let counter = 0;

/** Deterministic-ish, non-sequential-looking id for mock records. Not for real security use. */
export function makeId(prefix: string): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}${counter.toString(36)}`;
}

/** A longer, non-guessable token for participant invitation links (mock only — not cryptographically reviewed). */
export function makeSecureToken(): string {
  const bytes = Array.from({ length: 24 }, () =>
    Math.floor(Math.random() * 36).toString(36)
  );
  return bytes.join("");
}
