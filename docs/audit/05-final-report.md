# PiPiClaw v4.4.0 — 总评审报告 (Verifier Agent)

- 评审日期: 2026-07-29
- 评审者: 总评审 verifier
- 输入: 4 份并行审查报告(架构 / 前端 / 后端 / QA)
- 方法: 跨报告交叉验证 + 关键问题 re-check + 路线图可执行性评估

---

## 0. 总评分

# **6.5 / 10**

| 子维度 | 评分 | 来源 |
|---|---:|---|
| 架构师 | 6.0/10 | 01-architecture-report |
| 前端 Lead | 7.0/10 | 02-frontend-report |
| 后端 Lead | 5.5/10 | 03-backend-report |
| QA Lead | 7.5/10 | 04-testing-report |
| **算术平均** | **6.5/10** | (6.0 + 7.0 + 5.5 + 7.5) / 4 |
| **加权平均** (后端×1.2, 其他×1.0) | **6.4/10** | 主体是 Electron 主进程 |

**单项分布**: 后端 5.5 拉低(security + stub 域),前端/QA 7+ 拉高(modern stack + 测试基础设施扎实)。
**修完所有 P0 critical 后预估**: 7.5/10;修完 P0+P1 后预估: 8.5/10。

---

## 1. 4 个子报告对比表

| 维度 | 架构师 (6.0) | 前端 (7.0) | 后端 (5.5) | QA (7.5) | 综合 |
|---|---|---|---|---|---|
| 代码组织 | 7 (模块清晰) | 7 (12 store 清晰) | 8 (24 目录严格单例) | — | **7.3** |
| 类型安全 | 6 (`as any` 多) | 6 (3 个 vue-tsc 错误) | 8 (TS strict) | 7 (3 errors) | **6.8** |
| 安全性 | **3** (CORS+shell+key+HMAC) | — | **3** (同上) | — | **3.0** 🔴 |
| IPC 架构 | 7 (contextBridge ✓) | — | 7 (架构) / 3 (实现) | — | **5.7** |
| 测试覆盖 | — | 8 (98.5% pass) | — | 8 (916+139+22) | **8.0** |
| 构建质量 | — | 8 (5.86s 成功) | 8 (Setup.exe 88.89MB) | 8 (1.1MB vendor 警告) | **8.0** |
| LLM 抽象 | 3 (两套分裂) | — | 6 (3 provider 无流式) | — | **4.5** |
| Agent 接入 | 4 (装饰性) | — | 4 (stub) | — | **4.0** |
| 任务调度 | 4 (Scheduler 闲置) | — | 4 (ScheduleTask 一次性) | — | **4.0** |
| 记忆/向量 | 6 (双实现) | — | 4 (SHA-256 stub) | — | **5.0** |
| Skills 系统 | 6 (Signer HMAC stub) | — | 4 (W6 stub) | — | **5.0** |
| IM 多平台 | — | — | 4 (5 真实 / 11) | — | **4.0** |
| 跨平台 | 7 (Win/macOS/Linux 都有 stub) | — | 7 (resolvePath 全平台) | — | **7.0** |
| 错误处理 | — | 7 (try-catch + ElMessage) | 7 (每个 handler try-catch) | — | **7.0** |
| i18n | — | 6 (438/438 对称但模板硬编码) | — | — | **6.0** |
| 性能 | — | 5 (0 v-memo/0 shallowRef) | — | — | **5.0** |
| 可观测性 | 5 (TraceCollector/CostTracker 在) | — | — | — | **5.0** |
| CI/CD | — | — | — | 9 (matrix 3 OS × 8 步) | **9.0** ✅ |

**横切观察**:
- ✅ **3 个高分**: 测试基础设施 (8.0) / 构建质量 (8.0) / CI/CD (9.0)
- 🔴 **3 个低分**: 安全性 (3.0) / LLM 抽象 (4.5) / Agent 接入 (4.0)
- ⚠️ **2 个不达预期**: 任务调度 (4.0) / IM 多平台 (4.0)

---

## 2. Top 3 顶级问题 (跨报告综合)

### 🔴 #1: 安全三重门 — 不修不能 ship

**跨报告证据**:
- 架构师 C1+C2: `OpenClawServer:184-186` CORS `*` + 18789 端点无 token + `runCommand` shell:true
- 后端 C1+C2: 同上 + `forceResetToPermissive` 每次启动覆盖用户选择
- 后端 C4: `SkillSigner.ts:24` 硬编码 HMAC key
- 架构师 C3: LLM API key 可能明文流转
- 后端 m1: WindowManager 无 `will-navigate` 拦截

