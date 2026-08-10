import 'dotenv/config'
const key = process.env.GLM_API_KEY
const bases = [
  ['z.ai coding plan', 'https://api.z.ai/api/coding/paas/v4'],
  ['z.ai pay-as-you-go', 'https://api.z.ai/api/paas/v4'],
  ['bigmodel.cn', 'https://open.bigmodel.cn/api/paas/v4'],
]
for (const [name, base] of bases) {
  for (const model of ['glm-5.2', 'glm-4.7']) {
    try {
      const r = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 32, messages: [{ role: 'user', content: 'Say READY.' }] }),
      })
      const t = await r.text()
      console.log(String(r.status).padEnd(4), name.padEnd(20), model.padEnd(9), t.slice(0, 110).replace(/\s+/g, ' '))
    } catch (e) { console.log('ERR ', name, model, e.message) }
  }
}
