# Architecture Decision Records

Decisions are immutable. To change a decision, create a new ADR that supersedes it and update the old one's status.

Template: [0000-adr-template.md](0000-adr-template.md)

## Index

| ADR                                               | Title                                                                  | Status                      |
| ------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------- |
| [0001](0001-monorepo-structure.md)                | Monorepo with pnpm Workspaces and Turborepo                            | accepted                    |
| [0002](0002-frontend-stack.md)                    | Frontend Stack                                                         | partially superseded (0021) |
| [0003](0003-backend-stack.md)                     | Backend Stack                                                          | accepted                    |
| [0004](0004-database.md)                          | Database                                                               | accepted                    |
| [0005](0005-multi-tenancy.md)                     | Multi-Tenancy Strategy                                                 | accepted                    |
| [0006](0006-job-queue.md)                         | Job Queue                                                              | accepted                    |
| [0007](0007-auth.md)                              | Authentication                                                         | accepted                    |
| [0008](0008-deployment.md)                        | Deployment and Infrastructure                                          | accepted                    |
| [0009](0009-ci-cd.md)                             | CI/CD and Code Quality                                                 | partially superseded (0020) |
| [0010](0010-observability.md)                     | Observability                                                          | accepted                    |
| [0011](0011-email.md)                             | Transactional Email                                                    | accepted                    |
| [0012](0012-row-level-security-implementation.md) | Row-Level Security Implementation Mechanism                            | accepted                    |
| [0013](0013-trunk-based-single-environment.md)    | Trunk-Based Development, Single Environment                            | accepted                    |
| [0014](0014-multi-organization-user-accounts.md)  | Multi-Organization User Accounts via Better Auth's Organization Plugin | accepted                    |
| [0015](0015-trial-and-subscription-state.md)      | Trial and Subscription State Model                                     | accepted                    |
| [0016](0016-multilingual-ui.md)                   | Multilingual UI (English, Russian, Hebrew)                             | accepted                    |
| [0017](0017-sequential-phases-parallel-steps.md)  | Sequential Phases with Parallel Steps                                  | partially superseded (0019) |
| [0018](0018-automated-action-registry.md)         | Automated Action Registry for Workflow Steps                           | accepted                    |
| [0019](0019-phase-level-dependencies.md)          | Phase-Level Dependencies                                               | accepted                    |
| [0020](0020-ssh-commit-signing.md)                | SSH Commit Signing (not GPG)                                           | accepted                    |
| [0021](0021-plain-tailwind-ui-components.md)      | Plain Tailwind Instead of Shadcn/vue for UI Components                 | accepted                    |