**为什么是 #1**:
1. 任何能访问 127.0.0.1:18789 的进程(同机恶意软件 / 浏览器 `<img onerror>` / 其他 Electron app)都能执行 `run_command` / `delete_file`
2. `shell:true` + `args.join(' ')` = 经典命令注入(`; rm -rf ~` 可直接打到 `cwd` 没沙箱)
3. 用户即使在 UI 选 "安全模式",下次启动仍被 `forceResetToPermissive()` 覆盖
4. SkillSigner 硬编码 key 意味着 SkillLoader 未来强制 verify 时信任链已经崩塌

**修复成本**: 2 周(P0 必修)。其中 `runCommand` 改 `spawn` + 白名单约 3 天,网关 token 鉴权 2 天,PermissionConfig opt-in 改默认 1 天,SkillSigner Ed25519 + safeStorage 3 天。

**不可妥协**: 任意一个 critical 修完前不可 ship 真实用户。

---

### 🔴 #2: LLM 抽象精神分裂 + Agent 是装饰 — 任务文档撒谎

**跨报告证据**:
- 架构师 C3 + §7: 两套并行 LLM 抽象 — `LlmClient` (3 provider, safeStorage 加密) vs `ModelManager` (8 type, plaintext)
- 架构师 M1: `LlmAgentBrain` 注册完被覆盖,`think()` 返回的 Decision 拿回来只 log 不回写
- 后端 M1: 实际只有 3 provider,任务说 5;无流式,无超时,无重试,无 abort
- 后端 M3: `AgentBrainImpl` 是 stub,`think()` 返回 `"[stub]"`
- 架构师 M2: `CapabilityRegistry.markInitialized()` 调用时 `domains.size === 0`

**为什么是 #2**:
1. **任务文档承诺与现实差距最大**:
   - 任务: "5 provider 统一抽象" → 实际: 2 套分裂,新抽象只被 LlmAgentBrain 用,ChatManager 完全不知道
   - 任务: "agent 接入" → 实际: AgentBrainImpl stub + LlmAgentBrain 死代码,Chat 流走 ModelManager
   - 任务: "CapabilityRegistry 能力域" → 实际: 0 域注册
2. **用户视角看到的是**: Chat 能用,其他高级能力全部空
3. **维护视角看到的是**: 新增 provider 必改 2-3 处,LLM key 加密只覆盖 1/2
4. **演化视角看到的是**: "超越 Claude Code" 的 tool_call loop 完全不通

**修复成本**: 4-6 周(架构迁移)。ChatManager 切到 LlmClient(2 周)+ LlmClient 加流式/SSE/AbortController(1 周)+ DeepSeek/Ollama adapter(1 周)+ CapabilityRegistry 真注册 + AgentBrain 真接入 Chat 流(2 周)。

---

### 🔴 #3: Stub 域集体未交付 — "W6/W7/W8 stub" 是系统性现象

**跨报告证据**:
- 架构师 M3: `electron/sandbox/index.ts` IPC 全 `{ stub: true }`
- 后端 M5: IM 11 平台 6/11 是 stub(Lark/QQ/WeChat/Telegram/Slack/Rocket)
- 架构师 M3: `insight:cost:today` IPC 直接 `return { totalCostUsd: 0, stub: true }` → Dashboard 全 0
- 后端 M2: `MemoryVectorStore` in-memory Map 无持久化 + `EmbeddingService` 是 SHA-256 hash 伪 64 维向量
- 后端 C5: `ScheduleTask.daily/weekly/monthly/cron` 用一次性 `setTimeout`,触发一次后永远停
- 后端 M6: `HermesMemory.retrieveRelevantMemories()` `query` 参数完全没用,只按 importance-age 排序
- 架构师 M1: `ExecutionEngine.execute('call')` 返回 `{ stub: true, note: 'W5.2.4 接管' }`
- 后端 m4: `HermesMemory` ID 用 `Math.random()` 高并发可能碰撞

**为什么是 #3**:
1. **任务文档承诺了多个能力域**: Sandbox / Insight / IM / Memory Vector / Schedule / Skill Signer / AutoCreator / CapabilityRegistry,大量都"在 W6/W7/W8 stub"
2. **UI 看到的是空数据**: 用户点 Cost Dashboard 看到 0 USD,点 Sandbox 看到 "coming soon",配 6 个 IM 平台后 healthCheck 永远 false
3. **架构师明确说**: "W3+ 域框架已搭,W5/W7/W9 大部分能力仍 stub" — 这是 60% 完成度的本质
4. **跨报告同时点名**: 后端 + 架构师 + (隐含)QA 全部把 stub 域列为 major 风险

