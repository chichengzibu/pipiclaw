# PiPiClaw v2 实施计划 — 12 周推到 100% 可发布

> **范围**：基于 spec `2026-07-10-pipiclaw-v2-design.md`（已落盘）
> **目标**：保留 1.0.0 全部 38 .ts 真实实现，补齐 8 能力域缺失部分 + runtime 5 核心 + P7 沙盒 + 测试体系 + 视觉翻新，12 周 GA v2.0.0
> **核心原则**：
> 1. 保留 1.0.0 真实实现，**禁止重写**（反模式 4）
> 2. 沙盒**显式失败 + 显式引导**，禁止静默降级（反模式 3）
> 3. 演示链路必须**真实跑通**，禁止 mock
> 4. 每周末必须 0 typecheck 错 + 100% test pass

---

## W1 — 工具链 + postinstall + 删 `electron/gateway/`

**主题**：建立工程基线，删重复 gateway 目录。

### Task W1.1 — `bin/postinstall.mjs`（5 项探测）

**Files**: `bin/postinstall.mjs`、`package.json`

- 5 项探测：Node ≥ 20.11 / git / platform（darwin/win32/linux）/ arch（x64/arm64）/ Docker CLI（仅探测）
- 写入 `~/.pipiclaw/.bootstrap-state.json`（用 `homedir()` 拼）
- 失败绝不 throw，main 外层 catch 永远 `process.exit(0)`
- 仅依赖 `node:` 内置

**commit**:
```bash
git add bin/postinstall.mjs package.json
git commit -m "chore(bootstrap): postinstall env probe → ~/.pipiclaw/.bootstrap-state.json"
```

**验收**: `node bin/postinstall.mjs` 跑通 5/5，state 写入。

### Task W1.2 — 删 `electron/gateway/` 4 文件

**Files**: `electron/gateway/GatewayManager.ts`、`MessageGateway.ts`、`GatewayConfig.ts`、`GatewayStatus.ts`、`electron/types/gateway.d.ts`

- 验证没有 import 引用（grep 整个 `electron/` + `src/`）
- `git rm` 5 个文件
- 同时 `electron/preload.ts` 删除 `gateway:*` 引用

**commit**:
```bash
git rm -r electron/gateway/ electron/types/gateway.d.ts
# 同步修 preload.ts
git add electron/preload.ts
git commit -m "chore: drop legacy electron/gateway (duplicated by openclaw/)"
```

**验收**: `git log -1` 显示该 commit；`grep -r "gateway/" electron/ src/` 0 命中。

### Task W1.3 — 加 vitest + eslint 9 + 扩 `.gitignore`

**Files**: `package.json`、`vitest.config.ts`、`.gitignore`

- 装 `vitest@^1.6.0`（devDep）+ `@vue/test-utils@^2.4.6`（devDep）
- 写 `vitest.config.ts`（jsdom + setup file + alias）
- 加 scripts：`"test": "vitest run"` / `"test:watch": "vitest"` / `"lint": "eslint . --fix"`
- 装 `eslint@^9.10.0` + `@typescript-eslint/*`（devDep）
- 写 `eslint.config.mjs`（flat config，TS + Vue）
- 扩 `.gitignore`：加 `coverage/` `*.log` `.env` `.env.local` 等

**commit**:
```bash
git add package.json vitest.config.ts eslint.config.mjs .gitignore
git commit -m "chore(toolchain): add vitest + eslint 9 + expanded .gitignore"
```

**验收**: `npm install` 跑通；`npm test` 跑通（哪怕 0 测试）；`npm run lint` 0 warning；`npm run typecheck` 0 错。

---

## W2 — 视觉翻新（Apple HIG tokens + 12 view）

**主题**：design tokens、12 view 翻新、暗色模式。

### Task W2.1 — Apple HIG design tokens

**Files**: `src/styles/tokens.css`（新建）、`src/styles/variables.scss`（已存在，改动）、`src/styles/global.scss`（已存在，改动）

- Spacing tokens: `--space-xs/sm/md/lg/xl/2xl` = 4/8/16/24/32/48 px
- Color tokens: `--bg-primary/secondary/elevated` + `--text-primary/secondary/tertiary` + `--accent/hover` + `--success/warning/danger`，light + dark 两套
- Typography tokens: `--font-size-11/13/15/17/22/28` + `--font-family-system`
- Motion tokens: `--ease-spring` + `--duration-fast/base/slow` = 200/300/500ms
- Radius tokens: `--radius-sm/md/lg/xl/pill` = 4/8/12/16/999

**commit**:
```bash
git add src/styles/
git commit -m "feat(styles): Apple HIG design tokens (spacing/color/type/motion/radius)"
```

