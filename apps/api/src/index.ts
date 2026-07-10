import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { auth } from './auth.js'
import { invitesRouter } from './routes/invites.js'
import { onboardRouter } from './routes/onboard.js'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

app.on(['GET', 'POST'], '/api/auth/**', (c) => auth.handler(c.req.raw))

app.route('/api/onboard', onboardRouter)
app.route('/api/invites', invitesRouter)

app.use('/*', serveStatic({ root: './public' }))
app.use('/*', serveStatic({ path: './public/index.html' }))

export { app }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) })
}
