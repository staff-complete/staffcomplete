#!/usr/bin/env bash
# Kills leftover dev-server processes from a previous `pnpm dev` that didn't
# shut down cleanly (e.g. a closed terminal, a killed devcontainer shell) —
# without this, a fresh `pnpm dev` fails with EADDRINUSE or tsx's "Previous
# process hasn't exited yet. Force killing..." noise instead of starting.
# Matched by command line, not by port: `ss`/`netstat` can't see listening
# sockets from inside this sandbox even when the servers are actually up.
set -euo pipefail

PATTERNS=(
  "turbo/bin/turbo dev"
  "vite/bin/vite.js"
  "tsx watch src/index.ts"
)

for pattern in "${PATTERNS[@]}"; do
  pkill -f "$pattern" 2>/dev/null || true
done
