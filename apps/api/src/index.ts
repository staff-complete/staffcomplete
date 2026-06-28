import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

app.use('/*', serveStatic({ root: './public' }))
app.use('/*', serveStatic({ path: './public/index.html' }))

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) })
