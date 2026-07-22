import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { auth } from './auth.js'
import { runTrialLifecycleScan } from './jobs/trial-lifecycle-scan.js'
import { queue, startQueue, stopQueue } from './queue/index.js'
import { activityRouter } from './routes/activity.js'
import { billingRouter } from './routes/billing.js'
import { invitesRouter } from './routes/invites.js'
import { onboardRouter } from './routes/onboard.js'
import { runsRouter } from './routes/runs.js'
import { tasksRouter } from './routes/tasks.js'
import { workflowsRouter } from './routes/workflows.js'

// Daily scan handling both the 3-day trial-reminder email and flipping
// expired trials to status: 'expired' — see apps/api/src/jobs/trial-lifecycle-scan.ts
// and ADR-0015. 13:00 UTC avoids landing the reminder email in the middle
// of any single timezone's night for most of the customer base.
const TRIAL_LIFECYCLE_SCAN_CRON = '0 13 * * *'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

app.on(['GET', 'POST'], '/api/auth/**', (c) => auth.handler(c.req.raw))

app.route('/api/onboard', onboardRouter)
app.route('/api/invites', invitesRouter)
app.route('/api/billing', billingRouter)
app.route('/api/workflows', workflowsRouter)
app.route('/api/runs', runsRouter)
app.route('/api/tasks', tasksRouter)
app.route('/api/activity', activityRouter)

app.use('/*', serveStatic({ root: './public' }))
app.use('/*', serveStatic({ path: './public/index.html' }))

export { app }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) })

  await startQueue()
  queue.process('trial-lifecycle-scan', () => runTrialLifecycleScan())
  await queue.schedule('trial-lifecycle-scan', TRIAL_LIFECYCLE_SCAN_CRON)

  const shutdown = async () => {
    await stopQueue()
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown())
  process.on('SIGINT', () => void shutdown())
}
