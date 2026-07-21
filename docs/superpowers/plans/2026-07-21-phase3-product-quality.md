# PiPiClaw 后续 3 Phase 战略规划(Phase 3 / 4 / 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 PiPiClaw 从"工程基线 4.5/5 + 产品完成度 3/5"提升到"工程 4.5/5 + 产品 4/5"的全量 alpha 状态 — 修复真正的功能断点、补齐测试覆盖、加固安全、提升发布体验。

**Architecture:** 3 phase 并行推进,每个 phase 内部 4-6 个串行 task:
- **Phase 3 产品完整化**(~ 3-4 周): 修补功能断点 + 测试覆盖 + 安全加固
- **Phase 4 跨平台发布就绪**(~ 2-3 周): macOS/Linux 验证 + 真 E2E + auto-update
- **Phase 5 GA 公开发布**(~ 1-2 月): 完整 i18n + 性能优化 + 文档完整

**Tech Stack:** Electron 28 / Vue 3.4 / Pinia 2 / Vite 5 / TypeScript 5 / Element Plus 2 / vitest / Playwright / electron-builder 24

---

## 0. 重新诊断(2026-07-21 实测)

之前 [Phase 1 retro](2026-07-17-phase1-engineering-hygiene.md) 和 [Phase 2 retro](2026-07-21-phase2-vue-tsc-zero/retro.md) 列了一些 de-scope 项,实测后**部分已经过时**:

### 0.1 已实际实现(从 de-scope 列表移除)

| 项 | Phase 1 retro 写 | 实测状态 |
| --- | --- | --- |
| LLM 流式输出 SSE | de-scope | ❌ **链路断**:`ChatManager` 内部有 `streamAnthropic/Ollama/CloudProvider` 3 个流方法,但 `broadcastMessage` 只发整条消息,**没逐 chunk 调** `webContents.send('chat:onStreamUpdate')`;preload 暴露了 `onStreamUpdate`,前端订阅了 — **链路完整但中间断一环** |
| WebContainerRunner renderer 真接 | de-scope | ✅ `src/views/D2PrimeDemo.vue` 已接 WC + PortForwarder + SandboxBuilder + 4 templates 都真接(Phase 1 retro 旧描述) |
| Hermes 自我学习 AutoCreator 闭环 | de-scope | ✅ `electron/learning/SelfLearner.ts` 831 行,`analyzeAndGenerateSkill` + `generateSkillProposalFromAnalysis` 真接 |
| P7 sandbox 框架 | de-scope | ✅ `electron/sandbox/` 下 5 个核心模块 + 4 templates + L1 3 platforms + NetworkPolicy + ResourceLimits + WebContainerRunner + JupyterRunner 全部实接(Phase 1 retro 旧描述) |
| 11 IM channel 8 placeholder | de-scope | ✅ `electron/channel/` 11 个 channel 文件 + `IMConfigStore` + `IMMessageRouter` + `IMPermissionManager` + `IMSecurityManager` 都实接 |

### 0.2 真阻断(必须修)

| 阻断 | 详情 |
| --- | --- |
| **B1 LLM 流式推送链路断** | 见上表,需要 ChatManager streamModelResponse 内每个 chunk 调 webContents.send |
| **B2 TaskExecutor 没接** | chat store 的 `confirmExecuteTask` 是 stub,只切 state;TaskExecutor 业务功能未触发 |
| **B3 safeStorage apiKey 明文** | `LlmConfigStore.persistToDisk` 直接 `fs.writeFileSync` 明文,违反常识 |
| **B4 src/views 0% coverage** | 19 views + 12 components 任何 bug 上线后才暴露 |
| **B5 src/stores 0% coverage** | 12 Pinia store 行为没单测保护 |
| **B6 electron/llm 0% coverage** | LlmClient + 3 adapter + LlmConfigStore 完全无测试 |
| **B7 E2E 全 placeholder** | 20 spec 都是 `test.skip` + `expect(...).toBe(...)` 数学恒等 |
| **B8 devDep 多 high vuln** | electron / esbuild / brace-expansion 等 |

### 0.3 缺失的产品能力

