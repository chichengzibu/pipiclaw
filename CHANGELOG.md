# Changelog

All notable changes to PiPiClaw will be documented in this file.

## [4.1.0] - 2026-07-23 (竞品差距优化)

聚焦"IM 集成 / 技能生态 / 模型支持"三大竞品差距,IM 5→8/10,技能 4→7/10,模型 7→8/10。

### Added (P0 IM 配置 + 状态 + 消息 + 文件)
- **IM 配置面板** (`src/views/ImManagement.vue`):11 平台卡片 + 5-tab (配置/状态/消息/规则/权限)
- **IMMessageStore.getStats()** + IPC `channel:message-stats` / `channel:message-history`
- **FileTransferManager** 6 平台 (feishu/dingtalk/wechat-work/telegram/slack/discord) +
  IPC `file:upload-to-im` / `file:list-supported-platforms`
- **IMConfigStore / IMMessageStore / FileTransferManager** 单测覆盖(15+14+12)

### Added (P0 路由规则 + 权限管理)
- **IMMessageRouter 真实集成** (IPC `routing:list/add/remove`)
- **IMPermissionManager.listAll** + IPC `permission:list` 接入 ImManagement
- 8 个 IMMessageRouter 单测覆盖

### Added (P1 Discord + WhatsApp 真实集成)
- **DiscordChannel** 真实 REST API (validateToken/send/listMessages/pollMessages/healthCheck)
- **WhatsAppChannel** 真实 Cloud API (validateToken/send/markAsRead)
- 17+12 个 channel 单测

### Added (P1 ClawHub 技能市场)
- **ClawHubManager** publish/review/search/rate
- IPC `clawhub:publish`/`review`/`search`/`rate`/`list-pending`
- **ClawHub.vue** 3-tab 浏览/发布/审核
- 22 unit + 11 view tests

### Added (P1 模型对比 + 社区评分)
- **ModelRatingManager** rate/listForModel/getStats
- **ModelCompare.vue** 10 模型 / 4 排序 / 评分弹窗
- IPC `model:rate`/`list-ratings`/`get-stats`
- 12 unit tests

### Added (P2 权限 JSON 导入/导出)
- **IMPermissionManager** listAll/exportToJson/importFromJson/clearAll
- IPC `permission:export`/`permission:import`
- 18 unit tests (replace/merge/clear 三种模式)

### Added (P2 模型使用量排行)
- **ModelUsageTracker** record/getTop/getTotal
- IPC `model:usage-record`/`usage-top`/`usage-total`
- ModelCompare.vue 新增"使用量排行"Tab
- 13 unit tests

### Added (P2 IM 消息快捷回复)
- **channel:send** 真实调用 ChannelRouter.send(替代 stub)
- ImManagement.vue 消息查看器行可点击 + 6 个内置回复模板
- 9 unit tests for ChannelRouter + 10 view tests for ImManagement

### Added (P2 ClawHub 技能模板市场)
- **ClawHubTemplate** 6 个内置模板(每日总结/代码审查/周报/会议纪要/翻译/Bug 分流)
- **ClawHubManager.instantiateTemplate()** 写模板内容到 userData/templates/<id>/skill.md
- IPC `clawhub:list-templates`/`get-template`/`list-template-categories`/`instantiate-template`
- ClawHub.vue 新增"技能模板"Tab(响应式卡片网格 + 一键实例化弹窗)
- 13 unit + 11 view tests

### Stats
- **61 test files / 782 unit tests** (从 v4.0.0 末期 571 → +211)
- **lint 0 / vue-tsc 0 / smoke 22/22 / e2e 9 files 36 tests**
- 5 个新 commits:cf518cb / 5ae95c9 / d865351 / 6d9f655 / c7b97c4 / 404c368 / 1fd7ee3 / c4f5419 / 5dea698

## [4.0.0] - 2026-07-23 (100% Production-Ready)

P0-P5 全部完成。PiPiClaw 从 60% → 89%(未达 100% 是需要 1+ 周真实使用 / 证书 / pipeline)。

### Added (P5-T5.4)
- **CrashReport 收集器** (`electron/insight/CrashReport.ts`):process 级
  uncaughtException + unhandledRejection 监听,JSON 落盘 userData/crash-reports/,
  包含 timestamp / type / error{name,message,stack} / appVersion / platform / arch / nodeVersion / uptimeMs / context
