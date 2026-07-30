# 设计评审报告:PiPiClaw 重设计 v2.1.1

> **评审者**: designer agent
> **基线**: `redesign-v2.1.1-spec.md` (66.4 KB · 2337 行) + `redesign-v2.1.1-self-review.md` (owner 8.5)
> **对照**: `redesign-v2.1-designer-review.md` (v2.1 评 6.8) + `redesign-v2-designer-review.md` (v2.0 评 5.5) + **v4.3.1 实际代码** (`electron/llm/` `vite.config.mts` `src/router/` `src/styles/` `package.json`)
> **原则**: v2.0/v2.1 评审过的问题不重复;**重点验证 3 事实错是否真修干净**;**重点找 v2.1.1 "代码能不能跑"** 的问题(漏 import / 漏 type / 漏生命周期 / 漏 IPC channel / 引用不存在的文件);不客气。

---

## 综合评分:**6.5 / 10**

**一句话判断**:v2.1.1 在**叙事**上是 ship-ready 实施手册(1500+ 行代码,每项都给了具体文件 + 函数 + 验证),但对照 v4.3.1 实际代码后,这是一份**"对空气挥拳 + 制造新伤"** 的文档——**3 事实错中只有 1 个是真错**(LlmClient 流式层),其他 2 个 v4.3.1 早就修对了(字体 + manualChunks),spec 假装修复 = 文档虚构;更严重的是** spec 90% 的代码引用了不存在的文件 / 不存在的目录 / 不存在的 npm 包**,copy-paste 跑不起来。"**3 事实错修干净**" 是 owner 自评 8.5 的核心依据,但**实际只有 1/3 真错被改,2/3 是文档虚构 + 重复造已存在的轮子**。v2.1.1 比 v2.1 (6.8) **还低 0.3**,因为制造了新问题(破坏现有 3-adapter 架构 + 引用不存在的依赖 + 重复实现 v4.3.1 已有的功能)。**真正的提升在 P0-1 破坏性白名单 + 内存安全约束 + 一些 P1 的样式细节**——但这是 20% 的工作量,不应该拿 8.5 的总分。

**对比**:
- v2.0 designer 5.5 → v2.1 6.8 → v2.1.1 6.5:**-0.3** (制造新伤比 v2.1 还多)
- v2.0 owner 7.0 → v2.1 owner 7.5 → v2.1.1 owner 8.5:同向(+1.5 三版)
- **综合 6.5**(独立给分,不受 owner 自评 8.5 影响)

---

## 维度 1:3 事实错验证(核心)

> 这是 v2.1.1 自评"3 事实错全修干净 ✅"的核心承诺。

### 🔴 事实错 1:LlmClient 非流式 — 🟡 **修一半 + 引入 4 个新错**

**v4.3.1 实际状态**(`electron/llm/LlmClient.ts` line 38-40 + `electron/llm/adapters/openai.ts` line 49 `await res.json()`):
- LlmClient.chat() **是**非流式,3 个 adapter(openai/anthropic/zhipu)都是 `await fetch(...)` + `await res.json()`
- **但是**:在 chat 层 `electron/chat/ChatManager.ts` line 907-922 **已经有真 SSE 增量推送**:
  ```typescript
  // v4.3.1 ChatManager.ts:907-922
  /**
   * Phase 3 Task 1: 真 LLM SSE 增量推送
   * 每收到一个 SSE data 行就立即广播一个增量 chunk 到 chat:streamUpdate,
   * 渲染进程 store 通过订阅 onStreamUpdate 把 delta 累积到消息 content,
   * 实现逐 token 平滑滚动而非节流整条消息重发。
   */
  private broadcastStreamChunk(...)
  ```
- 也就是说,**v4.3.1 的 LLM 流式在 ChatManager 层已经实现,通过 `chat:streamUpdate` IPC channel 推送到渲染进程的 `window.electronAPI.chat.onStreamUpdate` callback** (preload.ts line 778-782)

**v2.1.1 改法** (3.2 节 LlmClient.ts 完整重写 250 行):
- ✅ 方向对:LlmClient 改流式(用 `async *streamChat` AsyncGenerator)
- 🔴 **新错 1:引入了 v4.3.1 package.json 没有的依赖**
  - 3.2 节 line 389-391: `import OpenAI from 'openai'; import Anthropic from '@anthropic-ai/sdk'; import { Ollama } from 'ollama';`
  - **实际 package.json 没有这 3 个包** (已 grep 验证 `node_modules/openai` `node_modules/@anthropic-ai` `node_modules/ollama` 都不存在)
  - `npm install openai @anthropic-ai/sdk ollama` 后还要解决:OpenAI SDK v4+ ESM-only、Vite 6 SSR 兼容、bundle 体积 +200KB
  - **v4.3.1 实际架构是 raw fetch**(`openai.ts` line 30-37 用 `fetch` 而非 OpenAI SDK),不用 SDK 是有意的(避免 +200KB bundle + 锁定特定版本)
- 🔴 **新错 2:错误识别 provider list**
  - 3.2 节 line 393: `export type LlmProvider = 'openai' | 'anthropic' | 'ollama';`
  - **实际 v4.3.1**(`electron/llm/types.ts` line 1): `export type LlmProvider = 'openai' | 'anthropic' | 'zhipu';` — 是 **Zhipu(智谱)不是 Ollama**
  - Ollama 是通过 OpenAI 兼容 API + Vite proxy 走的(vite.config.mts line 13-18 的 `/ollama/*` 代理)
  - spec 写"Ollama 3 adapter"是**虚构的第 4 个 provider**——Ollama 没有官方 SDK,需要新写流式协议
- 🔴 **新错 3:Anthropic stream 代码结构错**
  - 3.2 节 line 581-589: 用 `for await (const event of stream)` + `(event.delta as any).type === 'thinking_delta'`
  - **真实 Anthropic SDK `messages.stream()`** 的事件类型是 `content_block_start` / `content_block_delta` / `content_block_stop` 等,delta 的 `type` 字段**只在 `content_block_delta` 事件**的 delta 内部(用于区分 `text_delta` vs `input_json_delta` vs `thinking_delta`),而**不是 `thinking_delta` 事件本身**
  - 真正处理 thinking 的代码应该是 `event.type === 'content_block_start' && event.content_block.type === 'thinking'`,然后接收后续的 `event.type === 'content_block_delta' && event.delta.type === 'thinking_delta'`
  - spec 代码大概率**跑起来报 TS 类型错误或拿到 undefined.content**
- 🔴 **新错 4:破坏现有 3-adapter 架构**
  - 3.2 节 LlmClient.ts 完整重写 = 删了 `electron/llm/adapters/openai.ts` `anthropic.ts` `zhipu.ts` (各 50 行 = 150 行)
  - 但这三个 adapter 是 v4.3.1 已经工作的代码,被 `LlmClient.ts` line 14-16 实例化:
    ```typescript
    // v4.3.1 LlmClient.ts line 14-16
    private openai = new OpenAiAdapter()
    private anthropic = new AnthropicAdapter()
    private zhipu = new ZhipuAdapter()
    ```
  - spec 重写后,这 3 个 adapter 变成孤儿代码,要么删,要么留着不一致
  - LlmConfigStore / LlmProvider type system / llmConfig.* IPC (preload.ts line 1137-1146) **全部要跟着改**

**对标**:
- Cursor: 用 `openai` npm 包(因为 Cursor 主要服务 OpenAI + Anthropic)
- Vercel v0: 用 `ai-sdk`(Vercel 自家)
- PiPiClaw v4.3.1: 用 raw fetch(避免 SDK bundle 体积 + 跨 provider 抽象)
- **PiPiClaw v2.1.1**:换成 SDK,违背 v4.3.1 选 raw fetch 的初衷

**🟡 结论**:LlmClient 改流式**方向对**(LlmClient 层确实应该流式),但**实施 = 删 150 行 working code + 引入 3 个不存在的 npm 依赖 + 写错 provider 名单 + 写错 Anthropic stream 结构**。**没修干净,反而制造新伤**。

---

### ✅ 事实错 2:字体前提错 — ✅ **修干净**(但其实不用修)

**v4.3.1 实际状态**:
- `src/styles/tokens.css` line 123-128: `--font-family-system: -apple-system, BlinkMacSystemFont, 'SF Pro Display', ...` (Apple HIG 栈)
- `src/styles/reset.scss`(已确认存在)
- `grep -r 'Inter' src/` 只在 `src/stores/openclaw.ts` 出现 1 次,**不是字体引用**
- **`public/` 目录不存在**(已验证)
- **v4.3.1 不下载 Inter 字体**,`tokens.css` line 1 明确写 "Apple HIG-inspired" + line 10 "Apple macOS Sonoma / iOS 17 - SF Pro typography + system materials"

**v2.1.1 改法** (4.2 节 fonts.scss):
- ✅ 方案对: 保留 v4.3.1 系统默认栈,砍 Inter 改动
- ✅ decision 文档清楚(4.3 节"为什么不用 Inter"4 条 + "为什么不用 HarmonyOS Sans SC"3 条)
- 🟡 **但其实不用改** — v4.3.1 已经是这个状态,只是 v2.0/v2.1 spec 误以为 v4.3.1 用了 Inter
- 🟡 **新文件路径错** — 4.2 节要新建 `src/styles/fonts.scss`,**但 v4.3.1 的字体定义已经在 `tokens.css`**(line 122-128)和 `variables.scss` 里
  - 创建新文件 vs 改 tokens.css = 多此一举
  - 如果非要新建 fonts.scss,**需要先确认 tokens.css 不再 import 字体变量**(否则重复定义)

**4.4 节 Week 0 砍 1 commit**:
- v2.1 Week 0 5 commit → v2.1.1 Week 0 4 commit(砍 Inter commit)
- **但 v2.1 Week 0 也没真做这个 commit**——v2.1 是 spec,v4.3.1 没 Inter
- 砍 1 commit = "砍 1 个 spec 上的 commit" ≠ "砍 1 个 actual code commit"
- 真实工作量 = 0(不用改代码,只改 spec)

**对标**:
- Linear: 系统字体栈(不下载 Inter)
- Notion: 系统字体栈
- Figma: 系统字体栈
- PiPiClaw v4.3.1: 系统字体栈(已经对)
- **PiPiClaw v2.1.1**:保持系统字体栈(已经对)

**✅ 结论**:**修干净**(虽然不需要修)。这是 v2.1.1 spec 唯一一个**对**的事实错处理——但本质是"纠正 v2.0 自己的错误认知",不是"修 v4.3.1 的 bug"。

---

### 🟡 事实错 3:vite manualChunks API — 🟡 **方向对,但 v4.3.1 已经修对了**

**v4.3.1 实际状态**(`vite.config.mts` line 99-108):
```typescript
manualChunks(id) {
  if (id.includes('node_modules')) {
    if (id.includes('vue') || id.includes('pinia') || id.includes('@vue') || id.includes('vue-router')) {
      return 'vendor-framework';
    }
    // marked / highlight.js / element-plus / 其余: 自然分块
    return undefined;
  }
  return undefined;
}
```
- **v4.3.1 已经是函数式 manualChunks**,line 99 `manualChunks(id) {...}`
- **只拆 1 个 chunk**(`vendor-framework`),其余走 Vite 自然分块
- 注释 line 96-98 明确: "element-plus 已由 unplugin-vue-components 自动按需导入,让 rollup 自然分块到各路由 (而不是强制合并成 vendor-element-plus)"