### Task W2.2 — 12 view 翻新视觉（仅改样式，不改逻辑）

**Files**: 12 个 `src/views/*.vue`（Dashboard/Chat/Tasks/SkillsView/SkillMarket/PluginMarket/Models/Permissions/Schedule/RemoteControl/Settings/Help）

- 每个 view 引用 tokens.css 变量
- 统一卡片样式、按钮样式、列表样式
- 暗色模式：`@media (prefers-color-scheme: dark)` 自动适配
- **不改业务逻辑、不改路由、不改 store action**

**commit**（**每个 view 一个 commit**，共 12 个）：
```bash
git add src/views/Dashboard.vue
git commit -m "feat(view): Dashboard Apple HIG visual refresh"
# ... 11 more commits
```

**验收**: 12 view 在 light + dark 各跑通 1 次；DevTools Performance 录屏 60fps；npm run lint 0 warning。

---

## W3 — 8 能力域骨架 + IPC namespace

**主题**：建 6 个新域根目录 + CapabilityRegistry 协议 + IpcServer 4 个新 namespace。

### Task W3.1 — 6 个新域根目录 + index.ts

**Files**: `electron/agent/index.ts`、`electron/contentgen/index.ts`、`electron/connector/index.ts`、`electron/computeruse/index.ts`、`electron/insight/index.ts`、`electron/sandbox/index.ts`

- 每个 index.ts 导出 `export const AGENT_DOMAIN = { ... }` 形式（参考 `electron/chat/index.ts` 1.0.0 已有模式）
- 6 个目录加 `.gitkeep` 占位

**commit**:
```bash
git add electron/agent/ electron/contentgen/ electron/connector/ electron/computeruse/ electron/insight/ electron/sandbox/
git commit -m "feat(architecture): 6 new capability domain root directories"
```

### Task W3.2 — `electron/contracts/CapabilityRegistry.ts`（域间协议）

**Files**: `electron/contracts/CapabilityRegistry.ts`、`electron/contracts/types.ts`

- 定义 `Capability` interface（id / displayName / execute / capabilities[]）
- 定义 `Domain` interface（id / description / capabilities[] / dependencies[]）
- 定义 10 个 Domain 常量（Chat / Agent / Memory / Skill / Channel / Computer / Content / Insight / Connector / Sandbox）
- 写 `CapabilityRegistry` 类（register / resolve / execute）

**commit**:
```bash
git add electron/contracts/
git commit -m "feat(contracts): CapabilityRegistry + 10 Domain definitions"
```

### Task W3.3 — IpcServer 加 4 个新 namespace

**Files**: `electron/core/IpcServer.ts`（1592 行，**严格只追加不改**）、`electron/preload.ts`

- 在 `IpcServer.ts` 末尾加 `registerAgentNamespace()` / `registerChannelNamespace()` / `registerSandboxNamespace()` / `registerInsightNamespace()` 4 个方法
- 每个方法注册 3-5 个 channel（agent:think、agent:spawn、channel:list、sandbox:detect、sandbox:run、insight:trace 等）
- 全部 channel 走 `domain:verb` 形式（小写、kebab）
- preload.ts 加 4 个 namespace 暴露

**commit**:
```bash
git add electron/core/IpcServer.ts electron/preload.ts
git commit -m "feat(ipc): register agent:channel:sandbox:insight namespaces (additive, no breaking change)"
```

**验收**: `npm run typecheck` 0 错；IpcServer 启动时注册 8+4=12 个 namespace；`window.electronAPI.agent.think()` 等 4 个新方法可用。

---

## W4 — runtime 5 核心子系统

**主题**：actor / bridge / conversation / scheduler / skill 5 子模块。

### Task W4.1 — `runtime/actor/` (Actor 模型)

**Files**: `electron/runtime/actor/Actor.ts`、`ActorRegistry.ts`、`MessageQueue.ts`

- Actor 接口：`send(msg) / receive() / spawn() / stop()`
- ActorRegistry：register / lookup / list
- MessageQueue：FIFO + 优先级
- ~150 行

**commit**:
```bash
git add electron/runtime/actor/
git commit -m "feat(runtime): actor model (Actor + ActorRegistry + MessageQueue)"
```

### Task W4.2 — `runtime/bridge/` (IPC + HTTP 桥)

**Files**: `electron/runtime/bridge/IpcBridge.ts`、`HttpBridge.ts`、`EventBus.ts`

- IpcBridge：把 main process 的 channel 暴露给 runtime actor
- HttpBridge：openclaw/ HTTP 18789 暴露给 runtime actor
- EventBus：runtime 内跨 actor 事件总线
- ~200 行

