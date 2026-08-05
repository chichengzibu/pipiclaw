# PiPiClaw v4.4.0 — Agent 1: 架构师视角审查报告

- 审查日期: 2025-08
- 审查范围: `electron/` 主进程 + `src/` 渲染进程 + `package.json`
- 审查方法: 实际读源文件,不靠 README 推测
- 任务文档: `docs/audit/01-architecture.md`

---

## 1. 架构总览 (TL;DR)

PiPiClaw 是一个 **Electron + Vue 3** 的桌面 AI 助手,主进程承担全部 LLM 调度、本地执行、IM 通道、记忆、技能等重型域,渲染进程只做展示。整体走 **Preload + contextBridge + contextIsolation** 的标准安全模型,IPC 用 `invoke/handle` 双向消息,**OpenClawGateway (HTTP 18789)** 作为本地执行网关独立运行。

代码处于 **"W3+ 域框架已搭,W5/W7/W9 大部分能力仍 stub"** 的中间态:`CapabilityRegistry`(contracts/)有完整接口但只有骨架;`LlmClient`(W14)是新一代统一 LLM 抽象,但 ChatManager 仍用旧的 `ModelManager` 路线;Sandbox/Channel/Insight 多处返回 `{ stub: true }`。**架构愿景清晰,落地度参差不齐** — 关键路径(Chat / OpenClaw / Skill)能跑,新协议层正在往"统一 Capability"迁移但未完成。

---

## 2. 关键模块 (含路径 + 角色)

| 模块 | 主路径 | 角色 / 状态 |
|---|---|---|
| 主进程入口 | `electron/main.ts` | 应用生命周期 + 子系统 wire,顺序化启动 |
| Preload | `electron/preload.ts` | contextBridge 暴露 ~140 个 channel,类型声明齐全 |
| IPC Server | `electron/core/IpcServer.ts` | 单例注册器,初始化时先 `removeHandler` 防重复;2286 行 |
| LLM Client (新) | `electron/llm/LlmClient.ts` + `adapters/{openai,anthropic,zhipu}.ts` | **W14 新抽象**,3 provider,tool_call + EventBus,**统一 LlmRequest/Response** |
| LLM Config Store | `electron/llm/LlmConfigStore.ts` | **用 `safeStorage` 加密落盘**,支持 legacy 明文迁移 |
| Model Manager (旧) | `electron/models/ModelManager.ts` | 6 type (openai/anthropic/deepseek/azure/ollama/custom/openrouter/volc_ark),内联测试逻辑 |
| Chat Manager | `electron/chat/ChatManager.ts` | 999 行,核心聊天;**流式用旧 ModelManager**,不支持 tool call;**agent 接入只 log 不回传** |
| Agent Brain | `electron/agent/AgentBrain.ts` + `LlmAgentBrain.ts` | 5 方法接口;`AgentBrainImpl` 走 `Conversation/EventBus` 全 stub;`LlmAgentBrain` 走 `LlmClient` |
| Execution Engine | `electron/agent/ExecutionEngine.ts` | **完全 stub** — `call/spawn` 返回 `{ stub: true, note: 'W5.2.4 接管' }` |
| Tool Registry | `electron/agent/ToolRegistry.ts` | 单独文件,需进一步审计 |
| Scheduler | `electron/runtime/scheduler/Scheduler.ts` | FIFO/Priority/Deadline 3 策略,Promise.race timeout,EventBus 事件;**仅 SkillRuntime 使用,主 Chat 路径不调度** |
| EventBus | `electron/runtime/bridge/EventBus.ts` | pub/sub + 100 条历史 ring buffer |
| IpcBridge | `electron/runtime/bridge/IpcBridge.ts` | 单一 channel `runtime:ipc-bridge` + Actor 转发 |
| HttpBridge | `electron/runtime/bridge/HttpBridge.ts` | actor → 18789 网关的 HTTP 客户端,30s timeout |
| OpenClaw Gateway | `electron/openclaw/OpenClawGateway.ts` | 906 行,filesystem/shell/browser/clipboard 14+ 操作,带权限 + 超时 + 审计 |
| OpenClaw Server | `electron/openclaw/OpenClawServer.ts` | HTTP 18789,3 endpoint;**CORS `*` 跨源放开** |
| OpenClaw Executor | `electron/openclaw/OpenClawExecutor.ts` | 包装 Gateway,加重试 |
| Permission | `electron/permissions/PermissionManager.ts` + `PermissionConfig.ts` | 5 模板(safe/standard/permissive/custom),4 级别,带白/黑名单 regex |
| Hermes Memory | `electron/hermes/HermesMemory.ts` + `HermesAdapter.ts` | 旧:文件 + keyword 排序;新:adapter + vector store + embedder(但 embedder 需进一步审计) |
| Skill Loader | `electron/skill/SkillLoader.ts` | 解析 `skill.md`,keyword 匹配,>5 个时用 SelfLearner 语义筛选 |
| Skill Runtime | `electron/runtime/skill/SkillRuntime.ts` | 注册/调用/调度;走 Scheduler |
| Skill Signer | `electron/skill/SkillSigner.ts` | **HMAC-SHA256 + 硬编码 `LOCAL_KEY` 注释 "do not use in prod"** |
| Skill Auto Creator | `electron/skill/AutoCreator.ts` | 模板填充,**W6 stub 不调 LLM** |
| Channel (IM) | `electron/channel/{Feishu,DingTalk,WechatWork,WeChat,Lark,Slack,QQ,Telegram,Rocket,Discord,WhatsApp}Channel.ts` | **11 个通道:3 真实现(Feishu/DingTalk/WechatWork),8 stub** |
| Sandbox | `electron/sandbox/index.ts` | 域常量 + re-export;**`run/preview/stop` IPC 全 stub** |
| Insight | `electron/insight/InsightManager.ts` | 4 子系统聚合 (Trace/Cost/Kanban/Anomaly),`insight:cost:today` IPC 全 stub |
| Stores | `src/stores/{chat,models,app,guide,...}.ts` | 12 个 Pinia store,`chat.ts` 1046 行最重 |
| Router | `src/router/index.ts` | 22 路由,`devOnly` 守卫产线强制重定向到 `/dashboard` |
| Window | `electron/core/WindowManager.ts` | `nodeIntegration:false / contextIsolation:true / webSecurity:true` ✅ |

