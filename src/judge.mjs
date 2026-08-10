import fs from 'node:fs/promises'
import path from 'node:path'
import {
  loadConfig, loadPrompt, parseCli, select, pool, resolveRun, runDir, htmlPath, exists,
  readJson, writeJson, median, round, log, ok, bad, warn, dim, bold,
} from './lib.mjs'
import { complete } from './providers.mjs'

export const MAX_SOURCE_CHARS = 90_000

export const SYSTEM_PREFIX = `You are one member of a judging panel evaluating anonymous submissions to a build benchmark. Several judges score each submission independently and the panel's median is taken, so do not try to guess or compensate for what the others will say — score what is in front of you.

You never learn which model produced a submission. Do not speculate about it.

Your lens:
`

export const SYSTEM_SUFFIX = `

Scoring discipline:
- 0-10 per axis. 5 is a competent, unremarkable submission that a good developer would produce without much thought. 8 is genuinely excellent. 10 is work you would show other people unprompted. Reserve 9-10 — most submissions are not there.
- Score what was actually delivered, not what the code says it intends. Screenshots are evidence; comments are not.
- A submission that looks impressive in a still frame but whose source shows the effect is faked, hardcoded, or broken should be scored down on technique regardless of how it photographs.
- Be specific in your notes. "Good design" is useless; "the type scale is well set but the hero and the footer belong to different pages" is useful.
- Do not reward length. A large file that does little is worse than a small one that does a lot.`

export const VERDICT_SCHEMA = (axes) => ({
  type: 'object',
  additionalProperties: false,
  required: ['scores', 'summary', 'strengths', 'weaknesses', 'redFlags'],
  properties: {
    scores: {
      type: 'object',
      additionalProperties: false,
      required: axes.map((a) => a.id),
      // enum, not minimum/maximum — Anthropic's structured outputs reject numeric
      // constraints, and an enum pins the range harder anyway.
      properties: Object.fromEntries(
        axes.map((a) => [a.id, {
          type: 'integer',
          enum: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          description: a.description,
        }]),
      ),
    },
    summary: { type: 'string', description: 'One or two sentences: what this submission is and how good it is.' },
    strengths: { type: 'array', items: { type: 'string' }, description: 'Specific, concrete. 1-3 items.' },
    weaknesses: { type: 'array', items: { type: 'string' }, description: 'Specific, concrete. 1-3 items.' },
    redFlags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Faked effects, stubs, TODOs, broken states, contract violations. Empty array if none.',
    },
  },
})

export async function loadShots(dir) {
  const shotDir = path.join(dir, 'shots')
  if (!(await exists(shotDir))) return []
  const files = (await fs.readdir(shotDir)).filter((f) => f.endsWith('.png')).sort()
  return Promise.all(
    files.slice(0, 3).map(async (f) => ({
      mediaType: 'image/png',
      base64: (await fs.readFile(path.join(shotDir, f))).toString('base64'),
      name: f,
    })),
  )
}

export function buildPrompt({ brief, source, truncated, gates, shots, bench }) {
  const gateLines = gates
    ? Object.entries(gates.checks).map(([k, v]) => `- ${k}: ${Math.round(v.score * 100)}/100 — ${v.detail}`).join('\n')
    : '- not measured'

  const note = bench.judgeNote ? `## Special instructions for this benchmark\n\n${bench.judgeNote}\n\n` : ''

  return `${note}## The brief the submission was answering

${brief}

## Automated measurements

These were captured by driving the page in a real browser. Treat them as facts, not opinions — but they only measure whether it works, not whether it is any good. That part is your job.

${gateLines}

## Screenshots

${shots.length} screenshot(s), in order: initial render, after scripted interaction (${gates?.checks?.interaction?.detail ?? 'n/a'}), and settled. Attached above.

## Source

${truncated ? `(truncated to the first ${MAX_SOURCE_CHARS} characters — the file is longer)\n` : ''}\`\`\`html
${source}
\`\`\`

---

Score this submission on every axis. Read the source before you score technique — check whether the visual result is produced by the mechanism it appears to use.`
}

