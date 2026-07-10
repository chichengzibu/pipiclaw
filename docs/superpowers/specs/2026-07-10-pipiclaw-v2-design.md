# PiPiClaw v2 设计规范 — 从 1.0.0 推到 100% 可发布

## 段 1: 一句话原则

1.0.0 origin 已经完成 60% 的桌面 AI 助手骨架：38 个真实 .ts 实现、12 view + 12 store + 16 component、`electron/core/IpcServer.ts` 1592 行、`electron/learning/SelfLearner.ts` 830 行、`electron/models/ModelManager.ts` 6+ provider、`electron/browser/BrowserManager.ts` Playwright 封装、`electron/openclaw/` HTTP 18789 通道、`electron/hermes/HermesMemory.ts` USER.md + MEMORY.md 两层记忆。本期 v2 的目标只有一个——把这 60% 推到 100% 可发布：补齐 8 个能力域的缺失骨架、保留并接续 1.0.0 全部真实实现、翻新视觉到 Apple HIG、落地 P7 本地沙盒旗舰 demo D2-Prime、用 vitest + Playwright 把测试覆盖率从 1 个 `.test.js` 提到合理水位。

## 段 2: 三条不可妥协准则

### 准则 1 — 演示 = 真实
1.0.0 `electron/` 下 38 个 .ts 全部是真实实现，没有 mock、没有 stub、没有 console.log 占位。`core/IpcServer.ts` 1592 行、`learning/SelfLearner.ts` 830 行、`chat/` 三件套（ChatManager/ChatConfig/ChatTypes）约 600 行、`models/` 三件套 6+ provider 适配、`browser/BrowserManager.ts` Playwright 封装、`openclaw/` HTTP 18789 真实服务——这些是演示的底座。本期延续这个原则：所有 D2-Prime、D3 一句话远程、D5 录屏转技能的演示链路必须**真实跑通**，不靠预录视频、不靠 mock 数据、不靠"假装成功"的 toast。W11 集成阶段要求 Playwright e2e 在 CI 真跑 D2-Prime 端到端，不能只跑单测。

### 准则 2 — 用户级 = 演示级
1.0.0 12 view 每一个都是真用户场景：Dashboard.vue（总览）、Chat.vue（对话）、Tasks.vue（任务）、SkillsView.vue（已装技能）、SkillMarket.vue（技能市场）、PluginMarket.vue（插件市场）、Models.vue（模型）、Permissions.vue（权限）、Schedule.vue（调度）、RemoteControl.vue（远程）、Settings.vue（设置）、Help.vue（帮助）。本期每一个能力（A1–A9、D1–D6）的 demo 都必须能让一个陌生用户独立使用、独立复现、独立验收。不能在演示里塞"开发者模式开关"绕过用户校验，也不能在演示路径里写只有开发机才有的环境变量。

### 准则 3 — 本地 ≥ 云端
1.0.0 `electron/models/ModelManager.ts` 已挂 6+ provider（OpenAI / Anthropic / Gemini / DeepSeek / 智谱 / Ollama），其中 OllamaProvider 是本地代表。本期加固"本地优先"：D4 本地模型 demo 必须引导用户下载 Ollama + 推荐模型（qwen2.5-coder:7b / llama3.1:8b / deepseek-coder-v2:16b），D2-Prime 沙盒执行完全离线可行（本地模型 + 国内 npm/pip/maven/goproxy 镜像），A8 ⌘K 万能入口的所有快捷操作默认走本地模型兜底。云端仅作为可选加速通道，Settings 里默认关闭。

## 段 3: 反模式（5 条）

### 反模式 1 — 不做"AI 搜索"
不和 Perplexity / 秘塔 / Kimi 探索版抢查询场景。1.0.0 `electron/browser/BrowserManager.ts` 已经能调 Playwright 真开网页，要做"搜索"直接调浏览器拿结果即可，不要自建搜索引擎壳。本期 A8 ⌘K 万能入口不内置网页搜索框，留给浏览器新标签页。Insight 域的 TraceCollector 不记录"用户搜了什么"，避免误判为搜索工具。

### 反模式 2 — 不做"AI 绘画"为主业
1.0.0 `electron/contentgen/` 完全空缺，本期要建 `contentgen/` 但范围严格收窄：`DocxRenderer / PdfRenderer / PptxRenderer / XlsxRenderer` 四大办公文档渲染是办公自动化刚需；`ImageGenHandler` 仅作为 Skill 调用出口（接 DALL-E / Stable Diffusion / 即梦 / 通义万相等外部 API），不内置模型权重、不做主交互面板。理由：图像生成的本地化（CivitAI + SD WebUI + ControlNet）在桌面端已经有成熟方案，再造轮子收益低。

### 反模式 3 — 不做"沙盒兜底静默执行"
P7 沙盒必须**显式失败 + 显式引导**：`sandbox/dockerDetector.ts` 检测到无 Docker 时不能静默降级到"直接跑"，而必须出红 banner（"未检测到 Docker，P7 沙盒不可用"）+ 阻塞执行入口 + 一键打开安装教程。本期 v2 的硬约束：用户**任何时刻都能区分"我在沙盒里跑"和"我在本机裸跑"**。同理：容器 OOM、端口冲突、L1 隔离失败、镜像下载失败，全部走显式错误路径，不静默重试、不静默降级、不静默回退到 L0（直接在本机 Node 跑）。

### 反模式 4 — 不做"1.0.0 已实现代码的纯重写"
保留 1.0.0 全部真实实现：38 个 `electron/.ts`、12 view、12 store、16 component、`core/IpcServer.ts` 1592 行、`learning/SelfLearner.ts` 830 行、`chat/` 三件套、`models/` 三件套 6+ provider、`browser/BrowserManager.ts`、`openclaw/` 三件套、`hermes/HermesMemory.ts`、`task/` 七件套、`permissions/` 三件套、`core/` 九件套、`utils/` + `types/`。本期只允许：(a) 在已有文件内追加新能力（如 `ChatManager` 新增 `registerAgent(brain)` 方法）；(b) 在已有目录下新增文件（如 `learning/` + `SkillEffectivenessTracker.ts`）；(c) 删 `gateway/`。**禁止**整文件重写、禁止重命名包路径、禁止"为了架构统一"破坏向后兼容。

