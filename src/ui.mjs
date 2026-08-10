/** Shared chrome for the scoreboard and the blind review page. */
export const CSS = `
:root{
  --bg:#0b0c0e; --panel:#131519; --panel2:#191c21; --line:#262a31;
  --fg:#e8eaed; --mut:#8b929e; --dim:#5b626d;
  --acc:#7dd3a0; --warn:#e8b661; --bad:#e8776d; --link:#7fb5ff;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
  font:15px/1.55 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--link);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:1600px;margin:0 auto;padding:26px 28px 120px}
header{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;
  padding-bottom:16px;border-bottom:1px solid var(--line);margin-bottom:8px}
.brand{display:flex;align-items:baseline;gap:14px}
h1{font-size:19px;font-weight:600;margin:0;letter-spacing:-.01em}
.tabs{display:flex;gap:4px}
.tabs a{padding:6px 13px;border-radius:7px;font-size:13px;color:var(--mut);border:1px solid transparent}
.tabs a.on{background:var(--panel);border-color:var(--line);color:var(--fg)}
.meta{color:var(--dim);font:12px/1.5 var(--mono)}
select{background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:7px;
  padding:6px 10px;font:12px var(--mono)}
h2{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.09em;color:var(--mut);
  margin:40px 0 14px;padding-bottom:9px;border-bottom:1px solid var(--line);
  display:flex;justify-content:space-between;align-items:baseline;gap:16px}
h2 small{text-transform:none;letter-spacing:0;color:var(--dim);font-weight:400;font-size:12px}

table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;font-weight:500;color:var(--mut);font-size:11px;text-transform:uppercase;
  letter-spacing:.07em;padding:0 12px 9px;border-bottom:1px solid var(--line)}
td{padding:10px 12px;border-bottom:1px solid #1a1d22}
tbody tr:hover{background:var(--panel)}
.num{font:13px/1 var(--mono);text-align:right}
.big{font:600 17px/1 var(--mono)}
.rank{color:var(--dim);font:12px/1 var(--mono);width:28px}
.prov{color:var(--dim);font-size:11px;font-family:var(--mono)}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));gap:18px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;
  display:flex;flex-direction:column}
.card.dead{opacity:.45}
.card .top{display:flex;justify-content:space-between;align-items:center;gap:10px;
  padding:11px 14px;border-bottom:1px solid var(--line)}
.card .name{font-weight:600;font-size:14px}
.tag{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:7px;
  background:var(--panel2);border:1px solid var(--line);font:600 13px var(--mono);color:var(--fg)}
.shot{position:relative;background:#000;aspect-ratio:16/10;overflow:hidden;cursor:zoom-in}
.shot img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}
.shot .empty{display:grid;place-items:center;height:100%;color:var(--dim);font:12px var(--mono)}
.shot .badge{position:absolute;left:8px;bottom:8px;background:#000a;backdrop-filter:blur(6px);
  border:1px solid var(--line);border-radius:5px;padding:3px 7px;font:11px var(--mono);color:var(--mut)}
iframe{width:100%;aspect-ratio:16/10;border:0;background:#fff;display:block}

.scores{display:flex;border-bottom:1px solid var(--line)}
.scores div{flex:1;padding:9px 10px;text-align:center;border-right:1px solid var(--line)}
.scores div:last-child{border-right:0}
.scores .k{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--dim)}
.scores .v{font:600 16px/1.4 var(--mono)}

.body{padding:12px 14px;display:flex;flex-direction:column;gap:11px;flex:1}
details summary{cursor:pointer;color:var(--mut);font-size:12px;list-style:none;user-select:none}
details summary::-webkit-details-marker{display:none}
details summary::before{content:"▸ ";color:var(--dim)}
details[open] summary::before{content:"▾ "}
details .inner{margin-top:9px;font-size:12.5px;color:var(--mut);display:flex;flex-direction:column;gap:9px}
.judge{border-left:2px solid var(--line);padding-left:10px}
.judge .jh{display:flex;justify-content:space-between;gap:8px;color:var(--fg);font-size:12px;font-weight:600}
.judge ul{margin:5px 0 0;padding-left:16px}
.judge li{margin:2px 0}
.flag{color:var(--bad)}
.axrow{display:flex;justify-content:space-between;font:11.5px var(--mono);padding:2px 0}
.spread{color:var(--warn)}

.human{background:var(--panel2);border-top:1px solid var(--line);padding:11px 14px;
  display:flex;flex-direction:column;gap:8px}
.human .lab{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);
  display:flex;justify-content:space-between;align-items:center}
.human .val{font:600 14px var(--mono);color:var(--acc)}
input[type=range]{width:100%;accent-color:var(--acc)}
textarea{width:100%;background:#0e1013;border:1px solid var(--line);border-radius:6px;color:var(--fg);
  font:12.5px/1.5 inherit;padding:7px 9px;resize:vertical;min-height:36px}
textarea:focus,input:focus{outline:1px solid var(--acc);outline-offset:-1px}
.saved{color:var(--acc);font-size:11px;opacity:0;transition:opacity .2s}
.saved.on{opacity:1}
.pillbar{display:flex;gap:6px;flex-wrap:wrap}
.pill{font:11px var(--mono);padding:2px 7px;border-radius:99px;border:1px solid var(--line);color:var(--mut)}
.pill.b{color:var(--bad);border-color:#4a2b28}
.pill.w{color:var(--warn);border-color:#4a3d22}
.pill.g{color:var(--acc);border-color:#25412f}
button{font:inherit;cursor:pointer}
button.link{background:none;border:0;color:var(--link);font-size:12px;padding:0}
button.btn{background:var(--panel2);border:1px solid var(--line);color:var(--fg);border-radius:7px;
  padding:6px 13px;font-size:12.5px}
button.btn:hover{border-color:var(--dim)}
button.btn:disabled{opacity:.4;cursor:not-allowed}
.lightbox{position:fixed;inset:0;background:#000e;display:none;place-items:center;z-index:50;padding:32px}
.lightbox.on{display:grid}
.lightbox img{max-width:100%;max-height:100%;object-fit:contain}
.bar{height:4px;background:var(--panel2);border-radius:99px;overflow:hidden;flex:1;min-width:120px}
.bar i{display:block;height:100%;background:var(--acc);transition:width .25s}
.panelbox{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 18px;overflow-x:auto}
.panelbox svg{display:block;width:100%;height:auto}
.srow{display:grid;grid-template-columns:24px minmax(120px,210px) 1fr 46px 50px;align-items:center;
  gap:14px;padding:7px 0}
.srow+.srow{border-top:1px solid #1a1d22}
.slab{display:flex;align-items:center;gap:7px;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.strack{height:9px;background:var(--panel2);border-radius:99px;overflow:hidden}
.strack i{display:block;height:100%;border-radius:99px}
.sval{font:600 15px/1 var(--mono);text-align:right}
.scov{font:11px var(--mono);color:var(--dim);text-align:right}
.note{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--acc);
  border-radius:8px;padding:11px 14px;color:var(--mut);font-size:13px;margin:14px 0 4px}
.reveal{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;
  padding:11px 0}
`

