-- Data-only migration: no schema change, so this is hand-written rather than
-- produced by drizzle-kit generate (which diffs schema.ts and would emit
-- nothing here). The 0014 snapshot is 0013's, re-chained, for the same reason.
--
-- TRIAL_LENGTH_DAYS went from 14 to 30, but `trialEndsAt` is a stored column,
-- not a computed one — so the new constant only applies to organizations that
-- start a trial from here on. These two statements re-derive it from
-- `trialStartedAt` so trials created under the old constant land on the same
-- 30-day window new ones get.
--
-- Runs as the migration role (DATABASE_URL), not staffcomplete_tenant, and the
-- subscription policy from 0005 is scoped `TO "staffcomplete_tenant"` under
-- ENABLE (not FORCE) row level security — so these UPDATEs see every row
-- rather than being silently filtered to zero by RLS.

-- Still-running trials: extend in place. `trialReminderSentAt` is cleared
-- because these orgs may already have had the 3-day warning fired against
-- their old end date; without the reset they'd expire a second time with no
-- notice. The scan only re-sends inside its 3-day window, so a row with weeks
-- left just won't qualify yet.
UPDATE "subscription"
SET "trialEndsAt" = "trialStartedAt" + interval '30 days',
	"trialReminderSentAt" = NULL,
	"updatedAt" = now()
WHERE "status" = 'trialing';--> statement-breakpoint

-- Trials the daily scan already flipped to 'expired' under the 14-day rule but
-- which are still inside the 30-day one — an org that started 20 days ago is
-- locked out today yet should have 10 days left. The `> now()` guard is what
-- keeps this a correction rather than an amnesty: a genuinely finished trial
-- (started more than 30 days ago) stays expired. 'active' and 'canceled' are
-- untouched — per ADR-0015 their trialEndsAt is history, and rewriting it
-- would put a paying organization back on a trial clock.
UPDATE "subscription"
SET "status" = 'trialing',
	"trialEndsAt" = "trialStartedAt" + interval '30 days',
	"trialReminderSentAt" = NULL,
	"updatedAt" = now()
WHERE "status" = 'expired'
	AND "trialStartedAt" + interval '30 days' > now();
