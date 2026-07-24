// debug S1 失败,S3 成功
const BASE = 'http://localhost:11434/v1'

const cases = [
  { label: 'S1', prompt: '用一句话(不超过 50 字)解释 PiPiClaw', max_tokens: 200 },
  { label: 'S1b', prompt: '用一句话(不超过 50 字)解释 PiPiClaw', max_tokens: 500 },
  { label: 'S1c', prompt: '解释 PiPiClaw', max_tokens: 200 },
  { label: 'S1d', prompt: '你好', max_tokens: 200 },
]

for (const c of cases) {
  const t = Date.now()
  const r = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen3:14b',
      messages: [{ role: 'user', content: c.prompt }],
      max_tokens: c.max_tokens,
      temperature: 0.7,
    }),
  })
  const d = await r.json()
  const content = d.choices?.[0]?.message?.content || ''
  const finish = d.choices?.[0]?.finish_reason
  const usage = d.usage
  console.log(`\n[${c.label}] ${Date.now() - t}ms, max_tokens=${c.max_tokens}`)
  console.log(`  content: "${content.slice(0, 200)}"`)
  console.log(`  finish_reason: ${finish}`)
  console.log(`  usage: ${JSON.stringify(usage)}`)
}
