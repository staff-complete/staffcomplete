#!/bin/bash
# Deny two specific things CLAUDE.md calls out as never-do:
#   - force-pushing main
#   - modifying/disabling the branch protection ruleset via gh api
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

if echo "$COMMAND" | grep -Eq 'git[[:space:]]+push' \
  && echo "$COMMAND" | grep -Eq -- '(--force([[:space:]]|$)|--force-with-lease|[[:space:]]-f([[:space:]]|$))' \
  && echo "$COMMAND" | grep -Eq '\bmain\b'; then
  deny "Force-pushing main is not allowed (CLAUDE.md Git workflow) — main only takes fast-forward pushes from an open PR. Fix the underlying issue instead of forcing past it."
fi

if echo "$COMMAND" | grep -Eq 'gh[[:space:]]+api' \
  && echo "$COMMAND" | grep -Eiq 'rulesets?' \
  && echo "$COMMAND" | grep -Eq -- '-X[[:space:]]*(DELETE|PATCH|PUT)'; then
  deny "Disabling or modifying the branch protection ruleset is not allowed (CLAUDE.md: never disable rulesets to work around a rejected push). Fix the process, not the protection."
fi

exit 0
