import { Hono } from 'hono'
import { withTenant } from '../db/index.js'
import { requireAdmin } from '../lib/session.js'

const RECENT_EVENT_LIMIT = 20

export const activityRouter = new Hono()

activityRouter.get('/', async (c) => {
  const session = await requireAdmin(c)
  if (!session) {
    return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
  }

  // No explicit organizationId filter: RLS (run_tenant_isolation /
  // run_step_tenant_isolation) already scopes both queries to
  // session.organizationId via withTenant's set_config.
  const { runs, steps } = await withTenant(session.organizationId, async (tx) => ({
    runs: await tx.query.run.findMany(),
    steps: await tx.query.runStep.findMany({
      columns: { runId: true, title: true, status: true, completedAt: true },
    }),
  }))

  const runsById = new Map(runs.map((r) => [r.id, r]))

  const events: {
    type: 'run_started' | 'run_completed' | 'step_completed'
    at: string
    runId: string
    runType: string
    employeeName: string
    stepTitle?: string
  }[] = []

  for (const r of runs) {
    events.push({
      type: 'run_started',
      at: r.createdAt.toISOString(),
      runId: r.id,
      runType: r.type,
      employeeName: r.employeeName,
    })
    if (r.status === 'completed') {
      events.push({
        type: 'run_completed',
        at: r.updatedAt.toISOString(),
        runId: r.id,
        runType: r.type,
        employeeName: r.employeeName,
      })
    }
  }

  for (const step of steps) {
    if (step.status !== 'completed' || !step.completedAt) {
      continue
    }
    const parentRun = runsById.get(step.runId)
    if (!parentRun) {
      continue
    }
    events.push({
      type: 'step_completed',
      at: step.completedAt.toISOString(),
      runId: parentRun.id,
      runType: parentRun.type,
      employeeName: parentRun.employeeName,
      stepTitle: step.title,
    })
  }

  events.sort((a, b) => b.at.localeCompare(a.at))

  return c.json({ events: events.slice(0, RECENT_EVENT_LIMIT) })
})
