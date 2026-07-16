# Changelog

All notable changes to PiPiClaw will be documented in this file.

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