| 项 | 详情 |
| --- | --- |
| M1 macOS/Linux build 未验证 | electron-builder.json5 只配 `win` target,mac/linux 没测过 |
| M2 Electron icon 缺失 | exe 用 Electron 默认图标 |
| M3 auto-update channel 未配置 | latest.yml 已生成但 publish 缺 GH_TOKEN,无真更新流程 |
| M4 CHANGELOG 缺 v2.0.3+ | Phase 2 收尾无 CHANGELOG entry |
| M5 Phase 2 retro 链接未加 README 索引 | 文档不完整 |
| M6 Vue i18n 仅 locale 文件无实接 | `src/locales/{zh-CN,en-US}.ts` 存在但未 vue-i18n 注册 |
| M7 coverage step 未上 CI | vitest run 没加 `--coverage` + threshold |

---

## Phase 3: 产品完整化(3-4 周)

**目标:** 修 B1-B8 真阻断 + M4-M7 文档/构建修补,工程完整度 4.5/5 提升到 5/5,产品从 3/5 提升到 3.5/5。

### Task 1: 修复 LLM 流式推送链路(B1)

**Files:**
- Modify: `electron/chat/ChatManager.ts:482-580` (streamAnthropic 内部)
- Modify: `electron/chat/ChatManager.ts:650-720` (streamOllama 内部)
- Modify: `electron/chat/ChatManager.ts:768-840` (streamCloudProvider 内部)
- Modify: `electron/preload.ts:725-735` (新增 `chat:onStreamChunk` IPC 事件)
- Test: `tests/unit/ChatManager.stream.test.ts`(新建)

**根因:** `streamModelResponse` 内部累积 buffer,只在 final flush 时调 `broadcastMessage` 整条发。`onStreamUpdate` 在 preload 暴露但没真发出去。

**修复方法:**
1. ChatManager 加 `broadcastStreamChunk(conversationId, messageId, chunk)` private method,调用 `w.webContents.send('chat:onStreamChunk', { conversationId, messageId, chunk })`
2. 3 个 stream 方法内每收到一个 SSE data 行就调 `broadcastStreamChunk` 发增量
3. 流结束时调 `broadcastMessage` 发最终完整消息(降级兼容现有 handler)
4. preload 加 `onStreamChunk` 事件订阅
5. src/stores/chat.ts `initialize()` 加 `unsubscribeStreamChunk = electronAPI?.chat?.onStreamChunk(...)` 处理 token-by-token 更新

**验证:**
- 单元测试:mock `webContents.send`,断言每个 SSE 行都触发 send('chat:onStreamChunk', ...)
- 集成测试:`tests/integration/chat-stream.test.ts` 起 mock LLM server,跑通 ChatManager → IPC → store 全链路
- 手动验证:`npm run dev`,发消息,UI 显示逐 token 出现(不是整段跳出来)

**完成条件:**
- `npm run test` 新增 4 个 test(3 stream method + 1 store handler),192+4=196/196
- `npm run dev` 聊天流式 token-by-token 真实可见
- 1 commit `fix(chat) real LLM SSE stream push via chat:onStreamChunk`

---

### Task 2: 接入 TaskExecutor 真实任务执行(B2)

**Files:**
- Modify: `src/stores/chat.ts:170-178` (chat store confirm/cancel 方法)
- Modify: `src/views/Chat.vue:1393-1400` (handleSubmit 调用方)
- Modify: `electron/task/TaskExecutor.ts`(确认入口已暴露)
- Test: `tests/unit/chat-task-flow.test.ts`(新建)

**根因:** Phase 2 加的 `confirmExecuteTask` 只切 state,不调 TaskExecutor。

**修复方法:**
1. `confirmExecuteTask` 内部:`pendingTaskPlan.value` → 通过 `electronAPI.task.execute(plan)` 触发主进程
2. 主进程 `electron/task/TaskExecutor.ts` 接收 plan → 跑 steps → 实时 broadcast 每步状态 → UI 收到后更新 `currentTaskResult`
3. `cancelExecuteTask` 通过 `electronAPI.task.cancel(taskId)` abort AbortController
4. Chat.vue 已有 TaskResultCard 组件(Phase 2 已共享 TaskStepResult type),只需接 `currentTaskResult` reactive 数据

**验证:**
- 单元测试:`confirmExecuteTask` mock `electronAPI.task.execute`,断言传递 plan 参数正确
- 集成测试:跑 task plan,断言每步结果都能进入 currentTaskResult
- 手动验证:用户输入任务 → 弹出 plan 预览 → 确认 → 执行 → UI 显示步骤结果

**完成条件:**
- 196+2=198/198 通过
- Chat.vue 真能跑任务(文件操作 / shell 命令 / URL 打开 3 种 step type)
- 1 commit `feat(task-execution) wire chat store confirmExecuteTask to TaskExecutor`

---