/** Run the full panel over one deliverable. Judges never see each other's verdicts. */
export async function judgeOne({ runId, model, bench, cfg, force }) {
  const dir = runDir(runId, model.id, bench.id)
  const file = htmlPath(runId, model.id, bench.id)
  const out = path.join(dir, 'judge.json')

  if (!(await exists(file))) return { status: 'missing' }
  if (!force && (await exists(out))) return { status: 'cached' }

  const panel = cfg.judges.filter((j) => process.env[j.apiKeyEnv])
  if (panel.length < cfg.minJudges) {
    throw new Error(`quorum needs ${cfg.minJudges} judges, ${panel.length} have keys`)
  }

  const raw = await fs.readFile(file, 'utf8')
  const truncated = raw.length > MAX_SOURCE_CHARS
  const [brief, shots, gates] = await Promise.all([
    loadPrompt(bench),
    loadShots(dir),
    exists(path.join(dir, 'gates.json')).then((e) => (e ? readJson(path.join(dir, 'gates.json')) : null)),
  ])

  const prompt = buildPrompt({ brief, source: raw.slice(0, MAX_SOURCE_CHARS), truncated, gates, shots, bench })
  const schema = VERDICT_SCHEMA(cfg.scoring.judgeAxes)

  const verdicts = await pool(panel, panel.length, async (judge) => {
    // A vision-less judge gets no screenshots and is told so, rather than being asked
    // to score visual craft off evidence it cannot see.
    const blind = judge.vision === false
    const res = await complete({
      spec: judge,
      system: SYSTEM_PREFIX + judge.lens + SYSTEM_SUFFIX +
        (blind ? '\n\nYou cannot see images. You are scoring from the source and the automated measurements only. Say so in your summary, and be conservative on the purely visual axes rather than guessing.' : ''),
      prompt,
      images: blind ? [] : shots,
      schema,
    })
    const parsed = JSON.parse(res.text)
    return { judgeId: judge.id, judgeLabel: judge.label, judgeModel: res.model, sawImages: !blind, ...parsed }
  })

  const good = verdicts.filter((v) => v.ok).map((v) => v.value)
  const failed = verdicts.map((v, i) => (v.ok ? null : { judgeId: panel[i].id, error: v.error.message })).filter(Boolean)

  if (good.length < cfg.minJudges) {
    throw new Error(`only ${good.length}/${panel.length} judges returned a verdict (need ${cfg.minJudges}): ${failed.map((f) => `${f.judgeId}: ${f.error}`).join('; ')}`)
  }

  const report = {
    runId,
    modelId: model.id,
    benchmarkId: bench.id,
    judgedAt: new Date().toISOString(),
    panel: good,
    failed,
    ...aggregate(good, cfg.scoring.judgeAxes),
  }
  await writeJson(out, report)
  return { status: 'done', report }
}

/**
 * Median per axis, not mean — one judge who hates the submission cannot drag the panel,
 * and with an odd panel the aggregate is always a score a real judge actually gave.
 * Spread is kept so you can see where the panel disagreed rather than trusting a
 * consensus that does not exist.
 */
export function aggregate(verdicts, axes) {
  const axisScores = {}
  for (const axis of axes) {
    const vals = verdicts.map((v) => v.scores[axis.id])
    axisScores[axis.id] = {
      median: median(vals),
      min: Math.min(...vals),
      max: Math.max(...vals),
      spread: Math.max(...vals) - Math.min(...vals),
      byJudge: Object.fromEntries(verdicts.map((v) => [v.judgeId, v.scores[axis.id]])),
    }
  }
  const medians = axes.map((a) => axisScores[a.id].median)
  const spreads = axes.map((a) => axisScores[a.id].spread)

  return {
    axes: axisScores,
    judgeScore: round((medians.reduce((a, b) => a + b, 0) / medians.length) * 10),
    disagreement: round(spreads.reduce((a, b) => a + b, 0) / spreads.length, 2),
    maxSpread: Math.max(...spreads),
    redFlags: [...new Set(verdicts.flatMap((v) => v.redFlags ?? []))],
    judgeCount: verdicts.length,
  }
}

async function main() {
  const argv = parseCli()
  const cfg = await loadConfig()
  const { models, benches } = select(cfg, argv)
  const runId = await resolveRun(argv)

  const panel = cfg.judges.filter((j) => process.env[j.apiKeyEnv])
  log(bold(`\nrun ${runId}`))
  log(dim(`judging  quorum of ${panel.length}: ${panel.map((j) => `${j.label} (${j.model})`).join(', ')}\n`))
  if (panel.length < 3) warn('a panel of fewer than 3 gives you a mean, not a median — add a judge for outlier resistance')
  if (panel.length % 2 === 0) warn(`panel is even (${panel.length}); the median falls between two judges`)

  const jobs = models.flatMap((model) => benches.map((bench) => ({ model, bench })))
  // Each job fans out to the whole panel internally, so this is jobs × judges in flight.
  const concurrency = Number(argv.concurrency ?? Math.min(jobs.length, 12))
  const results = await pool(jobs, concurrency, async ({ model, bench }) => {
    const r = await judgeOne({ runId, model, bench, cfg, force: argv.force })
    const tag = `${model.id} ${dim('/')} ${bench.id}`
    if (r.status === 'missing') log(dim(`· ${tag} — no deliverable`))
    else if (r.status === 'cached') log(dim(`· ${tag} — already judged (--force to redo)`))
    else {
      const { judgeScore, disagreement, maxSpread, redFlags } = r.report
      const notes = [
        `judge ${judgeScore}`,
        r.report.failed.length && `${r.report.failed.length} JUDGE FAILED: ${r.report.failed.map((f) => `${f.judgeId} (${f.error})`).join(', ')}`,
        `spread ${disagreement}`,
        maxSpread >= 4 && `SPLIT PANEL (max ${maxSpread})`,
        redFlags.length && `${redFlags.length} red flag(s)`,
      ].filter(Boolean).join(' · ')
      ok(`${tag} ${dim(notes)}`)
    }
    return r
  })

  for (const [i, r] of results.entries()) {
    if (!r.ok) bad(`${jobs[i].model.id} ${dim('/')} ${jobs[i].bench.id} — ${r.error.message}`)
  }
  log('')
  if (results.some((r) => !r.ok)) process.exitCode = 2
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
