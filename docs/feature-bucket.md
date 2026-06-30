# Feature Bucket List

Comprehensive inventory of every feature StaffComplete could build, derived from competitor research,
market gaps, and the 30–150 employee segment strategy. Used to inform roadmap prioritisation.

**Status legend:**

- 🟢 **MVP** — committed to v1
- 🔵 **Post-MVP** — clear next step after launch
- 🟡 **Future** — valuable but not near-term
- ⚪ **Out of scope** — outside the product vision

**Competitor reference:** Camino · Sapling · Factorial · BambooHR · Rippling · BetterCloud · Okta LCM · n8n

---

## Lifecycle triggers — what starts a run

| Feature                                            | Status      | Competitor coverage | Notes                                       |
| -------------------------------------------------- | ----------- | ------------------- | ------------------------------------------- |
| Manual trigger (HR clicks "Start onboarding")      | 🟢 MVP      | All                 | Baseline for day one                        |
| BambooHR webhook (new hire / termination / change) | 🟢 MVP      | Sapling, Rippling   | Most common HRIS in segment                 |
| HiBob webhook                                      | 🔵 Post-MVP | Sapling             | Second most common                          |
| CSV import (bulk trigger from spreadsheet)         | 🔵 Post-MVP | Sapling, Factorial  | Fallback for HRIS-less companies            |
| Personio webhook                                   | 🔵 Post-MVP | Sapling             | European market                             |
| Workday webhook                                    | 🟡 Future   | Sapling, Rippling   | Larger companies only                       |
| Gusto webhook                                      | 🟡 Future   | —                   | US payroll-first SMBs                       |
| Rippling webhook (as HRIS source)                  | 🟡 Future   | —                   | Unusual but possible                        |
| Zapier / Make inbound trigger                      | 🟡 Future   | —                   | Covers any HRIS via middleware              |
| API trigger (POST /runs)                           | 🔵 Post-MVP | —                   | For custom integrations                     |
| Calendar-based trigger (start date - N days)       | 🔵 Post-MVP | Sapling, Camino     | Pre-boarding before day one                 |
| Probation end trigger                              | 🟡 Future   | Sapling             | Confirm permanent access after trial period |
| Return from leave trigger                          | 🟡 Future   | Sapling             | Reinstate access after parental/sick leave  |
| Leave of absence trigger                           | 🔵 Post-MVP | Sapling             | Suspend access during leave                 |
| Contractor onboarding trigger                      | 🔵 Post-MVP | Sapling, Rippling   | Separate checklist from FTE onboarding      |
| Contractor offboarding trigger                     | 🔵 Post-MVP | Sapling, Rippling   | Typically shorter, no equipment return      |

---

## Lifecycle event types

| Feature                                     | Status      | Competitor coverage   | Notes                                 |
| ------------------------------------------- | ----------- | --------------------- | ------------------------------------- |
| New hire onboarding                         | 🟢 MVP      | All                   | Core                                  |
| Offboarding / termination                   | 🟢 MVP      | All except BambooHR   | Core                                  |
| Role / team change                          | 🔵 Post-MVP | Rippling, Sapling     | Diff-based permission update          |
| Internal transfer (location change)         | 🟡 Future   | Rippling              | Often paired with role change         |
| Promotion (title change, no team change)    | 🟡 Future   | Rippling              | Minimal access delta                  |
| Parental / long-term leave                  | 🔵 Post-MVP | Sapling               | Suspend, then reinstate               |
| Rehire (returning employee)                 | 🟡 Future   | Sapling               | Reinstate previous access profile     |
| Emergency offboarding (immediate, same-day) | 🔵 Post-MVP | BetterCloud, Rippling | Triggered by HR without standard flow |

---

## Integrations — provisioning targets

### Collaboration and identity

| Integration                                       | Status      | Competitor coverage    | Notes                                  |
| ------------------------------------------------- | ----------- | ---------------------- | -------------------------------------- |
| Google Workspace — create / suspend / delete user | 🟢 MVP      | n8n (DIY), BetterCloud | Key differentiator vs Camino / Sapling |
| Google Workspace — add / remove from groups       | 🟢 MVP      | n8n (DIY), BetterCloud | Drives correct access from day one     |
| Google Workspace — shared drive access            | 🔵 Post-MVP | BetterCloud            | Less critical than groups              |
| Google Workspace — calendar invite (day 1)        | 🔵 Post-MVP | Camino                 | Nice onboarding touch                  |
| Slack — add to workspace                          | 🟢 MVP      | Camino, BetterCloud    | Day one requirement                    |
| Slack — add to / remove from channels             | 🟢 MVP      | Camino, BetterCloud    | Drives team visibility                 |
| Slack — deactivate user                           | 🟢 MVP      | Camino, BetterCloud    | Offboarding critical step              |
| Slack — send welcome DM to new hire               | 🔵 Post-MVP | Camino                 | Culture touch                          |
| Microsoft 365 — create / disable user             | 🔵 Post-MVP | BetterCloud, Okta LCM  | Second most common stack               |
| Microsoft Teams — add to team / channel           | 🔵 Post-MVP | BetterCloud            | Mirrors Slack integration              |
| Okta — provision / deprovision via SCIM           | 🟡 Future   | Okta LCM               | Only for companies already using Okta  |
| Azure AD / Entra ID                               | 🟡 Future   | BetterCloud, Okta LCM  | Enterprise identity layer              |

