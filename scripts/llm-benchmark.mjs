// PiPiClaw + Ollama 多模型横向 benchmark
// 5 个真实场景 × N 个模型 → 速度 / 质量 / 工具调用 / 上下文 全面对比

const BASE = 'http://localhost:11434/v1'

const MODELS = [
  { name: 'qwen3:14b', desc: '14.8B Q4_K_M · 标准对话', family: 'qwen3' },
  { name: 'qwen3.5:9b', desc: '9.7B Q4_K_M · 默认 thinking', family: 'qwen35' },
  { name: 'gpt-oss:20b', desc: '20.9B MXFP4 · OpenAI 兼容', family: 'gptoss' },
  { name: 'qwen3:14b-large', desc: '14.8B Q4_K_M · large 变体', family: 'qwen3' },
]

const SCENARIOS = [
  {
    id: 'S1-简单问答',
    prompt: '用一句话(不超过 30 字)解释 PiPiClaw 是什么',
    maxTokens: 200,
    grade: (r) => ({
      speed: r.durationMs < 2000 ? '⚡' : r.durationMs < 5000 ? '✓' : '⚠',
      contentOk: r.content.length > 5 && r.content.length < 500,
    }),
  },
  {
    id: 'S2-代码生成',
    prompt: '写一个 Python 快速排序,带详细注释,不超过 30 行',
    maxTokens: 800,
    grade: (r) => {
      const hasCode = r.content.includes('def ') || r.content.includes('```python')
      return {
        speed: r.durationMs < 5000 ? '⚡' : r.durationMs < 10000 ? '✓' : '⚠',
        contentOk: hasCode,
      }
    },
  },
  {
    id: 'S3-工具调用',
    prompt: '北京今天天气怎么样?',
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: '获取天气',
          parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
        },
      },
    ],
    maxTokens: 500,
    grade: (r) => ({
      speed: r.durationMs < 3000 ? '⚡' : r.durationMs < 8000 ? '✓' : '⚠',
      contentOk: r.toolCalls?.length > 0 || r.content.length > 5,
    }),
  },
  {
    id: 'S4-多轮上下文',
    multiTurn: true,
    grade: (r) => ({
      speed: r.durationMs < 3000 ? '⚡' : r.durationMs < 8000 ? '✓' : '⚠',
      contentOk: r.rememberedName,
    }),
  },
  {
    id: 'S5-错误恢复',
    prompt: 'parse 这个无效 JSON: {invalid json here} ,告诉我哪里错',
    maxTokens: 300,
    grade: (r) => ({
      speed: r.durationMs < 3000 ? '⚡' : r.durationMs < 8000 ? '✓' : '⚠',
      contentOk: r.content.toLowerCase().includes('json') || r.content.includes('{'),
    }),
  },
]

async function chat(model, body) {
  const start = Date.now()
  const r = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, ...body, temperature: 0.5 }),
  })
  if (!r.ok) {
    return { ok: false, error: `HTTP ${r.status}: ${(await r.text()).slice(0, 100)}` }
  }
  const data = await r.json()
  const choice = data.choices?.[0]
  const msg = choice?.message
  let content = msg?.content ?? ''
  if (!content && msg?.reasoning) content = msg.reasoning.slice(0, 200)
  const toolCalls = msg?.tool_calls?.map((tc) => ({
    name: tc.function?.name,
    args: tc.function?.arguments,
  }))
  return {
    ok: true,
    content,
    toolCalls,
    reasoning: msg?.reasoning,
    durationMs: Date.now() - start,
    usage: data.usage,
    finishReason: choice?.finish_reason,
  }
}

async function multiTurnChat(model) {
  const ctx = [
    { role: 'system', content: '你是 PiPiClaw 桌面 AI 助手,简洁回答' },
    { role: 'user', content: '我叫什么?' },
  ]
  const r1 = await chat(model, { messages: ctx, max_tokens: 100 })
  ctx.push({ role: 'assistant', content: r1.content })
  ctx.push({ role: 'user', content: '我叫小明,做 Python 后端' })
  const r2 = await chat(model, { messages: ctx, max_tokens: 100 })
  ctx.push({ role: 'assistant', content: r2.content })
  ctx.push({ role: 'user', content: '你还记得我叫什么?做什么的?' })
  const r3 = await chat(model, { messages: ctx, max_tokens: 200 })
  const remembered = r3.content.includes('小明') && r3.content.includes('Python')
  return {
    ok: r1.ok && r2.ok && r3.ok,
    content: r3.content,
    durationMs: r1.durationMs + r2.durationMs + r3.durationMs,
    rememberedName: remembered,
  }
}

function gradeSpeed(durationMs) {
  if (durationMs < 2000) return '⚡⚡⚡'
  if (durationMs < 5000) return '⚡⚡'
  if (durationMs < 10000) return '⚡'
  return '⚠'
}