**commit**:
```bash
git add electron/runtime/bridge/
git commit -m "feat(runtime): bridge (ipc + http + event bus)"
```

### Task W4.3 — `runtime/conversation/` (会话状态机)

**Files**: `electron/runtime/conversation/Conversation.ts`、`State.ts`、`Transition.ts`

- Conversation：会话状态机（idle / thinking / executing / waiting / done / error）
- State：6 个状态定义
- Transition：转换规则
- ~150 行

**commit**:
```bash
git add electron/runtime/conversation/
git commit -m "feat(runtime): conversation state machine"
```

### Task W4.4 — `runtime/scheduler/` (任务调度)

**Files**: `electron/runtime/scheduler/Scheduler.ts`、`TaskQueue.ts`、`PriorityQueue.ts`

- Scheduler：调度策略（FIFO / 优先级 / deadline）
- TaskQueue：队列
- PriorityQueue：按优先级出队
- ~180 行

**commit**:
```bash
git add electron/runtime/scheduler/
git commit -m "feat(runtime): scheduler (FIFO + priority + deadline)"
```

### Task W4.5 — `runtime/skill/` (技能运行时)

**Files**: `electron/runtime/skill/SkillRuntime.ts`、`Invocation.ts`、`Context.ts`

- SkillRuntime：技能执行环境
- Invocation：一次技能调用
- Context：上下文传递
- ~200 行

**commit**:
```bash
git add electron/runtime/skill/
git commit -m "feat(runtime): skill runtime (SkillRuntime + Invocation + Context)"
```

### Task W4.6 — ChatManager 接入 Agent 注册点

**Files**: `electron/chat/ChatManager.ts`（**严格只追加**，3 个新方法）

- 加 `registerAgent(brain: AgentBrain): void` 方法
- 加 `dispatchToAgent(msg: ChatMessage): Promise<void>` 方法
- 加 `subscribeStream(handler: (chunk: StreamChunk) => void): Disposable` 方法
- **不改现有方法、不改 import、不改构造函数**

**commit**:
```bash
git add electron/chat/ChatManager.ts
git commit -m "feat(chat): add registerAgent/dispatchToAgent/subscribeStream (additive)"
```

**验收**: ChatManager 通过 typecheck；新增 3 个方法不破坏现有调用方；runtime 5 核心各能 spawn 子 actor；scheduler 调度跑通；chat 流可挂载 agent brain。

---

## W5 — Insight 域 + Agent 域主流程 + D1 截屏问答

**主题**：4 个 Insight 文件 + Agent 17 文件 + D1 demo。

### Task W5.1 — `insight/` 4 文件

**Files**: `electron/insight/TraceCollector.ts`、`CostTracker.ts`、`TaskKanban.ts`、`AnomalyTimeline.ts`

- TraceCollector：startSpan / endSpan / getSpans / flush
- CostTracker：recordUsage（input/output/tokens/model）/ getTodayCost
- TaskKanban：listTasks / moveTask / completeTask
- AnomalyTimeline：addAnomaly / getRecentAnomalies
- ~800 行总计

**commit**:
```bash
git add electron/insight/
git commit -m "feat(insight): TraceCollector + CostTracker + TaskKanban + AnomalyTimeline"
```

### Task W5.2 — `agent/` 17 文件（核心 10 + 工具 7）

**Files**:
- 核心：`AgentBrain.ts` / `ParallelScheduler.ts` / `ExecutionEngine.ts` / `SubAgentSpawner.ts` / `ToolRegistry.ts` / `PromptBuilder.ts` / `ContextCompressor.ts` / `ToolSandboxAdapter.ts` / `RetryPolicy.ts` / `ErrorClassifier.ts`
- 工具：`AgentConfig.ts` / `AgentTypes.ts` / `AgentMetrics.ts` / `AgentLogger.ts` / `AgentEventBus.ts` / `AgentCheckpoint.ts` / `AgentRecovery.ts`

每个文件 100-300 行，总 ~3500 行。

**commit**（**每个核心 1 个 commit**）：
```bash
git add electron/agent/AgentBrain.ts electron/agent/AgentConfig.ts electron/agent/AgentTypes.ts
git commit -m "feat(agent): AgentBrain (主控 + 思维链) + 配置 + 类型"
# ... 16 more commits（合并核心与工具）
```

### Task W5.3 — D1 截屏问答 demo

**Files**: `electron/skill/builtin/D1ScreenshotQA.ts`、`src/views/D1ScreenshotDemo.vue`

- 用 Computer 域的 `ActionExecutor` 触发 `Cmd+Shift+S`（macOS）/ `PrintScreen`（Windows）
- 截图 → Agent 视觉理解 → 流式回答
- 借 `learning/SelfLearner.ts` 把高频截屏问答固化为 Skill