**修复成本**: 8-12 周(域填充)。每个 stub 域的真实实现都要 1-2 周,且优先级需要排序(Insight cost > Schedule cron > Memory Vector > IM real SDK)。

---

## 3. 距离"agent 对话平台"目标差距

用户原话: "skills / mcp / 知识库 / 数据库 / 沙箱 / 代码能力超越 Claude Code / 进化能力超越 Hermes / 拳打 workbuddy / 脚踢 openclaw"

| 用户原承诺 | PiPiClaw 现状 | 完成度 | 关键缺失 |
|---|---|---:|---|
| **skills** | SkillLoader + Runtime + Chain + Versioning 在;Signer/AutoCreator 是 stub | 60% | AutoCreator 不调 LLM,Signer 硬编码 HMAC |
| **mcp** | ❌ 没有任何 MCP 协议支持 | **0%** | Model Context Protocol server/client 全无 |
| **知识库** | HermesMemory (markdown) + HermesAdapter (vector) 在 | 50% | Vector store 无持久化,EmbeddingService SHA-256 伪向量,无 bge-m3 |
| **数据库** | ❌ 只有 JSON config + in-memory Map | **0%** | 无 sqlite / PostgreSQL / 向量数据库 |
| **沙箱** | 3 平台 stub (bwrap/seatbelt/windowsJob) 在;IPC stub | 20% | SandboxBuilder / WebContainer 都没真接 |
| **代码能力** | ExecutionEngine stub,ToolRegistry 空 | 10% | 无真 tool call loop,LlmAgentBrain 死代码 |
| **超越 Claude Code** | ❌ | **~25%** | Claude Code 有真 terminal / 真 tool call / 真 file ops / 真实 streaming;PiPiClaw 这些全是 stub 或装饰 |
| **超越 Hermes** | (Hermes 仅指本项目记忆子系统) | 70% | HermesMemory 文件系统 OK,vector 部分是装饰 |
| **拳打 workbuddy** | 未知(未提供 workbuddy 对比) | N/A | — |
| **脚踢 openclaw** | (openclaw 是本项目内部门户) | ✅ 100% trivially | — |

### 总结: **距离 30-40% 完成度**

- ✅ **能跑通**: 基础 Chat (3 provider, 非流式) / 手动 Skill 加载 / IM 5 平台真接 / 3 平台 sandbox stub / 配置 / 主题 / i18n
- ❌ **不能跑通**: 真 tool call / 真 sandbox 隔离 / 真实向量记忆 / 真定时任务 / 真 skill 自动生成 / 任何 MCP 集成 / 任何数据库持久化
- ⚠️ **宣传与实际差距巨大**: "5 provider 统一" 实际是 2 套分裂;"11 平台 IM" 实际 5 真 6 假;"CapabilityRegistry 能力域" 实际 0 域;"Evolution 进化" 实际 SelfLearner 只是统计

**最关键的差距是 MCP**: Claude Code / Cursor / Cline 的核心是 MCP tool 生态,PiPiClaw 这块是 0。30 天路线图必须把 MCP server/client 列为 P0。

---

## 4. ship-readiness 评估 (v4.4.0)

### 能否开箱即用给真实用户?

# **不能。必须先修 critical 再 ship。**

| 维度 | 状态 | 真实用户场景 |
|---|---|---|
| 安装 | ✅ | electron-builder 出 88.89MB Setup.exe,已签名 |
| 启动 | ✅ | smoke 22/22,主流程 5.86s vite build |
| 配置 LLM | ✅ | safeStorage 加密 3 provider,UI 配 API key |
| 基础聊天 | ✅ | 3 provider 实接,流式可(走旧 ModelManager) |
| **真 agent 能力** | ❌ | tool call loop 不可用,执行命令要 shell 注入风险 |
| **权限管理** | ❌ | 用户选"安全模式"被启动代码强制覆盖为 permissive |
| **IM 集成** | ⚠️ | Feishu/DingTalk/WechatWork 真接;6/11 平台配了 healthCheck 永远 false |
| **定时任务** | ❌ | daily/weekly/monthly 触发一次后永远停 |
| **成本面板** | ❌ | Dashboard 显示 0 USD,Insight IPC 全 stub |
| **Skill 自动生成** | ❌ | W6 stub,不调 LLM |
| **跨平台** | ⚠️ | Windows 主战 OK,Linux/MacOS 实际 e2e 未跑通 |