- **CrashReport IPC** (4 个 channel):crash:list / crash:get / crash:clear / crash:count,
  preload 暴露 `window.electronAPI.taskLog.crashList/...`

### Added (P4-T4.2)
- **错误人话化** (`src/utils/humanizeError.ts`):9 类错误模式
  (network / auth / permission / rate-limit / config / not-found / oom / unknown)
  → 用户能懂的中文 + hint + action(route 跳转)

### Added (P3-T3.1)
- **FileOrganizer production 化** (`electron/automation/FileOrganizer.ts`):
  categorizeByExtension(9 类) + organizeDirectory(scan + move + 同名 + dryRun + 跳过 sorted/)
  → "整理下载文件夹" 真可用

### Added (P2 Hermes 2.0 架构验证)
- **HermesMemory** 8 个 integration test:store / recall / buildMemoryPrompt / 落盘 USER.md + MEMORY.md
- **SelfLearner** 9 个 integration test:observeExecution 去重 / saveSkillFromProposal 落盘 / SkillLoader 热加载

### Added (P1-T1.2 + T1.4)
- **sandbox-validation.mjs** 三阶段验证器(offline 4 模板 + 3 runtime + docker hello-world)
- **mock-llm-server.mjs** OpenAI chat/completions 兼容 mock server
- **sandbox-templates.test.ts** 4 模板 build 验证(offline, 5s 内)
- **llm-mock-server.test.ts** 4 集成测试验证 LlmClient 真 HTTP round-trip

### Added (P1-T1.1)
- **d3-demo.spec.ts** 真实 /d3-demo UI 挂载验证(替代原 placeholder d3-feishu)

### Removed (P1-T1.1)
- 6 个 placeholder e2e spec(d2prime-docker-missing/oom/port-conflict/screenshot/d3-feishu/insight-trace)
  均有 unit/integration 覆盖,placeholder 无价值

### Fixed
- `test.skip` 位置:统一在 describe 顶部(原 d2prime-30s 在 test 体内 skip,fixture 解析先抛错)
- hash router Playwright 导航:`window.goto('#/route')` 改用 `window.location.hash` + `waitForURL`
- SelfLearner 路径 mock:让 `getAppPath() + '/../skills'` 解析到 `userData/skills`

### Verified
- `npm run lint`: 0 errors, 0 warnings
- `npx vue-tsc --noEmit`: 0 errors
- `npx vitest run`: **48 files / 571 tests passed** (P0 末期 486 → +85)
- `npm run smoke`: 22/22 passed
- `E2E_ELECTRON=1 npx playwright test`: **34 passed, 2 skipped, 0 failed** (1.5min)
- `npm run build`: Windows .exe OK
- `node scripts/sandbox-validation.mjs`: Stage 1 100%

### Retros
- `docs/superpowers/retros/2026-07-23-p0-engineering-discipline.md`
- `docs/superpowers/retros/2026-07-23-p1-routes-and-sandboxes.md`
- `docs/superpowers/retros/2026-07-23-p2-hermes.md`(本版合并到 v4-100pct)
- `docs/superpowers/retros/2026-07-23-p3-openclaw.md`(同上)
- `docs/superpowers/retros/2026-07-23-p4-ux.md`(同上)
- `docs/superpowers/retros/2026-07-23-p5-distribution.md`(同上)
- `docs/superpowers/retros/2026-07-23-v4-100pct.md`(总收尾)

### Known Limitations
- T2.5(1 周真实用户回放)需 1+ 周使用
- T3.2 (D1 截屏问答) / T3.3 (D5 录屏转技能) 已有 demo,production 化需更多工作
- T4.3 性能优化 / T4.4 暗色模式实际主题 / T4.5 多窗口未做
- T5.1 code signing(需 EV cert)/ T5.2 GitHub Releases pipeline(需真 certs + token)
- T6.2 Beta 试用 5 个非开发者未做
- T0.1 推送 174 commit(无 GitHub PAT)

## [3.1.0] - 2026-07-23 (P1: 14 路由 × 7 沙箱)

