#!/bin/bash
# ADRs are immutable (CLAUDE.md). Deny overwriting an existing ADR outright.
# Edits are only "ask" rather than "deny" because the one legitimate edit —
# flipping an old ADR's Status line to "superseded by ADR-XXXX" — also goes
# through the Edit tool (new-adr skill).
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if ! echo "$FILE_PATH" | grep -qE 'docs/decisions/[0-9]{4}-.*\.md$'; then
  exit 0
fi

# A brand-new ADR being created isn't tracked yet - nothing to protect.
if ! git -C "$CWD" ls-files --error-unmatch "$FILE_PATH" >/dev/null 2>&1; then
  exit 0
fi

if [ "$TOOL_NAME" = "Write" ]; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "ADRs are immutable (CLAUDE.md) — never overwrite an existing ADR. Create a new ADR that supersedes it instead (new-adr skill)."
    }
  }'
  exit 0
fi

jq -n '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "ask",
    permissionDecisionReason: "This ADR is already committed and ADRs are immutable (CLAUDE.md). The only legitimate edit is flipping its Status line to \"superseded by ADR-XXXX\" when a new ADR replaces it - confirm that is what this is."
  }
}'

exit 0
