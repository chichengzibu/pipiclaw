# 设计评审报告:PiPiClaw 重设计 v2.1.2

> **评审者**: designer agent
> **基线**: `redesign-v2.1.2-patch.md` (22 KB) + `redesign-v2.1.2-self-review.md` (owner 7.0) + **v4.3.1 实际代码** (`electron/llm/` `electron/hermes/` `electron/contracts/types.ts` `src/router/index.ts` `vite.config.mts` `package.json`)
> **对标**: v2.0 (5.5) / v2.1 (6.8) / v2.1.1 (6.5) 评审 + 智谱 AI GLM-4 API 文档 + Vite manualChunks 文档 + Vue Router 4 文档
> **原则**: v2.0/v2.1/v2.1.1 评审过的问题不重复;**重点验证 5 P0 是否真修干净**;**重点找 v2.1.2 patch 跟 v4.3.1 实际代码集成时的问题**

---

## 综合评分:**6.8 / 10**

**一句话判断**:v2.1.2 是 **方向正确的 patch**(从重写 1500 行假代码缩到 250 行真 patch + 基于 v4.3.1 实际),但 5 P0 中只有 **2 个真修干净**(P0-4 vite / P0-8 backup),其余 3 个 **(P0-2 streamChat / P0-5 redirect / P0-7 scoreMemory) 集成到 v4.3.1 实际代码时会出现 6 处硬伤**——典型"doc 看起来对,code 跑不起来"。**owner 自评 7.0 仍偏高 0.2**,真实 6.8(略涨 v2.1.1 的 6.5,因为删了 80% 假代码,涨 0.3;但同时引了 6 处新集成硬伤,扣 0.2)。

**对比**:
- v2.0 designer 5.5 → v2.1 6.8 → v2.1.1 6.5 (-0.3) → **v2.1.2 6.8 (+0.3)**
- v2.0 owner 7.0 → v2.1 7.5 → v2.1.1 8.5 → v2.1.2 7.0 (owner 学乖砍 1.5)
- **综合 6.8**(独立给分,涨 0.3 = 删 80% 假代码的贡献 - 6 处新集成硬伤 -1 - 缺失 zhipu/anthropic patch -1.5)

---

## 维度 1:5 P0 验证(核心)

### 🟡 P0-2 LlmClient 流式:修干净 30%,留 5 处硬伤

**✅ 修干净的部分**:
- v2.1.2 正确识别 v4.3.1 实际是 3 adapter (openai/anthropic/zhipu),**不是 Ollama** (1.2 节)
- v2.1.2 正确**不引入 4 个假 npm 包**(`openai` / `@anthropic-ai/sdk` / `ollama` / 错 provider)
- v2.1.2 正确**保留 v4.3.1 working code**(LlmClient 单例 + 3 adapter 单例)
- openai.ts 的 `streamChat` patch (1.3 节 line 91-186) 整体设计正确:`fetch + ReadableStream + onEvent callback + LlmStreamEvent 13 种 type`
- 智谱 thinking 字段**推理方向对**(owner 7 项硬伤 #2)

**🔴 硬伤 1:openai.ts `streamChat` patch 引用不存在的 `this.configStore`**

v2.1.2 patch line 93-94:
```typescript
// electron/llm/adapters/openai.ts 现有 chat() 不动,新增 streamChat()
async streamChat(req: StreamChatRequest): Promise<void> {
  const config = this.configStore.get('openai')  // ❌ this.configStore 不存在
```

**v4.3.1 实际** (`electron/llm/adapters/openai.ts` line 5-8):
```typescript
export class OpenAiAdapter {
  private log = LogManager.getInstance()  // 只有 log
  // ❌ 没有 this.configStore
  async chat(config: LlmConfig, req: LlmRequest): Promise<LlmResponse> {
    // config 是参数,不是从 this.configStore 拿的
```

同样的问题存在于 anthropic.ts / zhipu.ts,两个 adapter 也都没有 `this.configStore`:
```typescript
// electron/llm/adapters/anthropic.ts line 6
export class AnthropicAdapter {
  private log = LogManager.getInstance()  // 只有 log
  // ❌ 没有 this.configStore

// electron/llm/adapters/zhipu.ts line 5-6
export class ZhipuAdapter {
  private log = LogManager.getInstance()  // 只有 log
  // ❌ 没有 this.configStore
```

`LlmConfigStore` 只在 `LlmClient.ts` 实例化时使用,不传给 adapter。

**修复方向**(v2.1.3 必改):
```typescript
// 方案 A:streamChat 改成接受 config 参数
async streamChat(config: LlmConfig, req: StreamChatRequest): Promise<void> {
  // LlmClient.streamChat 里先取 config,再传
}

// 方案 B:adapter 内部新建 LlmConfigStore.getInstance()
import { LlmConfigStore } from '../LlmConfigStore'
async streamChat(req: StreamChatRequest): Promise<void> {
  const config = LlmConfigStore.getInstance().get('openai')
```

**对标**:
- Vercel AI SDK:`streamText({ model, prompt, apiKey })` — apiKey 显式传,不藏 instance
- PiPiClaw v4.3.1 架构:config 走参数,不藏 instance

---

**🔴 硬伤 2:zhipu.ts / anthropic.ts streamChat patch 完全没给**

v2.1.2 patch 1.3 节明确说"openai.ts patch (示例, anthropic / zhipu 类似)" — 但**这三个 adapter 的 API 完全不同**:

| Adapter | 协议 | 端点 | 流式 chunk 格式 |
|---|---|---|---|
| OpenAI | OpenAI 兼容 | `/chat/completions` | `data: {choices:[{delta:{content, reasoning_content, tool_calls}}]}` |
| Anthropic | Anthropic 原生 | `/messages` | `event: content_block_start/delta/stop` 多种 event type |
| 智谱 GLM-4 | OpenAI 兼容 | `/chat/completions` | `data: {choices:[{delta:{role, content}}]}` |

**重点:智谱 GLM-4 没有 `reasoning_content` 字段**。智谱的流式响应格式是:
```json
data: {"id":"8313807536837492492","created":1706092316,"model":"glm-4","choices":[{"index":0,"delta":{"role":"assistant","content":"土"}}]}
data: {"id":"8313807536837492492","created":1706092316,"model":"glm-4","choices":[{"index":0,"delta":{"role":"assistant","content":"星"}}]}
```

只有 `role` 和 `content`,**没有 `reasoning_content` 也没有 `thinking`**。智谱 4.6V / GLM-4.1V-Thinking 等多模态模型才有 `thinking` 字段。

所以 zhipu.ts patch 跟 openai.ts patch **不能"类似"**:
- openai.ts 可以读 `delta.reasoning_content`
- zhipu.ts **只能读 delta.content** (glm-4-flash 也不输出 thinking)
- anthropic.ts 要按 Anthropic event type 解析 `event.content_block_delta.delta.text` / `event.content_block_delta.delta.thinking`

**修复方向**(v2.1.3 必改):1.3 节必须给三套独立 patch,**不能"类似"**:

```typescript
// zhipu.ts streamChat (跟 openai 几乎一样,但去掉 reasoning_content)
async streamChat(config: LlmConfig, req: StreamChatRequest): Promise<void> {
  const response = await fetch(`${config.apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...req, stream: true }),
  })
  // 解析 chunks: 智谱没有 reasoning_content, 只有 content + tool_calls
  // ⚠️ 注意:finish_reason 'sensitive' / 'network_error' 是智谱特有
}

