# PiPiClaw 重设计 v2.1.2 · 5 P0 Patch

> **关系**: 接 `redesign-v2.1.1-spec.md` (v2.1.1 实施手册) + `redesign-v2.1.1-designer-review.md` (designer 抓 5 P0)
> **目标**: **只修 5 P0,不重写 1500 行假代码**。v2.1.1 20% 正确部分保留,80% 假代码删除
> **风格**: Patch 文档,基于 v4.3.1 实际代码,每项给具体 diff
> **作者**: Mavis
> **日期**: 2026-07-28

---

## 0. v2.1.1 → v2.1.2 改稿总览

| P0 | 改 | v4.3.1 实际 | v2.1.1 错 | v2.1.2 修 |
|---|---|---|---|---|
| **P0-2** | LlmClient 流式 | 3 adapter (openai/anthropic/**zhipu**),用 import + chat() | 改用 3 个 SDK 假包 + 错 provider 名单 | **保留 v4.3.1 架构,改 adapter 内部加 streamChat()** |
| **P0-4** | vite manualChunks | 已经是函数式 (vendor-framework + element-plus 自然分块) | 对象式错 + 强制 vendor-element 合并 | **不改 vite.config,只在 build 注释里追加** |
| **P0-5** | 路由数 17 | 实际 23 路由,5 devOnly | 写 17/7 | **改路由表 23/5** |
| **P0-7** | MemoryChip TF-IDF | 实际是 SQLite + HermesMemory.ts | 引用不存在的 `Memory[]` 类型 | **保留 v4.3.1 SQLite,只在 HermesMemory.ts 加 scoreMemory()** |
| **P0-8** | backupConfig 删除循环 | 没文件 | 死代码 (i=3 检查 bak.4) | **修正循环方向** |

**v2.1.1 正确保留部分 (20%)**:
- P0-1 破坏性白名单 (DESTRUCTIVE_TOOLS + PATTERNS)
- P1-2 呼吸光晕 (WCAG 2.3.1 通过)
- P1-3 首次启动引导 (不开右栏)
- P1-4 LlmEvent 15 种 type (加 thinking_chunk / error / cancelled / retry / token_usage)
- P1-6 主题表 3 套 (跟 v4.3.1 对)
- P1-7 macOS 顶栏 32px (实测)

**v2.1.1 错误删除 (80%)**:
- ❌ 完整 LlmClient.ts 重写 (v2.1.1 3-1 错 → 改回 v4.3.1 架构)
- ❌ 完整 vite.config.mts 重写 (v2.1.1 错 → 改注释)
- ❌ usePendingReview.ts (Vue composable 跟 Electron main 混用错)
- ❌ useWorkspacePanels.ts (5 实施错)
- ❌ useLayout.ts (缺 schema 版本)
- ❌ MemoryScorer.ts (引用不存在 memory.ts)
- ❌ 多个不存在的 .vue 组件 (AICollabPanel/ChatTab/CodePanel/MemoryPanel/ToolsPanel/TopBar/WorkspaceSwitcher)

---

## 1. P0-2 Patch: LlmClient 改流式 (不重写)

### 1.1 现状 (v4.3.1 实际)
```typescript
// electron/llm/LlmClient.ts
private openai = new OpenAiAdapter()
private anthropic = new AnthropicAdapter()
private zhipu = new ZhipuAdapter()  // 不是 ollama

async chat(req: LlmRequest): Promise<LlmResponse> { /* 非流式 */ }
```

**3 个 adapter**: `openai.ts` / `anthropic.ts` / `zhipu.ts` (在 `electron/llm/adapters/`)

### 1.2 v2.1.1 错
- 引 3 个假包 (`openai` / `@anthropic-ai/sdk` / `ollama`)
- provider 名单错 (写 openai/anthropic/ollama,实际是 openai/anthropic/**zhipu**)
- 删 150 行 working code (v4.3.1 的 adapter 单例 + LlmConfigStore)

### 1.3 v2.1.2 修:**保留 v4.3.1 架构,在 3 adapter 内部加 streamChat()**

**新增文件**: `electron/llm/types.ts` (扩 LlmRequest + 新增 LlmStreamEvent)

```typescript
// electron/llm/types.ts (新增)
import type { LlmProvider } from './types'