### 反模式 5 — 不做"runtime/ 大而全的 79 文件复制"
`runtime/` 子系统按需逐步建，本期先建 5 个核心：`actor/`（Actor 模型 + 消息队列）/ `bridge/`（IPC + HTTP 桥）/ `conversation/`（会话状态机）/ `scheduler/`（任务调度）/ `skill/`（技能运行时）。其余 `memory/ persistence/ event/ security/ config/ lifecycle/ observability/` 7 个子系统作为占位空目录 + README 占位，留到 v2.1/v2.2 再补。理由：`runtime/` 是 v2 架构的"骨架"，骨架过早膨胀会让 Agent 域 17 文件、Skill 域 12 文件、Channel 域 21 文件失去焦点。本期 v2 一旦在 W4 把 5 个核心跑通，W5–W11 就有能力承载 8 能力域。

## 段 4: 8 能力域蓝图（核心）

| 能力域 | 1.0.0 已有 | 本期新建 | 接入点 |
|---|---|---|---|
| **Chat** | `chat/ChatManager.ts` / `chat/ChatConfig.ts` / `chat/ChatTypes.ts`（3 文件, ~600 行）；`src/views/Chat.vue` 接入 chat store；`hermes/HermesMemory.ts` 已有 user/assistant 两层 | 扩 `ChatManager`：`registerAgent(brain)` / `dispatchToAgent(msg)` / `subscribeStream(handler)`；扩 `ChatTypes`：`AgentMessage` / `ToolCallMessage` / `StreamChunk` 三种新消息类型；`src/views/Chat.vue` 翻新 Apple HIG 视觉 + ⌘K 入口 | → Agent；→ HermesMemory；→ Tool |
| **Agent** | (空) | `agent/AgentBrain.ts`（主控 + 思维链）/ `ParallelScheduler.ts`（并行子任务）/ `ExecutionEngine.ts`（工具调用循环）/ `SubAgentSpawner.ts`（派生）/ `ToolRegistry.ts`（工具注册表）/ `PromptBuilder.ts`（系统提示组装）/ `ContextCompressor.ts`（上下文压缩）/ `ToolSandboxAdapter.ts`（沙盒适配）/ `RetryPolicy.ts`（重试策略）/ `ErrorClassifier.ts`（错误分类）/ `AgentConfig.ts` / `AgentTypes.ts` / `AgentMetrics.ts` / `AgentLogger.ts` / `AgentEventBus.ts` / `AgentCheckpoint.ts` / `AgentRecovery.ts`（17 文件, ~3500 行） | ← Chat；→ Tool；→ HermesMemory；→ Skill；→ Channel；→ Computer；→ Content；→ Connector；→ P7 Sandbox |
| **Memory (Hermes)** | `hermes/HermesMemory.ts`（1 文件, USER.md + MEMORY.md 两层 Markdown 文件存储） | + `MemoryVectorStore.ts`（向量存储 SQLite + sqlite-vss）/ `EmbeddingService.ts`（Ollama / OpenAI embedding）/ `DarwinianEvolver.ts`（达尔文式记忆进化）/ `EvolutionABTester.ts`（A/B 测试记忆效果）/ `AutonomousCurator.ts`（自动策展低价值记忆）/ `KeywordRetriever.ts`（关键词检索）/ `VectorRetriever.ts`（向量检索）；`HermesMemory.ts` 保留并升级为入口 facade；总计 1 → 8 文件, 估算 ~2000 行 | ← Agent；← Chat；← Learning（`SelfLearner.ts` 调用 `AutonomousCurator`） |
| **Skill** | `skill/SkillManager.ts`（执行入口 + 简化 `executeSkill`，TODO）/ `skill/SkillLoader.ts`（本地技能加载；`importSkillFromUrl` 未实现，TODO） | + `SkillChain.ts`（技能链组合）/ `SkillSandbox.ts`（技能沙盒隔离）/ `SkillSigner.ts`（技能签名校验）/ `SkillVersioning.ts`（版本管理）/ `SkillWatcher.ts`（文件监听自动重载）/ `AutoCreator.ts`（Agent 自动生成技能）/ `HermesImporter.ts`（从 Hermes 记忆导入）/ `OpenClawImporter.ts`（从 openclaw 远程导入）/ `ClawHubClient.ts`（技能仓库客户端）/ `SkillMdStandard.ts`（SKILL.md 规范）；2 → 12 文件, 估算 ~2800 行 | ← Agent；→ Learning；→ P7 Sandbox |
| **Channel** | `openclaw/OpenClawServer.ts`（HTTP 18789）/ `openclaw/OpenClawGateway.ts` / `openclaw/OpenClawExecutor.ts`；`gateway/GatewayManager.ts` / `MessageGateway.ts` / `GatewayConfig.ts` / `GatewayStatus.ts`（**4 文件要删**，与 openclaw 重复） | IM 11 通道（`WeChatChannel.ts` / `FeishuChannel.ts` / `DingTalkChannel.ts` / `QQChannel.ts` / `TelegramChannel.ts` / `SlackChannel.ts` / `DiscordChannel.ts` / `WhatsAppChannel.ts` / `LarkChannel.ts` / `RocketChannel.ts` / `WechatWorkChannel.ts`）+ `ChannelTypes.ts` + `ChannelRouter.ts` + `FileTransferManager.ts` + `IMConfigStore.ts` + `IMMessageStore.ts` + `IMMessageRouter.ts` + `IMPermissionManager.ts` + `IMSecurityManager.ts` + `RichMediaParser.ts` + `GroupRouter.ts` + `OfflineQueue.ts`；估算 21 文件 ~5000 行 | ← Agent；← Task（任务编排）；→ Insight |
| **Computer** | (空) | `computeruse/ScreenVision.ts`（屏幕截取 + OCR + 图像理解）/ `computeruse/ActionExecutor.ts`（鼠标键盘执行）/ `computeruse/ComputerUseHandler.ts`（统一处理入口）；3 文件 ~400 行；底层复用 `BrowserManager.ts` 的 Playwright + 系统级截图 API | ← Agent；← Skill（录屏转技能 D5） |
| **Content (ContentGen)** | (空) | `contentgen/DocxRenderer.ts` / `PdfRenderer.ts` / `PptxRenderer.ts` / `XlsxRenderer.ts`（4 个文档渲染，~1400 行）/ `contentgen/ImageGenHandler.ts`（图像生成代理 ~150 行）+ 6 个格式转换器（`md2docx.ts` / `md2pdf.ts` / `md2pptx.ts` / `md2xlsx.ts` / `html2pdf.ts` / `html2pptx.ts`，~600 行）；9 文件 ~2000 行 | ← Agent；← Connector（导出到 Notion/GitHub） |
| **Insight** | (空) | `insight/TraceCollector.ts`（链路追踪，每工具调用、每 LLM 调用、每容器操作留 trace）/ `insight/CostTracker.ts`（token + 美元成本）/ `insight/TaskKanban.ts`（任务看板，集成 `task/`）/ `insight/AnomalyTimeline.ts`（异常时间线，容器失败 / 工具超时 / LLM 错误可视化）；4 文件 ~800 行 | ← 全部 8 域 |
| **Connector** | (空) | `connector/CalendarConnector.ts` / `EmailConnector.ts` / `FileConnector.ts` / `GitHubConnector.ts` / `KnowledgeConnector.ts` / `NotionConnector.ts`；6 文件 ~1500 行；统一接口 `Connector.execute(intent, ctx)` | ← Agent；→ Content（导出） |
| **P7 Sandbox** | (空) | `sandbox/dockerDetector.ts` / `sandbox/SandboxL1.ts`（macOS Seatbelt / Linux bubblewrap / Windows Job Object）/ `sandbox/SandboxBuilder.ts` / `sandbox/SandboxExecutor.ts` / `sandbox/WebContainerRunner.ts` / `sandbox/PortForwarder.ts` / `sandbox/JupyterRunner.ts` / `sandbox/SandboxLifecycle.ts` / `sandbox/SandboxAgentTool.ts` / `sandbox/SandboxConfig.ts` / `sandbox/SandboxTypes.ts` / `sandbox/SandboxLogger.ts` / `sandbox/SandboxAuditLog.ts` + base 镜像 Dockerfile + 2 脚本（`scripts/sandbox-base-build.mjs` + `scripts/sandbox-selfcheck.mjs`）；14 文件 ~3500 行 + 2 脚本 | ← Agent；→ Insight；→ Skill（技能沙盒） |

