# MVP Feature Analysis

Competitor feature breakdown and the specific gaps StaffComplete can win on in v1.
Target segment: HR teams at companies with 30–150 employees.

---

## Competitor feature matrix

| Feature                          | Camino       | Sapling | Factorial | BambooHR | GoCo       | n8n / DIY |
| -------------------------------- | ------------ | ------- | --------- | -------- | ---------- | --------- |
| Onboarding checklist runner      | ✅           | ✅      | ⚠️ basic  | ⚠️ basic | ✅         | ⚙️ (DIY)  |
| Offboarding automation           | ⚠️ secondary | ✅      | ⚠️ basic  | ❌       | ⚠️ partial | ⚙️ (DIY)  |
| Google Workspace provisioning    | ❌           | ❌      | ❌        | ❌       | ❌         | ⚙️ (DIY)  |
| Slack automation                 | ✅ native    | ❌      | ❌        | ❌       | ❌         | ⚙️ (DIY)  |
| WhatsApp / SMS alerts            | ❌           | ❌      | ❌        | ❌       | ❌         | ⚙️ (DIY)  |
| Manual task fallback             | ✅           | ✅      | ✅        | ✅       | ✅         | ❌        |
| Works alongside existing HRIS    | ✅           | ✅      | ❌        | —        | ❌         | ✅        |
| HR-owned, no IT required         | ✅           | ✅      | ✅        | ✅       | ✅         | ❌        |
| Setup under 30 minutes           | ✅           | ❌      | ❌        | ❌       | ❌         | ❌        |
| Affordable for 50-person company | ⚠️           | ❌      | ✅        | ✅       | ❌         | ✅ (free) |
| Predictable per-employee pricing | ❌           | ❌      | ✅        | ✅       | ❌         | —         |

Legend: ✅ strong · ⚠️ partial / limited · ❌ absent · ⚙️ requires engineering · — not applicable

---

## Competitor weaknesses in detail

### Camino

- **Slack-only.** If a company uses WhatsApp for team comms (common in Europe, LatAm, agencies) or is not Slack-first, Camino does not work.
- **Offboarding is secondary.** Focused on onboarding culture and welcome flows. Offboarding access revocation is not a core feature.
- **No Google Workspace provisioning.** Creating a Google account and adding the new hire to the right groups still requires IT to do it manually.
- **Per-journey pricing is unpredictable.** A company hiring 20 people a year pays $150/hire on the Starter plan — $3,000/year before any offboarding. Costs spike with turnover.
- **No alerts outside Slack.** No email or WhatsApp notifications for task owners who are not in Slack.

### Sapling by Kallidus

- **Priced out of the segment.** ~$40/employee/month means $2,000/month for 50 people. Not self-serve at this price.
- **Acquired by Kallidus.** Product direction and investment level post-acquisition are unclear.
- **No provisioning automation.** Strong on checklists and task workflows but does not touch Google, Slack, or other tools directly.
- **No WhatsApp or SMS.** Notification channels limited to email and in-app.

### Factorial

- **Is the HRIS, not the automation layer.** Companies adopting Factorial replace BambooHR or HiBob entirely. Companies already on BambooHR will not switch.
- **Onboarding is document signing + task list.** No Google Workspace account creation, no Slack channel joins, no access provisioning.
- **Offboarding is weak.** A checklist, not automated access revocation.

### BambooHR

- **Onboarding stops at the HR system boundary.** Sending the welcome email, creating the Google account, adding to Slack — all still manual after BambooHR.
- **No deprovisioning.** BambooHR marks an employee as terminated; every other system remains active until IT deals with it.
- **HR loves BambooHR.** This is a feature, not a bug — StaffComplete should trigger off BambooHR events, not compete with it.

### GoCo

- **Pricing eliminates it.** $49/user/month prices out most companies under 50 employees immediately.
- **Full HRIS bundled in.** No value as an add-on; you have to commit to GoCo as your HR system.

### n8n / Zapier / DIY

- **Requires someone technical to build and maintain.** When the Google Workspace API changes, the workflow breaks and no one knows how to fix it.
- **No HR concepts.** No employee record, no checklist UI, no task assignments, no audit trail.
- **No fallback for manual steps.** If a tool has no API, the workflow silently skips it.
- **This is what most 30–80 person companies are actually doing today.** The bar to clear is low but the frustration is real.

---

## Common pain points across the segment

1. **HR manually creates every account.** New hire's first day is delayed because IT hasn't created the Google account yet.
2. **Offboarding is a Slack fire drill.** Someone asks in #ops "did we revoke Jane's GitHub access?" three days after she left.
3. **The onboarding checklist lives in a Google Sheet** that gets stale, has wrong owners, and no one checks.
4. **WhatsApp groups fill in the gaps.** Managers get WhatsApp messages from HR asking them to do their onboarding tasks.
5. **No one knows what's been done.** HR cannot tell whether the laptop was ordered, the email alias set up, or the parking pass issued without chasing individually.

---

## StaffComplete MVP win features

These are the features where StaffComplete beats every existing option for the 30–150 employee HR team.

### 1. Google Workspace provisioning — automated on day one

**Gap:** No SMB-focused tool automates Google Workspace account creation, group membership, or account suspension. HR still asks IT to "create the Google account" for every new hire.