### 真实用户会遇到的 5 类问题(开箱即踩)

1. **Schedule.vue 编辑/删除按钮不响应**: 运行时 `ReferenceError: row is not defined`,用户配的定时任务只能看不能改
2. **6 个 IM 平台用户配了发现 healthCheck 永远 false**: 以为是 bug,实际是 stub
3. **配了 5 个 sandbox 平台看到全 stub 提示**: 任务文档说"sandbox 隔离",实际是占位
4. **任何安全模式选择都不持久**: 用户以为自己在"安全模式"跑,实际每次启动被强制 permissive
5. **想用 deepseek / ollama 找不到配置**: 任务文档说 5 provider,实际只有 3

### 建议 ship 策略

- **v4.4.0** (建议名 `v4.3.1`): 仅修 Schedule.vue + critical 安全 (C1+C2+C3+C4) + routes-render 集成测试 → 1 周内 ship 给内部 dogfooding 用户
- **v4.4.0** (真正): 修完 P0 + 统一 LLM 抽象 + 删 IM stub → 6 周 ship 给早期真实用户
- **v4.5.0**: 加 MCP + 真 vector 记忆 + 真 agent 接入 → 3 月 ship 给生产

---

## 5. 未来 30/90/180 天路线图

### 📅 30 天 — "能用的 v4.4.0" (ship 真实用户)

**目标**: 修所有 critical 安全 + 删所有 stub UI 入口 + 测试基础设施完整

1. **安全 P0 必修** (5 天)
   - 任务: OpenClawServer 加随机 token (X-OpenClaw-Token header) + CORS 锁定 file:// origin;runCommand 改 spawn + 白名单 + cwd 沙箱;PermissionConfig 默认 opt-in permissive(改环境变量);SkillSigner 改 Ed25519 + safeStorage 私钥
   - Ship 物: 安全 audit 通过 + 4 处 critical 修复 commit + 回归测试
   - 验收: 同机恶意软件无法触发 18789 端点;用户安全模式持久化

2. **Schedule.vue + 集成测试 fix** (2 天)
   - 任务: 修 `src/views/Schedule.vue:46-48` 三处 `row` → `scope.row`;加 vitest `webServer` 配置启 vite
   - Ship 物: 916/916 vitest pass + B1 回归保护恢复
   - 验收: `npm test` 一键跑,无 dev server 也能让 11 个 routes-render 测试 pass

3. **统一 LLM 抽象基础** (10 天)
   - 任务: LlmClient 加 SSE 流式 (`fetch.body.getReader()`) + AbortController + 指数退避 retry;加 DeepSeek / Ollama / 自定义 OpenAI 兼容 adapter;ChatManager 流式路径切到 LlmClient
   - Ship 物: 5 provider 真统一,带流式 + 取消 + 重试
   - 验收: 切 provider 不用改 ChatManager 代码;长对话网络中断能恢复

4. **删/降级所有 stub 域** (5 天)
   - 任务: IM 6 个 stub channel (Lark/QQ/WeChat/Telegram/Slack/Rocket) 改成"即将上线" UI 灰按钮;Insight cost:cost:today 改成读 CostTracker.getTodayCost();Sandbox:run/preview/stop 改成"功能开发中"或 WebContainer 真接二选一
   - Ship 物: 用户配置页不出现"配了不工作"的按钮;Dashboard 至少显示真实数字
   - 验收: 用户配任何 IM 平台后 healthCheck 真实反映可用/不可用

5. **vendor 拆 chunk + i18n 硬编码清理** (3 天)
   - 任务: vite 加 `manualChunks` 拆 vue / element-plus / pinia;templates 硬编码 CJK 抽样 50 处改 `t('xxx')`
   - Ship 物: vendor-framework 1.1MB → 600KB;英文模式不再有中文硬编码
   - 验收: vite build 警告 0;en-US 模式全英文

6. **真实 LLM 链路 CI 化** (3 天)
   - 任务: GitHub Actions 加 service container 启 ollama;跑 `e2e-real-llm.mjs` 子集
   - Ship 物: CI 真实链路 smoke 自动跑
   - 验收: 每次 PR 至少 1 个真 LLM 端到端测试

**30 天 ship 物清单**:
- 4 critical 修完 + 916/916 tests + 5 provider 流式 + 0 stub UI + vendor 拆分 + 真实 LLM CI

---