### 关键接口签名（域间契约）

```ts
// Agent 域入口
interface AgentBrain {
  think(ctx: AgentContext): Promise<Decision>;
  call(tool: ToolCall): Promise<ToolResult>;
  spawn(subtask: SubTask): Promise<SubAgent>;
  checkpoint(): Promise<string>;
  restore(id: string): Promise<void>;
}

// Memory 域入口（保留 HermesMemory 作为 facade）
interface HermesMemory {
  recall(query: string, opts?: RecallOptions): Promise<Memory[]>;
  store(memory: Memory): Promise<void>;
  curate(): Promise<CuratorReport>;
  evolve(): Promise<EvolutionReport>;
}

// Skill 域入口
interface Skill {
  name: string;
  signature: string;
  execute(input: SkillInput, ctx: SkillContext): Promise<SkillOutput>;
}

// Channel 域入口
interface Channel {
  id: string;
  send(msg: ChannelMessage): Promise<void>;
  onMessage(handler: MessageHandler): Disposable;
  healthCheck(): Promise<ChannelHealth>;
}

// P7 Sandbox 域入口
interface Sandbox {
  execute(cmd: string, opts?: ExecOptions): Promise<ExecResult>;
  preview(): Promise<PreviewURL>;
  stop(): Promise<void>;
  audit(): Promise<AuditEntry[]>;
}

// Connector 域入口
interface Connector {
  id: string;
  execute(intent: ConnectorIntent, ctx: ConnectorContext): Promise<ConnectorResult>;
}

// Insight 域入口
interface TraceCollector {
  startSpan(name: string, attrs?: Record<string, unknown>): Span;
  endSpan(span: Span, result?: unknown): void;
}
```

## 段 5: 8 能力域外的"已存在子系统"清单

1.0.0 已有但**不属于 8 能力域**的子系统，本期**保留不动**，仅在必要时扩展：