### Task 3: LlmConfigStore + IMConfigStore safeStorage 加密(B3)

**Files:**
- Modify: `electron/llm/LlmConfigStore.ts:62-69` (persistToDisk 改用 safeStorage)
- Modify: `electron/channel/IMConfigStore.ts` (类似)
- Modify: `electron/main.ts`(确保 app.whenReady 后才用 safeStorage)
- Test: `tests/unit/LlmConfigStore.encryption.test.ts`(新建)
- Docs: `CHANGELOG.md` v2.0.3 entry

**根因:** `fs.writeFileSync(this.storePath, JSON.stringify(...))` 直接明文,apiKey 一旦泄露即暴露。

**修复方法:**
1. `electron/main.ts` boot 检查 `app.isReady()`,确认 `safeStorage.isEncryptionAvailable()`
2. LlmConfigStore.persistToDisk:`const buf = safeStorage.encryptString(JSON.stringify(...))`,写 `<file>.enc`
3. loadFromDisk:读 `.enc` 文件 → `safeStorage.decryptString(buf)` → JSON.parse
4. IMConfigStore 同模式
5. 旧明文文件兼容:启动时检测到旧 `llm-config.json` → 读取 → 重新加密写 `.enc` → 删旧文件

**验证:**
- 单元测试:mock safeStorage,断言写入的是 `Buffer` 不是 string
- 手动验证:`npm run dev` → 配置 apiKey → 看 `userData/llm-config.json.enc` 是二进制不是 JSON

**完成条件:**
- 198+2=200/200 通过
- 用户磁盘上 apiKey 不再明文
- 1 commit `feat(security) safeStorage encrypt LlmConfigStore and IMConfigStore`

---

### Task 4: src/stores 单元测试(B5)

**Files:**
- Create: `tests/unit/stores/chat.test.ts`(新建,~150 行)
- Create: `tests/unit/stores/models.test.ts`(新建,~120 行)
- Create: `tests/unit/stores/permissions.test.ts`(新建,~100 行)
- Create: `tests/unit/stores/schedule.test.ts`(新建,~80 行)
- Create: `tests/unit/stores/gateway.test.ts`(新建,~80 行)

**根因:** src/stores 12 个文件 0% coverage,行为完全靠手动验证。

**修复方法:**
- 用 `@vue/test-utils` `setActivePinia(createPinia())` 创建测试环境
- 每个 store 测 3-5 个核心方法(getter/setter + 异步 action)
- Chat store 测试覆盖:sendMessage mock / conversations 切换 / streaming 状态
- Models store 测试:provider 切换 / 模型禁用 / 默认模型 fallback
- Permissions store 测试:permission set CRUD / 模板切换 / 规则编辑
- Schedule store 测试:定时任务 CRUD / cron 解析 / 历史加载
- Gateway store 测试:状态切换(starting/running/stopping) / 端口查询

**验证:**
- 全部测试 `npm run test` 通过
- vitest --coverage:`src/stores` 从 0% 提升到 ≥ 70%

**完成条件:**
- 200+30=230/230 通过
- src/stores coverage ≥ 70%
- 1 commit `test(stores) add 5 store unit tests covering 70%+ behavior`

---

### Task 5: src/views 单元测试(B4)

**Files:**
- Create: `tests/unit/views/LlmConfig.test.ts`(新建,~100 行)
- Create: `tests/unit/views/Permissions.test.ts`(新建,~100 行)
- Create: `tests/unit/views/ImAccounts.test.ts`(新建,~100 行)
- Create: `tests/unit/views/Settings.test.ts`(新建,~80 行)

**根因:** 19 views 0% coverage,UI 行为无保护。

**修复方法:**
- `@vue/test-utils` `mount()` + jsdom 环境
- 每个 view 测 2-3 个核心场景:挂载成功 + 关键表单校验 + store 交互
- LlmConfig view:provider 切换 / apiKey 校验 / 测试连接按钮
- Permissions view:模板切换 / 规则编辑 / 持久化
- ImAccounts view:channel 启用 / credentials 配置 / 测试连接
- Settings view:通用设置变更

**验证:**
- 230+12=242/242 通过
- vitest --coverage `src/views` 从 0% → ≥ 40%

**完成条件:**
- 242/242 通过
- src/views coverage ≥ 40%(完整单测太重,component test 是更轻替代)
- 1 commit `test(views) add 4 critical view unit tests`

---

### Task 6: electron/llm 单元测试(B6)

