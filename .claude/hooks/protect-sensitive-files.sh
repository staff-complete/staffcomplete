#!/bin/bash
# Block edits to files that hold secrets or are tool-managed.
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# .env.example documents required vars with placeholder values - always fine.
case "$FILE_PATH" in
  *.env.example) exit 0 ;;
esac

PROTECTED_PATTERNS=(".env" "pnpm-lock.yaml" "/.git/")

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    REASON="Blocked: $FILE_PATH matches protected pattern '$pattern'. Env files hold secrets, and lockfiles/.git are tool-managed - use .env.example for new vars, or run pnpm install for lockfile changes."
    jq -n --arg reason "$REASON" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: $reason
      }
    }'
    exit 0
  fi
done

exit 0