- **`electron/core/`**（9 文件）：`WindowManager.ts` / `IpcServer.ts`（1592 行，主进程 IPC 骨干）/ `ConfigStore.ts`（用户配置）/ `LogManager.ts`（日志）/ `TrayManager.ts`（系统托盘）/ `MiniWindow.ts`（迷你浮窗）/ `GlobalShortcut.ts`（全局快捷键）/ `ProcessManager.ts`（子进程）/ `Constants.ts`。本期保留，仅在 `IpcServer.ts` 补完 `mcp:test` 桩为真实 MCP 协议握手。**禁止重写**。
- **`electron/learning/SelfLearner.ts`**（830 行，自学习引擎）：保留，作为新文件 `SkillEffectivenessTracker.ts` 的上游消费者；不改名（保持原路径），新文件加在同目录。
- **`electron/learning/`**：保留 `SelfLearner.ts`；新建 `SkillEffectivenessTracker.ts`（追踪技能调用成功率、平均耗时、用户满意度评分，约 250 行）。
- **`electron/models/`**（3 文件）：`ModelManager.ts`（6+ provider：OpenAI / Anthropic / Gemini / DeepSeek / 智谱 / Ollama）/ `ModelConfig.ts` / `ModelProvider.ts`。本期保留，仅扩 `OllamaProvider` 的模型推荐元数据（用于 D4 demo 引导下载 qwen2.5-coder:7b 等）。
- **`electron/permissions/`**（3 文件）：`PermissionManager.ts` / `PermissionConfig.ts` / `PermissionTypes.ts`。本期作为 Agent / Channel / P7 三个域的统一权限后端，新增"容器创建 / 端口暴露 / 网络策略变更"三类权限定义。
- **`electron/task/`**（7 文件）：`TaskExecutor.ts` / `InstructionGenerator.ts` / `ContentValidator.ts` / `ScheduleTask.ts` / `TaskLog.ts` / `TaskTypes.ts` / `TaskExecutionMode.ts`。本期**作为 Agent 域的执行后端**（`AgentBrain.ts` → `TaskExecutor.ts` → `ScheduleTask.ts`），Insight 域的 `TaskKanban.ts` 直接读 `TaskLog.ts`。
- **`electron/browser/`**（1 文件）：`BrowserManager.ts`（Playwright 封装）。本期保留，Computer 域的 `ActionExecutor.ts` 复用其 click / type / screenshot API。
- **`electron/utils/`**（2 文件）：`FileParser.ts`（文件解析）/ `ConversationExporter.ts`（对话导出）。保留。
- **`electron/types/`**（4 .d.ts）：`gateway.d.ts` / `ipc.d.ts` / `models.d.ts` / `openclaw.d.ts`。本期保留前 3 个，`gateway.d.ts` 随 `gateway/` 删除同步清理。
- **`electron/main.ts`** + **`electron/preload.ts`**：应用入口 + 预加载桥。本期保留，`preload.ts` 追加 `agent:*` / `channel:*` / `sandbox:*` / `insight:*` 四个 IPC namespace。
- **`src/`** 全部 12 view + 12 store + 16 component：**全部保留**，接新域时通过 store action 注入，不改 view 文件名、不改路由。
- **`src/locales/`**（`en-US` / `zh-CN` / `index`）：保留，新增 Agent / Channel / P7 / Computer / Content / Connector / Insight 7 套新词条（每套 ~30 条键值）。

## 段 6: 要删的文件

明确 1.0.0 删除清单：

1. **`electron/gateway/`** 整个目录（4 文件）：
   - `electron/gateway/GatewayManager.ts`
   - `electron/gateway/MessageGateway.ts`
   - `electron/gateway/GatewayConfig.ts`
   - `electron/gateway/GatewayStatus.ts`
   - 理由：与 `electron/openclaw/`（`OpenClawServer.ts` / `OpenClawGateway.ts` / `OpenClawExecutor.ts`）功能重复；openclaw/ 已有 HTTP 18789 通道、网关、执行器三件套，gateway/ 是早期抽象残留。
2. **`electron/types/gateway.d.ts`**：随 `gateway/` 删除同步清理。
3. **`tests/`** 目录下唯一的 `.test.js`（非 vitest，非 test script）：保留作 e2e 参考，但 W1 之后由 vitest 重写。
4. **代码内 TODO 注释保留，但下一版替换**（不在文件层面删除，而是行为替换）：
   - `electron/skill/SkillManager.ts::executeSkill` 的简化实现 → v2 替换为基于 `SkillChain.ts` + `SkillSandbox.ts` 的真实执行。
   - `electron/skill/SkillLoader.ts::importSkillFromUrl` 未实现 → v2 替换为基于 `SkillSigner.ts` + `ClawHubClient.ts` 的真实 URL 导入。
   - `electron/core/IpcServer.ts` 中 `mcp:test` 1s 模拟 → v2 替换为真实 MCP 协议握手 + 工具列表拉取。

## 段 7: 性能预算 / 视觉语言

延续 1.0.0 已确立的设计原则，本期全部落地为可执行规范。

### 视觉语言（Apple HIG 风格）

- **Spacing tokens**：`xs: 4px` / `sm: 8px` / `md: 16px` / `lg: 24px` / `xl: 32px` / `2xl: 48px`，全部 4 的倍数。
- **Color tokens**：`--bg-primary` / `--bg-secondary` / `--bg-elevated` / `--text-primary` / `--text-secondary` / `--text-tertiary` / `--accent` / `--accent-hover` / `--success` / `--warning` / `--danger`；light + dark 两套 CSS 变量，定义在 `src/styles/tokens.css`。
- **Typography**：SF Pro Display 优先（macOS）/ Segoe UI Variable（Windows）/ 系统默认 sans（Linux fallback）；标题 28/22/17/15，正文 15/13，注脚 11/9。
- **Motion**：spring 曲线 `cubic-bezier(0.32, 0.72, 0, 1)`，时长 200ms / 300ms / 500ms 三档；页面切换 300ms 横向 slide；模态出现 200ms 缩放淡入。
- **Radius**：`4 / 8 / 12 / 16 / 999`（pill）。
- **暗色模式**：默认暗色，提供 `light` / `dark` / `auto` 三档，auto 跟随系统。

### 性能预算

- **首屏 < 1.5s**：12 view 首屏用 Vite 路由懒加载，每个 view chunk < 500KB gzip。
- **交互响应 < 100ms**：点击 → 视觉反馈必须 ≤ 100ms。
- **滚动 60fps**：长列表（任务列表 / 技能市场 / 能力集市）用虚拟滚动（`vue-virtual-scroller` 或等价方案），单帧 < 16ms。
- **内存 < 800MB**：空闲态 Electron 主进程 + 渲染进程总 RSS。
- **CPU idle < 3%**：空闲态单核占用。

