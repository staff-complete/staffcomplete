# MVP Feature Analysis

Competitor feature breakdown and the specific gaps StaffComplete can win on in v1.

---

## Competitor feature matrix

| Feature                          | Rippling | BetterCloud | Stitchflow      | Okta LCM   | Workato     |
| -------------------------------- | -------- | ----------- | --------------- | ---------- | ----------- |
| Onboarding automation            | ✅       | ✅          | ❌              | ✅         | ⚙️ (DIY)    |
| Offboarding automation           | ✅       | ✅          | ✅ (audit only) | ✅         | ⚙️ (DIY)    |
| Role / team change workflows     | ✅       | ⚠️ partial  | ❌              | ❌         | ⚙️ (DIY)    |
| No-code workflow builder         | ✅       | ✅          | ❌              | ❌         | ⚠️ low-code |
| Works without replacing HRIS     | ❌       | ✅          | ✅              | ✅         | ✅          |
| HR-team owned (no IT needed)     | ❌       | ❌          | ❌              | ❌         | ❌          |
| Apps without SCIM support        | ❌       | ⚠️ partial  | ✅ (audit)      | ❌         | ⚙️ (DIY)    |
| Full audit trail                 | ✅       | ✅          | ✅              | ⚠️ partial | ❌          |
| Per-employee transparent pricing | ❌       | ❌          | ❌              | ❌         | ❌          |
| SMB / mid-market pricing         | ❌       | ❌          | ⚠️              | ⚠️         | ❌          |
| Setup under 30 minutes           | ❌       | ❌          | ⚠️              | ❌         | ❌          |

Legend: ✅ strong · ⚠️ partial / limited · ❌ absent · ⚙️ requires engineering

---

## Competitor weaknesses in detail

### Rippling

- **Requires buying the full stack.** Payroll, HR, and IT must all run on Rippling. You cannot use it purely for lifecycle automation on top of an existing HRIS.
- **Enterprise pricing.** Not viable for companies under ~100 employees.
- **Complex setup.** Onboarding Rippling IT takes weeks. Support is rated poorly for complex issues.
- **Limited custom reporting.** Most-criticised feature in 2026 reviews.

### BetterCloud

- **Priced out of mid-market.** Median annual contract ~$45K. No self-serve option.
- **IT-team tool, not HR-friendly.** HR cannot own or modify workflows without IT involvement.
- **Acquisition uncertainty.** Acquired by CoreStack in March 2026 — product direction unclear.
- **Fragmented UI.** Legacy and modern consoles coexist; scrolling through 100+ unnamed workflows is painful.
- **Integration breadth.** Trails competitors on G2 (7.8/10 vs Zluri 8.9/10).

### Stitchflow

- **Audit, not action.** Identifies access gaps and orphaned accounts but does not orchestrate the full onboarding or offboarding lifecycle.
- **IT/security audience.** Not positioned for HR teams at all.
- **No workflow builder.** Relies on the IT team to act on its findings.

### Okta Lifecycle Management

- **SCIM covers ~1.2% of apps.** 98.8% of apps either lack SCIM or paywall it, leaving most of the stack manual.
- **Developer-required setup.** No HR person can configure Okta LCM without IT.
- **Identity-only.** Does not handle tasks (equipment requests, account setup, welcome emails, etc.).

### Workato

- **Requires engineering to build every workflow from scratch.** Not a product — a platform.
- **No HR context.** Generic automation without employee lifecycle concepts built in.
- **Expensive.** Enterprise pricing, not per-employee.

---

## Common pain points across all competitors

1. **57% of HR admin time** is spent on manual coordination between systems.
2. **75% of organisations** were harmed by a former employee's lingering access after offboarding.
3. No tool is **HRIS-agnostic and HR-owned** simultaneously — you either replace your HRIS (Rippling) or hand it to IT (everyone else).
4. Every tool either targets **enterprise** (BetterCloud, Rippling, Okta) or **IT teams** (Stitchflow, Okta) — no one owns the **HR-team, mid-market** segment.
5. Setup takes **weeks**, not minutes.
6. **Role change / mid-lifecycle automation** is weak or absent in all but Rippling.
7. Pricing is **opaque** — no transparent per-employee tiers.

---

## StaffComplete MVP win features

These are the features where StaffComplete can beat every existing option for the HR-team, 50–500 employee segment.

### 1. HR-team owned, zero IT required

**Gap:** Every competitor requires IT to set up, manage, or modify lifecycle workflows.

**Win:** HR creates and owns all workflows in a visual builder with no engineering involvement. Roles, triggers, and integration actions are expressed in HR language (not developer language).

### 2. HRIS-agnostic — bring your own HR system

