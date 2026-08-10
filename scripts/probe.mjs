import { loadConfig } from '../src/lib.mjs'
import { complete } from '../src/providers.mjs'
const cfg = await loadConfig()
const specs = [
  ...cfg.models.filter(m => m.provider !== 'manual' && m.id !== '_smoke').map(m => ({...m, kind:'model'})),
  ...cfg.judges.map(j => ({...j, kind:'judge'})),
]
for (const s of specs) {
  if (!process.env[s.apiKeyEnv]) { console.log('SKIP ', s.kind.padEnd(5), s.id.padEnd(22), s.apiKeyEnv + ' unset'); continue }
  const t = Date.now()
  try {
    const r = await complete({ spec: {...s, params: {...s.params, max_tokens: 64, thinking: undefined, output_config: undefined}}, system: 'Reply with one word.', prompt: 'Say READY.' })
    console.log('OK   ', s.kind.padEnd(5), s.id.padEnd(22), `${((Date.now()-t)/1000).toFixed(1)}s`, JSON.stringify(r.text.trim().slice(0,30)))
  } catch (e) { console.log('FAIL ', s.kind.padEnd(5), s.id.padEnd(22), e.message.split('\n')[0].slice(0,110)) }
}