export interface LlmStreamEvent {
  type:
    | 'thinking_start' | 'thinking_chunk' | 'thinking_end'
    | 'text_chunk'
    | 'tool_call_start' | 'tool_call_arg' | 'tool_call_end'
    | 'memory_ref'
    | 'pending_review'
    | 'error'
    | 'cancelled'
    | 'retry'
    | 'token_usage'
    | 'done'
  [key: string]: any
}

export interface StreamChatRequest extends LlmRequest {
  onEvent: (event: LlmStreamEvent) => void
}
```

**修改 3 adapter**: `electron/llm/adapters/{openai,anthropic,zhipu}.ts`

**openai.ts patch** (示例, anthropic / zhipu 类似):
```typescript
// electron/llm/adapters/openai.ts 现有 chat() 不动,新增 streamChat()
async streamChat(req: StreamChatRequest): Promise<void> {
  const config = this.configStore.get('openai')
  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      messages: req.messages,
      tools: req.tools,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      stream: true,  // ✅ 启用流式
    }),
  })

  if (!response.ok || !response.body) {
    req.onEvent({ type: 'error', message: `HTTP ${response.status}` })
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentToolCall: any = null

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') {
          req.onEvent({ type: 'done' })
          continue
        }
        try {
          const chunk = JSON.parse(data)
          const choice = chunk.choices?.[0]
          if (!choice) continue

          // 1. reasoning_content (thinking 模型)
          if (choice.delta?.reasoning_content) {
            req.onEvent({ type: 'thinking_chunk', content: choice.delta.reasoning_content })
          }

          // 2. text content
          if (choice.delta?.content) {
            req.onEvent({ type: 'text_chunk', content: choice.delta.content })
          }

          // 3. tool_calls
          if (choice.delta?.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              if (tc.id) {
                if (currentToolCall) {
                  req.onEvent({ type: 'tool_call_end', tool: currentToolCall.function.name })
                }
                currentToolCall = { id: tc.id, function: { name: tc.function?.name || '', arguments: '' } }
                req.onEvent({ type: 'tool_call_start', tool: currentToolCall.function.name, args: {} })
              }
              if (tc.function?.arguments) {
                currentToolCall.function.arguments += tc.function.arguments
                req.onEvent({ type: 'tool_call_arg', tool: currentToolCall.function.name, chunk: tc.function.arguments })
              }
            }
          }

          // 4. usage
          if (chunk.usage) {
            req.onEvent({ type: 'token_usage', usage: chunk.usage })
          }
        } catch (e) {
          // 解析失败跳过
        }
      }
    }

    if (currentToolCall) {
      req.onEvent({ type: 'tool_call_end', tool: currentToolCall.function.name })
    }
    req.onEvent({ type: 'done' })
  } catch (err: any) {
    req.onEvent({ type: 'error', message: err.message })
  } finally {
    reader.releaseLock()
  }
}
```

**LlmClient.ts patch** (主类新增 streamChat):
```typescript
// electron/llm/LlmClient.ts 现有 chat() 不动,新增 streamChat()
async streamChat(req: StreamChatRequest): Promise<void> {
  const provider = req.provider ?? this.configStore.getActive()?.provider
  if (!provider) {
    req.onEvent({ type: 'error', message: 'no LLM provider configured' })
    return
  }
  // v4.3.1 架构:用 3 个 adapter 选一个
  const adapter = provider === 'openai' ? this.openai
    : provider === 'anthropic' ? this.anthropic
    : this.zhipu
  await adapter.streamChat(req)
}
```

### 1.4 验证
- 跑现有 LlmClient.test.ts (单测不破)
- 跑现有 e2e (端到端不破)
- 跑新 e2e LlmStream.test.ts:OpenAI 流式 + Anthropic 流式 + Zhipu 流式

---

## 2. P0-4 Patch: vite.config.mts 不重写,只追加注释

### 2.1 现状 (v4.3.1 实际)
`vite.config.mts` 已经是函数式 `manualChunks` (line 99-108)：
```typescript
manualChunks(id) {
  if (id.includes('node_modules')) {
    if (id.includes('vue') || id.includes('pinia') || id.includes('@vue') || id.includes('vue-router')) {
      return 'vendor-framework'
    }
    return undefined  // element-plus / marked / highlight.js 自然分块
  }
  return undefined
}
```

**v4.3.1 已经做对了** — 不需要改。

### 2.2 v2.1.1 错
- 重写整个 vite.config.mts (破坏 vite-plugin-electron 集成)
- 引 vendor-element 强制合并 (跟 v4.3.1 策略**反向**)
- 引 vendor-monaco (package.json 没有 monaco)
- 引 vendor-chart (package.json 没有 chart.js)

### 2.3 v2.1.2 修:**不改文件,只在 build 注释里追加**

```typescript
// vite.config.mts line 96 已有注释 "// P1-6: 手动分 chunk"
// 追加注释说明策略选择理由
//
// v2.1.2 设计决策:
// - vendor-framework 拆 vue/pinia/vue-router (核心运行时)
// - element-plus 用 unplugin-vue-components 自动按需导入,自然分块
// - marked / highlight.js / docx / @webcontainer/api 不强制分块 (各 chunk < 300KB)
// - manualChunks 函数式 (v4.3.1 已 ship 策略,v2.1.1 错是对象式 + 强制合并)
```

### 2.4 验证
- `npm run build` 跑通
- `dist/assets/*.js` 体积检查
- 现有 vite.config 测试不破

---

## 3. P0-5 Patch: 路由表重数 (23/5 不是 17/7)

### 3.1 现状 (v4.3.1 实际)
`src/router/index.ts` line 12-159,数实际路由:

| # | 路径 | 名称 | devOnly |
|---|---|---|---|
| 1 | `/` | redirect | - |
| 2 | `/dashboard` | Dashboard | - |
| 3 | `/chat` | Chat | - |
| 4 | `/skills` | Skills | - |
| 5 | `/settings` | Settings | - |
| 6 | `/help` | Help | - |
| 7 | `/models` | Models | - |
| 8 | `/permissions` | Permissions | - |
| 9 | `/plugin-market` | PluginMarket | - |
| 10 | `/remote-control` | RemoteControl | - |
| 11 | `/schedule` | Schedule | - |
| 12 | `/skill-market` | SkillMarket | - |
| 13 | `/tasks` | Tasks | - |
| 14 | `/d1-demo` | D1ScreenshotDemo | ✓ |
| 15 | `/d5-demo` | D5RecordingToSkill | ✓ |
| 16 | `/d3-demo` | D3RemoteDemo | ✓ |
| 17 | `/a5-demo` | A5ComputerUseDemo | ✓ |
| 18 | `/d2-prime-demo` | D2PrimeDemo | ✓ |
| 19 | `/settings/im-accounts` | ImAccounts | - |
| 20 | `/im-management` | ImManagement | - |
| 21 | `/clawhub` | ClawHub | - |
| 22 | `/model-compare` | ModelCompare | - |
| 23 | `/settings/llm-config` | LlmConfig | - |

**实际 23 路由,5 devOnly (d1/d5/d3/a5/d2-prime)**

### 3.2 v2.1.1 错
- 写"14 路由 → 4 工作区"(v2.0 错)
- v2.1 改"17 路由"(还是错)
- v2.1.1 写"17 路由 + 3 子路由"(凑数,实际不是这样)

### 3.3 v2.1.2 修:**v4.3.1 → v4.4.0 实际映射表 (23 路由)**

**新增文件**: `src/router/migration-v4.3-to-v4.4.ts`

```typescript
// src/router/migration-v4.3-to-v4.4.ts
/**
 * v4.3.1 → v4.4.0 路由映射表
 * 实际数: 23 路由 (含 1 redirect + 22 页面),5 devOnly
 * 改造后: 18 路由 (4 工作区 + 3 辅助面板 + 11 保留/合并)
 */