export const scoreColorFn = `
function scoreColor(v){ if(v==null) return 'var(--dim)'; if(v>=75) return 'var(--acc)';
  if(v>=50) return 'var(--fg)'; if(v>=30) return 'var(--warn)'; return 'var(--bad)'; }`

/**
 * JSON bound for an inline <script>. Judge verdicts quote the HTML they are reviewing, so a red
 * flag saying "truncated with no closing </script>" would otherwise end the tag and spill the
 * rest of the payload onto the page as text. Escaping every `<` keeps it valid JSON and JS.
 */
export const jsonScript = (v) =>
  JSON.stringify(v ?? null).replace(/[<\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))

/** Same hazard one layer down: judge prose goes through innerHTML, so it has to be escaped there too. */
export const escFn = `
const ESC={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>ESC[c]) }`

/** Deterministic per-(run,benchmark) shuffle so the blind order never changes under you. */
export const shuffleFn = `
function hash(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619) } return h>>>0 }
function blindOrder(runId, benchId, ids){
  return [...ids].sort((a,b) => hash(runId+'|'+benchId+'|'+a) - hash(runId+'|'+benchId+'|'+b));
}`

export const head = (title) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>${CSS}</style></head><body>`

export const chrome = ({ tab, runId, runs, extra = '' }) => `
<div class="wrap"><header>
  <div class="brand">
    <h1>StarRise LLM Benchmark</h1>
    <nav class="tabs">
      <a href="/?run=${runId}" class="${tab === 'control' ? 'on' : ''}">Control</a>
      <a href="/blind?run=${runId}" class="${tab === 'blind' ? 'on' : ''}">Blind review</a>
      <a href="/board?run=${runId}" class="${tab === 'board' ? 'on' : ''}">Scoreboard</a>
      <a href="/history" class="${tab === 'history' ? 'on' : ''}">Overall</a>
    </nav>
  </div>
  <div style="display:flex;align-items:center;gap:12px">
    ${extra}
    <select id="runsel">${runs.map((r) => `<option value="${r.id}" ${r.id === runId ? 'selected' : ''}>${r.id}${r.note ? ' — ' + r.note : ''}</option>`).join('')}</select>
  </div>
</header>`

const TAB_PATH = { blind: '/blind', board: '/board', control: '/', history: '/board' }
export const runSelScript = (tab) => `
document.getElementById('runsel')?.addEventListener('change', e => {
  location.href = '${TAB_PATH[tab] ?? '/'}?run=' + encodeURIComponent(e.target.value);
});`