### HRIS / people systems

| Integration                    | Status      | Competitor coverage | Notes                                  |
| ------------------------------ | ----------- | ------------------- | -------------------------------------- |
| BambooHR — read employee data  | 🟢 MVP      | Sapling, Rippling   | Source of truth for trigger data       |
| HiBob — read employee data     | 🔵 Post-MVP | Sapling             | European SMB market                    |
| Personio — read employee data  | 🔵 Post-MVP | Sapling             | European market                        |
| Factorial — read employee data | 🟡 Future   | —                   | Their customers won't use us alongside |
| Workday — read employee data   | 🟡 Future   | Sapling, Rippling   | Too large for target segment           |

### Developer and project tools

| Integration                          | Status      | Competitor coverage | Notes                         |
| ------------------------------------ | ----------- | ------------------- | ----------------------------- |
| GitHub — add to org, add to teams    | 🔵 Post-MVP | BetterCloud         | Engineering companies only    |
| GitHub — remove from org             | 🔵 Post-MVP | BetterCloud         | Offboarding security step     |
| Jira — add user to project / license | 🔵 Post-MVP | BetterCloud         | Common in tech teams          |
| Jira — deactivate user               | 🔵 Post-MVP | BetterCloud         | Frees license on offboarding  |
| Linear — add to team / remove        | 🟡 Future   | —                   | Growing in SMB segment        |
| Notion — add as member / remove      | 🟡 Future   | —                   | Common in SMB knowledge bases |
| Figma — add as member / remove       | 🟡 Future   | —                   | Design teams                  |
| Sentry — add member / remove         | 🟡 Future   | —                   | Engineering teams             |
| Datadog — add member / remove        | 🟡 Future   | —                   | Engineering teams             |

### Security and access management

| Integration                       | Status    | Competitor coverage | Notes                              |
| --------------------------------- | --------- | ------------------- | ---------------------------------- |
| 1Password — add to vault / remove | 🟡 Future | BetterCloud         | Credential offboarding             |
| LastPass — add user / remove      | 🟡 Future | BetterCloud         | Common in non-tech SMBs            |
| VPN — add / remove user           | 🟡 Future | BetterCloud         | Hardware / configuration dependent |

### CRM and support (lower priority for HR)

| Integration                        | Status    | Competitor coverage | Notes                         |
| ---------------------------------- | --------- | ------------------- | ----------------------------- |
| HubSpot — add user / remove        | 🟡 Future | —                   | Sales teams                   |
| Salesforce — add user / deactivate | 🟡 Future | BetterCloud         | Sales teams, larger companies |
| Zendesk — add agent / deactivate   | 🟡 Future | —                   | Support teams                 |
| Intercom — add teammate / remove   | 🟡 Future | —                   | Support and growth teams      |

### Finance and operations

| Integration                  | Status    | Competitor coverage | Notes                    |
| ---------------------------- | --------- | ------------------- | ------------------------ |
| Zoom — add user / deactivate | 🟡 Future | BetterCloud         | Common in remote teams   |
| Loom — add member / remove   | 🟡 Future | —                   | Remote-first companies   |
| Miro — add member / remove   | 🟡 Future | —                   | Design and product teams |

---

## Notification channels