async function main() {
  const results = {}

  for (const model of MODELS) {
    results[model.name] = { desc: model.desc, family: model.family, scenarios: {} }
    console.log(`\n${'='.repeat(70)}`)
    console.log(`测试模型: ${model.name} (${model.desc})`)
    console.log('='.repeat(70))

    for (const sc of SCENARIOS) {
      try {
        let r
        if (sc.multiTurn) {
          r = await multiTurnChat(model.name)
        } else {
          const body = {
            messages: [{ role: 'user', content: sc.prompt }],
            max_tokens: sc.maxTokens || 500,
          }
          if (sc.tools) body.tools = sc.tools
          r = await chat(model.name, body)
        }

        if (!r.ok) {
          console.log(`  ${sc.id}: ✗ ${r.error?.slice(0, 60)}`)
          results[model.name].scenarios[sc.id] = { error: r.error }
          continue
        }

        const g = sc.grade ? sc.grade(r) : { speed: gradeSpeed(r.durationMs) }
        const speedIcon = gradeSpeed(r.durationMs)
        const speedText = `${r.durationMs}ms`
        const toolCallsInfo = r.toolCalls?.length ? ` · 工具调用 ${r.toolCalls.length}` : ''
        const reasoningInfo = r.reasoning ? ` · 思考 ${r.reasoning.length} 字` : ''
        const okMark = g.contentOk === true ? '✓' : g.contentOk === false ? '✗' : ''

        console.log(
          `  ${sc.id}: ${speedIcon} ${speedText} ${okMark}${toolCallsInfo}${reasoningInfo}`,
        )
        results[model.name].scenarios[sc.id] = {
          ok: true,
          durationMs: r.durationMs,
          contentOk: g.contentOk,
          contentLength: r.content.length,
          toolCalls: r.toolCalls?.length || 0,
          reasoningLength: r.reasoning?.length || 0,
          remembered: r.rememberedName,
        }
      } catch (e) {
        console.log(`  ${sc.id}: ✗ EXCEPTION ${e.message?.slice(0, 60)}`)
        results[model.name].scenarios[sc.id] = { error: String(e) }
      }
    }
  }

  // ====== 报告 ======
  console.log(`\n${'='.repeat(80)}`)
  console.log('🏆 横向对比报告')
  console.log('='.repeat(80))

  const headers = ['模型'].concat(SCENARIOS.map((s) => s.id))
  const colWidth = 14
  const pad = (s, w) => s.padEnd(w).slice(0, w)
  console.log(pad('模型', colWidth) + SCENARIOS.map((s) => pad(s.id, colWidth)).join(''))
  console.log('-'.repeat(80))
  for (const m of MODELS) {
    const cells = SCENARIOS.map((s) => {
      const r = results[m.name].scenarios[s.id]
      if (!r || r.error) return pad('✗ ERR', colWidth)
      const speedIcon = gradeSpeed(r.durationMs)
      const okMark = r.contentOk === true ? '✓' : r.contentOk === false ? '✗' : '-'
      return pad(`${speedIcon} ${okMark} ${r.durationMs}ms`, colWidth)
    })
    console.log(pad(m.name, colWidth) + cells.join(''))
  }
  console.log('-'.repeat(80))
  console.log('说明: ⚡ = 速度(< 2s ⚡⚡⚡ / < 5s ⚡⚡ / < 10s ⚡) | ✓/✗ = 内容质量')

  // 速度冠军
  console.log('\n🏅 速度冠军:')
  const fastest = MODELS
    .map((m) => {
      const total = Object.values(results[m.name].scenarios).reduce(
        (sum, s) => sum + (s.durationMs || 99999),
        0,
      )
      return { name: m.name, total }
    })
    .sort((a, b) => a.total - b.total)
  fastest.forEach((r, i) => console.log(`  ${i + 1}. ${r.name} — 总 ${r.total}ms`))

  // 思考模型
  console.log('\n🧠 思考模式 (qwen3.5 / gpt-oss):')
  for (const m of MODELS) {
    const s1 = results[m.name].scenarios['S1-简单问答']
    if (s1 && !s1.error) {
      const thinkRatio = (s1.reasoningLength || 0) / (s1.contentLength + 1)
      console.log(`  ${m.name}: 思考 ${s1.reasoningLength} 字 / 输出 ${s1.contentLength} 字 (比 ${thinkRatio.toFixed(1)})`)
    }
  }

  // 工具调用冠军
  console.log('\n🔧 工具调用能力:')
  for (const m of MODELS) {
    const s3 = results[m.name].scenarios['S3-工具调用']
    if (s3 && !s3.error) {
      console.log(`  ${m.name}: ${s3.toolCalls > 0 ? '✓ 支持' : '✗ 不支持'} (${s3.toolCalls} 个)`)
    }
  }

  console.log('\n结论:')
  console.log('  - 想要速度 → 选最快的')
  console.log('  - 想要质量 → 选最大的 / Claude / Sonnet(本测试不含)')
  console.log('  - 想要 thinking 透明 → 选 qwen3.5 / gpt-oss(暴露 reasoning)')
  console.log('  - 想要工具调用 → 选 tool_calls 正常的')
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
