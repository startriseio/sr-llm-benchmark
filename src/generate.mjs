import fs from 'node:fs/promises'
import path from 'node:path'
import {
  loadConfig, loadPrompt, parseCli, select, pool, resolveRun, registerRun,
  runDir, htmlPath, exists, writeJson, log, ok, bad, warn, dim, bold, round,
} from './lib.mjs'
import { complete, extractHtml } from './providers.mjs'

const SYSTEM = `You are being evaluated in a build benchmark. You will be given one brief and you produce one deliverable.

Work to the top of your ability. There is no follow-up turn, no chance to iterate, and no human to answer questions — whatever you return is the final submission, so make every decision yourself and finish the whole thing.

Follow the output contract at the end of the brief exactly. A submission that violates the contract cannot be evaluated at all, no matter how good the work is.`

export async function generateOne({ runId, model, bench, force }) {
  const dest = htmlPath(runId, model.id, bench.id)
  const dir = runDir(runId, model.id, bench.id)

  // Manual either because the benchmark needs a harness (Figma MCP) or because the
  // model has no public API (Cursor Composer). Same handling: we do not generate it.
  if (bench.mode === 'manual' || model.provider === 'manual') {
    return { status: 'manual', hasFile: await exists(dest) }
  }
  if (!force && (await exists(dest))) return { status: 'cached' }

  const prompt = await loadPrompt(bench)
  const started = Date.now()
  const res = await complete({ spec: model, system: SYSTEM, prompt })
  const elapsed = (Date.now() - started) / 1000

  const { html, violation } = extractHtml(res.text)
  await fs.mkdir(dir, { recursive: true })

  if (!html) {
    await fs.writeFile(path.join(dir, 'raw-response.txt'), res.text)
    throw new Error(`${violation} — raw response saved for inspection`)
  }

  await fs.writeFile(dest, html)
  await writeJson(path.join(dir, 'meta.json'), {
    runId,
    modelId: model.id,
    benchmarkId: bench.id,
    resolvedModel: res.model,
    generatedAt: new Date().toISOString(),
    elapsedSeconds: round(elapsed),
    usage: res.usage,
    bytes: html.length,
    truncated: res.truncated,
    contractViolation: violation,
  })

  return { status: 'generated', elapsed, bytes: html.length, violation, truncated: res.truncated }
}

async function main() {
  const argv = parseCli()
  const cfg = await loadConfig()
  const { models, benches } = select(cfg, argv, { requireKey: true })
  const runId = await resolveRun(argv, { create: true })

  const jobs = models.flatMap((model) => benches.map((bench) => ({ model, bench })))
  if (!jobs.length) return warn('nothing to generate')

  // Every model fires at once by default — they are independent HTTP calls to different
  // providers, so wall-clock is the slowest single generation rather than their sum.
  // Throttle with --concurrency N if a provider rate-limits you.
  const concurrency = Number(argv.concurrency ?? jobs.length)

  log(bold(`\nrun ${runId}${argv.note ? dim(`  “${argv.note}”`) : ''}`))
  log(dim(`generating  ${models.length} model(s) × ${benches.length} benchmark(s)  ·  concurrency ${concurrency}\n`))

  const results = await pool(jobs, concurrency, async ({ model, bench }) => {
    const r = await generateOne({ runId, model, bench, force: argv.force })
    const tag = `${model.id} ${dim('/')} ${bench.id}`
    if (r.status === 'cached') log(dim(`· ${tag} — already in this run (--force to redo)`))
    else if (r.status === 'manual') {
      r.hasFile
        ? ok(`${tag} ${dim('manual — file present')}`)
        : warn(`${tag} — manual: drop your file at ${path.relative(process.cwd(), htmlPath(runId, model.id, bench.id))}`)
    } else {
      const notes = [
        `${round(r.elapsed)}s`,
        `${(r.bytes / 1024).toFixed(0)}kb`,
        r.truncated && 'TRUNCATED (raise max_tokens)',
        r.violation && `contract: ${r.violation}`,
      ].filter(Boolean).join(' · ')
      ok(`${tag} ${dim(notes)}`)
    }
    return r
  })

  for (const [i, r] of results.entries()) {
    if (!r.ok) bad(`${jobs[i].model.id} ${dim('/')} ${jobs[i].bench.id} — ${r.error.message}`)
  }

  await registerRun(runId, {
    note: argv.note ?? undefined,
    models: [...new Set(models.map((m) => m.id))],
    benchmarks: benches.map((b) => b.id),
    generatedAt: new Date().toISOString(),
  })

  const failed = results.filter((r) => !r.ok).length
  log(`\n${results.length - failed}/${results.length} ok  ${dim(`· run ${runId}`)}\n`)
  // 2 = ran fine, some items failed. Reserved so the pipeline can tell this apart
  // from the stage failing to start at all.
  if (failed) process.exitCode = 2
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
