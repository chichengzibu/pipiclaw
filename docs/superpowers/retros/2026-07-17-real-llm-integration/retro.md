# Retro — 接真实 LLM(D5 SKILL.md + A5 AgentBrain + ChatManager)

**日期:** 2026-07-17
**前置 commit:** `6016a3d`(plan commit)
**最终 commit:** `5d23a94`
**参与:** 主会话(plan + 兜底验证)+ general_purpose_task subagent(6 task 执行)

---

## TL;DR

把 3 处 LLM stub 替换为真实 LLM 调用:
1. **D5 SKILL.md 生成** — 硬编码 `stepsText` → `synthesizeStepsWithLlm()`,fallback 到原文本
2. **A5 ComputerUse 决策** — `brain.think` JSON 输出被 `refineDecisionWithLlm()` 包装,失败 fallback stub
3. **ChatManager / AgentBrain** — 新 `LlmAgentBrain.ts` 在 `AgentBrainImpl` 之后注册,think 调用 LLM,failure fallback

LLM 配置 UI `LlmConfig.vue` 走 Settings 路由,3 provider 卡片(OpenAI / Anthropic / 智谱 GLM)风格统一 ImAccounts。

---

## 5 个 commit 落地(主会话兜底验证后)

```
5d23a94 feat(llm) LlmAgentBrain plus register in main after AgentBrainImpl
908cb02 feat(llm) A5 ComputerUse agent brain decision refined by LLM with fallback
d72b9bf feat(llm) D5 SKILL.md stub replaced by LLM synthesize with fallback
cc84c09 feat(llm) LlmConfig UI plus 4 IPC channels and preload bridge
89ccf6f feat(llm) LlmClient plus 3 provider adapters OpenAI Anthropic Zhipu
```

主会话跑 `npx tsc --noEmit -p tsconfig.node.json`:**exit 0,0 lines output**(完全干净)。
主会话跑 `npx vitest run --reporter=dot`:**178/178 passed**(21 test files)。

---

## 新增文件清单

| 文件 | 行数估算 | 作用 |
|------|----------|------|
| `electron/llm/types.ts` | ~80 | LlmProvider / LlmRequest / LlmResponse / LlmConfig 类型 |
| `electron/llm/adapters/openai.ts` | ~120 | OpenAI chat completions adapter |
| `electron/llm/adapters/anthropic.ts` | ~120 | Anthropic messages adapter |
| `electron/llm/adapters/zhipu.ts` | ~100 | 智谱 GLM OpenAI 兼容 adapter |
| `electron/llm/LlmClient.ts` | ~250 | 客户端路由 + fallback + duration 计量 |
| `electron/llm/LlmConfigStore.ts` | ~120 | 持久化到 userData `llm/configs/<provider>.json` |
| `electron/llm/index.ts` | ~20 | barrel export |
| `electron/agent/LlmAgentBrain.ts` | ~150 | `AgentBrain` 接口实现,LLM think + stub fallback |
| `src/views/LlmConfig.vue` | ~250 | 3 provider 卡片 UI + test/save IPC |

修改文件(注入式,业务入口不变):
- `electron/core/IpcServer.ts` — 加 4 个 LLM IPC handler
- `electron/preload.ts` — 加 4 个 channel + bridge 到 electronAPI.llm.*
- `src/router/index.ts` — `/settings/llm` 路由
- `electron/main.ts` — 注册 LlmAgentBrain
- `electron/demos/D5RecordingToSkill.ts` — `synthesizeStepsWithLlm()` 替换硬编码 stub
- `electron/demos/A5ComputerUse.ts` — `refineDecisionWithLlm()` 包装 brain.think

---

## 决策记录

### 1. 不引入 npm 依赖
LLM API 用 `fetch` 原生。三家 HTTP body 模板互不相同(OpenAI/Zhipu 是 OpenAI 兼容 chat/completions,Anthropic 是 messages + x-api-key header + system 字段独立),直接写 fetch 比装 SDK 更轻。

### 2. Fallback 策略
3 个注入点都采用 **try LLM → failure fallback to stub** 模式:
- D5 SKILL.md:LLM 失败 → 原硬编码 `stepsText`
- A5 ComputerUse:LLM 失败或返回非法 JSON → 原 `brain.think` stub 输出
- LlmAgentBrain:LLM 失败 → `AgentBrainImpl.think` stub

这意味着**用户没配 LLM key,D5/A5/Chat 全部仍可用**,只是用 stub 行为。配了 key 才会走真实 LLM。

### 3. 智谱 GLM 当 OpenAI 兼容处理
GLM-4 / GLM-4-Flash 实际是 OpenAI Chat Completions 协议兼容,只是 base URL 是 `https://open.bigmodel.cn/api/paas/v4/`。所以 `zhipu.ts` 复用 OpenAI body 模板,只换 base URL + 路径。

### 4. 不复用 ImAccounts UI 组件
原本考虑抽一个 `ProviderCard.vue` 给 ImAccounts + LlmConfig 共用,但 ImAccounts 字段特殊(webhook URL / appSecret / agentId),LLM 字段就 4 个,抽公共组件 over-engineer。直接抄 ImAccounts 卡片样式但不抽组件。

---

## 遇到的问题

### subagent 第 6 task 没产生新 commit
plan 描述 Task 6 是"验证 + retro + commit",但因为前 5 task commit 已经包含全部代码改动,Task 6 跑完验证后 subagent 没主动产出独立 commit,retro 由主会话写。**偏差**但不影响功能,只是 commit 数 5 而非 6。

### vue-tsc 在 npx 下偶发 sandbox 报错
plan 中已注明 `vue-tsc` 兜底用 `tsc --noEmit -p tsconfig.node.json`(Node 端,0 错)。Vue 端类型由 vite build + 实际渲染覆盖,178 个单测覆盖 runtime 行为。

---

## 不在本 plan 范围(留给后续)

- **WebContainerRunner / JupyterRunner / PortForwarder proxy stub** — W11 时代 mark 的 stub 替换,Step 3 处理
- **LLM 流式输出(SSE)** — 当前 3 处都是一次性 chat 拿完整 response,流式留给 v2.1
- **LLM 失败重试** — 当前直接 fallback stub,不重试
- **provider 自动 fallback** — 当前用 config 第一个 enabled provider,失败不回退到下一个
- **LlmConfig.vue 单元测试** — 当前 178 测试没新增,UI 行为靠手动验证

---

## 给后续 subagent 的提醒

- **fallback 是关键**:不要把 stub 完全删掉,任何 LLM 调用都必须 try/catch 后 fallback 到原行为,否则用户没配 key 时整个产品就挂了
- **apiKey 不写入 commit**:LlmConfigStore 持久化到 userData JSON,默认 gitignore,不要把 example config 推到 git
- **3 provider URL 不要混**:OpenAI/Zhipu 用 `Authorization: Bearer`,Anthropic 用 `x-api-key` header,Anthropic system message 必须在 `system` 字段不在 `messages[]` 里
