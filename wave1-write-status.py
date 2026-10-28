#!/usr/bin/env python3
import json, urllib.request, datetime, sys
from pathlib import Path

ROOT = Path('/workspace/sr-llm-benchmark')
RUN_ID = '2026-10-28-2130'
STATUS = ROOT / 'wave1-status.md'
BASELINE_USED = 112.909575952
HARD_CAP = 200
WAVE = [
  'gemini-4-argon','gpt-6.1-terra','kimi-k3.1-pro','muse-wonder',
  'claude-haiku-5-5','deepseek-v4.1-flash-1017','minimax-m3.1-flash','muse-spark-open',
]
BRIEFS = [
  '01-threejs-scroll','02-webgl-shader','03-landing-design','05-3d-game',
  '06-open-creative','07-self-pitch','08-accessible-interface','09-brownfield-change',
  '10-svg-icon-system','11-stateful-app','12-css-only','13-html-email',
]

phase = sys.argv[1] if len(sys.argv) > 1 else 'update'
run = ROOT / 'runs' / RUN_ID
lines = [
  '# Wave 1 status',
  '',
  f'Updated: {datetime.datetime.now().astimezone().isoformat(timespec="seconds")} (Asia/Bangkok)',
  f'Run: `{RUN_ID}`',
  f'Phase: {phase}',
  '',
]
try:
  env = {}
  for line in (ROOT / '.env').read_text().splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
      continue
    k, v = line.split('=', 1)
    env[k.strip()] = v.strip().strip('"').strip("'")
  req = urllib.request.Request(
    'https://openrouter.ai/api/v1/credits',
    headers={'Authorization': f"Bearer {env['OPENROUTER_API_KEY']}"},
  )
  with urllib.request.urlopen(req, timeout=30) as r:
    data = json.loads(r.read())['data']
  used = float(data['total_usage'])
  rem = float(data['total_credits']) - used
  wave_spend = used - BASELINE_USED
  lines += [
    f'- OpenRouter wave spend: **${wave_spend:.2f}** (hard cap ${HARD_CAP})',
    f'- OpenRouter remaining wallet: **${rem:.2f}**',
  ]
except Exception as e:
  lines.append(f'- OpenRouter spend: unavailable ({type(e).__name__})')

lines += [
  '- Anthropic (Haiku gen + Craft judge): billed separately; not in OR figure',
  '- Gates: **headless on box — FPS provisional / non-comparable to Mac GPU**',
  '- Scores: **provisional** until Mikhail blind-rates',
  '',
  '| Model | Gen | Gates | Judge | Notes |',
  '|---|---:|---:|---:|---|',
]
for mid in WAVE:
  d = run / mid
  if not d.exists():
    lines.append(f'| `{mid}` | 0/12 | 0/12 | 0/12 | not started |')
    continue
  have = [b for b in BRIEFS if (d / b / 'index.html').exists()]
  gates = sum(1 for b in BRIEFS if (d / b / 'gates.json').exists())
  judge = sum(1 for b in BRIEFS if (d / b / 'judge.json').exists())
  miss = [b for b in BRIEFS if b not in have]
  note = ', '.join(miss) if miss else '—'
  if mid == 'claude-haiku-5-5' and '11-stateful-app' in miss:
    note = '11-stateful-app empty @ max_tokens ×2 (finding)'
  lines.append(f'| `{mid}` | {len(have)}/12 | {gates}/12 | {judge}/12 | {note} |')

STATUS.write_text('\n'.join(lines) + '\n')
print(f'wrote {STATUS}')
