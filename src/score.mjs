import path from 'node:path'
import {
  loadConfig, parseCli, resolveRun, listRuns, runDir, htmlPath, exists, readJson, writeJson, humanFile, scoresFile, round, log, bold, dim, warn, green, yellow, RUNS, resultsDir,
} from './lib.mjs'

export const humanKey = (modelId, benchId) => `${modelId}::${benchId}`

/**
 * Blend the three columns. When no human score exists yet the human weight is
 * redistributed across the other two proportionally, and the cell is flagged
 * `reviewed: false` so a provisional number is never mistaken for a final one.
 */
/**
 * SCORING.md §2: "A gate failure caps the run's total at 40%." `viable` is false when the
 * page did not load or rendered nothing at all — the artefact did not run, so no amount of
 * craft in the source earns it a pass. Capping rather than zeroing keeps the signal about
 * HOW a run failed: a well-built page with a fatal import bug still ranks above one that is
 * also badly built.
 */
export const GATE_FAILURE_CAP = 40
export function capGateFailure(final, viable) {
  if (final == null || viable !== false) return final
  return Math.min(final, GATE_FAILURE_CAP)
}

export function blend({ technical, judge, human }, weights) {
  const parts = [
    { v: technical, w: weights.technical },
    { v: judge, w: weights.judge },
    { v: human == null ? null : human * 10, w: weights.human },
  ].filter((p) => p.v != null)
  if (!parts.length) return null
  const totalW = parts.reduce((a, p) => a + p.w, 0)
  return round(parts.reduce((a, p) => a + p.v * p.w, 0) / totalW)
}

export async function buildScores(cfg, runId) {
  // A clone without runs/ (the deliverables are hundreds of MB and are published on the
  // website instead) still carries results/<run>/scores.json. Serve that so the report,
  // the scoreboard and the all-time view work out of the box.
  if (!(await exists(path.join(RUNS, runId)))) {
    const published = path.join(resultsDir(runId), 'scores.json')
    if (await exists(published)) return { ...(await readJson(published)), fromPublished: true }
  }
  const active = cfg.benchmarks.filter((b) => !b.disabled)
  const hf = humanFile(runId)
  const human = (await exists(hf)) ? await readJson(hf) : {}
  const cells = []

  for (const model of cfg.models) {
    for (const bench of cfg.benchmarks) {
      const dir = runDir(runId, model.id, bench.id)
      if (!(await exists(htmlPath(runId, model.id, bench.id)))) {
        cells.push({
          modelId: model.id, benchmarkId: bench.id, present: false,
          expectedManual: bench.mode === 'manual' || model.provider === 'manual',
        })
        continue
      }
      const [gates, judge, meta] = await Promise.all(
        ['gates.json', 'judge.json', 'meta.json'].map(async (f) =>
          (await exists(path.join(dir, f))) ? readJson(path.join(dir, f)) : null,
        ),
      )
      const h = human[humanKey(model.id, bench.id)] ?? null

      cells.push({
        modelId: model.id,
        benchmarkId: bench.id,
        present: true,
        href: `runs/${runId}/${model.id}/${bench.id}/index.html`,
        shotDir: `runs/${runId}/${model.id}/${bench.id}/shots`,
        technical: gates?.technical ?? null,
        viable: gates?.viable ?? null,
        judge: judge?.judgeScore ?? null,
        disagreement: judge?.disagreement ?? null,
        maxSpread: judge?.maxSpread ?? null,
        judgeCount: judge?.judgeCount ?? null,
        redFlags: judge?.redFlags ?? [],
        human: h?.score ?? null,
        humanNote: h?.note ?? '',
        humanBlind: h?.blind ?? false,
        reviewed: h?.score != null,
        final: capGateFailure(
          blend(
            { technical: gates?.technical ?? null, judge: judge?.judgeScore ?? null, human: h?.score ?? null },
            cfg.scoring.weights,
          ),
          gates?.viable,
        ),
        gateCapped: gates?.viable === false,
        fps: gates?.checks?.fps?.value ?? null,
        elapsedSeconds: meta?.elapsedSeconds ?? null,
        outputTokens: meta?.usage?.output ?? null,
        bytes: meta?.bytes ?? null,
      })
    }
  }

  const leaderboard = cfg.models
    .map((model) => {
      const mine = cells.filter((c) => c.modelId === model.id && c.present && c.final != null)
      const attempted = cells.filter((c) => c.modelId === model.id && c.present)
      return {
        modelId: model.id,
        label: model.label,
        provider: model.provider,
        vendor: model.vendor,
        scored: mine.length,
        attempted: attempted.length,
        total: active.length,
        reviewed: mine.filter((c) => c.reviewed).length,
        blindReviewed: mine.filter((c) => c.humanBlind).length,
        overall: mine.length ? round(mine.reduce((a, c) => a + c.final, 0) / mine.length) : null,
        technical: avg(mine.map((c) => c.technical)),
        judge: avg(mine.map((c) => c.judge)),
        human: avg(mine.map((c) => (c.human == null ? null : c.human * 10))),
        redFlags: mine.reduce((a, c) => a + c.redFlags.length, 0),
      }
    })
    .sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1))

  return {
    runId,
    generatedAt: new Date().toISOString(),
    weights: cfg.scoring.weights,
    axes: cfg.scoring.judgeAxes,
    models: cfg.models.map((m) => ({ id: m.id, label: m.label, provider: m.provider, vendor: m.vendor })),
    benchmarks: cfg.benchmarks.filter((b) => !b.disabled).map((b) => ({ id: b.id, label: b.label, category: b.category, mode: b.mode })),
    cells,
    leaderboard,
  }
}