---

## 3. 启动流程 (main.ts)

```
app.whenReady()
  ├─ setupAppMenu()                       // 隐藏菜单
  ├─ IpcServer.registerHandlers()         // 2286 行 handler 一次注册
  ├─ new AutoUpdater().registerIpcHandlers()  // P1-T1.3 hotfix: 早注册,避免 race
  ├─ WindowManager.createMainWindow()     // 1280x800,dev 走 vite 5173,prod 走 dist
  ├─ GlobalShortcut.registerAll()         // 全局快捷键
  ├─ TrayManager.create()                 // 托盘
  ├─ PermissionConfig.forceResetToPermissive()  // ⭐ 强制 permissive
  ├─ ConfigStore.get + alwaysOnTop/edgeHide 应用
  ├─ OpenClawGateway.getInstance() + start()     // 18789 HTTP
  ├─ isDev ? openDevTools : null
  ├─ ready-to-show → AutoUpdater.initialize()   // 检查更新
  └─ W7.0.1 wire (try/catch 非致命):
       ├─ IpcBridge.registerHandler()
       ├─ HermesAdapter.getInstance()
       ├─ CapabilityRegistry.markInitialized()   // ⚠️ 但实际未 register 任何域
       ├─ ChatManager.registerAgent(AgentBrainImpl)    // ⚠️ 然后被覆盖
       ├─ ChatManager.registerAgent(LlmAgentBrain)    // ⚠️ 实际只用这个
       ├─ D1ScreenshotQA 快捷键 + skill 注册
       └─ D5RecordingToSkill 注册
```

**问题点 (见 §4)**:
- W7.0.1 wire 块虽然 try/catch,但 `CapabilityRegistry.markInitialized()` 在没有 register 任何 Domain 的情况下会被调用,日志会显示 "0 域,0 capability"。
- 双 `registerAgent`:后注册的 `LlmAgentBrain` 覆盖 `AgentBrainImpl`,前者只在 `dispatchToAgent` 时被调到,ChatManager 正常 sendMessage 仍走自己的旧逻辑。