**commit**:
```bash
git add electron/skill/builtin/D1ScreenshotQA.ts src/views/D1ScreenshotDemo.vue
git commit -m "feat(demo): D1 截屏问答 (Computer 域 + Agent 视觉理解)"
```

**验收**: 截屏问答 1 次成功；Insight 看板 4 件套可用；`Cmd+Shift+S` 全局快捷键注册。

---

## W6 — Memory 扩展 + Skill 扩展 + D5 录屏转技能

**主题**：Hermes 1→8 + Skill 2→12 + D5 demo。

### Task W6.1 — `hermes/` 1→8 文件

**Files**:
- 保留：`HermesMemory.ts`（升级为 facade）
- 新建：`MemoryVectorStore.ts`（SQLite + sqlite-vss）/ `EmbeddingService.ts`（Ollama / OpenAI embedding）/ `DarwinianEvolver.ts`（记忆进化）/ `EvolutionABTester.ts`（A/B）/ `AutonomousCurator.ts`（自动策展）/ `KeywordRetriever.ts`（关键词检索）/ `VectorRetriever.ts`（向量检索）

总 ~2000 行。

**commit**（**facade 1 个，其余 7 个合并 1 个**）：
```bash
git add electron/hermes/HermesMemory.ts
git commit -m "refactor(hermes): HermesMemory → facade (additive, keep existing API)"
git add electron/hermes/MemoryVectorStore.ts electron/hermes/EmbeddingService.ts electron/hermes/DarwinianEvolver.ts electron/hermes/EvolutionABTester.ts electron/hermes/AutonomousCurator.ts electron/hermes/KeywordRetriever.ts electron/hermes/VectorRetriever.ts
git commit -m "feat(hermes): MemoryVectorStore + Embedding + Evolver + Curator + 2 retrievers"
```

### Task W6.2 — `skill/` 2→12 文件

**Files**:
- 保留：`SkillManager.ts`（**严格只追加** registerChain / importFromUrl 方法）/ `SkillLoader.ts`
- 新建：`SkillChain.ts` / `SkillSandbox.ts` / `SkillSigner.ts` / `SkillVersioning.ts` / `SkillWatcher.ts` / `AutoCreator.ts` / `HermesImporter.ts` / `OpenClawImporter.ts` / `ClawHubClient.ts` / `SkillMdStandard.ts`

总 ~2800 行。

**commit**（**每个新文件 1 个 commit**，合并 10 个为 3 个 commit）：
```bash
git add electron/skill/SkillManager.ts electron/skill/SkillChain.ts electron/skill/SkillSandbox.ts
git commit -m "feat(skill): SkillChain (组合) + SkillSandbox (隔离) + SkillManager 扩展"
# ... 2 more
```

### Task W6.3 — `learning/SkillEffectivenessTracker.ts`

**Files**: `electron/learning/SkillEffectivenessTracker.ts`

- 追踪：调用次数 / 成功率 / 平均耗时 / 用户满意度评分
- 写 `~/.pipiclaw/skill-stats.json`
- ~250 行

**commit**:
```bash
git add electron/learning/SkillEffectivenessTracker.ts
git commit -m "feat(learning): SkillEffectivenessTracker (调用追踪 + 满意度)"
```

### Task W6.4 — D5 录屏转技能 demo

**Files**: `electron/skill/builtin/D5RecordingToSkill.ts`、`src/views/D5RecordingToSkill.vue`

- 录屏（用 `ScreenVision` 截帧）
- `AutoCreator` 生成 SKILL.md
- `SkillSigner` 签名
- 入库

**commit**:
```bash
git add electron/skill/builtin/D5RecordingToSkill.ts src/views/D5RecordingToSkill.vue
git commit -m "feat(demo): D5 录屏转技能 (Computer + AutoCreator + Signer)"
```

**验收**: D5 录屏能生成 SKILL.md；Memory 向量检索 < 100ms；技能链能组合 3 技能；SkillManager 现有调用方不被破坏。

---

## W7 — Channel 域 + IM 11 通道 + Content 域 + D3

**主题**：21 个 Channel 文件 + 9 个 Content 文件 + D3 demo。

### Task W7.1 — `channel/` 基础 8 文件

**Files**: `electron/channel/index.ts` / `ChannelTypes.ts` / `ChannelRouter.ts` / `IMConfigStore.ts` / `IMMessageStore.ts` / `IMMessageRouter.ts` / `IMPermissionManager.ts` / `IMSecurityManager.ts`

- Channel 接口：`id / send / onMessage / healthCheck`
- ChannelRouter：路由 + 鉴权 + 优先级
- IMConfigStore：各通道鉴权信息存储
- ~1500 行

