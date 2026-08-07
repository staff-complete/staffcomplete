---
name: codemap
description: Check whether docs/codemap/ is current, query it for a module's callers, dependents and tests before changing code, and regenerate codemap.html + codemap.json + codemap.lock together when it is stale or when module boundaries, dependencies, routes, databases, queues, or data flows change. Use at the start of any code-changing task and before modifying any module.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# Skill: codemap

`docs/codemap/` is the repo's architectural map: what the modules are, what calls
what, and which tests cover each one. It is only useful if it is trustworthy, so
it is checked before code changes and regenerated as part of the same commit that
changes structure.

Three files, always generated together from one commit:

| File           | Purpose                                                               |
| -------------- | --------------------------------------------------------------------- |
| `codemap.json` | The graph — nodes, edges, flows, with source evidence for every claim |
| `codemap.html` | Self-contained interactive viewer; embeds `codemap.json` verbatim     |
| `codemap.lock` | Commit, working-tree state, and a fingerprint per top-level module    |

**Never hand-edit one alone.** They are a set; a partial edit silently desyncs them.

---

## 1. Is the map current?

```sh
./.claude/hooks/codemap-status.sh
```

Fast (~0.06s). Prints `current`, `STALE — drifted since <commit>: <modules>`, or a
missing-file warning. This also runs automatically at session start.

It recomputes each module's fingerprint — sha256 over sorted `<path>\0<git blob
sha1>` records for that module's tracked files — and compares against
`codemap.lock`. Tracked files only: a brand-new untracked file does not register
as drift until it is added.

---

## 2. Before modifying a module

Answer three questions from `codemap.json` first. Do not skip this because the
change looks small — the point is to find the callers you did not know about.

**Find the node** covering the file you are about to touch (match `path` or
`grouped_files`):

```sh
jq -r --arg f "apps/api/src/lib/run-steps.ts" \
  '.nodes[] | select(.path == $f or (.grouped_files // [])[] == $f) | .id' \
  docs/codemap/codemap.json
```

**1. What calls it?** (upstream — who breaks if you change the contract)

```sh
jq -r --arg id "api-run-steps" \
  '.edges[] | select(.to == $id) | "\(.from) --\(.type)--> \(.to)   [\(.evidence.path):\(.evidence.line)]"' \
  docs/codemap/codemap.json
```

**2. What does it affect?** (downstream + the flows it sits on)

```sh
jq -r --arg id "api-run-steps" \
  '.edges[] | select(.from == $id) | "\(.from) --\(.type)--> \(.to)   [\(.evidence.path):\(.evidence.line)]"' \
  docs/codemap/codemap.json

jq -r --arg id "api-run-steps" \
  '.flows[] | select(.steps | index($id)) | "\(.name)\n  trigger: \(.trigger)\n  outcome: \(.outcome)"' \
  docs/codemap/codemap.json
```

**3. Which tests cover it?**

```sh
jq -r --arg id "api-run-steps" \
  '.nodes[] | select(.id == $id) | .tests[]' docs/codemap/codemap.json
```

Also read that node's `constraints` — they record invariants that are not obvious
from the code (transaction ordering, RLS scoping, idempotency guarantees):

```sh
jq -r --arg id "api-run-steps" \
  '.nodes[] | select(.id == $id) | .constraints[]' docs/codemap/codemap.json
