# C 子项目 — P7 沙盒真实环境链路验证 Design Spec

> **生成日期**:2026-07-16
> **作者**:brainstorming skill(主会话)
> **前置 commit**:`dc68e93` 验证指南
> **定位**:v2.0.0 GA 后第一阶段实战验证,P0 子项目
> **目标**:在真实 docker + 用户机环境把 W9-W11 sandbox 链路跑通

---

## 1. 一句话

把 `electron/sandbox/` 下的 W9-W11 sandbox 全链路组件(dockerDetector / SandboxL1 / workspace / SandboxBuilder / networkPolicy / resourceLimits / base image / WebContainerRunner / PortForwarder / JupyterRunner / Lifecycle)在真实环境跑通,**5 个端到端验证**(selfcheck / build / template / L1 / lifecycle)。

---

## 2. 背景与现状

### 2.1 已有但未真跑
- ✅ `dockerDetector.ts` 真实可用(走 child_process execSync)
- ✅ `SandboxBuilder` + 4 templates 真能写文件
- ✅ `workspace.ts` 真能建 workspace
- ✅ `networkPolicy.ts` 真持久化
- ✅ `resourceLimits.ts` 真持久化
- ⚠️ `SandboxL1` macOS 真可用 / Linux 探测后降级 stub / Windows JobObject W9 stub
- ⚠️ `WebContainerRunner` W11 stub(需 BrowserWindow 加载)
- ⚠️ `PortForwarder` 端口分配真,proxy stub
- ⚠️ `JupyterRunner` 探测真,kernel stub
- ⚠️ `base image` Dockerfile 写好,未真 build
- ⚠️ `selfcheck.mjs` 写好,未真跑

### 2.2 关键依赖清单
- Docker 24+(daemon 跑,用户 `docker info` 可用)
- macOS sandbox-exec(系统自带)/ Linux bubblewrap(`apt install bubblewrap`)/ Windows JobObject(W9 stub)
- 磁盘 ≥10GB(base 镜像 + workspace)
- 网络:`registry.npmmirror.com` / `pypi.tuna.tsinghua.edu.cn` / `goproxy.cn` / `maven.aliyun.com`
- 时间 ≥2 小时(build 镜像首次 15-30 分钟)

---

## 3. 设计方案(3 选项 + 推荐)

### 方案 1: **全链路闭环验证**(推荐)
**5 步端到端**:
1. **Step 1 selfcheck**:`node scripts/sandbox-selfcheck.mjs` → 5/5 过
2. **Step 2 build base 镜像**:`node scripts/sandbox-base-build.mjs --run` → `pipiclaw/sandbox-base:latest` 真存在
3. **Step 3 container 进 shell**:`docker run -it --rm pipiclaw/sandbox-base:latest bash` → 验证 ubuntu 24.04 + node 22 + python 3.12 + java 21 + go 1.23
4. **Step 4 SandboxBuilder 选 vite-react-ts**:`npm install` + 写 6 文件 → 验证 workspace.hostPath 有 `package.json` / `vite.config.ts` / `src/App.tsx` 等
5. **Step 5 SandboxL1 + PortForwarder 验证**:在 macOS `SandboxL1.run(['echo', 'hello'], { mode: 'seatbelt' })` → 看返回;`PortForwarder.forwardPort(5173)` → 拿到 host port 4000
6. **Step 6 (可选)Lifecycle 调度**:`SandboxLifecycle.start()` → 等 1 分钟 → 触发一次 check

**验收**:
- 6 步全过 → sandbox 链路 80% 可用(W11 WebContainer / Proxy / Jupyter stub 部分 W12+ 接)
- 截图:`docker images` 输出 + SandboxBuilder 写文件清单

**风险**:
- Docker Desktop 默认资源 4GB/2CPU,够用但 build 时可能 OOM → 加 `--memory=8g --cpus=4`
- macOS sandbox-exec profile 误写会导致命令无输出 → 用简单 `[deny default] [allow system-socket]` 起步
- build 镜像首次慢,需稳定网络

### 方案 2: **最小验证(只脚本 + 镜像)**
**2 步**:
1. selfcheck 5/5 过
2. base 镜像 build + container 进 shell 验证 4 语言

**验收**:2 步全过 → 基础设施 OK,业务链路(SandboxBuilder / L1 / PortForwarder / Lifecycle)未验证

**风险**:只验证了脚本和镜像,业务组件(20 个 .ts)未真跑,后续 demo 跑可能再发现 bug

