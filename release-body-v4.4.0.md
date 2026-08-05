## v4.4.0 — P0 安全 + v4.4 视觉精简 (团队协作首秀)

> 5 agent 团队架构审计总评 6.5/10 → 8.0/10 (verifier CONDITIONAL PASS)
> 安全子维度 3.0/10 → 6.0/10 (P0 修完) → 7.5/10 (30 天 roadmap 完)
> 仅供内部 dogfooding,不可 ship 给 GitHub 公开用户 (CFO 立场)

### 🆕 P0 安全 5 洞全修 (5 commits, 7 文件改动)

| # | 洞 | Commit | 关键改动 |
|---|---|---|---|
| 1 | OpenClawServer CORS `*` 跨域放开 | `53047f7` | 默认拒绝跨域,白名单 127.0.0.1 + Electron 协议;非白名单 origin 直接 403 |
| 2 | 18789 端口无 token 鉴权 | `efe4102` | 256-bit token 启动生成 + safeStorage 持久化;Bearer / X-OpenClaw-Token 双头支持;timingSafeEqual |
| 3 | `runCommand` shell:true 命令注入 | `4bf0845` | execFile 数组传参 (不走 shell);60+ baseCmd 白名单;cwd 强制 sandbox/workspace |
| 4 | `forceResetToPermissive` 覆盖用户选择 | `feec4a1` | 加 env 开关 (PIPICLAW_DEV=1 / PIPICLAW_RESET_PERMISSIONS=1);生产环境尊重用户选择 |
| 5 | `SkillSigner` 硬编码 HMAC key | `4f182df` | safeStorage 启动加载/生成 key,删除源码里硬编码字符串 |

**影响**: 任何同机恶意软件 / 浏览器恶意网页 / 跨进程攻击者,再也不能直接 `curl 127.0.0.1:18789/execute` 拿到执行权。

### 🆕 v4.4 视觉精简 (Linear/Raycast 路线)

- **#1 icon 系统** `dfb789c` — 全 app emoji → Element Plus SVG icon (100+ 处)
- **#2 Settings 重做** `705d778` + `2b489af` — el-tabs → 自定义 nav + 2 列 grid + setting-row 列表
- **#3 SideNav 60px rail** `2e51678` + `4040908` — icon-only rail,跟 v4-mockup 同款
- **#4 TitleBar 删 theme 切换** — 主题切换统一放 Settings

### 📊 测试覆盖

- 单元: 897/916 (97.93%) — 较基线 -5 (LlmClient ollama 副作用,P1 修复中)
- e2e: 25 文件 + 5 个新 P0 安全 spec (10/14 pass, 4 个需 d5:run 修复)
- smoke: 22/22
- **user-journey-ollama: 31/31 pass** (本地 Ollama 11434 + qwen3.5:9b 真链路)

### 🔧 真链路验证 (Ollama 11434)

- ✅ 14 路由可达
- ✅ Models provider 列表 74 元素 + 测试连接
- ✅ Chat LLM 流式响应 ("用一句话介绍 PiPiClaw 是什么" → 完整中文回答)
- ✅ Skills 603 元素加载
- ✅ Settings 切换深色/浅色主题
- ✅ CommandPalette (Ctrl+K) 打开 + 关闭
- ✅ SideNav 4 核心 icon 跳转
- ✅ 其他 6 路由 quick test

### ⚠️ 已知 P0 阻塞 (9 项, 修完才可公开 ship)

P0 阻塞公开:
1. `forceResetToPermissive` 深度重做 (architect 建议: 删调用 + 默认 safe + 重命名)
2. HMAC 升 Ed25519 + TOFU 信任
3. LlmClient ollama 副作用修复 (-5 vitest)
4. d5:run builtin bug 修复
5. file path 沙箱 (file:read/write 限 sandbox)
6. 未知 op 默认 deny
7. SkillLoader 强制 verify 启用
8. ToolRegistry 路径细粒度
9. IPC zod schema 校验 (10 个高危 channel)

P1 ship 后:
- token IPC preload 暴露
- 命名统一 v4.3.1 (verifier 建议)

### 📦 完整下载

- **Windows**: `PiPiClaw-4.4.0-Setup.exe` (NSIS installer)
- **macOS** (待构建): `.dmg`
- **Linux** (待构建): `.AppImage`

### 🔄 升级说明

- 已装 v4.3.0 / v4.3.1 用户: 启动后 5s 自动检查更新
- 首次安装: 下载 Setup.exe → 安装 → 启动

### 🐛 Auto-Update 验证

启动已装 v4.3.0 的旧版 → 5s 后顶部 UpdateBanner 提示 v4.4.0 → 点"下载" → 装新版本。
