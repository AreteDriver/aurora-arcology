// EVE timeline normalization. YC0 ≈ AD 1898, so YC128 ≈ 2026.
// Used for sorting Timeline view entries that mix ISO and YC notation.

const YC_OFFSET = 1898;

/**
 * Normalize a node's free-form date string into a sortable ISO-ish key.
 *
 *   "2026-04-30"   → "2026-04-30"
 *   "YC128.04.30"  → "2026-04-30"
 *   "YC128"        → "2026-00-00"
 *   "YC110-04-15"  → "2008-04-15"
 *   "2024"         → "2024-00-00"
 *   undefined      → ""    (sorts to top; pair with hasDate filter)
 */
export function normalizeDate(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.trim();

  // YC notation: YC<num>[<sep><month>[<sep><day>]] where sep can be . or -
  const ycMatch = /^YC\s*(\d{1,3})(?:[.\-](\d{1,2}))?(?:[.\-](\d{1,2}))?/i.exec(s);
  if (ycMatch) {
    const yc = parseInt(ycMatch[1], 10);
    const year = yc + YC_OFFSET;
    const mm = (ycMatch[2] ?? "00").padStart(2, "0");
    const dd = (ycMatch[3] ?? "00").padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }

  // ISO YYYY-MM-DD or partial
  const isoMatch = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(s);
  if (isoMatch) {
    const yyyy = isoMatch[1];
    const mm = (isoMatch[2] ?? "00").padStart(2, "0");
    const dd = (isoMatch[3] ?? "00").padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Imprecise era markers (~YC110, "YC110-era", etc.) — best-effort
  const fuzzy = /YC\s*(\d{1,3})/i.exec(s);
  if (fuzzy) {
    const year = parseInt(fuzzy[1], 10) + YC_OFFSET;
    return `${year}-00-00`;
  }

  return s; // unparseable — fall back to lexical sort
}

/** Pretty-print a date for display. Preserves original notation. */
export function displayDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  return raw;
}