### 方案 3: **进阶跨平台验证**
方案 1 + macOS sandbox-exec + Linux bwrap + Windows JobObject 3 平台隔离

**风险**:需 3 平台环境,Windows JobObject W9 stub 部分需要 win32job 库(W9 没加,新引入依赖违反约束)

---

### **推荐:方案 1**(全链路闭环)
- 覆盖 80% sandbox 链路
- 1-2 小时可跑通
- 风险可控(Docker Desktop + macOS 已有环境)

---

## 4. 架构与组件

### 4.1 不引入新 npm 依赖
- dockerDetector 走 `child_process.execSync` 原生
- SandboxL1 走 `execFileSync` 原生
- 4 templates 走 `fs.writeFileSync` 原生
- selfcheck 走 `execSync` 原生

### 4.2 不修改既有 sandbox 业务代码
- W9-W11 22 个文件 0 改动
- subagent 只跑验证 + 截图 + 报告

### 4.3 新增文件
- `docs/superpowers/retros/2026-07-16-c-sandbox-validation-retro.md` — 验证后的回溯报告
- `tests/integration/sandbox-real-env.test.ts`(可选) — 把 selfcheck 5/5 集成到 vitest 跑(需要 mock child_process)
- `scripts/sandbox-real-env-demo.mjs`(可选) — 写一个完整 demo 脚本走 SandboxBuilder + PortForwarder + L1 + Lifecycle

**推荐**:只写 retro(必选),test/demo 脚本可选

---

## 5. 数据流与错误处理

### 5.1 数据流(方案 1)
```
用户跑 `node scripts/sandbox-real-env-demo.mjs`
   │
   ├─→ selfcheck(5 检查)
   │    ├─ docker --version OK?
   │    ├─ docker info OK?
   │    ├─ base image exists?
   │    ├─ docker run hello-world OK?
   │    └─ L1 self-test(skip)
   │
   ├─→ build base 镜像(若不存在)
   │    └─ docker build → pipiclaw/sandbox-base:latest
   │
   ├─→ SandboxBuilder.build({ prompt: '做一个博客' })
   │    ├─ selectTemplate(regex 匹配 → vite-react-ts)
   │    ├─ createWorkspace(WorkspaceManager)
   │    └─ 写 6 文件(hostPath/package.json 等)
   │
   ├─→ PortForwarder.forwardPort(5173)
   │    └─ 分配 hostPort = 4000,entry.url = http://localhost:4000
   │
   ├─→ SandboxL1.run(['echo', 'hello'], { mode: 'seatbelt' })
   │    └─ macOS: sandbox-exec → 输出 "hello"
   │
   └─→ SandboxLifecycle.start() + listStates()
        └─ touch(workspaceId) → state.status = 'running'
```

### 5.2 错误处理
- selfcheck 任何 1 项 FAIL → 立即报错退出(exit code 1)
- build 镜像失败 → 输出 docker build stderr 头 500 字符,继续跑后续步骤(sandbox 可继续用 stub)
- SandboxBuilder.build 失败(workspace 创建失败 / 写文件失败) → 返回 `{ ok: false, error }`,demo 脚本捕获
- PortForwarder 端口耗尽 → 返回 `{ ok: false, error: 'no free host port' }`
- SandboxL1 mode 不支持当前平台 → 返回 `fallback: true`,demo 脚本记录 stub 标记
- Lifecycle touch 失败 → log.warn,不阻断

---

## 6. 测试策略

### 6.1 单元测试(已有)
- `tests/unit/DockerDetector.test.ts` W12.1(7 测试,主会话兜底已修)
- `tests/unit/SandboxBuilder.test.ts` W12.1(7 测试)
- `tests/unit/Workspace.test.ts` W12.1(8 测试)
- `tests/unit/ResourceLimits.test.ts` W12.1(8 测试)
- `tests/unit/NetworkPolicy.test.ts` W12.1(10 测试)
- `tests/unit/WebContainerRunner.test.ts` W12.1(7 测试)
- `tests/unit/PortForwarder.test.ts` W12.1(7 测试)
- `tests/integration/sandbox-real-env.test.ts`(可选新增) — 集成测试

**当前 178/178 通过**(W12 已修好)

### 6.2 真实环境验证(本任务核心)
- `node scripts/sandbox-selfcheck.mjs` → 5 检查
- `node scripts/sandbox-base-build.mjs --run` → build 镜像
- `node scripts/sandbox-real-env-demo.mjs`(本任务新增)→ 跑完整链路
- 手动验证:`docker run -it pipiclaw/sandbox-base:latest bash` 进容器看 4 语言

