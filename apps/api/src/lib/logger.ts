import { pino } from 'pino'

// Structured JSON to stdout, captured by Docker — ADR-0022. There is no
// aggregation layer: `kamal app logs` / `docker logs` is how these are read,
// so the fields below are what a future incident has to work with.
//
// Pretty-printed in development only. pino-pretty is a devDependency, so
// referencing it in production would throw at startup — hence the guard
// rather than an unconditional transport.
const isProduction = process.env.NODE_ENV === 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  // `err.message`/`err.stack` rather than the `{}` that JSON.stringify gives
  // an Error — the single most common way structured logs lose the thing you
  // actually needed.
  formatters: {
    level: (label) => ({ level: label }),
  },
  transport: isProduction ? undefined : { target: 'pino-pretty', options: { colorize: true } },
})

/**
 * Child logger tagged with the component it came from, so `docker logs`
 * output can be filtered without guessing from message text — e.g.
 * `... | jq 'select(.component == "trial-lifecycle-scan")'`.
 */
export function componentLogger(component: string) {
  return logger.child({ component })
}