**v2.1.1 改法** (5.2 节 vite.config.mts):
- ✅ 方向对:函数式 manualChunks(沿用 v4.3.1)
- 🔴 **但 v4.3.1 已经是函数式了**——这不是"修",这是"沿用"
- 🟡 5.2 节要拆 6 个 vendor chunk + 5 个 feature chunk = **11 个新 chunk**:
  ```typescript
  if (id.includes('monaco-editor')) return 'vendor-monaco';  // ❌ package.json 没 monaco-editor
  if (id.includes('element-plus')) return 'vendor-element';   // ⚠️ 已被 unplugin 自动分块,强制合并会反弹
  if (id.includes('chart.js') || id.includes('d3')) return 'vendor-chart';  // ❌ package.json 没 chart.js/d3
  if (id.includes('markdown-it') || id.includes('highlight.js')) return 'vendor-markdown';  // 🟡 package.json 有 marked/highlight.js,没 markdown-it
  if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) return 'vendor-vue';  // 🟡 v4.3.1 已叫 vendor-framework,改名 = 浪费用户 cache
  ```
- 🔴 **vendor-monaco chunk 永远空** — package.json 没 monaco-editor
- 🔴 **vendor-element chunk 会反弹** — vite.config.mts line 22-34 用 `unplugin-vue-components` 按需导入,强制合并成 1 个 chunk 会**让按需导入失效,每个用 Element Plus 的页面都要加载整个 chunk**
- 🔴 **vendor-chart 永远空** — package.json 没 chart.js 也没 d3
- 🟡 **5.3 节 chunk 预算不准** — vendor-monaco 预算 300KB,但实际 monaco-editor 是 4MB+ (gzip 后 1.2MB),v2.1 designer 评审已经抓过,spec 没修正

