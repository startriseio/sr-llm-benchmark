import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import {
  loadConfig, loadPrompt, parseCli, select, resolveRun, runDir, htmlPath,
  exists, log, ok, warn, dim, bold, green, fail,
} from './lib.mjs'

/**
 * Set up a manual model (Cursor Composer, or any harness with no public API).
 *
 *   npm run manual -- --model cursor-composer-2.5
 *   npm run manual -- --model cursor-composer-2.5 --bench 02 --copy
 *
 * Writes the exact brief the API models received to PROMPT.md inside each destination
 * folder, so the harness reads the same input and you save index.html right beside it.
 * Everything downstream — gates, judges, blind review — treats the result identically.
 */
async function main() {
  const argv = parseCli({ copy: { type: 'boolean', default: false } })
  const cfg = await loadConfig()
  const { models, benches } = select(cfg, argv)
  const runId = await resolveRun(argv, { create: true })

  if (!models.length) fail('Pass --model <id>.')

  log(bold(`\nrun ${runId}`))
  log(dim('the harness gets exactly the brief the API models got — same file, no edits\n'))

  let missing = 0
  for (const model of models) {
    if (model.provider !== 'manual') {
      warn(`${model.id} has an API — just run: npm run bench -- --model ${model.id}`)
      continue
    }
    log(bold(`${model.label}${model.harness ? dim(`  via ${model.harness}`) : ''}`))

    for (const bench of benches) {
      const dir = runDir(runId, model.id, bench.id)
      await fs.mkdir(dir, { recursive: true })
      const promptFile = path.join(dir, 'PROMPT.md')
      await fs.writeFile(promptFile, await loadPrompt(bench))

      const have = await exists(htmlPath(runId, model.id, bench.id))
      if (have) ok(`  ${bench.id} ${dim('— index.html present')}`)
      else {
        missing++
        log(`  ${dim('○')} ${bench.id}`)
        log(dim(`      brief → ${path.relative(process.cwd(), promptFile)}`))
        log(dim(`      save  → ${path.relative(process.cwd(), htmlPath(runId, model.id, bench.id))}`))
      }
    }
    log('')
  }

  if (argv.copy) {
    if (benches.length !== 1) fail('--copy needs exactly one --bench')
    const text = await loadPrompt(benches[0])
    if (process.platform !== 'darwin') fail('--copy is macOS only; open the PROMPT.md instead')
    await new Promise((res, rej) => {
      const p = execFile('pbcopy', (e) => (e ? rej(e) : res()))
      p.stdin.end(text)
    })
    ok(`${benches[0].id} brief copied to the clipboard — paste it into ${models[0].harness ?? 'the harness'}`)
  }

  if (missing) {
    log(dim('when the files are in place:'))
    log(`  npm run gates -- --model ${models.map((m) => m.id).join(' --model ')} --run ${runId}`)
    log(`  npm run judge -- --model ${models.map((m) => m.id).join(' --model ')} --run ${runId}`)
    log(`  npm run score -- --run ${runId}\n`)
    log(dim(`or in one step:  npm run bench -- --model ${models[0].id} --run ${runId}\n`))
  } else {
    ok(`everything present — score it: npm run bench -- --model ${models[0].id} --run ${runId}\n`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