const avg = (xs) => {
  const v = xs.filter((x) => x != null)
  return v.length ? round(v.reduce((a, b) => a + b, 0) / v.length) : null
}

async function main() {
  const argv = parseCli()
  const cfg = await loadConfig()
  const runId = await resolveRun(argv)
  const scores = await buildScores(cfg, runId)
  if (!scores.fromPublished) await writeJson(scoresFile(runId), scores)

  const runs = await listRuns()
  log(bold(`\nrun ${runId}`) + dim(`  (${runs.length} run${runs.length === 1 ? '' : 's'} on record)`))
  log(bold('\nleaderboard\n'))
  const pad = (s, n) => String(s ?? '—').padEnd(n)
  log(dim(`  ${pad('model', 24)}${pad('overall', 9)}${pad('tech', 7)}${pad('judge', 7)}${pad('human', 7)}${pad('built', 7)}reviewed`))
  for (const r of scores.leaderboard) {
    if (!r.attempted) continue
    const flag = r.overall == null ? dim : r.reviewed === r.scored ? green : yellow
    log(`  ${pad(r.label, 24)}${flag(pad(r.overall, 9))}${pad(r.technical, 7)}${pad(r.judge, 7)}${pad(r.human, 7)}${pad(`${r.attempted}/${r.total}`, 7)}${r.reviewed}/${r.scored}${r.blindReviewed ? dim(` (${r.blindReviewed} blind)`) : ''}`)
  }

  const unreviewed = scores.cells.filter((c) => c.present && c.final != null && !c.reviewed).length
  if (unreviewed) warn(`${unreviewed} result(s) unrated — those rows are AUTO-ONLY. Rate them blind: npm run report`)

  const split = scores.cells.filter((c) => c.maxSpread >= 4)
  if (split.length) {
    warn(`${split.length} result(s) split the judge panel by 4+ on an axis — worth your eyes first:`)
    for (const c of split.slice(0, 6)) log(dim(`    ${c.modelId} / ${c.benchmarkId} (spread ${c.maxSpread})`))
  }
  log(dim(`\n${scores.fromPublished ? 'read published' : 'wrote'} ${path.relative(process.cwd(), scoresFile(runId))}\n`))
}

if (import.meta.url === `file://${process.argv[1]}`) await main()

/* ── all-time view ───────────────────────────────────────────────────────────
   Future runs will often contain only the one model that just shipped. A per-run
   leaderboard is useless for that, so this pools every run on record: each
   (model, benchmark) pair is averaged across however many times it has been run,
   and the sample count travels with the number so a single-sample score is never
   mistaken for a settled one.                                                  */

export async function buildAllTime(cfg) {
  const runs = await listRuns()
  const byPair = new Map()   // `${modelId}::${benchId}` → [{runId, final, reviewed, at}]
  const perRun = []

  for (const r of [...runs].reverse()) {         // oldest → newest
    const scores = await buildScores(cfg, r.id)
    perRun.push({ runId: r.id, note: r.note ?? '', createdAt: r.createdAt ?? null, leaderboard: scores.leaderboard })
    for (const c of scores.cells) {
      if (!c.present || c.final == null) continue
      const k = `${c.modelId}::${c.benchmarkId}`
      if (!byPair.has(k)) byPair.set(k, [])
      byPair.get(k).push({ runId: r.id, final: c.final, reviewed: c.reviewed, judge: c.judge, technical: c.technical })
    }
  }

  const benches = cfg.benchmarks.filter((b) => !b.disabled)
  const newestRun = runs[0]?.id ?? null

  const models = cfg.models.map((m) => {
    const cells = benches.map((b) => {
      const samples = byPair.get(`${m.id}::${b.id}`) ?? []
      if (!samples.length) return { benchmarkId: b.id, mean: null, n: 0 }
      const mean = round(samples.reduce((a, s) => a + s.final, 0) / samples.length)
      const spread = samples.length > 1 ? round(Math.max(...samples.map((s) => s.final)) - Math.min(...samples.map((s) => s.final))) : 0
      return {
        benchmarkId: b.id, mean, n: samples.length, spread,
        latest: samples.at(-1).final, latestRun: samples.at(-1).runId,
        reviewed: samples.some((s) => s.reviewed),
      }
    })
    const scored = cells.filter((c) => c.mean != null)
    return {
      modelId: m.id, label: m.label, vendor: m.vendor, provider: m.provider,
      cells,
      coverage: scored.length,
      totalBenchmarks: benches.length,
      runsSeen: [...new Set((byPair.get(`${m.id}::${benches[0]?.id}`) ?? []).map((s) => s.runId))].length,
      overall: scored.length ? round(scored.reduce((a, c) => a + c.mean, 0) / scored.length) : null,
      reviewed: cells.filter((c) => c.reviewed).length,
      // With a single run on record every model is "new", which tells you nothing.
      isNew: runs.length > 1 && cells.some((c) => c.latestRun === newestRun && c.n === 1),
    }
  }).filter((m) => m.coverage > 0)
    .sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1))

  return { generatedAt: new Date().toISOString(), benchmarks: benches.map((b) => ({ id: b.id, label: b.label })), models, perRun, newestRun }
}
