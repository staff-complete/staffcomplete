# Pricing Model

Analysis of competitor pricing, value delivered, and recommended pricing structure
for StaffComplete targeting 30–150 employee companies.

---

## 1. Competitor pricing landscape

| Product       | Model             | 30 employees          | 50 employees | 100 employees | Notes                         |
| ------------- | ----------------- | --------------------- | ------------ | ------------- | ----------------------------- |
| **Camino**    | Per journey       | ~$83/mo (flat $1K/yr) | ~$83/mo      | ~$83–300/mo   | $150/journey after 10         |
| **Sapling**   | Per employee      | $1,200/mo             | $2,000/mo    | $4,000/mo     | ~$40/emp/mo; enterprise-grade |
| **Factorial** | Per employee      | $240/mo               | $400/mo      | $800/mo       | ~$8/emp/mo; full HRIS suite   |
| **BambooHR**  | Per employee      | $300/mo               | $500/mo      | $1,000/mo     | ~$10/emp/mo; dominant HRIS    |
| **GoCo**      | Per user          | $1,470/mo             | $2,450/mo    | $4,900/mo     | $49/user/mo; self-eliminates  |
| **n8n / DIY** | Free (infra cost) | ~$20/mo               | ~$20/mo      | ~$20/mo       | Requires engineer time        |

**Key observations:**

- **The floor is near-free.** n8n/Google Sheets DIY costs almost nothing. Any price must clear this
  anchoring clearly enough that the HR buyer doesn't default back to spreadsheets.
- **Camino's ceiling is ~$300/mo** for companies with high turnover. Above that, sticker shock.
- **BambooHR at $10/emp/mo is the market's accepted benchmark** for "a proper HR tool." HR
  buyers have already approved this budget. An automation add-on at 20–40% of that is defensible.
- **Sapling and GoCo price themselves out of the segment.** Their pricing confirms there is a
  gap — nobody charges $5–15/mo total for pure lifecycle automation in this segment.
- **Factorial at $8/emp/mo is for a full HRIS.** StaffComplete as an add-on to an existing HRIS
  cannot be priced close to or above the HRIS itself.

---

## 2. Value delivered — what StaffComplete actually saves

### Time savings per lifecycle event

| Task automated                                  | HR time saved | IT time saved | Employee delay avoided |
| ----------------------------------------------- | ------------- | ------------- | ---------------------- |
| Google Workspace account creation               | 0 min (HR)    | 30 min (IT)   | Same-day vs next-day   |
| Google group / shared drive access              | 5 min (HR)    | 20 min (IT)   | —                      |
| Slack workspace + channels                      | 5 min (HR)    | —             | —                      |
| Manual task assignment + follow-up              | 30 min (HR)   | —             | —                      |
| Offboarding: access revocation across 5 tools   | 60 min (HR)   | 30 min (IT)   | —                      |
| **Total per event (onboarding or offboarding)** | **~100 min**  | **~80 min**   | **~4 hours**           |

### Annual value for a 50-person company

Assumptions: 10 hires/year, 5 offboards/year → 15 lifecycle events.

| Value category                                         | Calculation                          | Annual value     |
| ------------------------------------------------------ | ------------------------------------ | ---------------- |
| HR time saved                                          | 100 min × 15 events × $40/hr HR rate | $1,000           |
| IT time saved                                          | 80 min × 15 events × $60/hr IT rate  | $1,200           |
| New hire productivity (day-1 access)                   | 0.5 lost days × 10 hires × $200/day  | $1,000           |
| Security risk avoided (1 lingering access incident/yr) | Expected loss × probability          | $500–$5,000      |
| **Tangible total (conservative)**                      |                                      | **~$3,700/year** |

A product priced at $1,200–2,400/year delivers a 1.5–3× ROI before factoring in security risk.
Security incidents (one contractor account not revoked, one phishing event) rapidly push ROI to 5–10×.

### Annual value for a 100-person company

Assumptions: 20 hires/year, 10 offboards/year → 30 lifecycle events.