| Feature                                    | Status          | Competitor coverage | Notes                                          |
| ------------------------------------------ | --------------- | ------------------- | ---------------------------------------------- |
| Email alert — task assigned                | 🟢 MVP          | Sapling, Factorial  | Baseline fallback                              |
| Email alert — task overdue                 | 🟢 MVP          | Sapling             | Drives completion                              |
| Email alert — run completed                | 🟢 MVP          | Sapling             | HR confirmation                                |
| Slack DM — task assigned                   | 🟢 MVP          | Camino              | Primary channel for Slack-first teams          |
| Slack DM — task overdue                    | 🟢 MVP          | Camino              |                                                |
| WhatsApp — individual message (task alert) | 🔵 Post-MVP     | —                   | Official API, no OBA required                  |
| WhatsApp — group add / remove              | ⚪ Out of scope | —                   | Requires OBA (Meta review gate) + 8-person cap |
| SMS (Twilio)                               | 🟡 Future       | —                   | Fallback for non-smartphone workers            |
| Microsoft Teams DM                         | 🟡 Future       | —                   | Microsoft-stack companies                      |
| In-app notification                        | 🔵 Post-MVP     | Sapling, Factorial  | For HR users logged in to StaffComplete        |
| Push notification (mobile)                 | 🟡 Future       | Factorial           | Mobile app required                            |

---

## Checklist and workflow engine

| Feature                                   | Status      | Competitor coverage   | Notes                                          |
| ----------------------------------------- | ----------- | --------------------- | ---------------------------------------------- |
| Sequential steps                          | 🟢 MVP      | All                   | Step N starts after step N-1                   |
| Parallel steps (run simultaneously)       | 🔵 Post-MVP | Rippling, BetterCloud | Google + Slack can provision in parallel       |
| Manual task with assignee and due date    | 🟢 MVP      | All                   | Non-API fallback                               |
| Automated step (calls integration)        | 🟢 MVP      | BetterCloud, Rippling | Core automation                                |
| Pre-built templates                       | 🟢 MVP      | Camino, Sapling       | Google + Slack starter pack                    |
| Custom checklist builder (list-based)     | 🟢 MVP      | Sapling, Factorial    | No drag-and-drop in v1                         |
| Conditional steps (if dept = X, add to Y) | 🔵 Post-MVP | Rippling, BetterCloud | Drives role-based provisioning                 |
| Approval gate (wait for sign-off)         | 🟡 Future   | Sapling               | Block next step until someone approves         |
| Due date per step                         | 🟢 MVP      | Sapling, Factorial    | Required for task accountability               |
| Overdue escalation (notify manager)       | 🔵 Post-MVP | Sapling               | If HR rep doesn't complete in N days           |
| Step retry on failure                     | 🔵 Post-MVP | BetterCloud           | Auto-retry failed API calls                    |
| Visual drag-and-drop workflow builder     | 🟡 Future   | BetterCloud, Rippling | Adds months; list builder is sufficient for v1 |
| Step dependencies (B requires A)          | 🔵 Post-MVP | BetterCloud           | For complex provisioning flows                 |
| Template versioning                       | 🟡 Future   | BetterCloud           | Maintain history of template changes           |
| Community template library                | 🟡 Future   | —                     | Share templates between tenants                |
| Template import / export                  | 🟡 Future   | —                     | Move templates between environments            |

---

## Employee management

| Feature                                  | Status      | Competitor coverage     | Notes                                     |
| ---------------------------------------- | ----------- | ----------------------- | ----------------------------------------- |
| Employee directory                       | 🔵 Post-MVP | Sapling, Factorial      | List of employees with status             |
| Employee profile                         | 🔵 Post-MVP | Sapling, Factorial      | Name, role, department, start date, tools |
| Current access inventory per employee    | 🟡 Future   | BetterCloud, Stitchflow | "What does Jane have access to?"          |
| Lifecycle history per employee           | 🔵 Post-MVP | Sapling                 | All runs ever triggered for this person   |
| Org chart view                           | 🟡 Future   | BambooHR, Factorial     | Rarely needed for lifecycle automation    |
| Employee search and filter               | 🔵 Post-MVP | All                     | Find employees by name, dept, status      |
| Bulk actions (offboard multiple at once) | 🟡 Future   | BetterCloud             | Useful during layoffs                     |
| Employee groups / cohorts                | 🟡 Future   | Rippling                | Trigger run for a department              |
| Access risk score per employee           | 🟡 Future   | Stitchflow              | Over-provisioned access detection         |

---

## Document and signature features

| Feature                                    | Status    | Competitor coverage | Notes                              |
| ------------------------------------------ | --------- | ------------------- | ---------------------------------- |
| Document collection (request upload)       | 🟡 Future | Sapling, Factorial  | ID, contracts, signed policies     |
| E-signature request (DocuSign / HelloSign) | 🟡 Future | Sapling, Factorial  | NDA, offer letter acknowledgment   |
| Document template (IT policy, handbook)    | 🟡 Future | Sapling, Factorial  | Send PDF as part of onboarding run |
| Employee handbook delivery                 | 🟡 Future | Camino, Factorial   | Cultural onboarding component      |
| Signed acknowledgment tracking             | 🟡 Future | Sapling             | Audit evidence for compliance      |

---

