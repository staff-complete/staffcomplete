# StaffComplete

Employee lifecycle management — onboarding, offboarding, and the access changes around them,
coordinated across the HR and IT tools an organization already uses.

This is the ubiquitous language. Terms here are canonical: code, UI copy, and docs use these
words and not their synonyms. This file is a glossary — no implementation detail, no specs.

Maintained with the `domain-modeling` skill.

## Organizations and people

**Organization**:
A customer company using StaffComplete. The unit of tenancy — every piece of data belongs to
exactly one.
_Avoid_: company, workspace, account, tenant (as an entity — see Tenant)

**Tenant**:
The isolation concept, not a thing you can point at. An Organization is what a tenant _is_;
"tenant" describes the boundary between them.
_Avoid_: using interchangeably with Organization when naming data

**User**:
A person with a StaffComplete login. One user may belong to several organizations.
_Avoid_: account, profile

**Member**:
A user's membership in one organization, carrying their role there: owner, admin, or member.
The same user is a separate member in each organization they belong to.
_Avoid_: seat, participant

**Invitation**:
A pending offer for someone to join an organization at a given role. Expires if unused.
_Avoid_: invite request

**Employee**:
The person a run is about — a new hire being onboarded or someone leaving. Employees are
subjects of the process, not users of the product: they have no login and no membership.
_Avoid_: staff member, hire, worker

## Subscription

**Trial**:
The 30-day period an organization gets on first login, after which it must subscribe to keep
creating templates and runs.
_Avoid_: free tier, evaluation

**Subscription**:
An organization's paid standing: trialing, active, expired, or canceled.
_Avoid_: plan (the plan is one field of it), billing account

## Checklists and runs

**Checklist Template**:
A reusable checklist an organization builds up-front, for either onboarding or offboarding,
and launches runs from.
_Avoid_: workflow, workflow template, playbook, process
_In code_: the SQL tables are still named `workflow_template*`, mapped to the current name
by Drizzle. Nothing above the schema uses the old word.

**Phase**:
A named stage within a template or run. Steps in a phase can happen in parallel; a phase opens
only once the phases it depends on are done.
_Avoid_: stage, group, section

**Phase Dependency**:
A "this phase can't start until that one finishes" link between two phases. Order comes from
these links, not from how phases are arranged on screen.
_Avoid_: blocker, prerequisite, ordering

**Step**:
One unit of work inside a phase. Either manual or automated.
_Avoid_: item, action (reserved — see Automated Action), todo

**Manual Step**:
A step a person does themselves, assigned to a member and optionally due a set number of days
from the event date.
_Avoid_: human step

**Automated Step**:
A step the system performs by running an automated action, with no person involved.
_Avoid_: system step, bot step

**Automated Action**:
The specific thing an automated step performs, chosen from a fixed registry of supported
actions. Today the registry holds one: sending an email.
_Avoid_: integration, handler, automation

**Integration**:
The connection to one external SaaS tool — Slack, Google Workspace, GitHub — that automated
actions reach the outside world through. One integration per tool, however many actions use
it. An Automated Action is what the checklist asks for; the Integration is what performs it.
_Avoid_: connector, plugin, provider
_Status_: none built yet. The only external service called today is the email provider, from
the auth module.

**Automation Token**:
A placeholder such as `[employeeName]` written into an automated action's configuration and
replaced with the run's real values when the step executes.
_Avoid_: variable, merge field, interpolation

**Run**:
One execution of a checklist template for one employee, from launch to completion. A run copies
the template's phases and steps when it starts, so later edits to the template never rewrite
history.
_Avoid_: instance, execution, case, job

**Event Date**:
The date a run is anchored to — an onboarding's start date, or an offboarding's last working
day. Manual step due dates are counted from it.
_Avoid_: start date, deadline

**Task**:
A manual step of a live run, seen from the point of view of the person responsible for it.
The same thing as a Manual Step, named for the assignee's view of it — never a separate
record. Where the data model needs the noun, it is Manual Step.
_Avoid_: assignment, todo

**Activity**:
The recent history of a run — steps completed and runs started — shown as a feed.
_Avoid_: audit log, timeline, events

## Lifecycle events

**Onboarding**:
Bringing a new employee in: the accounts, access, and introductions they need before and
around their start date.

**Offboarding**:
Taking a departing employee out: revoking access and recovering property around their last
working day.

**Role Change**:
An existing employee moving to a different role, with the access changes that implies.
_Status_: named in the domain model but not yet built — no template type or run supports it.

## Retired terms

Words this project has deliberately stopped using. Listed so a reader meeting one in older
code or docs knows it is not a concept.

**Workflow** — never a domain term. What exists is the Checklist Template (the definition),
the Run (one execution of it), and the Automated Action (what a machine-run step performs).
Retired from the code in full; only the `workflow_template*` SQL table names still carry it,
and ADRs written before the change (0017, 0018, 0019) still use it throughout — they are
immutable and were left as written. If a workflow _engine_ is built later, that is
infrastructure and gets named then — the word is not held in reserve.