| Value category                        | Calculation                    | Annual value     |
| ------------------------------------- | ------------------------------ | ---------------- |
| HR time saved                         | 100 min × 30 events × $40/hr   | $2,000           |
| IT time saved                         | 80 min × 30 events × $60/hr    | $2,400           |
| New hire productivity                 | 0.5 days × 20 hires × $200/day | $2,000           |
| Security risk (scales with headcount) |                                | $1,000–$10,000   |
| **Tangible total (conservative)**     |                                | **~$7,400/year** |

A product priced at $2,400–3,600/year delivers 2–3× ROI at this headcount.

---

## 3. Pricing model options

### Option A — Per-employee (current landing page)

`$3/emp/mo (Starter) · $6/emp/mo (Growth)`

|                        |                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pros**               | Scales naturally with company size; familiar to HR buyers                                                                                            |
| **Cons**               | Feels punitive as headcount grows; adds friction at renewal when hiring spikes; buyers think "I'm paying per person" not "I'm paying for automation" |
| **30-person company**  | $90/mo → accessible but signals low value                                                                                                            |
| **100-person company** | $600/mo → defensible but large jump from 50-person                                                                                                   |

At $3/emp/mo for 30 employees, the price is $90/mo — so low it raises doubt about the product's
quality. HR tools in this segment (BambooHR, Factorial) start at $8–10/emp/mo and are perceived
as credible. A $3 price on the landing page sets an anchor that undercuts the brand.

### Option B — Flat tiers by headcount band (recommended)

Fixed monthly price for a headcount range. Company pays the same whether they hire 2 people
this month or 8.

| Tier        | Headcount           | Monthly | Annual (2 months free) |
| ----------- | ------------------- | ------- | ---------------------- |
| **Starter** | Up to 50 employees  | $149/mo | $1,490/yr              |
| **Growth**  | Up to 150 employees | $349/mo | $3,490/yr              |
| **Custom**  | 150+ employees      | Custom  | Custom                 |

Effective per-employee rate:

- Starter: $3.0–5.0/emp/mo depending on actual headcount (50-person: $3, 30-person: $5)
- Growth: $2.3–7.0/emp/mo (150-person: $2.3, 50-person: $7)

This model is **defensible to the buyer** ("one flat fee, no surprises"), aligns with the
"predictable flat-fee pricing" win feature in MVP docs, and avoids the low-signal $3/emp number
appearing on the landing page.

### Option C — Per-run (per lifecycle event)

`$25/onboarding · $15/offboarding · $49/mo platform fee`

|                                     |                                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Pros**                            | Perfect value alignment — pay only when you hire/offboard                                                                   |
| **Cons**                            | Creates hesitation at trigger time ("should I run this?"); unpredictable budget; hard to explain; buyers hate variable SaaS |
| **50-person company, 15 events/yr** | $49×12 + $375 = $963/yr                                                                                                     |

Not recommended for v1. Too much cognitive overhead at point of use.

### Option D — Annual only (no monthly)

Force annual billing to improve cash flow and reduce churn.

|          |                                                                             |
| -------- | --------------------------------------------------------------------------- |
| **Pros** | Revenue predictability; commitment locks in the relationship                |
| **Cons** | Increases purchase friction significantly; SMBs prefer monthly to try first |

Not recommended as the only option. Annual should be offered as a discount, not forced.

---

## 4. Recommended model

**Flat tiers, monthly or annual, with a 14-day free trial.**

### Tier structure

|                     | Starter                  | Growth               | Custom                |
| ------------------- | ------------------------ | -------------------- | --------------------- |
| **Price (monthly)** | $149/mo                  | $349/mo              | Talk to us            |
| **Price (annual)**  | $1,490/yr (~$124/mo)     | $3,490/yr (~$290/mo) | Negotiated            |
| **Headcount**       | Up to 50 employees       | Up to 150 employees  | 150+                  |
| **Integrations**    | Google Workspace + Slack | All integrations     | All + custom          |
| **Triggers**        | Manual + 1 HRIS          | Manual + all HRIS    | All triggers          |
| **Audit log**       | 90 days                  | Full history         | Full history + export |
| **Support**         | Email                    | Priority email       | Dedicated             |
| **CTA**             | Start free trial         | Start free trial     | Talk to us            |