**Files:**
- Create: `tests/unit/LlmConfigStore.test.ts`(新建,~150 行)
- Create: `tests/unit/LlmClient.test.ts`(新建,~120 行)
- Create: `tests/unit/llm-adapters.test.ts`(新建,~150 行,3 adapter 通用)

**根因:** LlmClient 52 行 + 3 adapter + LlmConfigStore 70 行全部 0% 覆盖。

**修复方法:**
- mock `app.getPath('userData')` + `fs`(让 LlmConfigStore 不真写盘)
- LlmConfigStore:get/set/list/getActive/remove/loadFromDisk/persistToDisk 全测
- LlmClient:mock 3 adapter,断言按 provider 选择正确 + 错误处理 + active fallback
- Adapter:mock `https.request`,断言请求 URL/headers/body 正确 + SSE 解析

**验证:**
- 242+12=254/254 通过
- vitest --coverage `electron/llm` 从 0% → ≥ 60%

**完成条件:**
- 254/254 通过
- electron/llm coverage ≥ 60%
- 1 commit `test(llm) add LlmConfigStore + LlmClient + adapters unit tests`

---

### Task 7: 修复 devDep 安全漏洞(B8)

**Files:**
- Modify: `package.json`(依赖版本调整)
- Modify: `package-lock.json`(同步)
- Docs: `CHANGELOG.md` v2.0.3 entry

**根因:** `npm audit` 显示多个 high vuln:electron(asar integrity / use-after-free)/ esbuild(开发服务器) / brace-expansion(DoS)。

**修复方法:**
- `npm audit fix` 优先(自动)
- electron:升级到 `^29.x` 或 `^30.x`,能修大部分 use-after-free。需测试 vite-plugin-electron 兼容性
- esbuild:`npm audit fix --force` 会升 vite 到 8.x,breaking change。可选:锁定 `esbuild@^0.25` 单包升级
- brace-expansion:升级到 `^2.1.2`,transitive 难处理;或 `npm overrides`
- 生产依赖(`--omit=dev`)已 0 vuln,这是 dev-only 风险,可降级 known issue

**验证:**
- `npm audit`(含 dev):vuln 数量减半(从 ~20 到 ~10)
- `npm run lint / test / build` 全过

**完成条件:**
- vuln 减少 ≥ 50%
- 全套验证通过
- 1 commit `chore(deps) npm audit fix electron + esbuild + overrides brace-expansion`

---

### Task 8: Phase 3 收尾(M4-M7 + 文档 + CI)

**Files:**
- Modify: `CHANGELOG.md`(加 v2.0.3 entry)
- Modify: `README.md`(加 Phase 2/3 retro 链接 + i18n 进度标注)
- Modify: `package.json`(bump 2.0.3)
- Modify: `.github/workflows/ci.yml`(加 `npx vitest run --coverage` step)
- Modify: `vitest.config.ts`(coverage threshold 70% electron + 40% src)
- Create: `docs/superpowers/retros/2026-07-21-phase3-product-quality/retro.md`
- Create: `docs/superpowers/retros/2026-07-21-phase3-product-quality/checklist.md`

**根因:** Phase 3 完整闭环需要文档同步 + CI coverage step + version bump。

**修复方法:**
1. CHANGELOG 加 `## [2.0.3] - 2026-07-21` entry,列 7 个 feat + test + chore
2. README 加 Phase 2 retro + Phase 3 retro 链接到文档索引
3. package.json bump 到 2.0.3
4. CI 加 coverage step:`npx vitest run --coverage` + `if coverage < 70% electron / 40% src: exit 1`
5. vitest.config.ts 加 threshold:`coverage: { thresholds: { 'electron/**': { lines: 70 }, 'src/stores/**': { lines: 70 }, 'src/views/**': { lines: 40 } } }`
6. 写 Phase 3 retro 总结

**验证:**
- 254/254 + 1 lint + 1 vue-tsc + 1 build 全过
- coverage step 上 CI 红色拦截 regression

**完成条件:**
- git tag v2.0.3
- 1 commit `chore(release) v2.0.3 changelog + ci coverage step + docs update`

---

### Phase 3 交付汇总