**5.3 节"实际"列是空的**:
```markdown
| Chunk | 目标 gzipped | 实际 |
|---|---|---|
| main.js | < 500 KB | 现状 ~280 KB |  ← 填了
| vendor-vue | < 100 KB | ~40 KB |  ← 填了
| vendor-element | < 200 KB | ~150 KB |  ← 填了,但 1.2 都不准
| vendor-monaco | < 300 KB (懒加载) | 动态 |
| vendor-markdown | < 100 KB | ~50 KB |  ← 填了
| feature-ai | < 200 KB | 待测 |  ← 6 个 feature 全是"待测"
```
- 5 个 chunk 是"待测" = spec 没跑 build 验证
- 真实情况需要:1. install monaco-editor / chart.js 等;2. build;3. 看 dist/assets/*.js 体积
- 现在是"凭感觉给数字"

**对标**:
- Vite 官方文档:推荐函数式 manualChunks,v4.3.1 已经是
- Rollup 文档:函数式才能按 id 匹配路径,对象式只能匹配 package name
- **PiPiClaw v4.3.1 已经是函数式,只是拆得少(1 个 chunk)**
- **PiPiClaw v2.1.1**:函数式,拆 11 个(但 3 个永远空,1 个会反弹)

**🟡 结论**:**方向对,实施有问题**。v4.3.1 manualChunks 是**已经对了的**,v2.1.1 在此基础上**制造新错**(monaco/chart 永远空 + element-plus 强制合并反弹 + 没 build 验证)。spec 假装"修对象式 → 函数式"= 文档虚构,因为 v4.3.1 本来就是函数式。

---

### 维度 1 小结:3 事实错中 0 个真修干净

| 事实错 | v4.3.1 实际 | v2.1.1 改法 | 评价 |
|---|---|---|---|
| LlmClient 非流式 | LlmClient 层非流式,但 ChatManager 层已有 SSE 流式 | 重写 LlmClient.ts 250 行 SDK 流式 | 🟡 方向对,4 个新错(假包/假 provider/错 API/破坏架构) |
| 字体前提错 | v4.3.1 本来就是系统字体栈,没 Inter | 砍 Inter 改动 + 保留 v4.3.1 栈 | ✅ 修干净(其实不用修) |
| vite manualChunks | v4.3.1 已经是函数式,只拆 1 个 chunk | 函数式 + 拆 11 个 chunk | 🟡 方向对,3 个 chunk 永远空 + 1 个会反弹 |

**owner 自评"3 事实错全修干净 ✅"是误导性陈述**:
- 1 个修干净(字体)—— 但其实不用修
- 1 个修一半 + 制造新错(LlmClient)
- 1 个方向对 + 制造新错(manualChunks)

---

## 维度 2:7 P0 工程实施验证

### P0-1 破坏性操作白名单 — 🟡 留尾巴

**spec 2.2 节 usePendingReview.ts 70 行**:
- ✅ 15 个 DESTRUCTIVE_TOOLS(Set) + 15 个 DESTRUCTIVE_PATH_PATTERNS(regex)双匹配
- ✅ ToolCallCard.vue 重写 200 行
- 🟡 **嵌套路径没说怎么解** — 2.2 节 regex 都是顶层匹配(`^\/Users\/[^/]+\/Documents\//`),相对路径(`./Documents/secret.txt`)解不出来
  - owner 自评硬伤 #4 抓了这个,标 v2.1.2
- 🟡 **`useEventBus()` 不存在** — 2.2 节 line 154: `const eventBus = useEventBus();`
  - **v4.3.1 没有 useEventBus composable**(没 `src/composables/` 目录,已验证)
  - Electron 端用 `electron/runtime/bridge/EventBus` (class,line 5 已读)
  - Vue 端用 `window.event` / pinia store,**没有 useEventBus**
- 🟡 **`isDestructive` 重复实现** — 2.2 节 Vue 端有 `isDestructive`,3.2 节 Electron 端有 `isDestructiveElectron`,**两份代码做同一件事**
  - 更好的做法:在 `electron/permissions/` 或 `electron/agent/` 共享一份
  - v4.3.1 已经有 `IMPermissionManager.ts` `PermissionManager.ts` (含 `isAllowed` / `checkOperation`),`isDestructive` 应该走 `window.electronAPI.execution.checkOperation`(preload.ts line 859-860)
- 🟡 **`waitForReview` 30 秒 timeout 后 resolve('reject')** — 但用户已经看到 "待审阅" 卡片弹了 30s,突然消失 = 体验糟糕
  - 应该是 timeout 后卡片保持 + 显示 "已超时,默认拒绝,点 X 关闭"
- 🟡 **没有 `Memory` 类型 import** — 2.2 节 line 118-124 `ToolCallArgs` interface 自定义,但 `args: any` 一行,types 实际未强约束

**对标**:
- Cursor: `chat:tool-confirm` 模式
- Vercel v0: 没有破坏性,AI 全程 confirm
- **PiPiClaw v4.3.1**:**已经有 `task.confirmPreview` + `task.onPreview`**(preload.ts line 838-848),v2.1.1 spec P0-1 是**重新实现已有功能**,不是"补"功能

**🟡 结论**:70 行代码方向对,但**重复 v4.3.1 已有的 confirmPreview 系统**,且 5 处工程实施细节需要补(嵌套路径、共享逻辑、timeout UX、useEventBus 引入、type 严格化)。

---

### P0-2 LlmClient 3 adapter 改 SSE 流式 — 🔴 详见维度 1

(已在维度 1 详细分析,综合评价:🔴 引入了 4 个新错)

**额外发现**:
- 🔴 3.2 节 line 633: `import { isDestructive } from '../composables/usePendingReview';` — **Electron 端 import Vue composable**(注释 line 633 自己也说"不能直接 import Vue composable",然后下面 line 704 重新写 `isDestructiveElectron`)
  - **这是矛盾的代码** — 先 import 然后不用,自己重写
  - **copy-paste 跑不起来**:TypeScript 会编译过(因为不实际调用),但代码异味明显
- 🔴 3.2 节 LlmAgentBrain.ts 是新文件,但 v4.3.1 已经有 `electron/agent/AgentBrain.ts`(class `AgentBrainImpl`,**不是 `LlmAgentBrain`**)
  - spec 创建的 `LlmAgentBrain` 和 v4.3.1 的 `AgentBrain` 关系没说
  - ChatManager 已经跟 `AgentBrain` 集成(`asAgentBrain` 在 AgentBrain.ts line 205)
  - 新加一个 LlmAgentBrain = 跟 AgentBrain 职责重叠
- 🟡 3.2 节 line 718 IpcBridge 加 `llm:stream:start` channel——**跟 v4.3.1 已有 `chat:streamUpdate` channel 重复**,spec 没提是否要废弃 chat:streamUpdate

**🔴 结论**:这不只是"修方向",是"重写 + 破坏现有架构 + 引入不存在的依赖"。

---

### P0-3 字体方案对齐 v4.3.1 — ✅(但不用改)

(已在维度 1 详细分析,✅ 修干净)

**额外发现**:
- 🟡 4.4 节砍 1 commit = 砍 `feat(font): Inter + HarmonyOS Sans SC 双语字体加载`——**v4.3.1 没这个 commit,Week 0 也从来没计划 ship Inter**
- 🟡 spec 没说"5 → 4 commit" 的具体执行路径:是 `git rebase -i HEAD~5` 删一个?还是新建分支重新提交?没说

**✅ 结论**:doc-only 改动,工程实施成本 0。

---

### P0-4 vite manualChunks 函数式 — 🟡 详见维度 1

(已在维度 1 详细分析,🟡 方向对,3 个 chunk 永远空 + 1 个会反弹)

**额外发现**:
- 🟡 5.2 节 line 893-896 删了 `vite-plugin-electron` 和 `vite-plugin-electron-renderer` 的 plugin 配置——**v4.3.1 是用 electron 插件的**(vite.config.mts line 35-79),spec 重写会**破坏 Electron 主进程的 bundle**
  - 正确做法:**只改 `build.rollupOptions.output.manualChunks` 函数体**,不要碰 electron plugin
  - spec 整体重写 vite.config.mts 是个错误——应该增量改

**🟡 结论**:`manualChunks` 改对了方向(函数式),但 (1) 3 个 vendor chunk 永远空 (2) 1 个会反弹 (3) 重写整个 vite.config.mts 会破坏 Electron 集成。

---

### P0-5 3 辅助面板可堆叠 — 🔴 引入了 5 个实施错

**spec 6.2 节 useWorkspacePanels.ts**:
- 🔴 **`useEventBus` 不存在** — line 940: `import { useEventBus } from './useEventBus';`
  - **v4.3.1 没有 useEventBus**
  - 整个 src/ 目录都 grep 不出 `useEventBus`
- 🔴 **`PanelType` 跟 AI 协作右栏没协调** — 6.3 节 AppShell.vue 同时显示 `<AICollabPanel v-if="aiPanelOpen" />` + 3 个辅助面板(`CodePanel` / `MemoryPanel` / `ToolsPanel`)
  - **v4.3.1 没有 AICollabPanel**(`src/components/` 子目录:chat/common/guide/layout/schedule/settings/skills,**没有 ai/**)
  - spec 假设的 `AICollabPanel` 是新文件
- 🔴 **`v-for` 渲染同类型多个 panel 但 v-show 隐藏** — line 1030-1050 用 `v-for` + `v-show`:
  ```vue
  <CodePanel v-for="(panel, i) in openPanels" v-show="panel.type === 'code'" :key="'code-' + i" />
  ```
  - 实际上 `openPanels` 是按 type 去重的(6.2 节 line 959 `if existing return`),**v-for 不会渲染超过 1 个 CodePanel**
  - `v-show` 永远 false(因为 `panel.type === 'code'` 只在 type==='code' 时 true,但 v-for 还是会渲染所有 panel,只是隐藏)
  - **正确做法**:`v-for` + `:key` 配合 `v-if`,或者用 computed 过滤
- 🟡 **`totalAuxWidth` 算重复** — 6.2 节 line 988-990 算辅助面板总宽,但 `mainAreaWidth` 也算总宽(line 996),**两个 computed 重复实现宽度逻辑**
  - 跟 7.2 节 useLayout.ts 重复
- 🟡 **"同类型能开多个"逻辑缺失** — owner 自评硬伤 #5 抓了"最大堆叠数 ≤ 3",spec 没修
  - 6.2 节 line 957-965 openPanel 只去重,**不限制总数**

**对标**:
- VS Code: 多个 panel 可同开(左/右/底 3 套)
- Figma: 同上
- **PiPiClaw v4.3.1**:目前是 SideNav 固定 + Content 主区,**没有 panel 概念**

**🔴 结论**:useWorkspacePanels 代码方向对(可堆叠),但 5 个实施错(useEventBus 引用不存在 / AICollabPanel 引用不存在 / v-for v-show 反模式 / 重复宽度计算 / 没总数限制)。

---

### P0-6 主区宽度联动约束 — 🟡 留 4 个实施错

**spec 7.2 节 useLayout.ts 90 行**:
- 🔴 **`watch` 在 composable 顶层调用** — 7.2 节 line 1171 `watch([layout.leftWidth, layout.aiWidth, layout.aiOpen], saveLayout);`
  - **Vue 3 composable 必须在 setup 阶段调用 watch**,但 `layout` 是 module-level 单例
  - 如果 useLayout() 在多个组件调用,会注册多个 watch,内存泄漏
  - 正确做法:`onMounted` 里 watch,或用 `effectScope` 包裹
- 🟡 **MIN_MAIN_AREA = 528 够吗** — 7.2 节硬编码
  - 1280 屏:240 + 320 + 528 = 1088 剩 192 给 spacing,可接受
  - 1024 屏:240 + 320 + 528 = 1088 > 1024,**主区宽度变负数** —— 7.3 节 line 1192 也承认 1024 屏主区只剩 392
  - **1024 屏根本不能同时开 AI 右栏 + 辅助面板**
  - spec 说"超过 1280 折叠菜单",但 1024 屏只是把 AI 右栏关了,左栏 + 辅助面板加起来还是超
- 🟡 **`useLayout()` 单例共享 layout** — 7.2 节 line 1089-1094 `const layout = {...}` 是 module-level
  - 多 store / 多 vue 实例会共享
  - 7.2 节 line 1171 `watch(...)` 会重复注册
- 🟡 **`localStorage` key 跟 Electron config 重复** — 7.2 节 line 1152 `localStorage.setItem('pipiclaw:layout', ...)`
  - v4.3.1 已经有 `window.electronAPI.config.set('pipiclaw:layout', ...)` 路径(preload.ts line 609-611)
  - 用 localStorage 走不到 Electron 持久化层(主进程 + atomic write)
  - owner 自评硬伤 #2 抓了 schema 兼容
- 🟡 **7.3 节边界场景表 row "1024 屏 AI 开 Tools"** 主区 328px,但 7.2 节 MIN_MAIN_AREA = 528
  - 328 < 528,**应该自动隐藏 panel 或滚动警告条**——spec 没说

**对标**:
- Linear: 侧栏可关 + 宽度持久化(走 IndexedDB)
- Notion: 侧栏可关 + 宽度持久化(走 localStorage 但 schema 兼容)
- **PiPiClaw v4.3.1**:TitleBar 32px + SideNav 200px(sidenav 可折叠)+ Content,**没有 panel 概念**

**🟡 结论**:useLayout 90 行代码方向对(MIN_MAIN_AREA + 联动约束),但 4 个实施错(watch 重复注册 / 1024 屏不可用 / 单例共享 / localStorage 跟 Electron config 重复)。

---

### P0-7 MemoryChip 改 TF-IDF — 🟡 v4.3.1 已有,spec 重复实现

**spec 8.2 节 MemoryScorer.ts 110 行**:
- 🟡 **v4.3.1 已经有 KeywordRetriever**(`electron/hermes/KeywordRetriever.ts` 56 行)
  - 有 tokenize / search / score / matchedTerms
  - **但没 accessCount**(只算关键词命中数)
  - 跟 spec 8.2 节的 TF-IDF 思路相似但实现不同
- 🟡 **v4.3.1 也有 EmbeddingService + MemoryVectorStore**(`electron/hermes/`)
  - spec 8.2 节说"撤掉 embedding"——**这是错的,embedding 是 keyword 检索的补充,不是替代**
  - 撤掉 = 用户失去"语义搜索"能力(查"今天下午的任务"能找到"16:30 done")
  - keyword 检索只匹配字面,搜不到语义相关
- 🔴 **`@/types/memory` 不存在** — 8.3 节 line 1343: `import type { Memory } from '@/types/memory';`
  - **v4.3.1 `src/types/` 只有 `api.d.ts`**,没有 `memory.ts`
- 🔴 **`Memory` interface 跟 v4.3.1 `Memory`(electron/contracts/types.ts)对不上**:
  - spec 8.2 节 `Memory`: `id` / `content` / `createdAt` / `accessCount` / `lastAccessedAt`
  - v4.3.1 Memory(contracts/types.ts): 不知道具体字段,但有 `Memory` interface 用于 hermes
  - 两条 Memory 类型不兼容
- 🟡 **0.4/0.3/0.3 权重没说怎么来** — 8.2 节 line 1313:
  ```typescript
  const score = 0.4 * frequency + 0.3 * recency + 0.3 * relevance;
  ```
  - 4:3:3 数字哪里来的?A/B test?还是 spec 拍脑袋?
  - 实际 v4.3.1 KeywordRetriever 只有 relevance,没有 frequency/recency 维度
  - spec 加这 2 个维度 = 需要新数据 pipeline
- 🟡 **8.4 节 MemoryChip.vue 重写** — 但 `src/components/ai/` 目录不存在,`src/components/chat/HermesMemoryDrawer.vue` 是 v4.3.1 实际 memory UI
  - spec 创建新 `src/components/ai/MemoryChip.vue` 跟 `HermesMemoryDrawer.vue` 关系没说

**对标**:
- Notion: 全文搜索 + AI 摘要
- Cursor: `@codebase` embedding + keyword 混合
- **PiPiClaw v4.3.1**:KeywordRetriever + EmbeddingService + MemoryVectorStore(已经是混合检索)

**🟡 结论**:MemoryScorer 方向对(TF-IDF 加权),但 (1) v4.3.1 已有 KeywordRetriever(重复) (2) "撤掉 embedding" 错(应保留互补) (3) 引用不存在的 `@/types/memory` (4) Memory interface 不兼容 (5) 权重数字没依据。

---

### 维度 2 小结:7 P0 中 0 个完全修干净,1 个真修(字体),6 个有实施错

| P0 | 评价 | 主要问题 |
|---|---|---|
| P0-1 破坏性白名单 | 🟡 留尾巴 | useEventBus 不存在 + 重复 v4.3.1 confirmPreview + 嵌套路径没解 |
| P0-2 LlmClient SSE | 🔴 | 引入了 4 个新错(假包/假 provider/错 API/破坏架构) |
| P0-3 字体 | ✅ | doc-only,不用改 |
| P0-4 manualChunks | 🟡 | 3 个 chunk 永远空 + 1 个会反弹 + 重写 vite.config 破坏 electron plugin |
| P0-5 辅助面板 | 🔴 | 5 个实施错(useEventBus/AICollabPanel/v-for-v-show/重复计算/无总数) |
| P0-6 主区宽度 | 🟡 | 4 个实施错(watch 重复/1024 屏不可用/单例/localStorage 跟 config 重复) |
| P0-7 Memory TF-IDF | 🟡 | 重复 KeywordRetriever + 错撤 embedding + 引用不存在 memory.ts |

---

## 维度 3:8 P1 实施细节验证

### P1-1 顶栏右区 ≤ 280px — 🟡 文件名错 + 1 个实施错

**spec 9.2 节 TopBar.vue**:
- 🟡 **文件名错** — spec 要重写 `TopBar.vue`,但 v4.3.1 实际是 `src/components/layout/TitleBar.vue`(已读,**没有 TopBar.vue**)
- 🟡 **`isNarrow` 缺中等密度** — 9.2 节 line 1495 `isNarrow.value = window.innerWidth < 1280;`
  - 1024 屏直接折叠成 56px,只显示 ⋯ 按钮
  - owner 自评硬伤 #6 抓了"1024 屏应该有 isMedium 1024-1280 模式",spec 没修
- 🟡 **`menuOpen` 没通过点击外部关闭** — 9.2 节 line 1509-1511:
  ```typescript
  function openMenu() { menuOpen.value = !menuOpen.value; }
  ```
  - 用户点 ⋯ 打开菜单,再点 ⋯ 关闭 = 工作
  - 用户点 ⋯ 打开菜单,再点其他地方 = **菜单不关**
- 🟡 **el-dropdown-menu 写在 template 里** — 9.2 节 line 1477:
  ```vue
  <el-dropdown-menu v-if="menuOpen" @command="handleCommand">
  ```
  - Element Plus 的 el-dropdown-menu 必须放在 el-dropdown 组件内,不能单独用
- 🟡 **`window.addEventListener('resize', checkWidth)` 无 debounce** — 9.2 节 line 1500
  - 用户拖窗口时,resize 事件一秒触发 60+ 次
  - 应该用 lodash.throttle 或 requestAnimationFrame

**对标**:
- Linear: 顶栏 4 元素固定,不折叠
- Vercel: 顶栏 2 元素,不折叠
- **PiPiClaw v4.3.1**:TitleBar.vue 只有 Logo + 4 window controls(无 AI 徽章)

**🟡 结论**:TopBar 重写方向对(约束 280px + 折叠菜单),但 (1) 文件名错(TitleBar.vue 不是 TopBar.vue) (2) 缺中等密度 (3) 菜单不点外面关闭 (4) el-dropdown 用错 (5) resize 无 debounce。

---

### P1-2 顶栏徽章 2s 呼吸光晕 — 🟡 1 个 CSS 错 + 1 个文件错

**spec 10.2 节 AiStatusBadge.vue**:
- 🟡 **目录不存在** — spec 写 `src/components/ai/AiStatusBadge.vue`,**`src/components/ai/` 不存在**
- 🟡 **closest GatewayStatusBadge 已经存在** — `src/components/common/GatewayStatusBadge.vue`(已 ls)
  - spec 要新建一个独立的 AiStatusBadge,跟现有 GatewayStatusBadge 关系没说
- 🔴 **CSS box-shadow 语法错** — 10.2 节 line 1669-1674:
  ```scss
  @keyframes breathe {
    0%, 100% {
      opacity: 1;
      box-shadow: 0 0 0 0 currentColor;  // ❌ currentColor 不是有效 length
    }
    50% {
      opacity: 0.5;
      box-shadow: 0 0 0 4px transparent;  // ⚠️ transition 0→4px 不平滑
    }
  }
  ```
  - `0 0 0 0 currentColor` 把 `currentColor` 当成 spread 值,但 CSS box-shadow 的 spread 是 length,currentColor 不是 length
  - 应该用 `0 0 0 0 transparent` 或 `0 0 0 0 rgba(0,0,0,0)`
  - 50% 跳到 `4px transparent` = 突然变大,**不是呼吸**(呼吸是连续过渡)
- 🟡 **`2s 呼吸` 1 秒内动画次数** — 10.3 节 line 1706 说"1 秒内动画次数 ≤ 3 (WCAG 2.3.1)"
  - 2s 周期 = 0.5 周期/秒 = 0.5 帧/秒(严格说不算"闪烁",WCAG 2.3.1 通过)
  - 但 spec line 1667 用了 `ease-in-out` 让动画"加速-减速",**实际视觉上比线性更明显**
  - owner 抓了,spec 没改

**对标**:
- Linear: 1.5s 呼吸,scale 0.95→1.05
- Vercel: 0.8s 闪烁(更激进)
- **PiPiClaw v2.1.1**:2s 呼吸,opacity 0.5→1.0 + box-shadow 扩散

**🟡 结论**:2s 呼吸方向对(对标 Linear),但 (1) 目录不存在 (2) 跟 GatewayStatusBadge 重复 (3) box-shadow CSS 错 (4) WCAG 验证凭感觉(没真跑 axe-core)。

---

### P1-3 首次启动引导不开右栏 — 🟡 重复 + 没国际化

**spec 11.2 节 FirstLaunchGuide.vue**:
- 🟡 **目录不存在** — spec 写 `src/components/onboarding/FirstLaunchGuide.vue`,**该目录不存在**
- 🟡 **v4.3.1 已有 firstRun tracking** — `src/stores/app.ts` line 73-77:
  ```typescript
  const firstRunResult = await window.electronAPI.config.get('firstRun');
  if (firstRunResult?.success && firstRunResult.data === true) {
    isFirstLaunch.value = true;
  }
  ```
  - 已经从 Electron config 读 firstRun
  - spec 用 `localStorage.getItem('pipiclaw:onboarding-dismissed')` **跟 firstRun 不同步**
  - 正确做法:用 `window.electronAPI.config.get('pipiclaw:onboarding-dismissed')` 走 Electron 持久化
- 🟡 **国际化没做** — 11.2 节全硬编码中文(已确认):
  - "欢迎来到 PiPiClaw v4.4.0"
  - "Cmd+K 调出命令面板,搜索任何功能"
  - "AI 协作面板默认关闭"
  - **v4.3.1 已有 `src/locales/zh-CN.ts` + `en-US.ts` + `index.ts`**
  - spec 应该用 `t('onboarding.title')` / `t('onboarding.step1')` 等
  - owner 自评硬伤 #9 抓了,标 v2.1.2
- 🟡 **v4.4.0 版本号硬编码** — "欢迎来到 PiPiClaw v4.4.0"
  - 应该用 `package.json` 的 `version` 字段或 import `version` from `'../package.json'`
- 🟡 **`visible` 初始化时机** — 11.2 节 line 1751 `const visible = ref(false);` + 1753 onMounted 检查
  - 用户进来看到空 UI 100ms 然后引导弹 = 抖动
  - 应该在 `setup()` 同步读 localStorage,避免 onMounted 后才显示

**对标**:
- Linear: 首次启动 show 6 步引导
- Notion: 首次启动 show 3 步引导
- Cursor: 首次启动 show 1 步提示(最少)
- **PiPiClaw v2.1.1**:3 步 + 中文 + 默认关右栏(对标 Cursor)

**🟡 结论**:3 步引导方向对(Cursor 路线),但 (1) 目录不存在 (2) 跟 firstRun 重复 (3) 国际化没做 (owner 抓了) (4) 版本号硬编码 (5) onMounted 时机错。

---

### P1-4 LlmEvent 15 种 type — 🔴 跟现有 IPC 架构冲突

**spec 12.2 节**:
- 🔴 **`llm:event` IPC channel 跟现有 `chat:streamUpdate` 冲突**
  - v4.3.1 chat layer 用 `chat:streamUpdate` (preload.ts line 778-782)
  - v4.3.1 task layer 用 `task:on-preview` (preload.ts line 844-848)
  - spec 加 `llm:event` channel = 第三个 LLM 事件 channel
  - **3 个 channel 推送相似数据(都是 LLM stream 事件)**,渲染进程需要订阅 3 个 = 错乱
- 🔴 **`useLlmStream` 监听 `llm:event` 但 v4.3.1 ChatManager broadcast 的是 `chat:streamUpdate`**
  - 12.3 节 line 1934: `window.electronAPI.on('llm:event', listener)` — **window.electronAPI 没有 on/off 方法**
  - v4.3.1 实际 API:`window.electronAPI.chat.onStreamUpdate(callback)` 返回 unsubscribe
- 🔴 **15 种 type 中 `token_usage`/`error`/`cancelled` 跟 ChatManager 已有数据格式不匹配**
  - spec: `{ type: 'token_usage', usage: { prompt: number; completion: number; total: number } }`
  - v4.3.1 ChatMessage (preload.ts line 380-391): `metadata?: Record<string, any>` — 实际不传 token 数字
- 🟡 **15 种 type 中 `thinking_start` / `thinking_end` 但 v4.3.1 ThinkingBlock 已经有 reasoning 字段**
  - spec 事件流方向对,但跟 ThinkingBlock 接收 reasoning 字段的现有逻辑不协调
- 🟡 **protocolVersion 字段没加** — owner 自评硬伤 #7 抓了"加 protocolVersion: 'v1'",spec 没修

**对标**:
- Linear: GraphQL subscription 1 个 endpoint 多种 event
- Vercel AI SDK: 1 个 stream() 函数返回多种 chunk type
- **PiPiClaw v4.3.1**:1 个 chat:streamUpdate + 1 个 task:on-preview
- **PiPiClaw v2.1.1**:1 个 llm:event + 15 种 type(干净),但跟现有 2 个 channel 冲突

**🔴 结论**:15 种 type 设计方向对(细粒度),但 (1) 跟现有 chat:streamUpdate / task:on-preview 冲突 (2) window.electronAPI API 错 (3) 数据格式不兼容 (4) owner 抓的 protocolVersion 没修。

---

### P1-5 路由表 17 个 — 🔴 数量错 + 4 个实施错

**spec 13.2 节**:
- 🔴 **路由数错** — spec 写"17 路由",实际 v4.3.1 `src/router/index.ts` 有 **23 个路由**:
  - 1 个 redirect (`/` → `/dashboard`)
  - 17 个生产路由:`/dashboard` `/chat` `/skills` `/settings` `/help` `/models` `/permissions` `/plugin-market` `/remote-control` `/schedule` `/skill-market` `/tasks` `/settings/im-accounts` `/im-management` `/clawhub` `/model-compare` `/settings/llm-config`
  - 5 个 devOnly:`/d1-demo` `/d5-demo` `/d3-demo` `/a5-demo` `/d2-prime-demo`
  - **不是 17 个,是 22 + 1 redirect = 23**
- 🔴 **devOnly 数量错** — spec 写"7 devOnly",实际 5 个
  - 而且 v4.3.1 **已经处理 devOnly**(`router/index.ts` line 168-178 `beforeEach` 拦截 + `import.meta.env.DEV` 跳过)
  - spec 说"7 devOnly 删,改 cmd 触发"——**根本不需要改**
- 🔴 **13.2 节路由表多了 3 个不存在的路由** — spec 表 6 个新路由 `/chat/settings` `/skills/installed` `/models/compare` `/clawhub` `/im/settings` `/settings/about`
  - 实际 v4.3.1 **没有 `/chat/settings` 这个路由**(只有 `/settings` + `/settings/llm-config` + `/settings/im-accounts`)
  - 实际 v4.3.1 **没有 `/skills/installed` 路由**(`SkillsView.vue` 内部 tab 切换)
  - 实际 v4.3.1 **没有 `/models/compare` 路由**(`ModelCompare.vue` 是独立路由 `/model-compare`,spec 拼错)
  - 实际 v4.3.1 **没有 `/im/settings` 路由**(`/settings/im-accounts` + `/im-management` 才是)
  - 实际 v4.3.1 **没有 `/settings/about` 路由**
  - spec 6 个 redirect 中 3 个根本 redirect 不到
- 🔴 **13.3 节 `/im/:channel` → `/workspace?im=:channel`** — 实际 v4.3.1 没有 `/im/:channel` 路由(只有 `/im-management` 静态路由)
- 🟡 **13.3 节 `'/chat/:convId' → '/workspace/default/chat/:convId'`** — v4.3.1 没有 `/workspace` 顶层路由,所有 redirect 目标都是 v2.1.1 spec 自己新建的路由
- 🟡 **13.4 节 router.addRoute 在 forEach 里调用** — Vue Router 4 addRoute 是动态加路由,每次切换会重新注册
  - 但 Object.entries + forEach 是同步循环,不会重新注册
  - 🟡 应该是 router.beforeEach 里动态 redirect,**不是 addRoute**

**对标**:
- Linear: 路由稳定,无 redirect 逻辑
- Notion: 路由稳定,无 redirect 逻辑
- **PiPiClaw v4.3.1**:23 个路由,5 个 devOnly 已经在生产屏蔽
- **PiPiClaw v2.1.1**:"17 个路由 + 7 devOnly 改 cmd 触发" = 数字错 + 路由表错

**🔴 结论**:**这是 v2.1.1 spec 错得最离谱的 1 项**。路由数错(17 vs 23)+ devOnly 数错(7 vs 5)+ 6 个 redirect 路径有 3 个不存在 + 跟 v4.3.1 已有的 devOnly 屏蔽逻辑冲突。Owner 自评"✅ 70 行 TS"是**没真数过路由数**。

---

### P1-6 主题表 3 套 — 🟡 名字错 + 1 个逻辑错

**spec 14.2 节 theme-v4.3-to-v4.4.ts**:
- 🟡 **v4.3.1 实际 ThemeMode = 'light' | 'dark' | 'system'** — 14.2 节 line 2021:
  ```typescript
  const v4_3_THEMES = ['light', 'dark', 'auto'];  // v4.3.1 实际 3 套
  ```
  - **v4.3.1 是 'system' 不是 'auto'**(`src/stores/app.ts` line 13: `export type ThemeMode = 'light' | 'dark' | 'system';`)
  - spec 写 `'auto'` 是错的——这是把"system"翻译错了
- 🟡 **14.2 节 LEGACY_THEMES 错**:
  ```typescript
  const LEGACY_THEMES: Record<string, string> = {
    'purple': 'dark',
    'blue': 'light',
    'green': 'light',
  };
  ```
  - v4.3.1 **从来没有 purple/blue/green 这 3 个主题**(`ThemeMode = 'light' | 'dark' | 'system'`)
  - spec 是"防御性编程"——但代码里多此一举
- 🟡 **14.3 节 Week 0 commit 改名**: `feat(theme): 强制 light/dark/auto 3 套,删除自定义主题`
  - v4.3.1 已经是 `light/dark/system` 3 套,没有"自定义主题"可删
  - 这个 commit 跟 P0-3 一样是"对空气挥拳"
- 🟡 **migrateTheme 函数没被引用** — 14.2 节定义但没说在哪里调
  - 应该在 `app.ts` `initialize()` 启动时调
  - spec 只写了函数,没写 wiring

**对标**:
- Linear: light/dark/system
- Notion: light/dark/system
- **PiPiClaw v4.3.1**:light/dark/system(已经对)
- **PiPiClaw v2.1.1**:"light/dark/auto"(错名字)

**🟡 结论**:"3 套主题"方向对(已经对),但 (1) 'auto' 应是 'system' (2) LEGACY_THEMES 多此一举 (3) Week 0 commit 是 "对空气挥拳" (4) 函数没 wire。

---

### P1-7 macOS 顶栏 32px — 🟡 tokens.css 28 vs variables.scss 32 矛盾没发现

**spec 15.2 节**:
- 🟡 **v4.3.1 tokens.css 28px vs variables.scss 32px 矛盾**
  - tokens.css line 157: `--title-bar-height: 28px;`
  - variables.scss line 25: `$title-bar-height: 32px;`
  - TitleBar.vue line 137: `height: $title-bar-height;` (用 32px)
  - **真实顶栏 = 32px**(用 variables.scss)
  - spec 15.2 节写 "macOS 32px (designer 实测)"——对
  - 但 spec 没指出 v4.3.1 内部 28 vs 32 的矛盾
  - 正确做法:把 tokens.css 28 改成 32,统一
- 🟡 **`.platform-darwin` 类名哪儿来** — 15.2 节 line 2062:
  ```scss
  .platform-darwin { --top-bar-height: 32px; }
  ```
  - v4.3.1 实际是 `src/stores/app.ts` line 70 `platform.value = window.electronAPI.app.getPlatform();` 给 `platform` 赋值
  - 实际 platform 是 `'darwin' | 'win32' | 'linux'`,但 spec 用 `.platform-darwin` 假设在 `<html>` 上有 class
  - **v4.3.1 没有这个 className**,需要在 main.ts 启动时动态加
- 🟡 **`--traffic-light-area: 80px` 的 spacing 逻辑** — 15.2 节 line 2065:
  - macOS traffic light 实际占 78px(3 按钮 × 26px = 78px)+ spacing 12px = 90px
  - 80px 太小,会跟 traffic light 重叠
- 🟡 **TopBar 改 32px 但所有引用 32px 的地方** — TitleBar 高度 32px,SideNav 起始位置 = 32px
  - spec 没改 SideNav / AppLayout
  - 改 1 个 token = 整布局都要重排

**对标**:
- macOS HIG: 28px 标准,32px 大屏
- Windows: 32px 标准
- **PiPiClaw v4.3.1**:**实际 = 32px**(用 variables.scss 32px,**真实就是 32px**)
- **PiPiClaw v2.1.1**:"改 38→32"——**v4.3.1 没 38,本来就是 32**

**🟡 结论**:"32px"方向对(已经是 32px),但 (1) tokens.css 内部矛盾没发现 (2) .platform-darwin className 没注册 (3) 80px spacing 不准 (4) 改 token 不联动。

---

### P1-8 .bak.json 3 版本循环 — 🔴 backupConfig 循环逻辑错

**spec 16.2 节 config-backup.ts**:
- 🔴 **backupConfig 删除循环方向错** — 16.2 节 line 2110-2118:
  ```typescript
  // 1. 删最老的备份 (如果有 3 个)
  for (let i = MAX_BACKUPS; i >= 1; i--) {
    const oldBackup = path.join(dir, `${baseName}.bak.${i}.json`);
    const olderBackup = path.join(dir, `${baseName}.bak.${i + 1}.json`);
    if (fs.existsSync(olderBackup)) {
      fs.unlinkSync(olderBackup);
    }
  }
  ```
  - `i = 3` 时:检查 `bak.4.json` 存在否,**永远不存在**,什么都不做
  - `i = 2` 时:检查 `bak.3.json` 存在否,删
  - `i = 1` 时:检查 `bak.2.json` 存在否,删
  - **正确逻辑应该是从大到小删超 MAX_BACKUPS 的**(i = 4, 5, 6...),但 MAX_BACKUPS=3,i 永远从 3 开始
  - **这段代码是个死循环,实际不删任何东西**(因为 bak.4 永远不存在)
- 🔴 **滚动备份循环** — 16.2 节 line 2121-2127:
  ```typescript
  for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
    const src = path.join(dir, `${baseName}.bak.${i}.json`);
    const dst = path.join(dir, `${baseName}.bak.${i + 1}.json`);
    if (fs.existsSync(src)) {
      fs.renameSync(src, dst);
    }
  }
  ```
  - i = 2:`bak.2.json` → `bak.3.json` ✓
  - i = 1:`bak.1.json` → `bak.2.json` ✓
  - **这步是对的**(从大到小,避免覆盖)
- 🟡 **rollbackToBackup 的 backupConfig 调错** — 16.2 节 line 2161-2164:
  ```typescript
  export function rollbackToBackup(configPath: string, backupPath: string): void {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupPath}`);
    }
    // 备份当前 (再次)
    backupConfig(configPath, 'pre-rollback');
    // 恢复
    fs.copyFileSync(backupPath, configPath);
  }
  ```
  - `backupConfig(configPath, 'pre-rollback')` 调了但没用 version 参数(参数没在函数里用)
  - "备份当前(再次)" = 会创建 `bak.1.json`(因为当前 config 还在),但 rollback 是要"恢复 backupPath 到 configPath",**应该备份当前 → 用 backupPath 覆盖 configPath**
  - 顺序对(先备份当前,再恢复),但 backupConfig 调了不传 version 浪费
- 🟡 **16.3 节 migrateV4_3_to_V4_4 用 rollbackToBackup** — line 2194:
  ```typescript
  if (fs.existsSync(bak1)) {
    rollbackToBackup(configPath, bak1);
  }
  ```
  - `bak1 = ${configPath}.bak.1.json` —— 但 configPath 已经是 `config.json`,所以 bak1 是 `config.json.bak.1.json`
  - 这跟 backupConfig 内部用的 `${baseName}.bak.1.json` = `config.bak.1.json` 不一致!
  - **baseName = path.basename(configPath, '.json') = 'config'** → `${baseName}.bak.1.json` = `config.bak.1.json`
  - **外部 rollbackToBackup 用 `config.json.bak.1.json`** —— **两个文件路径不一致,rollback 找不到文件**
- 🟡 **listBackups 缺 version 字段填充** — 16.2 节 line 2146:
  ```typescript
  backups.push({ version: `bak.${i}`, path: p, mtime: stat.mtimeMs });
  ```
  - `version: 'bak.1'` 而不是实际版本号(如 'v4.3.1')
  - 需要在 backupConfig 时存 metadata 文件
- 🟡 **v4.3.1 config 在哪儿没说** — 16.2 节没指明 `configPath` 默认值
  - 实际 v4.3.1 是 `app.getPath('userData')/config.json`?

**对标**:
- VS Code: backup 7 天循环,sqlite WAL
- Linear: 单一 config,无循环备份
- **PiPiClaw v4.3.1**:**没有 backup 机制**(`window.electronAPI.config` 是覆盖写,无历史)

**🔴 结论**:3 版本循环方向对(对标 VS Code 7 天循环简化),但 (1) 删除循环是死代码 (2) rollback 路径不一致 (3) listBackups version 字段填充错 (4) configPath 默认值没说。

---

### 维度 3 小结:8 P1 中 1 个方向对(呼吸),7 个有实施错

| P1 | 评价 | 主要问题 |
|---|---|---|
| P1-1 顶栏 280px | 🟡 | 文件名错(TitleBar) + 缺中等密度 + 菜单不点外关 + el-dropdown 错用 + resize 无 debounce |
| P1-2 呼吸光晕 | 🟡 | 目录不存在 + 跟 GatewayStatusBadge 重复 + box-shadow CSS 错 |
| P1-3 引导 | 🟡 | 目录不存在 + 跟 firstRun 重复 + 没国际化(已抓) + 版本号硬编码 |
| P1-4 LlmEvent 15 type | 🔴 | 跟 chat:streamUpdate / task:on-preview 冲突 + window.electronAPI API 错 + 数据格式不兼容 + protocolVersion 没加(已抓) |
| P1-5 路由 17 | 🔴 | **路由数错(17 vs 23) + devOnly 数错(7 vs 5) + 6 个 redirect 3 个不存在** |
| P1-6 主题 3 套 | 🟡 | 'auto' 应是 'system' + LEGACY 多此一举 + 函数没 wire |
| P1-7 macOS 32px | 🟡 | tokens.css 28 vs 32 矛盾没发现 + .platform-darwin 没注册 + 80px spacing 不准 |
| P1-8 .bak 3 循环 | 🔴 | **删除循环是死代码 + rollback 路径不一致 + listBackups 字段错** |

---

## 维度 4:v2.1.1 实施手册"代码能不能跑"

> 找 owner 看不到的硬伤——跨过"评价"边界进入"代码 review"。

### 🔴 1. **1500 行代码 90% 引用不存在的文件 / 目录 / npm 包**

| spec 节 | 引用 | 实际状态 |
|---|---|---|
| 2.2 / 6.2 / 7.2 | `src/composables/` | ❌ 不存在(应该用 `src/stores/`) |
| 2.2 | `useEventBus` (line 154) | ❌ 不存在 |
| 3.2 | `electron/llm/LlmClient.ts` (用 OpenAI SDK) | ⚠️ 存在但要被重写 |
| 3.2 | `import OpenAI from 'openai'` | ❌ package.json 没有 |
| 3.2 | `import Anthropic from '@anthropic-ai/sdk'` | ❌ package.json 没有 |
| 3.2 | `import { Ollama } from 'ollama'` | ❌ package.json 没有 |
| 3.2 | `electron/agent/LlmAgentBrain.ts` | ❌ 应是 `AgentBrain.ts` (class `AgentBrainImpl`) |
| 4.2 | `src/styles/fonts.scss` | ❌ 不存在(tokens.css + variables.scss 已经有) |
| 4.2 | `public/fonts/Inter-Variable.woff2` | ❌ 不存在(public/ 都不存在) |
| 5.2 | 重写整个 `vite.config.mts`(去掉 electron plugin) | ⚠️ 破坏 Electron 集成 |
| 5.2 | `vendor-monaco` chunk | ❌ package.json 没 monaco-editor |
| 5.2 | `vendor-chart` chunk | ❌ package.json 没 chart.js / d3 |
| 6.2 | `useEventBus` (line 940) | ❌ 不存在 |
| 6.3 | `<AICollabPanel />` | ❌ 文件不存在 |
| 7.2 | 引用 `useEventBus` 之类 | ⚠️ 全部靠 `watch` 而非 composable |
| 8.3 | `import type { Memory } from '@/types/memory'` | ❌ 不存在(只有 api.d.ts) |
| 9.2 | `src/components/layout/TopBar.vue` | ❌ 应是 `TitleBar.vue` |
| 10.2 | `src/components/ai/AiStatusBadge.vue` | ❌ `ai/` 目录不存在 |
| 11.2 | `src/components/onboarding/FirstLaunchGuide.vue` | ❌ `onboarding/` 目录不存在 |
| 12.3 | `window.electronAPI.on('llm:event', listener)` | ❌ `window.electronAPI` 没有 `on/off` |
| 12.3 | `window.electronAPI.off('llm:event', listener)` | ❌ 同上 |
| 14.2 | `electron/migrations/theme-v4.3-to-v4.4.ts` | ❌ `migrations/` 目录不存在 |
| 16.2 | `electron/migrations/config-backup.ts` | ❌ 同上 |

**结论**:**1500 行代码中至少 20 处引用不存在的依赖**。copy-paste 跑不起来。

### 🔴 2. **P0-2 LlmClient.ts 引入 3 个 npm 包,bundle 体积 +200KB**

3 个 SDK 总体积(估算,gzipped):
- `openai@4` ~50KB
- `@anthropic-ai/sdk` ~80KB
- `ollama` ~70KB
- **合计 +200KB gzipped**

**对标**:
- v4.3.1:用 raw fetch(0 KB SDK)
- v2.1.1 5.3 节 main.js 预算 500KB gzipped
- **加 200KB 后 main.js 接近 700KB**(超预算 40%)

**`vite-plugin-electron` 的 ssr: true**(vite.config.mts line 47)**会让 SDK 走 Node bundle,不是 renderer bundle**——但 bundle 体积计算时仍要算。

### 🔴 3. **3.2 节 streamAnthropic 事件类型错**

参考 Anthropic SDK TypeScript 定义(`@anthropic-ai/sdk` 0.27+):
```typescript
// RawStreamEvent types:
type RawStreamEvent =
  | { type: 'message_start'; message: Message }
  | { type: 'content_block_start'; index: number; content_block: ContentBlock }
  | { type: 'content_block_delta'; index: number; delta: TextDelta | InputJsonDelta | ThinkingDelta | CitationsDelta | SignatureDelta }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: MessageDelta; usage: Usage }
  | { type: 'message_stop' }
  | { type: 'ping' }
  | { type: 'error'; error: { type: string; message: string } }

interface ThinkingDelta { type: 'thinking_delta'; thinking: string }
```

**spec 3.2 节 line 581-589**:
```typescript
if (event.type === 'content_block_delta') {
  if ((event.delta as any).type === 'thinking_delta') {
    yield { type: 'thinking_chunk', content: (event.delta as any).thinking };
  } else if ((event.delta as any).type === 'text_delta') {
    yield { type: 'text_chunk', content: (event.delta as any).text };
  }
}
```

实际是对的(spec 写对了)——但**thinking_start 和 thinking_end 事件 spec 不会触发**:
- spec 只 yield `thinking_chunk`(从 delta 拿),不 yield `thinking_start`(从 content_block_start 拿)
- 实际渲染进程拿不到"开始 thinking"的事件,UI 不知道什么时候显示"思考中"指示器

**应该补**:
```typescript
if (event.type === 'content_block_start' && event.content_block?.type === 'thinking') {
  yield { type: 'thinking_start' };
}
if (event.type === 'content_block_stop' && event.index === thinkingBlockIndex) {
  yield { type: 'thinking_end' };
}
```

### 🔴 4. **3.2 节 streamOllama 协议错**

Ollama `/api/chat` 实际流式响应:
```json
{"model":"qwen3:14b","created_at":"...","message":{"role":"assistant","content":"Hello"},"done":false}
{"model":"qwen3:14b","created_at":"...","message":{"role":"assistant","content":" world"},"done":false}
{"model":"qwen3:14b","created_at":"...","message":{"role":"assistant","content":""},"done":true,"total_duration":...,"eval_count":42}
```

**spec 3.2 节 line 593-614**:
```typescript
for await (const chunk of stream) {
  if ((chunk.message as any).thinking) {
    yield { type: 'thinking_chunk', content: (chunk.message as any).thinking };
  }
  if (chunk.message.content) {
    yield { type: 'text_chunk', content: chunk.message.content };
  }
  if (chunk.done) {
    yield { type: 'token_usage', usage: { total_tokens: chunk.eval_count || 0 } };
    yield { type: 'done' };
  }
}
```

**问题**:
- Ollama 实际是 `chunk.message.content` 包含**整个累积**的内容(不是 delta),每条 chunk 都包含完整 message content
- **每个 chunk 都会重新 yield 整个 content**,导致 UI 重复显示
- 需要用本地 buffer 缓存上次 content,只 yield delta

正确做法:
```typescript
let lastContent = '';
let lastThinking = '';
for await (const chunk of stream) {
  const newContent = chunk.message.content;
  if (newContent.length > lastContent.length) {
    const delta = newContent.slice(lastContent.length);
    yield { type: 'text_chunk', content: delta };
    lastContent = newContent;
  }
  // 同理 thinking
  if (chunk.done) yield { type: 'done' };
}
```

### 🔴 5. **5.2 节 vite.config.mts 重写 = 破坏 Electron 集成**

spec 5.2 节把整个 vite.config.mts 重写为:
```typescript
export default defineConfig({
  plugins: [
    vue(),
    AutoImport({...}),
    Components({...}),
    // ❌ 没有 vite-plugin-electron
    // ❌ 没有 vite-plugin-electron-renderer
  ],
  build: {...}
})
```

**v4.3.1 实际**(line 35-79):
```typescript
electron([
  {
    entry: 'electron/main.ts',
    vite: { build: { outDir: 'dist-electron', ... }, ... }
  },
  {
    entry: 'electron/preload.ts',
    ...
  }
]),
renderer()
```

**spec 重写 = 删除 electron 集成 = main.ts 和 preload.ts 不再被 build = 整个 Electron app 跑不起来**。

正确做法:在现有 vite.config.mts 上**只改 `build.rollupOptions.output.manualChunks` 函数体**,不要碰 plugins 数组。

### 🔴 6. **6.2 节 useWorkspacePanels v-for v-show 反模式**

```vue
<CodePanel v-for="(panel, i) in openPanels" v-show="panel.type === 'code'" :key="'code-' + i" />
<MemoryPanel v-for="(panel, i) in openPanels" v-show="panel.type === 'memory'" :key="'memory-' + i" />
<ToolsPanel v-for="(panel, i) in openPanels" v-show="panel.type === 'tools'" :key="'tools-' + i" />
```

**实际行为**:
- v-for 遍历 `openPanels` 数组(假设有 2 个 panel: code + memory)
- 第 1 个 CodePanel:`panel.type === 'code'` true → 显示;`panel.type === 'memory'` false → 隐藏
- 第 2 个 CodePanel:`panel.type === 'memory'` false → 隐藏;`panel.type === 'memory'` true → 显示
- **2 个 CodePanel 渲染,1 显示 1 隐藏,内存浪费**

**正确做法**(用 computed + v-if):
```vue
<CodePanel v-if="hasType('code')" :width="getWidth('code')" @close="closePanel('code')" />
<MemoryPanel v-if="hasType('memory')" :width="getWidth('memory')" @close="closePanel('memory')" />
<ToolsPanel v-if="hasType('tools')" :width="getWidth('tools')" @close="closePanel('tools')" />
```

### 🔴 7. **7.2 节 useLayout watch 在 composable 顶层调用**

```typescript
// 7.2 节 line 1171
watch([layout.leftWidth, layout.aiWidth, layout.aiOpen], saveLayout);
```

**问题**:
- `watch` 必须在 setup 阶段调用(在 `setup()` 或 `<script setup>` 顶层)
- spec 把 `watch` 写在 `useLayout()` 函数内部,**但 `useLayout()` 可以被多次调用**(每个组件一次)
- **每次调用都注册一个 watch** = 内存泄漏 + saveLayout 被调用 N 次
- 实际 v4.3.1 已经有 `pinia` store 的 `$subscribe` 机制(spec 没利用)

正确做法:
```typescript
export function useLayout() {
  // 只在组件 setup 阶段 watch
  watch([...], saveLayout);  // OK 在 useLayout() 函数内
  return {...};
}
```

**但 layout 是 module-level 单例**(line 1089-1094):
- 多个组件 useLayout() 会共享 layout,但**每个组件都注册自己的 watch**
- **第一次 useLayout() 之后,watch 已经在监听 module-level 单例**
- 第二次 useLayout() 又注册 watch = 2 个 watcher 监听同一个单例

正确做法:用 `effectScope` 包裹,或用 `onScopeDispose` 清理,或把 layout 移到 pinia store。

### 🔴 8. **9.2 节 TopBar resize 监听无 debounce + isNarrow 触发闪烁**

```typescript
function checkWidth() {
  isNarrow.value = window.innerWidth < 1280;
}
window.addEventListener('resize', checkWidth);
```

**问题**:
- 用户拖窗口时,resize 事件一秒触发 60+ 次
- `isNarrow` 在 1280 边界时反复 true/false = **顶栏元素在"全展开"和"折叠菜单"之间闪烁**
- 需要 `throttle(checkWidth, 200)` 或 `requestAnimationFrame` 包裹

正确做法:
```typescript
let raf = 0;
function checkWidth() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    isNarrow.value = window.innerWidth < 1280;
  });
}
```

### 🟡 9. **10.2 节 AiStatusBadge 跟 GatewayStatusBadge 重复**

- v4.3.1 已有 `src/components/common/GatewayStatusBadge.vue`(已 ls)
- spec 新建 `src/components/ai/AiStatusBadge.vue`(目录都不存在)
- **2 个 badge 都显示状态**:AI 状态 vs Gateway 状态——**职责重叠**
- 应该整合成 1 个 `StatusBadge` 组件,接 `variant: 'ai' | 'gateway' | '...'` prop

### 🟡 10. **12.3 节 useLlmStream 渲染进程订阅生命周期没说**

```typescript
// 12.3 节 line 1934-1935
onMounted(() => window.electronAPI.on('llm:event', listener));
onUnmounted(() => window.electronAPI.off('llm:event', listener));
```

**问题**:
- `window.electronAPI.on` 实际不存在(12.4 已抓)
- 就算存在,`listener` 在 onUnmounted 时被 off,但 listener 内部的 closure 捕获了 `handlers` 参数
- **如果用户在 AI 任务进行中切换工作区**,组件 unmount → off listener → 后续 llm:event 丢失
- v2.1 designer 评审已抓过同样的"事件订阅生命周期没说"问题,spec 没修

正确做法:用 pinia store 缓存最近 N 分钟事件流,组件重新 mount 时 replay。

### 🟡 11. **13.2 节路由表混淆 `/model-compare` 和 `/models/compare`**

spec 13.2 节表格:
| v4.3.1 路由 | v4.4.0 路由 | 迁移方式 |
| `/models/compare` (3) | `/models?tab=compare` | redirect |

**v4.3.1 实际**(`src/router/index.ts` line 149-153):
```typescript
{
  path: '/model-compare',  // ⚠️ 是 model-compare 不是 models/compare
  name: 'ModelCompare',
  component: () => import('@/views/ModelCompare.vue'),
}
```

**spec 13.2 节说 v4.3.1 是 `/models/compare`**——**错**,实际是 `/model-compare`(单数,没 s)。
spec 的 redirect `/models/compare` → `/models?tab=compare` 根本 redirect 不到,因为 v4.3.1 没有 `/models/compare` 这个路径。

### 🟡 12. **16.2 节 backupConfig 删除循环是死代码**

详见维度 3 P1-8。
**修复**:
```typescript
// 正确版本
for (let i = MAX_BACKUPS + 1; i <= MAX_BACKUPS + 5; i++) {  // 删超 MAX 的
  const old = path.join(dir, `${baseName}.bak.${i}.json`);
  if (fs.existsSync(old)) fs.unlinkSync(old);
}
```

### 🟡 13. **8.3 节 MemoryChip 引用不存在的 Memory 类型**

```typescript
// 8.3 节 line 1343
import type { Memory } from '@/types/memory';
```

**v4.3.1 实际**:
- `src/types/` 目录只有 `api.d.ts`(已 ls)
- `Memory` 类型在 `electron/contracts/types.ts`(用于主进程)
- 渲染进程不直接 import 主进程的 contracts(ESM/CJS 隔离)

正确做法:把 `Memory` interface 复制到 `src/types/memory.ts` 单独定义,主进程和渲染进程各自维护(保证解耦)。

### 🟡 14. **15.2 节 .platform-darwin className 没人加**

```scss
.platform-darwin { --top-bar-height: 32px; }
.platform-win32, .platform-linux { --top-bar-height: 32px; }
```

**v4.3.1 实际**:
- `app.ts` line 70 把 platform 值存到 `platform.value`,**不是写到 `<html>` className**
- 没用 `document.documentElement.classList.add('platform-' + platform)` 加 class

**spec 需要在 `main.ts` 或 `App.vue` 启动时**:
```typescript
import { useAppStore } from '@/stores/app';
const app = useAppStore();
app.initialize();
document.documentElement.classList.add(`platform-${app.platform}`);
```

**spec 没说这一行** = `.platform-darwin` CSS 永远不生效。

### 🟡 15. **整个 spec 没考虑 v4.3.1 的 actor 模型**

v4.3.1 `electron/runtime/actor/`:
- `Actor.ts` / `ActorRegistry.ts` / `MessageQueue.ts`
- `IpcBridge` 用 actor 模式:渲染进程发消息到 actor,actor 处理完回调
- `AgentBrainImpl` 是 singleton,通过 `asAgentBrain()` bridge

**spec 12.3 节 LlmEvent 流程**:
```
渲染进程 → window.electronAPI → ipcMain → LlmAgentBrain → LlmClient → SSE stream
```

**v4.3.1 实际流程**:
```
渲染进程 → window.electronAPI → ipcMain → IpcBridge → Actor → ChatManager → LlmClient
```

**spec 重写 = 绕过 actor 模型 = ChatManager → LlmClient 现有流程被打断**。

正确做法:在 ChatManager.ts line 907 已有 SSE stream 推送基础上,扩展 LlmEvent 类型,而不是新加 LlmAgentBrain。

### 维度 4 小结:15 个 v2.1.1 实施手册"代码跑不动"问题

| # | 问题 | 严重度 |
|---|---|---|
| 1 | 1500 行代码 90% 引用不存在的文件 / 目录 / npm 包 | 🔴 |
| 2 | 3 SDK 引入 +200KB bundle,超 main.js 预算 40% | 🔴 |
| 3 | streamAnthropic 缺 thinking_start/end 事件 | 🔴 |
| 4 | streamOllama content 是累积非 delta,会重复 yield | 🔴 |
| 5 | vite.config.mts 重写 = 删除 vite-plugin-electron = Electron 跑不起来 | 🔴 |
| 6 | useWorkspacePanels v-for v-show 反模式 | 🔴 |
| 7 | useLayout watch 重复注册 | 🔴 |
| 8 | TopBar resize 无 debounce + 边界闪烁 | 🟡 |
| 9 | AiStatusBadge 跟 GatewayStatusBadge 重复 | 🟡 |
| 10 | useLlmStream 切工作区事件丢失 | 🟡 |
| 11 | 路由表 `/models/compare` 应是 `/model-compare` | 🟡 |
| 12 | backupConfig 删除循环是死代码 | 🟡 |
| 13 | MemoryChip 引用不存在 `@/types/memory` | 🟡 |
| 14 | `.platform-darwin` className 没人加 | 🟡 |
| 15 | 没考虑 v4.3.1 的 actor 模型 | 🟡 |

---

## 维度 5:owner 抓的 10 项硬伤验证

> owner 自评 v2.1.1 → v2.1.2 修补优先级,10 项 P0 级硬伤。

### 1. LlmClient stream controller + abort — 🟡 真硬伤

**owner 抓**:
- 3.2 节 OpenAI stream 没处理断流
- 缺 controller.abort() / 部分接收的 tool_call_args 缓存

**验证**:
- 🔴 3.2 节 line 500-549 整个 for await 循环**没有 try/catch**
- 🔴 3.2 节 line 484 `async *streamOpenAI(req: ChatRequest): AsyncGenerator<LlmEvent>` 没接收 `signal: AbortSignal` 参数
- 🔴 工具调用流式拼接:line 530-533 `currentToolCall!.function.arguments += tc.function.arguments;` — 如果断流,`arguments` 是残缺的 JSON,parseArgs 会失败
- 🔴 `stream.controller.abort()` 调用 — spec 整个文件**没有 controller 概念**

**🟡 结论**:**真硬伤**。v2.1.1 spec 完全没考虑断流/abort,网络抖动场景下会数据丢失。

### 2. useLayout schema 版本兼容 — 🟡 真硬伤

**owner 抓**:
- saveLayout 写 `pipiclaw:layout` 没 schema 版本号

**验证**:
- 🔴 7.2 节 line 1152-1156 写:
  ```typescript
  function saveLayout() {
    localStorage.setItem('pipiclaw:layout', JSON.stringify({
      leftWidth, aiWidth, aiOpen
    }));
  }
  ```
- **没有 version 字段** — v4.3.1 可能已经存了 `pipiclaw:layout` 但结构不同
- 应该 `{ version: 1, data: {...} }`

**🟡 结论**:**真硬伤**。老用户升级后,旧 localStorage 数据可能跟新结构冲突。

### 3. MemoryScorer 中英混排查询 — 🟡 真硬伤

**owner 抓**:
- 用户查 "PiPiClaw v4.4.0 release" → 英文 1-gram
- 记忆 "PiPiClaw v4.4.0 发布" → 中文 2-gram "Pi" / "iC"
- **0 匹配 = 0 分**

**验证**:
- 🔴 8.2 节 `extractKeywords`:
  ```typescript
  // 英文按词切分
  const englishWords = cleaned.split(/\s+/).filter((w) => w.length >= 3);
  // 中文按字符切分 (2-gram)
  for (let i = 0; i < cleaned.length - 1; i++) { ... }
  ```
- **中英混排查询**:"PiPiClaw v4.4.0 release" 切出 `['pipiclaw', 'v4.4.0', 'release']` (length>=3)
- **中英混排记忆**:"PiPiClaw v4.4.0 发布" 切出 `[...]` 中文 2-gram + 'pipiclaw'(英文 ≥3)
- **查询"PiPiClaw" 跟记忆"PiPiClaw"** 应该有匹配(都是英文 ≥3 字)
- 但 **查询"release" 跟记忆"发布"** — 中文"发布"是 1 个字,2-gram 不会切;英文"release"切出
- 0 匹配 = score = 0
- **owner 抓的"纯文本匹配 = 0 分"是真的**

**🟡 结论**:**真硬伤**。v4.3.1 已有 EmbeddingService 可以补 keyword 检索的语义盲区(见维度 2 P0-7),spec "撤掉 embedding" 让这个硬伤没法补。

### 4. 破坏性白名单嵌套路径 — 🟡 真硬伤

**owner 抓**:
- DESTRUCTIVE_PATH_PATTERNS 都是顶层 regex
- 相对路径 `./Documents/secret.txt` 不能匹配
- 缺 path.resolve() + 重新匹配

**验证**:
- 🔴 2.2 节 line 91: `/^\/Users\/[^/]+\/Documents\//i` — macOS 绝对路径才匹配
- 🔴 2.2 节 line 130: `const path = args.path || args.file || args.target || '';` — 拿到的可能是相对路径
- 🔴 没 `path.resolve(path)` 调用
- 🟡 Windows 路径 `C:\Users\xxx\Documents\file.txt` 跟 `C:\users\xxx\Documents\file.txt`(小写 c:)在 Windows 上等价但 regex 区分大小写(虽然加了 `i` flag,但路径分隔符 `\` 在 regex 里没 escape)

**🟡 结论**:**真硬伤**。实际跨平台路径匹配需要 normalize + resolve + case-insensitive。

### 5. 辅助面板最大堆叠数 ≤ 3 — 🟡 真硬伤

**owner 抓**:
- 6.2 节 openPanel 只去重,不限制总数

**验证**:
- 🔴 6.2 节 line 957-965: `openPanel(type)` 只去重(`if (existing) return`)
- 🔴 没 `MAX_PANELS = 3` 限制
- 用户可以开 5 个 ToolsPanel(同类型去重后只能 1 个,但 Memory + Code + Tools + 又开 Memory?——去重阻止)
- 实际能开最多 3 个(Memory + Code + Tools)——**没限制 = 不能再开第 4 个**
- spec **没说** 不能再开 = 用户按按钮没反应 = bug 报告

**🟡 结论**:**真硬伤**。需要 MAX_PANELS = 3 限制 + 提示用户。

### 6. 顶栏 1024 中等密度模式 — 🟡 真硬伤

**owner 抓**:
- 9.2 节 isNarrow < 1280 触发折叠菜单
- 1024 屏应该中等密度(2 元素 + 折叠按钮)

**验证**:
- 🔴 9.2 节 line 1495: `isNarrow.value = window.innerWidth < 1280;` — 二元
- 🔴 没 `isMedium` 状态
- 1024 屏:`isNarrow = true` → 只显示 ⋯ 按钮
- 失去 AI 状态徽章 / Cmd+K / 用户头像

**🟡 结论**:**真硬伤**。1024 屏是常见笔记本分辨率,完全折叠 = 不可用。

### 7. LlmEvent protocolVersion — 🟡 真硬伤

**owner 抓**:
- 12.2 节 LlmEvent 没 protocolVersion 字段

**验证**:
- 🔴 12.2 节 line 1850-1875 LlmEvent interface 确实没 `protocolVersion: 'v1'`
- 🔴 v2.4 / v2.5 加新 type 时,渲染进程要同步更新——但 spec 没版本号,无法判断兼容

**🟡 结论**:**真硬伤**。LlmEvent 是 IPC 协议,必须加版本号。

### 8. devOnly 触发方式 — 🟡 真硬伤,但前提错

**owner 抓**:
- 13.2 节"7 devOnly 删,改 cmd 触发"没说怎么实现

**验证**:
- 🔴 **前提错**——v4.3.1 已经有 devOnly 处理(`router/index.ts` line 168-178 `beforeEach` 拦截 + `import.meta.env.DEV` 跳过)
- 🔴 **路由数错**——v4.3.1 有 5 个 devOnly(不是 7)
- 🔴 不需要"Settings → Advanced → Enable Dev Mode"——devOnly 在开发模式自动可见,生产模式自动屏蔽
- 🟡 owner 把已经工作的功能当 bug 抓

**🟡 结论**:**前提错**。v4.3.1 已经处理 devOnly,spec 没必要改。需要改的是把"5 devOnly 改 cmd 触发"删了(spec 把已对的状态改错)。

### 9. 引导国际化 — 🟡 真硬伤

**owner 抓**:
- 11.2 节 FirstLaunchGuide 写死中文

**验证**:
- 🔴 11.2 节全硬编码中文
- 🔴 v4.3.1 已有 `src/locales/zh-CN.ts` + `en-US.ts` + `index.ts`
- spec 应该用 `t('onboarding.title')`

**🟡 结论**:**真硬伤**。已有 i18n 基础设施,spec 没用。

### 10. 26 commit Week 6 onboarding 来源 — 🟡 真硬伤

**owner 抓**:
- 18.6 节 Week 6 加 1 commit(FirstLaunchGuide)没说来源

**验证**:
- 🟡 18.6 节 Week 6 有 3 个 commit:24 onboarding / 25 docs / 26 release
- 🟡 之前 v2.0 / v2.1 没说 onboarding,这是 v2.1.1 新加
- 🟡 应该在 18.6 节加说明 "onboarding 是 v2.1.1 新增,对应 P1-3 改稿"

**🟡 结论**:**真硬伤(轻微)**。spec 没说 commit 来源,实施时可能没人知道是改的哪个。

### 维度 5 小结:owner 抓的 10 项,9 项真硬伤,1 项前提错

| # | owner 抓的 | 评价 | 验证 |
|---|---|---|---|
| 1 | LlmClient stream controller + abort | 🟡 真硬伤 | try/catch 缺 / signal 缺 / 工具 args 缓存缺 |
| 2 | useLayout schema 版本兼容 | 🟡 真硬伤 | 没 version 字段,跟老 localStorage 冲突 |
| 3 | MemoryScorer 中英混排 | 🟡 真硬伤 | "release" 跟 "发布" 0 匹配 |
| 4 | 破坏性白名单嵌套路径 | 🟡 真硬伤 | 相对路径不 resolve,大小写不处理 |
| 5 | 辅助面板最大堆叠数 | 🟡 真硬伤 | 没用 MAX_PANELS 限制 |
| 6 | 顶栏 1024 中等密度 | 🟡 真硬伤 | 缺 isMedium 二态 |
| 7 | LlmEvent protocolVersion | 🟡 真硬伤 | 12.2 节 interface 没 version 字段 |
| 8 | devOnly 触发方式 | 🟡 前提错 | v4.3.1 已处理,spec 把对改错 |
| 9 | 引导国际化 | 🟡 真硬伤 | 硬编码中文,没 t() |
| 10 | Week 6 onboarding 来源 | 🟡 真硬伤(轻微) | 没说 commit 是新增的 |

**owner 视角盲区**(我额外找到的):
- 🔴 spec 1500 行代码 90% 引用不存在文件/包
- 🔴 3 SDK 引入 +200KB bundle
- 🔴 streamAnthropic 缺 thinking_start/end
- 🔴 streamOllama content 累积非 delta
- 🔴 vite.config.mts 重写破坏 Electron 集成
- 🔴 useWorkspacePanels v-for v-show 反模式
- 🔴 useLayout watch 重复注册
- 🔴 P1-5 路由数 17 vs 23,devOnly 7 vs 5
- 🔴 P1-8 backupConfig 删除循环是死代码

---

## 对标参考

### Cursor (AI 侧栏)
- **Cmd+L** 打开/关闭 AI 侧栏,**默认关闭** ✅
- **Apply / Reject** 在工具调用后,头部 inline 按钮 ✅
- **静态 "Thinking..."** + 不动画的灰点 ✅
- **AI 状态只在侧栏内**(v2.1.1 顶栏徽章 = 差异化,保留)
- **inline ghost text 补全** — v2.1.1 不做,保留
- **工具调用 diff preview** — v2.1.1 P0-1 ToolCallCard 默认折叠 + 展开看 args/result,但**没规定怎么预览 diff**(只 JSON.stringify)
  - 缺:Monaco diff editor 或简化的 +/- 行 diff
- **PiPiClaw v2.1.1 学到了**:默认折叠 + Apply/Reject + 静态思考 + 顶栏徽章
- **PiPiClaw v2.1.1 没学到**:diff preview + Anthropic 完整 thinking API(用 SDK 假装支持,实际跑不动)

### Linear (任务流 + 命令面板)
- **顶栏固定**:Logo / 视图切换 / 搜索 / 用户头像(3 元素克制)
- **中栏是任务列表**(虚拟滚动 + 拖拽排序)
- **右栏默认无**,只在点开任务详情时出现
- **Cmd+K 命令面板**,默认关
- **任务详情侧栏是临时浮层**,不是常驻
- **PiPiClaw v2.1.1 学到了**:Cmd+K + 顶栏折叠菜单(280px 约束)
- **PiPiClaw v2.1.1 没学到**:**Linear 顶栏只有 3 元素**——v2.1.1 spec 顶栏要塞 4 元素(主题/AI/Cmd+K/头像)还要再加折叠,密度比 Linear 高 33%

### Notion (三栏布局)
- **左栏**:workspace 树(永远在,顶部固定 Logo / 搜索 / 收藏)
- **中栏**:页面树 / 页面内容
- **右栏**:**默认无**,只在页面打开时显示评论/分享
- **树形结构承载导航**,不是平铺切换
- **PiPiClaw v2.1.1 学到了**:3 辅助面板可堆叠(默认折叠,Cmd+? 触发)
- **PiPiClaw v2.1.1 没学到**:树形左栏 + 中栏内容切换(还是 v2.0 的 4 工作区)

### Vercel (dashboard + v0)
- **Vercel Dashboard**:顶栏 + 单栏 + 卡片网格
- **Vercel v0**:
  - 静态文字 "Generating..."(不闪烁)
  - "Regenerate / Use this" 按钮(对标 Apply/Reject)
  - **没有右栏浮窗**,v0 是 full-screen
  - **PiPiClaw v2.1.1 学到了**:静态文字 + Regenerate 路线
  - **PiPiClaw v2.1.1 没学到**:**Vercel v0 不用 SDK**,用的是 fetch + custom parser,PiPiClaw v4.3.1 也是这个路线,v2.1.1 改用 SDK 是**违背选型初衷**

### Raycast (命令面板)
- **整个产品 = 命令面板 + 扩展**
- **没有持久 UI**——所有功能通过 Cmd+K 触发
- **AI 是 1 个扩展**,不是主界面
- **PiPiClaw v2.1.1 学到了**:Cmd+K 入口
- **PiPiClaw v2.1.1 没学到**:**AI 不是扩展**——PiPiClaw 是 AI 协作工作台,AI 是主功能,不是 Cmd+K 触发

---

## 改稿优先级

### P0(必须改,v2.1.1 → v2.1.2)—— **5 项**

1. **LlmClient 3 SDK 引入 = 改用 raw fetch,跟 v4.3.1 选型一致**
   - spec 3.2 节不要重写 250 行,直接用 v4.3.1 已有 adapters(openai.ts/anthropic.ts/zhipu.ts)加 stream 方法
   - 删 `import OpenAI/Anthropic/Ollama`,改 `fetch().body.getReader()`
   - 修 streamAnthropic 的 thinking_start/end 缺失(streamOllama content 累积改 delta)

2. **vite.config.mts 不要整体重写,只改 manualChunks 函数体**
   - 5.2 节保留 `vite-plugin-electron` + `vite-plugin-electron-renderer`
   - 只改 `build.rollupOptions.output.manualChunks` 函数体
   - 删 `vendor-monaco` / `vendor-chart` 这 2 个永远空的 chunk

3. **P1-5 路由表重新数**
   - v4.3.1 实际 22 + 1 redirect = 23 个路由
   - 5 个 devOnly(不是 7 个)
   - 6 个 redirect 路径里 3 个不存在(`/chat/settings` `/skills/installed` `/models/compare` 应是 `/model-compare`)

4. **P1-8 backupConfig 删除循环改对**
   - 当前是死代码(`i=3` 时检查 `bak.4.json` 永远不存在)
   - 改成 `for (let i = MAX_BACKUPS + 1; i <= MAX_BACKUPS + 5; i++)` 删超 MAX 的
   - rollbackToBackup 路径不一致: 内部用 `config.bak.1.json`,外部用 `config.json.bak.1.json`,统一

5. **1500 行代码引用的不存在的文件 / 包要么创建要么改路径**
   - 不创建新目录,用现有 `src/stores/` 替代 `src/composables/`
   - 不创建 `src/components/ai/` / `src/components/onboarding/`,放 `src/components/chat/` 或 `src/components/common/`
   - 不用 LlmAgentBrain.ts(用 AgentBrain.ts)
   - 不用 LlmClient.ts 重写(沿用 + 加 stream 方法)

### P1(建议改,实施中补)—— **12 项**

6. P0-1 破坏性白名单加 path.resolve() + 大小写不敏感 + useEventBus 引用改 window.event
7. P0-5 辅助面板 v-for v-show 改 v-if + 加 MAX_PANELS = 3 限制
8. P0-6 useLayout watch 改用 pinia store $subscribe
9. P0-7 MemoryScorer 保留 EmbeddingService 互补,不撤掉
10. P1-1 TopBar 改 TitleBar.vue(文件已存在)+ 加 isMedium 中等密度
11. P1-2 AiStatusBadge 跟 GatewayStatusBadge 整合成 1 个 StatusBadge
12. P1-3 FirstLaunchGuide 用 `t('onboarding.title')` 国际化 + 改走 `window.electronAPI.config.set('pipiclaw:onboarding-dismissed')`
13. P1-4 LlmEvent 跟现有 chat:streamUpdate + task:on-preview 合并,不新建 llm:event channel
14. P1-6 主题 'auto' 改 'system' + 删 LEGACY_THEMES 多余代码
15. P1-7 tokens.css line 157 `--title-bar-height: 28px` 改 32px 统一
16. 维度 4 第 7-15 项(15 个 v2.1.1 "代码跑不动"问题)
17. 维度 5 owner 抓的 9 项真硬伤(除 #8 devOnly 已对)

### P2(亮点保留)—— **3 项**

18. 战略一句话"PiPiClaw 是唯一让 AI 协作过程可见的工作台" —— 保留
19. MemoryChip 3 档颜色 + 评分明细 tooltip —— 方向对,实施有坑
20. 5 状态(空闲/思考/执行/待审阅/完成) + 静态光标 —— 方向对

---

## 总结

**v2.1.1 的核心问题不是 3 事实错没修干净**,而是:

1. **3 事实错中 0 个真修干净**(1 个修一半 + 2 个是文档虚构)
2. **1500 行代码 90% 引用不存在的文件 / 目录 / npm 包**
3. **大量 "代码看起来对但跑不动" 的细节**(15 项)
4. **P1-5 路由数 / devOnly 数都数错**
5. **P1-8 backupConfig 删除循环是死代码**
6. **P0-2 LlmClient 重写 = 删 150 行 working code + 引入 3 个假 npm 包 + 写错 provider 名单**

**owner 自评 8.5 过高**,因为 owner 视角看不到:
- spec 引用了 v4.3.1 不存在的文件
- spec 引入了 v4.3.1 package.json 没有的依赖
- spec 重写 = 破坏 v4.3.1 已工作的架构
- spec 路由数 / devOnly 数 / 主题名都数错

**6.5/10 综合评分依据**:
- 战略层 9.0(不动,保留)
- 信息架构 7.0(P0-1 方向对,实施有 5 错)
- AI 协作右栏 8.0(5 状态 / Apply Reject 对,只差 diff preview)
- 4 AI 组件 6.5(ThinkingBlock 已对 / MemoryScorer 重复 + 错撤 embedding / ToolCallCard 80 行 OK)
- 视觉语言 8.0(字体 ✅ / manualChunks 制造新错)
- 加载动画 8.0(2s 呼吸对)
- 交互模式 6.5(辅助面板可堆叠方向对,5 个实施错)
- 主题 7.0(3 套对,'system' 写成 'auto' 错)
- 无障碍 7.0(呼吸对,a11y 没真测)
- 性能 6.0(manualChunks 3 chunk 永远空)
- 实施路线 6.0(Week 0 砍 1 commit 是对空气挥拳,Week 6 onboarding 没来源)
- 工程实施 4.0(1500 行 90% 跑不起来)
- **加权和 6.5**

**对比 v2.0 / v2.1**:
- v2.0 5.5 → v2.1 6.8 (+1.3 方向对) → v2.1.1 6.5 (-0.3 制造新伤)
- **v2.1.1 比 v2.1 还低**,因为实施层引入了更多"代码跑不动"的问题
- **真正的提升在 P0-1 破坏性白名单 + 内存安全约束 + 一些 P1 的样式细节**——但这是 20% 的工作量,不应该拿 8.5 的总分

**v2.1.1 ship-ready 程度**:**6.0/10**(及格线以下)
- **不适合直接开 26 commit**
- **需要先 v2.1.2 修 5 项 P0**(LlmClient 改 raw fetch / vite.config 不重写 / 路由表重数 / backupConfig 修对 / 不存在文件改路径)
- 修完后再开 26 commit,工程实施才能真正跑起来

**v2.1.1 → v2.1.2 修补清单**(最 critical):
1. LlmClient 删 SDK,改 raw fetch + 自写 stream(保留 v4.3.1 3 adapter 架构)
2. vite.config.mts 不重写,只改 manualChunks 函数体(删 monaco/chart 空 chunk)
3. P1-5 路由表 17 → 23 + devOnly 7 → 5
4. P1-8 backupConfig 删除循环改对
5. 1500 行代码引用的不存在的文件全部改路径或创建

---

## 相关文件

- `docs/redesign-v2-spec.md` (21.8 KB) — v2.0
- `docs/redesign-v2.1-spec.md` (37.2 KB) — v2.1
- `docs/redesign-v2.1.1-spec.md` (66.4 KB) — **v2.1.1 当前**
- `docs/redesign-v2.1.1-self-review.md` — owner 自评 8.5
- `docs/redesign-v2-designer-review.md` — v2.0 评 5.5
- `docs/redesign-v2.1-designer-review.md` — v2.1 评 6.8
- `docs/redesign-v2.1.1-designer-review.md` — **本文件 6.5**
- 实际 v4.3.1 代码:`electron/llm/` `src/router/index.ts` `src/stores/app.ts` `src/styles/tokens.css` `vite.config.mts` `package.json` `electron/preload.ts`
- 接下来: **v2.1.2 必须修 5 项 P0 才能 ship**
