# A 子项目 — 5 demo 真实环境验证 Design Spec

> **生成日期**:2026-07-16
> **作者**:brainstorming skill(主会话)
> **前置 commit**:C spec 落库
> **定位**:v2.0.0 GA 后第二阶段实战验证,P1 子项目
> **前置依赖**:**子项目 C 完成**(Docker 沙盒可用,D2-Prime 才可真跑)

---

## 1. 一句话

在真实用户机把 v2.0.0 的 **5 个 demo**(D1 截屏问答 / D2-Prime 项目脚手架 / D3 一句话远程 / D5 录屏转技能 / A5 Computer Use)**端到端跑一遍**,截图归档,跑通率 ≥60%(D2/D3 需子项目 C + B 完成)。

---

## 2. 背景与现状

### 2.1 5 demo 当前实装度

| Demo | 真跑 stub 程度 | 跑通依赖 |
|---|---|---|
| **D1 截屏问答** W5.3 | 截屏真,QA 走 AgentBrain stub(简单 reply) | Electron 屏幕权限 |
| **D2-Prime** W11.5 | SandboxBuilder 真选模板 + 写文件,WebContainer/PortForwarder stub | **需 C 完成**(docker) |
| **D3 飞书** W7.4 | CalendarConnector 假日程,ChannelRouter stub | **需 B 完成**(飞书账号) |
| **D5 录屏转技能** W6.4 | 截屏帧真,SKILL.md 生成走 OpenAI stub | 需 OpenAI API key 或本地 LLM |
| **A5 Computer Use** W8.2 | 截屏 stub,AgentBrain 决策 stub,ActionExecutor 沙箱 | 需 AgentBrain LLM(简单决策)|

### 2.2 关键依赖清单
- **必选**:macOS / Windows / Linux 用户机(任选 1)
- **必选**:Electron 屏幕访问权限(首次需用户授权)
- **D2 需 C 完成**:Docker daemon 跑 + base 镜像已 build
- **D3 需 B 完成**:飞书 appId/secret + 公网回调 URL
- **D5 需 LLM key**:OpenAI / Anthropic / 国内大模型 任选 1
- **A5 可选 LLM key**:有 key 决策更真实,无 key AgentBrain stub 也跑通

### 2.3 已有路由 + view(主会话 W7.0.2 + W7.4 + W8.2 + W11.5 已建)
- `/d1-demo` → D1ScreenshotDemo.vue
- `/d2-prime-demo` → D2PrimeDemo.vue
- `/d3-demo` → D3RemoteDemo.vue
- `/a5-demo` → A5ComputerUseDemo.vue
- **D5 demo 无独立路由** —— `D5RecordingToSkill` 是通过 trigger phrase 触发,**不在视图路由表**

---

## 3. 设计方案(3 选项 + 推荐)

### 方案 1: **5 demo 全跑 + 截图归档**(推荐)
**步骤**:
1. **Step 1 启动 PiPiClaw**:`npm run dev` → Electron 起来 → 5 demo 路由可访问
2. **Step 2 D1 截屏问答**:
   - 全局快捷键 `Cmd+Shift+S`(macOS)/`Ctrl+Shift+S`(Windows)
   - 截屏 + 提问 → AgentBrain stub 返回 reply
   - 截图归档(`docs/superpowers/retros/2026-07-16-a5demo-real-env/d1.png`)
3. **Step 3 D2-Prime**:打开 `/d2-prime-demo` → 输入"做博客" → SandboxBuilder 选 vite-react-ts → 写 6 文件 → 截图归档
4. **Step 4 D3 飞书**:**需 B 完成**,否则 stub 模式跑(CalendarConnector 假日程)
5. **Step 5 D5 录屏**:从主界面 trigger phrase 触发 → 录 30 秒 → 停止 → 看 SKILL.md 生成(若 LLM 没配,看 stub)
6. **Step 6 A5 Computer Use**:打开 `/a5-demo` → 输入"打开浏览器" → 看决策循环 + 截图
7. **Step 7 retro**:写 `docs/superpowers/retros/2026-07-16-a5demo-real-env-retro.md`(含 5 demo 截图 + 真跑记录)