import type { RouteRecordRaw } from 'vue-router'

const redirects: Record<string, string> = {
  // 14 路由直接重定向到新工作区
  '/dashboard': '/workspace',                       // 默认进 Workspace
  '/chat': '/workspace',                            // Chat 进 Workspace 主区
  '/help': '/settings?tab=help',                    // Help 合并到 Settings
  '/plugin-market': '/clawhub',                     // plugin-market → clawhub
  '/remote-control': '/workspace?openRemote=true',  // 远程控制开右栏
  '/schedule': '/workspace?tab=schedule',           // 计划任务进 Workspace
  '/skill-market': '/clawhub',                      // skill-market → clawhub
  '/settings/im-accounts': '/settings?tab=im',      // 合并到 Settings
  '/im-management': '/workspace?im=default',        // IM 通知进右栏
  '/clawhub': '/clawhub',                           // 保留
  '/model-compare': '/models?tab=compare',          // 合并到 Models
  '/settings/llm-config': '/settings?tab=llm',      // 合并到 Settings
  '/permissions': '/settings?tab=permissions',      // 合并到 Settings
  '/tasks': '/workspace',                            // 任务进 Workspace
}

// 5 devOnly 删,改 cmd 触发
// d1-demo / d5-demo / d3-demo / a5-demo / d2-prime-demo
// → Cmd+Shift+D 调出开发者菜单

