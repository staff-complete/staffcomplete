# ADR-0022: Log Structured JSON to stdout, Defer the Self-Hosted Observability Stack

- **Status:** accepted
- **Date:** 2026-07-31

## Context

ADR-0010 decided the full self-hosted stack: **Pino** for structured logging,
**Loki** for aggregation, **Grafana** for dashboards, **Grafana Faro** for
frontend error tracking — all running on the Hetzner VPS. Its reasoning
against hosted vendors (data leaves our infrastructure) and against
self-hosted Sentry (4GB+ RAM) still holds and is not revisited here.

None of it was ever built. Five weeks on, the actual state is:

- Nine `console.error`/`console.log` calls across `apps/api/src`, all
  unstructured single-line strings.
- Zero observability dependencies — no `pino`, no Faro SDK, nothing in any
  `package.json`.
- No logging configuration in `config/deploy.yml`.

So the decision record claims an operational capability the project does not
have, which is worse than either building it or scoping it down: someone
reading ADR-0010 would reasonably assume they can go query logs in Grafana
during an incident.

The cost side has also become clearer. Loki + Grafana + Faro are three more
services to size, secure, upgrade, and keep running on a **single** box that
already hosts the app, Postgres, and Traefik (ADR-0008), with no staging
environment to test changes against (ADR-0013). The product is pre-revenue
and trial-only — issues #44–#47 (subscriptions) are still open — so there is
currently no production traffic whose failures need historical querying.

## Decision

Log **structured JSON to stdout** and let Docker capture it. Nothing else.

- Adopt **Pino** in `apps/api` — pretty-printed in development, JSON in
  production — replacing the ad hoc `console.*` calls. This is the half of
  ADR-0010 that carries its own weight: levels, a real error serializer, and
  fields that can be filtered on, rather than concatenated strings.
- Read logs with `kamal app logs` / `docker logs`. No aggregation layer.
- **Do not** deploy Loki, Grafana, or Faro. Frontend errors remain
  uninstrumented for now.

**Alternatives considered:**

- _Build ADR-0010 as written._ Rejected for now on cost, not on merit — it is
  the right destination, just not while there are no paying customers and no
  production incidents to investigate. The revisit trigger below is when that
  changes.
- _Keep `console.error`._ Rejected: unstructured strings can't be filtered by
  level or correlated across a request, and moving to Pino later is a
  mechanical change now but a large one once call sites multiply.
- _A hosted platform._ Already rejected by ADR-0010 on data-residency
  grounds; nothing has changed.

**Revisit trigger:** the first paying customer (issue #45 closing), or the
first production incident where reading `docker logs` is not enough to answer
what happened. Either one reopens the Loki/Grafana half of ADR-0010.

## Consequences

- Log history is bounded by Docker's retention on the box, and is lost when a
  container is replaced — including on every deploy, which is every merge to
  `main` (ADR-0013). Anything needed beyond that window must be captured at
  the time.
- No dashboards, no alerting, and no query language. Investigating an
  incident means SSH plus `grep`.
- **Frontend errors are not captured at all.** A Vue exception in a
  customer's browser is invisible to us. This is the sharpest edge of this
  decision and the most likely reason to revisit early.
- Structured JSON on stdout is the input format Loki wants anyway, so
  adopting Pino now is not throwaway work — the deferred half plugs in behind
  it without changing call sites.
- ADR-0010 is superseded only in scope. Its vendor analysis stands, and the
  stack it names is still the intended destination.
