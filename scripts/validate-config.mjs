#!/usr/bin/env node
/**
 * `npm test` — validates the pieces of this repo that must stay consistent:
 * the roster, the brief set, the judge quorum, the scoring weights, and the
 * fixture for brief 09. Runs without API keys or a browser, so it is safe in CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

// ---------- models ----------
const { models } = read('config/models.json');
const ids = new Set();
for (const m of models) {
  check(typeof m.id === 'string' && /^[a-z0-9][a-z0-9.-]*$/.test(m.id), `model id "${m.id}" must be lowercase [a-z0-9.-]`);
  check(!ids.has(m.id), `duplicate model id "${m.id}"`); ids.add(m.id);
  check(typeof m.label === 'string' && m.label.length, `${m.id}: label missing`);
  check(['anthropic', 'openai-compatible', 'manual'].includes(m.provider), `${m.id}: unknown provider "${m.provider}"`);
  check(typeof m.vendor === 'string' && m.vendor.length, `${m.id}: vendor missing (used for the bias audit)`);
  if (m.provider !== 'manual') {
    check(typeof m.model === 'string' && m.model.length, `${m.id}: model string missing`);
    check(typeof m.apiKeyEnv === 'string' && /^[A-Z0-9_]+$/.test(m.apiKeyEnv), `${m.id}: apiKeyEnv must name an env var`);
    check(!m.params || typeof m.params.max_tokens === 'number', `${m.id}: params.max_tokens must be a number`);
  }
  if (m.provider === 'openai-compatible') check(typeof m.baseURL === 'string' && m.baseURL.startsWith('https://'), `${m.id}: openai-compatible entries need an https baseURL`);
  for (const k of Object.keys(m)) check(!/key|secret|token/i.test(k) || k === 'apiKeyEnv', `${m.id}: suspicious field "${k}" — keys belong in .env`);
  const blob = JSON.stringify(m);
  check(!/sk-ant-[A-Za-z0-9_-]{8,}|sk-or-v1-[a-f0-9]{8,}|AIza[0-9A-Za-z_-]{20,}/.test(blob), `${m.id}: looks like an API key is embedded in the config`);
}

// ---------- benchmarks ----------
const { benchmarks } = read('config/benchmarks.json');
const contract = path.join(ROOT, 'benchmarks/_contract.md');
check(fs.existsSync(contract), 'benchmarks/_contract.md is missing');
const bids = new Set();
for (const b of benchmarks) {
  check(/^\d{2}-[a-z0-9-]+$/.test(b.id), `benchmark id "${b.id}" must look like 01-slug`);
  check(!bids.has(b.id), `duplicate benchmark id "${b.id}"`); bids.add(b.id);
  check(typeof b.promptFile === 'string' && fs.existsSync(path.join(ROOT, 'benchmarks', b.promptFile)), `${b.id}: promptFile "${b.promptFile}" not found`);
  check(['api', 'manual'].includes(b.mode), `${b.id}: mode must be api or manual`);
  check(Array.isArray(b.checks) && b.checks.length > 0, `${b.id}: declare at least one gate check`);
  for (const c of b.checks || []) check(['self_contained', 'economy', 'loads', 'console_clean', 'renders', 'fps', 'interaction', 'identity'].includes(c), `${b.id}: unknown check "${c}"`);
  if (b.fixture) {
    const { dir, ...files } = b.fixture;
    check(typeof dir === 'string' && fs.existsSync(path.join(ROOT, dir)), `${b.id}: fixture dir "${dir}" not found`);
    for (const [k, f] of Object.entries(files)) check(fs.existsSync(path.join(ROOT, dir, f)), `${b.id}: fixture ${k} "${f}" not found`);
  }
}
check(fs.existsSync(path.join(ROOT, 'fixtures/09-brownfield/source.html')), 'fixture for brief 09 is missing');

// ---------- judges ----------
const judges = read('config/judges.json');
check(Array.isArray(judges.judges) && judges.judges.length % 2 === 1, 'judge quorum should be an odd number so the median is a real score');
check(new Set(judges.judges.map((j) => j.vendor)).size === judges.judges.length, 'judges should come from different labs');
check(judges.minJudges >= 2, 'minJudges must be at least 2');

// ---------- scoring ----------
const scoring = read('config/scoring.json');
const w = scoring.weights || scoring;
if (w.technical != null) {
  const sum = (w.technical || 0) + (w.judge || 0) + (w.human || 0);
  check(Math.abs(sum - 1) < 1e-9, `scoring weights must sum to 1 (got ${sum})`);
}

// ---------- hygiene ----------
check(!fs.existsSync(path.join(ROOT, '.env')) || fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n').includes('.env'), '.env exists but is not git-ignored');

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}\n`);
  process.exit(1);
}
console.log(`✓ config valid — ${models.length} models, ${benchmarks.filter((b) => !b.disabled).length} active briefs, ${judges.judges.length} judges`);
