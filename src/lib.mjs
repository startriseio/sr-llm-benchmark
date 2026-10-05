import 'dotenv/config'   // every entry point reads keys through here
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const RUNS = path.join(ROOT, 'runs')
export const RESULTS = path.join(ROOT, 'results')
export const REGISTRY = path.join(RESULTS, 'runs.json')

export const readJson = async (p) => JSON.parse(await fs.readFile(p, 'utf8'))
export const writeJson = async (p, v) => {
  await fs.mkdir(path.dirname(p), { recursive: true })
  await fs.writeFile(p, JSON.stringify(v, null, 2) + '\n')
}
export const exists = (p) => fs.access(p).then(() => true, () => false)

/* ── run history ─────────────────────────────────────────────────────────────
   Every generation session is a RUN, kept forever under runs/<runId>/. Nothing
   is overwritten between sessions, so you can re-run the same suite next month
   and compare. Scores and your human ratings are per-run too.                */

export const runDir = (runId, modelId, benchId) => path.join(RUNS, runId, modelId, benchId)
export const htmlPath = (runId, modelId, benchId) => path.join(runDir(runId, modelId, benchId), 'index.html')
export const resultsDir = (runId) => path.join(RESULTS, runId)
export const humanFile = (runId) => path.join(resultsDir(runId), 'human.json')
export const scoresFile = (runId) => path.join(resultsDir(runId), 'scores.json')
export const auditFile = (runId) => path.join(resultsDir(runId), 'judge-audit.json')

