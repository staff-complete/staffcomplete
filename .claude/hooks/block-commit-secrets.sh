#!/bin/bash
# Deny `git commit` if staged changes contain something that looks like a
# credential. Mirrors the patterns the security-check skill already knows,
# but makes the check unavoidable instead of opt-in.
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd')

PATTERN='sk_(live|test)_[A-Za-z0-9]{10,}|gh[ps]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]+|AIza[A-Za-z0-9_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'

MATCH=$(git -C "$CWD" diff --cached -- . ':(exclude)pnpm-lock.yaml' 2>/dev/null \
  | grep -E '^\+' | grep -Ev '^\+\+\+' | grep -E "$PATTERN")

if [ -n "$MATCH" ]; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Staged changes contain something matching a known credential pattern (API key, token, or private key). Remove it before committing — see the security-check skill."
    }
  }'
fi

exit 0