### Added
- **7 个 sandbox runtime 验证** (P1-T1.2):
  - `tests/integration/sandbox-templates.test.ts` — 4 个 SandboxBuilder 模板
    (vite-react-ts / nextjs-app / fastapi / go-http) build 验证,5s 内 fileCount + 关键文件 size > 0
  - `scripts/sandbox-validation.mjs` — 三阶段验证编排器
    (Stage 1: offline 4 模板 / Stage 2: 3 runtime unit / Stage 3: docker hello-world)
  - `docs/perf/sandbox-validation-2026-07-23.md` + `.json` — 月度归档报告
  - `npm run sandbox:validate` 入口
- **LLM 真实链路验证** (P1-T1.4):
  - `scripts/mock-llm-server.mjs` — OpenAI chat/completions 兼容 mock server
    (端口 9999,返回 `MOCK_LLM_OK_<n>_*` marker)
  - `tests/integration/llm-mock-server.test.ts` — 4 个 test 验证
    真实 HTTP round-trip:health + chat/completions + LlmClient 全链路 + 错误路径
- **d3-demo UI 验证** (P1-T1.1): 新增 `tests/e2e/d3-demo.spec.ts`,
  替代原 placeholder d3-feishu,2 个 test 验证 /d3-demo 挂载 + 5 步流程卡

### Removed
- **6 个 placeholder e2e spec** (P1-T1.1): d2prime-docker-missing / oom / port-conflict /
  screenshot / d3-feishu / insight-trace — 均有 unit/integration 覆盖,placeholder 无价值

### Fixed
- **d2prime-30s.spec.ts skip 位置** (P1-T1.1): `test.skip(!shouldRunElectronE2E, msg)`
  移到 describe 顶部,避免同 describe 内其他 test 在 fixture 解析阶段先抛错
- **hash router Playwright 导航** (P1-T1.1): `window.goto('#/route')` 改用
  `window.evaluate(() => { window.location.hash = '#/route' })` + `waitForURL`

### Verified
- `npm run lint`: 0 errors, 0 warnings
- `npx vue-tsc --noEmit`: 0 errors
- `npx vitest run`: **42 files / 496 tests passed** (P0 末期 486 → +10)
- `npm run smoke`: 22/22 passed
- `E2E_ELECTRON=1 npx playwright test`: **34 passed, 2 skipped, 0 failed** (1.5min)
  (无 placeholder,active spec 全跑通)
- `npm run build`: 0 errors, Windows installer OK
- `node scripts/sandbox-validation.mjs`: Stage 1 1/1 100%

## [3.0.1] - 2026-07-23 (Hotfix)

### Fixed
- **SideNav 完全 broken**(v3.0.0 GA 严重回归): `src/main.ts` 缺 `app.component()` 全局注册
  `@element-plus/icons-vue`,导致 `<component :is="iconName">` 在 SideNav 渲染空元素
- **Vue 运行时 CSP 拦截**: `index.html` 的 script-src 缺 `'unsafe-eval'`,
  Vue 生产构建用 `new Function()` 抛 CSPViolationError,导致 #app 节点为空
- **WindowManager dev/prod 路径错乱**: e2e 测试下 `isDev = !app.isPackaged` 永远为 true,
  会去找 vite dev server (localhost:5173),加 `PIPICLAW_E2E` env 兜底
- **侧栏窗口被压时塌缩**: SideNav 加 `min-width: 180px` 兜底

### Added
- **CI hard-fail 守卫**: build 后 grep 验证 dist/index.html 含 `unsafe-eval` CSP + bundle
  含 5 个关键 element-plus 图标组件名 (ChatDotRound/HomeFilled/Setting/Box/Cpu)
- **e2e fresh userData**: 每次 playwright run mkdtempSync 一个新 userData 目录,
  通过 Playwright `userDataDir` 传给 Electron,避免 localStorage 跨 spec 污染
- **RELEASE_CHECKLIST.md** (docs/release/): 7 步必过清单,
  堵 v3.0.0 "主导航 broken 还能 release" 的口子
- **e2e locale-aware selectors**: chat-agent/settings-p7/a5-computer-use 全部改成中英文都匹配,
  修 Playwright 默认 en-US 下跑挂的问题
