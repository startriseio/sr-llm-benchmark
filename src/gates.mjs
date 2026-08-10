import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import {
  loadConfig, parseCli, select, resolveRun, runDir, htmlPath, exists, writeJson, readJson,
  log, ok, bad, warn, dim, bold, round, clamp01,
} from './lib.mjs'

const CDN_HOSTS = [
  'unpkg.com', 'cdn.jsdelivr.net', 'esm.sh', 'cdnjs.cloudflare.com',
  'fonts.googleapis.com', 'fonts.gstatic.com', 'ga.jspm.io', 'jspm.dev',
  'threejs.org', 'cdn.skypack.dev', 'esm.run', 'code.jquery.com',
]

/**
 * Static scan of the deliverable. This is the one gate that does not need a browser:
 * it enforces the "one self-contained file" half of the output contract.
 */
function checkSelfContained(html, meta) {
  const problems = []
  const refs = [...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1])

  // An <a href> is a hyperlink, not a resource the page loads, so it cannot break
  // "self-contained". Counting them punished models for following the brief: 13-html-email
  // REQUIRES a call to action, a secondary link and an unsubscribe footer, and 07-self-pitch
  // requires a closing ask — which cost every model on 13 and five models on 07. A bare
  // href="/" in a nav scored 03-landing-design a zero. src=, <link href=>, and every other
  // reference are still checked exactly as before.
  const linkHrefs = new Set(
    [...html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1].trim()),
  )

  for (const ref of refs) {
    const r = ref.trim()
    if (linkHrefs.has(r)) continue
    if (!r || r.startsWith('#') || r.startsWith('data:') || r.startsWith('blob:')) continue
    if (r.startsWith('javascript:') || r.startsWith('mailto:') || r.startsWith('tel:')) continue
    if (/^https?:\/\//i.test(r)) {
      const host = new URL(r).hostname.replace(/^www\./, '')
      if (!CDN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
        problems.push({ kind: 'non-cdn', ref: r })
      }
      continue
    }
    if (r.startsWith('//')) { problems.push({ kind: 'non-cdn', ref: r }); continue }
    problems.push({ kind: 'local-file', ref: r })
  }

  const local = problems.filter((p) => p.kind === 'local-file')
  const nonCdn = problems.filter((p) => p.kind === 'non-cdn')

  let score = 1
  const detail = []
  if (local.length) { score = 0; detail.push(`${local.length} local file reference(s): ${local.slice(0, 3).map((p) => p.ref).join(', ')}`) }
  if (nonCdn.length) { score = Math.min(score, 0.5); detail.push(`${nonCdn.length} non-CDN external reference(s): ${nonCdn.slice(0, 3).map((p) => p.ref).join(', ')}`) }
  if (meta?.contractViolation) { score = Math.min(score, 0.75); detail.push(`output contract: ${meta.contractViolation}`) }
  if (meta?.truncated) { score = Math.min(score, 0.25); detail.push('response was truncated at max_tokens') }

  return { score, detail: detail.join('; ') || 'single self-contained file' }
}

/** Budget from the output contract: ~800 lines / 50KB, with headroom before it bites. */
function checkEconomy(html) {
  const lines = html.split('\n').length
  const kb = html.length / 1024
  // Full marks inside budget, tapering to zero at 2.5x. A task that genuinely needs
  // more should not be failed outright — the judges weigh whether the size was earned.
  const over = Math.max(lines / 800, kb / 50)
  const score = over <= 1 ? 1 : clamp01(1 - (over - 1) / 1.5)
  return {
    score,
    detail: `${lines} lines · ${Math.round(kb)}kb${over > 1 ? ` — ${over.toFixed(1)}× budget` : ''}`,
    value: lines,
  }
}

