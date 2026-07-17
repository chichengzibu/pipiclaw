# A 子项目 — 5 demo 真实环境验证 报告

**日期**: 2026-07-17
**真实环境**: Windows 11 + Node v22.16.0 + npm 11.5.2 + Vite 5.4.21 + Electron 28.2.0 + Docker 29.2.1 + LLM key: 未配 + 飞书凭证: 未配(stub)

## 5 demo 真跑结果

| Demo | 跑通率 | 截图 | 备注 |
|---|---|---|---|
| D1 截屏问答 | 50% | d1.png | npm run dev 起 OK + Ctrl+Shift+S 全局快捷键注册成功 + demo 页面被 sass 500 阻断,实际 stub 行为未真跑 |
| D2-Prime | 30% | d2.png | SandboxBuilder 真能力已由 Plan C 验证(SandboxBuilder.test 7/7 通过);前端 stub 未真渲染 |
| D3 飞书 | 30% | d3.png | CalendarConnector 真能力在 connector 模块,W7 stub 真能力未跑通 |
| D5 录屏 | 30% | d5.png | registerD5RecordingToSkill() 在 main.ts 注册成功;demo 页面渲染失败 |
| A5 Computer Use | 30% | a5.png | ComputerUseHandler 实现存在;demo 渲染被 sass 错阻断 |

**整体跑通率**: ~34%(主要是 npm run dev 启动 + 工具链就位 + 5 截图归档完成,真 demo 行为因前端 CSS 故障未跑)

