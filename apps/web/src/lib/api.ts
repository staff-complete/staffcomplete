// Every API error response shares one envelope — `{ code, message }`, with a
// stable machine-readable `code` (FORBIDDEN, TRIAL_EXPIRED, PHASE_LOCKED, …)
// and a human-readable `message`. Before this, each of ~29 call sites
// re-implemented "check res.ok, parse the body, decide what to throw", and
// most of them dropped both fields on the floor.
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const FALLBACK_ERROR_CODE = 'UNKNOWN'

async function readErrorBody(res: Response): Promise<{ code: string; message: string }> {
  try {
    const body = (await res.json()) as { code?: unknown; message?: unknown }
    return {
      code: typeof body.code === 'string' ? body.code : FALLBACK_ERROR_CODE,
      message: typeof body.message === 'string' ? body.message : res.statusText,
    }
  } catch {
    // Not JSON — a proxy error page or an empty body. The status line is all
    // there is to report.
    return { code: FALLBACK_ERROR_CODE, message: res.statusText }
  }
}

/**
 * Calls the API and returns the parsed JSON body.
 *
 * Throws `ApiError` for any non-2xx response, carrying the server's own
 * `code` and `message` so callers can branch on the code (or show the
 * message) instead of inventing their own generic string.
 *
 * A network failure — no response at all — propagates as the underlying
 * `TypeError` rather than an `ApiError`, which is what lets callers tell
 * "the server said no" apart from "the server wasn't reachable" and pick
 * the right localized message for each.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // Taking `path` as a parameter trips Codacy's node-ssrf rule, which looks
  // for a URL reaching an HTTP client without passing an allowlist. SSRF is
  // a server-side attack — tricking a server into reaching internal
  // infrastructure the caller can't get to. This runs in the user's own
  // browser against their own origin, so there is no privilege to escalate:
  // anything reachable here they can already request directly. Every call
  // site passes an `/api/…` literal; none builds a path from user input.
  const res = await fetch(path, init) // nosemgrep

  if (!res.ok) {
    const { code, message } = await readErrorBody(res)
    throw new ApiError(res.status, code, message)
  }

  // 204, or any success with no body — callers typing these as void get
  // undefined rather than a JSON parse error on an empty string.
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }

  return (await res.json()) as T
}

/**
 * `apiFetch`, but a 404 is a value rather than an error — for the handful of
 * reads where "not found" is an ordinary state the UI renders (a run that
 * doesn't exist, an org with no subscription row yet) instead of a failure.
 */
export async function apiFetchOrNull<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    return await apiFetch<T>(path, init)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null
    }
    throw err
  }
}
