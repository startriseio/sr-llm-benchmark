import { spawn } from 'node:child_process'
import path from 'node:path'
import { ROOT, parseCli, resolveRun, log, bold, dim, red, fail } from './lib.mjs'

/**
 * The whole pipeline for a run: generate → gates → judge → score → scoreboard.
 * This is the "a new model just dropped" command.
 *
 *   npm run bench -- --model kimi-k3                 (new run, one model)
 *   npm run bench -- --all --note "july baseline"    (new run, everything)
 *   npm run bench -- --all --run latest              (top up the newest run)
 *
 * The run id is resolved once here and pinned to every stage, so a run that
 * rolls past midnight cannot land its stages in two different buckets.
 */
const argv = parseCli({ audit: { type: 'boolean', default: false } })
const rawArgs = process.argv.slice(2)
if (!rawArgs.length) fail('Pass --model <id> (repeatable) or --all. Flags are forwarded to every stage.')

const runId = await resolveRun(argv, { create: true })

// Flags that belong to this script only. Forwarding them would crash every stage,
// because the child parsers reject unknown options.
const BENCH_ONLY = new Set(['--audit'])
const args = [
  ...rawArgs.filter((a, i, xs) => !BENCH_ONLY.has(a) && a !== '--run' && xs[i - 1] !== '--run'),
  '--run', runId,
]

const stages = [
  ['generate.mjs', 'generating'],
  ['gates.mjs', 'gates'],
  ['judge.mjs', 'judging'],
  ...(argv.audit ? [['audit.mjs', 'judge audit']] : []),
  ['score.mjs', 'scoring'],
]

const run = (script, extra = []) =>
  new Promise((resolve) => {
    spawn(process.execPath, [path.join(ROOT, 'src', script), ...extra], { stdio: 'inherit', cwd: ROOT })
      .on('exit', resolve)
  })

log(bold(`\n═══ run ${runId} ${dim('═'.repeat(Math.max(0, 50 - runId.length)))}`))

for (const [script, name] of stages) {
  log(bold(`\n── ${name} ${dim('─'.repeat(Math.max(0, 58 - name.length)))}`))
  const code = await run(script, args)
  // Exit 2 means "finished, but some items failed" — one model 404'd, one page threw.
  // The report is more useful with holes in it, so keep going. Anything else is the
  // stage itself failing to run, and repeating that five times helps nobody.
  if (code === 2) log(dim(`  (${name}: some items failed — continuing)`))
  else if (code !== 0) {
    log(red(`\n  ${name} could not run (exit ${code}). Stopping — later stages would fail the same way.`))
    process.exit(code)
  }
}

if (!process.env.SR_NO_REPORT) {
  log(bold(`\n── scoreboard ${dim('─'.repeat(50))}`))
  await run('report.mjs', ['--run', runId])
}
