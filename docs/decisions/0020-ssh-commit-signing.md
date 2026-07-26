# ADR-0020: SSH Commit Signing (not GPG)

- **Status:** accepted
- **Date:** 2026-07-26

## Context

ADR-0009 required GPG signing for all commits. That was never actually adopted: every commit in this repository is signed via SSH (`git config gpg.format ssh` + `commit.gpgsign true`, with `user.signingkey` pointing at an SSH public key), and CLAUDE.md, the `start-issue`/`new-feature`/`release-check` skills, and the `.claude/hooks/` commit guards have all documented SSH signing since before this ADR existed. ADR-0009's text is the one place still describing GPG, and a new contributor following it literally would set up the wrong thing.

## Decision

Commits are signed with SSH, not GPG:

```sh
git config --global gpg.format ssh
git config --global commit.gpgsign true
git config --global user.signingkey ~/.ssh/id_rsa.pub  # or equivalent SSH key
```

Contributors reuse the SSH key they already have for GitHub authentication — no separate GPG key to generate, distribute, or manage. GitHub verifies commits against each contributor's SSH signing key uploaded to their account.

**Alternative considered:** keep GPG, per ADR-0009's original text. Rejected — it doesn't match reality (the repo's entire commit history is already SSH-signed), and SSH signing avoids a second class of key material for every contributor to manage on top of the SSH key they already need for `git push`.

## Consequences

- ADR-0009 is **partially superseded** by this ADR for its commit-signing line only — its CI/CD, linting, and branch-protection content is unaffected and remains accurate.
- New contributors set up SSH signing, not GPG, when onboarding to the repo.
- Branch protection on `main` verifies SSH signatures; a GPG-signed commit would not satisfy the "signed commits required" rule as currently configured.