**Win:** New hire added to BambooHR (or triggered manually) → Google account created, added to the right groups and shared drives, calendar invite sent — before HR finishes their coffee. On offboarding, the account is suspended in the same action.

### 2. Offboarding as a first-class feature

**Gap:** Camino treats offboarding as secondary. BambooHR stops at the HR record. The average company has a 9-hour window of lingering access after someone leaves.

**Win:** A single trigger simultaneously suspends Google, deactivates Slack, and assigns manual tasks (return laptop, cancel subscriptions) to the right owners. Every step is logged with a timestamp — know exactly when access was cut.

### 3. Works beyond Slack

**Gap:** Camino is fully Slack-dependent. Companies that use WhatsApp, Teams, or email as their primary comms channel are excluded.

**Win:** Task notifications and overdue alerts go wherever the task owner actually reads messages — Slack DM, email, or WhatsApp. HR sets the preference per person. No one misses their task because they "don't check Slack."

### 4. Complements BambooHR instead of replacing it

**Gap:** Every HRIS-adjacent tool either requires replacing BambooHR (Factorial, GoCo) or ignores it (Camino). Small companies have spent years building their HR data in BambooHR and will not switch.

**Win:** StaffComplete listens to BambooHR webhooks. A status change in BambooHR (new hire, termination, role change) triggers a StaffComplete run automatically. BambooHR stays the system of record; StaffComplete handles what BambooHR cannot reach.

### 5. Predictable flat-fee pricing

**Gap:** Camino charges per journey ($150/hire + $150/offboard = $300 per employee lifecycle). Sapling charges $40/employee/month. GoCo charges $49/user/month. None are predictable at small scale.

**Win:** A flat monthly fee based on company size — not per journey, not per seat. A 40-person company pays the same whether they hire 2 people this month or 8.

### 6. Setup in under 30 minutes

**Gap:** Sapling requires implementation support. Factorial requires migrating your HR data. n8n requires an engineer. No SMB tool is genuinely self-serve from zero to first automated run.

**Win:** Connect Google Workspace (OAuth, 2 clicks), connect Slack (OAuth, 2 clicks), apply the "Google + Slack new hire" template, and trigger a test run. Done in under 30 minutes, no IT required.

### 7. Manual task fallback — nothing slips through

**Gap:** Automated tools skip tools they cannot reach. If the laptop vendor has no API, the task simply does not happen and no one notices.

**Win:** Any step without an API becomes an assigned task with a due date and an overdue alert. "Order laptop from supplier" goes to the office manager. "Brief on team norms" goes to the manager. The audit log captures manual completions too — a complete record of every onboarding and offboarding, automated and manual.

---

## MVP scope

Ship these features in v1, in priority order:

| Priority | Feature                                               | Why now                                                           |
| -------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| P0       | Onboarding checklist runner (trigger → tasks → track) | Core loop — beats the Google Sheet on day one                     |
| P0       | Offboarding checklist runner (simultaneous, logged)   | Highest pain, highest security risk, clearest ROI                 |
| P0       | Google Workspace integration (create / suspend)       | The one automation no competitor offers in this segment           |
| P0       | Manual task assignment with due dates and alerts      | Required for anything without an API; makes checklist complete    |
| P1       | Slack integration (add to workspace, deactivate)      | Second most-used tool in the segment                              |
| P1       | Email and WhatsApp alerts for overdue tasks           | Reaches task owners who are not in Slack                          |
| P1       | Pre-built templates (Google + Slack stack)            | Delivers the 30-minute setup promise                              |
| P1       | HR dashboard (active runs, task status at a glance)   | HR needs visibility without logging in to each tool               |
| P2       | BambooHR webhook trigger                              | Automates the trigger; without it, HR triggers runs manually      |
| P2       | HiBob webhook trigger                                 | Second most common HRIS in the segment                            |
| P2       | Audit log export                                      | Useful for compliance; not a day-one purchase driver at this size |

**What is explicitly out of scope for v1:**

- No-code visual workflow builder — a linear checklist is sufficient; a drag-and-drop builder adds months of build time
- Role change workflows — less frequent at 30–150 employees; manual process is acceptable
- SSO / SCIM inbound — not relevant at this company size
- Enterprise tier — not targeting 500+ employee companies

---

## Sources

- [Best Onboarding Software for Slack Teams 2026 — Camino](https://joincamino.com/guides/best-onboarding-software-for-slack)
- [Best Employee Onboarding Software 2026 — Camino](https://joincamino.com/guides/best-employee-onboarding-software)
- [Sapling 2026 Pricing & Reviews — GetApp](https://www.getapp.com/hr-employee-management-software/a/sapling/)
- [GoCo Review 2026 — People Managing People](https://peoplemanagingpeople.com/tools/goco-review/)
- [17 Best Onboarding Software for Small Businesses 2026 — People Managing People](https://peoplemanagingpeople.com/tools/best-onboarding-software-for-small-business/)
- [10 Best Onboarding and Offboarding Software 2026 — People Managing People](https://peoplemanagingpeople.com/tools/best-onboarding-and-offboarding-software/)
- [Automate employee onboarding with Slack, Jira, Google Workspace — n8n](https://n8n.io/workflows/3860-automate-employee-onboarding-with-slack-jira-and-google-workspace-integration/)