## Equipment and asset management

| Feature                                        | Status    | Competitor coverage   | Notes                                |
| ---------------------------------------------- | --------- | --------------------- | ------------------------------------ |
| Equipment order task (manual, assigned to ops) | 🟢 MVP    | Sapling               | Laptop / desk / access card          |
| Equipment return task (offboarding)            | 🟢 MVP    | Sapling               | Track that device was returned       |
| Asset inventory per employee                   | 🟡 Future | Sapling               | What hardware does this person have? |
| Integration with MDM (Jamf, Kandji)            | 🟡 Future | Rippling, BetterCloud | Remote wipe on offboarding           |
| Integration with hardware vendor (Apple, etc.) | 🟡 Future | Rippling              | Auto-order device on hire            |

---

## Access review and security

| Feature                                      | Status    | Competitor coverage     | Notes                                     |
| -------------------------------------------- | --------- | ----------------------- | ----------------------------------------- |
| Orphaned account detection                   | 🟡 Future | BetterCloud, Stitchflow | Accounts with no matching employee        |
| Dormant account alerts (no login in 90 days) | 🟡 Future | BetterCloud, Stitchflow | Unused but active accounts                |
| Periodic access review (every 90 days)       | 🟡 Future | BetterCloud, Stitchflow | Manager certifies each person's access    |
| Access certification workflow                | 🟡 Future | BetterCloud, Okta LCM   | Formal recertification with sign-off      |
| Over-provisioned access detection            | 🟡 Future | Stitchflow              | Has access to tools not in their template |
| Cross-system access comparison               | 🟡 Future | Stitchflow              | What does directory say vs what tools say |

---

## Audit and compliance

| Feature                                       | Status      | Competitor coverage  | Notes                                 |
| --------------------------------------------- | ----------- | -------------------- | ------------------------------------- |
| Immutable audit log (every action)            | 🟢 MVP      | BetterCloud, Sapling | Who did what, when, result            |
| Audit log — filter by employee / event / date | 🔵 Post-MVP | BetterCloud          | Navigation at scale                   |
| Audit log export (CSV)                        | 🔵 Post-MVP | BetterCloud, Sapling | For compliance reviews                |
| Audit log export (PDF report)                 | 🟡 Future   | BetterCloud          | Formal evidence format                |
| Manual completion logging                     | 🟢 MVP      | Sapling              | Track who completed manual tasks      |
| Compliance report (SOC 2 evidence)            | 🟡 Future   | BetterCloud          | Specific evidence format for auditors |
| Retention policy (keep logs N years)          | 🟡 Future   | BetterCloud          | Data retention compliance             |

---

## Reporting and analytics

| Feature                                 | Status      | Competitor coverage | Notes                                  |
| --------------------------------------- | ----------- | ------------------- | -------------------------------------- |
| HR dashboard (active runs, task status) | 🟢 MVP      | Sapling, Factorial  | Core HR visibility                     |
| Run history (completed onboardings)     | 🔵 Post-MVP | Sapling             | How many people onboarded this quarter |
| Average time-to-complete per run        | 🟡 Future   | Sapling             | Benchmark against template             |
| Overdue task report                     | 🔵 Post-MVP | Sapling             | Which tasks are blocking runs          |
| Integration health status               | 🔵 Post-MVP | BetterCloud         | Is Google Workspace still connected?   |
| Onboarding completion rate              | 🟡 Future   | Sapling             | % of steps completed on time           |
| Access coverage report                  | 🟡 Future   | Stitchflow          | % of employees fully provisioned       |
| Time saved estimate                     | 🟡 Future   | —                   | Vanity metric but drives retention     |

---

## Platform and administration

| Feature                                      | Status          | Competitor coverage   | Notes                                       |
| -------------------------------------------- | --------------- | --------------------- | ------------------------------------------- |
| Multi-tenant data isolation (RLS)            | 🟢 MVP          | All SaaS              | Architecture requirement                    |
| HR admin role                                | 🟢 MVP          | All                   | Create and manage runs                      |
| Viewer role (read-only)                      | 🔵 Post-MVP     | Sapling               | Managers see their team's runs              |
| Task assignee role (external task recipient) | 🟢 MVP          | Sapling               | IT, manager, ops — no full account needed   |
| Invite team members                          | 🔵 Post-MVP     | All                   | Add other HR team members                   |
| Google OAuth login                           | 🔵 Post-MVP     | All                   | SSO for small companies                     |
| Microsoft OAuth login                        | 🟡 Future       | All                   | Microsoft-stack companies                   |
| SAML SSO (enterprise)                        | ⚪ Out of scope | Rippling, BetterCloud | Not relevant for 30–150 segment             |
| SCIM inbound (be provisioned by Okta)        | ⚪ Out of scope | Rippling, BetterCloud | Not relevant for 30–150 segment             |
| API access for custom integrations           | 🟡 Future       | BetterCloud           | Enables long-tail tool integrations         |
| Outbound webhooks                            | 🟡 Future       | BetterCloud           | Notify external systems of lifecycle events |
| Billing and subscription management          | 🔵 Post-MVP     | All SaaS              | Required to charge customers                |
| Usage dashboard (employees managed)          | 🔵 Post-MVP     | All SaaS              | Billing basis                               |
| White-labeling                               | ⚪ Out of scope | —                     | Not relevant for direct SaaS                |

