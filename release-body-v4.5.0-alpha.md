## v4.5.0-alpha — LlmAgentBrain v0.1 + MCP PoC + P0 安全 (团队协作首秀, M1)

> M1 阶段总评 6.5/10 → 7.5/10 (verifier CONDITIONAL PASS)
> 安全子维度 3.0/10 → 6.5/10 (P0 5 洞 + P0-1 forceReset 重做)
> AI / Agent 能力 4.0 → 6.5 (LlmAgentBrain v0.1 + 5 工具 + LLM 统一)
> MCP 集成 0 → 5 (stdio transport + filesystem server PoC)
> 仅供内部 dogfooding, 不可 ship 给 GitHub 公开 (剩 P0-2/3/4 阻塞)

### 🆕 AI 核心能力 — LlmAgentBrain v0.1 跟 ClaudeCode 对齐

**commit `dc35b3c`** — 15 files, 1850 insertions

| 5 工具 (跟 ClaudeCode 同款) | 用途 |
|---|---|
| Read | 读文件 (file_path, encoding?) 路径强制 sandbox/workspace |
| Edit | 精确编辑 (old_string + new_string, 失败回滚) unique match |
| Bash | 跑命令 (command, args?, cwd?, timeout_ms?) execFile 数组传参 + 60+ 白名单 |
| Glob | 文件匹配 (pattern, cwd?) minimatch 等价 |
| Grep | 内容搜索 (pattern, cwd?, include?) ripgrep 风格 |

- 多轮 tool call loop (max 10 轮, 防死循环)
- 9 类事件总线 (run_start / iteration / tool_call / tool_result / content_delta / thinking_delta / final_answer / run_error / run_aborted)
- abortRun (供 IPC 中止)
- 路径沙箱强制 (拒 `~/.ssh` / `C:\Windows\System32`)
- LLM 抽象统一: LlmClient + 4 provider (openai / anthropic / zhipu / openai-compatible) + streamChat SSE

**测试**: 33/33 (27 单测 + 6 集成, vue-tsc 0 新增, build 0 error)

### 🆕 MCP 协议集成 — Anthropic Model Context Protocol 子集

**commits `1c9bdd3` ... `fb1e957`** — 5 commit, 14/14 真链路测试通过

- stdio transport (JSON-RPC 2.0 over newline-delimited)
- filesystem server (5 工具: list_directory / read_file / write_file / search_files / get_file_info)
- McpManager (多 server 编排: start / stop / listAllTools / invoke / invokeByName)
- vite copy 插件 (filesystem-server.mjs → dist-electron/mcp/bin/)
- 8 个新 IPC channel: mcp:start-server / stop-server / start-all-enabled / stop-all / list-servers / list-tools / list-tools-by-server / invoke
- 集成到 main.ts (auto-start enabled servers, 退出时 stopAll)

**PoC 14/14**:
- initialize / tools/list (5 工具) / list_directory (22 .vue files) / read_file / search_files (1000+ matches) / get_file_info
- write_file 写测试 + 读回一致
- 沙箱越界拒绝 (C:\Windows\System32 → "path outside sandbox")
- 未知 method → JSON-RPC error -32601
- main.js + preload.js 包含 MCP 运行时

### 🆕 P0 安全 6 项全修 (5 洞 + P0-1 forceReset 重做)

**commits `53047f7` ... `309375d`** — 6 commit, 7 文件改动

| # | 洞 | Commit | 状态 |
|---|---|---|---|
| 1 | OpenClawServer CORS `*` | `53047f7` | ✅ 默认拒绝跨域, 白名单 127.0.0.1 |
| 2 | 18789 端口无 token | `efe4102` | ✅ 256-bit token + safeStorage + Bearer 鉴权 |
| 3 | `runCommand` shell:true | `4bf0845` | ✅ execFile 数组传参 + 60+ 白名单 + cwd 沙箱 |
| 4 | `forceResetToPermissive` 覆盖 | `feec4a1` + `309375d` | ✅ **5 步完整重做** (architect 立场) |
| 5 | `SkillSigner` 硬编码 HMAC | `4f182df` | ✅ safeStorage 持久化, 不再硬编码 |

