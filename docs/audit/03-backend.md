# Agent 3: 后端 Lead 视角审查 (Electron 主进程)

## 任务
对 PiPiClaw v4.4.0 做**主进程 / 后端代码审查**。

## 审查范围
- `electron/main.ts` — 启动入口、window 创建
- `electron/core/` — IpcServer, 各种 Manager
- `electron/runtime/` — bridge, scheduler, skill runtime
- `electron/agent/` — AgentBrain, LlmAgentBrain, EventBus
- `electron/llm/LlmClient.ts` — 多 provider LLM 调用
- `electron/channel/` — ChatManager, IM 消息路由 (11 平台)
- `electron/openclaw/` — OpenClawGateway + 网关服务
- `electron/hermes/` — HermesMemory, MemoryVectorStore
- `electron/models/` — ModelRatingManager
- `electron/insight/` — TaskKanban, CostTracker, CrashReport
- `electron/skill/` — SkillLoader, SkillRuntime, AutoCreator, ClawHubManager
- `electron/permission/` — PermissionConfig (用户/群组 RBAC)
- `electron/tray/` — TrayManager

## 关键问题
1. **架构分层**: 主进程/渲染进程边界? 哪些跑主进程?
2. **IPC 安全**: contextBridge 暴露的 API 是否最小化? 是否有安全漏洞?
3. **错误处理**: 主进程 try-catch / 异常恢复? crash report 机制?
4. **资源管理**: ChatManager / LLM Client / Skill Runtime 生命周期? 内存泄漏?
5. **OpenClaw 网关**: 端口管理 / 鉴权 / API 兼容性?
6. **多 LLM Provider**: 5 种 (OpenAI/Anthropic/DeepSeek/Ollama/Custom) 统一抽象? 流式?
7. **任务调度**: cron / once / daily / weekly — 实现完整性?
8. **记忆系统**: Hermes 存储格式? 向量化 (bge-m3)? 跨 session 持久化?
9. **Skill 系统**: 加载机制 / 版本 / 签名? 安全性?
10. **IM 11 平台**: 真实可用性? 各平台 webhook/stream 模式?
11. **AutoUpdater**: electron-builder 配置 + GitHub release 流程?
12. **TypeScript strict 模式覆盖度?**

## 输出格式
写到 `docs/audit/03-backend-report.md`:
- 模块清单 + 行数
- 关键架构图 (文字描述)
- 发现的问题
- 评分: 健康度 X/10
