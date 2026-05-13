#!/usr/bin/env bash
# refresh-market.sh — one-shot refresh of data/market/snapshot.json
#
# Runs the loader against the configured source dir; if the snapshot
# changed, commits + pushes. Idempotent — no-op when nothing moved.
#
# Configure with MARKET_DATA_DIR if your cron output isn't at the
# convenience default (~/projects/notes/data/raw/eve).
#
# Cron entry (refresh shortly after the daily 05:30 alerter):
#   35 5 * * * cd ~/projects/aurora-arcology && /usr/bin/env bash scripts/refresh-market.sh >> /tmp/aurora-market-refresh.log 2>&1
#
# Exit codes: 0 always when the script ran cleanly (whether or not it
# committed). Non-zero only if the loader itself failed.

set -euo pipefail

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

SNAPSHOT_PATH="data/market/snapshot.json"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[refresh-market] pnpm not found on PATH; aborting" >&2
  exit 1
fi

pnpm market:load

if git diff --quiet -- "$SNAPSHOT_PATH"; then
  echo "[refresh-market] snapshot unchanged — nothing to commit"
  exit 0
fi

# Snapshot moved. Verify build still passes before committing.
echo "[refresh-market] snapshot changed; running typecheck"
pnpm typecheck

SNAPSHOT_DATE="$(grep -m1 '"snapshot_date"' "$SNAPSHOT_PATH" | sed -E 's/.*"([0-9-]+)".*/\1/')"

git add "$SNAPSHOT_PATH"
git commit -m "data(market): refresh snapshot to ${SNAPSHOT_DATE}

Automated refresh via scripts/refresh-market.sh.
Source: ${MARKET_DATA_DIR:-~/projects/notes/data/raw/eve}"

git push origin HEAD
echo "[refresh-market] pushed snapshot for ${SNAPSHOT_DATE}"