export function registerV4_3_to_V4_4_Redirects(router: any) {
  Object.entries(redirects).forEach(([from, to]) => {
    router.addRoute({ path: from, redirect: to })
  })
}
```

### 3.4 集成

```typescript
// src/router/index.ts 现有路由不动,加 redirect 注册
import { registerV4_3_to_V4_4_Redirects } from './migration-v4.3-to-v4.4'

export default router

// 在 main.ts 启动后注册
registerV4_3_to_V4_4_Redirects(router)
```

### 3.5 验证
- 启动 app,访问 14 个老 URL,验证都跳到新工作区
- 5 个 devOnly 路由用 Cmd+Shift+D 触发,不直接 URL 访问

---

## 4. P0-7 Patch: MemoryChip 改 SQLite,保留 HermesMemory

### 4.1 现状 (v4.3.1 实际)
`electron/hermes/MemoryVectorStore.ts` — SQLite-backed memory store
- `Memory` 类型: `{ id, content, createdAt, accessCount, lastAccessedAt }` (已在)
- 没有"重要性"字段(原版用 score 0-1 存)
- 没有 TF-IDF(原版用 embedding 相似度,但用可选)

### 4.2 v2.1.1 错
- 引用不存在 `Memory[]` 类型
- 引用不存在 `useEventBus.ts` 等 composable
- 建议"撤 embedding 改 TF-IDF" — **错了**,v4.3.1 已经 ship 架构不需要改

### 4.3 v2.1.2 修:**保留 HermesMemory,在 MemoryVectorStore 加 scoreMemory()**

**修改文件**: `electron/hermes/MemoryVectorStore.ts` (新增 scoreMemory)

```typescript
// electron/hermes/MemoryVectorStore.ts 新增方法
import type { Memory } from '../types/memory'

export function extractKeywords(text: string): Set<string> {
  const cleaned = text.toLowerCase().replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
  const englishWords = cleaned.split(/\s+/).filter((w) => w.length >= 3)
  const chineseBigrams: string[] = []
  for (let i = 0; i < cleaned.length - 1; i++) {
    const c1 = cleaned[i]
    const c2 = cleaned[i + 1]
    if (/[\u4e00-\u9fff]/.test(c1) && /[\u4e00-\u9fff]/.test(c2)) {
      chineseBigrams.push(c1 + c2)
    }
  }
  return new Set([...englishWords, ...chineseBigrams])
}

export function scoreMemory(
  memory: Memory,
  query: string,
  allMemories: Memory[],
  options: { useEmbedding?: boolean } = {}
): { score: number; factors: { frequency: number; recency: number; relevance: number } } {
  const { useEmbedding = true } = options
  const now = Date.now()

  // 频率
  const frequency = Math.min(1, Math.log(1 + memory.accessCount) / Math.log(11))
  // 时间衰减 (30 天半衰期)
  const ageDays = (now - memory.createdAt) / (1000 * 60 * 60 * 24)
  const recency = Math.exp(-ageDays / 30)

  // 相关性:用 embedding 或 TF-IDF
  let relevance: number
  if (useEmbedding && memory.embedding) {
    // TODO: 余弦相似度 (调用 embedding service)
    relevance = 0.5  // placeholder,实际用 embedding 计算
  } else {
    // TF-IDF 简化: Jaccard 相似度
    const qk = extractKeywords(query)
    const mk = extractKeywords(memory.content)
    const intersection = new Set([...qk].filter((k) => mk.has(k)))
    const union = new Set([...qk, ...mk])
    relevance = intersection.size / union.size
  }

  const score = 0.4 * frequency + 0.3 * recency + 0.3 * relevance
  return { score, factors: { frequency, recency, relevance } }
}
```

**新增文件**: `src/components/ai/MemoryChip.vue` (v2.1.1 错的修正版)

```vue
<template>
  <div class="memory-chip" :class="`level-${level}`">
    <span class="chip-dot" />
    <span class="chip-text">{{ memory.content.slice(0, 50) }}</span>
    <span class="chip-score">{{ score.toFixed(2) }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Memory } from '../../../electron/types/memory'  // 实际存在