### 📅 90 天 — "真正 agent 平台 v4.5.0" (ship 早期生产)

**目标**: 修所有 major + 真 agent 接入 Chat 流 + 真向量记忆 + CapabilityRegistry 真注册

1. **AgentBrain 真接 Chat 流** (3 周)
   - 任务: ChatManager.handleNormalChat 之前加钩子,如果 registeredAgent 存在,优先用 `agent.think()` 生成 Decision.payload.text 当作占位 content;ToolRegistry 填入 file/shell/browser 真实工具调用循环;AgentRecovery checkpoint/restore 真接
   - Ship 物: 一次对话可以调用 file_read / shell / browser 工具 + 自动多步推理
   - 验收: "帮我整理 Downloads 文件夹按日期" 能真做到(Claude Code 等级)

2. **MemoryVectorStore 真持久化** (2 周)
   - 任务: 接 sqlite-vss + OpenAI ada-002 / Ollama bge-m3 embedding API;ChatManager 切到 HermesAdapter.recall() 替换旧 buildMemoryPrompt
   - Ship 物: 跨 session 真向量记忆,bge-m3 1024 维
   - 验收: 6 个月前的对话内容能被向量召回

3. **CapabilityRegistry 真注册 + 链路追踪** (1 周)
   - 任务: LlmAgentBrain / HermesAdapter / SkillLoader / ChannelRouter / Sandbox 各自显式 register 进 CapabilityRegistry;加 trace_id 链路追踪
   - Ship 物: `agent:list` IPC 返回真实域列表 + 跨域调用链路可视化
   - 验收: Dashboard 看到 6+ 域 + 每次 LLM 调用能看到走了哪些能力

4. **ScheduleTask 真正定时** (1 周)
   - 任务: executeTask 末尾 `if (task.scheduleType !== 'once') startTask(id)`;加 cron 解析 (cron-parser)
   - Ship 物: daily/weekly/monthly/cron 真定时,UI 显示下次触发时间
   - 验收: 配 daily 9am 任务,真能每天 9 点跑

5. **Sandbox 真接** (1 周)
   - 任务: 选一条路径(推荐 WebContainer,因为 Electron 内嵌无系统依赖);写 `electron/sandbox/SandboxBuilder.ts` 真接;`sandbox:run` IPC 真返回结果
   - Ship 物: 用户在 Chat 里说"跑这段 Python",真能在隔离环境跑 + 返回 stdout
   - 验收: Docker/WindowsJob/Linux bwrap 三平台 e2e 跑通

**90 天 ship 物清单**:
- 真 tool call loop + 真向量记忆 + CapabilityRegistry 真注册 + 真定时 + 真 sandbox + 跨 session 进化

---

### 📅 180 天 — "v5.0.0 超越 Claude Code 基线" (ship 生产)

**目标**: MCP 协议 + Evolution 进化 + 多端同步 + 真数据库 + openclaw 平台

1. **MCP 协议集成** (4 周)
   - 任务: 集成 `@modelcontextprotocol/sdk`,实现 MCP server + client;支持 tools / resources / prompts 三类原语;ChatManager 在 tool_call 循环里调 MCP server
   - Ship 物: PiPiClaw 可以作为 MCP client 调用任意 MCP server(类似 Claude Desktop / Cursor)
   - 验收: 装一个 GitHub MCP server,Chat 里能"创建一个 issue" 调真 API

2. **Evolution 进化能力** (3 周)
   - 任务: SelfLearner 真接 LLM;从对话历史统计 → 自动生成 skill 模板 → 用户审核后入 skill 库;skill 使用反馈回写 SelfLearner
   - Ship 物: 用 PiPiClaw 一周后,自动出现 5+ 个 "我刚刚学到的" skill
   - 验收: 配好 workflow 7 天,ClawHub 出现 5+ auto-generated skill

3. **多端同步 + 协作** (3 周)
   - 任务: Hermes Memory 同步到云(S3 / 自托管 minio);多用户协作 (基于 WebSocket);session 状态序列化
   - Ship 物: 在 A 电脑对话,5 分钟后 B 电脑能看到 + 继续
   - 验收: 切换设备能续接对话(类似 Cursor)

4. **真数据库层** (2 周)
   - 任务: JSON config → sqlite + Drizzle ORM;记忆 / 任务 / 消息 / skill 入库
   - Ship 物: 数据持久化 + 事务 + 索引
   - 验收: 1 万条消息库查询 < 50ms

