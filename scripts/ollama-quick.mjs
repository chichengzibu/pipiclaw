// 测试不带 thinking 的模型
const models = ['qwen3:14b', 'qwen3:14b-large', 'gpt-oss:20b']
const prompt = '用一句话(不超过 30 字)解释 PiPiClaw 是什么'
const BASE = 'http://localhost:11434/v1'

for (const MODEL of models) {
  console.log(`\n=== ${MODEL} ===`)
  const t = Date.now()
  const r = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.7,
    }),
  })
  const d = await r.json()
  const c = d.choices?.[0]?.message?.content || ''
  console.log(`  ${Date.now() - t}ms, content.length=${c.length}`)
  console.log(`  content: ${c.slice(0, 200)}`)
  if (d.choices?.[0]?.message?.reasoning) {
    console.log(`  reasoning: ${d.choices[0].message.reasoning.slice(0, 100)}...`)
  }
  if (d.usage) {
    console.log(`  usage: ${JSON.stringify(d.usage)}`)
  }
}
