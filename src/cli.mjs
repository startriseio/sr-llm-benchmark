import { spawn } from 'node:child_process'
import path from 'node:path'
import readline from 'node:readline'
import {
  loadConfig, listRuns, exists, htmlPath, humanFile, readJson, resolveRun,
  ROOT, log, bold, dim, green, yellow, red,
} from './lib.mjs'

/**
 * Interactive launcher. `npm start`
 *
 * Pick models and tasks with the space bar, see at a glance what has already been
 * benchmarked, confirm the plan, then watch it run. Everything it does is a thin
 * wrapper over `npm run bench` — the flags it builds are printed before it starts,
 * so nothing here is a black box.
 */

const KEYS = { UP: '[A', DOWN: '[B', LEFT: '[D', RIGHT: '[C', CTRLC: '', ENTER: '\r', ENTER2: '\n', SPACE: ' ', ESC: '' }

function screen(lines) {
  process.stdout.write('[2J[H' + lines.join('\n') + '\n')
}

/** Multi-select list. Returns the chosen items, or null if the user backed out. */
function multiSelect({ title, hint, items, selected, render }) {
  return new Promise((resolve) => {
    let cursor = 0
    const chosen = new Set(selected)

    const draw = () => {
      const out = [
        '',
        bold(`  ${title}`),
        dim(`  ${hint}`),
        '',
        ...items.map((item, i) => {
          const mark = chosen.has(item) ? green('◉') : dim('○')
          const line = render(item, chosen.has(item))
          return i === cursor ? `  ${mark} ${bold('❯')} ${line}` : `  ${mark}   ${line}`
        }),
        '',
        dim(`  ${chosen.size} of ${items.length} selected`),
        dim('  ↑↓ move · space toggle · a all · n none · enter continue · q quit'),
      ]
      screen(out)
    }

    const onKey = (buf) => {
      const k = buf.toString()
      if (k === KEYS.CTRLC || k === 'q') { cleanup(); process.exit(0) }
      else if (k === KEYS.UP || k === 'k') cursor = (cursor - 1 + items.length) % items.length
      else if (k === KEYS.DOWN || k === 'j') cursor = (cursor + 1) % items.length
      else if (k === KEYS.SPACE) {
        const it = items[cursor]
        chosen.has(it) ? chosen.delete(it) : chosen.add(it)
      } else if (k === 'a') items.forEach((i) => chosen.add(i))
      else if (k === 'n') chosen.clear()
      else if (k === KEYS.ENTER || k === KEYS.ENTER2) {
        if (!chosen.size) return draw()
        cleanup()
        return resolve(items.filter((i) => chosen.has(i)))
      }
      draw()
    }

    const cleanup = () => {
      process.stdin.off('data', onKey)
      if (process.stdin.isTTY) process.stdin.setRawMode(false)
      process.stdin.pause()
    }

    if (process.stdin.isTTY) process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onKey)
    draw()
  })
}

function confirm(question, lines) {
  return new Promise((resolve) => {
    screen(['', ...lines, '', bold(`  ${question}`), dim('  enter to run · q to cancel'), ''])
    const onKey = (buf) => {
      const k = buf.toString()
      if (k === KEYS.ENTER || k === KEYS.ENTER2) { cleanup(); resolve(true) }
      else if (k === 'q' || k === KEYS.CTRLC || k === KEYS.ESC) { cleanup(); resolve(false) }
    }
    const cleanup = () => {
      process.stdin.off('data', onKey)
      if (process.stdin.isTTY) process.stdin.setRawMode(false)
      process.stdin.pause()
    }
    if (process.stdin.isTTY) process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onKey)
  })
}

function ask(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(prompt, (a) => { rl.close(); resolve(a.trim()) })
  })
}

/** How much of the suite each model has ever completed, and how much you have rated. */
async function coverage(cfg) {
  const runs = await listRuns()
  const benches = cfg.benchmarks.filter((b) => !b.disabled)
  const map = new Map()

  for (const m of cfg.models) {
    const built = new Set()
    let rated = 0
    for (const r of runs) {
      const human = (await exists(humanFile(r.id))) ? await readJson(humanFile(r.id)) : {}
      for (const b of benches) {
        if (await exists(htmlPath(r.id, m.id, b.id))) {
          built.add(b.id)
          if (human[`${m.id}::${b.id}`]?.score != null) rated++
        }
      }
    }
    map.set(m.id, { built: built.size, total: benches.length, rated })
  }
  return map
}