| 指标 | Before (Phase 2 末) | After (Phase 3) |
| --- | --- | --- |
| vue-tsc | 0 | 0 |
| lint warnings | 0 | 0 |
| unit test count | 192 | 254 (+62) |
| coverage (lines) | 18.97% | ~50% |
| src/stores coverage | 0% | ≥ 70% |
| src/views coverage | 0% | ≥ 40% |
| electron/llm coverage | 0% | ≥ 60% |
| LLM 流式 token-by-token | 断 | ✅ 链路通 |
| TaskExecutor 业务执行 | stub | ✅ 真接 |
| apiKey 加密 | 明文 | ✅ safeStorage |
| devDep vuln | ~20 | ≤ 10 |
| CHANGELOG v2.0.3 | 无 | 有 |
| CI coverage step | 无 | 有 |
| git tag v2.0.3 | 无 | 有 |

**总 commit 数**:8 (1/feat per task)

---

## Phase 4: 跨平台发布就绪(2-3 周)

**目标:** macOS/Linux build 真验 + 真 E2E + auto-update 流程 + Electron icon,工程达到"任意平台能发"水平。

### Task 1: macOS build 验证 + 签名

**Files:**
- Modify: `electron-builder.json5`(加 `mac` + `linux` target)
- Create: `resources/icon.icns`(Apple Icon)
- Create: `resources/icon.png`(512x512 PNG for Linux)
- Docs: `README.md` 加 macOS 构建说明

**根因:** `electron-builder.json5` 只有 `win` target,mac/linux 没配置过。

**修复方法:**
1. 加 `mac.target: [{ target: dmg, arch: [x64, arm64] }]`(Apple Silicon + Intel)
2. 加 `mac.identity: null`(本地测试无签名,CI 用 env var `CSC_LINK` + `CSC_KEY_PASSWORD`)
3. 加 `linux.target: [{ target: AppImage, arch: [x64] }]`(便携)
4. icons:准备 `.icns`(macOS)+ `.png 512x512`(Linux)
5. README 加 `npm run build:mac` / `npm run build:linux` 说明

**验证:**
- 在 macOS runner 跑 `npm run build:mac`,产物 `.dmg` 可安装
- 在 Linux runner 跑 `npm run build:linux`,产物 `.AppImage` 可运行

**完成条件:**
- 3 平台 build 在 CI matrix 跑通
- 1 commit `feat(build) macOS dmg + Linux AppImage targets`

---

### Task 2: 替换 Electron 默认 icon(M2)

**Files:**
- Create: `resources/icon.ico`(Windows)
- Create: `resources/icon.icns`(macOS)
- Create: `resources/icon.png` 512x512(Linux)
- Modify: `electron-builder.json5`(加 `icon: 'resources/icon.${ext}'` 或 per-platform)

**根因:** 当前 exe 用 Electron 默认图标,产品感弱。

**修复方法:**
- 设计 PiPiClaw logo(简单 claw + AI 抽象图标,512x512 起步)
- 转 3 平台格式(electron-builder docs 列出 macOS 需 `.icns`,Windows 需 `.ico`,Linux 需 `.png`)
- electron-builder.json5 配 per-platform icon 路径

**验证:**
- Windows build 后看 PiPiClaw.exe 资源管理器图标 = 自定义
- macOS dmg 安装后看 App 图标 = 自定义

**完成条件:**
- 3 平台图标正确显示
- 1 commit `feat(build) custom electron icon 3 platforms`

---

### Task 3: 真 E2E(B7) — 用 Playwright 真接 Electron renderer

**Files:**
- Modify: `playwright.config.ts`(启动 Electron app 而非 webServer)
- Modify: `tests/e2e/chat-agent.spec.ts`(从 placeholder → 真测试)
- Modify: `tests/e2e/d2prime-30s.spec.ts`(需要 docker,允许 skip in CI)
- Modify: `tests/e2e/a5-computer-use.spec.ts`(真测屏幕)
- Modify: `tests/e2e/settings-p7.spec.ts`(真测设置)
- Docs: 标记 `tests/e2e/insight-trace.spec.ts` / `d3-feishu.spec.ts` 仍 placeholder(需凭证)

**根因:** 20 e2e 全 placeholder。

**修复方法:**
1. playwright.config.ts:`webServer.command = 'npm run dev'`,等 Electron 起来后连接
2. 4 个 spec 改真:
   - `chat-agent.spec.ts`:起 mock LLM server → 在 Electron UI 输入 → 验证 streaming → 验证 message 显示
   - `d2prime-30s.spec.ts`:如果 sandbox 不可用 → skip;有 docker → 真测 30s
   - `a5-computer-use.spec.ts`:mock 屏幕截图 → 触发 ActionExecutor → 验证结果
   - `settings-p7.spec.ts`:UI 改设置 → 验证 ConfigStore 持久化
