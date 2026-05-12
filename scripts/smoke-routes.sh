#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-${BASE_URL:-http://localhost:3000}}"

ROUTES=(
  "/"
  "/boards/warpath_yc128"
  "/boards/warpath_yc128/timeline"
  "/boards/warpath_yc128/matrix"
  "/boards/warpath_yc128/arcs"
  "/analytics"
  "/sourcebook"
  "/curators"
  "/curators/ARETE"
  "/sources"
  "/sources/src_ash_warpath_news"
  "/suggestions"
  "/lens/warpath-current/synthesis"
  "/audit"
)

failures=0
tmp_file="$(mktemp)"

for route in "${ROUTES[@]}"; do
  status="$(curl -sS -o "$tmp_file" -w "%{http_code}" "${BASE_URL}${route}")"
  bytes="$(wc -c < "$tmp_file" | tr -d ' ')"
  echo "${status} ${bytes} ${route}"
  if [[ ! "$status" =~ ^2 ]]; then
    failures=$((failures + 1))
  fi
done

rm -f "$tmp_file"

if [[ "$failures" -gt 0 ]]; then
  echo "Smoke test failed with ${failures} non-2xx responses." >&2
  exit 1
fi

echo "Smoke test passed for ${#ROUTES[@]} routes."
