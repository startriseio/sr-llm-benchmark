import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

/**
 * One call shape for every provider.
 *
 * spec   — an entry from config/models.json or config/judges.json:
 *          { provider, model, baseURL?, apiKeyEnv, params? }
 * system — system prompt string
 * prompt — user text
 * images — [{ mediaType, base64 }] (judges send screenshots; generation sends none)
 * schema — JSON Schema. When present the provider is asked for structured output.
 *
 * Returns { text, usage, model }.
 */
export async function complete({ spec, system, prompt, images = [], schema = null }) {
  const apiKey = process.env[spec.apiKeyEnv]
  if (!apiKey) throw new Error(`${spec.apiKeyEnv} is not set (needed for ${spec.id})`)

  if (spec.provider === 'anthropic') return anthropicCall({ spec, apiKey, system, prompt, images, schema })
  if (spec.provider === 'openai-compatible') return openaiCall({ spec, apiKey, system, prompt, images, schema })
  throw new Error(`Unknown provider "${spec.provider}" on ${spec.id}`)
}

async function anthropicCall({ spec, apiKey, system, prompt, images, schema }) {
  const client = new Anthropic({ apiKey, baseURL: spec.baseURL, maxRetries: 3, timeout: 30 * 60 * 1000 })

  const content = [
    ...images.map((img) => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
    })),
    { type: 'text', text: prompt },
  ]

  const params = {
    model: spec.model,
    max_tokens: 32000,
    ...spec.params,
    system,
    messages: [{ role: 'user', content }],
  }
  if (schema) {
    params.output_config = { ...params.output_config, format: { type: 'json_schema', schema } }
  }

  // Stream: these are long, high-max_tokens generations and a non-streaming
  // request at this size risks an HTTP timeout.
  const message = await client.messages.stream(params).finalMessage()

  if (message.stop_reason === 'refusal') {
    throw new Error(`refused (${message.stop_details?.category ?? 'unknown'})`)
  }
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  if (!text.trim()) throw new Error(`empty response (stop_reason: ${message.stop_reason})`)

  return {
    text,
    model: message.model,
    usage: {
      input: message.usage.input_tokens,
      output: message.usage.output_tokens,
      cacheRead: message.usage.cache_read_input_tokens ?? 0,
    },
    truncated: message.stop_reason === 'max_tokens',
  }
}

async function openaiCall({ spec, apiKey, system, prompt, images, schema }) {
  const client = new OpenAI({ apiKey, baseURL: spec.baseURL, maxRetries: 3, timeout: 30 * 60 * 1000 })

  const content = [
    { type: 'text', text: prompt },
    ...images.map((img) => ({
      type: 'image_url',
      image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
    })),
  ]

  const params = {
    model: spec.model,
    ...spec.params,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content },
    ],
  }
  if (schema) {
    params.response_format = {
      type: 'json_schema',
      json_schema: { name: 'verdict', strict: true, schema },
    }
  }

  // Not every OpenAI-compatible route supports response_format json_schema — OpenRouter's
  // Anthropic route 400s on it. Rather than silently drop that judge from the quorum, fall
  // back to asking for the JSON in the prompt.
  let res
  try {
    res = await openaiSend(client, params, !!schema)
  } catch (err) {
    if (!schema) throw err
    res = await client.chat.completions.create(jsonFallbackParams(params, content, schema))
  }
  let choice = res.choices?.[0]
  let text = choice?.message?.content ?? ''
  if (!text.trim()) throw new Error(`empty response (finish_reason: ${choice?.finish_reason ?? 'none'})`)

  // Some routes accept response_format and then answer in prose anyway (GLM does this).
  // Recover the JSON if we can; ask again, explicitly, if we cannot.
  if (schema) {
    let recovered = extractJson(text)
    if (recovered == null) {
      res = await client.chat.completions.create(jsonFallbackParams(params, content, schema))
      choice = res.choices?.[0]
      recovered = extractJson(choice?.message?.content ?? '')
      if (recovered == null) throw new Error('provider would not return JSON matching the schema')
    }
    text = recovered
  }

  return {
    text,
    model: res.model,
    usage: {
      input: res.usage?.prompt_tokens ?? 0,
      output: res.usage?.completion_tokens ?? 0,
      cacheRead: res.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    },
    truncated: choice?.finish_reason === 'length',
  }
}

/**
 * Generation is a long, high-max_tokens request. A blocking chat.completions.create()
 * at 64k tokens holds one HTTP response open for as long as the model takes; when that
 * exceeds the SDK's request timeout the whole call is retried, so a slow model burns
 * 30 minutes per attempt and up to maxRetries attempts before erroring — with nothing
 * written and every abandoned attempt billed. GLM did exactly this. Streaming keeps
 * data moving on the socket, which is why the Anthropic path above streams too.
 *
 * Judge calls keep the blocking path: their responses are short, and the schema
 * negotiation below is easier to follow without a stream in the middle.
 */
async function openaiSend(client, params, isJudge) {
  if (isJudge) return client.chat.completions.create(params)
  try {
    return await client.chat.completions.stream(params).finalChatCompletion()
  } catch (err) {
    // Not every OpenAI-compatible route streams cleanly. Falling back leaves a
    // provider that cannot stream behaving exactly as it did before this change.
    console.warn(`  ! ${params.model}: streaming unavailable (${String(err.message).slice(0, 90)}) — falling back to a blocking request`)
    return client.chat.completions.create(params)
  }
}

function jsonFallbackParams(params, content, schema) {
  const { response_format, ...rest } = params
  return {
    ...rest,
    messages: [
      rest.messages[0],
      {
        role: 'user',
        content: [
          ...content,
          { type: 'text', text: `\n\nReply with a single JSON object and nothing else — no prose, no headings, no code fence — matching this schema exactly:\n${JSON.stringify(schema)}` },
        ],
      },
    ],
  }
}

/** Find a JSON object in a response that may be wrapped in prose or a fence. */
function extractJson(text) {
  const candidates = []
  const fence = text.match(/```(?:json)?\s*\n([\s\S]*?)```/)
  if (fence) candidates.push(fence[1])
  candidates.push(text)
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1))
  for (const c of candidates) {
    try { JSON.parse(c); return c } catch {}
  }
  return null
}

/**
 * Pull the single HTML document out of a model response.
 * Fenced block first (that is what the contract asks for), then a bare document.
 * Returns { html, violation } — violation is set when we had to recover, which the
 * self_contained gate reports rather than silently forgiving.
 */
export function extractHtml(text) {
  const fenced = text.match(/```(?:html|HTML)?\s*\n([\s\S]*?)```/)
  if (fenced) {
    const html = fenced[1].trim()
    if (/<html[\s>]/i.test(html) || /<!doctype/i.test(html)) {
      const extra = text.replace(fenced[0], '').trim()
      return { html, violation: extra.length > 400 ? 'wrapped in prose' : null }
    }
  }
  const bare = text.match(/(<!doctype[\s\S]*<\/html>|<html[\s\S]*<\/html>)/i)
  if (bare) return { html: bare[1].trim(), violation: 'no fenced html block' }

  // No closing </html>: almost always the response was cut off at max_tokens. Keep the
  // fragment — the gates score it as the broken page it is, which is more informative
  // than discarding it and recording nothing.
  const start = text.search(/<!doctype|<html[\s>]/i)
  if (start !== -1) {
    const frag = text.slice(start).replace(/```\s*$/, '').trim()
    return { html: frag, violation: 'TRUNCATED — no closing </html>; raise max_tokens' }
  }
  return { html: null, violation: 'no html document found' }
}