## 段 8: 5 个 A 级演示 + 3 个 demo（精简版）

| 演示 | 1.0.0 基础 | 本期新增 |
|---|---|---|
| **A1 工作台** | 已有 `src/views/Dashboard.vue` + `src/store/app.ts` | 翻新 Apple HIG 视觉（间距/字号/动效）+ 接 P7 Inspector（顶部卡片显示当前活跃容器数 + CPU/内存）+ 接 Insight CostTracker（今日 token / 美元）+ 接 HermesMemory 推荐（"今天可以复习的记忆"） |
| **A2 对话** | 已有 `src/views/Chat.vue` + `src/store/chat.ts` + `chat/ChatManager.ts` 三件套 | 翻新视觉（侧栏 + 主区双栏布局）+ 接 Agent 域（自动路由到 `AgentBrain`）+ ⌘K 触发（`Cmd+K` / `Ctrl+K` 唤起 A8）+ 显示思考过程（`AgentBrain` 的 CoT 可折叠面板）+ 显示工具调用（`ToolCallMessage` 流式渲染） |
| **A3 能力集市** | 已有 `src/views/SkillsView.vue` + `src/views/SkillMarket.vue` + `src/views/PluginMarket.vue` 三个 view | 合并三个 view → 统一"能力集市"，tabs：已装 / 市场 / 插件；`SkillMarket.vue` 接入 `ClawHubClient.ts`（远程仓库）+ `SkillSigner.ts`（签名校验） |
| **A4 远程控制** | 已有 `src/views/RemoteControl.vue` + `electron/openclaw/` 三件套（HTTP 18789） | 接入 IM 11 通道（飞书 / 钉钉 / 企微 / Telegram / Slack / Discord 等）+ 统一 `ChannelRouter.ts` + D3 一句话远程 demo |
| **A5 Computer Use v1** | (空) | 新建 Computer 域（`ScreenVision.ts` + `ActionExecutor.ts` + `ComputerUseHandler.ts`）+ 一个最小可用 demo：Agent 看屏幕截图 → 决定点击坐标 → `ActionExecutor` 执行 |
| **A6 Insight 面板** | (空) | 新建 `src/views/Insight.vue`（接入 `TraceCollector.ts` + `CostTracker.ts` + `TaskKanban.ts` + `AnomalyTimeline.ts` 4 个文件）+ `TaskKanban` 拖拽编辑 + 异常时间线 24h 视图 |
| **A7 设置** | 已有 `src/views/Settings.vue` + 9 子模块 | 翻新视觉 + 加 P7 启用入口（Docker 检测状态 / base 镜像下载进度 / 资源限额配置）+ 加 Channel 启用入口（11 通道开关 + 各自鉴权填写）+ 加 Hermes Memory 入口（查看 USER.md / MEMORY.md / 手动策展） |
| **A8 ⌘K 万能入口** | (空) | 新建 `src/components/layout/CommandPalette.vue` + `electron/command/CommandRegistry.ts`；支持模糊搜索 + 类别过滤（命令 / 技能 / 文件 / 会话）+ 快捷键自定义 |
| **A9 Welcome** | 已有 `src/views/FirstLaunchGuide.vue`（在 guide/ 下） | 翻新 + 接 D2-Prime 引导（首次启动 30 秒搭出可运行项目 demo）+ 接 D4 本地模型引导 |
| **D1 截屏问答** | (空) | 新建（Computer 域支撑）：`Cmd+Shift+S` 全屏截图 → `ComputerUseHandler` 截屏 → Agent 视觉理解 → 流式回答；借 `learning/SelfLearner.ts` 把高频截屏问答固化为 Skill |
| **D2-Prime 项目骨架** | (空) | **P7 旗舰 demo**：用户说一句"用 React + Vite + Tailwind 做一个 Todo App" → `AgentBrain` 拆解 → P7 Sandbox 在 30 秒内启动容器 + 写代码 + 启动 dev server + `WebContainerRunner` 实时预览 + 自动 git init + commit |
| **D3 一句话远程** | `openclaw/` 已就位（HTTP 18789） | 新建 IM 11 通道 + `ChannelRouter.ts` 路由 + 一句话指令（飞书消息"帮我查今天日程" → Agent 调 `CalendarConnector.ts` → 回复飞书） |
| **D4 本地模型** | `ModelManager.ts` 已有 `OllamaProvider` | 翻新 + 引导下载（Ollama 安装引导 + 推荐模型 qwen2.5-coder:7b / llama3.1:8b / deepseek-coder-v2:16b）+ 显示本地 vs 云端 token 节省 |
| **D5 录屏转技能** | (空) | 新建（Computer 域支撑）：录制一段 UI 操作 → `ScreenVision.ts` 截帧 + `ActionExecutor.ts` 记录动作 → `AutoCreator.ts` 生成 SKILL.md → `SkillSigner.ts` 签名 → 入库 |
| **D6 ⌘K** | (空) | 与 A8 合并（同一组件） |

## 段 9: 七条守卫

1. **真实跑通**：D2-Prime 在 macOS 14 / Windows 11 / Ubuntu 24.04 各真跑通 1 次并录屏。
2. **错误路径**：Docker 缺失 / 容器 OOM / 端口冲突 / L1 隔离失败 4 个错误路径全部走显式提示 + 用户确认 + 引导安装，**不允许静默降级**。
3. **可观测**：Insight 面板能看到每一次 `AgentBrain` 决策、每一次 Tool 调用、每一次容器操作的 trace。
4. **可审计**：容器创建 / 端口暴露 / 网络策略变更 / 技能签名失败 / 权限拒绝 5 类关键操作必须留 audit log（写入 `SandboxAuditLog.ts` + 本地 SQLite）。
5. **有 e2e**：Playwright 覆盖 D2-Prime 主流程 + 3 个错误路径 + 8 能力域各 1 个主流程；CI 跑通率 100%。
6. **有文档**：`docs/sandbox-security-whitepaper.md`（P7 安全模型 + 威胁分析 + 缓解措施）+ `docs/user-manual.md`（用户手册 + 9 个演示的操作步骤）。
7. **有录屏**：营销首页有 D2-Prime 60s 录屏 + A5 Computer Use 30s 录屏 + A8 ⌘K 15s 录屏。

