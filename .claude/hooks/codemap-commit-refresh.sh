#!/bin/bash
# Keeps the code map in the same commit — and therefore the same PR — as the
# change it describes (CLAUDE.md, "Code map").
#
# Runs before `git commit`. Refreshes the derived parts of docs/codemap/ and
# stages them so they ride along in the commit being made. When the graph
# itself no longer fits the tree (a new module, a moved boundary, an edge that
# vanished), it does NOT rewrite anything — that needs judgment — and asks for
# confirmation instead, so a wrong map cannot merge silently.

set -uo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
[ -z "$CWD" ] && CWD="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$CWD" 2>/dev/null || exit 0

[ -f docs/codemap/codemap.lock ] || exit 0
command -v node >/dev/null 2>&1 || exit 0

OUTPUT=$(CLAUDE_PROJECT_DIR="$CWD" node .claude/hooks/codemap-refresh.mjs 2>&1)
STATUS=$?

if [ $STATUS -ne 0 ]; then
  exit 0 # never block a commit because the refresher itself failed
fi

# Graph no longer matches the tree — a script must not guess at nodes/edges.
if echo "$OUTPUT" | grep -q "NEEDS RE-AUTHORING"; then
  REASON=$(printf '%s' "$OUTPUT" | head -c 1200)
  jq -n --arg r "$REASON" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: ("The code map cannot be auto-updated for this commit — the graph itself changed, which needs re-authoring (codemap skill), not a mechanical refresh.\n\n" + $r + "\n\nCommitting now ships a map that misstates callers, dependencies or test coverage. Regenerate first, or confirm to commit without it.")
    }
  }'
  exit 0
fi

# Mechanically refreshed (or already current) — stage it into this commit.
if ! git diff --quiet -- docs/codemap/ 2>/dev/null; then
  git add docs/codemap/ 2>/dev/null
  echo "Code map auto-updated and staged into this commit: $(echo "$OUTPUT" | head -1)"
fi

exit 0