**commit**:
```bash
git add electron/channel/
git commit -m "feat(channel): base 8 files (Types/Router/Config/Message/Permission/Security)"
```

### Task W7.2 — IM 11 通道（按 W7.3 决策，**只接 3 个**：飞书 / 钉钉 / 企微）

**Files**:
- 必接：`FeishuChannel.ts` / `DingTalkChannel.ts` / `WechatWorkChannel.ts`
- 占位（接口完整但 SDK 留空）：`WeChatChannel.ts` / `QQChannel.ts` / `TelegramChannel.ts` / `SlackChannel.ts` / `DiscordChannel.ts` / `WhatsAppChannel.ts` / `LarkChannel.ts` / `RocketChannel.ts`

每个通道 200-400 行；11 通道总 ~3500 行。

**commit**（**每通道 1 commit**）：
```bash
git add electron/channel/FeishuChannel.ts
git commit -m "feat(channel): FeishuChannel (飞书 IM)"
# ... 10 more
```

### Task W7.3 — `contentgen/` 9 文件

**Files**:
- 文档渲染 4：`DocxRenderer.ts` / `PdfRenderer.ts` / `PptxRenderer.ts` / `XlsxRenderer.ts`
- 图像生成 1：`ImageGenHandler.ts`
- 格式转换 6：`md2docx.ts` / `md2pdf.ts` / `md2pptx.ts` / `md2xlsx.ts` / `html2pdf.ts` / `html2pptx.ts`

总 ~2000 行。

**commit**（**3 批**：渲染 4 + 图像 1 + 转换 6）：
```bash
git add electron/contentgen/DocxRenderer.ts electron/contentgen/PdfRenderer.ts electron/contentgen/PptxRenderer.ts electron/contentgen/XlsxRenderer.ts
git commit -m "feat(contentgen): 4 doc renderers (docx/pdf/pptx/xlsx)"
git add electron/contentgen/ImageGenHandler.ts
git commit -m "feat(contentgen): ImageGenHandler (DALL-E/SD/即梦/通义万相代理)"
git add electron/contentgen/md2docx.ts electron/contentgen/md2pdf.ts electron/contentgen/md2pptx.ts electron/contentgen/md2xlsx.ts electron/contentgen/html2pdf.ts electron/contentgen/html2pptx.ts
git commit -m "feat(contentgen): 6 format converters"
```

### Task W7.4 — D3 一句话远程 demo

**Files**: `electron/skill/builtin/D3RemoteCommand.ts`、`src/views/D3RemoteDemo.vue`

- 飞书发消息"帮我查今天日程" → `ChannelRouter` 路由 → `AgentBrain` 调 `CalendarConnector` → 回复飞书

**commit**:
```bash
git add electron/skill/builtin/D3RemoteCommand.ts src/views/D3RemoteDemo.vue
git commit -m "feat(demo): D3 一句话远程 (Channel + Agent + Connector)"
```

**验收**: 飞书发消息能调度 Agent；D3 demo 1 次成功；4 个文档渲染各自跑通 1 次。

---

## W8 — Computer 域 + A5 demo

**主题**：3 个 Computer 文件 + A5 最小可用 demo。

### Task W8.1 — `computeruse/` 3 文件

**Files**:
- `ScreenVision.ts`：截屏 + OCR + 图像理解（调 Ollama Vision / OpenAI GPT-4V）
- `ActionExecutor.ts`：鼠标键盘执行（底层用 `BrowserManager.ts` 的 Playwright + 系统级 API）
- `ComputerUseHandler.ts`：统一处理入口（看屏幕 → 决策 → 执行）

总 ~400 行。

**commit**:
```bash
git add electron/computeruse/
git commit -m "feat(computer): ScreenVision + ActionExecutor + ComputerUseHandler"
```

### Task W8.2 — A5 Computer Use v1 最小 demo

**Files**: `electron/skill/builtin/A5ComputerUse.ts`、`src/views/A5ComputerUseDemo.vue`

- Agent 看屏幕截图 → 决定点击坐标 → `ActionExecutor` 执行
- 不做完整学习（仅最小决策循环）

**commit**:
```bash
git add electron/skill/builtin/A5ComputerUse.ts src/views/A5ComputerUseDemo.vue
git commit -m "feat(demo): A5 Computer Use v1 (最小决策循环)"
```

**验收**: A5 真跑通 1 次；3 OS 各跑通 L1 隔离 1 次。

---

## W9 — P7 沙盒基础

**主题**：dockerDetector + L1 隔离 + workspace + base 镜像。

### Task W9.1 — `sandbox/dockerDetector.ts`

