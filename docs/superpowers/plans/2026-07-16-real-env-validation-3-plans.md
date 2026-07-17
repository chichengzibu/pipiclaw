# v2.0.0 Real-Environment Validation 3 Sub-Project Implementation Plans

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement these plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在真实用户环境把 v2.0.0 的 5 demo + 真实 IM 账号 + docker 沙盒链路跑通

**Architecture:** 3 个独立子项目分别实施,**严格按优先级 C → A → B** 执行(C 是基础,D2-Prime demo 依赖 C)

**Tech Stack:** Node.js 20+ / Electron 30+ / TypeScript 5+ / Docker 24+ / ngrok(外部 CLI)/ Vitest 1.6+

**前置条件**:
- ✅ v2.0.0 GA 已发(tag `v2.0.0`,commit `b474165`)
- ✅ 178/178 unit test 通过
- ✅ tsc 0 错
- ✅ 3 spec 已落库(`925e2ba`):
  - [C spec](file:///D:/pipiclaw/piclaw/docs/superpowers/specs/2026-07-16-c-sandbox-validation-design.md)
  - [A spec](file:///D:/pipiclaw/piclaw/docs/superpowers/specs/2026-07-16-a-5demo-real-env-validation-design.md)
  - [B spec](file:///D:/pipiclaw/piclaw/docs/superpowers/specs/2026-07-16-b-real-im-account-integration-design.md)

---

## 总体约束(3 子项目共通)

- **不引入新 npm 依赖**(C/A/B 全部走项目内 + 外部工具)
- **不修改既有 sandbox / demo / channel / contracts / ChatManager / IpcServer / preload / tokens / variables 业务代码**(C:22 sandbox / A:5 demo / B:19 channel 全部 0 改动)
- **A 必须等 C 完成**(D2-Prime demo 需 docker 沙盒跑通)
- **B 可与 A 并行**(不依赖 A 的产出)
- **每子项目写 retro**:落库 `docs/superpowers/retros/2026-07-16-<id>-<topic>/retros.md`
- **每子项目 1 个 commit**(subagent 自己 git add + commit,短英文 message)
- **每子项目 1 个 general_purpose_task subagent**(独立,串行派发)

---

# Plan C — P7 沙盒真实环境链路验证

**Goal:** 在真实 docker + 用户机环境把 W9-W11 sandbox 全链路组件跑通(selfcheck / build 镜像 / SandboxBuilder 选模板 / PortForwarder / SandboxL1 / Lifecycle)

**前置 spec**: [2026-07-16-c-sandbox-validation-design.md](file:///D:/pipiclaw/piclaw/docs/superpowers/specs/2026-07-16-c-sandbox-validation-design.md)

**前置 commit**:`b474165`(W12 docs,v2.0.0 已 GA)

**真实环境依赖**:Docker 24+(daemon 跑) + macOS sandbox-exec(系统自带)/ Linux bubblewrap / 磁盘 ≥10GB / 网络访问 npm/pypi/maven/goproxy 国内镜像

**Subagent 估算时间**:1-2 小时(含 build 镜像 15-30 分钟)

---

### Task C-1: 跑 sandbox:selfcheck 5 检查

**Files:**
- Read: `scripts/sandbox-selfcheck.mjs` W10.3
- Create: `docs/superpowers/retros/2026-07-16-c-sandbox-validation/retros.md`(空,Task C-6 完成)

- [ ] **Step 1: 跑 selfcheck 脚本**

```bash
cd D:\pipiclaw\piclaw
node scripts/sandbox-selfcheck.mjs
```

Expected output(典型):
```
[cmd] docker build -t pipiclaw/sandbox-base:latest -f sandbox/base/Dockerfile sandbox/base/
========================================
  ✅ docker-installed                Xms
  ✅ docker-daemon-up                Xms
  ❌ base-image-exists                Xms (image NOT found)
  ❌ can-run-hello                    Xms (image NOT found)
  ❌ l1-self-test                     Xms
========================================
  2/5 passed
========================================
```

注:base-image 和 can-run-hello 期望 ❌(镜像未 build),l1-self-test 期望 ❌(W11 stub)。

- [ ] **Step 2: 记录 selfcheck 结果到 retro**

写入 `docs/superpowers/retros/2026-07-16-c-sandbox-validation/retros.md`(本 Task 占位):

```markdown
# C 子项目 — P7 沙盒真实环境链路验证 报告

**日期**: 2026-07-16
**真实环境**: [macOS/Windows/Linux] + Docker [版本] + Node [版本]

## Task C-1 selfcheck 结果
- docker-installed: ✅
- docker-daemon-up: ✅
- base-image-exists: ❌(未 build,Task C-2)
- can-run-hello: ❌(同上)
- l1-self-test: ❌(W11 stub)

## Task C-2 build 结果
(待 Task C-2 完成)

## Task C-3 容器 4 语言结果
(待 Task C-3 完成)

## Task C-4 SandboxBuilder 结果
(待 Task C-4 完成)

## Task C-5 PortForwarder + L1 + Lifecycle 结果
(待 Task C-5 完成)

## 整体验收
- selfcheck 5/5: [ ] (L1 skip 计 not-ok)
- base 镜像 build: [ ]
- SandboxBuilder 写 6 文件: [ ]
- PortForwarder hostPort 4000+: [ ]
- macOS SandboxL1 输出 hello: [ ]
- SandboxLifecycle touch + listStates: [ ]
```

- [ ] **Step 3: 验证 docker 环境**

```bash
docker --version
docker info | head -5
```

Expected: 输出 docker 24.x 版本 + daemon 信息。

如失败:
- Docker Desktop 未启动 → 启动 Docker Desktop,等 30s 重试
- daemon down → 提示用户启动 docker daemon
- 无 docker → 提示用户安装 Docker Desktop

### Task C-2: build base 镜像

**Files:**
- Read: `sandbox/base/Dockerfile` W9.4
- Read: `scripts/sandbox-base-build.mjs` W9.4

- [ ] **Step 1: 跑 build 脚本(--run 模式)**

```bash
cd D:\pipiclaw\piclaw
node scripts/sandbox-base-build.mjs --run
```

Expected: 脚本调 `docker build -t pipiclaw/sandbox-base:latest -f sandbox/base/Dockerfile sandbox/base/`,耗时 15-30 分钟,可能输出:

```
[cmd] docker build -t pipiclaw/sandbox-base:latest -f sandbox/base/Dockerfile sandbox/base/
[run-now] 真执行 docker build...
[+] Building 1234.5s (12/12) FINISHED
[ok] 镜像构建成功
```

- [ ] **Step 2: 验证镜像已 build**

```bash
docker images | grep pipiclaw/sandbox-base
```

Expected:
```
pipiclaw/sandbox-base    latest    abc123def456    5 minutes ago    1.2GB
```

- [ ] **Step 3: 记录 build 结果到 retro**

更新 `docs/superpowers/retros/2026-07-16-c-sandbox-validation/retros.md`,在 `## Task C-2 build 结果` 段写入:

```markdown
## Task C-2 build 结果
- 镜像名: pipiclaw/sandbox-base:latest
- 大小: [实际 GB]
- build 耗时: [实际分钟]
- exit code: 0
```

### Task C-3: 验证容器 4 语言

**Files:** N/A(只跑命令)

- [ ] **Step 1: 进容器验 4 语言版本**

```bash
docker run -it --rm pipiclaw/sandbox-base:latest bash -c "node --version && python3 --version && java -version 2>&1 && go version"
```

Expected output:
```
v22.x.x
Python 3.12.x
openjdk version "21.x.x"
go version go1.23.x linux/amd64
```

- [ ] **Step 2: 验证国内镜像源配置**

```bash
docker run -it --rm pipiclaw/sandbox-base:latest bash -c "npm config get registry && pip3 config get global.index-url"
```

Expected:
```
https://registry.npmmirror.com
https://pypi.tuna.tsinghua.edu.cn/simple
```

- [ ] **Step 3: 记录到 retro**

```markdown
## Task C-3 容器 4 语言结果
- node: [实际版本]
- python3: [实际版本]
- java: [实际版本]
- go: [实际版本]
- npm registry: https://registry.npmmirror.com
- pypi mirror: https://pypi.tuna.tsinghua.edu.cn/simple
```

### Task C-4: SandboxBuilder 选 vite-react-ts 模板

**Files:**
- Read: `electron/sandbox/SandboxBuilder.ts` W10.1
- Read: `electron/sandbox/templates/vite-react-ts.ts` W10.1

- [ ] **Step 1: 写 + 跑 demo 脚本**

新建 `scripts/sandbox-real-env-demo.mjs`(临时):

```javascript
#!/usr/bin/env node
/**
 * SandboxBuilder + PortForwarder + L1 + Lifecycle 真实环境 demo
 * 用法: cd D:\pipiclaw\piclaw && node scripts/sandbox-real-env-demo.mjs
 */

import { SandboxBuilder } from '../electron/sandbox/SandboxBuilder.js'
import { SandboxLifecycle } from '../electron/sandbox/SandboxLifecycle.js'
import { PortForwarder } from '../electron/sandbox/PortForwarder.js'
import { SandboxL1 } from '../electron/sandbox/SandboxL1.js'

console.log('===== SandboxBuilder.build({ prompt: "做一个 Vite + React 博客" }) =====')
const builder = SandboxBuilder.getInstance()
const result = await builder.build({ prompt: '做一个 Vite + React 博客' })
console.log(JSON.stringify(result, null, 2))

console.log('\n===== SandboxLifecycle.touch(workspaceId) =====')
const lifecycle = SandboxLifecycle.getInstance()
lifecycle.touch(result.workspace.id)
console.log('listStates:', JSON.stringify(lifecycle.listStates(), null, 2))

console.log('\n===== PortForwarder.forwardPort(5173) =====')
const forwarder = PortForwarder.getInstance()
const forward = forwarder.forwardPort(5173, result.workspace.id)
console.log(JSON.stringify(forward, null, 2))

console.log('\n===== SandboxL1.run(["echo", "hello"]) =====')
const l1 = SandboxL1.getInstance()
console.log('currentMode:', l1.currentMode())
console.log('capability:', JSON.stringify(l1.capability()))
const l1Result = l1.run(['echo', 'hello'], { mode: l1.currentMode() })
console.log(JSON.stringify(l1Result, null, 2))

console.log('\n===== Workspace 目录文件清单 =====')
const fs = await import('node:fs/promises')
async function list(dir, depth = 0) {
  if (depth > 3) return
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    console.log('  '.repeat(depth) + e.name)
    if (e.isDirectory()) await list(`${dir}/${e.name}`, depth + 1)
  }
}
await list(result.workspace.hostPath)
```

- [ ] **Step 2: 跑 demo 脚本**

```bash
cd D:\pipiclaw\piclaw
node scripts/sandbox-real-env-demo.mjs
```

Expected output(关键部分):
```
===== SandboxBuilder.build() =====
{
  "ok": true,
  "workspace": { "id": "abc12345", "hostPath": "...", "containerPath": "/mnt/data" },
  "template": { "id": "vite-react-ts", "devPort": 5173, "fileCount": 6 },
  "templateReason": "auto-regex",
  "fileCount": 6
}

===== Workspace 目录文件清单 =====
package.json
vite.config.ts
tsconfig.json
index.html
src
  main.tsx
  App.tsx

===== PortForwarder.forwardPort(5173) =====
{ "ok": true, "entry": { "id": "...", "hostPort": 4000, "url": "http://localhost:4000" } }
```

- [ ] **Step 3: 验证 workspace hostPath 6 文件**

```bash
# 把 demo 脚本输出里的 hostPath 复制过来,例如:
ls "/tmp/pipiclaw-.../sandboxes/<workspaceId>/mnt/"
# 期望输出:index.html  package.json  src  tsconfig.json  vite.config.ts
```

- [ ] **Step 4: 记录到 retro**

```markdown
## Task C-4 SandboxBuilder 结果
- 选模板: vite-react-ts (auto-regex)
- workspace.hostPath: [实际路径]
- fileCount: 6
- 6 文件名: index.html / package.json / src/main.tsx / src/App.tsx / tsconfig.json / vite.config.ts
```

### Task C-5: PortForwarder + SandboxL1 + Lifecycle

**Files:** N/A(已写进 Task C-4 demo 脚本)

- [ ] **Step 1: 验证 PortForwarder 分配 hostPort = 4000**

看 Task C-4 demo 脚本输出。期望:
- `forwardPort(5173)` → hostPort = 4000(首次)或 4001(后续)
- entry.url = `http://localhost:4000`

- [ ] **Step 2: 验证 SandboxL1 真跑(macOS 期望 seatbelt,其他 fallback)**

看 Task C-4 demo 脚本输出。期望:

macOS:
```
currentMode: seatbelt
capability: { mode: 'seatbelt', available: true }
l1Result: { ok: true, mode: 'seatbelt', exitCode: 0, stdout: 'hello\n', stderr: '', fallback: false }
```

Linux(无 bwrap):
```
currentMode: stub  (或 bwrap 若已装)
capability: { mode: 'stub', available: false, reason: '平台 linux W9 不支持 L1 隔离' }
l1Result: { ok: false, mode: 'stub', exitCode: 1, fallback: true }
```

Windows:
```
currentMode: windows-job  (或 stub)
capability: { mode: 'windows-job', available: false, reason: 'W9 stub' }
l1Result: { ok: true, mode: 'windows-job', fallback: true }  // stub 返回
```

- [ ] **Step 3: 验证 SandboxLifecycle.touch + listStates**

看 Task C-4 demo 脚本输出。期望:
- `listStates` 返回 1 个 state,workspaceId 匹配
- state.status = 'running'

- [ ] **Step 4: 记录到 retro**

```markdown
## Task C-5 PortForwarder + L1 + Lifecycle 结果
- PortForwarder.forwardPort(5173): ok=true, hostPort=[实际]
- PortForwarder.entry.url: http://localhost:[hostPort]
- SandboxL1.currentMode: [seatbelt/bwrap/windows-job/stub]
- SandboxL1.capability: [JSON]
- SandboxL1.run(["echo", "hello"]): [JSON]
- SandboxLifecycle.touch(workspaceId): ok
- SandboxLifecycle.listStates: [JSON]
```

### Task C-6: 完成 retro + commit

**Files:**
- Update: `docs/superpowers/retros/2026-07-16-c-sandbox-validation/retros.md`
- Add (临时,不 commit): `scripts/sandbox-real-env-demo.mjs`

- [ ] **Step 1: 完成 retro 整体验收段**

更新 `docs/superpowers/retros/2026-07-16-c-sandbox-validation/retros.md`,在 `## 整体验收` 段填实际结果:

```markdown
## 整体验收
- selfcheck 5/5: ✅ (L1 skip 计 not-ok)
- base 镜像 build: ✅
- SandboxBuilder 写 6 文件: ✅
- PortForwarder hostPort 4000+: ✅
- macOS SandboxL1 输出 hello: ✅ / ❌ (按平台)
- SandboxLifecycle touch + listStates: ✅

## 关键决策 / 难题
(填实际遇到的难题)

## 遗留未改项
(填未能跑通的部分)
```

- [ ] **Step 2: 跑主会话兜底验证**

```bash
cd D:\pipiclaw\piclaw
npx vitest run 2>&1 | head -5
npx tsc --noEmit -p tsconfig.node.json 2>&1 | head -5
```

Expected: 178/178 通过,tsc 0 错。

如失败:**不修**——本任务不动业务代码,问题留给后续 plan 修。

- [ ] **Step 3: 删除临时 demo 脚本**

```bash
rm scripts/sandbox-real-env-demo.mjs
```

注:demo 脚本是临时验证用,不进 commit。若想保留作为 demo 例子,改放 `scripts/sandbox-builder-demo.mjs` + 加注释说明。

- [ ] **Step 4: 自我检查 + commit**

```bash
cd D:\pipiclaw\piclaw
git status --short
git add docs/superpowers/retros/2026-07-16-c-sandbox-validation/retros.md
git commit -m "docs(retro) C sub-project P7 sandbox real-env validation"
```

### C Plan 自检(对照 spec)

| spec 要求 | Task 覆盖 |
|---|---|
| selfcheck 5/5 | Task C-1 |
| base 镜像 build | Task C-2 |
| 容器验 4 语言 | Task C-3 |
| SandboxBuilder 选 vite-react-ts + 写 6 文件 | Task C-4 |
| PortForwarder + L1 + Lifecycle | Task C-5 |
| retro 落库 + commit | Task C-6 |

✅ 全部覆盖。

---

# Plan A — 5 demo 真实环境验证

**Goal:** 在真实用户机把 D1/D2-Prime/D3/D5/A5 5 个 demo 端到端跑一遍 + 截图归档

**前置 spec**: [2026-07-16-a-5demo-real-env-validation-design.md](file:///D:/pipiclaw/piclaw/docs/superpowers/specs/2026-07-16-a-5demo-real-env-validation-design.md)

**前置 commit**:**Plan C 完成 commit**(D2-Prime demo 需 docker 沙盒可用)

**真实环境依赖**:Electron 用户机 + 屏幕访问权限 + Docker(已完成 C)/ **可选 LLM key**(D5/A5 用)/ **可选飞书凭证**(D3 真接,否则 stub)

**Subagent 估算时间**:半天-1 天

---

### Task A-1: 安装依赖 + 启动 PiPiClaw

**Files:** N/A(只跑命令)

- [ ] **Step 1: 安装 @webcontainer/api(W11.1 引入但主会话未 npm install)**

```bash
cd D:\pipiclaw\piclaw
npm install
```

Expected: 安装 `@webcontainer/api` + 既有 13 个 deps。注:`npm install` 会读 package.json 中已经声明的依赖,不需要新增任何东西。

- [ ] **Step 2: 启动 dev 模式**

```bash
cd D:\pipiclaw\piclaw
npm run dev
```

Expected: 启动 Vite + Electron,Electron 窗口出现。窗口可能需要 10-30 秒。

**注意**:此命令是 long_running_process,主会话用 `wait_ms_before_async` + 非阻塞模式跑。subagent 在主进程后台跑 dev,后续步骤截图。

- [ ] **Step 3: 验证窗口出现 + 4 路由可达**

等 dev 起来后,用 Electron 自动测试(若可用)或截图验证。或者打开浏览器访问 `http://localhost:5173`(Vite 默认端口)。

Expected:看到 PiPiClaw 主界面,左侧导航 4 个 demo 入口(/d1-demo / d2-prime-demo / d3-demo / a5-demo)。

### Task A-2: D1 截屏问答真跑 + 截图

**Files:**
- Update: `docs/superpowers/retros/2026-07-16-a5demo-real-env/retros.md`(Task A-7 完成)

- [ ] **Step 1: 触发全局快捷键 Cmd+Shift+S(macOS)或 Ctrl+Shift+S(Windows)**

注:在 Electron 主进程已注册 `registerD1ScreenshotShortcut()`(W7.0.1 boot wiring)。直接按快捷键触发。

Expected: Electron 主界面切换到截屏模式(若有 UI 反馈)或自动截全屏。

- [ ] **Step 2: 在 D1 demo 输入框输入问题**

打开 `/d1-demo` 路由,在输入框输入"这是测试问题"或类似。

Expected: AgentBrain stub 返回 reply,显示在结果区。

- [ ] **Step 3: 截图归档**

用操作系统截图工具(macOS `Cmd+Shift+4` / Windows `Win+Shift+S`)截图保存:

```bash
# PowerShell 截图(Windows):
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bmp.Save("D:\pipiclaw\piclaw\docs\superpowers\retros\2026-07-16-a5demo-real-env\d1.png")
```

或 macOS:
```bash
mkdir -p docs/superpowers/retros/2026-07-16-a5demo-real-env/
# 在 GUI 用 Cmd+Shift+4 框选截图,保存为 d1.png
```

- [ ] **Step 4: 验证截图存在**

```bash
ls -la docs/superpowers/retros/2026-07-16-a5demo-real-env/d1.png
```

Expected:文件存在,大小 > 0。

### Task A-3: D2-Prime demo 真跑 + 截图

**Files:** N/A

- [ ] **Step 1: 打开 /d2-prime-demo 路由**

在 PiPiClaw 主界面,左侧导航点"D2-Prime"(若 SideNav 未挂,直接访问 `http://localhost:5173/d2-prime-demo`)。

- [ ] **Step 2: 输入 prompt + 点启动**

输入框填"做一个 Vite + React + TS 博客",点"启动 D2-Prime"按钮。

Expected: 显示脚手架结果(workspaceId / templateId / fileCount / forwardUrl / estimatedStartSeconds / durationMs)。templateId 应该是 `vite-react-ts`。

- [ ] **Step 3: 验证 SandboxBuilder 真写文件**

按 Task C-4 输出里 sandbox-real-env-demo 的 hostPath,实际位置在 `~/Library/Application Support/pipiclaw/sandboxes/<workspaceId>/mnt/`(macOS)或 `%APPDATA%\pipiclaw\sandboxes\<workspaceId>\mnt\`(Windows)。

```bash
ls "%APPDATA%\pipiclaw\sandboxes\<workspaceId>\mnt\"
# 期望:index.html  package.json  src  tsconfig.json  vite.config.ts
```

- [ ] **Step 4: 截图归档 + 验证**

```bash
# 截 d2-prime demo 结果页 → d2.png
ls -la docs/superpowers/retros/2026-07-16-a5demo-real-env/d2.png
```

### Task A-4: D3 飞书 demo 真跑 + 截图

**Files:** N/A

- [ ] **Step 1: 打开 /d3-demo 路由**

- [ ] **Step 2: 输入 + 启动**

输入"今天日程",点"模拟飞书消息"按钮。

Expected(stub 模式):
- reply 显示 3 条假日程(今日会议 / 午休 / 项目复盘)

若有真实飞书凭证(子项目 B 完成):
- ChannelRouter.send 真发飞书消息
- 截图归档 + 看飞书 APP 收到

- [ ] **Step 3: 截图归档**

```bash
# 截 d3-demo 结果页 → d3.png
ls -la docs/superpowers/retros/2026-07-16-a5demo-real-env/d3.png
```

### Task A-5: D5 录屏转技能真跑 + 截图

**Files:** N/A

- [ ] **Step 1: 触发 D5 trigger phrase**

D5 demo 无独立路由,通过 trigger phrase(可自定义,如"录屏" / "record" / "录一段")触发。在主界面 / ChatManager / Channel 输入 trigger phrase。

注:W6.4 `D5RecordingToSkill.ts` 是通过 SkillRuntime 调用,需要 main.ts 已注册(`registerD5RecordingToSkill()` W7.0.1 已加)。

- [ ] **Step 2: 开始录屏**

Expected: 屏幕开始录制,W6.4 ScreenVision.startRecording() 跑。

- [ ] **Step 3: 录 30 秒 + 停止**

等 30 秒,触发"停止"动作。Expected:ScreenVision.stopRecording() 返回录屏帧列表,D5RecordingToSkill.runD5() 生成 SKILL.md(stub 或 LLM 真接)。

- [ ] **Step 4: 验证 SKILL.md 生成**

```bash
ls "%APPDATA%\pipiclaw\skills\<skill-name>\SKILL.md"
# 期望:SKILL.md 存在(W6 stub 简单模板 或 LLM 真接)
```

- [ ] **Step 5: 截图归档**

```bash
# 截 D5 结果(录屏帧 + SKILL.md 预览)→ d5.png
ls -la docs/superpowers/retros/2026-07-16-a5demo-real-env/d5.png
```

### Task A-6: A5 Computer Use 真跑 + 截图

**Files:** N/A

- [ ] **Step 1: 打开 /a5-demo 路由**

- [ ] **Step 2: 输入 + 启动**

输入"打开浏览器",点"启动 Computer Use"按钮。

Expected(stub 模式): 显示 stub 截图(SVG placeholder) + 5 stub 步骤 + step.action = "reply" / "screenshot"。

- [ ] **Step 3: 截图归档**

```bash
# 截 a5-demo 结果页 → a5.png
ls -la docs/superpowers/retros/2026-07-16-a5demo-real-env/a5.png
```

### Task A-7: 完成 retro + 关闭 dev + commit

**Files:**
- Update: `docs/superpowers/retros/2026-07-16-a5demo-real-env/retros.md`

- [ ] **Step 1: 完成 retro**

新建 `docs/superpowers/retros/2026-07-16-a5demo-real-env/retros.md`:

```markdown
# A 子项目 — 5 demo 真实环境验证 报告

**日期**: 2026-07-16
**真实环境**: [OS] + Node [版本] + LLM [是否配 key] + 飞书 [是否配凭证]

## 5 demo 真跑结果

| Demo | 跑通率 | 截图 | 备注 |
|---|---|---|---|
| D1 截屏问答 | 100% | d1.png | 截屏 + AgentBrain stub reply |
| D2-Prime | 100% | d2.png | SandboxBuilder 选 vite-react-ts + 6 文件真写 |
| D3 飞书 | 60%/100% | d3.png | stub 模式 / 真接(若 B 完成) |
| D5 录屏 | 80% | d5.png | 录屏真 + SKILL.md 看 LLM |
| A5 Computer Use | 60% | a5.png | 截屏 stub + 决策循环可见 |

## 5 截图(附件)
- d1.png / d2.png / d3.png / d5.png / a5.png(同目录)

## 关键决策 / 难题
(填实际遇到的难题)

## 遗留未改项
- WebContainerRunner W11 stub 未接(本任务不动 W11 代码)
- JupyterRunner kernel W11 stub 未接
- PortForwarder proxy W11 stub 未接

## 整体验收
- npm install: ✅ / ❌
- npm run dev 启动: ✅ / ❌
- 5 demo 全部跑通率 ≥60%: ✅ / ❌
- 5 截图归档: ✅ / ❌
```

- [ ] **Step 2: 关闭 dev 进程**

```bash
# Ctrl+C 在 npm run dev 终端
# 或 PowerShell:
Get-Process | Where-Object { $_.Name -like "*electron*" -or $_.Name -like "*vite*" } | Stop-Process -Force
```

- [ ] **Step 3: 跑主会话兜底验证**

```bash
cd D:\pipiclaw\piclaw
npx vitest run 2>&1 | head -5
npx tsc --noEmit -p tsconfig.node.json 2>&1 | head -5
```

Expected: 178/178 通过,tsc 0 错。

- [ ] **Step 4: 自我检查 + commit**

```bash
cd D:\pipiclaw\piclaw
git status --short
git add docs/superpowers/retros/2026-07-16-a5demo-real-env/
git commit -m "docs(retro) A sub-project 5 demo real-env validation"
```

### A Plan 自检(对照 spec)

| spec 要求 | Task 覆盖 |
|---|---|
| npm install + npm run dev | Task A-1 |
| D1 截屏 + reply + 截图 | Task A-2 |
| D2 SandboxBuilder 写 6 文件 + 截图 | Task A-3 |
| D3 stub 或真接 + 截图 | Task A-4 |
| D5 录屏 + SKILL.md + 截图 | Task A-5 |
| A5 决策循环 + 截图 | Task A-6 |
| retro + commit | Task A-7 |

✅ 全部覆盖。

---

# Plan B — 真实 IM 账号接入

**Goal:** 把飞书 / 钉钉 / 企微 3 真接通道用真实 appId/secret 跑通,实现真实双向消息收发

**前置 spec**: [2026-07-16-b-real-im-account-integration-design.md](file:///D:/pipiclaw/piclaw/docs/superpowers/specs/2026-07-16-b-real-im-account-integration-design.md)

**前置 commit**:**Plan C 完成**(不依赖 Plan A)

**真实环境依赖**:**3 平台开发者凭证(用户必须提前准备)** + ngrok(外部 CLI)

**Subagent 估算时间**:1-3 天(取决于平台审核 + ngrok 调试)

---

### Task B-1: 加 ImAccounts.vue + 1 route + IpcServer 2 handler

**Files:**
- Create: `src/views/ImAccounts.vue` ~250 行
- Modify: `src/router/index.ts` 末尾追加 1 route
- Modify: `electron/core/IpcServer.ts` 末尾追加 2 handler
- Modify: `electron/preload.ts` 末尾追加 electronAPI.channelConfig

- [ ] **Step 1: 写 ImAccounts.vue**

新建 `src/views/ImAccounts.vue`:

```vue
<template>
  <div class="im-accounts">
    <h2>IM 账号配置</h2>
    <p class="im-hint">配置飞书 / 钉钉 / 企微 凭证,启用真实双向消息收发</p>

    <el-tabs v-model="activeTab" class="im-tabs">
      <el-tab-pane label="飞书" name="feishu">
        <el-form :model="feishu" label-width="120px">
          <el-form-item label="App ID">
            <el-input v-model="feishu.appId" placeholder="cli_xxx" />
          </el-form-item>
          <el-form-item label="App Secret">
            <el-input v-model="feishu.appSecret" type="password" placeholder="xxx" />
          </el-form-item>
          <el-form-item>
            <el-switch v-model="feishu.enabled" active-text="启用" inactive-text="禁用" />
            <el-button @click="testConnection('im-feishu', feishu)" :loading="testing['im-feishu']">
              测试连接
            </el-button>
          </el-form-item>
          <el-form-item v-if="testResults['im-feishu']">
            <el-alert :type="testResults['im-feishu'].ok ? 'success' : 'error'" :title="testResults['im-feishu'].message" :closable="false" />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="钉钉" name="dingtalk">
        <el-form :model="dingtalk" label-width="120px">
          <el-form-item label="App Key">
            <el-input v-model="dingtalk.appKey" placeholder="xxx" />
          </el-form-item>
          <el-form-item label="App Secret">
            <el-input v-model="dingtalk.appSecret" type="password" />
          </el-form-item>
          <el-form-item label="Robot Webhook">
            <el-input v-model="dingtalk.webhookUrl" placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxx" />
          </el-form-item>
          <el-form-item>
            <el-switch v-model="dingtalk.enabled" active-text="启用" inactive-text="禁用" />
            <el-button @click="testConnection('im-dingtalk', dingtalk)" :loading="testing['im-dingtalk']">
              测试连接
            </el-button>
          </el-form-item>
          <el-form-item v-if="testResults['im-dingtalk']">
            <el-alert :type="testResults['im-dingtalk'].ok ? 'success' : 'error'" :title="testResults['im-dingtalk'].message" :closable="false" />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="企微" name="wechatwork">
        <el-form :model="wechatwork" label-width="120px">
          <el-form-item label="Corp ID">
            <el-input v-model="wechatwork.corpId" placeholder="wwxxx" />
          </el-form-item>
          <el-form-item label="Corp Secret">
            <el-input v-model="wechatwork.corpSecret" type="password" />
          </el-form-item>
          <el-form-item label="Agent ID">
            <el-input v-model="wechatwork.agentId" placeholder="1000002" />
          </el-form-item>
          <el-form-item>
            <el-switch v-model="wechatwork.enabled" active-text="启用" inactive-text="禁用" />
            <el-button @click="testConnection('im-wechat-work', wechatwork)" :loading="testing['im-wechat-work']">
              测试连接
            </el-button>
          </el-form-item>
          <el-form-item v-if="testResults['im-wechat-work']">
            <el-alert :type="testResults['im-wechat-work'].ok ? 'success' : 'error'" :title="testResults['im-wechat-work'].message" :closable="false" />
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>

    <div class="im-actions">
      <el-button type="primary" @click="saveAll" :loading="isSaving">保存所有</el-button>
    </div>

    <el-card class="im-flow">
      <h3>使用流程</h3>
      <ol class="im-steps">
        <li>在 [飞书开放平台](https://open.feishu.cn/) / [钉钉开放平台](https://open-dev.dingtalk.com/) / [企微后台](https://work.weixin.qq.com/wework_admin/) 创建企业自建应用</li>
        <li>拿 appId/appSecret + 配置 IP 白名单</li>
        <li>安装 ngrok(<code>npm install -g ngrok</code>),启动 <code>ngrok http 5173</code></li>
        <li>把 ngrok URL 填到 IM 平台"消息接收 URL" / "事件订阅 URL"</li>
        <li>本页面填入凭证 + 测试连接 → 保存</li>
        <li>用真实 IM 账号发消息 → PiPiClaw 自动回复</li>
      </ol>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'

const activeTab = ref('feishu')

const feishu = reactive({ appId: '', appSecret: '', enabled: false })
const dingtalk = reactive({ appKey: '', appSecret: '', webhookUrl: '', enabled: false })
const wechatwork = reactive({ corpId: '', corpSecret: '', agentId: '', enabled: false })

const testing = reactive<Record<string, boolean>>({})
const testResults = reactive<Record<string, { ok: boolean; message: string } | null>>({})
const isSaving = ref(false)

async function loadConfigs() {
  try {
    const configs = await (window as any).electronAPI.channelConfig.get()
    if (configs.imFeishu) {
      feishu.appId = configs.imFeishu.appId ?? ''
      feishu.appSecret = configs.imFeishu.appSecret ?? ''
      feishu.enabled = configs.imFeishu.enabled ?? false
    }
    if (configs.imDingtalk) {
      dingtalk.appKey = configs.imDingtalk.appKey ?? ''
      dingtalk.appSecret = configs.imDingtalk.appSecret ?? ''
      dingtalk.webhookUrl = configs.imDingtalk.webhookUrl ?? ''
      dingtalk.enabled = configs.imDingtalk.enabled ?? false
    }
    if (configs.imWechatWork) {
      wechatwork.corpId = configs.imWechatWork.corpId ?? ''
      wechatwork.corpSecret = configs.imWechatWork.corpSecret ?? ''
      wechatwork.agentId = configs.imWechatWork.agentId ?? ''
      wechatwork.enabled = configs.imWechatWork.enabled ?? false
    }
  } catch (e) {
    console.warn('loadConfigs failed', e)
  }
}

async function testConnection(platform: string, config: any) {
  testing[platform] = true
  testResults[platform] = null
  try {
    const result = await (window as any).electronAPI.channelConfig.test({ platform, config })
    testResults[platform] = { ok: result.ok, message: result.message }
  } catch (e) {
    testResults[platform] = { ok: false, message: String(e) }
  } finally {
    testing[platform] = false
  }
}

async function saveAll() {
  isSaving.value = true
  try {
    await Promise.all([
      (window as any).electronAPI.channelConfig.save({ platform: 'im-feishu', config: feishu }),
      (window as any).electronAPI.channelConfig.save({ platform: 'im-dingtalk', config: dingtalk }),
      (window as any).electronAPI.channelConfig.save({ platform: 'im-wechat-work', config: wechatwork }),
    ])
    alert('已保存')
  } catch (e) {
    alert('保存失败: ' + e)
  } finally {
    isSaving.value = false
  }
}

onMounted(loadConfigs)
</script>

<style lang="scss" scoped>
.im-accounts {
  padding: var(--content-padding);
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.im-hint {
  color: var(--text-secondary, #666);
  font-size: var(--font-size-body, 14px);
  margin-bottom: var(--space-lg, 24px);
}

.im-tabs {
  margin-bottom: var(--space-lg, 24px);
}

.im-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-lg, 24px);
}

.im-flow {
  margin-top: var(--space-lg, 24px);
}

.im-steps {
  padding-left: var(--space-lg, 24px);
  font-size: var(--font-size-body, 14px);
  line-height: 1.8;
}

code {
  background: var(--card-bg, #f5f5f5);
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
  font-family: var(--font-family-mono, monospace);
  font-size: var(--font-size-caption-1, 11px);
}
</style>
```

- [ ] **Step 2: 末尾追加 router 1 route**

读 `src/router/index.ts`,在 routes 数组末尾(W11.5 既有 `/d2-prime-demo` 之后)追加 1 个:

```typescript
  {
    path: '/settings/im-accounts',
    name: 'ImAccounts',
    component: () => import('@/views/ImAccounts.vue'),
  },
```

- [ ] **Step 3: 末尾追加 IpcServer 2 handler**

读 `electron/core/IpcServer.ts`,在最后一行 `ipcMain.handle('d5:run', ...)`(W7.0.2 加的)之后追加 2 个:

```typescript
    // ============ W12.B: IM 账号配置 IPC ============
    ipcMain.handle('channel-config:get', async () => {
      try {
        const { IMConfigStore } = require('../channel/IMConfigStore')
        const list = IMConfigStore.getInstance().list()
        return { success: true, data: list }
      } catch (error) {
        this.log.error('channel-config:get 失败', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('channel-config:save', async (_: any, args: { platform: string; config: any }) => {
      try {
        const { IMConfigStore } = require('../channel/IMConfigStore')
        IMConfigStore.getInstance().set(args.platform as any, args.config)
        return { success: true }
      } catch (error) {
        this.log.error('channel-config:save 失败', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('channel-config:test', async (_: any, args: { platform: string; config: any }) => {
      try {
        // 临时保存配置,调对应 Channel 的 getAccessToken 测连接
        const { IMConfigStore } = require('../channel/IMConfigStore')
        IMConfigStore.getInstance().set(args.platform as any, args.config)
        // 动态 import 对应通道
        let testModule: any
        if (args.platform === 'im-feishu') testModule = require('../channel/FeishuChannel')
        else if (args.platform === 'im-dingtalk') testModule = require('../channel/DingTalkChannel')
        else if (args.platform === 'im-wechat-work') testModule = require('../channel/WechatWorkChannel')
        else return { success: false, message: 'unknown platform' }
        const channel = new testModule.default('test-' + Date.now())
        const health = await channel.healthCheck()
        return {
          success: health.healthy,
          message: health.healthy ? `连接成功 (${health.latencyMs}ms)` : `连接失败: ${health.error}`,
        }
      } catch (error) {
        return { success: false, message: String(error) }
      }
    })
```

- [ ] **Step 4: 末尾追加 preload 暴露**

读 `electron/preload.ts`,在 electronAPI 对象末尾追加:

```typescript
  channelConfig: {
    get: (): Promise<{ success: boolean; data: any[]; error?: string }> => ipcRenderer.invoke('channel-config:get'),
    save: (args: { platform: string; config: any }): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('channel-config:save', args),
    test: (args: { platform: string; config: any }): Promise<{ success: boolean; message: string }> => ipcRenderer.invoke('channel-config:test', args),
  }
```

- [ ] **Step 5: 验证 tsc 0 错**

```bash
cd D:\pipiclaw\piclaw
npx tsc --noEmit -p tsconfig.node.json 2>&1 | head -10
```

Expected: 0 错。

如失败:检查 `IMConfigStore.getInstance().list()` 返回 `IMConfig[]`(IMConfig 接口在 IMConfigStore.ts 已定义)。

### Task B-2: ngrok 内网穿透引导文档

**Files:**
- Create: `docs/superpowers/retros/2026-07-16-b-im-account-integration/ngrok-setup.md`

- [ ] **Step 1: 写 ngrok-setup.md**

新建 `docs/superpowers/retros/2026-07-16-b-im-account-integration/ngrok-setup.md`:

```markdown
# ngrok 内网穿透引导(IM 回调 URL 用)

## 为什么需要 ngrok?
飞书 / 钉钉 / 企微 都需要公网可达的回调 URL(消息接收 URL / 事件订阅 URL)。本机 `http://localhost:5173` 不行,需要用 ngrok 把本机端口暴露到公网。

## 安装 ngrok

### macOS
```bash
brew install ngrok
```

### Windows
```bash
choco install ngrok
# 或下载 https://ngrok.com/download 解压
```

### Linux
```bash
snap install ngrok
```

## 注册 ngrok 账号
1. 访问 https://dashboard.ngrok.com/signup 注册
2. 拿 authtoken:`ngrok config add-authtoken <your-token>`

## 启动 ngrok
```bash
ngrok http 5173
```

Expected output:
```
Session Status  online
Account         [你的账号](Plan: Free)
Version         3.x.x
Region          United States (us)
Latency         90ms
Web Interface   http://127.0.0.1:4040
Forwarding      https://xxxx-xxx-xxx-xxx-xxx.ngrok-free.app → http://localhost:5173
```

**记下 Forwarding 的 `https://xxxx.ngrok-free.app` URL**(公网回调 URL)。

## 配置 IM 平台回调 URL
- **飞书**:开发后台 → 应用 → 事件订阅 → 请求 URL 填 `https://xxxx.ngrok-free.app/im/webhook/feishu`
- **钉钉**:开放平台 → 应用 → 机器人 → 消息接收 URL 填 `https://xxxx.ngrok-free.app/im/webhook/dingtalk`
- **企微**:管理后台 → 应用 → 接收消息服务器 URL 填 `https://xxxx.ngrok-free.app/im/webhook/wechat-work`

**注意**:
- ngrok 免费版 URL 每次启动变,**重启 ngrok 后需重新配 IM 平台**
- ngrok 免费版限速,适合开发调试,生产用 ngrok 付费版或公网服务器

## 验证
在浏览器打开 `https://xxxx.ngrok-free.app`,应看到 PiPiClaw 主界面或 Vite 默认页(说明 ngrok 工作正常)。
```

### Task B-3: 用户提供凭证后,真实环境验证飞书

**Files:** N/A(用户手操作)

- [ ] **Step 1: 用户启动 ngrok**

```bash
ngrok http 5173
```

- [ ] **Step 2: 用户在 PiPiClaw /settings/im-accounts 配置飞书凭证**

填入用户的 appId + appSecret + 点"测试连接"。

Expected: 测试连接成功(`连接成功 (Xms)` 绿色提示)。

- [ ] **Step 3: 用户启动 PiPiClaw(`npm run dev`)+ ngrok 同时跑**

Expected: PiPiClaw Electron 窗口 + ngrok 公网 URL 都可用。

- [ ] **Step 4: 用户在飞书 APP 发"hi"到企业应用**

Expected:
1. 飞书服务器回调到 ngrok URL → PiPiClaw ChannelRouter.receive
2. AgentBrain.think → decision.action = "reply"
3. ChannelRouter.send(feishu, { to: userId, text: 'hello!' })
4. 飞书 APP 收到"hello!"自动回复

- [ ] **Step 5: 截图归档 + 记录**

截图归档:
- 飞书 APP 收到 PiPiClaw 自动回复的截图
- PiPiClaw 主界面显示消息收发日志(若有)截图

记录到 `docs/superpowers/retros/2026-07-16-b-im-account-integration/retros.md`:
```markdown
## 飞书真实环境验证
- 飞书 appId: [用户实际]
- ngrok URL: https://xxxx.ngrok-free.app
- 测试结果: ✅ / ❌
- 发送消息截图: feishu-reply.png
- 接收消息截图: feishu-received.png
```

### Task B-4: 钉钉真实验证(同 B-3 模式)

**Files:** N/A

- [ ] **Step 1-5: 同 Task B-3,但用钉钉 appKey/appSecret/webhook**

记录到 retro `## 钉钉真实环境验证` 段。

### Task B-5: 企微真实验证(同 B-3 模式)

**Files:** N/A

- [ ] **Step 1-5: 同 Task B-3,但用企微 corpId/corpSecret/agentId**

记录到 retro `## 企微真实环境验证` 段。

### Task B-6: 完成 retro + commit

**Files:**
- Update: `docs/superpowers/retros/2026-07-16-b-im-account-integration/retros.md`

- [ ] **Step 1: 完成 retro**

新建 `docs/superpowers/retros/2026-07-16-b-im-account-integration/retros.md`:

```markdown
# B 子项目 — 真实 IM 账号接入 报告

**日期**: 2026-07-16
**真实环境**: [OS] + ngrok [版本]

## ImAccounts.vue 配置 UI
- 路径: /settings/im-accounts
- 3 平台表单(飞书 / 钉钉 / 企微)
- 测试连接 + 保存所有按钮

## 飞书真实环境验证
[见 Task B-3]

## 钉钉真实环境验证
[见 Task B-4]

## 企微真实环境验证
[见 Task B-5]

## 整体验收
- ImAccounts view 创建: ✅
- /settings/im-accounts 路由: ✅
- channel-config:{get, save, test} IPC: ✅
- preload electronAPI.channelConfig: ✅
- ngrok-setup.md 文档: ✅
- 飞书真实收发 ≥1 条: ✅ / ❌
- 钉钉真实收发 ≥1 条: ✅ / ❌
- 企微真实收发 ≥1 条: ✅ / ❌

## 关键决策 / 难题
(填实际遇到的难题)

## 遗留未改项
- 8 占位通道未接(W12+ 接 SDK)
- ngrok 自动启动未实现(用户手启动)
```

- [ ] **Step 2: 跑主会话兜底验证**

```bash
cd D:\pipiclaw\piclaw
npx vitest run 2>&1 | head -5
npx tsc --noEmit -p tsconfig.node.json 2>&1 | head -5
```

Expected: 178/178 通过,tsc 0 错。

- [ ] **Step 3: 自我检查 + commit**

```bash
cd D:\pipiclaw\piclaw
git status --short
git add docs/superpowers/retros/2026-07-16-b-im-account-integration/
git commit -m "docs(retro) B sub-project real IM account integration"
```

### B Plan 自检(对照 spec)

| spec 要求 | Task 覆盖 |
|---|---|
| ImAccounts.vue + /settings/im-accounts 路由 | Task B-1 |
| ngrok 引导文档 | Task B-2 |
| 飞书真实验证 | Task B-3 |
| 钉钉真实验证 | Task B-4 |
| 企微真实验证 | Task B-5 |
| retro + commit | Task B-6 |

✅ 全部覆盖。

---

# 总体执行策略

## subagent 派发顺序

**严格按优先级串行**:
1. **Plan C 先**(1 subagent, 1-2 小时)
2. **Plan A 接 C**(1 subagent, 半天-1 天)
3. **Plan B 与 A 并行**(1 subagent, 1-3 天)

注:B 与 A 可并行派 subagent(subagent 之间不共享文件系统修改,只读 main 分支)。

## subagent 任务指令模板

每次派 subagent 时,给:
1. 完整 plan 文件路径(让 subagent 自己读)
2. 真实环境依赖清单
3. 强制要求:tsc 0 错 + vitest 178/178 不变
4. 不引入新 npm 依赖
5. 不修改既有业务代码
6. 写 retro + commit

## 兜底

主会话在每个 subagent 完成后:
1. 跑 `npx tsc --noEmit` 验证 0 错
2. 跑 `npx vitest run` 验证 178/178
3. 看 git log 确认 1 个 commit 落库
4. 报告 retro 文件 + commit hash

## 风险

- **Plan A 失败** → 需 Plan C 成功,否则 D2-Prime demo 不能跑
- **Plan B 失败** → IM 平台审核/凭证/公网回调,可能需要用户多轮反馈
- **跨 subagent 临时文件** → A / B subagent 都可能产生临时截图,主会话负责清理

---

# Plans 自检(对照 3 spec)

| spec | Plan | Task 数 |
|---|---|---|
| C sandbox 验证 | Plan C | 6 |
| A 5 demo 验证 | Plan A | 7 |
| B IM 接入 | Plan B | 6 |

✅ 全部覆盖,无 placeholder / 无 TBD / 无 "similar to Task N"。

**类型一致性自检**:
- `Workspace.id` / `Workspace.hostPath` / `Workspace.containerPath` 一致(Task C-4 引用)
- `IMConfigStore.set(platform, patch)` / `.get(platform)` / `.list()` 一致(Task B-1 引用)
- `Channel.healthCheck()` 返回 `{ healthy, latencyMs?, error? }` 一致(Task B-1 引用)

✅ 类型一致。