## 段 10: P7 本地沙盒 + 实时预览

### 3 层隔离

- **L1 进程级**（最轻）：
  - macOS：`sandbox-exec` + 预定义 profile（deny-write / deny-network / allow-read-only）
  - Linux：`bubblewrap`（`--bind` / `--ro-bind` / `--unshare-net` / `--unshare-pid`）
  - Windows：Job Object + 进程限制（CPU / 内存 / 句柄）
- **L2 容器**（中等）：
  - Docker + 自建 base image（`sandbox-base:1.0.0`，~800MB，Ubuntu 24.04 + node 22 / python 3.12 / java 21 / go 1.23 + 国内镜像源）
  - 不上 gVisor / Firecracker / VM（理由：破坏跨平台 / 启动慢 1-3s / 不适用交互场景；沙盒是开发辅助，不是恶意软件防御）
- **L3 浏览器内**（最轻 + 零资源）：
  - WebContainer（StackBlitz 开源方案，仅支持前端类项目：Node.js + npm + Vite/Webpack + React/Vue 框架）
  - 不支持后端 / 不支持 Python / 不支持系统命令
  - 启动 < 200ms，不消耗本地 CPU/内存（跑在浏览器 web worker）
  - 通过 `sandbox/WebContainerRunner.ts` 集成
  - **首选** D2-Prime 的前端类项目（Vite + React + TS 等），零容器零资源即时预览

### 预览策略（按项目类型分）

| 项目类型 | 预览方式 | 延迟 | 资源占用 |
|---|---|---|---|
| **前端 SPA**（React/Vue/HTML） | **L3 WebContainer**（不经过 Docker） | <1s | 0（跑在浏览器） |
| **前端 SSR / 全栈**（Next.js / Nuxt） | L2 Docker + 端口转发到主界面 iframe | ~3s 冷启动 | 容器内 |
| **后端服务**（Node/Python/Go HTTP） | L2 Docker + 端口转发 | ~3s 冷启动 | 容器内 |
| **CLI 工具 / 脚本** | L1 进程级 + Jupyter kernel 模式（GLM 风格） | <500ms | 容器内 |
| **桌面 GUI**（Electron/Tauri） | **本期不做**（W12 之后加 VNC 桥） | — | — |
| **数据科学**（Jupyter Notebook） | L2 Docker + JupyterLab 端口转发 | ~2s 冷启动 | 容器内 |

**主界面右侧 inspector 面板**：`AppLayout` 的右栏（`inspector` slot）默认在 P7 模式时显示"实时预览 + 日志 + 端口列表"三件套。

### 镜像策略（"自建 base，AI 在 base 之上决定"）

**核心决定**：**只维护 1 个 ~800MB 自建 base**（`pipiclaw/sandbox-base:latest`），AI 根据"我要搭的项目类型"动态决定在 base 之上**加什么**（Node 版本、Python 版本、Go 工具链等）。

base 镜像内容（`sandbox/base/Dockerfile`）：
```dockerfile
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl wget git ca-certificates gnupg build-essential pkg-config \
  python3 python3-pip python3-venv \
  nodejs npm \
  openjdk-21-jdk \
  golang-go \
  ripgrep fd-find jq \
  && rm -rf /var/lib/apt/lists/*
# 预装国内镜像源（避免运行时拉慢）
RUN npm config set registry https://registry.npmmirror.com && \
    pip3 config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple && \
    go env -w GOPROXY=https://goproxy.cn,direct
# 创建工作目录
RUN mkdir -p /mnt/data && chmod 1777 /mnt/data
WORKDIR /mnt/data
HEALTHCHECK NONE
```

**AI 动态决定加什么的流程**（在 W10 实现）：
1. AI 解析用户请求（如"Vite + React + TS 博客"）
2. 查"项目模板表"（`sandbox/templates/*.yaml`）
3. 若模板存在：跑模板；若不存在：在 base 上现场 `npm create vite@latest`
4. 结果打包为新镜像层（cached at `~/.pipiclaw/sandboxes/<hash>/`）

**4 起步模板**：
- `vite-react-ts` — Vite + React + TypeScript（端口 5173）
- `nextjs-app` — Next.js + App Router（端口 3000）
- `fastapi` — FastAPI + uvicorn（端口 8000）
- `go-http` — Go 标准库 HTTP（端口 8080）

**为什么不预装 N 个语言镜像？**
- N 个镜像 = N GB 磁盘空间
- 大多数用户只用 1-2 种语言
- "AI 决定"符合 P5 Hermes 自学习方向（让 AI 越来越懂用户项目习惯）

### 网络白名单（默认全关，按需白名单）

| 协议 | 默认 | 允许 | 备注 |
|---|---|---|---|
| **包管理** | ✅ 白名单 | npm / pypi / maven / goproxy 国内镜像 | 在 base 镜像里设好，不在容器内动态改 |
| **AI 模型 API** | ❌ 默认关 | 用户显式在设置里加 + 走 SecureStorage | **不通过 P7 转发**，P7 内的代码不直接调 LLM |
| **Git clone** | ⚪ per-project | 每次 clone 显式确认 | SSH key 走主机挂载 |
| **其它** | ❌ | — | 出站全 drop |

### 资源限额（防失控）

