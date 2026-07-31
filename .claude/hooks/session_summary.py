#!/usr/bin/env python3
"""SessionEnd hook — captures decisions worth a permanent record before the session closes."""
# SessionEnd only supports "command" hooks (no "agent"/"prompt" type), so real
# judgment — read the transcript, check what's already documented, decide
# whether anything clears the bar — happens in a headless `claude -p` call
# this script spawns and detaches (the parent may exit before it finishes).
#
# The headless call writes a *review note*, never a permanent artifact.
# It cannot create an ADR directly, on purpose:
#   - ADRs are immutable here (CLAUDE.md). A bad one can't be edited away,
#     only superseded, so an unattended wrong guess is expensive to undo.
#   - guard-adr-immutability.sh returns "ask" on ADR edits, which nothing can
#     answer in a headless session.
#   - The new-adr skill owns the real flow (numbering, README index row,
#     superseding an older ADR).
# So it drops a note under .claude/session-notes/ — untracked, so it shows up
# in `git status` for the next session to act on or delete.
#
# A cheap local pre-filter (transcript size/line count) skips trivial sessions
# before paying for the headless call at all.
import json
import os
import subprocess  # nosec B404 - fixed argv below, never shell=True
import sys
from datetime import datetime, timezone

PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
LOG_DIR = os.path.join(PROJECT_DIR, ".claude", "logs")
LOG_FILE = os.path.join(LOG_DIR, "session-summary.log")
NOTES_DIR = os.path.join(PROJECT_DIR, ".claude", "session-notes")

# The headless `claude -p` below is itself a session, so its own SessionEnd
# fires this hook again — with a different session_id, so the marker file
# won't stop it, and a transcript that can easily clear the size filter after
# grepping a large log. Without this guard that recursion is unbounded.
CHILD_ENV_FLAG = "CLAUDE_SESSION_SUMMARY_CHILD"

# Below either threshold, treat the session as too small to plausibly contain
# a decision worth recording — skip without spawning anything.
MIN_TRANSCRIPT_BYTES = 20_000
MIN_TRANSCRIPT_LINES = 40

PERMISSION_SETTINGS = {
    "permissions": {
        "allow": [
            "Read",
            "Grep",
            "Glob",
            "Write(.claude/session-notes/**)",
            "Edit(.claude/session-notes/**)",
        ],
        "deny": ["Bash"],
        "defaultMode": "dontAsk",
    }
}

PROMPT = """You are running as an unattended SessionEnd hook for the \
staffcomplete repo, after a Claude Code session just ended. Your only input \
is the transcript below — there is no user to ask questions of, so when in \
doubt, do nothing rather than guess.

Transcript file: {transcript_path}
(It may be large — grep it for signal first: decisions, trade-offs, "ADR", \
"instead of", "rejected", "deferred", "later", "gotcha", rather than reading \
it start to end. Read only the surrounding context of what you find.)

Your job: decide whether anything in this session is worth a permanent, \
durable record that does not already exist, and if so write a single short \
review note. You do NOT create ADRs, issues, or edit any project docs — a \
human picks the note up next session and runs the proper flow (the new-adr \
skill, `gh issue create`). Writing anything outside \
.claude/session-notes/ is not permitted.

Bar for "worth recording" (be conservative — most sessions produce nothing, \
and that is the expected, correct outcome):
- A non-trivial technical or architectural decision that was actually made \
(not merely discussed) and has a rationale someone would later need to \
understand *why*, not just *what*.
- A concrete follow-up that isn't already a GitHub issue and is substantial \
enough to be worth not forgetting.
- A durable project fact, gotcha, or workflow rule a future session would \
benefit from and that isn't already written down.
- Explicitly NOT: routine implementation work already evident from the diff \
or commit messages, anything already covered by CLAUDE.md, an existing ADR \
under docs/decisions/, or an existing GitHub issue.

Before writing, check the ground isn't already covered: grep \
docs/decisions/ (including README.md's index table), CLAUDE.md, and \
docs/*.md. If it is — even partially — skip rather than write a \
near-duplicate.

If something clears the bar, write ONE file: \
.claude/session-notes/{date}-{session_id}.md, containing only:

# Session notes — {date}

## <short title>
**What:** one or two sentences on the decision/fact/follow-up.
**Why it matters:** the rationale a future reader would need.
**Suggested home:** one of — new ADR (run the new-adr skill) / GitHub issue \
/ CLAUDE.md / nothing, just context.

Repeat the `## <short title>` block per item. At most three items; if you \
have more, keep the three most valuable.

Repo conventions worth knowing while judging:
- ADRs live in docs/decisions/NNNN-slug.md (four digits), are immutable, and \
are indexed in docs/decisions/README.md. Superseding is how they change.
- Work is tracked as GitHub issues only — there is no roadmap or backlog file.

If nothing clears the bar, write no file at all.

End your response with exactly one line starting with "RESULT:" summarizing \
what you did or why you did nothing, e.g. \
"RESULT: wrote .claude/session-notes/2026-07-31-abc123.md (1 item)" or \
"RESULT: nothing significant this session".
"""


def log(line: str) -> None:
    os.makedirs(LOG_DIR, exist_ok=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def transcript_clears_bar(path: str) -> bool:
    try:
        if os.path.getsize(path) < MIN_TRANSCRIPT_BYTES:
            return False
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            for i, _ in enumerate(f):
                if i + 1 >= MIN_TRANSCRIPT_LINES:
                    return True
        return False
    except OSError:
        return False


def main() -> int:
    # Spawned by an outer run of this same hook — stop here (see CHILD_ENV_FLAG).
    if os.environ.get(CHILD_ENV_FLAG):
        return 0

    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0

    session_id = data.get("session_id") or "unknown"
    transcript_path = data.get("transcript_path") or ""

    if not transcript_path or not os.path.isfile(transcript_path):
        return 0

    os.makedirs(LOG_DIR, exist_ok=True)
    marker = os.path.join(LOG_DIR, f".summarized-{session_id}")
    if os.path.exists(marker):
        return 0

    if not transcript_clears_bar(transcript_path):
        return 0

    open(marker, "w", encoding="utf-8").close()
    os.makedirs(NOTES_DIR, exist_ok=True)

    prompt = PROMPT.format(
        transcript_path=transcript_path,
        session_id=session_id,
        date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    )
    cmd = [
        "claude",
        "-p",
        prompt,
        "--settings",
        json.dumps(PERMISSION_SETTINGS),
        "--model",
        "sonnet",
    ]

    child_env = {**os.environ, CHILD_ENV_FLAG: "1"}

    try:
        # Left open deliberately: the child inherits it and keeps writing after
        # this process exits, so it must not be closed here.
        log_fh = open(LOG_FILE, "a", encoding="utf-8")  # noqa: SIM115
        log_fh.write(
            f"\n=== {datetime.now(timezone.utc).isoformat()} session={session_id} ===\n"
        )
        log_fh.flush()
        # `cmd` is a fixed argv list built above — never a shell string, and
        # the only interpolated values are a transcript path and session id
        # handed to us by Claude Code itself, not anything user-supplied.
        # nosec B603 (bandit) / nosemgrep (dangerous-subprocess-use-audit):
        # both flag Popen on a non-literal argv regardless of shell=False.
        subprocess.Popen(  # nosec B603  # nosemgrep
            cmd,
            cwd=PROJECT_DIR,
            env=child_env,
            stdout=log_fh,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
        )
    except OSError as e:
        log(f"session_summary.py: failed to spawn claude -p: {e}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
