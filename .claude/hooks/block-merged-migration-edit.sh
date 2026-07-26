#!/bin/bash
# Deny editing a migration .sql file that's already merged into origin/main.
# Per the new-migration skill: a migration only living on an open branch is
# fair game to fix in place; one already merged (and possibly deployed)
# must be superseded by a new migration instead.
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

case "$FILE_PATH" in
  *apps/api/src/db/migrations/*.sql) ;;
  *) exit 0 ;;
esac

REPO_ROOT=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null)
[ -z "$REPO_ROOT" ] && exit 0

REL_PATH=${FILE_PATH#"$REPO_ROOT"/}

if git -C "$CWD" cat-file -e "origin/main:$REL_PATH" 2>/dev/null; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "This migration is already merged into main (and possibly deployed) — editing it in place can break the Kamal pre-deploy migration step. Generate a new migration instead of modifying this one (new-migration skill)."
    }
  }'
fi

exit 0
