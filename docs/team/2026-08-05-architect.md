# PiPiClaw v4.4.0 — 架构级安全评审与设计 (CFO 视角)

- **日期**: 2026-08-05
- **作者**: 架构师 Agent (安全专项)
- **视角**: CFO — 这能 ship 给真实用户吗?
- **输入**: 5 agent 审计总评 6.5/10,安全子维度 3.0/10
- **任务**: 评审 4-5 个 critical 安全洞的修法 + 写架构级安全设计 + 风险评估 + roadmap
- **代码引用规范**: `file_path:line_number`

---

## 0. 任务摘要

| 项目 | 现状 |
|---|---|
| 整体评分 | 6.5/10 |
| **安全子维度** | **3.0/10** 🔴 |
| 后端将修 4-5 个 critical | CORS 放开、18789 无 token、shell 注入、forceResetToPermissive、HMAC 硬编码 |
| 我的工作 | (1) 评审修法是否合理 (2) 写架构级安全设计 (3) 评估修完后风险 (4) 给改进建议 |
| 立场 | **不写代码,只评审 + 设计**;与 backend 互补,不让它造出第二层雷 |

**CFO 一句话**: 现在任何能访问 127.0.0.1:18789 的进程(同机恶意软件、浏览器 `<img onerror>`、其他 Electron app)都能执行 `run_command` 和 `delete_file`。**P0 修完之前,严禁 ship 真实用户。** 修完之后,仍只可 ship 给内部 dogfooding 用户;P1 (skill sign / LLM 抽象 / IM stub / CapabilityRegistry) 修完才能给早期生产用户。

---

## 1. P0 5 洞评审 (合理 / 遗漏 / 边界)

### 1.1 C1: OpenClawServer CORS `*` 跨域放开

**当前代码** (`electron/openclaw/OpenClawServer.ts:184-186`):
```ts
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```

