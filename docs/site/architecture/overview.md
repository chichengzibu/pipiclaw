# PiPiClaw 架构总览

> 适合想理解 PiPiClaw 内部如何组织的开发者 / 集成方。

## 技术栈

| 层 | 技术 | 版本 |
| --- | --- | --- |
| 桌面运行时 | Electron | 30.5.x |
| 主进程 | Node.js + TypeScript | 18+ / 5.9 |
| 渲染端 | Vue | 3.4 |
| 状态管理 | Pinia | 2.1 |
| 路由 | vue-router | 4.2 |
| 构建工具 | Vite | 5.0 |
| 打包 | electron-builder | 26.15 |
| UI 库 | Element Plus | 2.5 |
| 国际化 | vue-i18n | 9.14 |
| 测试 | vitest + Playwright | 1.6 / 1.59 |
| 日志 | electron-log | 5.1 |
| 自动更新 | electron-updater | 6.8 |
| 安全 | Electron `safeStorage` | OS native |

---

## 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Electron Main Process                       │
│                                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐│
│  │ ChatMgr    │ │ TaskExec.  │ │ SelfLearner│ │ Hermes    ││
│  │ (LLM 流式) │ │ (任务执行) │ │ (技能学习) │ │ (记忆)    ││
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘│
│                                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐│
│  │ LlmConfig. │ │ ModelMgr   │ │ Permission │ │ IpcServer  ││
│  │ (API Key)  │ │ (模型配置) │ │ (权限规则) │ │ (107 handlers)│
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Sandbox 子系统                                          ││
│  │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐     ││
│  │  │D2-Prime │ │WebContainer│ │ Jupyter │ │ L1(bwrap)│    ││
│  │  └─────────┘ └──────────┘ └─────────┘ └──────────┘     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Channel 子系统 (IM)                                     ││
│  │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐     ││
│  │  │ Feishu  │ │ DingTalk │ │WechatW. │ │ Lark+8   ││
│  │  └─────────┘ └──────────┘ └─────────┘ └──────────┘     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Core 子系统                                             ││
│  │  Window · Tray · MiniWindow · AutoUpdater · LogManager  ││
│  └─────────────────────────────────────────────────────────┘│
└──────────────────────────┬───────────────────────────────────┘
                           │ IPC (107 handlers + 多个 events)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Renderer (Vue + Pinia)                     │
│                                                              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│  │ Chat   │ │ Tasks  │ │Models  │ │Schedule│ │ Skills │    │
│  │ View   │ │ View   │ │ View   │ │ View   │ │ View   │    │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘    │
│                                                              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│  │Settings│ │Plugins │ │ Demos  │ │Help    │ │Dashboard│  │
│  │ View   │ │ View   │ │(D1-D5) │ │ View   │ │ View   │    │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘    │
│                                                              │
│  Pinia Stores: chat · models · permissions · schedule ·     │
│               skill · executionMode · gateway · hermesMemory│
└─────────────────────────────────────────────────────────────┘
```

---

## 模块清单

### 主进程模块 (`electron/`)

| 子目录 | 模块 | 职责 |
| --- | --- | --- |
| `core/` | IpcServer | 107 个 IPC handler 注册中心 |
| | WindowManager | 主窗口 / Mini 窗口管理 |
| | TrayManager | 系统托盘 |
| | AutoUpdater | electron-updater 集成 |
| | LogManager | 日志 |
| `chat/` | ChatManager | 对话管理 + LLM 流式推送 |
| `llm/` | LlmClient / 3 adapter | LLM provider 接入(OpenAI/Anthropic/智谱) |
| | LlmConfigStore | API Key 加密存储 |
| `models/` | ModelManager / ModelConfig | 模型 CRUD |
| `task/` | TaskExecutor / TaskLog | 任务执行 + 日志 |
| `schedule/` | (含在 task/) | Cron 调度 |
| `skill/` | SkillManager / SkillLoader | 技能管理 |
| `learning/` | SelfLearner | 自动学习生成技能 |
| `hermes/` | HermesMemory / HermesAdapter | 长期记忆 |
| `permissions/` | PermissionManager | 权限规则 |
| `sandbox/` | SandboxBuilder / D2Prime / WC / Jupyter / L1 | 沙箱 |
| `channel/` | Feishu / DingTalk / Wecom + 8 placeholder | IM |
| `agent/` | AgentBrain / ExecutionEngine / ToolRegistry | Agent 核心 |
| `openclaw/` | OpenClawGateway / Executor | 任务执行网关 |
| `insight/` | TraceCollector / CostTracker | 可观测性 |
| `runtime/` | Actor / Bridge / Scheduler / Skill | runtime 子层 |

### 渲染端模块 (`src/`)

| 子目录 | 用途 |
| --- | --- |
| `views/` | 19 个顶层页面(Chat / Tasks / Schedule / Skills / Settings 等) |
| `components/` | 11 个复用组件 |
| `stores/` | 12 个 Pinia store |
| `router/` | vue-router 配置 |
| `locales/` | i18n zh-CN + en-US |
| `types/` | TypeScript 类型 |
| `utils/` | 工具函数 |
| `styles/` | 全局样式 + 主题 tokens |

---

## 关键数据流

### 1. 用户发消息 → 流式响应

```
Chat.vue (用户输入)
  → chat store sendMessage()
    → window.electronAPI.chat.message.send(convId, content, provider, model)
      → IPC: chat:message:send
        → ChatManager.sendMessage()
          → LlmClient.streamChat() (SSE)
            ↓ 逐 token chunk
            → ChatManager.broadcastStreamChunk()
              → webContents.send('chat:onStreamChunk', { convId, msgId, chunk })
                → preload onStreamChunk callback
                  → chat store appendStreamChunk()
                    → Chat.vue 流式更新