**验收**:
- D1 100% 跑通(截屏 + reply)
- D2 100% 跑通(SandboxBuilder 选模板 + 写文件,**C 必须完成**)
- D3 60% 跑通(CalendarConnector stub;若 B 完成 → 100%)
- D5 80% 跑通(录屏帧真,SKILL.md 生成看 LLM 配置)
- A5 60% 跑通(截屏 stub,AgentBrain stub 决策)

**风险**:
- D2 失败 → C 没完成 → 子项目 C 必须先做
- D3 失败 → B 没完成 → stub 模式也能跑
- D5 失败 → LLM key 缺失 → stub 模式也能跑

### 方案 2: **只跑 D1 + D2 + A5(无外部依赖 3 个)**
**步骤**:D1 + D2(C 完成) + A5,跳过 D3(需 B) + D5(需 LLM)

**验收**:3/5 demo 跑通
**风险**:D3 + D5 未验证,B + LLM 接入后还需再补跑

### 方案 3: **完整记录(截图 + 日志 + 视频)**
方案 1 + 用 Playwright 录视频 + 上传日志

**风险**:录视频成本高,W12.2 playwright e2e 默认 skip

---

### **推荐:方案 1**(5 demo 全跑,stub 接受)
- D1 + D2 必跑通
- D3 / D5 / A5 允许 stub
- 截图归档 + retro 文档齐全
- 半天到 1 天

---

## 4. 架构与组件

### 4.1 不引入新 npm 依赖
- 5 demo 既有 builtin 已就位
- 截图工具用 Electron `BrowserWindow.capturePage()` 内置(若不可用,fallback 截图)
- retro 文档用 markdown

### 4.2 不修改既有 demo builtin 代码
- D1/D2/D3/D5/A5 既有 5 个 .ts 文件 0 改动
- subagent 只跑 + 截图 + 报告

### 4.3 新增文件
- `docs/superpowers/retros/2026-07-16-a5demo-real-env-retro.md` — 5 demo 真跑报告
- `scripts/5demo-real-env-runner.mjs`(可选) — 自动跑 5 demo + 截图

**推荐**:只写 retro(必选),runner 脚本可选

---

## 5. 数据流与错误处理

### 5.1 D1 截屏问答数据流
```
用户按 Cmd+Shift+S
   │
   ├─→ registerD1ScreenshotShortcut 触发
   ├─→ ScreenVision.captureFrame()
   ├─→ AgentBrain.think({ content: '...截图内容' }) → decision
   └─→ AgentBrain.call({ name: 'reply', args: { text: '...分析' } }) → 返回
```

### 5.2 D2-Prime 数据流
```
用户在 /d2-prime-demo 输入"做博客"
   │
   ├─→ D2PrimeScaffold.runD2Prime({ prompt })
   ├─→ SandboxBuilder.build({ prompt }) → workspace + template
   ├─→ SandboxLifecycle.touch(workspaceId)
   ├─→ PortForwarder.forwardPort(5173) → hostPort = 4000
   ├─→ WebContainerRunner.boot() + mount()  (stub,log.warn)
   └─→ return { workspaceId, templateId, fileCount, forwardUrl, estimatedStartSeconds }
```

### 5.3 D3 飞书数据流(stub 模式)
```
用户在 /d3-demo 输入"今天日程"
   │
   ├─→ D3RemoteCommand.runD3({ userMessage })
   ├─→ AgentBrain.think → decision.action = 'reply' (stub)
   ├─→ CalendarConnector.execute({ verb: 'list_today' }) → 假日程数据
   └─→ ChannelRouter.send → 失败(stub) → log.warn
```

### 5.4 错误处理
- D1 截屏失败 → ScreenVision 抛 error → demo 显示错误
- D2 build 失败 → SandboxBuilder 返回 ok:false → demo 显示 error
- D3 CalendarConnector 失败 → 返回 error → demo 显示错误
- D5 LLM API 失败 → fallback stub,生成简单 SKILL.md
- A5 AgentBrain 失败 → fallback stub,显示 placeholder 截图

---

## 6. 测试策略