3. 7 个仍 placeholder 但加 `test.skip(true, 'requires credentials or external service')` 标注原因

**验证:**
- `npx playwright test tests/e2e/chat-agent.spec.ts` 4 个真 spec 全过
- 7 个 placeholder spec skip 状态正确

**完成条件:**
- 4/20 spec 真跑通,7/20 明确 skip
- 1 commit `test(e2e) wire 4 critical specs to real Electron app via playwright`

---

### Task 4: Electron auto-update channel(M3)

**Files:**
- Create: `electron/core/AutoUpdater.ts`(新建,~80 行)
- Modify: `electron/main.ts`(注册 AutoUpdater)
- Modify: `electron-builder.json5`(加 `publish` 配置)
- Modify: `src/views/Settings.vue`(显示更新状态)
- Test: `tests/unit/AutoUpdater.test.ts`(新建)

**根因:** latest.yml 已生成但无 update 流程,无 GH_TOKEN,无 UI 提示。

**修复方法:**
1. `electron-builder.json5`:`publish: { provider: github, repo: pipiclaw, owner: chichengzibu }`
2. AutoUpdater.ts:用 `electron-updater`(加进 devDependencies)
   - checkForUpdates 启动时调
   - 监听 `update-available` / `update-downloaded` 事件 → IPC 推到 renderer
   - 用户在 Settings.vue 点"立即重启"→ `autoUpdater.quitAndInstall()`
3. CI matrix 加 `GH_TOKEN` env,electron-builder publish 到 GitHub Release
4. Settings view 加"检查更新"按钮 + "有新版本 v2.0.4 可用"提示

**验证:**
- 单元测试:mock electron-updater,断言事件正确传递
- 手动验证:`GH_TOKEN=xxx npm run build` → 真推到 GitHub Releases → 旧版本能检测到更新

**完成条件:**
- AutoUpdater 接通 + Settings UI 显示状态
- 1 commit `feat(auto-update) electron-updater wired to settings view`

---

### Task 5: 端到端冒烟测试(dev 环境启动验证)

**Files:**
- Create: `scripts/smoke-test.mjs`(新建,~100 行)
- Modify: `package.json`:`scripts.smoke: node scripts/smoke-test.mjs`
- Modify: `.github/workflows/ci.yml`(加 smoke step)
- Docs: `README.md` 加冒烟说明

**根因:** Phase 4 引入跨平台 + 真 E2E 后,需要一个"从零启动到对话"的端到端冒烟测试。

**修复方法:**
1. `smoke-test.mjs`:spawn electron → 等 ready → IPC 验证 LlmConfigStore 可写 → 创建对话 → 注入 mock 流式消息 → 验证渲染 → exit 0
2. CI step:matrix 每平台都跑 smoke
3. README 加 "冒烟测试"段落

**验证:**
- `npm run smoke` exit 0
- 3 平台 CI matrix 全过

**完成条件:**
- 冒烟测试 3 平台 100% 通过
- 1 commit `test(smoke) end-to-end electron app launch verification`

---

### Task 6: Phase 4 收尾(文档 + tag + retro)

**Files:**
- Modify: `CHANGELOG.md` v2.1.0 entry
- Modify: `package.json` bump 2.1.0
- Modify: `README.md`(加 macOS/Linux 构建说明 + auto-update 说明)
- Create: `docs/superpowers/retros/2026-08-phase4-cross-platform/retro.md`
- Create: `docs/superpowers/retros/2026-08-phase4-cross-platform/platform-matrix.md`

**修复方法:**
- 同 Phase 3 Task 8 模式
- platform-matrix.md 记录 Windows / macOS (x64+arm64) / Linux (x64) 6 个 build 的产物大小 + 安装验证

**完成条件:**
- git tag v2.1.0
- 1 commit `chore(release) v2.1.0 changelog + cross-platform build artifacts`

---

### Phase 4 交付汇总

| 指标 | Before (Phase 3 末) | After (Phase 4) |
| --- | --- | --- |
| 平台支持 | Windows only | Win + macOS + Linux 6 build matrix |
| E2E 真跑 | 0/20 | 4/20 真跑 + 7/20 明确 skip |
| Auto-update | 无 | ✅ electron-updater + Settings UI |
| 自定义 icon | 默认 | ✅ 自定义 3 平台 |
| 冒烟测试 | 无 | ✅ scripts/smoke-test.mjs |
| git tag | v2.0.3 | v2.1.0 |

**总 commit 数**:6

---

## Phase 5: GA 公开发布(1-2 月)