async function main() {
  const cfg = await loadConfig()
  const cov = await coverage(cfg)
  const runs = await listRuns()

  const usable = cfg.models.filter((m) => m.provider === 'manual' || process.env[m.apiKeyEnv])
  const blocked = cfg.models.filter((m) => m.provider !== 'manual' && !process.env[m.apiKeyEnv])
  const benches = cfg.benchmarks.filter((b) => !b.disabled)

  if (!usable.length) {
    log(red('\n  No models are usable — no API keys found. Fill in .env first.\n'))
    process.exit(1)
  }

  const width = Math.max(...usable.map((m) => m.label.length))
  const renderModel = (m) => {
    const c = cov.get(m.id)
    const status = c.built === 0
      ? dim('never run')
      : c.built === c.total
        ? green(`complete ${c.built}/${c.total}`)
        : yellow(`partial  ${c.built}/${c.total}`)
    const rated = c.built ? dim(` · ${c.rated}/${c.built} rated`) : ''
    const kind = m.provider === 'manual' ? dim('  [manual — needs npm run manual]') : ''
    return `${m.label.padEnd(width)}  ${status}${rated}${kind}`
  }

  // Pre-select what is not finished — the common case is "fill in the gaps".
  const incomplete = usable.filter((m) => cov.get(m.id).built < benches.length && m.provider !== 'manual')

  const models = await multiSelect({
    title: 'Which models?',
    hint: blocked.length
      ? `${blocked.length} hidden with no API key: ${blocked.map((m) => m.id).join(', ')}`
      : 'every model in config/models.json that has a key',
    items: usable,
    selected: incomplete.length ? incomplete : usable.filter((m) => m.provider !== 'manual'),
    render: renderModel,
  })

  const bWidth = Math.max(...benches.map((b) => b.label.length))
  const tasks = await multiSelect({
    title: 'Which tasks?',
    hint: 'each selected model produces one self-contained HTML file per task',
    items: benches,
    selected: benches,
    render: (b) => `${b.label.padEnd(bWidth)}  ${dim(b.category)}`,
  })

  const manual = models.filter((m) => m.provider === 'manual')
  const api = models.filter((m) => m.provider !== 'manual')
  const jobs = api.length * tasks.length

  const topUp = runs.length
    ? (await ask(`\n  Add to the newest run (${runs[0].id}) instead of starting a new one? [y/N] `)).toLowerCase().startsWith('y')
    : false
  const note = topUp ? '' : await ask('  Label this run (optional): ')
  const doAudit = (await ask('  Also audit the judges afterwards? [y/N] ')).toLowerCase().startsWith('y')

  const runId = topUp ? runs[0].id : await resolveRun({ note }, { create: true })

  const args = [
    '--run', runId,
    ...models.map((m) => ['--model', m.id]).flat(),
    ...tasks.map((t) => ['--bench', t.id]).flat(),
    ...(note ? ['--note', note] : []),
    ...(doAudit ? ['--audit'] : []),
  ]

  const plan = [
    bold('  Plan'),
    '',
    `  run           ${runId}${note ? dim(`  “${note}”`) : ''}${topUp ? dim('  (adding to existing)') : ''}`,
    `  models        ${api.length}${manual.length ? dim(` (+${manual.length} manual)`) : ''}   ${dim(api.map((m) => m.id).join(', '))}`,
    `  tasks         ${tasks.length}   ${dim(tasks.map((t) => t.id.split('-').slice(1).join('-')).join(', '))}`,
    `  generations   ${bold(String(jobs))}   ${dim('all fired in parallel — wall-clock is the slowest one, not the sum')}`,
    '',
    dim('  then: gates (serial, real GPU) → judge quorum of 3 → score' + (doAudit ? ' → judge audit' : '')),
    manual.length ? yellow(`\n  ${manual.map((m) => m.label).join(', ')} cannot be generated — run npm run manual after this`) : '',
    '',
    dim(`  equivalent to:  npm run bench -- ${args.join(' ')}`),
  ].filter(Boolean)

  if (!(await confirm('Start?', plan))) { log(dim('\n  cancelled\n')); process.exit(0) }

  screen([''])
  const child = spawn(process.execPath, [path.join(ROOT, 'src/bench.mjs'), ...args], { stdio: 'inherit', cwd: ROOT })
  child.on('exit', (code) => process.exit(code ?? 0))
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