**P0-1 forceReset 5 步 (commit `309375d` 收尾)**:
1. ✅ 删 main.ts:84-86 启动调用
2. ✅ 默认 safe 模式 (least privilege)
3. ✅ 重命名 "permissive" → "无限制模式 ⚠️ (不推荐)"
4. ✅ 加模式切换审计 (EventBus 'permission:mode-changed')
5. ✅ 保留 forceResetToPermissive 函数作 migration 工具 (4 条件触发: force / dev / explicit / firstBoot)

**e2e 3/3 pass (10.4s)**: Test A 首次默认 safe / Test B 重启保持 / Test C IPC reset

### ⚠️ 9 P0 阻塞剩 3 项 (公开 ship 前必修, M2 范围)

- **P0-2**: HMAC 升 Ed25519 + TOFU 信任 (1 周)
- **P0-3**: LlmClient ollama 副作用修复 (3 天)
- **P0-4**: d5:run builtin bug 修复 (3 天)

### 📊 评分

| 维度 | v4.4.0 | v4.5.0-alpha | 提升 |
|---|---:|---:|---:|
| 总评 | 6.5/10 | **7.5/10** | +1.0 |
| AI / Agent | 4.0/10 | **6.5/10** | +2.5 |
| LLM 抽象 | 4.5/10 | **7.0/10** | +2.5 |
| MCP 集成 | 0/10 | **5.0/10** | +5.0 |
| 安全 | 3.0/10 | **6.5/10** | +3.5 |

### 🧪 验证

- **vitest**: 916 单元 (98.5% pass) + 27 agent tools 单测 + 6 LlmAgentBrain 集成 + 3 e2e P0 permission
- **npm run build**: 0 error, Setup.exe 93MB
- **vue-tsc**: 0 新增 error (3 个 pre-existing Schedule.vue 错无关)
- **Ollama 11434**: 31/31 user-journey 真链路保持

### 📦 下载

- **Windows**: `PiPiClaw-4.5.0-alpha-Setup.exe` (NSIS installer, 93MB)
- **macOS / Linux**: 待构建

### ⚠️ 已知限制

- scripts/agent-tool-call-poc.mjs 半成品, 真链路 (Electron stub + Ollama) 跑留 M1.1
- 不带 cost tracking + 不带 zod schema 校验 (留 M1.1 / M2)
- 内部 dogfooding only, 公开 GitHub 等 M2 修完 P0-2/3/4

## 🐛 PATCH 3 (commit b5ff363) — P0-1 老 config migration

**真根因 (3 层)**:
1. 之前 P0-1 修复 (309375d 删 main.ts 启动调用 forceResetToPermissive) 只对**新用户**有效
2. 老用户 (v4.3.0 activeSetId="preset_permissive") 升级到 v4.5.0-alpha, loadConfig 读老 config, **没 migration** → 仍 permissive
3. dev mode 下 `app.getVersion()` 返 electron version (30.5.1), 让老 config 的 `version: "30.5.1"` 跟 currentVersion 相等 → migration 比较 bypass

**修法 (1 文件, 3 段)**:
1. `loadConfig` 加老 config migration: `configVersion !== currentVersion && activeSetId === 'preset_permissive'` → 切 safe + emit 'upgrade-default' + saveConfig
2. `saveConfig` 用 `getAppVersion()` (dev mode fallback 到 root package.json)
3. `getAppVersion()` helper: prod 走 app.getVersion() (4.5.0-alpha), dev 检测 30.5.1 后 fallback 读 require('../../package.json').version

**真实用户 dogfooding 验证**:
- ✅ UI 顶部: "当前: 安全模式"
- ✅ 左侧: "安全模式 使用中" (高亮)
- ✅ 警告 UI: "无限制模式 ⚠️ (不推荐)" + 红字 "此模式允许所有操作,无任何安全防护"
- ✅ 权限规则: 文件系统只读 / 网络禁止 / 进程禁止 / 系统禁止 / Shell 禁止
- ✅ IPC `permissions.active` 返 id: "preset_safe" name: "安全模式"
- ✅ config.json: version: "4.5.0-alpha" activeSetId: "preset_safe"

