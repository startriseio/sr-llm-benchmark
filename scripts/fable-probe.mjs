import { loadConfig } from '../src/lib.mjs'
import { complete } from '../src/providers.mjs'
const cfg = await loadConfig()
const m = cfg.models.find((x) => x.id === 'claude-fable-5')
const t = Date.now()
try {
  const r = await complete({ spec: { ...m, params: { ...m.params, max_tokens: 200 } }, system: 'Reply with one word.', prompt: 'Say READY.' })
  console.log('OK  claude-fable-5', `${((Date.now() - t) / 1000).toFixed(1)}s`, JSON.stringify(r.text.trim().slice(0, 40)), '| resolved:', r.model)
} catch (e) {
  console.log('FAIL claude-fable-5 —', e.message.split('\n')[0].slice(0, 160))
}