### 6.3 验收标准
- selfcheck **5/5 过**(L1 skip 计 0 分,其他 4 项必须过)
- base 镜像 **build 成功**(`docker images | grep pipiclaw/sandbox-base`)
- SandboxBuilder 写 **6 文件**(vite-react-ts)到 workspace.hostPath
- PortForwarder 分配到 hostPort(4000+),返回 entry.url
- macOS SandboxL1 输出 "hello" / 其他平台 fallback true
- SandboxLifecycle.touch(workspaceId)后 listStates 长度 +1

---

## 7. 实施策略

### 7.1 Subagent 派发模式
**1 个 general_purpose_task subagent** 在有 docker 的 macOS/Linux 用户机跑:
- **Step 1**:跑 selfcheck,记录 5/5 结果到 retro
- **Step 2**:`npm install`(主会话在用户机已装过)→ `npm install` 补 `@webcontainer/api`
- **Step 3**:`node scripts/sandbox-base-build.mjs --run` → build 镜像(15-30 分钟,subagent timeout 给 45 分钟)
- **Step 4**:`docker run -it --rm pipiclaw/sandbox-base:latest bash -c 'node --version && python3 --version && java -version && go version'` → 验证 4 语言
- **Step 5**:写 + 跑 `scripts/sandbox-real-env-demo.mjs` → SandboxBuilder + PortForwarder + L1 + Lifecycle
- **Step 6**:写 retro `docs/superpowers/retros/2026-07-16-c-sandbox-validation-retro.md`
- **Step 7**:commit retro + demo 脚本

**subagent 估算时间**:1-2 小时(selfcheck + build + demo)

### 7.2 不做的事
- ❌ 不接 WebContainerRunner(本任务只验证,WebContainer W11 stub,W12+ 接)
- ❌ 不接 JupyterRunner kernel(只 `isAvailable` 探测)
- ❌ 不接 PortForwarder proxy(W11 proxy stub,W12+ 接)
- ❌ 不动 SandboxL1 Windows 平台(W9 stub,W12+ 接)
- ❌ 不新增 npm 依赖

---

## 8. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Docker Desktop OOM build | 中 | build 失败 | `--memory=8g --cpus=4` flag |
| macOS sandbox-exec profile 误写 | 低 | 命令无输出 | 用简单 `[deny default] [allow system-socket]` 起步 |
| base 镜像 build 超时(15-30 分钟)| 中 | subagent timeout | subagent timeout 给 60 分钟 |
| 网络不稳定导致镜像 build 失败 | 中 | build 失败 | subagent 跑 2 次 build,失败重试 |
| SandboxL1 Windows 平台 stub | 中(若 Windows)| 不隔离 | W9 plan 已明确 stub,W12+ 接 |
| Workspace hostPath 跨平台路径问题 | 低 | 文件路径错误 | 用 `path.join` + `path.posix.join` |

---

## 9. 验收清单

- [ ] `node scripts/sandbox-selfcheck.mjs` 退出码 0(L1 skip 计 not-ok)
- [ ] `node scripts/sandbox-base-build.mjs --run` 成功,`docker images` 列出 `pipiclaw/sandbox-base:latest`
- [ ] `docker run -it --rm pipiclaw/sandbox-base:latest bash -c "..."` 输出 node 22 + python 3.12 + java 21 + go 1.23
- [ ] `node scripts/sandbox-real-env-demo.mjs` 输出 SandboxBuilder 写 6 文件清单 + PortForwarder hostPort + SandboxL1 输出 + Lifecycle state 长度
- [ ] retro 文档落库,含 6 步真实环境截图/输出
- [ ] 不新增 npm 依赖
- [ ] 不修改 W9-W11 既有 22 个 sandbox 文件
- [ ] vitest 仍 178/178 通过

---

## 10. 不在范围内

- WebContainerRunner 真接(W12+ 接)
- JupyterRunner kernel 真跑(W12+ 接)
- PortForwarder proxy 真转发(W12+ 接)
- SandboxL1 Windows JobObject 真接(W12+ 接)
- 5 个 demo 的真接 LLM(W11+ 接)
- 真实 IM 账号接入(子项目 B)
- 5 demo 真跑截图(子项目 A)

---

**Spec 状态**:已写入并落库(本文件 `dc68e93` commit 的延续)

**下一步**:
1. 用户审查本 spec → 批准/修改
2. 批准后调用 writing-plans skill 出实施 plan
3. plan 派 subagent 真实环境跑