**目标:** 从内测 alpha 走到公开 GA — i18n 全量接入、性能 benchmark、商业化准备(可选)。

### Task 1: Vue i18n 全量接入(M6)

**Files:**
- Modify: `src/main.ts`(vue-i18n 注册)
- Modify: `src/App.vue`(添加 i18n 切换器)
- Modify: 所有 `src/views/*.vue` 模板硬编码中文 → `t('key')` 引用
- Modify: `src/locales/zh-CN.ts` / `en-US.ts`(补全缺失 key)
- Test: `tests/unit/i18n.test.ts`(所有 view 至少出现一次 `t(` 调用)

**根因:** locale 文件存在但 main.ts 没注册 vue-i18n,UI 全是中文硬编码。

**完成条件:**
- 整个 src/views 全用 `t('xxx')` 引用
- zh-CN / en-US 两个 locale 文件齐
- 顶栏有语言切换器
- 1 commit `feat(i18n) full Vue i18n integration with zh-CN and en-US`

---

### Task 2: 性能 benchmark(M8)

**Files:**
- Create: `scripts/perf-benchmark.mjs`(启动时间 / 内存 / IPC 响应 / LLM 流式延迟)
- Modify: `.github/workflows/ci.yml`(perf step)
- Create: `docs/perf/baseline.md`(基线数据)

**根因:** 无性能数据,无法量化改进效果。

**完成条件:**
- 4 维度 benchmark 脚本 + CI 阈值
- 1 commit `feat(perf) benchmark suite with ci thresholds`

---

### Task 3: 文档站点化(README → Docusaurus/VitePress)

**Files:**
- Create: `docs-site/`(新建文档站点)
- Modify: `README.md`(精简成入口,详细文档挪走)
- Modify: `package.json` 加 docs script

**完成条件:**
- 公开文档站点可访问
- 1 commit `docs(site) docusaurus setup with phase retros plans and specs`

---

### Task 4: 用户手册 + FAQ

**Files:**
- Create: `docs-site/docs/user-guide/`(新手教程)
- Create: `docs-site/docs/faq.md`
- Create: `docs-site/docs/troubleshooting.md`

**完成条件:**
- 用户指南覆盖 8 capability domain 的"How to"
- 1 commit `docs(user-guide) comprehensive how-to for all features`

---

### Task 5: Phase 5 收尾 + GA tag

**Files:**
- Modify: `CHANGELOG.md` v2.2.0 / v3.0.0(GA marker)
- Modify: `package.json` bump
- Create: `docs/superpowers/retros/2026-XX-phase5-ga/retro.md`
- Create: GitHub Release v3.0.0 GA announcement

**完成条件:**
- git tag v3.0.0 GA
- 1 commit `chore(release) v3.0.0 GA + public release notes`

---

### Phase 5 交付汇总

| 指标 | Before (Phase 4 末) | After (Phase 5) |
| --- | --- | --- |
| i18n | 仅 locale 文件 | ✅ zh-CN + en-US 全量接入 |
| 性能 benchmark | 无 | ✅ 4 维度 + CI 阈值 |
| 用户文档 | 单 README | ✅ 文档站点 |
| 公开 GA tag | 无 | v3.0.0 |

---

## 总战略图

```
Phase 2 末(当前)               Phase 3 末(~3-4 周)            Phase 4 末(~5-7 周)              Phase 5 末(~3 月)
  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
  │ 工程 4.5/5      │         │ 工程 5/5        │         │ 工程 5/5        │         │ 工程 5/5        │
  │ 产品 3/5        │ ──────▶ │ 产品 3.5/5      │ ──────▶ │ 产品 4/5        │ ──────▶ │ 产品 4.5/5      │
  │ coverage 19%    │         │ coverage 50%    │         │ coverage 55%    │         │ coverage 60%    │
  │ 192 tests       │         │ 254 tests       │         │ 254 tests       │         │ 254 tests       │
  │ 1 platform      │         │ 1 platform      │         │ 3 platforms     │         │ 3 platforms     │
  │ v2.0.x 内测     │         │ v2.0.3 内部     │         │ v2.1.0 小范围   │         │ v3.0.0 公开     │
  │                 │         │   alpha          │         │   公开 beta     │         │   GA            │
  └─────────────────┘         └─────────────────┘         └─────────────────┘         └─────────────────┘
        ▲                                                                            │
        │ 内部 alpha 立即可发(策略 A)                                                  │
        │                                                                            │
        └──────────────────── 详细见 "v2.0.1 发布评估" 对话 ────────────────────────┘
```