---

## Training and orientation

| Feature                                | Status      | Competitor coverage    | Notes                                     |
| -------------------------------------- | ----------- | ---------------------- | ----------------------------------------- |
| Buddy / mentor assignment task         | 🔵 Post-MVP | Camino                 | Structured cultural onboarding            |
| First-week schedule generation         | 🟡 Future   | Camino                 | Send day-by-day calendar to new hire      |
| Training task (link to external LMS)   | 🟡 Future   | Camino, Sapling        | Complete course as onboarding step        |
| LMS integration (Learnupon, TalentLMS) | 🟡 Future   | Sapling (via Kallidus) | Auto-enrol in training on hire            |
| Training completion tracking           | 🟡 Future   | Camino                 | Confirm course done before access granted |
| 30/60/90 day check-in reminders        | 🟡 Future   | Camino, Sapling        | Manager prompts post-onboarding           |

---

## AI and smart features

| Feature                                     | Status    | Competitor coverage | Notes                                              |
| ------------------------------------------- | --------- | ------------------- | -------------------------------------------------- |
| Smart template suggestion (by role / dept)  | 🟡 Future | —                   | "You hired a Designer — use this template"         |
| AI-generated checklist from job description | 🟡 Future | —                   | Paste JD, get suggested onboarding steps           |
| Anomaly detection (access not revoked)      | 🟡 Future | Stitchflow          | Flag accounts still active 7 days post-offboarding |
| Duplicate access detection                  | 🟡 Future | BetterCloud         | Same person provisioned twice                      |
| Predicted time-to-complete                  | 🟡 Future | —                   | Based on similar past runs                         |

---

## Internationalisation and localisation

| Feature                                     | Status      | Competitor coverage    | Notes                                                         |
| ------------------------------------------- | ----------- | ---------------------- | ------------------------------------------------------------- |
| i18n framework (vue-i18n)                   | 🟢 MVP      | —                      | Build in from day one — retrofitting is expensive             |
| English UI                                  | 🟢 MVP      | All                    | Default language                                              |
| Hebrew UI (RTL layout)                      | 🔵 Post-MVP | —                      | No competitor offers this; strong moat in Israeli SMB market  |
| Hebrew email notifications                  | 🔵 Post-MVP | —                      | Paired with Hebrew UI                                         |
| Hebrew pre-built templates                  | 🔵 Post-MVP | —                      | Onboarding and offboarding checklists in Hebrew               |
| RTL layout support (`dir="rtl"`)            | 🔵 Post-MVP | —                      | Required for Hebrew; CSS/Tailwind pass on all components      |
| Date and number locale (Hebrew calendar)    | 🟡 Future   | —                      | date-fns has Hebrew locale; edge cases around Jewish holidays |
| Additional languages (e.g. German, Spanish) | 🟡 Future   | Factorial (multi-lang) | European market expansion                                     |

---

## Payroll and benefits (out of scope)

| Feature                | Status          | Competitor coverage | Notes                         |
| ---------------------- | --------------- | ------------------- | ----------------------------- |
| Payroll enrollment     | ⚪ Out of scope | Rippling, Gusto     | Core HRIS / payroll territory |
| Benefits enrollment    | ⚪ Out of scope | Rippling, GoCo      | HRIS territory                |
| Final paycheck trigger | ⚪ Out of scope | Rippling            | Payroll system responsibility |
| Time tracking          | ⚪ Out of scope | Factorial, Rippling | Outside lifecycle automation  |
| Performance management | ⚪ Out of scope | Leapsome, Factorial | Different product category    |
| Recruitment / ATS      | ⚪ Out of scope | Rippling            | Different product category    |

---

## Summary counts

| Status          | Count   |
| --------------- | ------- |
| 🟢 MVP          | 29      |
| 🔵 Post-MVP     | 42      |
| 🟡 Future       | 61      |
| ⚪ Out of scope | 10      |
| **Total**       | **142** |