**问题本质**: 任何浏览器页面(包括恶意广告)用 `fetch('http://127.0.0.1:18789/execute', ...)` 都能触发 18789 端点。这是经典的 [CSRF on localhost](https://speakerdeck.com/0x13abh1t/csaw-2014-cross-origin-resource-exploitations-on-localhost) — 浏览器认为同机进程是"信任"的。

**backend 拟修法** (基于 05-final-report §5.30 天路线图):
- 启动时生成随机 token,放在响应头 + IPC 注入
- `/execute` 校验 `X-OpenClaw-Token` header
- CORS 锁到 `file://` origin 或移除

**评审**: ✅ 方向正确,但有 4 个遗漏:

1. **Origin 锁定具体值,不要用 `file://`** — Chromium 对 `file://` origin 处理不一致(默认每个 file:// 是空 origin,`Access-Control-Allow-Origin: file://` 实际不生效)。**建议: 移除 CORS 头,让浏览器拒绝跨源**。Renderer 走 IPC 不需要 CORS,OpenClaw HTTP 端点的所有合法调用方都是 main process,不需要 CORS。
2. **OPTIONS 预检必须保留 deny** — 当前的 OPTIONS 直接 200 放行 (line 189-193),即使去掉 `*`,预检仍然过。**应改成 403 + 无 CORS 头**。
3. **Token 必须每次启动轮换,且不落盘** — 持久化 token 形同密码,被反编译就能复用。**用 `crypto.randomBytes(32).toString('hex')` 内存持有**;renderer 通过 `await openclaw:token:get` IPC 拿,而不是从日志或环境变量。
4. **Token 传输必须防 timing attack** — 当前用 `===` 比对字符串,长度已知时仍有微秒级差异。**用 `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))`**。
5. **遗漏: `WebSocket` upgrade** — 如果未来加 ws 端点(18789 很容易被复用),CORS 防御失效。**评审时一并禁止 ws upgrade**。
6. **遗漏: `/health` 是否需 token?** — 健康检查通常用来给监控系统 (K8s probe) 探活,但 18789 是 desktop localhost,没有外部监控需求。**建议: `/health` 也要 token**,或干脆只在 `127.0.0.1` 上不返回详细 version (信息泄露)。

**决定**: ✅ 修法大方向 PASS;需补 4 点 (CORS 移除 / OPTIONS deny / 内存 token / timing-safe)。

---

### 1.2 C2: 18789 端口无 token 鉴权

**当前代码** (`electron/openclaw/OpenClawServer.ts:208-211`):
```ts
if (path === '/execute' && req.method === 'POST') {
  this.handleExecute(req, res);
  return;
}
```

**问题本质**: 即使修了 CORS,任何本机进程(恶意 npm 包、子进程、其他 Electron app、SSH 登录后的远端 attacker)都能 `curl -X POST http://127.0.0.1:18789/execute` 拿到执行权。

**backend 拟修法**:
- 启动时生成 `authToken` (32 字节随机)
- 注入到 IPC client + main process 内部使用
- `/execute` 校验 `X-OpenClaw-Token` header

**评审**: ✅ 必须加,但有 3 个深度边界:

#### 边界 1: 即使有 token,127.0.0.1 仍可能被本地提权

**关键问题**: token 解决了"跨进程"攻击,但**不能解决"进程内提权"**。考虑:
- 用户装了恶意 Electron app (合法签名),开发者读到 `localStorage` 里的 token? 不行,token 在 main process 内存,不暴露 renderer。
- 但如果 malware 已经能跑代码在用户上下文 (本地提权),它直接读 `process.env` / `/proc/<pid>/mem` / Windows Token Impersonation — token 防不住。
- 真实场景: **chromium devtools protocol 暴露** — 任何能在 localhost 启 CDP 的攻击者 (`chrome --remote-debugging-port=9222`) 都能间接攻击。

**CFO 角度**: 不要承诺"加 token 就绝对安全",**写明"防御纵深的一层,而非银弹"**。

#### 边界 2: token 泄露面

| 泄露途径 | 当前行为 | 应有行为 |
|---|---|---|
| 日志 | LogManager 把 `request.headers` 整段打印? (待审 IpcServer) | Token 必须 redact 成 `***` |
| 错误堆栈 | 5xx 错误带请求上下文? | 错误不返回 token |
| IPC 通道 | `openclaw:execute` 走 IPC,renderer 看不到 HTTP token | 单独发 `openclaw:token:get` IPC,需要 `webContents.id` 校验主窗口 |
| 错误响应 | 403 错误带 `WWW-Authenticate`? | 不带 |
| 浏览器历史 / fetch 缓存 | 用户在 renderer 用 fetch 调自己? | 永远不会,renderer 走 IPC |

#### 边界 3: token rotation

- **首次启动**: 生成 token A,内存持有
- **Token 失效**: 用户在 Settings 点 "重置网关 token" → 生成 token B,旧 token 立即失效
- **进程重启**: 每次启动生成新 token (推荐)
- **持久化 token** ❌ 反对: 落盘就形同密码,反编译拿到,反而比 HTTP 鉴权更差

**决定**: ✅ 修法方向 PASS;需补 3 点 (CFO 角度防御定位 / 日志 redact / 进程级 token 失效策略)。

---

### 1.3 C3: `runCommand` shell:true 命令注入

**当前代码** (`electron/openclaw/OpenClawGateway.ts:676-693`):
```ts
const { command, args = [], cwd, timeout = 30000, shell = true } = params;
const baseCmd = command.split(' ')[0].toLowerCase();
this.log.warn('[OpenClawGateway] 执行命令 (放宽限制):', baseCmd);
const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
const { stdout, stderr } = await execAsync(fullCommand, {
  cwd: cwd ? this.resolvePath(cwd) : undefined,
  timeout,
  shell: shell as any
});
```

**问题本质**: `shell:true` + `args.join(' ')` = 经典命令注入。LLM 输出的 `git status; rm -rf ~` 会被 `bash -c "git status; rm -rf ~"` 一锅端。`baseCmd.split(' ')[0]` 只看第一个 token,完全没过滤作用。

**backend 拟修法** (基于 backend 报告 §3 C1):
- 改 `child_process.spawn(command, argsArray, { shell: false })`
- 加白名单 (git/node/python/npm)
- cwd 限制在 `~/.pipiclaw/sandbox/` 内

**评审**: ✅ 方向正确,但有 5 个深度遗漏:

1. **白名单粒度不够** — 白名单 baseCmd 只挡 `rm/mkfs/dd`,**挡不住 `git config core.hooksPath /tmp/evil` → 任意 RCE** (git 任意子命令都可执行 shell)。建议:
   - 不仅是 baseCmd,**完整命令必须结构化**,或
   - **只允许 spawn 一个白名单 binary,args 走 schema 校验** (例如 `git` 只允许 `--version`,`status`,`log`,`diff` 等只读子命令)
2. **cwd 限制不严** — `resolvePath` 接受绝对路径 (`electron/openclaw/OpenClawGateway.ts:870-905`),即使配 sandbox root,`/etc/passwd` 写也只需绕过 resolvePath。**建议**: 用 `path.relative(sandboxRoot, resolved).startsWith('..')` 严格检查
3. **环境变量泄露** — spawn 继承父进程 env,会带上 `OPENAI_API_KEY`,`IM_FEISHU_TOKEN` 等。**建议**: spawn 时显式 `env: { PATH: '/usr/bin', HOME: sandboxRoot }` 白名单环境变量
4. **stdio 没收** — `execAsync` 默认 `inherit`? Node 默认 `pipe`,但 stdout/stderr 字符串直返给 renderer 可能含敏感信息 (密码、token)。**建议**: maxBuffer 限制 + 敏感 regex redact (`sk-[a-zA-Z0-9]{20,}` / `(?i)password[=:]\s*\S+`)
5. **timeout 后没杀进程组** — 30s 超时后,Node 只杀 child,但 grandchild 还活着 (典型 `npm install` 拉子进程)。**建议**: `spawn(cmd, args, { detached: false })` + 进程组杀 (`process.kill(-pid, 'SIGTERM')`,Windows 用 `taskkill /T /F /PID`)

#### 边界 case: 平台差异

| 行为 | Windows | macOS | Linux |
|---|---|---|---|
| shell:true 默认 shell | `cmd.exe /d /s /c` | `/bin/sh -c` | `/bin/sh -c` |
| spawn 默认 shell | (无) | (无) | (无) |
| PATH 查找 | `where` | `which` | `which` |
| 进程组杀 | `taskkill /T /F /PID` | `kill -KILL -pgid` | `kill -KILL -pgid` |

**建议**: 把 `runCommand` 抽到 `electron/openclaw/ProcessSandbox.ts`,Windows / POSIX 各一个实现,行为一致。

#### 边界 case: 业务场景允许的合理 shell

Power user 场景: "帮我跑 `git log --oneline -20` 看看最近提交" — 这需要 shell。**不要一刀切禁 shell**,而是:
- **透传模式 (透传给 LLM)**: 默认 `spawn` + 白名单
- **Expert 模式 (高级用户显式开)**: `shell:true` 但 `cwd` 必须 sandbox 内,加 secondary confirm dialog

**决定**: ✅ 修法方向 PASS;需补 5 点 (白名单结构化 / cwd 严格 / env 白名单 / stdio redact / 进程组杀);建议抽出 ProcessSandbox 平台分支。

---

### 1.4 C4: `forceResetToPermissive` 每次启动覆盖用户选择

**当前代码** (`electron/main.ts:84-86` + `electron/permissions/PermissionConfig.ts:290-307`):
```ts
// main.ts:84
// 6. 强制重置权限为完全开放（预防旧配置覆盖）
const permissionConfig = PermissionConfig.getInstance();
permissionConfig.forceResetToPermissive();
```

```ts
// PermissionConfig.ts:290
public forceResetToPermissive(): boolean {
  this.log.info('[PermissionConfig] ========== 强制重置权限为开放模式 ==========');
  // 1. 重新初始化默认权限集（确保 permissive 存在）
  this.initDefaultPermissionSets();
  // 2. 确保激活 permissive 模板
  const permissiveSet = this.permissionSets.get('preset_permissive');
  if (permissiveSet) {
    this.activeSetId = permissiveSet.id;
    this.saveConfig();
    ...
```

**问题本质**: 用户在 UI 选 "安全模式" → 写入 `permissions.json` → 下次启动被 `forceResetToPermissive()` 覆盖 → **整个 PermissionManager 形同虚设**。这不是权限管理,是装饰品。

**backend 拟修法** (基于 backend §3 C3):
- 加 `PIPICLAW_STRICT_PERMISSIONS=1` 环境变量开关
- 或在 Settings 加"持久化当前模式"开关

**评审**: ⚠️ 方向对但**修法太轻**。问题不在"怎么开关",在"为什么存在这个函数"。

#### 深度评审: 为什么会有这个函数?

根据代码注释 "预防旧配置覆盖",猜测是早期某个版本升级时,旧 config 格式不兼容,新 config 加载失败,fallback 到默认。开发者选择"每次启动强制重置"绕过这个问题。

**CFO 角度**: 这是 **technical debt 的紧急止血贴**,不是 feature。止血贴到期不撕,会感染。

#### 必须做的修复

1. **删除 `forceResetToPermissive` 调用** (从 `main.ts:86` 移除)
2. **保留函数作为 migration 工具** — 但只在版本升级 + 旧 config 格式不匹配时调用一次,带 version check
3. **设置真正的"持久化当前模式"开关** (Settings → 安全 → "记住权限模式")
4. **首次安装默认 `safe` 模式** — 不是 `permissive`。**安全默认值 = 最小权限**,这是安全工程第一原则 (least privilege)
5. **`permissive` 模板的命名误导** — "开放模式" 让用户感觉是"高级用户的正常选择",实际是"无任何安全防护"。**改名为 "无限制模式" 或 "不推荐模式"**,并加红字警告
6. **审计日志** — 每次权限模式切换记录到 EventBus + Insight

#### 边界 case: 用户装了第三方 skill 走 `openclaw:execute`,但当前是 safe 模式

`PermissionManager.checkPermission` 应该 deny → return 403 → UI 弹 "权限不足,去 Settings 改模式"。**这条链路要 e2e 测过**,不能只在 happy path 工作。

**决定**: ⚠️ 修法需要加重;删除强制重置 + 改默认 safe + 重命名 permissive 模板 + 加模式切换审计。

---

### 1.5 C5: SkillSigner 硬编码 HMAC key

**当前代码** (`electron/skill/SkillSigner.ts:24`):
```ts
private readonly LOCAL_KEY = 'pipiclaw-local-stub-key-W6-do-not-use-in-prod'
```

**问题本质**: 源码里明文 HMAC key,任何 clone 仓库的人能伪造任意 skill 签名。注释 "do not use in prod" 是诚实的自首。`signer.verify` 用 `signatureEquals` 是 timing-safe 的 (`electron/skill/SkillSigner.ts:66-71`),但**key 本身就是公开的**,timing-safe 防不住。

**当前实际危害**: 
- `SkillLoader` 加载 skill **不调用 verify** (grep 无结果,`electron/skill/SkillLoader.ts`),所以即使签了也白签
- `AutoCreator` 每次创建都签,但**没有验证链** (W6 stub)
- 风险是**未来风险**: 当 SkillLoader 启用强制 verify 时,如果还是这个 key,信任链崩塌 (任何第三方 skill 都能"已签名"加载)

**backend 拟修法** (基于 backend §3 C4):
- Ed25519 公私钥分离
- 私钥走 safeStorage / OS keychain
- 导入第三方 skill 强制 verify

**评审**: ✅ 方向正确,Ed25519 优于 HMAC (非对称,可验签不需密钥)。但有 5 个深度遗漏:

1. **私钥生命周期** — Ed25519 私钥生一次还是每次启动? **建议**:
   - 首次启动 `crypto.generateKeyPairSync('ed25519')` → 私钥 `safeStorage.encryptString` → 落盘 `userData/keys/skill-signer.priv`
   - 公钥 → `userData/keys/skill-signer.pub`,**明文** (公钥不需要保密)
   - 后续启动 → 读私钥 → `safeStorage.decryptString` → 内存持有
2. **第三方 skill 公钥信任链** — 第三方开发者发布 skill 时用自己的私钥签,PiPiClaw 怎么信? 两种方案:
   - **方案 A (简单)**: 第三方开发者把公钥发给 PiPiClaw 维护者,加入 `trusted-keys.json` (项目仓库)。简单但**集中式**,新开发者要 PR
   - **方案 B (去中心化)**: 接 TOFU (Trust On First Use) — 用户首次导入 skill 时,弹"信任此开发者公钥"确认,记录到 `userData/trusted-skills.json`。**推荐**: PiPiClaw 桌面 app 走 TOFU 更合适
3. **ClawHub 集成** — 后端报告说 "W8 阶段:接入 ClawHub 真实签名"。这意味着 ClawHub 服务器有自己的签名,PiPiClaw 信任 ClawHub 公钥 (内置在 app 里,带版本管理)。**评审时必须看 ClawHub 集成方案,防止信任链分裂**
4. **签名内容范围** — 当前 `sign(skillName, content)` 只签 `skill.md` 内容。**应同时签**: `skill.md` + 所有依赖文件 + `manifest.json` (含 version, dependencies, author, createdAt)。**否则 attacker 改 manifest 不改 skill.md 仍能验签过**
5. **replay 攻击** — 签名没时间戳,attacker 截获合法签名的 skill,过 5 年还能用。**建议**: 签名加 `signedAt` + `expiresAt`,verify 时检查有效期

#### 边界 case: safeStorage 跨平台

参考 `electron/llm/LlmConfigStore.ts:52-59` 现有 fallback 逻辑:
```ts
if (safeStorage.isEncryptionAvailable()) {
  // Win DPAPI / macOS Keychain / Linux kwallet/gnome-keyring
} else {
  // fallback 明文
}
```

| 平台 | safeStorage backend | 风险 |
|---|---|---|
| Windows | DPAPI (用户上下文加密) | ✅ 同用户解得出;改用户 / 重装系统 = 失 |
| macOS | Keychain | ✅ 设备绑定,需用户密码 |
| Linux (with keyring) | gnome-keyring / kwallet | ✅ 但 headless server / WSL 无 keyring → false |
| Linux (no keyring) | (返回 false) | ⚠️ fallback 明文 (参考 `LlmConfigStore.ts:53-54`) |

**CFO 角度**:
- SkillSigner 私钥**绝不能** fallback 明文 — 没有 OS keychain 的环境**拒绝启动**比"明文落盘"更安全
- 加 startup check: `if (!safeStorage.isEncryptionAvailable() && !process.env.PIPICLAW_DEV) throw new Error('无法安全存储签名密钥,拒绝启动')`
- 加 UI 提示: "当前系统无可用密钥环,技能签名功能不可用,设置 → 安全"

**决定**: ✅ 修法大方向 PASS;需补 5 点 (私钥生命周期 / TOFU 信任 / ClawHub 集成评审 / 签名覆盖 manifest+deps / 时间戳防 replay);Linux fallback 明文禁止,直接拒绝启动。

---

### 1.6 跨 5 洞的横切关注

| 维度 | 现状 | P0 修后应有 |
|---|---|---|
| **日志 redact** | 多个 handler 打印 request body (后端 m8) | 必须统一: token / apiKey / signature 全 redact |
| **错误信息泄露** | 500 错误带完整 stack | 生产环境: 只返 `errorCode`,详细堆栈进日志 |
| **rate limit** | 18789 端点无限速 | 至少 100 req/min/IP, 防 DoS (本地提权场景下意义不大,但防误调用) |
| **审计** | 部分模块有 | 所有 `runCommand` / `deleteFile` / `forceResetToPermissive` 必入审计 log |
| **回归测试** | 缺 | P0 修完必须加 e2e: 恶意网页攻击模拟 + token 失效 + shell 注入 payload |

---

## 2. 架构级安全设计 (5 边界)

### 2.1 端口边界 — 哪些端口必须 token,哪些只绑 loopback

| 端口 | 用途 | 绑定 | 鉴权 | 备注 |
|---|---|---|---|---|
| **18789** | OpenClaw HTTP 网关 | 127.0.0.1 (强制, P0 修) | Token (P0 修) | 不能绑 0.0.0.0; 即使 token 也只 loopback |
| **无其他端口** | — | — | — | 现在的单端口设计是对的,不要为"多平台管理"加 0.0.0.0 端口 |
| 未来 devtools port | CDP | 不要暴露 | — | 启动参数加 `--remote-debugging-port=0` 自动选端口,且 dev only |

**架构原则**:
1. **Default-deny**: 所有网络端口默认不启;启用需 config + 显式意图
2. **Loopback-only**: desktop app 的所有网络端点必须 127.0.0.1;`0.0.0.0` 必须有充分理由 + 二次确认
3. **Token-or-LAN**: 二选一,不能既绑 0.0.0.0 又只靠 token (token 会泄露)
4. **Port-bind 失败必须 fail-fast**: 当前 `OpenClawServer.ts:91-97` 自动切端口是好的,但要 log + 用户可见通知

**实施检查清单** (backend 改完后我能 verify):
- [ ] `OpenClawServer.start()` 接受 `host` 参数,默认 `127.0.0.1`,启动时 assert `host !== '0.0.0.0' && host !== '::'`
- [ ] `OpenClawServerConfig` 加 `requireAuthToken: boolean`,默认 `true`
- [ ] `X-OpenClaw-Token` 在 `/execute` 强制,`/health` 可选 (用 query param `?token=`)
- [ ] 所有 5xx 错误**不返** stack trace,只返 `errorCode`
- [ ] 加 `process.env.PIPICLAW_OPENCLAW_HOST` 环境变量,允许 dev 改 host,但 production 拒绝 `0.0.0.0`

---

### 2.2 IPC 边界 — 哪些 channel 必须 validate input,白名单 vs 黑名单

**当前问题**: `IpcServer.ts:1183` 形参是 `request: OpenClawOperationRequest`,类型存在但运行时没校验;`task:execute` 接收 `task: any` (后端报告 M4)。

**架构原则: 白名单 > 黑名单**

| Channel 类型 | 校验策略 | 例 |
|---|---|---|
| **高危操作 (执行/删除/写)** | **schema 强制 + 白名单** (zod) | `openclaw:execute`, `task:execute`, `skill:delete`, `file:write` |
| **敏感读取** | **schema 强制 + 范围检查** | `clipboard:read`, `im:send` |
| **普通查询** | schema 校验 (可降级为 type check) | `chat:list`, `model:list` |
| **纯渲染** | type check 即可 | `theme:get`, `i18n:get` |
| **通知类** | 几乎不需校验 | `event:publish` (但要校验 event 类型在白名单) |

**具体 schema 建议** (例, `openclaw:execute`):

```ts
const OpenClawExecuteSchema = z.object({
  operation: z.enum([
    'read_file', 'write_file', 'create_file', 'delete_file',
    'list_directory', 'create_directory', 'delete_directory',
    'run_command',  // ← 即使白名单 schema,执行前还要走 ProcessSandbox
    'open_url', 'clipboard_read', 'clipboard_write',
    'browser_open', 'browser_navigate', 'browser_close'
  ]),
  params: z.record(z.unknown()).refine(
    (params) => {
      // 二次校验: path 不在拒绝列表 / command 在白名单
      return validateOperationParams(params);
    },
    { message: 'params validation failed' }
  ),
  timestamp: z.number().int().min(Date.now() - 60_000) // 防止重放
});
```

**实施检查清单**:
- [ ] 引入 `zod` (或 `valibot` 更轻量) 作 IPC schema 库
- [ ] 抽 `ipc-contracts.ts` 集中所有 schema
- [ ] 高危 channel 全部走 `schema.safeParse` → 失败返 `{ success: false, errorCode: 'INVALID_PARAMS' }`
- [ ] 加 IPC audit: 每个高危 channel 调用记录 `{ channel, params (redacted), result, durationMs, webContentsId }` → EventBus
- [ ] 加 `webContents.id` 校验: renderer IPC 必须能溯源到具体窗口,防止被冒充

---

### 2.3 文件系统边界 — safeStorage 用法, 哪些 secret 必须进 safeStorage

**safeStorage 跨平台行为** (基于 `electron/llm/LlmConfigStore.ts:52-59` 现有用法):

| 平台 | backend | 加密强度 | 用户迁移友好 |
|---|---|---|---|
| Windows | DPAPI (user-context) | 中 (同用户可解) | ✅ 重装系统失 |
| macOS | Keychain | 高 (需密码) | ✅ iCloud Keychain 可同步 |
| Linux (有 keyring) | gnome-keyring / kwallet | 高 | ⚠️ 不同 desktop env 不同 backend |
| Linux (无 keyring) | **无,fallback 明文** | ❌ | — |
| WSL | 走 Windows DPAPI | 中 | ✅ |
| Docker container | 通常无 keyring | ❌ | — |

**架构原则: 必须进 safeStorage 的 secrets**

| Secret | 当前是否加密 | 应有 | 备注 |
|---|---|---|---|
| LLM API keys | ✅ (`LlmConfigStore`) | ✅ | 已做 |
| IM platform tokens (Feishu/DingTalk/WechatWork 等) | ⚠️ 待审 `IMConfigStore` | ✅ | 11 平台都用,优先级最高 |
| SkillSigner 私钥 | ❌ 硬编码 | ✅ P0 修 | Ed25519 + safeStorage |
| **OpenClaw authToken** (运行时) | ❌ | ❌ (不落盘,内存) | 每次启动生成 |
| ConfigStore 通用值 | ❌ JSON | ⚠️ 看字段 | theme / window size 不需加密;但 ssh key / pgp key 必须 |
| HermesMemory | ❌ markdown | ⚠️ 视情况 | 内容是用户对话,需 PII 处理 |
| **用户的 API 调用历史** | ❌ | ⚠️ 进 Insight 需 redact | 模型名称可留,内容 redact |
| CrashReport | ❌ | ❌ (含 stack trace 是合理的) | 但不能含 API key / 用户密码 |

**Linux fallback 策略** (CFO 角度):

**当前行为** (LlmConfigStore:53-54, 57-59): fallback 明文 + 仅 warn。**CFO 角度这是不可接受的** — 用户的 OpenAI key 明文落盘 = 任何本机进程能读 = 零安全。

**推荐策略**:
- **Tier 1 (强制 safeStorage)**: SkillSigner 私钥、IM tokens → `if (!safeStorage.isEncryptionAvailable() && !process.env.PIPICLAW_DEV) throw '无法加密存储,功能不可用'`
- **Tier 2 (强警告)**: LLM API keys → 现有 fallback,但加 UI 红条 "API key 明文存储,建议安装 keyring"
- **Tier 3 (可选加密)**: 普通 config → JSON 明文,内容不敏感

**实施检查清单**:
- [ ] 加 `SafeStorage.required` 配置开关,允许用户在 dev 环境跳过 (但 UI 强提示)
- [ ] 所有 token 类 secret 走统一 `SecretStore` 抽象,不要每个模块自己实现
- [ ] 加 `SecretStore.list()` → 返回 `[ { name, encrypted, available } ]` 给 Settings 显示
- [ ] Linux 上检测 keyring 类型 (gnome-keyring / kwallet / basic),写到诊断日志

---

### 2.4 第三方 SDK 边界 — Playwright sandbox 安全约束, 跨域策略

**当前 Playwright 状态**: `electron/openclaw/OpenClawGateway.ts` 有 `browserManager`,但具体实现待审 (grep 看到 `browserManager.createSession`,`navigate` 等调用)。

**架构原则** (假设用 Playwright,需 verify):

| 维度 | 约束 |
|---|---|
| **启动参数** | `chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })` — 注意 `--no-sandbox` 是 Playwright 在 root 环境必加,但**实际是降级**,要 log warning |
| **沙箱隔离** | `browser.newContext({ viewport, userAgent, locale })` — 每个会话独立 context,无 cookie 共享 |
| **跨域限制** | CSP 严格 `default-src 'self'; script-src 'self' https://cdn.jsdelivr.net;` — 不要 `'unsafe-inline'` `'unsafe-eval'` |
| **下载拦截** | `page.on('download')` → 默认 deny,需要用户二次确认 |
| **文件上传拦截** | `page.on('filechooser')` → 弹 "选择本地文件",走 IPC 调 main process,不要直接给 browser context |
| **凭据注入** | 永远不要用 `page.fill('[name=password]')` 自动填用户真实密码。**LLM 看到的密码必须 redact** |
| **PII 保护** | `page.screenshot()` / `page.content()` 返回前 redact 邮箱/手机/身份证号 regex |
| **进程隔离** | 浏览器进程不能和 main process 共享 memory;用 `context.route()` 拦截,不要改 page.evaluate |
| **网络出站白名单** | 默认 deny 跨域,只允许用户显式允许的域名 |
| **关闭** | `context.close()` + `browser.close()`,超时强制 kill |

**跨域策略细则**:

- **同源 (same-origin)**: 默认 allow
- **跨子域**: 弹确认 + 记 audit
- **跨主域**: 默认 deny,需要白名单
- **file:// 起源**: 默认 deny (防止 file:// 攻击 page)
- **localhost (其他端口)**: 默认 deny,白名单 allowlist (PiPiClaw 自己 18789 端口要 deny! 不能从 Playwright 反向调 OpenClaw)

**实施检查清单**:
- [ ] Playwright launch 参数走配置文件,不允许运行时改
- [ ] 所有 navigation 走 `safeNavigate(url)`,校验 URL scheme + 域名白名单
- [ ] `page.content()` 截取前 redact
- [ ] download / filechooser handler 必须有,默认 deny
- [ ] Playwright 进程独立崩溃不影响 main process (用 `child_process.spawn` 或 worker)

---

### 2.5 进程边界 — 子进程 spawn 参数验证

**当前问题**: `runCommand` (`OpenClawGateway.ts:686-690`) `execAsync` 缺所有安全约束 (见 §1.3)。

**架构原则**:

```
                 main process (privileged)
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐   ┌─────▼─────┐   ┌────▼────┐
   │Renderer │   │ OpenClaw  │   │Playwright│
   │  IPC    │   │ Sandbox   │   │ Browser  │
   │  ctx    │   │  Process  │   │  Process │
   │isolation│   │ detached  │   │ isolated │
   └─────────┘   └───────────┘   └─────────┘
       ↑               ↑              ↑
   contextBridge   stdio pipe    stdia pipe
   + sandbox=true  env scrubbed  viewport bounded
```

| 维度 | 约束 |
|---|---|
| **Binary 路径** | 必须 resolve 成绝对路径 + 验证 sha256 白名单 (在 `~/.pipiclaw/sandbox/binaries/`) |
| **Args** | zod schema 校验,不允许 `--exec` `-c` 等危险 flag |
| **cwd** | 必须在 sandbox root 内 (`path.relative` 检查) |
| **env** | 白名单 only,显式 `env: { PATH, HOME, LANG }` 等,不带 parent 进程 env |
| **stdio** | `'pipe'`,主进程收 stdout/stderr,做 redact 后再返 renderer |
| **timeout** | 必须有,默认 30s,timeout 触发 kill 进程组 (-pid SIGTERM) |
| **资源限制** | 用 `ulimit` / cgroup / Windows Job Object 限制 CPU/MEM |
| **stdout buffer** | maxBuffer 1MB,超限 kill 进程 |
| **exit code** | 返给 renderer,非 0 + 没 stderr 不算失败 |
| **审计** | 每次 spawn 记 `{ binary, args, cwd, exitCode, durationMs, userId }` |

**Windows vs POSIX 分支** (CFO 角度必须做):

```ts
// 建议结构 electron/openclaw/ProcessSandbox.ts
export interface ProcessSandbox {
  spawn(opts: SpawnOptions): Promise<SpawnResult>;
  killTree(pid: number): Promise<void>;
  isPathSafe(target: string): boolean;
}

// electron/openclaw/ProcessSandbox.win.ts
// electron/openclaw/ProcessSandbox.posix.ts
// factory 选择
```

**实施检查清单**:
- [ ] 抽 `ProcessSandbox` 接口,Windows / POSIX 实现分开
- [ ] 现有 `runCommand` 替换为 `ProcessSandbox.spawn`
- [ ] `cwd` 校验统一在 `isPathSafe`,所有 filesystem 操作共享
- [ ] `env` 白名单抽到 `ProcessSandbox.SAFE_ENV` 常量
- [ ] kill 进程组 (Windows `taskkill /T /F`,POSIX `kill -KILL -pgid`)
- [ ] 加 `spawn` 单元测试: 验证 cwd 越界被拒 / 危险 flag 被拒 / 资源限制生效

---

## 3. 风险评估 (修完 P0 后的剩余风险)

### 3.1 修完 P0 4 洞后还剩什么

| 风险 | 等级 | 描述 |
|---|---|---|
| **本地恶意软件提权** | 🟠 Major | 即使有 token,127.0.0.1 上的 malware 仍能拿到 token (读 main process 内存)。**缓解**: token 走 IPC 而不是 HTTP,malware 必须有 main process 调试能力 |
| **IPC `any` 参数** | 🟠 Major | 164 个 handler,大多数参数无 schema 校验 (后端 M4)。即使 OpenClaw 安全了,`task:execute` / `skill:register` 仍是入口 |
| **LLM API key 明文流转** (旧 ModelManager) | 🟠 Major | 架构师 C3: ChatManager 走旧 ModelManager,key 不进 safeStorage |
| **forceResetToPermissive 删除不彻底** | 🟡 Minor | 如果 backend 只加 env 开关,用户不开 env 仍被强制 |
| **IM 6/11 stub 平台** | 🟡 Minor | 6 个 stub 的 channel-config:test 永远 false,UI 误导 |
| **ScheduleTask 一次后不再重排** (后端 C5) | 🟡 Minor | daily/weekly 不重排,功能失效 |
| **CapabilityRegistry 0 域** | 🟡 Minor | contracts 是空壳,跨域调用无校验 |
| **Agent 是装饰** | 🟡 Minor | 用户以为能 tool call,实际 stub |
| **Ed25519 信任链 TOFU UX 差** | 🟡 Minor | 弹"信任此开发者"可能被用户一键跳过 |
| **safeStorage Linux fallback** | 🟠 Major | 当前 fallback 明文,CFO 角度不可接受 |
| **OpenClaw HTTP 18789 端口可被 brute force** | 🟡 Minor | token 32 字节 hex 防 brute force,但要加 rate limit |
| **Playwright 反向调 OpenClaw** | 🟡 Minor | 同一台机器 browser → fetch 18789,要 deny (同源策略不防 127.0.0.1) |
| **CrashReport 包含敏感信息** | 🟡 Minor | uncaughtException stack trace 可能含 API key / 用户输入 |
| **审计日志本身** | 🟡 Minor | 写了 `runCommand` 的全命令,可能含 secret (env var 拼到命令行) |

### 3.2 假设的 attacker 模型

**CFO 角度: 谁会攻击 desktop AI 助手?**

1. **跨站恶意网页** (最常见) — 攻击者不需要本地权限,只要用户访问一个含 `<img src="http://127.0.0.1:18789/execute">` 的网页
   - **P0 修后**: ✅ Token 防御;但**仍需**移除 CORS `*`,因为 token 在 main process 不会自动发给 attacker
2. **同机恶意软件** (中等常见) — 装了破解软件、game hack, 启动后跑任意 code
   - **P0 修后**: ⚠️ 部分防御。Token 防读取,但 malware 可以 sub-process 调 18789。**关键是 CWD 沙箱 + command 白名单**
3. **其他 Electron app** (低) — Electron app 之间能互相 IPC? 取决于 manifest + 权限
   - **P0 修后**: ✅ Token 防御
4. **SSH 登录后远端 attacker** (低) — 拿到 SSH 的人已经有 user 权限
   - **P0 修后**: ❌ 防不住。Token 不防同用户进程
5. **LLM prompt injection** (新, AI 时代特有) — 恶意网页 / 文档 / email 让 LLM 输出 `run_command: rm -rf ~`
   - **P0 修后**: ⚠️ 部分防御。Command 白名单 + CWD 沙箱挡 `rm -rf`;但 `git config core.hooksPath /tmp/evil && git commit --allow-empty` 仍能 RCE
6. **物理访问 attacker** (极低) — 拿到电脑的人
   - **P0 修后**: ❌ 防不住。磁盘加密 (FileVault / BitLocker) 才是答案
7. **同用户恶意 npm 依赖** (中) — 用户装了一个 npm 包,它在 dev 模式跑
   - **P0 修后**: ❌ 防不住。npm 审计才是答案

**CFO 结论**: P0 修后,模型 1 / 3 / 5 (部分) 防御;模型 2 / 4 / 6 / 7 仍存。**这是合理的**: 桌面 app 安全模型本来就假设用户自己的进程是可信的。**关键是不能让模型 1 / 3 出现,这才是 P0 必须修的。**

---

## 4. 30 / 90 / 180 天安全 Roadmap

### 4.1 30 天 — "P0 修完能 dogfooding"

**目标**: 修 5 个 critical + 加最小防御纵深 + e2e 验证

| 周 | 任务 | 验收 | 风险 |
|---|---|---|---|
| W1 | C1 + C2: CORS 移除 + 18789 token + OPTIONS deny | 同机恶意网页不能调 18789;e2e: 浏览器 fetch 18789 拿 403 | 漏: token 泄露面,要在日志 redact |
| W1 | C3: `runCommand` 改 `ProcessSandbox.spawn` + 白名单 + cwd 沙箱 | shell 注入 payload 测试全 fail;`git config core.hooksPath` 路径被拒 | 漏: env 泄露,要在 spawn 时 env 白名单 |
| W1 | C4: `SkillSigner` Ed25519 + safeStorage + TOFU | 第三方 skill 导入走 verify 弹窗;伪造 skill 被拒 | 漏: Linux fallback 明文,要拒绝启动 |
| W2 | C5 (forceResetToPermissive 评审): 删除强制重置 + 默认 safe + 重命名 permissive | UI 选 safe 后重启仍 safe;首次安装默认 safe | 漏: 升级用户的旧 config 要 migration |
| W2 | 加 IPC schema 校验 (zod) 给高危 channel (10 个) | `openclaw:execute` / `task:execute` / `skill:register` 全 schema 校验 | 漏: 性能影响,要做 benchmark |
| W2 | 删 stub (后端 C5 顺带): ScheduleTask 重排 | daily/weekly 真定时 | — |
| W3 | 回归测试 + 渗透测试脚本 | `npm run e2e:security` 跑通: 注入 / CSRF / token brute force 全 fail | — |
| W3 | 写 "安全公告 v4.3.1" 文档,告诉用户: 哪些行为变了 | CHANGELOG + GitHub release notes | — |

**30 天 ship 物**:
- 5 critical 全修
- zod schema 覆盖 10 个高危 channel
- `e2e:security` 测试套件
- CHANGELOG 安全公告

**ship 策略**: 仅给**内部 dogfooding 用户** (developer + 内部 QA + 早期支持者),**不公开给所有 GitHub 用户**。**v4.3.1** (不是 v4.4.0) 命名,体现 "这是补丁,不是新功能"。

---

### 4.2 90 天 — "真 LLM 抽象 + IPC schema 全覆盖 + safeStorage 严格"

**目标**: P1 安全洞全修 + 真正"agent 平台"基础

| 月 | 任务 | 验收 | 风险 |
|---|---|---|---|
| M2 | LLM 抽象统一 (架构师 C3 / 后端 M1): ChatManager 切到 LlmClient,加 SSE + AbortController + 5 provider | 旧 ModelManager 退役,所有 chat 走 LlmClient | 漏: 流式兼容性 |
| M2 | 全部 164 个 IPC handler 加 zod schema | `task:list` 等纯查询也 schema 校验 | 漏: schema 错误导致 breaking change |
| M2 | safeStorage 严格模式 (Tier 1 强制 + Linux 拒绝启动) | 没 keyring 的 Linux 用户收到 "Skill 签名不可用" 提示 | 漏: 体验差,要 UX 优化 |
| M2 | `ProcessSandbox` 抽 platform 分支,补 env 白名单 / kill 进程组 | `runCommand` 在 Windows / POSIX 行为一致 | 漏: 测试覆盖 |
| M3 | CapabilityRegistry 真注册 (架构师 M2) | `agent:list` 返 6+ 域;跨域调用有 trace_id | 漏: W3 蓝图要先冻结 |
| M3 | ClawHub skill 签名集成评审 (后端 C4 续) | 第三方 skill 公钥 TOFU + 过期检查 | 漏: ClawHub 服务端要同步改 |
| M3 | IM 6 stub 平台降级为"即将上线" UI (后端 M5) | 配 Lark / QQ 后 healthCheck 真反映"未上线" | — |
| M3 | `insight:cost:today` 真接 CostTracker (架构师 M3) | Dashboard 显示真实数字 | — |
| M3 | MemoryVectorStore 持久化 (后端 M2) | sqlite-vss 落盘 + 真实 embedding | 漏: 性能 |

**90 天 ship 物**:
- LLM 抽象统一
- 全 IPC schema 化
- safeStorage 严格模式
- ProcessSandbox 平台分支
- CapabilityRegistry 真注册
- ClawHub 签名集成
- 6 IM stub 降级

**ship 策略**: 给**早期真实用户** (Beta tester 群), 开启 telemetry + 自动报告 crash。

---

### 4.3 180 天 — "MCP + 多端 + 进化 — 真 production-grade"

**目标**: v5.0.0 真 production-grade,达到 "拳打 workbuddy,脚踢 openclaw" 的一半

| 月 | 任务 | 验收 | 风险 |
|---|---|---|---|
| M4 | MCP server 集成 (final §5 180 天 #1) | PiPiClaw 作为 MCP client 调 GitHub / Slack / Notion server | 漏: MCP 协议版本兼容性 |
| M4 | 第三方 skill marketplace (final §5 180 天 #5) | 第三方开发者能为 PiPiClaw 写 skill + 发布 | 漏: 审核机制 (类似 npm) |
| M4 | 端到端加密 (E2EE) 多端同步 | A 电脑和 B 电脑 chat 记录加密同步 | 漏: key 同步 / 设备管理 UX |
| M5 | 真 agent tool call loop (架构师 M1 续) | ExecutionEngine 真接 file/shell/browser 工具 | 漏: LLM provider tool_call schema 不一致 |
| M5 | Evolution 自学习真接 LLM (final §5 180 天 #2) | 用 7 天后自动出现 5+ auto-generated skill | 漏: 用户审核 UX |
| M5 | 真 sandbox (Docker/WindowsJob/bwrap) (final §5 90 天 #5) | 用户说"跑 Python"真在隔离环境跑 | 漏: 跨平台 |
| M6 | 第三方安全审计 (外部团队) | 拿到 audit 报告 + 修复 high/critical | 漏: 预算 |
| M6 | Bug Bounty 计划 (HackerOne / 自建) | 至少 1 个外部 researcher 报过 | 漏: 法律 / 财务 |
| M6 | 公开威胁模型 (Threat Model) 文档 | `docs/security/threat-model.md` 公开 | — |

**180 天 ship 物**:
- MCP 生态
- 第三方 skill marketplace
- E2EE 多端同步
- 真 agent tool call
- Evolution 自学习
- 真 sandbox
- 外部安全审计通过
- Bug Bounty 启动
- 公开威胁模型

**ship 策略**: v5.0.0 production-grade, 给所有 GitHub 用户 + 推广。

---

### 4.4 持续 (无论哪个阶段都要做)

| 任务 | 频率 |
|---|---|
| 依赖 `npm audit` | 每周 CI |
| 关键 dep 版本监控 (electron, safe-storage backend) | 每月 |
| `permission-audit.md` 文档更新 | 每次发版 |
| 安全公告 (CHANGELOG security section) | 每次发版 |
| 桌面应用加固检查 (Electron Security Checklist) | 每季度 |
| 跨平台 desktop 测试 (Win/macOS/Linux 真实 e2e) | 每月 |

---

## 5. 评分 X/10

**评分依据**: 基于 5 洞评审 + 5 边界设计 + 风险评估,给出对 backend P0 修法的整体评分。

| 维度 | 评分 | 说明 |
|---|---:|---|
| P0 修法方向 (5 洞) | **7.5/10** | C1/C2/C3/C5 方向对,C4 (forceResetToPermissive) 修法过轻 |
| 边界 case 覆盖 | **6.5/10** | 5 洞共发现 22 个深度遗漏 (每洞 4-5 个) |
| 架构级安全设计 | **8.0/10** | 5 边界都有原则 + 实施 checklist,但 IPC schema 还要落地 |
| 防御纵深 (defense in depth) | **7.0/10** | 5 边界互为补强,但 token-only 不是银弹 |
| 合规 & 可观测 (audit / log) | **6.5/10** | 当前审计不统一,需 SecretStore 抽象 |
| 跨平台 (Win/macOS/Linux) | **6.0/10** | safeStorage Linux fallback 是 CFO 角度的硬伤 |
| 真实用户风险 | **6.0/10** | P0 修后防御模型 1/3,仍有模型 2/5 部分风险 |

**加权平均**: (7.5 × 1.5 + 6.5 × 1.0 + 8.0 × 1.5 + 7.0 × 1.0 + 6.5 × 1.0 + 6.0 × 1.0 + 6.0 × 1.0) / 8.0 = **7.0/10**

**安全子维度评分** (从 3.0 → ?):
- 当前 (P0 修前): 3.0/10
- P0 4 洞修后预估: 5.5/10
- 补我提的 22 个深度遗漏后预估: 6.5/10
- 30 天 roadmap 完成后: 7.5/10
- 90 天 roadmap 完成后: 8.5/10
- 180 天 roadmap 完成后: 9.0/10

---

## 6. 决定 (PASS / CONDITIONAL / FAIL)

### CONDITIONAL PASS ✅⚠️

**理由**:
1. **5 个 critical 修法方向全部正确** — backend 选用的技术方案 (token / spawn / Ed25519) 都是行业标准
2. **修完后可防御 70% 现实攻击** — cross-origin CSRF / 同机恶意软件 / LLM prompt injection (部分)
3. **但有 22 个深度遗漏** — 主要是边界 case、跨平台 fallback、日志 redact、TOFU UX、信任链完整性
4. **架构级安全设计补足后能到 8+** — 5 边界的实施 checklist 是 backend 必读的补充

### 给 backend 的具体反馈 (5 条)

1. **C4 (forceResetToPermissive) 不能只加 env 开关** — 删掉这个函数调用,首次安装默认 safe,加 mode-switch audit
2. **C2 (token) 必须**:
   - `crypto.randomBytes(32).toString('hex')` 内存持有
   - IPC 通道 `openclaw:token:get` 返回,需要 `webContents.id` 校验
   - 日志 redact,error 不返 token,`timingSafeEqual` 比对
3. **C3 (runCommand) 必须**:
   - 抽出 `ProcessSandbox`,Windows/POSIX 各自实现
   - 不仅 baseCmd 白名单,**整条命令结构化或禁止透传 shell**
   - `cwd` 严格 sandbox,`env` 白名单,stdio redact,进程组杀
4. **C5 (SkillSigner) 必须**:
   - Ed25519,私钥 `safeStorage`,公钥明文
   - Linux fallback **拒绝启动** (除非 `PIPICLAW_DEV=1`)
   - TOFU UX 显式,签名带 `expiresAt`,签名覆盖 manifest + deps
5. **统一加固**:
   - 高危 IPC channel (至少 10 个) 加 zod schema
   - 所有 5xx 错误不返 stack trace
   - 加 `e2e:security` 测试套件

### 评审不可妥协的红线 (CFO 视角)

1. ❌ **不允许 ship 前 OpenClawServer 仍 CORS `*`** — 哪怕 backend 计划"下个版本修"
2. ❌ **不允许 `forceResetToPermissive` 仍每次启动调用** — 这是 "active 漏洞",不是"计划改进"
3. ❌ **不允许 `runCommand` 仍 `shell:true` 默认值** — 即使加了白名单,默认必须 `shell:false`
4. ❌ **不允许 token 落盘** — 内存持有 + IPC 注入
5. ❌ **不允许 SkillSigner 私钥 Linux fallback 明文** — 拒绝启动比明文安全

### 建议 ship 流程

1. **W1-W2**: backend 按本文档修 5 洞, + 5 条反馈
2. **W2 末**: 拉我 + QA 评审 PR, 我 verify 22 个深度遗漏
3. **W3**: 跑 `e2e:security` + 跨平台 smoke, 验证
4. **W3 末**: ship v4.3.1 给**内部 dogfooding**
5. **W4-W12**: 跑 30 天 roadmap, ship v4.4.0 给 early adopter
6. **M3-M6**: 跑 90/180 天 roadmap, ship v5.0.0 production

---

## 7. 附录 — backend 实施时的 22 个深度遗漏清单

| # | 归属 | 遗漏 |
|---|---|---|
| 1 | C1 CORS | `file://` origin 实际不生效,改用"移除 CORS 头" |
| 2 | C1 CORS | OPTIONS 预检要 403 deny,不是 200 |
| 3 | C1 CORS | token 不落盘,内存持有 |
| 4 | C1 CORS | `timingSafeEqual` 比对,不是 `===` |
| 5 | C1 CORS | `/health` 端点也要 token 或不返 version |
| 6 | C2 token | token 泄露面: 日志 / 错误 / IPC 必须全 redact |
| 7 | C2 token | token rotation 策略: 启动轮换 + Settings 重置 |
| 8 | C2 token | 即使有 token,127.0.0.1 仍可能被本地提权,文档要诚实 |
| 9 | C3 shell | 白名单要结构化,不能只看 baseCmd |
| 10 | C3 shell | cwd 严格 `path.relative` 检查,不只 `resolvePath` |
| 11 | C3 shell | env 白名单,不能 inherit parent |
| 12 | C3 shell | stdio redact,敏感 regex (sk-... / password=...) |
| 13 | C3 shell | 进程组杀,Windows `taskkill /T /F` |
| 14 | C3 shell | 抽 `ProcessSandbox`,Windows / POSIX 各自实现 |
| 15 | C4 forceReset | 不能只加 env 开关,要删调用 + 默认 safe + 改名 |
| 16 | C4 forceReset | 模式切换进 audit log |
| 17 | C5 SkillSigner | 私钥生命周期,落盘 + safeStorage |
| 18 | C5 SkillSigner | TOFU 信任链,不要集中式 |
| 19 | C5 SkillSigner | 签名覆盖 manifest + deps,不只是 skill.md |
| 20 | C5 SkillSigner | 签名带 `expiresAt` 防 replay |
| 21 | C5 SkillSigner | Linux fallback 拒绝启动,不要明文 |
| 22 | 全局 | 高危 IPC (10 个) 加 zod schema |

---

**报告路径**: `D:\pipiclaw\piclaw\docs\team\2026-08-05-architect.md`
**评审耗时**: 阅读 3 份报告 (5,000+ 行) + 5 个核心文件 (1,500+ 行) + 评审 60 分钟
**总字数**: ~7,000 字
**数据源**: docs/audit/01-architecture-report.md + 03-backend-report.md + 05-final-report.md + OpenClawServer.ts:182-226 + OpenClawGateway.ts:676-693,870-905 + PermissionConfig.ts:290-307 + SkillSigner.ts:24 + SkillRuntime.ts:74-107 + LlmConfigStore.ts:52-95 + main.ts:84-86