**Files**: `sandbox/dockerDetector.ts`

- 检测 6 状态：available / available-no-compose / not-installed / daemon-down / permission-denied / unsupported
- 提供 `installUrlFor(platform)` 返回官方下载链接
- **只探测，不安装**

**commit**:
```bash
git add electron/sandbox/dockerDetector.ts
git commit -m "feat(sandbox): dockerDetector (6 状态探测 + 安装 URL)"
```

### Task W9.2 — `sandbox/SandboxL1.ts`（3 平台 L1 隔离）

**Files**: `sandbox/SandboxL1.ts`、`sandbox/l1/seatbelt.ts`、`l1/bwrap.ts`、`l1/windowsJob.ts`

- macOS：`sandbox-exec -p <profile>` profile 含 deny-write / deny-network / allow-read-only
- Linux：`bwrap --ro-bind / --bind $cwd --unshare-net --unshare-pid`
- Windows：Job Object（本期 macOS/Linux 优先，Windows 留占位）
- 总 ~250 行

**commit**:
```bash
git add electron/sandbox/SandboxL1.ts electron/sandbox/l1/
git commit -m "feat(sandbox): L1 process isolation (seatbelt/bwrap/windows-job)"
```

### Task W9.3 — `sandbox/workspace.ts`（/mnt/data 统一目录）

**Files**: `sandbox/workspace.ts`

- createWorkspace / listWorkspaces / getWorkspace
- hostPath = `app.getPath('userData')/sandboxes/<id>/mnt`
- containerPath = `/mnt/data`
- ~100 行

**commit**:
```bash
git add electron/sandbox/workspace.ts
git commit -m "feat(sandbox): workspace abstraction (host path <-> /mnt/data)"
```

### Task W9.4 — base 镜像 Dockerfile + build 脚本

**Files**: `sandbox/base/Dockerfile`、`scripts/sandbox-base-build.mjs`

- Dockerfile：ubuntu:24.04 + node 22 + python 3.12 + java 21 + go 1.23 + 国内镜像源
- build 脚本：`docker build -t pipiclaw/sandbox-base:latest -f sandbox/base/Dockerfile sandbox/base/`
- 在 `package.json` 加 `"sandbox:build-base": "node scripts/sandbox-base-build.mjs"`

**commit**:
```bash
git add sandbox/base/ scripts/sandbox-base-build.mjs package.json
git commit -m "feat(sandbox): self-built base image (ubuntu 24.04 + 4 langs + cn mirrors)"
```

**验收**: base 镜像构建成功；3 OS 各跑通 L1 隔离 1 次；workspace 抽象 typecheck 通过。

---

## W10 — P7 镜像构建器 + 网络白名单 + 资源限额

**主题**：4 模板 + builder + networkPolicy + resourceLimits + selfcheck。

### Task W10.1 — `sandbox/SandboxBuilder.ts` + 4 模板

**Files**: `sandbox/SandboxBuilder.ts`、`sandbox/templates/{vite-react-ts,nextjs-app,fastapi,go-http}.yaml`、`sandbox/templates/index.ts`

- Builder 接口：`build(workspace, prompt): Promise<BuildResult>`
- 模板选择：正则匹配（`/vite|react|spa|前端|博客|blog/i` 等）
- 4 模板：vite-react-ts (5173) / nextjs-app (3000) / fastapi (8000) / go-http (8080)
- ~400 行

**commit**:
```bash
git add electron/sandbox/SandboxBuilder.ts electron/sandbox/templates/
git commit -m "feat(sandbox): SandboxBuilder + 4 templates (vite/next/fastapi/go)"
```

### Task W10.2 — `sandbox/networkPolicy.ts` + `sandbox/resourceLimits.ts`

**Files**: `sandbox/networkPolicy.ts`、`sandbox/resourceLimits.ts`

- networkPolicy：包管理镜像白名单（npm/pypi/maven/goproxy cn）+ AI 模型 API 通过 settings 配置
- resourceLimits：CPU 2 核 / 内存 4GB / 磁盘 10GB / 超时 30min / 并发 3
- ~150 行

**commit**:
```bash
git add electron/sandbox/networkPolicy.ts electron/sandbox/resourceLimits.ts
git commit -m "feat(sandbox): network whitelist + resource limits (2cpu/4gb/10gb/30min)"
```

### Task W10.3 — `scripts/sandbox-selfcheck.mjs`

**Files**: `scripts/sandbox-selfcheck.mjs`、`package.json`

- 5 检查：docker installed / docker daemon up / base image exists / can run hello / self-test L1
- 在 `package.json` 加 `"sandbox:selfcheck": "node scripts/sandbox-selfcheck.mjs"`

