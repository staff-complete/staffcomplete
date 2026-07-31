#!/bin/bash
# Deny `git commit` while on main. CLAUDE.md: "Never commit directly to main."
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd')
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Check the command here rather than trusting the `if: Bash(git commit *)`
# clause in settings.json to gate this hook — if that clause ever stops
# matching, an unguarded script denies *every* Bash call while on main.
# Matched per `;`/`&&`/`||`/pipe segment so `git` and `commit` have to belong
# to the same command; that also covers `git -C <dir> commit`. Over-inclusive
# by design: something like `git log --grep commit` is denied too, which is
# the harmless direction to be wrong in.
if ! echo "$CMD" | grep -Eq '(^|[;&|])[^;&|]*\bgit\b[^;&|]*\bcommit\b'; then
  exit 0
fi

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
