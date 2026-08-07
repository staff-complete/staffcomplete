#!/usr/bin/env node
// Self-updating code map.
//
// Run with --check to report only. Default behaviour is to refresh
// docs/codemap/{codemap.json,codemap.html,codemap.lock} in place when the
// working tree has drifted from the lock.
//
// The split that makes this safe:
//
//   Mechanical (auto-healed): module fingerprints, the recorded commit and
//   timestamp, working-tree dirty flag, evidence line numbers that moved
//   because code shifted, and re-injecting the JSON into the HTML.
//
//   Semantic (never invented): nodes, edges, flows. A script cannot decide
//   that a new file deserves a node, or that a new import is an edge worth
//   drawing, without guessing — and a confidently wrong map is worse than a
//   stale one. When the graph itself no longer fits the tree, this refuses to
//   rewrite and reports exactly what a human or the `codemap` skill must fix.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const DIR = path.join(ROOT, 'docs/codemap')
const JSON_PATH = path.join(DIR, 'codemap.json')
const HTML_PATH = path.join(DIR, 'codemap.html')
const LOCK_PATH = path.join(DIR, 'codemap.lock')
const EXCLUDE = /(^|\/)(node_modules|dist|build|coverage|\.turbo)\//
const CHECK_ONLY = process.argv.includes('--check')

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 })

function out(msg) {
  process.stdout.write(msg + '\n')
}

// ---- guards ------------------------------------------------------------
try {
  git('rev-parse', '--git-dir')
} catch {
  process.exit(0)
}
if (!fs.existsSync(LOCK_PATH) || !fs.existsSync(JSON_PATH) || !fs.existsSync(HTML_PATH)) {
  if (fs.existsSync(DIR)) {
    out(
      'Code map: docs/codemap/ is incomplete (need codemap.json, codemap.html and codemap.lock). Generate all three with the `codemap` skill — this cannot be bootstrapped mechanically.',
    )
  }
  process.exit(0)
}

let lock, map
try {
  lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'))
  map = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'))
} catch (err) {
  out(
    'Code map: could not parse codemap.json or codemap.lock (' +
      err.message +
      '). Regenerate with the `codemap` skill.',
  )
  process.exit(0)
}

// ---- fingerprints ------------------------------------------------------
function filesIn(mod) {
  return git('ls-files', mod)
    .split('\n')
    .filter((f) => f && !EXCLUDE.test(f))
    .sort()
}
function fingerprint(files) {
  if (!files.length) return null
  const hashes = execFileSync('git', ['hash-object', '--stdin-paths'], {
    cwd: ROOT,
    input: files.join('\n') + '\n',
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })
    .split('\n')
    .filter(Boolean)
  const h = createHash('sha256')
  files.forEach((f, i) => h.update(f + '\0' + hashes[i] + '\n'))
  return 'sha256:' + h.digest('hex')
}

const modules = lock.modules.map((m) => {
  const files = filesIn(m.path)
  return { ...m, files, actual: fingerprint(files) }
})
const drifted = modules.filter((m) => m.actual !== m.fingerprint)
const head = git('rev-parse', 'HEAD').trim()
const trackedDirty =
  git('status', '--porcelain')
    .split('\n')
    .filter((l) => l && !l.startsWith('??')).length > 0