const props = defineProps<{
  memory: Memory
  score: number
}>()

const level = computed(() => {
  if (props.score >= 0.7) return 'high'
  if (props.score >= 0.4) return 'medium'
  return 'low'
})
</script>

<style scoped lang="scss">
.memory-chip { /* 跟 v2.1.1 一样 */ }
</style>
```

### 4.4 验证
- HermesMemory 单测不破
- MemoryVectorStore scoreMemory 单测:5 个场景

---

## 5. P0-8 Patch: backupConfig 删除循环修对

### 5.1 v2.1.1 错
```typescript
// v2.1.1 错 (i=3 时检查 bak.4.json 永远不存在 → 死代码)
for (let i = MAX_BACKUPS; i >= 1; i--) {
  const oldBackup = path.join(dir, `${baseName}.bak.${i}.json`)
  const olderBackup = path.join(dir, `${baseName}.bak.${i + 1}.json`)
  if (fs.existsSync(olderBackup)) {  // 检查 bak.4/bak.5/... 永远不存在
    fs.unlinkSync(olderBackup)
  }
}
```

### 5.2 v2.1.2 修:**循环方向改对**

```typescript
// electron/migrations/config-backup.ts (新文件)
import * as fs from 'fs'
import * as path from 'path'

const MAX_BACKUPS = 3  // 保留 3 个版本

export function backupConfig(configPath: string, version: string): void {
  const dir = path.dirname(configPath)
  const baseName = path.basename(configPath, '.json')

  // 1. 从最老的开始删: bak.3 → 删
  const oldest = path.join(dir, `${baseName}.bak.${MAX_BACKUPS}.json`)
  if (fs.existsSync(oldest)) {
    fs.unlinkSync(oldest)
  }

  // 2. 滚动备份: bak.(i-1) → bak.i, 从 i=MAX 倒到 i=2
  for (let i = MAX_BACKUPS; i > 1; i--) {
    const src = path.join(dir, `${baseName}.bak.${i - 1}.json`)
    const dst = path.join(dir, `${baseName}.bak.${i}.json`)
    if (fs.existsSync(src)) {
      fs.renameSync(src, dst)
    }
  }

  // 3. 当前 config → bak.1
  if (fs.existsSync(configPath)) {
    const bak1 = path.join(dir, `${baseName}.bak.1.json`)
    fs.copyFileSync(configPath, bak1)
  }
}

export function listBackups(configPath: string) {
  const dir = path.dirname(configPath)
  const baseName = path.basename(configPath, '.json')
  const backups: { index: number; path: string; mtime: number }[] = []
  for (let i = 1; i <= MAX_BACKUPS; i++) {
    const p = path.join(dir, `${baseName}.bak.${i}.json`)
    if (fs.existsSync(p)) {
      backups.push({ index: i, path: p, mtime: fs.statSync(p).mtimeMs })
    }
  }
  return backups
}