```

**If the map is stale, or cannot answer these three questions for the module you
are about to touch, regenerate it before changing the code.** A map that answers
confidently but wrongly is worse than no map.

Opening the viewer is often faster than jq for orientation — clicking a module
shows callers, dependents, tests, flows and constraints in one panel:

```sh
open docs/codemap/codemap.html   # or: xdg-open / just open the file in a browser
```

---

## 3. When to regenerate

Regenerate **in the same commit as the code change** whenever the change touches:

- module boundaries (a new module, a split, a merge, a moved responsibility)
- dependencies between modules (a new import/call edge, or one removed)
- routes (a router added, removed, or remounted in `apps/api/src/index.ts`)
- databases (new table, new RLS policy, a change to the connection/tenancy model)
- queues (a new job, a new handler, a schedule change)
- major data flows (anything that changes one of the mapped end-to-end flows)

Pure edits inside an existing module that change none of the above — a bug fix, a
refactor with the same edges, a copy change — do **not** require regeneration. The
fingerprint will drift, and that is expected; refresh the map the next time you
touch structure, or regenerate to clear the noise.

---

## 4. Regenerating

All three files, from the current commit, in one pass.

### Gather evidence

Scope is `apps/api`, `apps/web`, `packages/shared`. Exclude `node_modules`,
`dist`, `build`, `coverage`, `.turbo`. Use `git ls-files` so untracked and
git-ignored files are never scanned.

Read the real wiring — do not infer it:

- `apps/api/src/index.ts` — every `app.route(...)` mount, queue `process`/`schedule` registration
- each `apps/api/src/routes/*.ts` — router export, `orgAuth(...)` usage, `withTenant` calls
- `apps/api/src/db/index.ts` and `schema.ts` — the two pools, `withTenant`, RLS policies
- `apps/api/src/queue/` — the `Queue` implementation and its connection
- `apps/api/src/jobs/` — handlers and what enqueues them
- `packages/shared/src/index.ts` — the public contract surface
- `apps/web/src/composables/` — which endpoint each one calls

### Node rules

- **Max 20 primary nodes.** Group low-level files under their parent module via
  `grouped_files` rather than adding nodes.
- Every node needs: `id`, `path`, `role`, `entrypoints`, `tests`, `constraints`,
  `evidence`. Attach a real source path **and** symbol to each entrypoint and
  evidence item.
- `role` drives the viewer's colour coding: `frontend`, `shared`, `api`, `route`,
  `worker`, `data`, `queue`, `external`.

### Edge rules

- `type` is exactly one of: `imports`, `calls`, `reads`, `writes`, `publishes`,
  `subscribes`.
- Every edge carries `evidence` with `path`, `symbol`, `line`.
- **Do not guess.** A relationship you cannot point at in source is marked
  `unknown`, not asserted.

### Flow rules

3–5 end-to-end flows, each with `trigger`, `steps`, `outcome`. Every step must be
an existing node `id`.

### Lock rules

Record commit, working-tree dirty state, generation time, scanned scope, excluded
directories, the fingerprint algorithm, and a fingerprint per top-level module.
Fingerprint = sha256 over sorted `<path>\0<git blob sha1>` records:

```sh
for f in $(git ls-files "$mod" | grep -vE '(^|/)(node_modules|dist|build|coverage|\.turbo)/' | sort); do
  printf '%s\0%s\n' "$f" "$(git hash-object "$f")"
done | sha256sum
```

### Keep HTML and JSON in sync

`codemap.html` must embed `codemap.json` **verbatim** in a
`<script id="cm-data" type="application/json">` block and build its graph from it.
That makes divergence structurally impossible. Re-inject after any JSON change
(escape `</` as `<\/` so the block cannot be closed early):

```sh
node -e '
const fs=require("fs"), p="docs/codemap/codemap.html";
let h=fs.readFileSync(p,"utf8");
const j=fs.readFileSync("docs/codemap/codemap.json","utf8").trim();
h=h.replace(/(<script id="cm-data" type="application\/json">)([\s\S]*?)(<\/script>)/,
  (m,a,_b,c)=>a+"\n"+j.replace(/<\//g,"<\\/")+"\n"+c);
fs.writeFileSync(p,h);'
```

The viewer must stay **fully self-contained** — no CDN scripts, external
stylesheets, fonts, or remote images. Dark theme by default; boundaries and the
main flows visible on the first screen; search, type filters, zoom, pan and node
drag; clicking a module highlights upstream callers, downstream dependencies,
related tests and its flows; selecting a flow highlights the whole path.

---

## 5. Verify before committing

Do not report the map as regenerated until all of this passes:

- `codemap.json` parses
- every node `path`, `grouped_files` entry and `tests` entry exists on disk
- every evidence `symbol` is findable in its `path`, and the `line` is accurate
- every edge `from`/`to` and every flow step references an existing node id
- every edge `type` is one of the six allowed values
- `codemap.html`'s embedded data deep-equals `codemap.json`
- the HTML has no external references and its inline JS passes `node --check`
- `codemap.lock` matches the current commit, working-tree state and fingerprints
- every relationship without source evidence is marked `unknown`

Then run the repo's own checks — the map lives in the tree and CI lints it:

```sh
pnpm cspell && pnpm format:check
```

cspell rejects British spellings (`colour`, `neighbour`, `minimise`) and coined
identifiers; oxfmt reformats both the JSON and the HTML, so re-run the sync step
above if the formatter touches `codemap.json` after you inject it.

---

## Notes

- The map describes **structure**, not history. It is regenerated, never patched
  to reflect a change that has not happened yet.
- `postgres` and `resend` are external nodes with no tracked module; they are
  anchored to the connection/call site that proves they exist and listed under
  `external_nodes` in the lock.
- Commit the three files together with the code change, in one commit. Conventional
  Commits type is whatever the code change is (`feat`, `refactor`, …) — the map is
  part of that change, not a separate `docs:` commit.
