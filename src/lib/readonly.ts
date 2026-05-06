/**
 * Read-only mode marker. Set AURORA_READONLY=1 in deployments where the
 * SQLite file lives on an immutable filesystem (Vercel, Cloudflare Pages,
 * static hosting). Write-mode routes return 405; UI hides accept/reject
 * buttons.
 */

export const isReadOnly = (): boolean =>
  process.env.AURORA_READONLY === "1" || process.env.AURORA_READONLY === "true";

/** Client-safe — set via NEXT_PUBLIC_AURORA_READONLY in the build env. */
export const isReadOnlyClient = (): boolean =>
  process.env.NEXT_PUBLIC_AURORA_READONLY === "1" ||
  process.env.NEXT_PUBLIC_AURORA_READONLY === "true";