// ---- semantic integrity ------------------------------------------------
const norm = (s) => s.replace(/\s+/g, ' ').trim()
const srcCache = new Map()
function readSrc(p) {
  const abs = path.join(ROOT, p)
  if (!srcCache.has(abs)) {
    srcCache.set(
      abs,
      fs.existsSync(abs) && fs.statSync(abs).isFile() ? fs.readFileSync(abs, 'utf8') : null,
    )
  }
  return srcCache.get(abs)
}
// Does `symbol` still exist in `p`, and if so on which line?
//
// Returns {ok:false} when the symbol is gone (a semantic problem — escalate),
// otherwise {ok:true, line}. `line` is only moved when there is a confident
// better answer; when the match is ambiguous the recorded line is kept.
// Anchoring on the *first* identifier would be wrong — for a symbol like
// `app.route('/api/runs', runsRouter)` that is `app`, whose first occurrence
// is the unrelated `const app = new Hono()` many lines earlier. So the anchor
// is the *rarest* identifier in the symbol instead.
// Returns: {ok:true, line} | {ok:false}
function locate(p, symbol, recordedLine) {
  const src = readSrc(p)
  if (src === null) return { ok: true, line: null } // directory node — nothing to locate
  const lines = src.split('\n')
  const needle = norm(symbol)
  const toks = [...new Set(symbol.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || [])].filter(
    (t) => t.length >= 2,
  )

  const exists =
    norm(src).includes(needle) || (toks.length > 0 && toks.every((t) => src.includes(t)))
  if (!exists) return { ok: false }

  // rarest identifier = most distinctive anchor
  let anchor = null
  let rarest = Infinity
  for (const t of toks) {
    const n = lines.filter((l) => l.includes(t)).length
    if (n > 0 && n < rarest) {
      rarest = n
      anchor = t
    }
  }

  // If the recorded line still holds the anchor, it is right — leave it be.
  if (recordedLine && anchor) {
    for (let i = Math.max(0, recordedLine - 3); i < Math.min(lines.length, recordedLine + 2); i++) {
      if (lines[i]?.includes(anchor)) return { ok: true, line: recordedLine }
    }
  }

  // A single line containing the whole symbol is unambiguous.
  const exact = lines.findIndex((l) => norm(l).includes(needle))
  if (exact >= 0) return { ok: true, line: exact + 1 }

  // Otherwise only move when the anchor appears exactly once.
  if (anchor && rarest === 1) {
    const i = lines.findIndex((l) => l.includes(anchor))
    if (i >= 0) return { ok: true, line: i + 1 }
  }

  return { ok: true, line: recordedLine ?? null }
}

const problems = []
const lineFixes = []

// every path the map names must still exist
for (const n of map.nodes) {
  if (!fs.existsSync(path.join(ROOT, n.path)))
    problems.push(`node \`${n.id}\` path gone: ${n.path}`)
  for (const g of n.grouped_files || []) {
    if (!fs.existsSync(path.join(ROOT, g)))
      problems.push(`node \`${n.id}\` grouped file gone: ${g}`)
  }
  for (const t of n.tests) {
    if (!fs.existsSync(path.join(ROOT, t))) problems.push(`node \`${n.id}\` test gone: ${t}`)
  }
}

// every evidence symbol must still resolve; drifted lines are auto-fixed
function checkEvidence(items, label) {
  for (const e of items) {
    if (!e.path || !e.symbol) continue
    if (!fs.existsSync(path.join(ROOT, e.path))) {
      problems.push(`${label} evidence path gone: ${e.path}`)
      continue
    }
    const r = locate(e.path, e.symbol, e.line)
    if (!r.ok) {
      problems.push(`${label} evidence symbol no longer in ${e.path}: \`${e.symbol.slice(0, 60)}\``)
    } else if (r.line != null && e.line != null && Math.abs(r.line - e.line) > 2) {
      lineFixes.push({ ref: e, from: e.line, to: r.line, path: e.path })
    }
  }
}
for (const n of map.nodes) {
  checkEvidence(n.entrypoints, `node \`${n.id}\``)
  checkEvidence(n.evidence, `node \`${n.id}\``)
}
for (const e of map.edges) {
  if (e.evidence) checkEvidence([e.evidence], `edge \`${e.from}\`→\`${e.to}\``)
}

// every tracked source file in scope must be covered by some node
const coverage = new Set()
for (const n of map.nodes) {
  coverage.add(n.path)
  for (const g of n.grouped_files || []) coverage.add(g)
}
const covered = (f) =>
  [...coverage].some((c) => f === c || f.startsWith(c.replace(/\/$/, '') + '/'))
const CODE = /\.(ts|tsx|js|mjs|vue)$/
// Build/tooling config and ambient type declarations are not part of the
// module graph — they configure the build, they do not participate in it.
const NOT_A_MODULE = /(^|\/)[^/]*\.config\.[cm]?[jt]s$|\.d\.ts$/
const uncovered = []
for (const scope of map.scope) {
  for (const f of filesIn(scope)) {
    if (!CODE.test(f) || f.includes('.test.') || NOT_A_MODULE.test(f)) continue
    if (!covered(f)) uncovered.push(f)
  }
}
if (uncovered.length) {
  problems.push(
    `${uncovered.length} source file(s) no node covers: ${uncovered.slice(0, 6).join(', ')}${uncovered.length > 6 ? ', …' : ''}`,
  )
}

// ---- decide ------------------------------------------------------------
const commitStale = lock.commit !== head
const nothingToDo = !drifted.length && !commitStale && !lineFixes.length