/**
 * Does the page identify its own author correctly?
 *
 * Only meaningful on the self-pitch benchmark, where the brief demands the model name
 * itself. Deliberately deterministic rather than a judge call: a judge cannot know the
 * true author unless we tell it, and telling it would leak identity into the quorum and
 * manufacture the vendor bias the audit exists to detect. A regex can check the claim
 * without anyone learning anything.
 *
 * Confidently asserting the wrong model is scored as a factual error. Declining to name
 * a version at all is a partial miss — the brief asked for it — but it is not dishonest,
 * so it scores well above a confident falsehood.
 */
const MODEL_PATTERNS = [
  /claude[\s-]+(opus|sonnet|haiku|fable|mythos)[\s-]*([0-9]+(?:\.[0-9]+)?)/gi,
  /gpt[\s-]*([0-9]+(?:\.[0-9]+)?)(?:[\s-]*(sol|terra|luna|pro|mini|nano|codex))?/gi,
  /grok[\s-]*([0-9]+(?:\.[0-9]+)?)/gi,
  /kimi[\s-]*k([0-9]+(?:\.[0-9]+)?)/gi,
  /glm[\s-]*([0-9]+(?:\.[0-9]+)?)/gi,
  /qwen[\s-]*([0-9]+(?:\.[0-9]+)?)/gi,
  /gemini[\s-]*([0-9]+(?:\.[0-9]+)?)/gi,
  /(deepseek|mistral|llama)[\s-]*([0-9]+(?:\.[0-9]+)?)/gi,
]

const normalise = (s) => s.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').replace(/\s+/g, ' ').trim()

function checkIdentity(html, model) {
  // Strip tags — we care what the page says to a reader, not what is in an attribute.
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
                   .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                   .replace(/<[^>]+>/g, ' ')
  const claims = new Set()
  for (const re of MODEL_PATTERNS) {
    for (const m of text.matchAll(re)) claims.add(normalise(m[0]))
  }

  const truth = normalise(model.label)
  const truthLoose = truth.replace(/^claude /, '')
  const namedSelf = [...claims].some((c) => c === truth || c === truthLoose || truth.includes(c) || c.includes(truthLoose))
  const wrong = [...claims].filter((c) => c !== truth && c !== truthLoose && !truth.includes(c) && !c.includes(truthLoose))

  if (namedSelf && !wrong.length) return { score: 1, detail: `identifies itself correctly as ${model.label}` }
  if (namedSelf && wrong.length) {
    return { score: 0.7, detail: `names itself correctly but also claims: ${wrong.slice(0, 3).join(', ')}` }
  }
  if (wrong.length) {
    return { score: 0, detail: `WRONG IDENTITY — claims to be "${wrong[0]}" but is ${model.label}` }
  }
  return { score: 0.5, detail: `never names a specific model (brief asked it to); no false claim either` }
}

/** Luminance stddev — a blank/uniform page has near-zero spread. */
function imageStats(buf) {
  const png = PNG.sync.read(buf)
  const { data, width, height } = png
  let sum = 0, sumSq = 0, n = 0
  for (let i = 0; i < data.length; i += 4 * 7) { // stride-sample; full scan is unnecessary
    const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    sum += l; sumSq += l * l; n++
  }
  const mean = sum / n
  return { stddev: Math.sqrt(Math.max(0, sumSq / n - mean * mean)), mean, width, height }
}

/** Mean absolute luminance difference between two same-size screenshots, 0-255. */
function imageDelta(bufA, bufB) {
  const a = PNG.sync.read(bufA), b = PNG.sync.read(bufB)
  if (a.width !== b.width || a.height !== b.height) return 255
  let sum = 0, n = 0
  for (let i = 0; i < a.data.length; i += 4 * 7) {
    const la = 0.2126 * a.data[i] + 0.7152 * a.data[i + 1] + 0.0722 * a.data[i + 2]
    const lb = 0.2126 * b.data[i] + 0.7152 * b.data[i + 1] + 0.0722 * b.data[i + 2]
    sum += Math.abs(la - lb); n++
  }
  return sum / n
}