### 6.1 单元测试(已有,不增)
- W12 已 178/178 通过
- 5 demo builtin 0 个新 unit test(本是用户机体验测试)

### 6.2 真实环境验证(本任务核心)
- 启动 PiPiClaw → 路由 5 个 demo → 截图
- 5 demo 各 5-10 步人工/脚本验证

### 6.3 验收标准
- D1 **截屏 + reply 可见**
- D2 **workspace 目录有 6 文件**(vite-react-ts)
- D3 **stub 模式跑通**(CalendarConnector 假日程)
- D5 **录屏帧记录真**(SKILL.md 看 LLM 配置)
- A5 **决策循环可见**(AgentBrain stub)
- retro 含 5 截图 + 真跑日志
- 跑通率 ≥60%

---

## 7. 实施策略

### 7.1 Subagent 派发模式
**1 个 general_purpose_task subagent** 在有用户机的环境跑:
- **前置**:**必须等 C 完成**(子项目 C)
- **Step 1**:`npm install`(补 `@webcontainer/api`)+ `npm run dev` → 等 Electron 起来(60 秒)
- **Step 2-D1**:按 Cmd+Shift+S → 截屏 → 看 reply → 截图 `d1.png`
- **Step 3-D2**:打开 `/d2-prime-demo` → 输入 prompt → 看 SandboxBuilder 输出 → 截图 `d2.png`
- **Step 4-D3**:打开 `/d3-demo` → 输入 prompt → 看 CalendarConnector 假日程 → 截图 `d3.png`
- **Step 5-D5**:触发 D5 trigger phrase → 录 30 秒 → 停止 → 看 SKILL.md → 截图 `d5.png`
- **Step 6-A5**:打开 `/a5-demo` → 输入 prompt → 看决策循环 → 截图 `a5.png`
- **Step 7**:写 retro + commit

**subagent 估算时间**:半天-1 天

### 7.2 不做的事
- ❌ 不接真实 LLM(子项目 D,本任务只跑 stub)
- ❌ 不接真实飞书账号(子项目 B,本任务 stub)
- ❌ 不动 5 demo 既有 builtin 代码
- ❌ 不新增 npm 依赖

---

## 8. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Electron 启动失败 | 中 | 全部 demo 不可访问 | 跑前先 `npm run build` 验证 |
| 用户机屏幕权限拒绝 | 低 | D1/D5 截屏失败 | 提示用户授权,失败用 stub fallback |
| D2 失败 → C 没完成 | 高(若 C 未完成)| D2 不可跑 | C 必须先做 |
| D3 / D5 / A5 stub 体验差 | 高 | 用户体验不佳 | retro 明确标注 stub 程度 |
| 截图工具不可用 | 中 | retro 无图 | fallback 用文字描述 |

---

## 9. 验收清单

- [ ] `npm run dev` 启动成功,Electron 窗口出现
- [ ] 5 路由可达:`/d1-demo` / `/d2-prime-demo` / `/d3-demo` / `/a5-demo` + D5 trigger
- [ ] D1 截屏 + reply 可见,截图归档
- [ ] D2 SandboxBuilder 选 vite-react-ts 模板 + 写 6 文件,截图归档
- [ ] D3 stub 模式跑(CalendarConnector 假日程),截图归档
- [ ] D5 录屏帧记录真,截图归档
- [ ] A5 决策循环可见,截图归档
- [ ] retro 落库,含 5 截图 + 真跑记录
- [ ] 不修改 5 demo 既有 builtin
- [ ] 不新增 npm 依赖
- [ ] vitest 仍 178/178 通过

---

## 10. 不在范围内

- 接真实 LLM(子项目 D)
- 接真实飞书账号(子项目 B)
- WebContainerRunner 真接(W12+)
- JupyterRunner kernel 真跑(W12+)
- PortForwarder proxy 真转发(W12+)
- SandboxL1 Windows JobObject 真接(W12+)

---

**Spec 状态**:已写入并落库(本文件)

**下一步**:
1. 用户审查本 spec → 批准/修改
2. 批准后调用 writing-plans skill 出实施 plan
3. plan 派 subagent 真实环境跑