if (problems.length) {
  out(
    'Code map: NEEDS RE-AUTHORING — the graph no longer matches the tree, so it was NOT auto-updated:',
  )
  for (const p of problems.slice(0, 8)) out('  - ' + p)
  if (problems.length > 8) out(`  - …and ${problems.length - 8} more`)
  out(
    'Nodes, edges and flows require judgment a script must not guess at. Regenerate with the `codemap` skill before relying on the map.',
  )
  process.exit(0)
}

if (nothingToDo) {
  out(
    `Code map: current as of ${lock.commit.slice(0, 7)}. Before modifying a module, use docs/codemap/codemap.json to answer: what calls it, what it affects, which tests cover it.`,
  )
  process.exit(0)
}

const summary = []
if (drifted.length) summary.push(`fingerprints: ${drifted.map((m) => m.id).join(', ')}`)
if (commitStale) summary.push(`commit ${lock.commit.slice(0, 7)} → ${head.slice(0, 7)}`)
if (lineFixes.length) summary.push(`${lineFixes.length} evidence line(s)`)

if (CHECK_ONLY) {
  out(
    `Code map: refreshable (${summary.join('; ')}). Run .claude/hooks/codemap-refresh.mjs to apply.`,
  )
  process.exit(0)
}

// ---- apply -------------------------------------------------------------
const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
for (const f of lineFixes) f.ref.line = f.to
map.generated_at = now
map.generated_from_commit = head

lock.generated_at = now
lock.commit = head
lock.commit_short = head.slice(0, 7)
try {
  lock.branch = git('rev-parse', '--abbrev-ref', 'HEAD').trim()
} catch {}
lock.working_tree_dirty = trackedDirty
lock.working_tree_note = trackedDirty
  ? 'Refreshed against a working tree with uncommitted tracked changes; fingerprints describe the files on disk, not the commit named above.'
  : 'No tracked file had uncommitted modifications at refresh time, so the fingerprints describe the commit named above exactly.'
lock.previous_lock_found = true
lock.previous_lock_note =
  'Auto-refreshed in place by .claude/hooks/codemap-refresh.mjs — derived fields only (fingerprints, commit, timestamp, evidence line numbers). Nodes, edges and flows were verified against the tree and left untouched.'
for (const m of lock.modules) {
  const found = modules.find((x) => x.path === m.path)
  if (found) {
    m.fingerprint = found.actual
    m.tracked_files = found.files.length
  }
}
if (lock.counts) {
  lock.counts.nodes = map.nodes.length
  lock.counts.edges = map.edges.length
  lock.counts.flows = map.flows.length
}

const jsonText = JSON.stringify(map, null, 2) + '\n'
fs.writeFileSync(JSON_PATH, jsonText)
fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n')

// keep the viewer's embedded copy byte-identical to the file
let html = fs.readFileSync(HTML_PATH, 'utf8')
const re = /(<script id="cm-data" type="application\/json">)([\s\S]*?)(<\/script>)/
if (!re.test(html)) {
  out(
    'Code map: refreshed JSON/lock, but codemap.html has no cm-data block to re-inject. Regenerate with the `codemap` skill.',
  )
  process.exit(0)
}
html = html.replace(
  re,
  (_m, a, _b, c) => a + '\n' + jsonText.trim().replace(/<\//g, '<\\/') + '\n' + c,
)
fs.writeFileSync(HTML_PATH, html)

// match the repo's formatter so `pnpm format:check` stays green
try {
  execFileSync(
    'pnpm',
    ['exec', 'oxfmt', 'docs/codemap/codemap.json', 'docs/codemap/codemap.html'],
    {
      cwd: ROOT,
      stdio: 'ignore',
      timeout: 20000,
    },
  )
  // oxfmt may reflow the JSON — re-inject so the two copies still match
  const reflowed = fs.readFileSync(JSON_PATH, 'utf8').trim()
  let h2 = fs.readFileSync(HTML_PATH, 'utf8')
  h2 = h2.replace(re, (_m, a, _b, c) => a + '\n' + reflowed.replace(/<\//g, '<\\/') + '\n' + c)
  fs.writeFileSync(HTML_PATH, h2)
} catch {}

out(`Code map: auto-updated (${summary.join('; ')}).`)
out(
  '  Graph verified unchanged — every node path, evidence symbol and source file still checks out, so only derived fields moved. docs/codemap/ now has uncommitted changes; commit them with your work.',
)