5. **openclaw 平台化** (4 周)
   - 任务: openclaw 18789 端点文档化;支持第三方 skill marketplace;partner SDK
   - Ship 物: 第三方开发者能为 PiPiClaw 写 skill 并发布
   - 验收: 有 1 个第三方写的 skill 上 ClawHub 且能正常用

**180 天 ship 物清单**:
- MCP 生态 + Evolution 进化 + 多端同步 + sqlite 持久化 + 开放平台

---

## 6. 诚实总结

**PiPiClaw v4.4.0 是一个工程化骨架扎实、UI 完成度高、测试基础设施完善,但核心能力大量是 stub 的 Electron 应用。**

### 能用 (可以现在就用)
- ✅ **基础 LLM 聊天**: 3 provider 实接,UI 美观,i18n 双语,主题切换
- ✅ **手动 Skill 加载**: 75+ 内置 skill 可加载/启用
- ✅ **5 个真实 IM 平台**: 飞书 / 钉钉 / 企业微信 / Discord / WhatsApp
- ✅ **配置管理**: API key safeStorage 加密 (Win/macOS) + 权限 5 模板
- ✅ **基础多平台**: Windows 主战场 OK,MacOS/Linux 框架在
- ✅ **CI 严谨**: 3 OS matrix + 8 步 + icon/CSP 防线
- ✅ **测试覆盖**: 916 unit + 139 e2e + 22 smoke + 真实 LLM 脚本

### 不能用 (现在不能给真实用户)
- ❌ **真 agent 能力**: tool call loop 不可用,ExecutionEngine stub
- ❌ **真 sandbox 隔离**: 3 平台都有 stub 文件,但 IPC 全返回 stub
- ❌ **真定时任务**: daily/weekly/monthly 触发一次后永远停
- ❌ **真向量记忆**: SHA-256 伪向量,重启清空,无 bge-m3
- ❌ **真 skill 自动生成**: AutoCreator W6 stub,不调 LLM
- ❌ **真权限管理**: forceResetToPermissive 每次启动覆盖用户选择
- ❌ **IM 6/11 平台**: Lark / QQ / WeChat / Telegram / Slack / Rocket 全 stub
- ❌ **MCP 协议**: 完全 0,没有 Model Context Protocol 支持
- ❌ **数据库**: 只有 JSON config + in-memory Map
- ❌ **真实 LLM 链路 e2e**: CI 不强制,只在本地开发者手跑

### 必须做 (按优先级)
1. **本周**: 修 4 critical 安全 (CORS+shell+permissive+HMAC) + Schedule.vue 3 个 type error
2. **下周**: LLM 抽象统一 (ChatManager → LlmClient) + 5 provider 真接流式
3. **本月**: 删/降级 6 个 IM stub + 真实向量记忆 + CapabilityRegistry 真注册
4. **下季**: AgentBrain 真接 Chat 流 + 真 sandbox + MCP 协议
5. **半年**: 多端同步 + Evolution 进化 + openclaw 平台

### 给用户的话

PiPiClaw 的**骨架好得超出预期** — Vue 3 / Element Plus / TS strict / safeStorage / contextBridge / electron-updater / CI matrix 全部到位,代码组织比大部分开源 Electron 项目更工程化。

但**核心能力"宣传 > 现实"**: 任务文档说的 "5 provider 统一" "11 平台 IM" "CapabilityRegistry 能力域" "Evolution 进化" "沙箱隔离" — 60% 是 stub 占位,不是真实现。**这不是不能 ship,是要诚实标 stub,然后分批实现**。

如果目标是 30 天内给内部 dogfooding 用户用 → 修 critical + Schedule.vue + LLM 统一就够了。
如果目标是 90 天内给真实用户用 → 还要加真 agent + 真向量记忆 + 真定时。
如果目标是 180 天内"超越 Claude Code / 拳打 workbuddy" → 必须加 MCP + 平台化,这是当前最缺的一块。

**评分 6.5/10 不是差,是中间态。** 修完 30 天路线图能到 7.5-8,修完 90 天能到 8.5,修完 180 天才能到 9+ 真正"agent 平台"。现在把它当"半成品"对待,不要当"完整品"宣传。

---

**报告路径**: `D:\pipiclaw\piclaw\docs\audit\05-final-report.md`
**审计耗时**: 4 子报告交叉 + 综合评审 30 分钟
**数据源**: 4 份子报告 + 4 子报告均基于实跑命令 (`vue-tsc` / `eslint` / `vitest` / `vite build` / `smoke-test.mjs` / `electron-builder` 输出)
