# ADR-0023: Strip the Platform to an Early-Access Landing Page Until the First Customer

- **Status:** accepted
- **Date:** 2026-09-10

## Context

The employee-lifecycle platform was built and running: a Hono/tRPC API,
Better Auth, Drizzle over Postgres with row-level security, a pg-boss queue
with four job handlers, billing and trials, and a Vue application shell —
about 150 source files and 15 migrations, deployed by Kamal to a Hetzner VPS
with a Postgres accessory.

It had **zero customers**. Not few — zero. The domain's Cloudflare analytics
showed 0 unique visitors, ADR-0022 already noted "no production traffic whose
failures need historical querying", and the subscription work (issues #44–#47)
was still open, so nothing could have been bought even if someone had wanted
to.

That combination costs on both sides. The VPS and its Postgres volume cost
money every month. More expensively, every ADR, skill, migration checklist and
tenancy rule in this repository is context that has to be carried, honoured,
and kept true on every change — for machinery no one uses. Meanwhile the
question that actually decides this product's future, _does anyone want it_,
had nothing collecting an answer.

The repository already contained a complete marketing landing page. The work
was therefore not "build a landing page" but "remove everything else".

Three pieces of that page also had to go regardless of this decision, because
they were false: testimonials attributed to three named people at three named
companies, a stats bar claiming 98%, and "Trusted by 200+ HR teams in early
access". With zero customers these are fabrications, not optimism.

## Decision

Reduce the repository to a **one-page early-access site** and archive the
platform.

- The complete system is preserved at the **`v0-full-app`** tag and the
  **`archive/full-app`** branch, both pushed. This is the whole basis for
  treating the decision as reversible.
- The API, database, migrations, queue, auth, billing and application shell
  are removed from `main`. `packages/shared` shrinks to one Zod schema.
- **Hosting moves from Kamal on Hetzner to Cloudflare Pages** on the free
  tier, deployed by Cloudflare's GitHub integration on push to `main`.
- The only backend is one **Cloudflare Pages Function**, `POST
/api/early-access`, which validates a request and sends it through Resend
  (ADR-0011, unchanged) as an email. **There is no signup store: the
  notification inbox is the record.**

**Alternatives considered:**

- _Leave the platform running and add a form to it._ Rejected: it preserves
  every cost this decision exists to remove, and the running system was the
  thing with no users.
- _Stop the Hetzner server but keep the code on `main`._ Rejected: it saves
  the money but not the attention. CLAUDE.md, the code map, the skills and
  the ADRs would keep describing a system that is not running, which is the
  failure mode ADR-0022 was written to correct.
- _Store requests in Cloudflare KV or D1._ Rejected: both are free, but both
  are a datastore to model, back up and read, for a list that fits in an
  inbox. Reconsider at the volume where reading email stops working.
- _A third-party form service (Tally, Formspree)._ Rejected: an external
  dependency and someone else's branding to avoid writing ~100 lines.
- _Cloudflare Workers static assets rather than Pages._ Rejected for now:
  Pages Functions' file-based routing is what the code is written against.
  Pages is the older of Cloudflare's two products and this may need
  revisiting, but the migration is one small file.

**Revisit trigger:** the first customer, or the first early-access request
from someone we actually want to build for. Either one reopens the archive.

## Consequences

- **Restoring the platform is not one command.** The code comes back with a
  cherry-pick, but the environment does not: a server, Postgres, the
  RLS-scoped role, secrets and the Kamal pipeline all have to be stood up
  again. Reversible, but on the order of a week, not an afternoon.
- **A signup lives in exactly one place.** If a notification email fails to
  send or is deleted, the lead is gone — there is no row to recover. Resend's
  free tier also caps at 100 emails a day, which is therefore the site's
  signup ceiling.
- **Nothing rate-limits the form.** A honeypot drops naive bots; a determined
  one can still exhaust that daily cap and bury real requests underneath it.
  Cloudflare's Bot Fight Mode or Turnstile (the server half is built, off
  unless `TURNSTILE_SECRET_KEY` is set) are the answer if that happens.
- **Most earlier ADRs now describe machinery this repository does not
  contain.** 0003–0007, 0012, 0014–0019 and 0022 are dormant rather than
  wrong: nothing was decided against them, their subject matter simply left
  with the archive, and they bind again on restore. 0008 is genuinely
  replaced. 0001, 0009, 0011, 0013, 0020 and 0021 are untouched and still in
  force.
- Running cost drops to zero and the deploy pipeline loses its ssh keys, its
  registry password and its database URLs — there is no server to reach and
  no secret in CI to leak.
- **The page must stay honest.** With no customers it cannot claim customers,
  usage numbers, shipped integrations or prices, in any wording. This is
  recorded in CLAUDE.md as a standing constraint, not left to memory.