**commit**:
```bash
git add scripts/sandbox-selfcheck.mjs package.json
git commit -m "chore(sandbox): selfcheck script + CI gate"
```

**验收**: `npm run sandbox:selfcheck` 5/5 ok；模板选择准确率 ≥ 80%。

---

## W11 — P7 预览 + 端口转发 + Jupyter + D2-Prime

**主题**：WebContainerRunner + PortForwarder + JupyterRunner + D2-Prime 旗舰 demo。

### Task W11.1 — `sandbox/WebContainerRunner.ts`

**Files**: `sandbox/WebContainerRunner.ts`

- 集成 `@webcontainer/api`（新增 dep）
- boot() / mount(files) / spawn(cmd) / on('server-ready')
- 前端类项目走 L3（零容器）
- ~150 行

**commit**:
```bash
git add electron/sandbox/WebContainerRunner.ts package.json
git commit -m "feat(sandbox): WebContainer integration (frontend SPA, zero resources)"
```

### Task W11.2 — `sandbox/PortForwarder.ts`

**Files**: `sandbox/PortForwarder.ts`、`sandbox/proxy.ts`

- forwardPort(containerPort) → hostPort + url
- proxy.ts：HTTP 代理到容器
- listForwarded / closeForward
- ~200 行

**commit**:
```bash
git add electron/sandbox/PortForwarder.ts electron/sandbox/proxy.ts
git commit -m "feat(sandbox): port forwarding with iframe preview"
```

### Task W11.3 — `sandbox/JupyterRunner.ts`

**Files**: `sandbox/JupyterRunner.ts`

- startKernel(workspaceId) / execute(code) / close
- 调 ipython 或 jupyter client
- ~120 行

**commit**:
```bash
git add electron/sandbox/JupyterRunner.ts
git commit -m "feat(sandbox): Jupyter kernel mode (script execution)"
```

### Task W11.4 — `sandbox/SandboxLifecycle.ts` + `sandbox/SandboxAgentTool.ts`

**Files**: `sandbox/SandboxLifecycle.ts`、`sandbox/SandboxAgentTool.ts`

- Lifecycle：idle stop 30min / cleanup 24h
- AgentTool：把 `p7_scaffold_project` 暴露为 Agent 工具
- ~200 行

**commit**:
```bash
git add electron/sandbox/SandboxLifecycle.ts electron/sandbox/SandboxAgentTool.ts
git commit -m "feat(sandbox): lifecycle (idle 30min/cleanup 24h) + Agent tool"
```

### Task W11.5 — D2-Prime 项目骨架搭建 demo（旗舰）

**Files**: `electron/skill/builtin/D2PrimeScaffold.ts`、`src/views/D2PrimeDemo.vue`

- 用户说"做一个 Vite + React + TS 博客"
- AI 解析 → 选模板 → 沙盒内脚手架 → 启 dev server → Inspector 实时预览
- 30s 内出预览（前端类走 L3 WebContainer，0 容器）

**commit**:
```bash
git add electron/skill/builtin/D2PrimeScaffold.ts src/views/D2PrimeDemo.vue
git commit -m "feat(demo): D2-Prime 项目骨架搭建 (P7 旗舰)"
```

**验收**: D2-Prime 真跑通（Vite + React 30s 内出预览）；前端项目走 L3 零资源。

---

## W12 — 集成 + 测试 + CI + 灰度 + GA

**主题**：vitest 14 unit + playwright 10 e2e + 集成 5 链路 + CI + GA v2.0.0。

### Task W12.1 — vitest unit 14 测试

**Files**: `tests/unit/{ChatManager,AgentBrain,SandboxBuilder,WebContainerRunner,PortForwarder,ResourceLimits,NetworkPolicy,Workspace,DockerDetector,SkillEffectivenessTracker,CapabilityRegistry,MessageQueue,Conversation,Scheduler}.test.ts`

- 每个域 1-2 个关键类，写 5-10 个 test
- 覆盖：正常路径 + 错误路径 + 边界

**commit**:
```bash
git add tests/unit/
git commit -m "test(unit): 14 vitest tests covering 8 capability domains"
```

### Task W12.2 — playwright e2e 10 测试

**Files**: `tests/e2e/{d2prime-screenshot,d2prime-30s,d2prime-docker-missing,d2prime-oom,d2prime-port-conflict,chat-agent,d3-feishu,a5-computer-use,insight-trace,settings-p7}.spec.ts`

- D2-Prime 1 + D2-Prime 3 错误路径 + chat 接 Agent + D3 飞书 + A5 + Insight + Settings P7 入口
- 录屏归档