---

## 4. 关键问题 (按严重度)

### 🔴 Critical (必须修)

#### C1. OpenClawServer CORS 全开 + 无认证
**位置**: `electron/openclaw/OpenClawServer.ts:184-186`
```ts
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```
**问题**: 18789 端口是 `Access-Control-Allow-Origin: *` 跨域放开,而且 **没有任何 auth token / API key 校验**。任何用户在浏览器打开的恶意网页,都能用 `fetch('http://127.0.0.1:18789/execute', ...)` 直接绕过 UI/permission UI 执行 `run_command`、`delete_file` 等高危操作 — 这是典型的 [CSRF on localhost](https://github.com/nickthecook/archernar/blob/master/csrf.md) 攻击面。
**修复**: 把 `Allow-Origin` 去掉,或锁到具体的 `file://` origin;`/execute` 必须校验 `X-OpenClaw-Token`(IPC 主进程注入的 short-lived token)。

#### C2. `runCommand` 没有任何命令白名单
**位置**: `electron/openclaw/OpenClawGateway.ts:676-693`
```ts
// 放宽限制：移除严格白名单，记录警告
const baseCmd = command.split(' ')[0].toLowerCase();
this.log.warn('[OpenClawGateway] 执行命令 (放宽限制):', baseCmd);
const { stdout, stderr } = await execAsync(fullCommand, { cwd, timeout, shell: true });
```
**问题**: 直接 `execAsync(command, { shell: true })` — `shell:true` 允许 shell 注入 (`; rm -rf /`)。PermissionManager 的 `shell/execute` 只能挡粗粒度类别,挡不住 `rm -rf ~/Documents` 之类。注释也承认 "放宽限制"。
**修复**: 移除 `shell:true`(用 `execFile` + args 数组),或加最小白名单 + 参数 escape;危险操作 (`rm`, `mkfs`, `dd`, `shutdown`) 显式拒绝。

#### C3. LLM API Key 在前端明文流转 / 双重配置系统
**位置**: `electron/llm/LlmClient.ts` + `electron/models/ModelManager.ts` + `src/stores/models.ts`
**问题**: 存在**两套并行 LLM 抽象**,配置互不共享:
- **新 (W14)**: `LlmClient` + `LlmConfigStore` (3 provider,`safeStorage` 加密) — 仅有 LlmAgentBrain 使用
- **旧**: `ModelManager` + `ModelConfig` + 渲染端 `useModelsStore` (8 type) — ChatManager 走这条

`useModelsStore` 的 `ProviderConfig.apiKey` 是**明文持久化**(`ModelConfig.ts` 待审);preload 通过 `models:test` 把 `providerId` + `modelId` 直接转给主进程,API key 在内存中跨 IPC 全程明文。
**修复**: 短期 — 把 ChatManager 切到 `LlmClient`,统一入口;中期 — `safeStorage` 加密 `ModelConfig.apiKey`;长期 — 只在主进程持有明文,渲染端只看到 alias。

#### C4. SkillSigner 硬编码本地 HMAC key
**位置**: `electron/skill/SkillSigner.ts:24`
```ts
private readonly LOCAL_KEY = 'pipiclaw-local-stub-key-W6-do-not-use-in-prod'
```
**问题**: 源码里直接写明文 HMAC key,任何 clone 仓库的人都能伪造签名;`signer.verify` 比对的是 hash + HMAC,攻击者拿到 key 后能任意签发"已签技能"。目前 SkillLoader 不强制 verify,但 `AutoCreator` 在每次创建时都签,会埋下未来信任链崩塌的雷。
**修复**: 至少 `(1)` 从环境变量 / 用户配置读取 key;`(2)` SkillLoader 启动时强制 verify import 进来的 skill,失败拒绝加载。

---

### 🟠 Major (应该修)

#### M1. 多个 AgentBrain 双注册,实际链路走 `dispatchToAgent` noop
**位置**: `electron/main.ts:144-158`, `electron/chat/ChatManager.ts:961-972`
```ts
// main.ts
ChatManager.getInstance().registerAgent(asAgentBrain(AgentBrainImpl.getInstance()));
ChatManager.getInstance().registerAgent(asAgentBrain(LlmAgentBrain.getInstance() ...));
// ↑ 第二次覆盖了第一次
```
```ts
// ChatManager.dispatchToAgent
const decision = await this.registeredAgent.think({ conversationId: msg.id, content: msg.content });
this.log.debug('[ChatManager] dispatchToAgent: agent decision', { decision });
// ↑ think() 的 decision 拿回来就只 log,从不回写 ChatManager 流
```
**问题**: 
1. `AgentBrainImpl` 注册完被覆盖,白注册。
2. `LlmAgentBrain` 被调用后,结果**没人接** — `think()` 返回的 `Decision.payload.text` 不会变成流式消息。
3. ChatManager 正常 `sendMessage` → `handleNormalChat` 路径 **完全绕开** 已注册 agent,直接调 `streamCloudProvider/streamAnthropic/streamOllama`。
**结果**: 表面上"已接入 LLM Agent",实际 Chat 流仍走旧的 ModelManager;`LlmAgentBrain` 是死代码。
**修复**: 在 `ChatManager.handleNormalChat` 之前加一个钩子,如果 `registeredAgent` 存在,优先用 `agent.think()` 生成 `Decision.payload.text` 当作占位 `content` 然后再 stream;或彻底把 Chat 流切到 `LlmClient`。

#### M2. CapabilityRegistry 启动时没有任何 Domain 注册
**位置**: `electron/main.ts:141`, `electron/contracts/CapabilityRegistry.ts`
**问题**: `markInitialized()` 调用时 `domains.size === 0`,`capabilities.size === 0`。`agent:list` IPC 返回 `[]`。能力域架构(Agent/Memory/Skill/Channel/Sandbox/Connector/Insight)目前**只有接口契约,没有真注册**。W3.2 注释 "W7 之后:加入权限校验 + 链路追踪" 还没实现。
**修复**: 把 `LlmAgentBrain`/`HermesAdapter`/`SkillLoader`/`ChannelRouter`/`Sandbox` 各自的 Capability 显式 register 进去;否则 contracts 是个空壳。

#### M3. Sandbox / Insight / 部分 IM 通道是 stub
- `electron/sandbox/index.ts` 只有 `SANDBOX_DOMAIN` 常量,IPC 全部 `{ stub: true }`
- `electron/insight/CostTracker` 实现了本地记账,但 `insight:cost:today` IPC 直接 `return { totalCostUsd: 0, totalTokens: 0, stub: true }`,Dashboard 看到的全是 0
- 11 个 IM Channel 中 8 个是 `async send() { return; }` (Lark, Slack, QQ, Telegram, Rocket, WeChat, Discord, WhatsApp)

`src/views/Dashboard.vue` + Tasks / Insight 页可能完全空,UI 真实性受影响。
**修复**: 短期把 stub IPC 改成实际聚合(读 `CostTracker.getTodayCost()`);长期真正接 SDK。

#### M4. `ChatManager` 999 行 + 内联 3 个流式实现
**位置**: `electron/chat/ChatManager.ts:482-880`
**问题**: `streamAnthropic / streamOllama / streamCloudProvider` 三个 `https.request` 流式解析都内联在 ChatManager 里,代码大量重复(abort controller、timeout、buffer 拆分、line parsing、accumulator、broadcast)。再加之 5 个 provider 的特殊处理都堆在 `streamCloudProvider` 里的 if/else 链 (volc_ark / deepseek / openai / custom / azure),新增 provider 必须改 ChatManager。
**修复**: 抽 `StreamTransport` 抽象,把 ChatManager 里的流式逻辑下沉到 `LlmClient` / `LlmStreamTransport`,ChatManager 只负责"消息生命周期 + Hermes 注入 + broadcast"。

#### M5. Scheduler 实际上没被 Chat / IM / OpenClaw 使用
**位置**: `electron/runtime/scheduler/Scheduler.ts`
**问题**: Scheduler 写得不错(FIFO/Priority/Deadline + timeout + EventBus),但**只有 `SkillRuntime` 注入了一个实例**。`TaskExecutor` / `OpenClawExecutor` / `ChatManager.sendMessage` 都没有调度,长任务会阻塞单次 IPC。`Plan/Craft/Safe` 三种执行模式 (TaskExecutionMode) 在主流程里也只做"高危二次确认",没有切到独立 worker。
**修复**: 把 `OpenClawExecutor.executeBatch` 走 Scheduler;`TaskExecutor` 长任务也走,加取消传播。

#### M6. Hermes Memory 双实现不统一
- `HermesMemory` (旧): 文件 USER.md/MEMORY.md + 简单 importance 排序
- `HermesAdapter` (新): 适配 contracts `HermesMemory` 4 方法,带 `MemoryVectorStore` + `EmbeddingService` + `KeywordRetriever`
- `ChatManager.handleNormalChat` 调的是旧 `HermesMemory.buildMemoryPrompt`,**没用新 adapter** 的 vector 召回
**修复**: `ChatManager` 切到 `HermesAdapter.recall()`;`buildMemoryPrompt` 退役。

---

### 🟡 Minor (可改可不改)

#### m1. package.json 版本号滞后
`package.json:3` 是 `"4.3.0"`,但任务说 v4.4.0。CHANGELOG 估计更准,需要确认 build 时是否 bump。

#### m2. IpcServer.js 2286 行,`registerHandlers` 巨型方法
所有 handler 都在一个函数里;任何一个新增 IPC 都要翻到这里。可以拆到 `IpcServer.registerChatHandlers / registerSkillHandlers / ...`。

#### m3. `LlmAgentBrain` 的 `call(tool)` 是 LLM 自身调用自己生成"工具结果",不是真执行
```ts
const prompt = `Tool call name=${tool.name} args=${JSON.stringify(tool.args).slice(0, 400)}\n请输出 1-3 句工具结果描述。`;
```
这是 LLM 假装执行 tool,真实工具调用走 `ToolRegistry` 是空的 (`ExecutionEngine.execute('call')` 返回 stub)。Tool call 循环不可用。

#### m4. 路由有 5 个 `devOnly` demo 页 (`/d1-demo`, `/d5-demo`, ...) 仅在 dev 暴露 — ✅ 已正确守卫

#### m5. `LlmConfigStore` 静默 fallback 到明文
```ts
const plain = safeStorage.isEncryptionAvailable()
  ? safeStorage.decryptString(buf)
  : buf.toString('utf-8')
```
Linux 无 keychain 时直接明文落盘,需要 warning 提示用户。

#### m6. `WindowManager` 设置 `sandbox: false`
`webPreferences.sandbox: false` 配合 `contextIsolation: true` 安全模型基本 OK,但 sandbox 关闭意味着 preload 跑在 privileged 上下文,需要确保 preload 不引入有副作用的包。建议开 sandbox。

#### m7. `OpenClawGateway.runCommand` `cwd` 可指向任意路径
`resolvePath` 把 `~` / 相对路径转绝对,但没限制必须在用户文档目录以内。配合 C1 攻击面,可被诱导执行任意目录下的脚本。

#### m8. 大量 logger 直接打印 `req.body` / `data`
`ModelManager.makeHttpRequest` 打印 `rawBody` 全量响应,会泄露 API 完整内容到日志(隐私 / 合规风险)。

#### m9. `open-devtools` IPC handler 全局注册,未做来源校验
`main.ts:46-53` 的 `ipcMain.on('open-devtools', ...)` 任何窗口都能触发,生产环境应禁用。

#### m10. `agent.ts` 中大量 `as any` 强转
- `(chatManager as any).handleUserConfirmation`
- `(taskExecutor as any).executeToolCall`
- `(mgr as any).listRules`
- `asAgentBrain(LlmAgentBrain.getInstance() as unknown as AgentBrainImpl)`
契约未对齐,类型系统保护几乎为零。

#### m11. `runtime:ipc-bridge` channel payload 无校验
IpcBridge 接收任何 `msg.from` 转发给 ActorRegistry,如果注册了同名 actor 可被冒充;`actor.send` 不验证 `from` 一致性。

#### m12. `HermesAdapter.embedder.embedMemory` 在 `recall()` 中**每次**都跑,未做持久化缓存
首次 recall 会卡住 N 次 embedding 调用 — 大型记忆库冷启动慢。

---

## 5. 跨平台兼容

| 维度 | 状态 | 备注 |
|---|---|---|
| Windows | ✅ | 主战场;`bwrap` / `seatbelt` / `windowsJob` 三个 L1 沙箱实现都有文件 |
| macOS | 🟡 | `app.getPath('desktop')` 在 Darwin 正常;`shell.openExternal` 全平台 OK;`permissions.json` 用 `process.env.HOME` 兼容 |
| Linux | 🟡 | `WindowsJob` 不适用,需走 `bwrap`(bubblewrap);dockerDetector 用 `which docker` 不区分 distro |
| Electron 版本 | 30.5.1 | 较新,contextBridge/contextIsolation 行为稳定 |
| Node | 20+ | `AbortSignal.timeout`、`safeStorage` 都依赖 |
| WebContainer | 🟡 | `webcontainer:renderer-ready` IPC 存在但实际 `SandboxBuilder` 是 stub;生产 e2e 未确认 |

`OpenClawGateway.runCommand` 显式 `shell: true` 在 Windows 行为差异大(PowerShell vs cmd),需要平台分支。

---

## 6. 跨域关系图 (简化)

```
┌──────────────────────────────────────────────────────────────────┐
│                       Renderer (Vue 3 + Pinia)                    │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Stores  │──│ Router  │──│  Views   │  │ Components/Chat  │  │
│  └─────────┘  └─────────┘  └──────────┘  └──────────────────┘  │
│       │                                                       │
│       │ window.electronAPI (140 channel, typed)                │
└───────┼───────────────────────────────────────────────────────┘
        │ contextBridge  │ preload
┌───────▼───────────────────────────────────────────────────────┐
│                       Main Process (Node)                       │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐   │
│  │IpcServer │──│ ChatManager  │──│ ModelManager (旧,6)    │   │
│  │(2286 行) │  │ + LlmAgentBrain│  └────────────────────────┘   │
│  └──────────┘  └──────────────┘                                │
│       │            │           ┌────────────────────────┐       │
│       │            └──────────▶│ LlmClient (新 W14,3)  │       │
│       │                        └────────────────────────┘       │
│       │  ┌──────────────────┐                                  │
│       ├─▶│ OpenClawGateway  │  ◀── OpenClawServer :18789       │
│       │  │ (14 ops + audit) │      (HTTP, CORS:*)               │
│       │  └──────────────────┘                                  │
│       │  ┌──────────────────┐                                  │
│       ├─▶│ PermissionManager│  ◀── PermissionConfig (force)    │
│       │  └──────────────────┘                                  │
│       │  ┌──────────────────┐                                  │
│       ├─▶│ HermesMemory     │ + HermesAdapter (vector)         │
│       │  └──────────────────┘                                  │
│       │  ┌──────────────────┐                                  │
│       ├─▶│ SkillLoader/Runtime│ ◀── SkillSigner (HMAC stub)    │
│       │  └──────────────────┘                                  │
│       │  ┌──────────────────┐                                  │
│       └─▶│ ChannelRouter    │ (11 channels, 3 real)             │
│          └──────────────────┘                                  │
│  ┌──────────────────────────────────────┐                       │
│  │ CapabilityRegistry (W3 stub, 0 domains)│                    │
│  └──────────────────────────────────────┘                       │
│  ┌──────────────────────────────────────┐                       │
│  │ EventBus (pub/sub) + ActorRegistry   │                       │
│  └──────────────────────────────────────┘                       │
└──────────────────────────────────────────────────────────────────┘
```

**关键洞见**:
- `ChatManager` 是事实上的中心节点,但它的"agent 接入"是装饰性的
- `OpenClawGateway` 是真正干活的执行引擎,但暴露了过多攻击面(C1, C2)
- `CapabilityRegistry` / `AgentBrain` / `Sandbox` 这套 W3 蓝图**目前是空中楼阁**,需要 W5/W7/W9 持续填

---

## 7. 5-Provider 抽象评估 (与任务问题对应)

任务说"5 provider 统一抽象",**实际是分裂**:
- **`LlmClient` (W14)**: openai / anthropic / zhipu — 3 provider,有 tool call,事件总线
- **`ModelManager` (旧)**: openai / anthropic / deepseek / azure / ollama / custom / openrouter / volc_ark — 8 type
- **`ChatManager` 内联分支**: streamAnthropic / streamOllama / streamCloudProvider (含 volc_ark 特殊日志)

每个 provider 在不同层重复实现,没有真正的"统一接口"。**LlmClient** 抽象设计是对的(类型 / 错误 / usage / tool_call 都齐),但**只被 LlmAgentBrain 用**,Chat 流不用。
**结论**: 任务里说的"5 provider 统一"目前**未达成**。要么把 ChatManager 切到 LlmClient,要么承认 LlmClient 是未来方向、当前以 ModelManager 为主。

---

## 8. 评分

### 健康度: **6.0 / 10**

| 维度 | 分数 | 说明 |
|---|---|---|
| 架构分层 | 7/10 | 主/渲染/IPC 边界清晰,preload 安全配置正确;但 Contracts/Skeleton 多处空 |
| IPC 安全 | 7/10 | contextBridge + contextIsolation ✅;无白名单通道鉴权,大量 handler 任意传参 |
| LLM 抽象统一性 | 3/10 | 两套并行,5 provider 抽象未达成 |
| Chat 消息流完整性 | 6/10 | 流式 / Hermes / 取消都 OK;但 agent 接入是装饰性,tool call loop 不可用 |
| Agent runtime | 4/10 | 5 方法接口 OK,ExecutionEngine/ToolRegistry 全 stub,LlmAgentBrain 死代码 |
| 任务调度 | 4/10 | Scheduler 实现完整,但只在 SkillRuntime 用;主任务路径不调度 |
| 记忆系统 | 6/10 | 旧/新两套并存;Chat 流用旧的;Vector + Embedder 已就位但未被主路径消费 |
| Skills 系统 | 6/10 | Loader / Runtime / AutoCreator / Chain / Versioning 完整;Signer HMAC stub 是雷 |
| 启动流程 | 7/10 | 顺序化 + try/catch 兜底,AutoUpdater 早注册 hotfix 有意识;但 W3 wire 块很多 stub |
| 跨平台 | 7/10 | 三平台 sandbox stub 都有;Windows 主战;Linux/macOS 实际未 e2e |
| 可观测性 | 5/10 | LogManager / EventBus / TraceCollector / CostTracker 在;IPC 透出不全 |
| 安全性 | **3/10** | 🔴 CORS `*` + 无认证 + runCommand 无白名单 + LLM key 明文流转 → **必须先修** |

### 关键风险点
1. **OpenClawGateway 18789 CORS `*` + 无 token** → 任何网页可执行 shell (C1, C2)
2. **LLM 抽象分裂** → 维护成本 × 2,新 provider 必改 2 处 (C3)
3. **Agent 接入是装饰** → "ship-ready" 叙事的核心能力实际是空 (M1)
4. **CapabilityRegistry 空壳** → contracts/ 是未来承诺,不是今天的事实 (M2)

### 修优先级建议
- **本周**: C1, C2 (安全)
- **下个 sprint**: C3 (统一 LLM 抽象) + M1 (把 AgentBrain 真接入 Chat 流)
- **持续**: M2-M6,把所有 stub 域补齐或明确标 deprecated

---

## 9. 一句话总结

**架构蓝图清晰,落地度 ~60%。** 安全有 2 个 critical 漏洞必须马上修(CORS 18789 + runCommand shell:true),LLM 抽象分裂是最大的技术债,Agent/Sandbox/Channel 大面积 stub 让 contracts/ 暂时是空头支票。但 preload 安全 / LlmClient 新抽象 / LlmConfigStore 加密 / devOnly 守卫 / 强制 permissive 等设计选择,显示团队在向"production-grade"靠拢,只是 W3 蓝图的执行节奏落后于叙事。

