import { head, chrome, scoreColorFn, shuffleFn, runSelScript, jsonScript } from './ui.mjs'

/**
 * Control center: stats, run history, and launching a run with live output.
 *
 * Blindness is preserved by masking. The launcher knows which models it is running —
 * you picked them — but the live log rewrites every model id to the same stable letter
 * the blind review page uses, so you cannot associate "took 92s, produced 140kb" with a
 * particular submission before you have rated it. Flip Blind mode off to see real names.
 */
export function controlPage({ runs, stats, models, benchmarks, activeRun }) {
  return `${head('Control · StarRise Benchmark')}
${chrome({ tab: 'control', runId: activeRun ?? runs[0]?.id ?? '', runs, extra: '<label class="meta" style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="blindmode" checked> blind mode</label>' })}

<div class="stats" id="stats"></div>

<h2>Launch a run <small>generate → gates → judges → score</small></h2>
<div class="launch">
  <div class="pickers">
    <div class="picker">
      <div class="lab">Models <button class="link" data-all="models">all</button> <button class="link" data-none="models">none</button></div>
      <div class="opts" id="pm">${models.map((m) => `<label class="opt${m.provider === 'manual' ? ' manual' : ''}">
        <input type="checkbox" value="${m.id}" ${m.provider === 'manual' || m.disabled ? '' : 'checked'}>
        <span>${m.label}</span>${m.provider === 'manual' ? '<em>manual</em>' : `<em>${m.vendor ?? ''}</em>`}</label>`).join('')}</div>
    </div>
    <div class="picker">
      <div class="lab">Benchmarks <button class="link" data-all="benches">all</button> <button class="link" data-none="benches">none</button></div>
      <div class="opts" id="pb">${benchmarks.map((b) => `<label class="opt${b.mode === 'manual' || b.disabled ? ' manual' : ''}">
        <input type="checkbox" value="${b.id}" ${b.mode === 'manual' || b.disabled ? '' : 'checked'}>
        <span>${b.label}</span><em>${b.disabled ? 'off' : b.mode === 'manual' ? 'manual' : b.category.split('—')[0].trim()}</em></label>`).join('')}</div>
    </div>
  </div>
  <div class="ctl">
    <input id="note" placeholder="Label this run (optional) — e.g. “july baseline”">
    <label class="meta" style="display:flex;gap:7px;align-items:center"><input type="checkbox" id="doaudit"> also audit judges</label>
    <label class="meta" style="display:flex;gap:7px;align-items:center"><input type="checkbox" id="topup"> add to newest run instead of starting a new one</label>
    <button class="btn go" id="launch">Start run</button>
  </div>
</div>

<div id="livewrap" hidden>
  <h2>Live <small id="livemeta"></small></h2>
  <div class="stagebar" id="stages"></div>
  <pre class="console" id="console"></pre>
</div>

<h2>Runs <small>every run is kept — nothing is overwritten</small></h2>
<div id="runs"></div>
</div>

<style>
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:20px 0 4px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:13px 15px}
.stat .k{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim)}
.stat .v{font:600 24px/1.3 var(--mono);margin-top:3px}
.stat .s{font-size:11.5px;color:var(--mut)}
.launch{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px}
.pickers{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media(max-width:820px){.pickers{grid-template-columns:1fr}}
.picker .lab{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);
  margin-bottom:9px;display:flex;gap:9px;align-items:center}
.opts{display:flex;flex-direction:column;gap:2px;max-height:270px;overflow:auto}
.opt{display:flex;align-items:center;gap:9px;padding:5px 8px;border-radius:6px;font-size:13px;cursor:pointer}
.opt:hover{background:var(--panel2)}
.opt em{margin-left:auto;font-style:normal;font:11px var(--mono);color:var(--dim)}
.opt.manual{opacity:.55}
.ctl{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:16px;
  padding-top:14px;border-top:1px solid var(--line)}
.ctl input#note{flex:1;min-width:220px;background:#0e1013;border:1px solid var(--line);
  border-radius:7px;color:var(--fg);padding:8px 11px;font:13px inherit}
.btn.go{background:var(--acc);color:#07130d;border-color:var(--acc);font-weight:600}
.btn.go:hover{filter:brightness(1.08)}
.stagebar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.stage{padding:5px 11px;border-radius:99px;border:1px solid var(--line);font:11.5px var(--mono);color:var(--dim)}
.stage.on{color:var(--fg);border-color:var(--acc);background:#12241a}
.stage.done{color:var(--acc)}
.console{background:#080a0c;border:1px solid var(--line);border-radius:9px;padding:14px 16px;
  font:12px/1.65 var(--mono);color:var(--mut);max-height:420px;overflow:auto;white-space:pre-wrap;margin:0}
.console b{color:var(--fg);font-weight:600}
.console .g{color:var(--acc)} .console .r{color:var(--bad)} .console .y{color:var(--warn)}
.runrow{display:flex;align-items:center;gap:14px;padding:11px 14px;background:var(--panel);
  border:1px solid var(--line);border-radius:9px;margin-bottom:8px;flex-wrap:wrap}
.runrow .id{font:13px var(--mono);font-weight:600}
.runrow .n{color:var(--mut);font-size:13px}
.runrow .sp{margin-left:auto;display:flex;gap:10px;align-items:center}
</style>

<script>
const RUNS=${jsonScript(runs)}, STATS=${jsonScript(stats)},
      MODELS=${jsonScript(models.map((m) => ({ id: m.id, label: m.label })))};
${shuffleFn}
${scoreColorFn}
const LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let blind=true, jobRun=null;

/* Mask model ids in the live log so watching a run does not tell you whose work is whose. */
function maskOrder(runId){
  const ids=MODELS.map(m=>m.id);
  const order=blindOrder(runId||'x','_launch',ids);
  return Object.fromEntries(order.map((id,i)=>[id,'Model '+LETTERS[i]]));
}
function mask(line){
  if(!blind) return line;
  const map=maskOrder(jobRun);
  for(const m of MODELS){ line=line.split(m.id).join(map[m.id]).split(m.label).join(map[m.id]) }
  return line;
}

function renderStats(){
  const s=STATS;
  document.getElementById('stats').innerHTML=[
    ['Runs',s.runs,s.latest?('latest '+s.latest):''],
    ['Submissions',s.submissions,s.models+' models · '+s.benchmarks+' tasks'],
    ['Rated by you',s.rated+'/'+s.submissions,s.blind+' rated blind'],
    ['Judge verdicts',s.verdicts,s.panelSize?('panel of '+s.panelSize):''],
    ['Output tokens',s.tokens?(s.tokens/1e6).toFixed(2)+'M':'—','across all runs'],
    ['Build time',s.seconds?Math.round(s.seconds/60)+'m':'—','model generation'],
  ].map(([k,v,sub])=>\`<div class="stat"><div class="k">\${k}</div><div class="v">\${v}</div><div class="s">\${sub||''}</div></div>\`).join('');
}

function renderRuns(){
  document.getElementById('runs').innerHTML = RUNS.length ? RUNS.map(r=>\`<div class="runrow">
    <span class="id">\${r.id}</span>
    <span class="n">\${r.note||''}</span>
    <span class="sp">
      <span class="meta">\${(r.models||[]).length} models · \${(r.benchmarks||[]).length} tasks</span>
      <a href="/blind?run=\${r.id}">blind review</a>
      <a href="/?run=\${r.id}">scoreboard</a>
    </span></div>\`).join('') : '<div class="meta">No runs yet — launch one above.</div>';
}

const pick=id=>[...document.querySelectorAll('#'+id+' input:checked')].map(i=>i.value);

document.getElementById('launch').addEventListener('click', async ()=>{
  const btn=document.getElementById('launch');
  const models=pick('pm'), benchmarks=pick('pb');
  if(!models.length||!benchmarks.length) return alert('Pick at least one model and one benchmark.');
  btn.disabled=true; btn.textContent='Starting…';
  const r=await fetch('/api/launch',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({models,benchmarks,note:document.getElementById('note').value,
      audit:document.getElementById('doaudit').checked, topUp:document.getElementById('topup').checked})});
  const j=await r.json();
  if(!j.ok){ btn.disabled=false; btn.textContent='Start run'; return alert(j.error||'could not start') }
  jobRun=j.runId; btn.textContent='Running…';
  document.getElementById('livewrap').hidden=false;
  document.getElementById('livemeta').textContent='run '+j.runId;
  document.getElementById('console').textContent='';
  track();
});

function track(){
  const stages=['generating','gates','judging','judge audit','scoring','scoreboard'];
  const bar=document.getElementById('stages');
  bar.innerHTML=stages.map(s=>\`<span class="stage" data-s="\${s}">\${s}</span>\`).join('');
  const box=document.getElementById('console');
  const es=new EventSource('/api/stream');
  es.addEventListener('line', e=>{
    const raw=JSON.parse(e.data);
    const line=mask(raw);
    const m=line.match(/── (.+?) ─/);
    if(m){ bar.querySelectorAll('.stage').forEach(el=>{
      if(el.dataset.s===m[1]) el.classList.add('on');
      else if(el.classList.contains('on')){ el.classList.remove('on'); el.classList.add('done') } }) }
    const cls=line.includes('✓')?'g':line.includes('✗')||/error/i.test(line)?'r':line.includes('!')?'y':'';
    const span=document.createElement('span');
    span.className=cls; span.textContent=line+'\\n';
    box.appendChild(span); box.scrollTop=box.scrollHeight;
  });
  es.addEventListener('done', e=>{
    es.close();
    bar.querySelectorAll('.stage').forEach(el=>{el.classList.remove('on');el.classList.add('done')});
    const btn=document.getElementById('launch');
    btn.disabled=false; btn.textContent='Start run';
    const box=document.getElementById('console');
    const a=document.createElement('a');
    a.href='/blind?run='+jobRun; a.textContent='\\n→ rate this run blind\\n';
    box.appendChild(a); box.scrollTop=box.scrollHeight;
  });
}

document.getElementById('blindmode').addEventListener('change',e=>{ blind=e.target.checked });
document.addEventListener('click',e=>{
  const all=e.target.dataset?.all, none=e.target.dataset?.none;
  const id=all==='models'||none==='models'?'pm':'pb';
  if(all) document.querySelectorAll('#'+id+' input').forEach(i=>{ if(!i.closest('.opt').classList.contains('manual')) i.checked=true });
  if(none) document.querySelectorAll('#'+id+' input').forEach(i=>i.checked=false);
});

renderStats(); renderRuns();
// If a run is already in flight when the page opens, attach to it.
fetch('/api/job').then(r=>r.json()).then(j=>{ if(j.running){ jobRun=j.runId;
  document.getElementById('livewrap').hidden=false;
  document.getElementById('livemeta').textContent='run '+j.runId+' (in progress)';
  document.getElementById('launch').disabled=true;
  document.getElementById('launch').textContent='Running…';
  document.getElementById('console').textContent=j.log.map(mask).join('\\n');
  track(); }});
${runSelScript('board')}
</script></body></html>`
}