export function newRunId(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

export async function listRuns({ runsDir = RUNS, resultsRoot = RESULTS, registryFile = REGISTRY } = {}) {
  const registry = (await exists(registryFile)) ? await readJson(registryFile) : {}
  const directories = async (root) => (await exists(root))
    ? (await fs.readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name)
    : []
  const [local, publishedDirs] = await Promise.all([directories(runsDir), directories(resultsRoot)])
  // Registry entries alone can describe unfinished runs. Only discover published
  // runs with a score snapshot, while retaining every actual local run directory.
  const published = (await Promise.all(publishedDirs.map(async (id) =>
    await exists(path.join(resultsRoot, id, 'scores.json')) ? id : null))).filter(Boolean)
  return [...new Set([...local, ...published])].sort().reverse()
    .map((id) => ({ ...registry[id], id }))
}

export async function registerRun(id, patch = {}) {
  const registry = (await exists(REGISTRY)) ? await readJson(REGISTRY) : {}
  const prev = registry[id] ?? {}
  // A run is often built up over several invocations (top-ups, retries, manual drops).
  // Model and benchmark lists accumulate; everything else is last-write-wins.
  const union = (a = [], b = []) => [...new Set([...a, ...b])]
  registry[id] = {
    createdAt: new Date().toISOString(),
    ...prev,
    ...patch,
    models: union(prev.models, patch.models),
    benchmarks: union(prev.benchmarks, patch.benchmarks),
  }
  await writeJson(REGISTRY, registry)
  return registry[id]
}

/**
 * `--run <id>` targets a specific run. `--run latest` (or omitting it downstream of
 * generation) targets the newest. Generation with no --run starts a NEW run, because
 * generating is the act that creates history.
 */
export async function resolveRun(argv, { create = false } = {}) {
  const runs = await listRuns()
  const wanted = argv.run

  if (wanted && wanted !== 'latest' && wanted !== 'new') {
    const hit = runs.find((r) => r.id === wanted)
    if (!hit && !create) fail(`No run "${wanted}". Known: ${runs.map((r) => r.id).join(', ') || '(none)'}`)
    return wanted
  }
  if (create && (!wanted || wanted === 'new')) {
    let id = newRunId()
    let n = 1
    while (runs.some((r) => r.id === id)) id = `${newRunId()}-${++n}`
    await registerRun(id, { note: argv.note ?? '' })
    return id
  }
  if (!runs.length) fail('No runs yet. Generate one first: npm run bench -- --all')
  return runs[0].id
}

export async function loadConfig() {
  const [models, judges, benchmarks, scoring] = await Promise.all([
    readJson(path.join(ROOT, 'config/models.json')),
    readJson(path.join(ROOT, 'config/judges.json')),
    readJson(path.join(ROOT, 'config/benchmarks.json')),
    readJson(path.join(ROOT, 'config/scoring.json')),
  ])
  return {
    models: models.models,
    judges: judges.judges,
    minJudges: judges.minJudges ?? 2,
    benchmarks: benchmarks.benchmarks,
    scoring,
  }
}

/**
 * Some briefs are changes to an existing file rather than greenfield builds, so the
 * starting material has to travel in the prompt. `bench.fixture` names a directory
 * under fixtures/ plus the files to inline; benchmarks without it are untouched.
 *
 * The judge reads the same assembled prompt, which is what lets it diff a submission
 * against the original instead of guessing what was already there.
 */
export async function loadFixture(bench) {
  if (!bench.fixture) return ''
  const { dir, source, brief: briefFile } = bench.fixture
  const read = (f) => fs.readFile(path.join(ROOT, dir, f), 'utf8')

  const [src, tickets] = await Promise.all([read(source), briefFile ? read(briefFile) : ''])
  const blocks = [
    `---\n\n## THE EXISTING FILE — \`${dir}/${source}\`\n\n` +
    'This is the application exactly as it stands today. It works. Read all of it before ' +
    'you change any of it.\n\n' +
    `\`\`\`html\n${src.trim()}\n\`\`\``,
  ]
  if (tickets) blocks.push(`---\n\n## THE TICKETS\n\n${tickets.trim()}`)
  return `${blocks.join('\n\n')}\n\n`
}

/** Full prompt = benchmark brief + any fixture material + the shared output contract. */
export async function loadPrompt(bench) {
  const [brief, contract, fixture] = await Promise.all([
    fs.readFile(path.join(ROOT, 'benchmarks', bench.promptFile), 'utf8'),
    fs.readFile(path.join(ROOT, 'benchmarks/_contract.md'), 'utf8'),
    loadFixture(bench),
  ])
  return `${brief.trim()}\n\n${fixture}${contract.trim()}\n`
}

export function parseCli(extra = {}) {
  const { values } = parseArgs({
    allowPositionals: false,
    options: {
      model: { type: 'string', multiple: true },
      bench: { type: 'string', multiple: true },
      run: { type: 'string' },
      note: { type: 'string' },
      all: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      concurrency: { type: 'string' },
      ...extra,
    },
  })
  return values
}

/**
 * Resolve --model / --bench / --all into the work list.
 * Models missing their API key are skipped with a warning rather than failing the batch.
 */
export function select(cfg, argv, { requireKey = false } = {}) {
  let models = cfg.models.filter((m) => !m.disabled)
  if (argv.model?.length) {
    models = argv.model.map((id) => {
      const m = cfg.models.find((x) => x.id === id)
      if (!m) fail(`Unknown model "${id}". Known: ${cfg.models.map((x) => x.id).join(', ')}`)
      return m
    })
  } else if (!argv.all) {
    fail('Pass --model <id> (repeatable) or --all.')
  }

  if (requireKey) {
    const usable = (m) => m.provider === 'manual' || process.env[m.apiKeyEnv]
    for (const m of models) if (!usable(m)) warn(`skip ${m.id} — ${m.apiKeyEnv} is not set`)
    models = models.filter(usable)
  }

  // Disabled benchmarks are skipped by --all but can still be run by naming them.
  let benches = cfg.benchmarks.filter((b) => !b.disabled)
  if (argv.bench?.length) {
    benches = argv.bench.map((id) => {
      const b = cfg.benchmarks.find((x) => x.id === id || x.id.startsWith(id))
      if (!b) fail(`Unknown benchmark "${id}". Known: ${cfg.benchmarks.map((x) => x.id).join(', ')}`)
      return b
    })
  }

  return { models, benches }
}

/** Bounded-concurrency map. Rejections are captured per item, never thrown. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (i < items.length) {
      const n = i++
      try {
        out[n] = { ok: true, value: await fn(items[n], n) }
      } catch (err) {
        out[n] = { ok: false, error: err }
      }
    }
  })
  await Promise.all(workers)
  return out
}

export const median = (nums) => {
  const s = [...nums].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d
export const clamp01 = (n) => Math.max(0, Math.min(1, n))

const c = (code) => (s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s)
export const dim = c(2)
export const bold = c(1)
export const green = c(32)
export const yellow = c(33)
export const red = c(31)

export const log = (...a) => console.log(...a)
export const warn = (...a) => console.log(yellow('!'), ...a)
export const ok = (...a) => console.log(green('✓'), ...a)
export const bad = (...a) => console.log(red('✗'), ...a)
export function fail(msg) {
  console.error(red('error:'), msg)
  process.exit(1)
}