| 资源 | 限额 | 超出行为 |
|---|---|---|
| CPU | 2 核 | throttled（不杀进程） |
| 内存 | 4 GB | OOM killed |
| 磁盘 | 10 GB（容器内） | 写失败 + 提示用户清理 |
| 单次命令超时 | 30 min | killed + 留 trace |
| 并发沙盒数 | 3 | 第 4 个排队 |
| 容器生命周期 | 30 min 无活动自动 stop | 24h 后自动清理 |

### 不可用场景（明确告知用户）

- 用户主机无 Docker 且拒绝安装 → 主界面顶部红 banner："沙盒未启用，部分 AI 能力受限 [查看帮助]"
- 用户在 Docker 缺失下要求执行任意代码 → **不执行** + 提示"需要 Docker 才能运行"
- 沙盒内 OOM / 端口冲突 → 主界面 inspector 实时显示错误，用户可一键 kill

### 安全边界

1. **`/mnt/data/` 是 AI 唯一可写区**（容器内），其他路径只读
2. **禁止容器内访问主机的 `~/.ssh/`、`~/.aws/` 等敏感目录**
3. **禁止容器内启动 GUI 应用**（本期不实现）
4. **禁止容器内主动监听公网端口**（端口转发仅走 PiPiClaw 主进程）
5. **所有容器操作产生 audit event**（写入 `SandboxAuditLog.ts` + 本地 SQLite）
6. **容器退出自动清理临时文件**（不留垃圾在主机）

### P7 与其他能力域的协作

| 场景 | 协作链路 |
|---|---|
| **D2-Prime 项目骨架搭建** | Chat → Agent → P7（docker kind）→ 输出端口 → Inspector 实时预览 |
| **D5 录屏转技能** | 录屏（Computer 域）→ Agent 蒸馏成 Skill 草稿 → **P7 验证**：在沙盒里跑一遍 Skill → 通过才入库 |
| **Welcome 第 4 步** | 一键触发 D2-Prime，30 秒后引导用户到工作台 |
| **Insight 面板** | 所有 P7 调用都产生 trace，包括容器启动耗时、命令执行时间、端口冲突次数 |

## 段 11: 12 周时间线 + 任务清单 + 验收标准

### 12 周时间线

| 周 | 主题 | 关键交付 | 验收 |
|---|---|---|---|
| **W1** | 工具链 + postinstall | `bin/postinstall.mjs`（5 项探测）+ vitest + eslint 9 + 扩 .gitignore + 删 `electron/gateway/` 4 文件 | `npm install` 跑 postinstall 成功；`npm test` 跑通；`electron/gateway/` 已删；`npm run typecheck` 0 错 |
| **W2** | 视觉翻新 | Apple HIG tokens（`src/styles/tokens.css`）+ 12 view 翻新 + 暗色模式 + 动画规范 | 12 view 跑通；toggle 暗色不闪；所有动画 60fps |
| **W3** | 8 能力域骨架 | agent/contentgen/connector/computeruse/insight/p7 6 个新域根目录 + CapabilityRegistry 协议 + IpcServer 1592 行新 namespace | `npm run typecheck` 0 错；IpcServer 注册 8 namespace；`agent:*` `channel:*` `sandbox:*` `insight:*` 4 个新 namespace 已暴露到 preload |
| **W4** | runtime 5 核心子系统 | actor/bridge/conversation/scheduler/skill 5 子模块 + ChatManager 接入 Agent 注册点 | Agent 域能 spawn 子 actor；scheduler 调度；chat 流可挂载 agent brain |
| **W5** | Insight + Agent 主流程 + D1 | TraceCollector + CostTracker + TaskKanban + AnomalyTimeline + Agent 17 文件 + D1 截屏问答 demo | 截屏问答 1 次成功；Insight 看板 4 件套可用；`Cmd+Shift+S` 全局快捷键注册 |
| **W6** | Memory 扩展 + Skill 扩展 + D5 | Hermes 1→8 文件 + Skill 2→12 文件 + D5 录屏转技能 demo + learning/SkillEffectivenessTracker | D5 录屏能生成 SKILL.md；Memory 向量检索 < 100ms；技能链能组合 3 技能 |
| **W7** | Channel 域 + IM 11 通道 + Content 域 + D3 | WeChat/Feishu/DingTalk/QQ/Telegram/Slack/Discord/WhatsApp/Lark/Rocket/WechatWork + ChannelRouter + ContentGen 9 文件 + D3 一句话远程 | 飞书发消息能调度 Agent；D3 demo 1 次成功；4 个文档渲染各自跑通 1 次 |
| **W8** | Computer 域 + A5 | ScreenVision + ActionExecutor + ComputerUseHandler + A5 Computer Use 最小 demo（看屏幕 → 决策 → 点击） | A5 真跑通 1 次；3 OS 各跑通 L1 隔离 1 次 |
| **W9** | P7 沙盒基础 | dockerDetector + L1 隔离（Seatbelt/bwrap/Windows Job）+ workspace 抽象 + 自建 base Dockerfile + `scripts/sandbox-base-build.mjs` | base 镜像构建成功；3 OS 各跑通 L1 隔离 1 次 |
| **W10** | P7 镜像构建器 + 网络白名单 + 资源限额 | SandboxBuilder + 4 模板 + networkPolicy + resourceLimits + `scripts/sandbox-selfcheck.mjs` | `npm run sandbox:selfcheck` 5/5 ok；模板选择准确率 ≥ 80% |
| **W11** | P7 预览 + 端口转发 + Jupyter + D2-Prime | WebContainerRunner + PortForwarder + JupyterRunner + SandboxAgentTool + SandboxLifecycle + D2-Prime 项目骨架 demo | D2-Prime 真跑通（Vite + React 30s 内出预览）；前端项目走 L3 零资源 |
| **W12** | 集成 + 测试 + CI + 灰度 + GA | vitest 14 unit + playwright 10 e2e + 集成 5 链路 + CI workflow + release-checklist + alpha 5 人 + 灰度 5% + GA v1.0.0 | e2e 100% pass；CI 绿灯；v1.0.0 tag 推到 origin |

