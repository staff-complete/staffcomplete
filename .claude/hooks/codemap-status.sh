#!/bin/bash
# Compares the working tree against docs/codemap/codemap.lock and reports which
# modules have drifted. Informational only — always exits 0, never blocks a tool
# call. Used by the SessionStart hook and by the `codemap` skill.
#
# Reproduces the lock's fingerprint algorithm exactly:
#   sha256 over sorted "<path>\0<git blob sha1>\n" records per module.
# The generator spawns one `git hash-object` per file; this uses
# `--stdin-paths` to hash every file in one process (~0.06s for the whole repo),
# which is what makes it cheap enough to run on every session start.

set -uo pipefail

CWD="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$CWD" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

LOCK="docs/codemap/codemap.lock"
EXCLUDE='(^|/)(node_modules|dist|build|coverage|\.turbo)/'

if [ ! -f "$LOCK" ]; then
  if [ -d "docs/codemap" ]; then
    echo "Code map: docs/codemap/ exists but codemap.lock is missing — the map cannot be trusted. Regenerate all three files (codemap skill) before changing code."
  fi
  exit 0
fi

command -v jq >/dev/null 2>&1 || exit 0

fingerprint() {
  local mod="$1" paths hashes
  paths=$(git ls-files "$mod" 2>/dev/null | grep -vE "$EXCLUDE" | sort)
  [ -z "$paths" ] && return 1
  hashes=$(printf '%s\n' "$paths" | git hash-object --stdin-paths 2>/dev/null) || return 1
  paste <(printf '%s\n' "$paths") <(printf '%s\n' "$hashes") \
    | awk -F'\t' '{printf "%s%c%s\n", $1, 0, $2}' \
    | sha256sum | cut -d' ' -f1
}

LOCK_COMMIT=$(jq -r '.commit // ""' "$LOCK" 2>/dev/null) || exit 0
HEAD_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")

stale=()
while IFS=$'\t' read -r mod expected; do
  [ -z "$mod" ] && continue
  actual=$(fingerprint "$mod") || { stale+=("$mod (unreadable)"); continue; }
  [ "sha256:$actual" != "$expected" ] && stale+=("$mod")
done < <(jq -r '.modules[] | [.path, .fingerprint] | @tsv' "$LOCK" 2>/dev/null)

if [ ${#stale[@]} -eq 0 ]; then
  if [ -n "$HEAD_COMMIT" ] && [ "$LOCK_COMMIT" != "$HEAD_COMMIT" ]; then
    echo "Code map: content-current (all module fingerprints match) but generated from a different commit (${LOCK_COMMIT:0:7} vs HEAD ${HEAD_COMMIT:0:7}). Safe to rely on; refresh the map's commit field next time you regenerate."
  else
    echo "Code map: current as of ${LOCK_COMMIT:0:7}. Before modifying a module, use docs/codemap/codemap.json to answer: what calls it, what it affects, which tests cover it."
  fi
  exit 0
fi

echo "Code map: STALE — drifted since ${LOCK_COMMIT:0:7}: ${stale[*]}."
echo "docs/codemap/codemap.json may misstate callers, dependencies, or test coverage for those modules. If your task touches them, regenerate codemap.html + codemap.json + codemap.lock together (codemap skill) before changing code."
exit 0