---

## 优先级建议

### 🔴 立即(本周内)
- **Phase 3 Task 8**: CHANGELOG v2.0.3 + git tag + README 更新(无代码改动,~30 min)
- **Phase 3 Task 4**: src/stores 单测 5 个文件(最高 ROI,纯增量)

### 🟡 短期(1-2 周)
- **Phase 3 Task 1**: LLM 流式推送(最显眼的产品断点,影响所有用户体验)
- **Phase 3 Task 3**: safeStorage 加密(合规 + 安全常识,无理由不做)
- **Phase 3 Task 6**: electron/llm 单测(核心功能无保护是定时炸弹)

### 🟢 中期(1-2 月)
- **Phase 3 Task 2**: TaskExecutor 真接(产品完成度关键)
- **Phase 3 Task 5**: src/views 单测(部分覆盖即可,complete 太重)
- **Phase 3 Task 7**: devDep vuln(可降级 known issue)
- **Phase 4 全部**: macOS/Linux + E2E(等 Phase 3 后用户量起来再做)

### 💡 远期(3 月+)
- Phase 5 全部:GA 准备取决于商业计划

---

## 风险与依赖

### 依赖关系
- Task 2 (TaskExecutor 接) → 依赖 Task 1 (流式通) → 优先 Task 1
- Task 4-6 (单测) → 独立,可并行
- Task 3 (safeStorage) → 独立,优先做(明文 apiKey 是事故)
- Phase 4 → 必须 Phase 3 完成后(否则跨平台 build 会带 Phase 3 修复)

### 风险
- **electron 升级可能破 vite-plugin-electron**:v0.28 已对 electron 28 适配,electron 30+ 兼容性需测
- **macOS 签名**:开发者账号 + 证书非开源用户都有,本地签名可用但 CI 需 secrets
- **auto-update GH_TOKEN**:GitHub Actions secrets 需要 chichengzibu 账号设置
- **真 E2E 跑通率**:4 个真 spec 可能 1-2 个稳定性差(尤其 screen capture),需 flakiness tolerance

### 缓解
- 每个 phase 内部 task 之间有 commit 间隔,任何 task 失败可独立 revert
- Phase 3 单测增量是"incremental coverage gain"而不是 0→100%,避免大爆炸
- Phase 4 E2E 真跑不达预期,保留 placeholder 不强求

---

## 给后续 subagent 的提醒

- **Phase 1 retro 的 de-scope 描述已过时**:实测后发现 LLM 流式链路断在中间、TaskExecutor 是 stub、Hermes 闭环已实接、Sandbox 框架已实接。看 [section 0](#0-重新诊断2026-07-21-实测) 重新校准
- **Phase 3 Task 1 是最高优先级**:LLM 流式推送不修,所有用户聊天体验都有问题
- **safeStorage 加密是无理由不做**:明文 apiKey 是常识级错误
- **每个 task 单独 commit + 4 件套验证**:保持 Phase 1+2 的工程化基线
- **src/views 测试不要全做**:12 个 view 完整单测 ROI 低,挑 4 个关键 view 即可(component test 是更轻替代)
- **electron 升级先读 CHANGELOG**:vite-plugin-electron v0.28 与 electron 30+ 兼容性需要验证

---

## 完成检查表

- [ ] Phase 3 Task 1: LLM 流式推送
- [ ] Phase 3 Task 2: TaskExecutor 接
- [ ] Phase 3 Task 3: safeStorage 加密
- [ ] Phase 3 Task 4: src/stores 单测
- [ ] Phase 3 Task 5: src/views 单测
- [ ] Phase 3 Task 6: electron/llm 单测
- [ ] Phase 3 Task 7: devDep vuln
- [ ] Phase 3 Task 8: 收尾(CHANGELOG + tag + retro)
- [ ] Phase 4 Task 1: macOS/Linux build
- [ ] Phase 4 Task 2: Electron icon
- [ ] Phase 4 Task 3: 真 E2E
- [ ] Phase 4 Task 4: auto-update
- [ ] Phase 4 Task 5: 冒烟测试
- [ ] Phase 4 Task 6: 收尾
- [ ] Phase 5 Task 1: i18n 全量
- [ ] Phase 5 Task 2: 性能 benchmark
- [ ] Phase 5 Task 3: 文档站点
- [ ] Phase 5 Task 4: 用户手册
- [ ] Phase 5 Task 5: GA tag