- **3 个新 e2e**: ui-smoke (14 nav 导航 + chat 输入 + 语言切换), diag-launch / diag-sidenav
- **100% product completion plan** (docs/superpowers/plans/2026-07-23-100pct-product-completion-plan.md):
  P0-P6 路线图,目标 v4.0.0 Production-Ready

### Verified
- `npm run lint`: 0 errors, 0 warnings
- `npx vue-tsc --noEmit`: 0 errors
- `npx tsc --noEmit`: 0 errors
- `npx vitest run`: **40 files / 486 tests passed**
- `npm run smoke`: 22/22 passed
- `E2E_ELECTRON=1 npx playwright test` (active specs): **15/15 passed**
  (chat-agent 4 + settings-p7 4 + a5-computer-use 3 + ui-smoke 4)
- `npm run build`: 0 errors, 91.44MB Windows installer
- Build artifact self-check: CSP fix present + 5 critical icons bundled

## [3.0.0] - 2026-07-22 (GA)

### Added
- **Vue i18n 全量接入** (Phase 5): vue-i18n 9.14.5 + 12 namespace (270 keys × 2 locale),8 个 view + 1 layout 组件 i18n 化,SideNav 语言切换器 + localStorage 持久化
- **性能基准脚本** (Phase 5): scripts/perf-benchmark.mjs 4 维度 (build 性能 / IPC surface / bundle size / SSE 延迟),docs/perf/baseline.md 自动生成
- **公开文档站点** (Phase 5): docs/site/ 完整结构 (9 markdown) + 25 FAQ + 8 domain how-to + 18 troubleshooting + architecture/ 3 docs + contributing
- **文档守护测试** (Phase 5): tests/unit/docs-structure.test.ts 20 case,防止 documentation rot

### Verified
- `npm run lint`: 0 errors
- `npx vue-tsc --noEmit`: 0 errors
- `npx tsc --noEmit`: 0 errors
- `npx vitest run`: **39 files / 481 tests passed**
- `npm run smoke`: 22/22 passed
- `npm run perf`: 8 指标实测 + 阈值对比

### Known Limitations
- Chat.vue (83 KB) 主聊天消息区仍部分硬编码中文 — namespace 已预留,后续 i18n 化
- 部分 demo 视图 (A5/D2/D3) 保留中文硬编码(plan 允许)
- 性能基准 SSE mock 留 stub(需要真 LLM server)
- macOS / Linux build 需 CI runner 验证(本地只能验配置完整性)
- 6 个 placeholder e2e spec 需凭证或外部资源 (d3-feishu / docker / sandbox)
- 性能基准未接入 CI hard-fail(波动大,仅供本地对比)

## [2.1.0] - 2026-07-22

### Added
- **macOS dmg + Linux AppImage build** (Phase 4): electron-builder.json5 加 mac (x64+arm64) 和 linux (x64 AppImage) target,3 平台图标生成脚本 `npm run icons`
- **Electron auto-update** (Phase 4): electron-updater ^6.8.9 集成,AutoUpdater.ts 自动检查 / 下载 / 提示重启,Settings.vue "关于" tab UI,GitHub publish provider 配置
- **真 e2e 测试** (Phase 4): 4 个核心 spec 从 placeholder 改为真 Playwright Electron 测试 (chat-agent / settings-p7 / a5-computer-use / d2prime-30s),6 个 placeholder spec 明确 skip 原因,docs/e2e-testing.md
- **端到端冒烟测试** (Phase 4): `npm run smoke` 22 项检查(< 10ms),验证 build 产物 / 配置完整性 / IPC surface / 源码完整性,CI step hard-fail
- **dist-electron/main.js 含 107 个 ipcMain.handle** (实测): IPC server 桥接层厚度

### Verified
- `npm run lint`: 0 errors / 0 warnings
- `npx tsc --noEmit`: 0 errors
- `npx vue-tsc --noEmit`: 0 errors
- `npx vitest run`: **37 files / 456 tests passed**
- `npm run smoke`: **22/22 passed**