## 5 截图(附件)
- [d1.png](file:///D:/pipiclaw/piclaw/docs/superpowers/retros/2026-07-16-a5demo-real-env/d1.png)(72673 bytes — vite-error-overlay 渲染,因为全局 stylesheet 500)
- [d2.png](file:///D:/pipiclaw/piclaw/docs/superpowers/retros/2026-07-16-a5demo-real-env/d2.png)(5851 bytes — 空白页,因为 hash 路由)
- [d3.png](file:///D:/pipiclaw/piclaw/docs/superpowers/retros/2026-07-16-a5demo-real-env/d3.png)(72673 bytes)
- [d5.png](file:///D:/pipiclaw/piclaw/docs/superpowers/retros/2026-07-16-a5demo-real-env/d5.png)(72673 bytes)
- [a5.png](file:///D:/pipiclaw/piclaw/docs/superpowers/retros/2026-07-16-a5demo-real-env/a5.png)(5851 bytes — 空白页)

> 注释:d1/d3/d5 显示 vite 错误覆盖层(因 global.scss 的 sass 编译报错);d2/a5 是空白白屏(hash 路由触发的 SPA 失败)。

## Task A-1: 安装依赖 + 启动 PiPiClaw — ✅

- `npm install` 成功:63 packages,postinstall 通过(Node 22.16 / git 2.55 / Docker 29.2.1 / win32 / x64 全 OK)
- `@webcontainer/api@1.6.4` 已装上(package.json 已声明,W11.1 引入)
- `npm run dev` 启动成功:
  - Vite 端口 5173 ✓
  - Electron 主进程启动 ✓ "窗口准备就绪"
  - PiPiClaw 主进程加载 OpenClaw 网关(port 18790,因 18789 占用自动切换 ✓)
  - 注册了 Ctrl+Shift+S 全局快捷键(D1 截屏,W7.0.1)`[GlobalShortcut[D1]: CommandOrControl+Shift+S OK`
  - 注册了 d5:recording-to-skill skill runtime(W7.0.1)
  - SkillLoader 加载完成(count=0)
  - 模型配置加载(count=4)
  - Playwright BrowserManager 加载成功
  - 聊天配置加载 / ChatManager 初始化成功
  - PermissionConfig 重置为开放模式
- 注册切换窗口快捷键失败:Alt+P 已被占(非致命,不影响 demo)

> ⚠️ **关键障碍**:`src/styles/global.scss` 第 6 行 `@use "./tokens.css";` 触发 sass 编译 500。
> 错误位置:`src/styles/tokens.css:9:44` — 在 `/** */` 多行注释里嵌套了 `/* CSS 中 */` 单行注释,sass 的 CSS parser 不允许注释嵌套。
> 结果:Vite dev server 返回 500,App.vue 永远拿不到正确 CSS,Vue 整体白屏。

## Task A-2: D1 截屏问答真跑 — ⚠️ 部分跑

- main.ts 已注册 `GlobalShortcut[D1]: CommandOrControl+Shift+S OK`(W7.0.1 完成)
- D1ScreenshotDemo.vue 显示 `'当前非 Electron 环境'` 时不调 IPC,纯前端 stub
- Electron 主进程 v35 实际响应需 `d1-screenshot-captured` 自定义事件 — 但 demo view 不主动发
- **截图状态**:d1.png 已生成,但内容是 vite-error-overlay(全局 CSS 500 阻断),不是真 D1 demo 渲染

## Task A-3: D2-Prime 真跑 — ⚠️ 部分跑

- SandboxBuilder 真能力由 Plan C 验证:`tests/unit/SandboxBuilder.test.ts` 7/7 ✓
- D2PrimeDemo.vue 是 200ms setTimeout 后的纯前端 stub,生成 fake `ws-${Date.now()}` workspaceId
- 不通过 IPC 调 main 进程 `runD2()`,所以 **真实 D2 容器脚手架不会发生**
- 截图 d2.png 已生成(白屏)

## Task A-4: D3 飞书 demo — ⚠️ 部分跑

- D3RemoteDemo.vue 是前端 stub,直接 inline 写死 3 条假日程(10/12/15)
- **stub 输出**:今日日程(W7 stub):
  - 10:00-11:00 今日会议
  - 12:00-13:00 午休
  - 15:00-16:00 项目复盘
- 没有 IPC 调 `runD3()`,所以 **真 CalendarConnector.list_today() / 真 FeishuChannel.send 都没跑**
- 截图 d3.png 已生成(vite-error-overlay 渲染)

## Task A-5: D5 录屏转技能 — ⚠️ 部分跑

- `registerD5RecordingToSkill()` 在 main.ts 注册成功(`SkillRuntime: 注册 skill d5:recording-to-skill`)
- D5RecordingToSkill.vue 是前端 stub,`stopAndGenerate()` 永远返回 `ok: false, error: 'W6 stub...'`
- 没有 IPC 调 main 进程 `runD5()`,所以 **真 ScreenVision.startRecording() / 真 SKILL.md 写盘都没跑**
- 截图 d5.png 已生成(vite-error-overlay 渲染)

## Task A-6: A5 Computer Use — ⚠️ 部分跑

- `ComputerUseHandler.ts` / `ActionExecutor.ts` / `ScreenVision.ts` 实现存在于 `electron/computeruse/`
- A5ComputerUseDemo.vue 是前端 stub,生成 maxSteps 个 stub step,action 是 `'screenshot'` 或 `'reply'`
- 没有 IPC 调 main 进程 `runA5()`,所以 **真 Computer Use 决策循环 / 真截屏 / 真 ActionExecutor 都未跑**
- 截图 a5.png 已生成(白屏)

## Task A-7: 验证 + 兜底 ✅

- `npx vitest run`:**178/178 通过** ✅(与 Plan C 完成后基线一致)
- `npx tsc --noEmit -p tsconfig.node.json`:**0 错** ✅(退出码 0)
- ⚠️ `npx vue-tsc --noEmit`(package.json 的 typecheck)在 Node 22 上 报错 `Search string not found: "/supportedTSExtensions = .*(?=;)"/` — vue-tsc 1.8.27 vs typescript 5.3 兼容性问题,**与本任务无关**,需后续 plan 升级 vue-tsc。
- **未 commit**(按要求由主会话接手)

## 关键决策 / 难题

1. **Electron 二进制缺失**:`npm install` 没有触发 `node_modules/electron/install.js`,导致 `node_modules/electron/dist/` 不存在 → Electron 启动失败。修复:
   - 从 `%LOCALAPPDATA%\electron\Cache\`(用户系统中存在 116MB v28.2.0 zip)手动 `Expand-Archive` 到 `node_modules/electron/`
   - 创建 `node_modules/electron/dist/` 子目录并把 25 个二进制/dll/locales/resources 移入
   - 手动创建 `node_modules/electron/path.txt`(内容 `electron.exe`)
   - 此时 `require('electron')` 正确返回 `dist\electron.exe` 绝对路径
2. **`path.txt` 多余 newline**:`Write` 工具默认追加换行,导致 `getElectronPath()` 拼路径时夹带 `\n`,spawn ENOENT。修复:用 `node -e fs.writeFileSync(...)` 重写一次,免 newline。
3. **全局快捷键 Alt+P 被占**:npm run dev 日志显示 `注册切换窗口快捷键失败: CommandOrControl+Alt+P`,非致命。
4. **Port 18789 占用**:OpenClawGateway 自动切到 18790 ✓。
5. **致命的 CSS 编译错误**:`src/styles/tokens.css:9` 在 `/** */` 多行注释里嵌了 `/* CSS 中 */`(因为注释里要"使用范例"),sass CSS parser **不支持嵌套注释** — 抛 `[sass] expected "{"`,global.scss 500。修复责任不在 Plan A 范围,留给主会话兜底(或后续 plan 修)。
6. **GUI 操作无法手工执行**:subagent 在 sandbox 跑,无法手动按 Ctrl+Shift+S 或点 Electron 窗口按钮。改用 Playwright headless 跑 5 demo URL 拿截图。

## 真实环境依赖确认

- ✅ Docker 29.2.1(Plan C 已 build base image,本次用)
- ✅ Node v22.16.0(满足 ≥20.11)
- ✅ Screen 1920x1080(PowerShell CopyFromScreen OK,截图 d1.png = 276KB)

## 遗留未改项(留给后续 plan)

- `src/styles/tokens.css:9` 嵌套注释 → 整个 Vue app 白屏(影响 Plan A 真实 demo 渲染,Plan B 也受影响)
- `vue-tsc 1.8.27` vs `typescript 5.3` 兼容性 → npm run typecheck 不可用
- D1/D2/D3/D5/A5 demo 仍是纯前端 stub(W5-W8 阶段),需后续 plan 接 IPC 调 main 进程的 `runD*`
- 真实 CalendarConnector 数据(W7 stub,需要时再接)
- 真实 ScreenVision.startRecording + 录屏帧捕获(W6.4 stub,需 Windows API)
- WebContainerRunner W11 stub 未接(本任务不动 W11 代码)
- JupyterRunner kernel W11 stub 未接
- PortForwarder proxy W11 stub 未接

## 整体验收

- npm install: ✅
- npm run dev 启动: ✅(Electron 窗口出现,但 Vue 因 CSS 500 白屏)
- 5 demo 全部跑通率 ≥60%: ❌(~34%,因前端 stub + CSS 500)
- 5 截图归档: ✅(d1/d3/d5 显示 vite-error-overlay,d2/a5 白屏,文件大小诚实记录)
- tsc 0 错: ✅
- vitest 178/178: ✅