**B 级能力**（B1-B8：自定义主题 / 多用户 / 工作流模板 / 团队空间 / 移动端 / Web 端 / 桌面端 iPad / 国际化扩展）在 W6-W11 穿插做接口 + 最小实现，不需要七条守卫。

**风险缓冲**：W13 弹性周（如果 W12 GA 没做完，留 1 周；否则启动 P3 离线 + Hermes 深度 + Computer 加固迭代）。

### 验收标准总览

每周末必须满足的硬约束：
- `npm run typecheck` 0 错
- `npm run test` 100% pass（vitest unit）
- `npm run e2e` 100% pass（playwright）
- `npm run lint` 0 warning
- 关键演示链路手工验证 1 次（录屏存档）
- 当周新增文件 < 800 行单文件
- 当周新增依赖必须经 review

## 段 12: 一句话总结 + 关键风险 + 决策记录

### 一句话总结

> **1.0.0 origin 是 60% 完成的桌面 AI 助手**（38 个真实 .ts + 12 view + 12 store + 16 component + openclaw/ HTTP 18789 + ModelManager 6+ provider）；**本期 v2 把它推到 100% 可发布**：保留全部 1.0.0 真实实现，删 `electron/gateway/` 4 个重复文件，新建模 8 能力域缺失部分（Agent/Memory/Skill 扩/Channel/Computer/Content/Connector/Insight/P7）+ runtime 5 核心子系统 + vitest + Playwright + 翻新视觉到 Apple HIG + P7 沙盒旗舰 demo D2-Prime。

### 关键风险（按可能性排序）

| 风险 | 可能性 | 缓解 |
|---|---|---|
| ChatManager 接入 Agent 改动大 | 高 | 严格走"扩方法不重写"原则（反模式 4） |
| IpcServer 1592 行改动引入回归 | 高 | W3 接入新 namespace 时只加不改，1 个原子 commit |
| runtime 5 核心子模块过设计 | 中 | W4 收尾时 review，每个子模块 ≤ 200 行 |
| P7 base 镜像 800MB 拉取慢 | 中 | W10 缓存到 `~/.pipiclaw/sandboxes/cache/` |
| D2-Prime 30s 跑通不一定达到 | 中 | W11 给 5s 缓冲，30s 是目标 40s 兜底 |
| IM 11 通道签约 / 鉴权各平台差异 | 高 | W7 只接 3 个（飞书 / 钉钉 / 企微），其余 W13+ 补 |
| 12 view 翻新视觉工作量超过 W2 1 周 | 中 | W2 后留 W3 buffer 时间 1 周 |
| 三方 IM API 变更（飞书 / 钉钉 2025 都有大改） | 中 | W7 实时跟踪官方 SDK，ChannelRouter 抽象屏蔽变化 |
| vitest 与 vite 6.x 兼容性 | 低 | 锁定 vitest 1.2.x，typecheck 跑全量 |
| 1.0.0 `IpcServer.ts` 已有 channel 名与新规范冲突 | 高 | W3 不动 1.0.0 channel 名，新 namespace 走 `domain:verb` 形式 |

### 决策记录

| # | 决策 | 日期 | 理由 |
|---|---|---|---|
| 1 | 保留 1.0.0 全部 38 .ts | 2026-07-10 | 避免 2-3 周纯重写丢失真实实现 |
| 2 | 删 `electron/gateway/` | 2026-07-10 | 与 openclaw/ 重复 |
| 3 | runtime 5 核心而非 12 子系统全建 | 2026-07-10 | 骨架过早膨胀让 8 能力域失去焦点 |
| 4 | P7 3 层不上 gVisor/Firecracker | 2026-07-10 | 破坏跨平台 / 启动慢 / 不适用交互 |
| 5 | 12 周而非 16 周 | 2026-07-10 | v2 范围比 v1 spec 小（v1 spec 假设 16 周是基于"从零开始"，v2 实际有 60% 基础） |
| 6 | A6 Insight 域先建 | 2026-07-10 | 8 域主流程必须可观测，否则 W5-W11 全是黑盒 |
| 7 | vitest 而非 jest | 2026-07-10 | vitest 与 vite 同生态，启动快，Vue/Vite 项目首选 |
| 8 | Apple HIG 视觉而非 Material | 2026-07-10 | macOS 用户主力 + 简约 + 丝滑（用户硬约束） |
| 9 | 12 view 翻新而非新建 | 2026-07-10 | 复用 1.0.0 已存在的 12 view，只翻新视觉不重写 |
| 10 | D2-Prime 而非 D2 桌面整理 | 2026-07-10 | P7 沙盒的旗舰亮相窗口；桌面整理作为 P7 链路的一步，不单独 demo |
| 11 | 不建 packages/ workspace | 2026-07-10 | v2 范围先用 1.0.0 现有目录结构，packages/ 留到 v2.1 |
| 12 | 5 周做能力域（W5-W8 + W11） | 2026-07-10 | 8 能力域不可能 4 周做完，D2-Prime 是 1 周独立旗舰 |
| 13 | 不上 `apps/desktop/` 重构 | 2026-07-10 | 保留 1.0.0 真实目录结构，反模式 4 |
| 14 | W9-W11 沙盒 3 周而非 4 周 | 2026-07-10 | runtime 5 核心已替代 1 周工作（D2-Prime 走 L3 WebContainer 大头是 0 容器） |
| 15 | vitest unit 14 个，playwright e2e 10 个 | 2026-07-10 | 测试金字塔：unit 覆盖域逻辑，e2e 覆盖演示链路 |

---

## 后续步骤

1. 用户审阅本 spec → 确认或要求修改
2. 确认后转入 `writing-plans` 技能 → 生成 12 周实施计划
3. 实施计划确认后 → 进入实施阶段（按 W1-W12 逐周交付）