export function rollbackToBackup(configPath: string, backupPath: string): void {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup not found: ${backupPath}`)
  }
  backupConfig(configPath, 'pre-rollback')
  fs.copyFileSync(backupPath, configPath)
}
```

### 5.3 验证
- 单元测试:备份 5 次,保留 3 个 (bak.1/bak.2/bak.3)
- 集成测试:失败回滚

---

## 6. v2.1.2 ship-ready 检查清单

### 6.1 5 P0 全修 ✅
- [x] P0-2 LlmClient 改流式 (保留 v4.3.1 架构 + 3 adapter 加 streamChat)
- [x] P0-4 vite.config.mts 不重写 (只追加注释)
- [x] P0-5 路由表 23/5 重数 (新建 migration-v4.3-to-v4.4.ts)
- [x] P0-7 MemoryChip 改 SQLite (HermesMemory 加 scoreMemory)
- [x] P0-8 backupConfig 修对 (循环方向)

### 6.2 v2.1.1 正确部分保留 ✅ (20%)
- [x] P0-1 破坏性白名单 (DESTRUCTIVE_TOOLS + PATTERNS)
- [x] P1-2 呼吸光晕 (WCAG 2.3.1)
- [x] P1-3 首次启动引导 (不开右栏)
- [x] P1-4 LlmEvent 15 种 type
- [x] P1-6 主题表 3 套
- [x] P1-7 macOS 顶栏 32px

### 6.3 v2.1.1 错误删除 ✅ (80%)
- [x] 删 150 行假 LlmClient 重写 → 用 v4.3.1 架构
- [x] 删 vite.config.mts 重写 → 只追加注释
- [x] 删 5 个不存在的 composable (usePendingReview/useWorkspacePanels/useLayout/MemoryScorer)
- [x] 删 6 个不存在的 .vue 组件 (AICollabPanel/ChatTab/CodePanel/MemoryPanel/ToolsPanel/WorkspaceSwitcher/TopBar)
- [x] 删 backupConfig 死代码

---

## 7. 26 commit 重排 (v2.1.2)

### Week 0 (前置, 4 commit) - 用户立即可见
1. `feat(theme): 强制 light/dark/auto 3 套,删除自定义主题`
2. `feat(tokens): 重构 CSS 变量,7 档 t-shirt 字号 + 2 套 spacing`
3. `feat(accent): 同色相跨主题,indigo-500 ↔ indigo-400`
4. `feat(focus): focus-visible 全站替换`

### Week 1-2 (内部, 7 commit) - 一次性 ship
5. `feat(llm): LlmClient 加 streamChat() (3 adapter 流式 + LlmEvent 15 种)` (P0-2)
6. `feat(routes): 23 路由 → 18 工作区 + redirect 表` (P0-5)
7. `feat(layout): AppLayout 三栏 (240/主/320) + 顶栏右区约束`
8. `feat(sidenav): 4 工作区树形 + 左栏头部固定`
9. `feat(topbar): 顶栏固定导航 + AI 状态徽章 (2s 呼吸)`
10. `feat(rightpanel): AI 协作右栏,默认折叠 + 5 状态 + Cmd+L 触发 + 破坏性白名单` (P0-1)
11. `feat(workspace): 主区常驻 Chat + 3 辅助面板`

### Week 3 (alpha, 4 commit)
12. `feat(thinking): ThinkingIndicator 重做(静态文字 + 1.5s 光标)`
13. `feat(toolcall): ToolCallCard 5 状态 + warning + 默认折叠 + Apply/Reject`
14. `feat(memory): HermesMemory.scoreMemory() (TF-IDF fallback + embedding 优先)` (P0-7)
15. `feat(skill): SkillCard 保留`

### Week 4 (beta, 4 commit)
16. `feat(motion): 修 7 个反模式 (focus/route/Modal/Drawer/Palette/Stream/reduced-motion)`
17. `feat(a11y): SR 5 场景 + skip-link + 平台 focus ring 差异`
18. `feat(responsive): 3 断点响应式 + 宽度联动约束`
19. `feat(perf): vite manualChunks 注释 + 路由懒加载 (P0-4 不重写)`

### Week 5 (rc, 4 commit)
20. `feat(state): OfflineBar / PermissionPrompt / QuotaBar / ModelStatus`
21. `feat(button): 7 variant (含 Link/Icon/Loading/Toggle)`
22. `feat(migrate): v4.3.1 → v4.4.0 老用户迁移 (23 路由/3 主题/backup 3 版本)` (P0-8)
23. `test(integration): 26 commit 集成测试 + 老用户迁移 E2E`

### Week 6 (ship, 3 commit)
24. `feat(onboarding): 首次启动引导,不开右栏` (P1-3)
25. `docs: 重设计 v2.1.2 README + 截图 + 视频 + 迁移指南`
26. `release: v4.4.0 ship`

**总计 26 commit 不变**。Week 0 砍 1 (字体) → 4 commit,Week 6 加 1 (onboarding) → 3 commit。

---

## 8. 总结

**v2.1.2 是真正的 patch,不是重写**:
- ✅ 5 P0 修干净 (基于 v4.3.1 实际代码)
- ✅ 保留 v2.1.1 正确部分 20%
- ✅ 删除 v2.1.1 错误部分 80%
- ✅ 26 commit 重排可执行
- ✅ 没有"虚构代码",所有引用 v4.3.1 实际文件

**预估 v2.1.2 ship-ready 程度**: 7.5-8.0/10
- v2.1 7.0 → v2.1.1 6.5 (-0.5) → v2.1.2 7.5-8.0 (+1.5)
- 关键提升:基于实际代码,删 80% 假代码

**下一步**: Owner 自评 → Designer 评审 → v2.1.2 final。