**commit**:
```bash
git add tests/e2e/
git commit -m "test(e2e): 10 playwright e2e covering D2-Prime + 3 errors + 8 domains"
```

### Task W12.3 — 集成 5 链路

**Files**: `tests/integration/{chat-to-agent,channel-to-agent,insight-trace,skill-record-to-store,d2prime-end-to-end}.test.ts`

- 链路 1：Chat → Agent → Tool
- 链路 2：Channel → Agent → 飞书回复
- 链路 3：任何调用 → Insight trace
- 链路 4：Skill 录制 → 入库
- 链路 5：D2-Prime 端到端（拼 e2e）

**commit**:
```bash
git add tests/integration/
git commit -m "test(integration): 5 cross-capability user journeys"
```

### Task W12.4 — `.github/workflows/ci.yml`

**Files**: `.github/workflows/ci.yml`

- 7 step：install / typecheck / lint / test / build / sandbox:selfcheck / e2e
- macOS / Windows / Linux 3 平台矩阵

**commit**:
```bash
git add .github/workflows/ci.yml
git commit -m "ci: full pipeline (typecheck/lint/test/build/sandbox/e2e) × 3 OS"
```

### Task W12.5 — release-checklist.mjs + sync-readme

**Files**: `scripts/release-checklist.mjs`、`scripts/sync-readme-numbers.mjs`

- release-checklist：7 步全跑，0 错才能 GA
- sync-readme：自动从真实测试数更新 README 数字

**commit**:
```bash
git add scripts/release-checklist.mjs scripts/sync-readme-numbers.mjs
git commit -m "chore(release): checklist + sync README numbers from real tests"
```

### Task W12.6 — alpha 5 人内测

**Files**: `docs/release/alpha-notes.md`

- 邀请 5 个内部用户跑全 6 个 demo
- 收集 bug + 体验问题
- 修完所有 blocker

**commit**:
```bash
git add docs/release/alpha-notes.md
git commit --allow-empty -m "chore: alpha-1 complete; 5 blockers fixed"
```

### Task W12.7 — 灰度 5% + GA v2.0.0

**Files**: `package.json:version`、`CHANGELOG.md`

- v2.0.0：1.0.0 → 2.0.0
- 灰度 tag `v2.0.0-rc.1` → 监控崩溃率 → GA tag `v2.0.0`
- CHANGELOG v2.0.0

**commit + tag**:
```bash
# bump version
git add package.json
git commit -m "chore(release): v2.0.0"
git tag -a v2.0.0-rc.1 -m "5% rollout"
# 3 天后
git tag -a v2.0.0 -m "PiPiClaw 2.0.0 — 8 能力域 + P7 沙盒 GA"
git push origin v2.0.0
```

**验收**: e2e 100% pass；CI 绿灯；v2.0.0 tag 推到 origin。

---

## 关键约定（贯穿全 12 周）

### Commit 约定
- 每次 task 1 commit（最多 2-3 commit）
- 中文 / 英文 commit message 都行，**简洁说明**
- 不允许把"主功能 + 杂项改动"混在一个 commit

### 路径约定
- 所有路径相对 repo root
- subagent prompt 显式给 `process.env.ROOT_DIR` 而不写绝对路径
- 跨用户 / CI 通用

### 测试约定
- `npm run test` = vitest unit
- `npm run e2e` = playwright
- `npm run typecheck` = vue-tsc --noEmit
- `npm run lint` = eslint . --fix
- `npm run sandbox:selfcheck` = sandbox 5 检查

### 反模式守卫
- **禁止重写 1.0.0 已有 .ts**（反模式 4）→ 只能追加方法 / 新建文件
- **禁止沙盒静默降级**（反模式 3）→ 显式失败 + 显式引导
- **禁止 mock 演示链路** → 真实跑通

---

## 风险缓冲

W13 弹性周（如果 W12 GA 没做完，留 1 周；否则启动 P3 离线 + Hermes 深度 + Computer 加固迭代）。

---

## 执行 Handoff

Plan 已写入 [2026-07-10-pipiclaw-v2-plan.md](file:///d:/pipiclaw/piclaw/docs/superpowers/plans/2026-07-10-pipiclaw-v2-plan.md)。

**两种执行方式，请你选**：

### 选项 1 — Subagent-Driven（推荐）
每个 task 派一个 subagent 去做，做完我审过再派下一个。迭代快、上下文清晰。**适合 35+ 任务规模**。

### 选项 2 — Inline Execution
当前会话内连续执行，批量 + 检查点。**轻量任务友好，但本计划 35+ 任务用此法上下文会爆**。

我推荐 **选项 1**。回 "1" 启动 subagent-driven-development；回 "2" 启动 executing-plans；回 "改 X" 我调整后再问。