async function drive(page, kind, viewport) {
  if (kind === 'scroll') {
    // Real wheel events, not scrollTo — scroll-jacked pages listen for wheel.
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(0, 400)
      await page.waitForTimeout(120)
    }
    await page.waitForTimeout(900)
  } else if (kind === 'pointer') {
    const { width, height } = viewport
    await page.mouse.move(width * 0.2, height * 0.3)
    for (let i = 1; i <= 14; i++) {
      await page.mouse.move(width * (0.2 + 0.045 * i), height * (0.3 + 0.028 * i))
      await page.waitForTimeout(60)
    }
    await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up()
    await page.waitForTimeout(600)
  } else if (kind === 'keyboard') {
    const { width, height } = viewport
    await page.mouse.click(width / 2, height / 2) // most games need focus / a start click
    await page.waitForTimeout(400)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
    for (const key of ['Space', 'ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD']) {
      await page.keyboard.down(key); await page.waitForTimeout(180); await page.keyboard.up(key)
    }
    await page.waitForTimeout(600)
  }
}

export async function runGates({ runId, model, bench, browser }) {
  const dir = runDir(runId, model.id, bench.id)
  const file = htmlPath(runId, model.id, bench.id)
  if (!(await exists(file))) return { status: 'missing' }

  const html = await fs.readFile(file, 'utf8')
  const meta = (await exists(path.join(dir, 'meta.json'))) ? await readJson(path.join(dir, 'meta.json')) : null
  const shots = path.join(dir, 'shots')
  await fs.mkdir(shots, { recursive: true })

  const viewport = bench.viewport ?? { width: 1440, height: 900 }
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  const page = await context.newPage()

  const consoleErrors = [], pageErrors = [], failedRequests = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)) })
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 300)))
  page.on('requestfailed', (r) => failedRequests.push(`${r.url().slice(0, 160)} — ${r.failure()?.errorText}`))

  // Count the PAGE's frames, not ours.
  //
  // This previously installed its own rAF loop, which counted the browser's compositor
  // ticks no matter what the page did — so 115 of 118 cells scored a perfect 1.0, including
  // a submission where THREE never loaded and nothing rendered at all ("119.9 fps"). It was
  // a constant, not a measurement.
  //
  // Instead, wrap requestAnimationFrame so we count callbacks the page itself schedules and
  // the browser actually runs. A page driving an animation loop reports its real rate; a page
  // with no loop reports 0. Only 01/02/05 declare this check and all three are rAF-driven by
  // nature, so a CSS-only animation scoring 0 here is not a case that arises.
  await page.addInitScript(() => {
    window.__frames = 0
    const raf = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (cb) => raf((t) => { window.__frames++; return cb(t) })
  })

  const checks = {}
  let loaded = true, loadError = null

  try {
    await page.goto(`file://${file}`, { waitUntil: 'load', timeout: 45000 })
  } catch (err) {
    loaded = false
    loadError = err.message
  }

  if (loaded) await page.waitForTimeout(bench.settleMs ?? 3000)

  checks.self_contained = checkSelfContained(html, meta)
  checks.economy = checkEconomy(html)
  if (bench.checks.includes('identity')) checks.identity = checkIdentity(html, model)
  checks.loads = loaded
    ? { score: 1, detail: 'loaded' }
    : { score: 0, detail: `navigation failed: ${loadError}` }

  if (loaded) {
    // FPS over a 3s window, measured from the page's own rAF counter.
    const before = await page.evaluate(() => window.__frames)
    const t0 = Date.now()
    await page.waitForTimeout(3000)
    const after = await page.evaluate(() => window.__frames)
    const fps = ((after - before) * 1000) / (Date.now() - t0)

    const shotA = await page.screenshot()
    await fs.writeFile(path.join(shots, '01-initial.png'), shotA)
    const statsA = imageStats(shotA)

    await drive(page, bench.interaction, viewport)
    const shotB = await page.screenshot()
    await fs.writeFile(path.join(shots, '02-after-interaction.png'), shotB)

    await page.waitForTimeout(1200)
    const shotC = await page.screenshot()
    await fs.writeFile(path.join(shots, '03-settled.png'), shotC)

    const errCount = consoleErrors.length + pageErrors.length + failedRequests.length
    checks.console_clean = {
      score: errCount === 0 ? 1 : errCount <= 2 ? 0.5 : 0,
      detail: errCount === 0 ? 'no errors' : `${errCount} error(s): ${[...pageErrors, ...consoleErrors, ...failedRequests][0]}`,
    }

    // Blank/near-uniform pages have near-zero luminance spread. 12 is comfortably
    // above the noise floor of a flat background with a little text on it.
    checks.renders = {
      score: clamp01(statsA.stddev / 12),
      detail: `luminance stddev ${round(statsA.stddev)} (mean ${round(statsA.mean)})`,
    }

    const { fpsTarget, fpsFloor } = (await loadConfig()).scoring
    checks.fps = {
      score: clamp01((fps - fpsFloor) / (fpsTarget - fpsFloor)),
      detail: `${round(fps)} fps`,
      value: round(fps),
    }

    if (bench.interaction) {
      const delta = imageDelta(shotA, shotB)
      checks.interaction = {
        score: clamp01(delta / 4),
        detail: `${bench.interaction}: mean pixel delta ${round(delta, 2)}`,
      }
    }
  }

  await context.close()

  const report = {
    runId,
    modelId: model.id,
    benchmarkId: bench.id,
    ranAt: new Date().toISOString(),
    checks,
    errors: { pageErrors, consoleErrors, failedRequests },
    technical: technicalScore(checks, bench, (await loadConfig()).scoring.gateWeights),
    viable: loaded && (checks.renders?.score ?? 0) > 0.15,
  }
  await writeJson(path.join(dir, 'gates.json'), report)
  return { status: 'done', report }
}