**Gap:** Rippling forces you off your existing HRIS. Others assume IT manages the source of truth.

**Win:** StaffComplete sits alongside BambooHR, HiBob, Workday, Personio, or any HRIS via webhooks or CSV import. It does not replace anything — it connects everything.

### 3. Simultaneous, verified offboarding

**Gap:** Manual offboarding leaves an average 9-hour window of lingering access. 75% of companies report harm from this.

**Win:** Every connected system is deprovisioned in a single triggered action. A timestamped receipt per app is generated automatically — proof of revocation for SOC 2 and compliance audits.

### 4. Role change and team transfer workflows

**Gap:** Competitors handle hire and leave well. Mid-lifecycle changes (promotion, team move, location change) are almost universally manual or require custom Workato/Zapier builds.

**Win:** Promote an employee in your HRIS → StaffComplete automatically adjusts group memberships, Slack channels, GitHub teams, Jira projects, and access tiers across every connected tool.

### 5. Transparent per-employee pricing

**Gap:** BetterCloud ~$45K/year. Rippling requires a full HR/payroll contract. Okta requires enterprise negotiation. No one offers predictable per-seat pricing a People team can approve without procurement.

**Win:** $3–6/employee/month, billed monthly, cancel any time. A 50-person company knows exactly what it pays.

### 6. Setup in under 10 minutes

**Gap:** Rippling onboarding takes weeks. BetterCloud requires professional services for complex setups. Okta LCM requires developer configuration.

**Win:** Connect your HRIS and first integration, create your first onboarding workflow, and run it — all before lunch on day one. Pre-built templates for the 10 most common stacks (Google Workspace + Slack + GitHub, etc.) out of the box.

### 7. Full audit trail, SOC 2 ready

**Gap:** Workato logs nothing. Okta logs identity actions only. BetterCloud logs well but costs enterprise money.

**Win:** Every provisioning and deprovisioning action is logged with actor, timestamp, result, and evidence. Exportable as a compliance report. Included on all plans.

### 8. Non-SCIM app support via task fallback

**Gap:** Okta LCM covers ~1.2% of apps with native SCIM. BetterCloud covers more but still misses the long tail. Stitchflow detects gaps but cannot fix them.

**Win:** For apps without APIs, StaffComplete generates a structured task assigned to the right person (IT, manager, etc.) — so nothing slips through even if automation cannot reach it. The audit trail captures manual completions too.

---

## MVP scope recommendation

Ship these 8 features in v1. In priority order:

| Priority | Feature                                                 | Why now                                          |
| -------- | ------------------------------------------------------- | ------------------------------------------------ |
| P0       | Onboarding automation (provision across connected apps) | Core value, day-one use case                     |
| P0       | Offboarding automation (simultaneous, verified)         | Highest pain, highest security risk              |
| P0       | Audit trail + compliance export                         | Differentiator, required for any regulated buyer |
| P1       | Role change / team transfer workflows                   | No competitor does this well                     |
| P1       | HRIS webhook / CSV import (BambooHR, HiBob, Workday)    | Unlocks HRIS-agnostic positioning                |
| P1       | No-code visual workflow builder                         | HR-team-owned positioning                        |
| P2       | Task fallback for non-API apps                          | Closes the coverage gap                          |
| P2       | Pre-built templates for common stacks                   | Drives the 10-minute setup promise               |

---

## Sources

- [Rippling review 2026 — THRIVEA](https://thrivea.com/blog/rippling-review-2026/)
- [Rippling Review — People Managing People](https://peoplemanagingpeople.com/tools/rippling-review/)
- [Rippling SCIM Provisioning limitations — Stitchflow](https://www.stitchflow.com/scim/rippling)
- [BetterCloud Reviews 2026 — G2](https://www.g2.com/products/bettercloud/reviews)
- [BetterCloud Review 2026 — Linktly](https://www.linktly.com/it-software/bettercloud-review/)
- [Best SaaS User Lifecycle Management Software — Stitchflow](https://www.stitchflow.com/blog/best-user-lifecycle-management-software)
- [Top Employee Offboarding Software for IT Teams — Stitchflow](https://www.stitchflow.com/blog/best-employee-offboarding-software)
- [Okta Lifecycle Management](https://www.okta.com/products/lifecycle-management/)
- [Why choose Workato over BetterCloud](https://resources.workato.com/why-choose-workato-over-bettercloud-1/)
- [10 Best Onboarding and Offboarding Software 2026](https://peoplemanagingpeople.com/tools/best-onboarding-and-offboarding-software/)
- [Low-Code HR Automation — Kissflow](https://kissflow.com/low-code/low-code-hr-automation/)
