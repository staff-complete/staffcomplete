#!/bin/bash
# Deny `git commit` while on main. CLAUDE.md: "Never commit directly to main."
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd')

BRANCH=$(git -C "$CWD" rev-parse --abbrev-ref HEAD 2>/dev/null)

if [ "$BRANCH" = "main" ]; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Committing directly to main is not allowed (CLAUDE.md Git workflow). Create a feature/fix/chore branch first."
    }
  }'
fi

exit 0
