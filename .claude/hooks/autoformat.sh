#!/bin/bash
# Run oxfmt on whatever file Claude just edited, so formatting is never a
# pre-commit-hook surprise. Best-effort: never blocks (PostToolUse can't
# block anyway - the edit already happened).
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[ -z "$FILE_PATH" ] && exit 0
[ -f "$FILE_PATH" ] || exit 0

REPO_ROOT=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null || echo "$CWD")
OXFMT="$REPO_ROOT/node_modules/.bin/oxfmt"

if [ -x "$OXFMT" ]; then
  "$OXFMT" "$FILE_PATH" >/dev/null 2>&1
else
  npx oxfmt "$FILE_PATH" >/dev/null 2>&1
fi

exit 0