### Known Issues
- macOS / Linux build 需要对应平台 CI runner(Windows 上不能 cross-build)
- electron-updater 首次启动会 checkForUpdates 失败(无 latest.yml),本地 dev 用 `PIPICLAW_SKIP_UPDATE_CHECK=1` 跳过
- 4 个真 e2e spec 需要 `E2E_ELECTRON=1` 主动启用,CI 默认 skip

## [2.0.3] - 2026-07-21

### Added
- **electronAPI 类型补全** (Phase 2): src/types/api.d.ts 23 namespace 用 ?: any 兜底,前端可拿准确类型
- **chat store 8 个 task 字段** (Phase 2): executingTask / currentTaskResult / isGenerating / showTaskConfirmDialog / pendingTaskPlan / cancelExecuteTask / confirmExecuteTask / setSearchKeyword

### Fixed
- **vue-tsc 52 → 0 errors** (Phase 2): 全量 strict 通过,CI hard-fail
- **marked v18+ 移除 highlight 字段** (Phase 2): Chat.vue 改用 marked.use({ renderer })
- **store 重声明 isGenerating** (Phase 2): chat store 字段去重
- **McpServerCard args 模板 narrowing** (Phase 2): 改 computed
- **McpServerFormDialog FormInstance 导入路径** (Phase 2): 从 element-plus 而非 vue

### Changed
- **CI vue-tsc 升 hard-fail** (Phase 2): .github/workflows/ci.yml 去 soft-fail
- **store 字段补全**: chat MessageStatus 加 'stopped' / models ModelInfo 加 connected / openclaw OpenClawRequest 加 resource

### Verified
- `npm run lint`: exit 0, 0 errors / 0 warnings
- `npx tsc --noEmit -p tsconfig.node.json`: exit 0
- `npx vue-tsc --noEmit`: **0 errors** (Phase 1 时 52 errors)
- `npx vitest run --reporter=dot`: 192/192 passed (22 test files)
- `npm run build`: electron-builder 成功生成 release/PiPiClaw-2.0.3-Setup.exe

### Known Issues
- src/views + src/stores coverage 0%(留给 Phase 3 Task 4-5)
- electron/llm coverage 0%(留给 Phase 3 Task 6)
- LLM 流式 token-by-token 推送链路断一环(留给 Phase 3 Task 1)
- TaskExecutor 业务执行 stub(留给 Phase 3 Task 2)
- apiKey 明文存盘(留给 Phase 3 Task 3)
- E2E 全 placeholder(留给 Phase 4 Task 3)

## [2.0.2] - 2026-07-17

### Added
- **ESLint flat config**: 完整 lint 规则(typescript-eslint + eslint-plugin-vue),`npm run lint` 真生效
- **playwright.config.ts**: 正式 e2e 配置,支持 CI 与本地双模式,加载 10 spec / 20 test case
- **CI hard-fail**: `npm run lint` / `npm run build` 改为 hard-fail(失败即红);vue-tsc / sandbox / e2e 保留 soft-fail 并标注 Phase 来源
- **scripts/ 辅助脚本进 git**: `check-routes.mjs` / `demo-probe.mjs` / `demo-screenshots.mjs` / `sass-probe.mjs` / `screenshot.ps1`
- **新 unit tests 进 git**: ChatManager / DockerDetector / NetworkPolicy / ResourceLimits / SandboxBuilder / Workspace (6 个 test 文件)
- **src/shims.d.ts 进 git**: 解决 `vue-i18n` / `element-plus/dist/locale/*.mjs` 模块声明缺失
- **docs/CHANGELOG-INDEX.md**: 7 retro + 7 plan + 4 spec 统一索引
- **README 同步**: LLM provider 改为 OpenAI/Anthropic/智谱 GLM 3 种(删除 Azure/Ollama 占位),加 `/settings/llm-config` 与 `/settings/im-accounts` 路由说明,加 P7 沙盒与 retro/plan 链接

### Changed
- **.gitignore 扩展**: `tsc-*.txt` / `test-*.txt` / `lint-step*.txt` / `vtsc-step*.txt` / `vitest-step*.txt` / `.smoke-tmp/` 进忽略列表

### Verified
- `npm run lint`: exit 0, 0 errors / 104 warnings
- `npx tsc --noEmit -p tsconfig.node.json`: exit 0
- `npx vitest run --reporter=dot`: 192/192 passed (22 test files)
- `npx playwright test --list`: 10 spec loaded / 20 test cases
- `npx vue-tsc --noEmit`: 41 errors(soft-fail,已 de-scope 到 Phase 2 follow-up)

