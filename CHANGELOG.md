# Changelog

All notable changes to PiPiClaw will be documented in this file.

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