```

### 2. 自动化任务执行

```
Tasks.vue (新建任务 + 指令)
  → chat store confirmExecuteTask(plan)
    → electronAPI.task.execute(plan)
      → IPC: task:execute
        → TaskExecutor.execute(plan)
          → 解析 plan → 跑每步 (读文件 / 写 / shell / URL)
            → AbortController 控制取消
            → 每步 broadcast 状态
              → chat store updateCurrentTaskResult()
                → TaskExecutionPanel.vue 显示
```

### 3. 加密 API Key 读取

```
Settings.vue (用户填 key)
  → models store saveProvider()
    → electronAPI.models.add(provider)
      → IPC: models:add
        → LlmConfigStore.persistToDisk()
          → safeStorage.encryptString(JSON.stringify(...))
            → fs.writeFileSync(<userData>/llm-config.json.enc, encryptedBuffer)
```

### 4. 飞书消息接收 → 任务路由

```
飞书 WebSocket 推消息
  → FeishuChannel.onMessage()
    → IMMessageStore.persist()
      → IMPermissionManager.check()
        → IMMessageRouter.route()
          → 匹配规则 → dispatch to agent / skill
            → AgentBrain.run()
              → 反馈到飞书(WebSocket send)
```

---

## 进程边界

```
┌───────────────────────────┐         ┌──────────────────────────┐
│   Main Process (Node)     │         │   Renderer (Chromium)    │
│                           │         │                          │
│  · fs / shell / 网络       │         │  · Vue UI                │
│  · sandbox / docker       │  IPC    │  · Pinia store           │
│  · LLM API 直接发请求      │ ◀────▶  │  · 不能直接访问 fs       │
│  · safeStorage            │         │  · 不能直接发 HTTP       │
│  · 系统托盘 / 全局快捷键   │         │  · 不能直接起 docker     │
└───────────────────────────┘         └──────────────────────────┘
```

**安全模型**:
- Renderer 不直接访问 OS,通过 preload 暴露的 `electronAPI` 受限调用
- `contextIsolation: true` + `nodeIntegration: false`
- 所有 IPC 都要经过 `IpcServer` 注册的白名单 handler
- 权限管理器检查每个高风险操作

---

## 性能要点

实测 baseline 见 [docs/perf/baseline.md](../perf/baseline.md):

- main.js bundle: 310 KB
- preload.js: 19 KB
- IPC handler: 107 个(实测)
- IPC invoke: 111 个
- renderer chunk 数: 24,最大 chunk 1042 KB

性能优化方向(Phase 6 GA):
- Element Plus 按需引入(当前全量)
- 路由级 code splitting
- 大文件 lazy import

---

## 测试金字塔

```
        ┌────────┐
        │  E2E   │  4 真 spec(Playwright Electron)
        ├────────┤
        │ Integ. │  5 文件(d2prime / chat / channel / skill)
        ├────────┤
        │ Unit   │  35+ 文件, ~456 tests
        ├────────┤
        │ Smoke  │  22 项< 10ms,CI hard-fail
        └────────┘
```

---

## 后续阅读

- [IPC 协议](ipc.md) — 100+ handler 全表
- [扩展开发](extension.md) — 如何加 provider / channel / view
- [Phase 3 retro](../superpowers/retros/2026-07-22-phase3-product-quality/retro.md) — 整体演进历史