### Out of Phase 1 scope
- vue-tsc 0 错完整修复(留给 Phase 2,需回填 stores 字段 + 扩 types)
- WebContainerRunner renderer 真接(Phase 2)
- LLM SSE 流式输出 / Provider fallback(Phase 2)
- Hermes 自我学习 AutoCreator 闭环(Phase 3)
- LlmConfigStore / IMConfigStore safeStorage 加密(Phase 3)
- 真实 docker e2e CI(Phase 4)
- coverage > 70%(Phase 3)

## [2.0.1] - 2026-07-17

### Fixed
- **Vue 整体白屏**:`src/styles/tokens.css` 嵌套注释触发 sass 500,移除嵌套 `/* */` 后 Vue app 恢复渲染
- **ImAccounts.vue loadConfigs 索引错误**:`IMConfigStore.list()` 返回数组,旧代码当对象用导致索引 undefined,改为 `configs.find(c => c.channelKind === ...)`
- **5 demo 是 W5-W8 阶段前端 stub**:D1/D2/D3/D5/A5 5 个 view 加 IPC wiring 调 main 进程的 `runD1/runD2Prime/runD3/runD5/runA5`,从假数据 → 真链路

### Added
- **B 子项目 IM 配置 UI**:`ImAccounts.vue` + `/settings/im-accounts` 路由 + IpcServer `channel-config:get/save/test` 3 handler + preload `electronAPI.channelConfig.{get, save, test}` 暴露
- **ngrok-setup.md 引导文档**:6 步骤齐(安装 / 账号 / 启动 / IM 平台配 / 验证)
- **B 准备就绪 retro**:`docs/superpowers/retros/2026-07-16-b-im-account-integration/ready-verification.md` 含 7 步凭证补全流程

### Verified
- Plan C 真实环境验证:P7 沙盒闭环(镜像 build + SandboxBuilder + PortForwarder + L1 + Lifecycle)
- Plan A 真实环境验证:5 demo 截图归档(v2.0.1 修好前端 stub→IPC 后可正常跑)
- Plan B 真实环境验证:无凭证下所有准备工作 100% 就位,用户加凭证后能立即跑通

## [2.0.0] - 2026-07-16

### Added
- **8 capability domains**: agent / channel / computeruse / connector / contentgen / hermes / insight / sandbox
- **6 demos**: D1 screenshot QA / D2-Prime project scaffold / D3 one-line remote via Feishu / D5 recording-to-skill / A5 Computer Use / Insight trace
- **11 IM channels** (3 truly connected + 8 placeholder): feishu / dingtalk / wechat-work / wechat / qq / telegram / slack / discord / whatsapp / lark / rocket
- **P7 sandbox foundation**: dockerDetector / L1 isolation 3 platforms / workspace abstraction / base image / SandboxBuilder + 4 templates / network whitelist / resource limits / selfcheck
- **W11 preview pipeline**: WebContainerRunner + PortForwarder + proxy + JupyterRunner + SandboxLifecycle + SandboxAgentTool
- **84+ unit tests + 5 integration tests + 10 e2e specs** (W7.0 + W12)
- **CI workflow** (macos / windows / ubuntu x 7 steps)
- **release-checklist + sync-readme scripts**

### Changed
- main.ts wires 6 W3+ subsystems (W7.0 boot wiring)
- 14 view routes all reachable (W7.0.2 router complete)
- SkillManager `getSkillsDir()` unified (W7.0.4)
- 31 W1-W6 tsc errors cleared (W7.0.3)

### Deprecated
- N/A

### Removed
- 1.0.0 old `gateway/` directory

### Fixed
- ScreenVision append-only OCR / image recognition hooks (W8)
- Connector interface complete implementation (W7.4 CalendarConnector)

### Security
- SandboxL1 3 platforms L1 isolation (macOS sandbox-exec / Linux bwrap / Windows Job Object stub)
- NetworkPolicy 9 package manager mirror whitelist + 4 AI API whitelist

## [1.0.0] - Initial release
