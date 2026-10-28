#!/usr/bin/env bash
set -uo pipefail
cd /workspace/sr-llm-benchmark
export PATH="/home/box/.local/node22/bin:$PATH"
set -a; source .env; set +a

RUN_ID="2026-10-28-2130"
LOG="/workspace/sr-llm-benchmark/wave1.log"
BASELINE_USED="112.909575952"
HARD_CAP="200"
MIN_OR_REMAINING="1.50"
STATUS_PY="/workspace/sr-llm-benchmark/wave1-write-status.py"

WAVE=(muse-wonder deepseek-v4.1-flash-1017 minimax-m3.1-flash muse-spark-open kimi-k3.1-pro claude-haiku-5-5 gemini-4-argon gpt-6.1-terra)

log() { printf '%s %s\n' "$(date -Iseconds)" "$*" | tee -a "$LOG"; }

or_vals() {
  python3 - <<'PY'
import json, urllib.request
from pathlib import Path
env={}
for line in Path('.env').read_text().splitlines():
    line=line.strip()
    if not line or line.startswith('#') or '=' not in line: continue
    k,v=line.split('=',1); env[k.strip()]=v.strip().strip('"').strip("'")
req=urllib.request.Request('https://openrouter.ai/api/v1/credits', headers={'Authorization': f"Bearer {env['OPENROUTER_API_KEY']}"})
with urllib.request.urlopen(req, timeout=30) as r:
    d=json.loads(r.read())['data']
print(f"{float(d['total_credits']):.6f} {float(d['total_usage']):.6f} {float(d['total_credits'])-float(d['total_usage']):.6f}")
PY
}

budget_ok() {
  local vals used rem spend
  vals=$(or_vals) || return 1
  used=$(echo "$vals" | awk '{print $2}')
  rem=$(echo "$vals" | awk '{print $3}')
  spend=$(python3 -c "print(f'{float('$used')-float('$BASELINE_USED'):.4f}')")
  log "budget: wave_OR=\$${spend} rem=\$${rem} cap=\$${HARD_CAP}"
  python3 -c "import sys; s=float('$spend'); r=float('$rem'); sys.exit(0 if s < $HARD_CAP - 5 and r >= $MIN_OR_REMAINING else 1)"
}

counts() {
  python3 -c "
from pathlib import Path
run=Path('runs/$RUN_ID')/'$1'
briefs='01-threejs-scroll 02-webgl-shader 03-landing-design 05-3d-game 06-open-creative 07-self-pitch 08-accessible-interface 09-brownfield-change 10-svg-icon-system 11-stateful-app 12-css-only 13-html-email'.split()
if not run.exists():
  print('0 0 0'); raise SystemExit
have=sum(1 for b in briefs if (run/b/'index.html').exists())
gates=sum(1 for b in briefs if (run/b/'gates.json').exists())
judge=sum(1 for b in briefs if (run/b/'judge.json').exists())
print(have, gates, judge)
"
}

wait_gates_proc() {
  local mid="$1"
  while pgrep -af "node src/gates.mjs --model $mid" >/dev/null 2>&1; do
    log "wait: existing gates for $mid"
    sleep 20
  done
}

process_model() {
  local mid="$1" c have gates judge
  c=$(counts "$mid"); have=$(echo "$c"|awk '{print $1}'); gates=$(echo "$c"|awk '{print $2}'); judge=$(echo "$c"|awk '{print $3}')
  log "=== $mid gen=$have gates=$gates judge=$judge ==="
  python3 "$STATUS_PY" "processing $mid" >/dev/null

  if ! budget_ok; then
    log "STOP budget before $mid"
    python3 "$STATUS_PY" "STOPPED at $mid (budget)" >/dev/null
    return 2
  fi

  if [[ "$have" -lt 12 ]]; then
    # Haiku 11 is intentional finding — only fill if zero files somehow; don't force 11-stateful
    if [[ "$mid" == "claude-haiku-5-5" && "$have" -ge 11 ]]; then
      log "haiku: leaving 11-stateful-app gap as finding"
    else
      log "gen $mid"
      npm run gen -- --model "$mid" --run "$RUN_ID" --concurrency 4 >>"$LOG" 2>&1 || log "gen non-zero $mid"
    fi
  else
    log "gen skip $mid"
  fi

  c=$(counts "$mid"); have=$(echo "$c"|awk '{print $1}'); gates=$(echo "$c"|awk '{print $2}'); judge=$(echo "$c"|awk '{print $3}')
  [[ "$have" -eq 0 ]] && { log "no files $mid"; return 0; }

  wait_gates_proc "$mid"
  if [[ "$gates" -lt "$have" ]]; then
    log "gates $mid headless"
    npm run gates -- --model "$mid" --run "$RUN_ID" --headless >>"$LOG" 2>&1 || log "gates non-zero $mid"
  else
    log "gates skip $mid"
  fi

  if ! budget_ok; then
    log "STOP budget before judge $mid"
    python3 "$STATUS_PY" "STOPPED before judge $mid" >/dev/null
    return 2
  fi

  c=$(counts "$mid"); have=$(echo "$c"|awk '{print $1}'); judge=$(echo "$c"|awk '{print $3}')
  if [[ "$judge" -lt "$have" ]]; then
    log "judge $mid"
    npm run judge -- --model "$mid" --run "$RUN_ID" --concurrency 4 >>"$LOG" 2>&1 || log "judge non-zero $mid"
  else
    log "judge skip $mid"
  fi
  python3 "$STATUS_PY" "done stages $mid" >/dev/null
  return 0
}

log "wave1-resume START pid=$$"
python3 "$STATUS_PY" "resume start" >/dev/null || true

# Prioritize incomplete models first
PRIORITY=(muse-wonder deepseek-v4.1-flash-1017 minimax-m3.1-flash muse-spark-open kimi-k3.1-pro claude-haiku-5-5 gemini-4-argon gpt-6.1-terra)
for mid in "${PRIORITY[@]}"; do
  process_model "$mid" || { [[ $? -eq 2 ]] && exit 2; }
done

log "score"
npm run score -- --run "$RUN_ID" >>"$LOG" 2>&1 || log "score non-zero"
cat > results/$RUN_ID/PROVISIONAL.md <<'MD'
# Provisional run notes — 2026-10-28-2130

- Gates ran **headless on the box**. FPS is **non-comparable** to a real-GPU headed run. Re-run gates on Mikhail's Mac before treating technical/FPS as final.
- Human column empty — scores are **auto-only / provisional** until blind ratings (`npm run report`).
- Haiku 5.5 missing `11-stateful-app` (empty body, `stop_reason: max_tokens` twice) — coverage gap / finding.
MD
python3 "$STATUS_PY" "DONE — scored" >/dev/null
log "wave1-resume DONE"