/** Weighted mean over only the checks this benchmark declares — omitted checks cost nothing. */
export function technicalScore(checks, bench, gateWeights) {
  let num = 0, den = 0
  for (const name of bench.checks) {
    const c = checks[name]
    if (!c) continue
    const w = gateWeights[name] ?? 1
    num += c.score * w
    den += w
  }
  return den ? round((num / den) * 100) : null
}

async function main() {
  const argv = parseCli({ headless: { type: 'boolean', default: false } })
  const cfg = await loadConfig()
  const { models, benches } = select(cfg, argv)
  const runId = await resolveRun(argv)

  const browser = await chromium.launch({
    headless: argv.headless,
    args: [
      '--enable-unsafe-swiftshader',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
    ],
  })

  if (argv.headless) {
    warn('headless: WebGL falls back to software rendering, so fps numbers are not comparable to a real GPU')
  }
  log(bold(`\nrun ${runId}`))
  log(dim(`gates  ${models.length} model(s) × ${benches.length} benchmark(s)`))
  log(dim('serial by design — parallel pages fight over the GPU and corrupt the fps measurement\n'))

  // Serial by design: parallel pages compete for the GPU and corrupt the fps measurement.
  for (const model of models) {
    for (const bench of benches) {
      const tag = `${model.id} ${dim('/')} ${bench.id}`
      try {
        const r = await runGates({ runId, model, bench, browser })
        if (r.status === 'missing') { log(dim(`· ${tag} — no deliverable`)); continue }
        const t = r.report.technical
        const line = `${tag} ${dim(`technical ${t}`)} ${dim(Object.entries(r.report.checks).map(([k, v]) => `${k} ${Math.round(v.score * 100)}`).join(' · '))}`
        r.report.viable ? ok(line) : bad(`${line} ${dim('— NOT VIABLE')}`)
      } catch (err) {
        bad(`${tag} — ${err.message}`)
      }
    }
  }

  await browser.close()
  log('')
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