**What changes from the current landing page:**

- Drop per-employee language ($3/$6) → replace with flat monthly ($149/$349)
- Starter features: add "1 HRIS integration" (BambooHR or HiBob, one of them)
- Growth features: add "All HRIS integrations" and "role change workflows"
- Keep "Most Popular" badge on Growth (the 50–150 segment is the core ICP)

### Annual discount framing

Monthly pricing shown by default. Annual toggle shows:

- "Save 2 months — $1,490/yr" (Starter)
- "Save 2 months — $3,490/yr" (Growth)

Do not say "16% off" — it sounds small. "2 months free" sounds like real money.

### Free trial

- 14 days, no card required
- Full access to Growth tier features (maximises aha moment)
- After trial: pick a plan or downgrade
- This is a standard B2B SaaS trial structure that converts well with HR buyers

---

## 5. Competitive anchoring

How to contextualise the price on the landing page or in sales conversations:

| Comparison       | Framing                                                                             |
| ---------------- | ----------------------------------------------------------------------------------- |
| vs Sapling       | "Same features. 10× lower price." ($40/emp vs ~$3-5/emp effective)                  |
| vs Camino        | "Google Workspace provisioning included. Offboarding included. Same price."         |
| vs BambooHR      | "BambooHR is your HRIS. StaffComplete is what happens next — at 20% of the cost."   |
| vs Google Sheet  | "Less than one hour of HR time per month. Every month."                             |
| vs doing nothing | "One unrevoked contractor account is worth more than three years of StaffComplete." |

---

## 6. Pricing page psychology

- **Lead with the value, not the number.** "Onboard your next hire in 4 minutes" before "$149/mo."
- **Show the number without /employee.** Flat price ($149) anchors better than $3/emp when the
  buyer might do the wrong math ($3 × 150 = $450 in their head).
- **Annual as default toggle.** Most SaaS pages default to annual toggle. Effective monthly rate
  of $124 looks much better than $149.
- **ROI callout below the tiers.** "The average StaffComplete customer saves 6 hours per hire.
  At your size, that's 90+ hours a year recovered." Makes the cost feel trivial.
- **No hidden fees.** Explicitly call out: no per-run fees, no integration fees, no overage.

---

## 7. What needs to change

### Landing page (PricingSection.vue)

| Field               | Current                       | Recommended                                      |
| ------------------- | ----------------------------- | ------------------------------------------------ |
| Starter price       | $3/employee/mo                | $149/mo                                          |
| Starter priceNote   | /employee/mo                  | (remove)                                         |
| Starter billingNote | Billed annually               | Billed monthly · save 2 months annually          |
| Starter tagline     | For teams up to 50 employees  | Up to 50 employees                               |
| Growth price        | $6/employee/mo                | $349/mo                                          |
| Growth tagline      | For teams of 50–150 employees | Up to 150 employees                              |
| Heading             | Simple, per-employee pricing  | Simple, predictable pricing                      |
| Subtext             | No seat licenses…             | One flat fee. No per-hire charges. No surprises. |

### Starter features (replace current)

- Google Workspace + Slack integrations
- Onboarding and offboarding workflows
- Manual task fallback with due dates
- 1 HRIS trigger (BambooHR or HiBob)
- Audit log (90 days)
- Email support

### Growth features (replace current)

- Everything in Starter
- All HRIS integrations
- All integrations (GitHub, Jira, Notion and more)
- Role and team change workflows
- Full audit log + CSV export
- Priority support

---

## 8. Open questions

- **Free plan?** Camino has no free tier. n8n is the free option. A free tier risks commoditising
  the product before establishing the brand. Not recommended for v1. Free trial is enough.
- **Per-seat admin pricing?** Some tools charge per HR admin seat on top of the employee price.
  Avoid — adds complexity, reduces conversion. Include unlimited HR admin seats.
- **Overage on headcount?** If a Starter customer grows past 50 employees, auto-upgrade or
  notify? Recommend: notify at 45 employees, auto-upgrade at 55. Not a hard block.
- **Non-profit or startup discount?** Possible but defer until after launch. Address via Custom tier.
