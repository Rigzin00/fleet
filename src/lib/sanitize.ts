// Everything typed by a person (or read from the URL) passes through here before it reaches a query.
//
// The app never builds SQL: all reads go through PostgREST, which sends values as bound parameters, and
// writes go through RPCs with typed arguments. What *can* still go wrong is the meaning of characters
// inside a value: `%` and `_` are wildcards in LIKE/ILIKE, and `*` is PostgREST's own wildcard.
// So user search text is escaped here, length-capped, and stripped of control characters.

export const MAX_QUERY_LENGTH = 64

/** Trim, collapse whitespace, drop control characters and PostgREST's `*`, cap the length, lower-case. */
export function normalizeQuery(input: string, max = MAX_QUERY_LENGTH): string {
  return input
    .replace(/[\u0000-\u001f\u007f*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim()
    .toLowerCase()
}

/** Make `%`, `_` and `\` match themselves in a LIKE pattern (backslash is Postgres' default escape). */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** PostgREST `ilike` pattern for a "contains" search, or null when there is nothing to search for. */
export function containsPattern(input: string): string | null {
  const q = normalizeQuery(input)
  return q ? `*${escapeLike(q)}*` : null
}

/** A positive integer id from untrusted text (e.g. the URL hash), or null. */
export function parseId(raw: string | undefined | null): number | null {
  if (!raw || !/^\d{1,12}$/.test(raw)) return null
  const n = Number(raw)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}
