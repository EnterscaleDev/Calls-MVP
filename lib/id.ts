let counter = 0;

/** Local-only synthetic id (e.g. an unsaved call-script section's React key) — never sent to the database. */
export function makeId(prefix: string): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}${counter.toString(36)}`;
}
