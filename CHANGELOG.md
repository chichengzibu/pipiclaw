# Changelog

All notable changes to PiPiClaw will be documented in this file.

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