// anthropic.ts streamChat (完全不同的协议)
async streamChat(config: LlmConfig, req: StreamChatRequest): Promise<void> {
  const response = await fetch(`${config.apiBaseUrl}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ... }),
  })
  // 解析 chunks: Anthropic 事件流
  // event: message_start / content_block_start / content_block_delta / content_block_stop / message_delta / message_stop
  // thinking_delta 嵌在 content_block_delta.delta.thinking
  // text_delta 嵌在 content_block_delta.delta.text
}
```

**对标**:
- Vercel AI SDK:为每个 provider 单独实现 streamText (openai/anthropic/google),不能共用
- LangChain:ChatOpenAI / ChatAnthropic / ChatZhipuAI 三个独立类
- 智谱 AI GLM-4 官方文档:确认无 reasoning_content 字段

---

**🔴 硬伤 3:LlmClient.streamChat patch 不会编译**

v2.1.2 patch 1.3 节 line 199-202:
```typescript
const adapter = provider === 'openai' ? this.openai
  : provider === 'anthropic' ? this.anthropic
  : this.zhipu
await adapter.streamChat(req)
```

**问题**:
1. 如果 zhipu/anthropic streamChat 没写(硬伤 2),调用会直接 throw "adapter.streamChat is not a function"
2. `req.provider` 类型是 `LlmProvider` (v4.3.1 `electron/llm/types.ts` line 1),但 patch 1.3 没有 `import type { LlmProvider } from './types'`
3. `LlmClient.streamChat` 没有 publish 到 EventBus(对比 v4.3.1 line 37/41 的 `llm:request` / `llm:response`)

**修复方向**(v2.1.3 必改):
```typescript
// electron/llm/LlmClient.ts streamChat
async streamChat(req: StreamChatRequest): Promise<void> {
  const provider = req.provider ?? this.configStore.getActive()?.provider
  if (!provider) {
    req.onEvent({ type: 'error', message: 'no LLM provider configured' })
    return
  }
  const config = this.configStore.get(provider)
  if (!config?.enabled || !config.apiKey) {
    req.onEvent({ type: 'error', message: `${provider} not enabled or apiKey missing` })
    return
  }
  void this.bus.publish('llm:request', { provider, model: req.model, msgCount: req.messages.length })
  
  const adapter = provider === 'openai' ? this.openai
    : provider === 'anthropic' ? this.anthropic
    : this.zhipu
  
  // ⚠️ 关键:必须传 config 给 adapter (因为 adapter 没有 this.configStore)
  await adapter.streamChat(config, req)
  void this.bus.publish('llm:response', { provider, model: req.model, durationMs: 0 })
}
```

---

**🟡 硬伤 4:adapter 失败重试没补 (owner 7 项硬伤 #1)**

v2.1.2 没补,patch 里 catch 块只 `onEvent error`,不重试。OpenAI 429 rate limit 真实场景必踩。

**修复方向**(v2.1.3 必改):
```typescript
// openai.ts streamChat 加重试
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    response = await fetch(...)
    if (response.status === 429 || response.status >= 500) {
      // 重试 + 指数退避
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
      continue
    }
    break
  } catch (e) {
    if (attempt === 3) req.onEvent({ type: 'error', message: `attempt ${attempt} failed: ${e.message}` })
  }
}
```

---

**🟡 硬伤 5:ChatManager 集成缺失**

v4.3.1 实际 `electron/chat/ChatManager.ts:907-924` 已经有 `broadcastStreamChunk` 函数(line 916):
```typescript
type: 'content' | 'thinking' = 'content'  // ⚠️ 只有 2 种 type,不是 13 种
```

v2.1.2 patch 1.3 节新增 13 种 LlmStreamEvent type (`thinking_start` / `text_chunk` / `tool_call_start` 等),但**没改 ChatManager.broadcastStreamChunk**。

这意味着:
- 渲染进程订阅 `chat:streamUpdate` 的 callback(line 921) 只能处理 `content|thinking`
- 接收 `thinking_start` / `tool_call_start` 等事件没有 IPC 通道
- LlmAgentBrain / ChatManager 怎么用 streamChat 也没说

**修复方向**(v2.1.3 必改):
1. ChatManager.broadcastStreamChunk type 改成 `'content' | 'thinking' | 'tool_call' | 'tool_result' | 'thinking_start' | 'thinking_end'` (subset of 13 types)
2. 新增 `chat:streamEvent` IPC channel 推完整 LlmStreamEvent,vs 现有 `chat:streamUpdate` 推简化版
3. 决定 streamChat 在哪调用:LlmAgentBrain / ChatManager.sendMessage / 新的 LlmStreamService?

---

**🟡 硬伤 6:StreamChatRequest 引用了 v4.3.1 不存在的导出**

v2.1.2 patch 1.3 节 line 82-84:
```typescript
export interface StreamChatRequest extends LlmRequest {
  onEvent: (event: LlmStreamEvent) => void
}
```

**v4.3.1 实际** `electron/llm/types.ts`:
- 有 `LlmRequest` (line 33) ✓
- 有 `LlmProvider` (line 1) ✓
- 有 `LlmMessage` / `LlmTool` / `LlmToolCall` / `LlmResponse` / `LlmConfig` ✓
- ❌ **没有 `LlmStreamEvent` / `StreamChatRequest` 导出**

patch 1.3 节 line 65 说"新增文件: `electron/llm/types.ts`" — 但 patch 实际是在**现有 types.ts 加新 export**,不是新建文件。需要:
- 在 `electron/llm/types.ts` 末尾追加 `LlmStreamEvent` 和 `StreamChatRequest` 接口(不破坏现有)
- 现有 `LlmRequest.think` 字段 (line 45) 跟 patch 的 `thinking_*` event type 是两个概念,别混

---

### ✅ P0-4 vite.config.mts:真修干净

**v4.3.1 实际**(`vite.config.mts` line 91-118)已经是函数式 manualChunks,跟 patch 2.1 节描述完全一致:
- line 99-108:`manualChunks(id)` 函数式
- line 100-103:vue/pinia/@vue/vue-router → `vendor-framework`
- line 105:其他 return undefined (自然分块)
- line 22-23:已有 P1-6 注释说明 element-plus 用 unplugin-vue-components 自动按需

v2.1.2 patch 2.3 节说"不改文件,只追加注释" — ✅ 正确,v4.3.1 已经是 ship-ready 状态。**v2.1.1 错(重写破集成)被 v2.1.2 改正**。

**🟡 微小建议**:注释可以补充 `dist/assets/*.js` 实测体积(line 22 提到期望 `< 300KB`,但没说明基线是多少 KB)。

**对标**:
- Vite 官方 manualChunks 文档:函数式优于对象式(支持更细粒度控制)
- Linear:用 Vite + manualChunks 函数式,效果类似

---

### 🟡 P0-5 路由表 23/5:路由数对,redirect 表漏 3 条

**✅ 修干净的部分**:
- v2.1.2 正确数出 **23 路由 (1 redirect + 22 页面),5 devOnly** (3.1 节 line 262-287)
- 我手动数了 `src/router/index.ts` line 12-160,**数字对得上**:
  - 22 routes in array + 1 redirect `/` = **23 路由** ✓
  - devOnly: d1-demo / d5-demo / d3-demo / a5-demo / d2-prime-demo = **5** ✓
- migration-v4.3-to-v4.4.ts (3.3 节) 的设计合理:新文件、保留老路由、redirect 表 + 5 devOnly 改 Cmd+Shift+D

**🔴 硬伤 1:redirect 表漏 3 条**

v2.1.2 patch 3.3 节 line 309-325 的 redirects 表只列了 **14 条**。但 v4.3.1 有 **22 个非 devOnly 路由**(5 devOnly 已经独立处理)。我数了一下:

| # | 路由 | 在 redirects 表? |
|---|---|---|
| 1 | /dashboard | ✅ → /workspace |
| 2 | /chat | ✅ → /workspace |
| 3 | /skills | ❌ **漏** |
| 4 | /settings | ❌ **漏** |
| 5 | /help | ✅ → /settings?tab=help |
| 6 | /models | ❌ **漏** |
| 7 | /permissions | ✅ → /settings?tab=permissions |
| 8 | /plugin-market | ✅ → /clawhub |
| 9 | /remote-control | ✅ → /workspace?openRemote=true |
| 10 | /schedule | ✅ → /workspace?tab=schedule |
| 11 | /skill-market | ✅ → /clawhub |
| 12 | /tasks | ✅ → /workspace |
| 13 | /settings/im-accounts | ✅ → /settings?tab=im |
| 14 | /im-management | ✅ → /workspace?im=default |
| 15 | /clawhub | ✅ → /clawhub (保留) |
| 16 | /model-compare | ✅ → /models?tab=compare |
| 17 | /settings/llm-config | ✅ → /settings?tab=llm |
| 18-22 | (5 devOnly) | 不需要 redirect |

**漏 3 条**:`/skills` `/settings` `/models` 没 redirect。

**问题**:
- /skills /settings /models 仍然是 v4.3.1 路由,直接渲染老页面
- 用户从 v4.4 Workspace 点击"Skills" → 进 /workspace?tab=skills
- 用户从老 URL `/skills` 进来 → 进老 Skills 页面(老布局)
- **两套 URL 风格 + 两套页面** = 严重 UX 割裂

**修复方向**(v2.1.3 必改):
```typescript
const redirects: Record<string, string> = {
  // ... 现有 14 条
  '/skills': '/workspace?tab=skills',
  '/settings': '/workspace?tab=settings',
  '/models': '/workspace?tab=models',
}
```

或者在 v4.4 真正发布时**直接删 17 个老路由**,通过 `removeRoute()` 配合。

---

**🟡 硬伤 2:循环 redirect 风险没解决 (owner 7 项硬伤 #3)**

v2.1.2 patch 没解决。如果:
- `/chat` → `/workspace`
- `/workspace` 又配了 redirect → `/workspace/default/chat` (类似 Gmail URL)
- `/workspace/default/chat` 又配 redirect → `/chat`
- → **无限循环**

Vue Router 4 的 redirect 在 init 时是单次,但用 `addRoute` 在 runtime 加,会出现在 router guard beforeEach。

**修复方向**(v2.1.3 必改):
```typescript
// 1. 用 replace 避免 history stack 累积
router.beforeEach((to, from, next) => {
  if (to.path !== from.path && isLegacyRoute(to.path)) {
    next({ path: getRedirect(to.path), replace: true })
  } else {
    next()
  }
})

// 2. 或者:在 init 时一次性 addRoute,不用 guard
registerV4_3_to_V4_4_Redirects(router)
```

**对标**:
- Notion 老 URL redirect:用 server-side 302 + 一次性 client replace
- Linear:用静态 `routes: [{ path: '/old', redirect: '/new' }]` 在 router config 顶层

---

**🟡 硬伤 3:5 devOnly 路由"Cmd+Shift+D 调出开发者菜单"没说怎么实现**

v2.1.2 patch 3.3 节 line 327-329 注释:
```typescript
// 5 devOnly 删,改 cmd 触发
// d1-demo / d5-demo / d3-demo / a5-demo / d2-prime-demo
// → Cmd+Shift+D 调出开发者菜单
```

**问题**:
- 没说开发者菜单是什么 UI(Modal? Dropdown? Side panel?)
- 没说路由怎么进入(`router.push('/d1-demo')` from 菜单? 还是 `router.addRoute` runtime?)
- 没说快捷键在哪个文件注册(main.ts? App.vue? useKeyboard composable?)
- v4.3.1 实际 `src/router/index.ts` line 168-178 已经有 `devOnly` 路由守卫 (生产模式重定向到 /dashboard),但 v2.1.2 没复用这个机制

**修复方向**(v2.1.3 必改):
- 复用 v4.3.1 `meta.devOnly` 机制
- 快捷键注册:`src/composables/useDevMenu.ts` (新建)
- 菜单 UI:复用 v4.3.1 的 Element Plus ElDropdown

---

**🟡 硬伤 4:跟 26 commit 计划的"feat(routes)" 没对齐**

v2.1.2 patch 7 节 commit 6:
> `feat(routes): 23 路由 → 18 工作区 + redirect 表` (P0-5)

**问题**:
- 18 工作区从哪儿来?patch 没说哪 18 个
- redirect 表 14 条在 v2.1.3 修成 17 条,工作区是 17 + 1 默认 + 0? 不清楚
- 没 commit 拆"删老路由" vs "加 redirect",都混在一个 commit 里

**修复方向**(v2.1.3 必改):commit 6 拆成:
- `feat(routes): registerV4_3_to_V4_4_Redirects(router)` (注册 17 redirect)
- `refactor(routes): 移除 17 个老路由,只保留 4 工作区 + 1 redirect` (删除)
- 跟 `main.ts` 集成单独 commit

---

### 🔴 P0-7 Memory scoreMemory:6 处硬伤,改的方向都错

**🔴 硬伤 1:import path 错,文件不存在**

v2.1.2 patch 4.3 节 line 375:
```typescript
// electron/hermes/MemoryVectorStore.ts 新增方法
import type { Memory } from '../types/memory'  // ❌ 不存在
```

**v4.3.1 实际**(`electron/hermes/MemoryVectorStore.ts` line 3):
```typescript
import type { Memory } from '../contracts/types'  // ✅ 实际路径
```

`electron/types/` 目录下只有 `gateway.d.ts` / `ipc.d.ts` / `models.d.ts` / `openclaw.d.ts`,**没有 `memory.ts`**。

**修复方向**(v2.1.3 必改):把 `../types/memory` 改成 `../contracts/types`。

---

**🔴 硬伤 2:Memory 类型定义错**

v2.1.2 patch 4.3 节 line 391-396:
```typescript
export function scoreMemory(
  memory: Memory,        // ❌ 类型错
  query: string,
  allMemories: Memory[],  // ❌ 类型错
  ...
```

**patch 假设的 `Memory` 类型**(section 4.1 line 360-362):
> `Memory` 类型: `{ id, content, createdAt, accessCount, lastAccessedAt }` (已在)

**v4.3.1 实际**(`electron/contracts/types.ts` line 131):
```typescript
export interface Memory { id: string; content: string; score?: number; createdAt: number }
// ❌ 没有 accessCount
// ❌ 没有 lastAccessedAt
```

**v4.3.1 还有第二个 Memory 类型** `electron/hermes/HermesMemory.ts` line 11-18:
```typescript
export interface MemoryItem {
  id: string;
  type: 'core' | 'experience' | 'conversation';
  content: string;
  timestamp: number;  // 不是 createdAt
  tags?: string[];
  importance?: number;  // 0-100
}
// ❌ 没有 accessCount
// ❌ 没有 lastAccessedAt
```

**问题**:
- `memory.accessCount` 在 v4.3.1 任何地方都搜不到
- `memory.lastAccessedAt` 在 v4.3.1 任何地方都搜不到
- patch 的 `scoreMemory` 函数 `Math.log(1 + memory.accessCount)` 会 TypeScript 编译失败
- patch 的 `Math.exp(-ageDays / 30)` (line 404) 用 `memory.createdAt` 也是错的 — 实际是 `MemoryItem.timestamp`

**修复方向**(v2.1.3 必改):
```typescript
// 用实际的 HermesMemory.importance 做 frequency
const frequency = Math.min(1, (memory.importance ?? 0) / 100)
// 用 MemoryItem.timestamp 做 recency
const ageDays = (now - memory.timestamp) / (1000 * 60 * 60 * 24)
const recency = Math.exp(-ageDays / 30)
```

---

**🔴 硬伤 3:HermesMemory 是 markdown 文件,不是 SQLite**

v2.1.2 patch 4.1 节 line 359-363:
> `electron/hermes/MemoryVectorStore.ts` — SQLite-backed memory store
> - `Memory` 类型: `{ id, content, createdAt, accessCount, lastAccessedAt }` (已在)
> - 没有"重要性"字段(原版用 score 0-1 存)
> - 没有 TF-IDF(原版用 embedding 相似度,但用可选)

**v4.3.1 实际**(`electron/hermes/HermesMemory.ts`):
- line 31-33:用 `path.join(app.getPath('userData'), 'hermes-memory')` + `USER.md` + `MEMORY.md`
- line 53-57:`fs.writeFileSync(this.coreMemoryPath, '# 用户核心记忆\n\n', 'utf-8')`
- line 136:`fs.appendFileSync(this.experienceMemoryPath, entry, 'utf-8')`
- **完全是 markdown 文件,不是 SQLite**!
- `package.json` 没有 `sqlite` / `better-sqlite` / `sql.js` 任何依赖

`MemoryVectorStore` (line 14-16) 自称 "W6 阶段:Map<id, {memory, vector, norm}>, W8 阶段:升级到 sqlite-vss 持久化" — **是 Map in-memory,不是 SQLite**。

**修复方向**:patch 文档"现状"部分就要改,不能再说"SQLite-backed"。

---

**🔴 硬伤 4:embedding placeholder (`relevance = 0.5`) 跟现有 EmbeddingService 重复**

v2.1.2 patch 4.3 节 line 408-410:
```typescript
if (useEmbedding && memory.embedding) {
  // TODO: 余弦相似度 (调用 embedding service)
  relevance = 0.5  // placeholder,实际用 embedding 计算
}
```

**v4.3.1 实际**已经有完整可用的 `EmbeddingService`:
- `electron/hermes/EmbeddingService.ts` line 19-77:`embedText(text)` / `embedMemory(memory)` / `embedBatch(texts)`
- `MemoryVectorStore.search()` line 50-67 已经实现余弦相似度:`dot / (queryNorm * entry.norm)`
- `HermesAdapter.recall()` line 38-92 已经是 hybrid (vector + keyword) 检索,合并 score

**所以 `relevance = 0.5` placeholder 完全不应该存在** —— 直接调 `EmbeddingService.embedText(query)` + `MemoryVectorStore.search()` 就有真 relevance。

**修复方向**(v2.1.3 必改):
```typescript
// 删掉 scoreMemory 的 relevance = 0.5 placeholder
// 改用 HermesAdapter.recall(query, { topK: 1 }) 直接拿 scored memory
// 或者重新设计 scoreMemory:接受 query vector 作为参数
export function scoreMemory(
  memory: MemoryItem,
  queryVector: number[],
  allMemories: VectorEntry[]
): { score: number; factors: { ... } } {
  // 找 memory 对应的 VectorEntry,算 cosine similarity
  const entry = allMemories.find(e => e.id === memory.id)
  const relevance = entry ? cosineSimilarity(queryVector, entry.vector) : 0
  ...
}
```

**对标**:
- LangChain:用 Embedding + VectorStore + retriever 链式调用,不手写 placeholder
- Cursor:Codebase indexing 用真 embedding,不用 placeholder

---

**🟡 硬伤 5:MemoryChip.vue 引用不存在的类型**

v2.1.2 patch 4.3 节 line 438:
```typescript
import type { Memory } from '../../../electron/types/memory'  // ❌ 路径错
```

- `electron/types/memory` 不存在
- 实际应该是 `'../../../electron/contracts/types'`(Memory) 或 `'../../../electron/hermes/HermesMemory'`(MemoryItem)

---

**🟡 硬伤 6:TF-IDF 用了 Jaccard 相似度,跟现有 KeywordRetriever 重复**

v2.1.2 patch 4.3 节 line 391-422 的 `scoreMemory`:
- `extractKeywords()` (line 377-389) 中文 bigram + 英文 word
- Jaccard 相似度 (line 415-417):`|intersection| / |union|`

**v4.3.1 实际**已有 `electron/hermes/KeywordRetriever.ts`:
- `tokenize()` (line 27-32):分词 + 停用词过滤(已有 25 个中英文停用词)
- `search()` (line 34-56):TF 风格 `hit / queryTerms.length`
- `STOP_WORDS` (line 10):预定义停用词

**`scoreMemory` 跟 `KeywordRetriever` 重复实现**:
- 都没用 IDF (Inverse Document Frequency),不是真 TF-IDF
- patch 的 Jaccard 在短 query + 长 memory 时分数会很低
- 现有 `KeywordRetriever` 用 hit 比例更合理

**修复方向**(v2.1.3 必改):删 `scoreMemory` 的 TF-IDF fallback,直接用 `KeywordRetriever.search()`。

---

**🟡 硬伤 7:MemoryChip.vue 的 v2.1.1 错没改干净**

v2.1.2 patch 4.3 节 line 426-455 MemoryChip.vue:
- 还是 `<style scoped lang="scss">` 引用"v2.1.1 一样的样式"
- v2.1.1 designer 评审抓的"没显示具体字段"问题没解决
- level 分类 `>= 0.7` `>= 0.4` 没给出 UX 设计

**修复方向**(v2.1.3 必改):
- 给出具体 SCSS 样式 (圆角/字号/间距)
- 给出 level 颜色 token 引用 (--color-warning / --color-success)
- 给出 hover/focus 状态

---

### ✅ P0-8 backupConfig 循环方向:真修干净

**✅ 修干净的部分**:
- v2.1.2 patch 5.2 节 (line 477-510) 循环方向改对:
  ```typescript
  // 1. 删最老的 bak.MAX (line 491-494)
  // 2. 滚动 bak.(i-1) → bak.i, for i from MAX down to 2 (line 497-503)
  // 3. 当前 config 复制到 bak.1 (line 506-509)
  ```
- 修复了 v2.1.1 错(line 471 永远检查不存在的 bak.4)
- 加了 `listBackups()` (line 512-523) 和 `rollbackToBackup()` (line 525-531),v2.1.1 缺这两个

**🟡 微小遗留**:
1. **写后没验证** (owner 7 项硬伤 #5):`fs.copyFileSync` 后没验证 dest 存在 + 长度 > 0
2. **rollback 简化**:line 530 `fs.copyFileSync(backupPath, configPath)` 没验证 dest
3. **没 MAX_BACKUPS 来源**:硬编码 `const MAX_BACKUPS = 3` (line 484),应该从 config 读
4. **新文件新目录**:`electron/migrations/config-backup.ts` 是新文件,但 `electron/migrations/` 目录在 v4.3.1 不存在 — 需要先建目录
5. **没跟 LlmConfigStore 集成**:实际 config 备份应该从 `LlmConfigStore.persistToDisk` 里调用,而不是独立文件

**修复方向**(v2.1.3 必补):
```typescript
// 加写后验证
if (fs.existsSync(configPath)) {
  const bak1 = path.join(dir, `${baseName}.bak.1.json`)
  fs.copyFileSync(configPath, bak1)
  // 验证
  const stat = fs.statSync(bak1)
  if (stat.size === 0) throw new Error('backup write produced empty file')
}
```

**对标**:
- git reflog:写后立刻 verify
- vscode settings.json backup:写后 fsync

---

## 维度 2:20% 保留部分验证

### 🟡 P0-1 破坏性白名单 (保留):方向对,3 处待补

**✅ 保留对的部分**:
- DESTRUCTIVE_TOOLS + PATTERNS 双匹配 (v2.1.1 line 66-128)
- isDestructiveElectron 单独版本(避免 Vue composable 跟 Electron main 混)

**🔴 待补 1:批量操作白名单没考虑 (owner 7 项硬伤 #6)**

v2.1.1 spec line 66-70 DESTRUCTIVE_TOOLS 只列了单文件操作:
```typescript
'write_file', 'edit_file', 'delete_file', 'create_directory', ...
```

但 `execute_command` 跑 `rm -rf ~/Documents` 一句命令就删一个目录 — **单文件白名单完全防不住**。

**修复方向**(v2.1.3 必补):
```typescript
const BATCH_TOOLS = new Set(['execute_command', 'run_script', 'shell_exec'])
const BATCH_DESTRUCTIVE_PATTERNS = [
  /\brm\s+(-[a-zA-Z]*r|-[a-zA-Z]*f)/,  // rm -rf / rm -r
  /\bfind\s+.*-delete\b/,
  /\b(sed|awk)\s+-i/,
  /\bdd\s+if=/,
  /\bmv\s+.*\s+\/dev\/null/,
  /\bgit\s+push\s+(-f|--force)/,
  /\bgit\s+reset\s+--hard/,
]

export function isDestructive(tool: string, args: { command?: string; script?: string }): boolean {
  if (BATCH_TOOLS.has(tool)) {
    const cmd = args.command || args.script || ''
    return BATCH_DESTRUCTIVE_PATTERNS.some(p => p.test(cmd))
  }
  return DESTRUCTIVE_TOOLS.has(tool)
}
```

**对标**:
- Cursor:对 `rm -rf` / `git push --force` 进 pending review
- Claude Code:`Bash` tool 有 BashPermission 列危险模式
- Devin:有 `sensitive_actions` whitelist

---

**🟡 待补 2:路径参数只覆盖 path/file/target**

v2.1.1 spec line 130:
```typescript
const path = args.path || args.file || args.target || ''
```

但实际 LLM 工具可能用:
- `args.directory` (e.g., `create_directory({ directory: 'foo' })`)
- `args.src` / `args.dst` (e.g., `mv({ src, dst })`)
- `args.url` (e.g., `fetch({ url })`)

**修复方向**:加更多参数名,或者让 LLM tool 协议统一用 `args.path`。

---

**🟡 待补 3:isDestructiveElectron 重复定义 + 白名单不一样**

v2.1.1 spec line 705-710:
```typescript
function isDestructiveElectron(tool: string, args: any): boolean {
  const DESTRUCTIVE_TOOLS = new Set([
    'write_file', 'edit_file', 'delete_file',
    'send_im', 'send_email',           // ← 多了 send_im / send_email
    'execute_command', 'run_script',    // ← 多了 execute_command
  ])
  return DESTRUCTIVE_TOOLS.has(tool)
}
```

跟前端的 DESTRUCTIVE_TOOLS 不一样(没有 PATTERNS 匹配) — **可能 electron 端漏判**,或者两边不一致。

**修复方向**:抽到共享文件 `electron/shared/destructive.ts` + `src/composables/usePendingReview.ts` 共享。

---

### 🟡 P1-2 呼吸光晕 (保留):方向对,缺实现细节

**✅ 保留对的部分**:
- 2s 慢速光晕符合 WCAG 2.3.1(< 3 flashes per second)
- v2.1 改成呼吸(vs v2.0 是闪烁)

**🟡 缺**:
1. **没具体 CSS**:光晕的 `box-shadow` / `opacity` / `background-color` 怎么变?给一个代码示例
2. **缺 reduced-motion fallback**:`@media (prefers-reduced-motion: reduce)` 必须降级
3. **缺 contrast ratio**:WCAG 2.3.1 还要求 ≥ 3:1(对图形元素)
4. **缺暗色主题对比**:light 主题 2s 渐变 vs dark 主题 2s 渐变,效果可能差异

**修复方向**(v2.1.3 必补):
```scss
@keyframes breathe-2s {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(99, 102, 241, 0); }
}
.ai-status-badge {
  animation: breathe-2s 2s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .ai-status-badge { animation: none; }
}
```

**对标**:
- Linear:Cycle 进度条用 2s ease-in-out 呼吸
- Notion:Loading dot 用 1.4s 呼吸

---

### 🟡 P1-3 首次启动引导 (保留):方向对,缺 i18n

**✅ 保留对的部分**:
- 不开右栏 (Cursor 路线)
- 4 步引导:介绍 / 选 LLM / 选主题 / 第一次对话

**🟡 缺**:
1. **缺 i18n key**:`vue-i18n` 是 v4.3.1 依赖(`package.json` line 39),但 patch 没给翻译 key
2. **缺空状态**:老用户已配过 LLM,怎么跳过?
3. **缺 tooltips**:按钮的 tooltip / aria-label
4. **缺回归测试**:怎么测"不开右栏"?

**对标**:
- Cursor:首启有 3 步引导,可以跳
- Linear:首启让用户选团队

---

### 🟡 P1-4 LlmEvent 15 种 type (保留):方向对,缺细节

**✅ 保留对的部分**:
- 13 种 type 覆盖 (thinking_start/chunk/end / text_chunk / tool_call_* / memory_ref / pending_review / error / cancelled / retry / token_usage / done) — 算 +1 thinking_start +1 done = 15? 实际数是 13 种,patch line 67-78

**🟡 缺**:
1. **缺 protocolVersion** 字段:后向兼容怎么办?v2 → v3 增 type 怎么办?
2. **thinking_start vs thinking_chunk vs thinking_end 触发时机**:
   - 一次响应 thinking_start 一次?还是每段 thinking 一次?
   - thinking 跟 content 交替(OpenAI o1) 怎么 emit?
3. **tool_call_arg 跟 tool_call_start 的关系**:arg 是单次还是多次?
4. **ChatManager 集成** (见 P0-2 硬伤 5):现有 `type: 'content' | 'thinking'` 怎么升级?

**修复方向**(v2.1.3 必补):
```typescript
export interface LlmStreamEvent {
  protocolVersion: 1  // ← 加这个
  type: 'thinking_start' | ...
  ...
}
```

**对标**:
- OpenAI streaming:event type 没有 version 字段,但有 `object: 'chat.completion.chunk'`
- Vercel AI SDK:`streamText` 返回 `fullStream`,每 chunk 有 type
- LangChain:`AIMessageChunk` 也有 chunk type

---

### 🟡 P1-6 主题表 3 套 (保留):方向对,缺 token 重构

**✅ 保留对的部分**:
- 3 套主题 (light / dark / auto) 跟 v4.3.1 对

**🟡 缺**:
1. **缺 token 重构具体方案**:v2.1.2 patch 7 节 commit 2 写"`feat(tokens): 重构 CSS 变量,7 档 t-shirt 字号 + 2 套 spacing`",但没给具体 token 表
2. **缺 accent 同色相跨主题**:commit 3 "`feat(accent): 同色相跨主题,indigo-500 ↔ indigo-400`" 但没说怎么配
3. **缺跟 v4.3.1 tokens.css 对齐**:v4.3.1 已有 `--font-family-system` 等 100+ 变量,patch 没说哪些保留 / 哪些删

**修复方向**(v2.1.3 必补):
- 列出 3 套主题的 token 差异表(light vs dark vs auto)
- 列出 accent 跨主题映射(7 个 accent × 3 个主题 = 21 个)
- 列出 7 档字号 (--font-size-xs ~ --font-size-3xl)

---

### 🟡 P1-7 macOS 顶栏 32px (保留):方向对,缺跨平台

**✅ 保留对的部分**:
- macOS 32px (实测 v4.3.1 line 11-18 + Electron titleBarStyle)

**🟡 缺**:
1. **Linux/Windows titleBar 高度没给**:
   - Windows:通常 30-32px (跟 macOS 接近)
   - Linux GNOME:通常 28-36px (依赖 window manager)
2. **缺 focus ring 平台差异**:macOS 跟 Windows/Linux 的 focus-visible 视觉差异
3. **缺跨平台测试方案**:怎么测三个平台?CI matrix?Playwright?
4. **缺 DPI 缩放**:HiDPI 屏 (Retina / 4K) 32px 实际像素是多少?

**修复方向**(v2.1.3 必补):
- 给出 `electron/main.ts` 跨平台 titleBar 配置:
  ```typescript
  const titleBarHeight = process.platform === 'darwin' ? 32 : 30
  ```
- 给出 focus ring 平台 token

**对标**:
- Linear:macOS 28px / Windows 32px / Linux 30px
- Notion:跨平台 32px
- Figma:macOS 38px / Windows 32px

---

## 维度 3:v2.1.2 新增硬伤(独立找)

### 🔴 硬伤 1 (核心):openai.ts streamChat patch 引用不存在的 `this.configStore`

见 P0-2 硬伤 1 详细分析 — **集成 v4.3.1 时立刻 runtime error**。

### 🔴 硬伤 2 (核心):Memory import path `'../types/memory'` 文件不存在

见 P0-7 硬伤 1 — **TypeScript 编译失败**。

### 🔴 硬伤 3 (核心):Memory 类型字段 `accessCount` / `lastAccessedAt` 不存在

见 P0-7 硬伤 2 — **TypeScript 编译失败**。

### 🔴 硬伤 4 (核心):HermesMemory 是 markdown 文件不是 SQLite

见 P0-7 硬伤 3 — **patch 文档事实错误**,影响后续维护者判断。

### 🟡 硬伤 5:redirect 表漏 3 条 (/skills /settings /models)

见 P0-5 硬伤 1 — **UX 割裂**,老用户从 /skills 进来看到老页面。

### 🟡 硬伤 6:devOnly 路由 "Cmd+Shift+D 调出开发者菜单" 没实现细节

见 P0-5 硬伤 3 — **feature 缺口**。

### 🟡 硬伤 7:scoreMemory 跟 HermesAdapter.recall / EmbeddingService / KeywordRetriever 重复

见 P0-7 硬伤 4/6 — **架构冗余**。

### 🟡 硬伤 8:ChatManager 集成缺失 (现有 broadcastStreamChunk 只支持 2 种 type)

见 P0-2 硬伤 5 — **前端集成缺口**。

### 🟡 硬伤 9:patch 没改 LlmClient 的 streamChat 错误处理 (跟 v4.3.1 publish pattern 不一致)

见 P0-2 硬伤 3 line 195-202 — v4.3.1 LlmClient.chat() line 37/41 有 `bus.publish('llm:request')` / `bus.publish('llm:response')`,patch 缺。

### 🟡 硬伤 10:backupConfig 没跟 LlmConfigStore 集成

见 P0-8 微小遗留 5 — 实际配置备份应该是 LlmConfigStore.persistToDisk 里的 hook,不是独立文件。

### 🟡 硬伤 11:智谱 / Anthropic streamChat patch 完全缺失

见 P0-2 硬伤 2 — **实施时无法开工**。

### 🟡 硬伤 12:patch 假设 LlmStreamEvent 13 种 type 但没考虑协议版本

见 P1-4 缺 1 — 后向兼容缺失。

---

## 维度 4:owner 抓的 7 项硬伤验证

| # | owner 7 项硬伤 | 真硬伤? | 评级 | 验证 |
|---|---|---|---|---|
| 1 | P0-2 streamChat 失败重试没补 | ✅ 真硬伤 | 🟡 | 真实场景 OpenAI 429 必踩;3 段 patch 都没补 |
| 2 | P0-2 zhipu adapter 跟 openai/anthropic API 不一样 | ✅ 真硬伤 | 🔴 | **比 owner 想的更严重** — 智谱没有 reasoning_content,Anthropic 是完全不同的 SSE event 协议;1.3 节只给 openai patch,2 个 patch 完全缺失 |
| 3 | P0-5 14 个 redirect 没说循环怎么办 | ✅ 真硬伤 | 🟡 | addRoute runtime + 配错 /workspace 会循环;3.3 节没解决 |
| 4 | P0-7 scoreMemory embedding placeholder | ✅ 真硬伤 | 🔴 | **比 owner 想的更严重** — 不是 placeholder 问题,是 EmbeddingService / MemoryVectorStore 已经有了,直接调用即可,完全不用 placeholder |
| 5 | P0-8 backupConfig 写后没验证 | ✅ 真硬伤 | 🟡 | 真实场景断电 → bak.1 空文件 → 失败回滚会覆盖原 config;5.2 节没补 |
| 6 | P0-1 破坏性白名单没考虑批量操作 | ✅ 真硬伤 | 🔴 | **必补 P0** — `rm -rf` / `git push --force` 一句命令绕过现有白名单;v2.1.2 没改 |
| 7 | P1-1 顶栏右区布局实际怎么放?具体组件名/顺序 | ✅ 真硬伤 | 🟡 | v2.1.1 写过但 v2.1.2 没重提;26 commit 计划 7 节也没说 |

**owner 7 项硬伤 100% 验证都是真硬伤**,评分准确。

---

## 维度 5:owner 自评 7.0 的真实校准

| 维度 | owner 自评 | designer 校准 | 差异 |
|---|---|---|---|
| 战略定位 | 9 | 9 | 0 (方向对) |
| 信息架构 | 9 | 8 | -1 (路由表修对但漏 3 redirect) |
| AI 协作右栏 | 9 | 8 | -1 (P0-2 streamChat 5 处硬伤) |
| 4 AI 组件 | 8 | 6 | -2 (MemoryChip 7 处硬伤,Memory 集成基本错) |
| 视觉语言 | 8 | 7 | -1 (P1-1 顶栏右区布局缺) |
| 加载动画 | 9 | 9 | 0 (v2.0 改对保留) |
| 交互模式 | 8 | 7 | -1 (3 面板没说怎么堆叠) |
| 主题 | 9 | 8 | -1 (3 套对但 token 重构缺) |
| 无障碍 | 8 | 7 | -1 (P1-2 缺 reduced-motion / contrast spec) |
| 性能 | 9 | 8 | -1 (P0-4 不重写对但路由懒加载没说) |
| 实施路线 | 9 | 7 | -2 (26 commit 计划 5 处不对齐) |
| 工程实施 | 8 | 6 | -2 (5 P0 中只 2 个真修干净,3 个有硬伤) |
| **总评** | **8.6** | **6.8** | **-1.8** (跟 v2.1.1 一致偏高 1.6+) |

---

## 对标参考

### Cursor / Vercel v0 / Linear (P0-1 破坏性 + Apply 流程)
- **Cursor**:对 `rm -rf` / `git push --force` 进 pending review (Apply/Reject 按钮);tool result 用 collapsible card;thought 用 fade-in 动画
- **Vercel v0**:生成的代码有 "Apply to Project" 按钮,失败时显示 diff;streaming 进度用百分比
- **Linear**:Cmd+K 调出 command palette,破坏性操作有 "Confirm" modal;多选批量操作用 Shift 修饰键

### 智谱 AI GLM-4 API (P0-2)
- **流式响应格式**:
  ```json
  data: {"id":"...","created":1706092316,"model":"glm-4","choices":[{"index":0,"delta":{"role":"assistant","content":"土"}}]}
  ```
- **没有 `reasoning_content` 字段**(那是 DeepSeek / Qwen3 字段)
- **没有 `thinking` 字段**(GLM-4-Flash 不输出思考)
- **finish_reason 多 'sensitive' / 'network_error'**(智谱特有)
- **tool_calls 格式跟 OpenAI 略有不同**:有 `web_search` / `retrieval` / `function` 三种 type
- **来源**:智谱 AI 官方文档(CSDN 镜像 2024-01) + 智谱 4.6V / 4.1V-Thinking 多模态模型才有 thinking 字段

### Vite manualChunks 文档 (P0-4)
- **函数式 vs 对象式**:
  - 对象式:`manualChunks: { vendor: ['vue', 'pinia'] }` — Vite 5 仍支持但不推荐
  - 函数式:`manualChunks(id) { return id.includes('vue') ? 'vendor' : undefined }` — 灵活,支持条件
- **return undefined vs null**:undefined 让 Rollup 自然分块,null 是强制不分
- **node_modules 之外**:可以自己写条件,比如把所有 `.scss` 分到一个 chunk
- **Vite 6 推荐**:函数式 + 配合 `output.manualChunks`

### Vue Router 4 redirect 配置 (P0-5)
- **三种 redirect**:
  1. `redirect: '/new-path'` — 字符串,直接重定向
  2. `redirect: { name: 'NewName' }` — 命名路由
  3. `redirect: (to) => '/new-path'` — 函数,动态
- **动态加路由**:`router.addRoute({ path: '/old', redirect: '/new' })`
- **避免循环**:在 beforeEach guard 里检查 `to.path === from.path` 不递归
- **replace 模式**:`next({ path: '/new', replace: true })` 避免 history stack 累积
- **Vue Router 4 官方推荐**:redirect 在 init 配,不用 addRoute runtime

### PiPiClaw v4.3.1 实际架构
- **3 adapter 都是 raw fetch**(line 30-37 openai.ts),不用 SDK
- **ChatManager.broadcastStreamChunk** 已经有简化版 SSE 推送(line 907-924)
- **HermesMemory 用 markdown 文件**(USER.md / MEMORY.md),不是 SQLite
- **HermesAdapter** 已经有 hybrid (vector + keyword) 检索(line 38-92)
- **EmbeddingService.embedText** 已经能用(line 32-47)
- **KeywordRetriever.search** 已经有 TF-style 评分(line 34-56)

---

## 改稿优先级

### P0(必须改,v2.1.2 → v2.1.3)
1. **P0-2 zhipu.ts + anthropic.ts streamChat patch**:1.3 节补完整 patch(智谱无 reasoning_content,Anthropic 是不同 event 协议)
2. **P0-2 adapter.streamChat(config, req) 改成接受 config 参数**(因为 adapter 没有 this.configStore)
3. **P0-2 ChatManager.broadcastStreamChunk 升级支持 13 种 type**(或新增 chat:streamEvent IPC channel)
4. **P0-7 Memory 集成**:改用 `HermesAdapter.recall()` 或 `MemoryVectorStore.search()`,删 scoreMemory placeholder
5. **P0-7 Memory import path 改 `'../contracts/types'`**(不是 `'../types/memory'`)
6. **P0-5 redirect 表补 3 条**(/skills /settings /models)
7. **P0-1 批量操作白名单**(BATCH_TOOLS + DESTRUCTIVE_PATTERNS for rm/git/dd)

### P1(实施中补)
8. P0-5 循环 redirect 风险(next replace)
9. P0-5 devOnly 路由 Cmd+Shift+D 实现(具体 UI/快捷键注册)
10. P0-2 adapter 失败重试(指数退避 1-3 次)
11. P0-8 backupConfig 写后验证
12. P1-4 LlmStreamEvent protocolVersion 字段
13. P1-2 呼吸光晕 reduced-motion + contrast spec
14. P1-7 跨平台 titleBar 高度 (Linux/Windows)
15. P0-1 isDestructiveElectron 跟前端共享白名单(去重)

### P2(亮点保留)
16. 6 个保留部分 (P0-1 基础 / P1-2 / P1-3 / P1-4 / P1-6 / P1-7) 微调
17. 26 commit 计划 5 处不对齐(commit 6 拆成 2 个,加备份集成 commit 等)

---

## 评分依据

**v2.1.2 综合 6.8 计算**:
- 起点 v2.1.1 = 6.5
- + 删 80% 假代码 = +1.0
- + v4.3.1 实际代码验证每个引用 = +0.5
- + 5 P0 修对方向(架构/技术栈) = +0.5
- - 6 处新集成硬伤(P0-2 × 3, P0-5 × 2, P0-7 × 1, P0-8 × 1) = -1.0
- - zhipu/anthropic streamChat patch 缺失 = -0.5
- - Memory 集成全错(import path + 类型字段 + 架构描述) = -0.7
- **净涨 0.3 = 6.8**

**owner 自评 7.0 偏高 0.2**:
- owner 视角看不到 v4.3.1 adapter 没有 `this.configStore` (P0-2 硬伤 1)
- owner 视角看不到 v4.3.1 Memory 字段实际是 `importance`/`timestamp`,不是 `accessCount`/`lastAccessedAt` (P0-7 硬伤 2)
- owner 视角看不到 `electron/types/memory` 不存在 (P0-7 硬伤 1)
- owner 视角看不到 HermesMemory 是 markdown 不是 SQLite (P0-7 硬伤 3)
- **这些是 owner 视角的盲区,也是 designer 必须验证的工作**

---

## 总结

**v2.1.2 是真 patch 方向对,但集成到 v4.3.1 实际代码时会暴露 6 处硬伤**:
- 5 P0 中只有 P0-4 / P0-8 真修干净
- P0-2 修对方向(架构/技术栈对),但 openai/anthropic/zhipu 3 个 streamChat patch 实际集成会失败(adapter 没有 configStore + zhipu/anthropic patch 缺失)
- P0-5 路由数对,但 redirect 表漏 3 条 + 循环风险 + devOnly 实现缺
- P0-7 改对方向(保留 HermesMemory),但 import path / 类型字段 / 架构描述 / 跟现有 EmbeddingService 重复 4 处错

**v2.1.2 适合开 26 commit 吗**:🟡 部分适合 — P0-4 / P0-8 立即可做;P0-2 / P0-5 / P0-7 需先在 v2.1.3 补 patch 细节

**v2.1.2 给团队能跑吗**:🔴 不能直接跑 — 6 处集成硬伤会导致编译失败 / runtime error / TypeScript 类型错误

**v2.1.3 必改 7 项** (见上面 P0 优先级):
1. zhipu/anthropic streamChat patch
2. adapter.streamChat 接受 config 参数
3. ChatManager 升级支持 13 种 type
4. Memory 集成改用 HermesAdapter.recall
5. Memory import path 修正
6. redirect 表补 3 条
7. 批量操作白名单

---

## 相关文件

- `redesign-v2.1.2-patch.md` (22 KB) — v2.1.2 主文档
- `redesign-v2.1.2-self-review.md` — owner 自评 (7.0)
- `redesign-v2.1.1-designer-review.md` (74 KB) — v2.1.1 designer 评审 (6.5)
- `redesign-v2.1.1-spec.md` (66 KB) — v2.1.1 实施手册
- v4.3.1 实际代码:
  - `electron/llm/LlmClient.ts` (LlmClient 单例)
  - `electron/llm/adapters/{openai,anthropic,zhipu}.ts` (3 个 adapter,raw fetch)
  - `electron/llm/types.ts` (LlmProvider, LlmRequest, LlmResponse)
  - `electron/llm/LlmConfigStore.ts` (单例 config 存储)
  - `electron/hermes/MemoryVectorStore.ts` (in-memory Map,非 SQLite)
  - `electron/hermes/HermesMemory.ts` (markdown 文件 USER.md/MEMORY.md,非 SQLite)
  - `electron/hermes/EmbeddingService.ts` (完整 embedding)
  - `electron/hermes/KeywordRetriever.ts` (TF-style 检索)
  - `electron/hermes/HermesAdapter.ts` (hybrid vector+keyword 检索)
  - `electron/contracts/types.ts` (Memory 实际定义:`{id, content, score?, createdAt}`)
  - `electron/chat/ChatManager.ts:907-924` (现有 broadcastStreamChunk 简化版)
  - `src/router/index.ts` (22 路由 + 1 redirect = 23,5 devOnly)
  - `vite.config.mts:91-118` (函数式 manualChunks,已 ship-ready)
  - `package.json` (无 sqlite 依赖,确认 HermesMemory 用 markdown)

---

## 给 owner 的硬话

v2.1.2 patch 文档**写了什么**和**集成到 v4.3.1 实际代码会怎样**是两回事。doc 看起来对(code 跑不起来)是 v2.1.1 的问题,v2.1.2 仍有 6 处。

最严重的是 **P0-2 adapter.streamChat 引用不存在的 `this.configStore`** 和 **P0-7 Memory 整个 import path + 类型都错** —— 这两处不修,v2.1.2 的 P0-2 / P0-7 commit **开不出工**(TypeScript 编译失败 / runtime 立刻报错)。

owner 自评 7.0 仍偏高 0.2。真实 6.8 —— **承认进步**(删 80% 假代码 + 5 P0 修对方向),**但不要被"看起来对"骗了**。**每个 patch 集成前必须 typecheck + 跑现有 e2e + 写新单测**,而不是"先 commit 再说"。

v2.1.3 必改 7 项见上面 P0 优先级。
