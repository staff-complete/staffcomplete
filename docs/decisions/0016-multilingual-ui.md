# ADR-0016: Multilingual UI (English, Russian, Hebrew)

- **Status:** accepted
- **Date:** 2026-07-23

## Context

StaffComplete has been English-only since day one — there's no translation library, no locale column anywhere in the schema, and no RTL (right-to-left) handling in `apps/web`. #89 asks for the app to be usable in English, Russian, and Hebrew, with Hebrew requiring RTL layout, not just translated strings.

A key product decision shapes the whole design: language is a property of the **organization**, not the individual user. An org's admin sets the workspace language once (org settings define which language the system is available in for that org), and every member of that org sees the app in that language — there's no per-user override. This matches how the rest of the org-level settings work (see ADR-0014's `organization`/`member` model) and avoids a mixed-language support surface where two teammates in the same org see different UI.

## Decision

**Locale storage:** add a `locale` column (`text`, not null, default `'en'`) to the `organization` table via Better Auth's `additionalFields` mechanism on the `organization` plugin (`apps/api/src/auth.ts`), rather than a hand-rolled join table. This makes `locale` a first-class field on every `organization.create` / `organization.update` API call and on the session's active-organization payload, with no extra endpoint needed. `packages/shared` exports the canonical `Locale` union (`'en' | 'ru' | 'he'`) and a Zod schema so both apps validate against the same set.

**Frontend library:** [vue-i18n](https://vue-i18n.intlify.dev/) in Composition API mode (`legacy: false`). It's the de facto standard for Vue 3, has first-class TypeScript support, and handles pluralization/interpolation we'll need later — a hand-rolled key-lookup helper would just reimplement a subset of it.

**RTL strategy:** locale, not a separate setting, determines text direction. A small `RTL_LOCALES` set in `packages/shared` maps `he` → `rtl`; everything else is `ltr`. On app boot and whenever the active organization's locale changes, `apps/web/src/App.vue` sets `document.documentElement.lang` and `dir` accordingly. Layout mirroring is handled with Tailwind's logical-property utilities (`ps-*`/`pe-*`/`ms-*`/`me-*` instead of `pl-*`/`pr-*`/`ml-*`/`mr-*`) in touched components, rather than maintaining parallel RTL-specific stylesheets — this only needs to happen in components actually converted in this pass.

**Translation key structure:** one JSON module per locale under `apps/web/src/i18n/locales/{en,ru,he}.ts`, namespaced by view/domain (`auth.signIn.title`, `team.inviteForm.emailLabel`, etc.) rather than one flat namespace or one file per view. A single file per locale keeps translators (or future translation tooling) looking at one place per language, and namespacing by domain keeps keys discoverable without needing a file per component.

**Scope of this pass:** infrastructure (library, locale storage, RTL, switcher) plus the auth flow (sign in/up, forgot/reset password, check-email, accept-invite) and core authenticated views (Dashboard, Workflows, Runs, Team). Marketing/landing pages and transactional emails (Resend templates in `apps/api/src/auth.ts`) stay English-only, tracked as explicit follow-up in #89's acceptance criteria — translating ~150 lines of marketing copy and email templates is a separable, lower-urgency chunk of work from getting the product itself usable in-language.

**Alternative considered:** per-user locale (a `locale` column on `user` instead of `organization`). Rejected per product direction — this app is used by HR/IT admins managing a single organization's employee lifecycle, and a mixed-language team UI (two admins on the same org seeing different languages) adds support surface without a clear benefit here.

**Alternative considered:** storing `locale` inside the organization plugin's existing free-form `metadata` text column instead of a dedicated field. Rejected — `metadata` is an unstructured JSON blob with no schema enforcement; a dedicated column gets a NOT NULL default, participates in `additionalFields` type-checking on the Better Auth client, and is simpler to reason about than parsing JSON out of every organization read.

## Consequences

- Every future user-facing string added to the auth flow or the four converted views must go through an i18n key — plain hardcoded strings in those files should be treated as a regression from this point on.
- Views not converted in this pass (marketing pages, `BillingView`, `MyTasksView`, `WorkflowEditorView`'s deeper editing surface if not fully covered) remain English-only until a follow-up does the same extraction; this is an intentionally incomplete, phased rollout, not a bug.
- Adding a fourth language later means adding one locale file, updating `SUPPORTED_LOCALES`/`RTL_LOCALES` in `packages/shared`, and adding it to the language switcher's options — no structural changes.
- The `organization.locale` migration is additive (new column with a default) and backward-compatible with the currently running app version, per the standard Kamal pre-deploy migration constraint (ADR-0008).
- Transactional emails (`apps/api/src/auth.ts`) and marketing pages stay a known gap — an HR admin whose org is set to Russian still receives English invite/reset-password emails until that follow-up work lands.
