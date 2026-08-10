import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import {
  loadConfig, parseCli, exists, readJson, writeJson, listRuns, resolveRun, newRunId,
  registerRun, humanFile, auditFile, runDir, ROOT, RUNS, log, bold, dim, green, warn,
} from './lib.mjs'
import { buildScores, buildAllTime, humanKey } from './score.mjs'
import { head, chrome, scoreColorFn, shuffleFn, runSelScript, jsonScript, escFn } from './ui.mjs'
import { controlPage } from './control.mjs'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json',
  '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain; charset=utf-8',
}

/**
 * Opaque submission tokens. The blind page never receives a model id at all — not in the
 * DOM, not in a payload — so it cannot be defeated by opening devtools. The token is a
 * deterministic hash, so it is stable across reloads and recomputable server-side without
 * storing a map.
 */
const tokenFor = (runId, modelId, benchId) => {
  let h = 2166136261
  for (const ch of `${runId}|${benchId}|${modelId}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(36).padStart(7, '0')
}

async function resolveToken(runId, token) {
  const cfg = await loadConfig()
  for (const m of cfg.models) {
    for (const b of cfg.benchmarks) {
      if (tokenFor(runId, m.id, b.id) === token) return { modelId: m.id, benchmarkId: b.id }
    }
  }
  return null
}

/** One pipeline at a time. Subscribers get every line, live and on reconnect. */
const job = { running: false, runId: null, log: [], subs: new Set(), child: null }

function emit(event, data) {
  for (const res of job.subs) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

async function launch({ models, benchmarks, note, audit, topUp }) {
  if (job.running) return { ok: false, error: 'a run is already in progress' }

  const runs = await listRuns()
  let runId
  if (topUp && runs.length) runId = runs[0].id
  else {
    runId = newRunId()
    let n = 1
    while (runs.some((r) => r.id === runId)) runId = `${newRunId()}-${++n}`
    await registerRun(runId, { note: note ?? '' })
  }

  const args = [
    path.join(ROOT, 'src/bench.mjs'),
    '--run', runId,
    ...models.flatMap((m) => ['--model', m]),
    ...benchmarks.flatMap((b) => ['--bench', b]),
    ...(note ? ['--note', note] : []),
    ...(audit ? ['--audit'] : []),
  ]

  Object.assign(job, { running: true, runId, log: [] })
  // report.mjs is the last stage of bench.mjs and would try to bind this same port,
  // so the launcher runs the pipeline stages only.
  const child = spawn(process.execPath, args, { cwd: ROOT, env: { ...process.env, SR_NO_REPORT: '1' } })
  job.child = child

  const feed = (buf) => {
    for (const line of String(buf).split('\n')) {
      // eslint-disable-next-line no-control-regex
      const clean = line.replace(/\x1b\[[0-9;]*m/g, '').trimEnd()
      if (!clean) continue
      job.log.push(clean)
      emit('line', clean)
    }
  }
  child.stdout.on('data', feed)
  child.stderr.on('data', feed)
  child.on('exit', (code) => {
    job.running = false
    job.child = null
    emit('line', code === 0 ? '✓ run complete' : `run finished with exit code ${code}`)
    emit('done', { runId, code })
    for (const res of job.subs) res.end()
    job.subs.clear()
  })

  return { ok: true, runId }
}

/** Aggregate stats across every run on record. */
async function collectStats(cfg) {
  const runs = await listRuns()
  let submissions = 0, rated = 0, blind = 0, verdicts = 0, tokens = 0, seconds = 0, panelSize = 0
  const modelIds = new Set()

  for (const r of runs) {
    const human = (await exists(humanFile(r.id))) ? await readJson(humanFile(r.id)) : {}
    for (const [, v] of Object.entries(human)) {
      if (v.score != null) { rated++; if (v.blind) blind++ }
    }
    for (const m of cfg.models) {
      for (const b of cfg.benchmarks) {
        const dir = runDir(r.id, m.id, b.id)
        if (!(await exists(path.join(dir, 'index.html')))) continue
        submissions++
        modelIds.add(m.id)
        const meta = (await exists(path.join(dir, 'meta.json'))) ? await readJson(path.join(dir, 'meta.json')) : null
        tokens += meta?.usage?.output ?? 0
        seconds += meta?.elapsedSeconds ?? 0
        const j = (await exists(path.join(dir, 'judge.json'))) ? await readJson(path.join(dir, 'judge.json')) : null
        if (j) { verdicts += j.judgeCount ?? 0; panelSize = Math.max(panelSize, j.judgeCount ?? 0) }
      }
    }
  }
  return {
    runs: runs.length, latest: runs[0]?.id ?? null, submissions, rated, blind, verdicts,
    tokens, seconds, panelSize, models: modelIds.size, benchmarks: cfg.benchmarks.length,
  }
}

async function main() {
  // node:util parseArgs has no --no-x negation, so the opt-out is its own flag.
  const argv = parseCli({ port: { type: 'string', default: '4321' }, 'no-open': { type: 'boolean', default: false } })
  const port = Number(argv.port)
  // The control center must work before any run exists, so this is tolerant.
  const defaultRun = (await listRuns())[0]?.id ?? (argv.run ?? '')

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`)
    try {
      const runs = await listRuns()
      const runId = url.searchParams.get('run') || job.runId || runs[0]?.id || defaultRun

      if (req.method === 'POST' && url.pathname === '/api/human') {
        const body = JSON.parse(await readBody(req))
        const target = body.token ? await resolveToken(body.runId, body.token) : body
        if (!target) return send(res, 400, 'application/json', JSON.stringify({ error: 'unknown token' }))
        const hf = humanFile(body.runId)
        const human = (await exists(hf)) ? await readJson(hf) : {}
        const key = humanKey(target.modelId, target.benchmarkId)
        if (body.score == null && !body.note) delete human[key]
        else human[key] = { score: body.score, note: body.note ?? '', blind: !!body.blind, at: new Date().toISOString() }
        await writeJson(hf, human)
        return send(res, 200, 'application/json', JSON.stringify({ ok: true }))
      }

      if (url.pathname === '/api/scores') {
        return send(res, 200, 'application/json', JSON.stringify(await buildScores(await loadConfig(), runId)))
      }

      if (req.method === 'POST' && url.pathname === '/api/launch') {
        return send(res, 200, 'application/json', JSON.stringify(await launch(JSON.parse(await readBody(req)))))
      }

      if (url.pathname === '/api/reveal') {
        const cfg = await loadConfig()
        const benchId = url.searchParams.get('bench')
        const scores = await buildScores(cfg, runId)
        const out = {}
        for (const c of scores.cells) {
          if (c.benchmarkId !== benchId || !c.present) continue
          const m = cfg.models.find((x) => x.id === c.modelId)
          out[tokenFor(runId, c.modelId, c.benchmarkId)] =
            { label: m?.label ?? c.modelId, judge: c.judge, technical: c.technical, final: c.final }
        }
        return send(res, 200, 'application/json', JSON.stringify(out))
      }

      if (url.pathname === '/api/job') {
        return send(res, 200, 'application/json', JSON.stringify({ running: job.running, runId: job.runId, log: job.log }))
      }

      if (url.pathname === '/api/stream') {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        })
        res.write(': connected\n\n')
        job.subs.add(res)
        req.on('close', () => job.subs.delete(res))
        if (!job.running) { res.write(`event: done\ndata: ${JSON.stringify({ runId: job.runId })}\n\n`); res.end() }
        return
      }

      if (url.pathname === '/' || url.pathname === '/index.html') {
        const cfg = await loadConfig()
        return send(res, 200, MIME['.html'], controlPage({
          runs, stats: await collectStats(cfg), models: cfg.models, benchmarks: cfg.benchmarks,
          activeRun: job.runId ?? runId,
        }))
      }

      if (url.pathname === '/board') {
        const scores = await buildScores(await loadConfig(), runId)
        const audit = (await exists(auditFile(runId))) ? await readJson(auditFile(runId)) : null
        return send(res, 200, MIME['.html'], boardPage(scores, runs, audit))
      }

      if (url.pathname === '/blind') {
        const scores = await buildScores(await loadConfig(), runId)
        return send(res, 200, MIME['.html'], blindPage(scores, runs))
      }

      if (url.pathname === '/history') {
        const cfg = await loadConfig()
        return send(res, 200, MIME['.html'], overallPage(await buildAllTime(cfg), runs))
      }

      // Blind assets: /s/<run>/<token>/<path>. The URL never contains the model id, so a
      // link target or a network tab cannot give the answer away before you have rated it.
      const blindAsset = url.pathname.match(/^\/s\/([^/]+)\/([^/]+)\/(.+)$/)
      if (blindAsset) {
        const [, bRun, token, rest] = blindAsset
        const target = await resolveToken(bRun, token)
        if (!target) return send(res, 404, 'text/plain', 'unknown token')
        const file = path.join(runDir(bRun, target.modelId, target.benchmarkId), decodeURIComponent(rest))
        if (!path.resolve(file).startsWith(RUNS)) return send(res, 403, 'text/plain', 'nope')
        return send(res, 200, MIME[path.extname(file)] ?? 'application/octet-stream', await fs.readFile(file))
      }

      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
      if (rel.startsWith('runs/')) {
        const file = path.join(ROOT, rel)
        if (!path.resolve(file).startsWith(path.join(ROOT, 'runs'))) return send(res, 403, 'text/plain', 'nope')
        return send(res, 200, MIME[path.extname(file)] ?? 'application/octet-stream', await fs.readFile(file))
      }

      send(res, 404, 'text/plain', 'not found')
    } catch (err) {
      send(res, err.code === 'ENOENT' ? 404 : 500, 'text/plain', err.message)
    }
  })

  server.listen(port, () => {
    log(bold(`\n  control centre → ${green(`http://localhost:${port}`)}`) + dim('   launch runs, watch them live'))
    log(bold(`  blind review   → ${green(`http://localhost:${port}/blind`)}`) + dim('   rate before you know who built it'))
    log(bold(`  scoreboard     → ${green(`http://localhost:${port}/board`)}`))
    log(dim(`\n  ${defaultRun ? `run ${defaultRun}` : 'no runs yet — launch one from the control centre'}`))
    log(dim('  ratings save to results/<run>/human.json as you move a slider. ctrl-c to stop.\n'))
    if (!argv['no-open']) {
      import('node:child_process').then(({ exec }) =>
        exec(`${process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'} http://localhost:${port}`),
      )
    }
  })
}

const readBody = (req) => new Promise((resolve, reject) => {
  let b = ''
  req.on('data', (c) => (b += c))
  req.on('end', () => resolve(b))
  req.on('error', reject)
})

const send = (res, code, type, body) => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(body)
}

/* ── blind review ──────────────────────────────────────────────────────────
   Model names are not sent to this page at all. Each submission gets a letter,
   ordered by a hash of (run, benchmark, model) so the order is stable across
   reloads but tells you nothing. Names arrive only when you press Reveal, and
   only for benchmarks you have finished rating.                            */

function blindPage(scores, runs) {
  // Everything identifying is stripped here, on the server. The order is a hash of the
  // token so it is stable but tells you nothing, and the letters follow that order.
  const anon = scores.cells
    .filter((c) => c.present)
    .map((c) => ({
      token: tokenFor(scores.runId, c.modelId, c.benchmarkId),
      benchmarkId: c.benchmarkId,
      href: `/s/${scores.runId}/${tokenFor(scores.runId, c.modelId, c.benchmarkId)}/index.html`,
      shotDir: `/s/${scores.runId}/${tokenFor(scores.runId, c.modelId, c.benchmarkId)}/shots`,
      human: c.human, humanNote: c.humanNote, viable: c.viable, fps: c.fps,
    }))
    .sort((a, b) => (a.token < b.token ? -1 : 1))

  return `${head('Blind review · StarRise Benchmark')}
${chrome({ tab: 'blind', runId: scores.runId, runs, extra: '<span class="meta" id="prog"></span>' })}
<div class="note"><strong>Rate before you know who built it.</strong> Every submission is anonymous —
the model names are not sent to this page at all, only opaque tokens, so there is nothing to peek at.
Open each one live, score it 0&ndash;10 on whether <em>you</em> would ship it, then press Reveal to see
who was who and how your ranking compares to the judge panel.</div>
<div id="app"></div>
</div>
<div class="lightbox" id="lb"><img id="lbimg" alt=""></div>
<script>
const RUN=${jsonScript(scores.runId)}, CELLS=${jsonScript(anon)},
      BENCHES=${jsonScript(scores.benchmarks)};
${scoreColorFn}
${escFn}
const LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const REVEALED={};

function forBench(b){
  return CELLS.filter(c=>c.benchmarkId===b.id).map((c,i)=>({ ...c, letter: LETTERS[i] }));
}

function card(c, names){
  const n = names && names[c.token];
  const pills=[
    c.viable===false&&'<span class="pill b">not viable</span>',
    c.fps!=null&&'<span class="pill'+(c.fps>=50?' g':c.fps>=30?'':' w')+'">'+c.fps+' fps</span>',
    n&&'<span class="pill">judges '+(n.judge??'—')+'</span>',
    n&&'<span class="pill">tech '+(n.technical??'—')+'</span>',
  ].filter(Boolean).join('');
  return \`<div class="card" data-token="\${c.token}">
    <div class="top">
      <span style="display:flex;align-items:center;gap:10px">
        <span class="tag">\${c.letter}</span>
        <span class="name">\${n ? esc(n.label) : 'Submission ' + c.letter}</span>
      </span>
      <span style="display:flex;gap:12px">
        <a href="\${c.href}" target="_blank" rel="noopener">open ↗</a>
        <button class="link" data-live="\${c.href}">embed</button>
      </span>
    </div>
    <div class="shot" data-full="\${c.shotDir}/03-settled.png">
      <img src="\${c.shotDir}/01-initial.png" alt="" loading="lazy"
        onerror="this.parentElement.innerHTML='<div class=empty>no screenshot — run gates</div>'">
      <span class="badge">\${c.letter} · initial frame</span>
    </div>
    <div class="body"><div class="pillbar">\${pills}</div></div>
    <div class="human">
      <div class="lab"><span>Your score</span><span><span class="val">\${c.human!=null?c.human:'—'}</span> <span class="saved">saved</span></span></div>
      <input type="range" min="0" max="10" step="0.5" value="\${c.human??5}" \${c.human==null?'data-unset="1"':''}>
      <textarea placeholder="Why? (optional)">\${esc(c.humanNote||'')}</textarea>
    </div></div>\`;
}

function render(){
  let rated=0,total=0;
  document.getElementById('app').innerHTML = BENCHES.map(b=>{
    const cs=forBench(b); if(!cs.length) return '';
    const done=cs.filter(c=>c.human!=null).length; rated+=done; total+=cs.length;
    const names=REVEALED[b.id];
    const ranking = names ? [...cs].filter(c=>c.human!=null).sort((x,y)=>y.human-x.human)
      .map((c,i)=>\`<span class="pill">\${i+1}. \${names[c.token]?.label??c.letter} — you \${c.human*10} / judges \${names[c.token]?.judge??'—'}</span>\`).join(' ') : '';
    return \`<h2>\${b.label} <small>\${b.category} · \${done}/\${cs.length} rated</small></h2>
      <div class="reveal">
        <div class="bar"><i style="width:\${cs.length?done/cs.length*100:0}%"></i></div>
        <button class="btn" data-reveal="\${b.id}" \${done<cs.length&&!names?'disabled':''}>\${names?'Hide names':'Reveal names'}</button>
      </div>
      \${names?'<div class="pillbar" style="margin-bottom:12px">'+ranking+'</div>':''}
      <div class="grid">\${cs.map(c=>card(c,names)).join('')}</div>\`;
  }).join('');
  document.getElementById('prog').textContent = rated+' / '+total+' rated';
}

let t;
document.addEventListener('input', e=>{
  const card=e.target.closest('.card'); if(!card) return;
  const range=card.querySelector('input[type=range]'), note=card.querySelector('textarea');
  if(e.target===range){ range.removeAttribute('data-unset'); card.querySelector('.val').textContent=range.value }
  const score=range.hasAttribute('data-unset')?null:Number(range.value);
  const c=CELLS.find(x=>x.token===card.dataset.token);
  if(c){ c.human=score; c.humanNote=note.value }
  clearTimeout(t);
  t=setTimeout(async()=>{
    await fetch('/api/human',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({runId:RUN,token:card.dataset.token,score,note:note.value,blind:true})});
    const s=card.querySelector('.saved'); s.classList.add('on'); setTimeout(()=>s.classList.remove('on'),1200);
    render();
  },400);
});

document.addEventListener('click', async e=>{
  const rev=e.target.closest('[data-reveal]');
  if(rev){
    const id=rev.dataset.reveal;
    if(REVEALED[id]) delete REVEALED[id];
    else REVEALED[id]=await (await fetch('/api/reveal?run='+encodeURIComponent(RUN)+'&bench='+encodeURIComponent(id))).json();
    render(); return;
  }
  const live=e.target.closest('[data-live]');
  if(live){ const h=live.closest('.card').querySelector('.shot');
    if(h&&h.tagName!=='IFRAME'){ const f=document.createElement('iframe'); f.src=live.dataset.live;
      f.setAttribute('sandbox','allow-scripts allow-pointer-lock'); h.replaceWith(f); live.textContent='running' } return }
  const shot=e.target.closest('.shot[data-full]');
  if(shot){ document.getElementById('lbimg').src=shot.dataset.full; document.getElementById('lb').classList.add('on'); return }
  if(e.target.closest('#lb')) document.getElementById('lb').classList.remove('on');
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape') document.getElementById('lb').classList.remove('on') });
render();
${runSelScript('blind')}
</script></body></html>`
}

/* ── scoreboard (names visible) ─────────────────────────────────────────── */

function boardPage(scores, runs, audit) {
  return `${head('Scoreboard · StarRise Benchmark')}
${chrome({ tab: 'board', runId: scores.runId, runs, extra: `<span class="meta">tech ${scores.weights.technical} · judge ${scores.weights.judge} · human ${scores.weights.human}</span>` })}
<div id="app"></div></div>
<div class="lightbox" id="lb"><img id="lbimg" alt=""></div>
<script>
const DATA=${jsonScript(scores)}, AUDIT=${jsonScript(audit)}, AXES=DATA.axes;
const cell=(m,b)=>DATA.cells.find(c=>c.modelId===m&&c.benchmarkId===b);
const label=id=>(DATA.models.find(m=>m.id===id)||{}).label||id;
const fmt=v=>v==null?'—':v;
${scoreColorFn}
${escFn}

function leaderboard(){
  const rows=DATA.leaderboard.filter(r=>r.attempted).map((r,i)=>\`<tr>
    <td class="rank">\${r.overall==null?'':i+1}</td>
    <td><strong>\${esc(r.label)}</strong> <span class="prov">\${esc(r.provider==='manual'?'manual':r.vendor||'')}</span></td>
    <td class="num big" style="color:\${scoreColor(r.overall)}">\${fmt(r.overall)}</td>
    <td class="num">\${fmt(r.technical)}</td><td class="num">\${fmt(r.judge)}</td>
    <td class="num">\${fmt(r.human)}</td><td class="num">\${r.attempted}/\${r.total}</td>
    <td class="num" style="color:\${r.scored&&r.reviewed===r.scored?'var(--acc)':'var(--warn)'}">\${r.reviewed}/\${r.scored}\${r.blindReviewed?' <span class="prov">blind</span>':''}</td>
    <td class="num" style="color:\${r.redFlags?'var(--bad)':'var(--dim)'}">\${r.redFlags||'—'}</td></tr>\`).join('');
  return \`<h2>Leaderboard <small>rows without a human score are provisional</small></h2>
  <table><thead><tr><th></th><th>Model</th><th class="num">Overall</th><th class="num">Tech</th>
  <th class="num">Judges</th><th class="num">You</th><th class="num">Built</th>
  <th class="num">Rated</th><th class="num">Flags</th></tr></thead><tbody>\${rows}</tbody></table>\`;
}

function auditTable(){
  if(!AUDIT) return '';
  return Object.entries(AUDIT.benchmarks).map(([bid,b])=>\`
    <h2>Judge audit · \${bid} <small>\${b.identityDisclosed?'authorship disclosed — sharp probe':'authorship hidden — control'}</small></h2>
    <table><thead><tr><th>Judge</th><th class="num">Gave</th><th class="num">Lenient</th>
    <th class="num">Spread</th><th class="num">Agrees</th><th class="num">Own score</th>
    <th class="num">Self-bias</th><th class="num">Vendor bias</th></tr></thead><tbody>
    \${b.rows.map(r=>\`<tr><td>\${label(r.judgeId)}</td><td class="num">\${fmt(r.meanScoreGiven)}</td>
      <td class="num">\${fmt(r.leniency)}</td><td class="num">\${fmt(r.discrimination)}</td>
      <td class="num">\${fmt(r.agreement)}</td><td class="num">\${fmt(r.selfScore)}</td>
      <td class="num" style="color:\${Math.abs(r.selfBias??0)>=6?'var(--bad)':Math.abs(r.selfBias??0)>=3?'var(--warn)':'var(--acc)'}">\${r.selfBias==null?'—':(r.selfBias>0?'+':'')+r.selfBias}</td>
      <td class="num">\${r.vendorBias==null?'—':(r.vendorBias>0?'+':'')+r.vendorBias}</td></tr>\`).join('')}
    </tbody></table>
    <div class="meta" style="margin-top:8px">self-bias = how much better a judge scored its own work than the rest of the panel did, net of its own leniency</div>\`).join('');
}

function judgeBlock(c){
  if(!c.judgeCount||!c.judgeDetail) return '<div style="color:var(--dim);font-size:12px">not judged</div>';
  const j=c.judgeDetail;
  const ax=AXES.map(a=>{const x=j.axes[a.id];
    return \`<div class="axrow"><span>\${a.label}</span><span>\${x.median}<span style="color:var(--dim)" class="\${x.spread>=4?'spread':''}"> · \${Object.entries(x.byJudge).map(([k,v])=>k+' '+v).join('  ')}</span></span></div>\`}).join('');
  const panel=j.panel.map(p=>\`<div class="judge">
    <div class="jh"><span>\${esc(p.judgeLabel)}\${p.sawImages===false?' (no vision)':''}</span><span>\${AXES.map(a=>p.scores[a.id]).join('/')}</span></div>
    <div style="margin-top:5px">\${esc(p.summary)}</div>
    \${p.strengths?.length?'<ul>'+p.strengths.map(s=>'<li>+ '+esc(s)+'</li>').join('')+'</ul>':''}
    \${p.weaknesses?.length?'<ul>'+p.weaknesses.map(s=>'<li>− '+esc(s)+'</li>').join('')+'</ul>':''}
    \${p.redFlags?.length?'<ul>'+p.redFlags.map(s=>'<li class="flag">! '+esc(s)+'</li>').join('')+'</ul>':''}</div>\`).join('');
  return \`<div>\${ax}</div><details><summary>\${j.panel.length} judge verdicts\${c.maxSpread>=4?' — panel split':''}</summary><div class="inner">\${panel}</div></details>\`;
}

function card(c){
  if(!c.present) return \`<div class="card dead"><div class="top"><span class="name">\${esc(label(c.modelId))}</span>
    <span class="prov">\${c.expectedManual?'awaiting manual drop':'not built'}</span></div>
    <div class="shot"><div class="empty">no deliverable</div></div></div>\`;
  const pills=[
    c.viable===false&&'<span class="pill b">not viable</span>',
    c.fps!=null&&'<span class="pill'+(c.fps>=50?' g':c.fps>=30?'':' w')+'">'+c.fps+' fps</span>',
    c.maxSpread>=4&&'<span class="pill w">panel split '+c.maxSpread+'</span>',
    c.redFlags.length&&'<span class="pill b">'+c.redFlags.length+' flag'+(c.redFlags.length>1?'s':'')+'</span>',
    c.humanBlind&&'<span class="pill g">rated blind</span>',
    c.bytes&&'<span class="pill">'+Math.round(c.bytes/1024)+'kb</span>',
    c.elapsedSeconds&&'<span class="pill">'+Math.round(c.elapsedSeconds)+'s</span>',
  ].filter(Boolean).join('');
  return \`<div class="card"><div class="top"><span class="name">\${esc(label(c.modelId))}</span>
    <span style="display:flex;gap:12px"><a href="\${c.href}" target="_blank" rel="noopener">open ↗</a>
    <button class="link" data-live="\${c.href}">embed</button></span></div>
    <div class="shot" data-full="\${c.shotDir}/03-settled.png">
      <img src="\${c.shotDir}/01-initial.png" alt="" loading="lazy"
        onerror="this.parentElement.innerHTML='<div class=empty>no screenshot — run gates</div>'">
      <span class="badge">initial frame</span></div>
    <div class="scores">
      <div><div class="k">Final</div><div class="v" style="color:\${scoreColor(c.final)}">\${fmt(c.final)}</div></div>
      <div><div class="k">Tech</div><div class="v">\${fmt(c.technical)}</div></div>
      <div><div class="k">Judges</div><div class="v">\${fmt(c.judge)}</div></div>
      <div><div class="k">You</div><div class="v" style="color:\${c.human!=null?'var(--acc)':'var(--dim)'}">\${c.human!=null?c.human*10:'—'}</div></div>
    </div>
    <div class="body"><div class="pillbar">\${pills}</div>\${judgeBlock(c)}
      \${c.humanNote?'<div class="axrow" style="color:var(--mut)">“'+esc(c.humanNote)+'”</div>':''}</div></div>\`;
}

function render(){
  const sections=DATA.benchmarks.map(b=>{
    const cs=DATA.models.map(m=>cell(m.id,b.id)).filter(Boolean)
      .filter(c=>c.present||c.expectedManual)
      .sort((a,z)=>(z.final??-1)-(a.final??-1));
    if(!cs.length) return '';
    return \`<h2>\${b.label} <small>\${b.category}\${b.mode==='manual'?' · manual':''}</small></h2>
      <div class="grid">\${cs.map(card).join('')}</div>\`;
  }).join('');
  document.getElementById('app').innerHTML=leaderboard()+auditTable()+sections;
}

Promise.all(DATA.cells.filter(c=>c.present&&c.judgeCount).map(async c=>{
  try{ c.judgeDetail=await (await fetch(c.href.replace('index.html','judge.json'))).json() }catch{}
})).then(render);

document.addEventListener('click',e=>{
  const live=e.target.closest('[data-live]');
  if(live){ const h=live.closest('.card').querySelector('.shot');
    if(h&&h.tagName!=='IFRAME'){ const f=document.createElement('iframe'); f.src=live.dataset.live;
      f.setAttribute('sandbox','allow-scripts allow-pointer-lock'); h.replaceWith(f); live.textContent='running' } return }
  const shot=e.target.closest('.shot[data-full]');
  if(shot){ document.getElementById('lbimg').src=shot.dataset.full; document.getElementById('lb').classList.add('on'); return }
  if(e.target.closest('#lb')) document.getElementById('lb').classList.remove('on');
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape') document.getElementById('lb').classList.remove('on') });
${runSelScript('board')}
</script></body></html>`
}

/* ── all-time: every model, pooled across every run ────────────────────────
   This is the view that matters once runs stop containing the whole roster.   */

function overallPage(all, runs) {
  return `${head('Overall · StarRise Benchmark')}
${chrome({ tab: 'history', runId: runs[0]?.id ?? '', runs })}
<div class="note">Pooled across <strong>every run on record</strong>. When a run contains only the
model that just shipped, this is where you compare it with everything that came before. Scores from
more than one run are averaged; <span class="prov">n</span> is the sample count and a single sample
is not a settled number.</div>
<div id="app"></div></div>
<script>
const A=${jsonScript(all)};
${scoreColorFn}
${escFn}
const fmt=v=>v==null?'—':v;

const HUES=['#7dd3a0','#7fb5ff','#e8b661','#e8776d','#b89cf0','#6fd3d3','#f0a3c8','#a3d977','#d9a066','#8fa8ff'];

/* One run on record is not a trend: every model lands in the same column and the labels stack on
   top of each other. Until there are two runs to join with a line, the standings say more. */
function standings(){
  const rows=A.models.filter(m=>m.overall!=null);
  if(!rows.length) return '';
  return \`<h2>Standings <small>overall score, pooled — one run on record, so this is a snapshot, not a trend</small></h2>
    <div class="panelbox">\${rows.map((m,i)=>\`<div class="srow">
      <span class="rank">\${i+1}</span>
      <span class="slab">\${esc(m.label)}\${m.isNew?' <span class="pill g">new</span>':''}</span>
      <span class="strack" title="\${esc(m.label)}: \${m.overall}"><i style="width:\${m.overall}%;background:\${scoreColor(m.overall)}"></i></span>
      <span class="sval" style="color:\${scoreColor(m.overall)}">\${m.overall}</span>
      <span class="scov" title="benchmarks covered">\${m.coverage}/\${m.totalBenchmarks}</span>
    </div>\`).join('')}</div>\`;
}

/* Labels sit at the end of each line, so two models that finish a run within a point of each other
   would print on top of one another. Push them apart, then draw a leader back to the real value. */
function declutter(labs, top, bottom, gap){
  labs.sort((a,b)=>a.y-b.y);
  for(let i=1;i<labs.length;i++) if(labs[i].y-labs[i-1].y<gap) labs[i].y=labs[i-1].y+gap;
  const over=labs.length?labs[labs.length-1].y-bottom:0;
  if(over>0){
    for(const l of labs) l.y-=over;
    for(let i=labs.length-2;i>=0;i--) if(labs[i+1].y-labs[i].y<gap) labs[i].y=labs[i+1].y-gap;
  }
  for(const l of labs) l.y=Math.max(top, l.y);
  return labs;
}

function trend(){
  const runs=A.perRun; if(runs.length<2) return '';
  const W=Math.max(880, runs.length*150+300), H=340, PAD={l:46,r:186,t:20,b:38};
  const series=A.models.map(m=>({ label:m.label,
    pts: runs.map((r,i)=>{ const row=r.leaderboard.find(x=>x.modelId===m.modelId);
      return row&&row.overall!=null?{x:i,y:row.overall}:null }).filter(Boolean) })).filter(s=>s.pts.length);
  if(!series.length) return '';
  const X=i=>PAD.l+i*(W-PAD.l-PAD.r)/(runs.length-1);
  const Y=v=>PAD.t+(100-v)/100*(H-PAD.t-PAD.b);
  const grid=[0,25,50,75,100].map(v=>\`<line x1="\${PAD.l}" x2="\${W-PAD.r}" y1="\${Y(v)}" y2="\${Y(v)}" stroke="#262a31"/>
    <text x="\${PAD.l-9}" y="\${Y(v)+4}" fill="#5b626d" font-size="10" text-anchor="end" font-family="monospace">\${v}</text>\`).join('');
  const xlab=runs.map((r,i)=>\`<text x="\${X(i)}" y="\${H-14}" fill="#5b626d" font-size="10" text-anchor="middle" font-family="monospace">\${esc(r.runId.slice(5))}</text>\`).join('');
  const lines=series.map((s,i)=>{ const c=HUES[i%HUES.length];
    const d=s.pts.map((p,j)=>(j?'L':'M')+X(p.x)+' '+Y(p.y)).join(' ');
    const dots=s.pts.map(p=>\`<circle cx="\${X(p.x)}" cy="\${Y(p.y)}" r="3.5" fill="\${c}"><title>\${esc(s.label)}: \${p.y}</title></circle>\`).join('');
    // A model seen in exactly one run has no line to draw — ring the dot so it reads as a point.
    const solo=s.pts.length===1?\`<circle cx="\${X(s.pts[0].x)}" cy="\${Y(s.pts[0].y)}" r="7" fill="none" stroke="\${c}" stroke-opacity=".45"/>\`:'';
    return \`<path d="\${d}" fill="none" stroke="\${c}" stroke-width="2" stroke-linejoin="round"/>\${solo}\${dots}\`}).join('');
  const labs=declutter(series.map((s,i)=>({ c:HUES[i%HUES.length], label:s.label, score:s.pts.at(-1).y,
    anchor:Y(s.pts.at(-1).y), y:Y(s.pts.at(-1).y) })), PAD.t+4, H-PAD.b, 15);
  const tags=labs.map(l=>\`<path d="M\${W-PAD.r-2} \${l.anchor} L\${W-PAD.r+7} \${l.y-4}" stroke="\${l.c}" stroke-opacity=".35" fill="none"/>
    <text x="\${W-PAD.r+11}" y="\${l.y}" fill="\${l.c}" font-size="11">\${esc(l.label)} <tspan font-family="monospace" fill-opacity=".7">\${l.score}</tspan></text>\`).join('');
  return \`<h2>Quality over time <small>overall score per run — a model appears as a ringed point, not a line, until it has been run twice</small></h2>
    <div class="panelbox">
    <svg viewBox="0 0 \${W} \${H}" style="min-width:\${Math.min(W,880)}px" role="img" aria-label="overall score by run">\${grid}\${xlab}\${lines}\${tags}</svg></div>\`;
}

const chart=()=>A.perRun.length>=2?trend():standings();

function board(){
  const bs=A.benchmarks;
  const rows=A.models.map((m,i)=>\`<tr>
    <td class="rank">\${i+1}</td>
    <td><strong>\${esc(m.label)}</strong> \${m.isNew?'<span class="pill g">new</span>':''} <span class="prov">\${esc(m.vendor||'')}</span></td>
    <td class="num big" style="color:\${scoreColor(m.overall)}">\${fmt(m.overall)}</td>
    \${bs.map(b=>{ const c=m.cells.find(x=>x.benchmarkId===b.id);
      if(!c||c.mean==null) return '<td class="num" style="color:var(--dim)">—</td>';
      return \`<td class="num" style="color:\${scoreColor(c.mean)}" title="\${c.n} run(s)\${c.n>1?', spread '+c.spread:''}">\${c.mean}\${c.n>1?'<span class="prov"> n'+c.n+'</span>':''}</td>\`}).join('')}
    <td class="num">\${m.coverage}/\${m.totalBenchmarks}</td></tr>\`).join('');
  return \`<h2>All-time leaderboard <small>hover a cell for its sample count</small></h2>
    <table><thead><tr><th></th><th>Model</th><th class="num">Overall</th>
    \${bs.map(b=>\`<th class="num" title="\${esc(b.label)}">\${esc(b.id.split('-')[0])}</th>\`).join('')}
    <th class="num">Cov</th></tr></thead><tbody>\${rows}</tbody></table>
    <div class="meta" style="margin-top:8px">\${bs.map(b=>esc(b.id.split('-')[0]+' = '+b.label)).join(' · ')}</div>\`;
}

function perRun(){
  if(A.perRun.length<2) return '';
  const ids=A.models.map(m=>m.modelId);
  return \`<h2>By run <small>blank means the model was not in that run</small></h2>
  <table><thead><tr><th>Model</th>\${A.perRun.map(r=>\`<th class="num" title="\${esc(r.note||'')}">\${esc(r.runId)}</th>\`).join('')}</tr></thead>
  <tbody>\${ids.map(id=>{ const m=A.models.find(x=>x.modelId===id);
    return \`<tr><td><strong>\${esc(m.label)}</strong></td>\${A.perRun.map(r=>{ const row=r.leaderboard.find(x=>x.modelId===id);
      return \`<td class="num" style="color:\${scoreColor(row?.overall)}">\${row&&row.attempted?fmt(row.overall):''}</td>\`}).join('')}</tr>\`}).join('')}
  </tbody></table>\`;
}

document.getElementById('app').innerHTML = chart()+board()+perRun();
${runSelScript('board')}
</script></body></html>`
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
