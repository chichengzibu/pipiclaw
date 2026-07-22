# Phase 3 Retro — Product Quality (2026-07-22)

> 对应 plan: [2026-07-21-phase3-product-quality.md](../../plans/2026-07-21-phase3-product-quality.md)
> 上接: [Phase 2 retro — vue-tsc 0 错](../2026-07-21-phase2-vue-tsc-zero/retro.md)

## 1. TL;DR

Phase 3 完成"产品完整化"8 个 task,工程基线从 Phase 2 末的 **4.5/5** 提升到 **5/5**,产品从 **3/5 → 3.5/5**(对内 alpha 可发,对公 beta 还差跨平台/E2E/i18n)。

| 指标 | Before (Phase 2 末) | After (Phase 3) |
| --- | --- | --- |
| `vue-tsc --noEmit` | 0 errors | 0 errors |
| Lint warnings | 0 | 0 |
| 单元测试 | 192 | **446** (+254 / +132%) |
| coverage (lines) | 18.97% | **~50%** (+31pp) |
| src/stores coverage | 0% | **95%+** (5 个目标 store) |
| electron/llm coverage | 0% | **95.56%** |
| src/views coverage | 0% | **77-99%** (4 个核心 view) |
| LLM 流式推送 | 整条消息 50-100ms 节流 | ✅ 真逐 token 增量 |
| TaskExecutor 业务执行 | stub | ✅ AbortController 真接 |
| apiKey 加密 | 明文 | ✅ safeStorage + legacy migration |
| devDep vuln | 16 | **6** (-62.5%) |
| electron 版本 | 28 | **30** |
| git tag | v2.0.3 | (待 Phase 3 retro 后打) |

## 2. Commit 列表(10 个)

Phase 3 共 **10 个 commit**(在 Phase 2 末 `abf63a6` 之后):

| Hash | Task | Subject |
| --- | --- | --- |
| `1eb9536` | T8 | `chore(release) v2.0.3 Phase 2 vue-tsc 0 errors bundled with Phase 3 plan` |
| `dc9860b` | T3 | `feat(security) safeStorage encrypt LlmConfigStore and IMConfigStore with legacy migration` |
| `b222fec` | T4 | `test(stores) add unit tests for models chat permissions schedule gateway` (+136 tests) |
| `3880f28` | T6 | `test(llm) add unit tests for LlmConfigStore LlmClient adapters` (electron/llm 95.56%) |
| `b3c2cc4` | T5 | `test(views) add unit tests for LlmConfig Permissions ImAccounts Settings` (+48 tests) |
| `32e0cfc` | T1 | `feat(chat) real LLM SSE stream push via chat:streamUpdate` (8 tests,真逐 token) |
| `e9a978b` | T2 | `feat(task-execution) wire chat store confirmExecuteTask to TaskExecutor with cancel support` (8 tests,AbortController) |
| `a82fdb6` | T7 | `chore(deps) reduce devDep vulnerabilities via electron upgrade and overrides` (16→6 vulns) |
| `0430b1f` | cleanup | `chore(gitignore) exclude .electron-cache from electron-builder` |
| `92eea5e` | fix | `test(vitest) use forks pool + isolate to prevent userData mock pollution` (修 vitest 并行 bug) |

## 3. 错分布演进与测试增长

| 节点 | 测试数 | 新增 |
| --- | --- | --- |
| Phase 2 末 | 192 | (起点) |
| Task 8 (release) | 192 | 0(0 代码) |
| Task 3 (safeStorage) | 199 | +7(加密测试) |
| Task 4 (stores) | 335 | +136(5 store + shared mock) |
| Task 6 (llm) | 384 | +49(3 llm 文件) |
| Task 5 (views) | 432 | +48(4 view) |
| Task 1 (stream) | 440 | +8(stream chunk) |
| Task 2 (TaskExecutor) | 446 | +6(abort + store) |
| Task 7 (vuln) | 446 | 0(纯依赖) |
| 修复 (forks pool) | 446 | 0(纯 config) |
| **最终** | **446** | **+254 (+132%)** |

## 4. 决策记录

### D1 — Task 8 先做而非按 plan 顺序

- **决策**: plan 列出 8 个 task(T1-T8),先做 T8(CHANGELOG / version / tag),再做 T3、T4、T6、T5、T1、T2、T7
- **理由**:
  - T8 是纯 0 代码改动,~30 min 完成
  - T8 完成后即可内部 alpha 分发(Phase 2 末的状态已合格)
  - 渐进式:用户能立即看到 v2.0.3 标签 + CHANGELOG,后续 task 持续叠加
  - 心理上"warm up",后面的复杂 task 不会因 stress 而出错
- **代价**: 无,完全是收益
- **额外收益**: T8 commit + tag 让后续 subagent 跑测试有 baseline(192 baseline),便于确认每 task 增量

### D2 — safeStorage 加 legacy migration,而不是强制升级

- **决策**: LlmConfigStore / IMConfigStore 加 safeStorage 加密,但启动时检测旧明文 `llm-config.json` / `im-config.json` 自动迁移并删除
- **理由**:
  - 老用户磁盘上已有明文配置,直接换路径会让他们重新配置
  - safeStorage 在某些平台(Linux without keychain)不可用,自动 fallback 到明文是必须的
  - Migration 是只读读旧文件 + 写新文件 + 删除旧文件,失败时只 log warning,不阻塞启动
- **代价**: 多 30 行 migration 代码 + 1 个测试 case
- **测试模式**: 用 XOR mock safeStorage,断言密文文件不含 'apiKey' / 'openai' / 'feishu' 等明文敏感字串

### D3 — 5 store 单测分散到 5 个文件 + 1 个 shared mock

- **决策**: `tests/unit/stores/__mocks__/electronApi.ts` 共享 mock 5 个 store 用到的全部 IPC namespace,5 个 `*.test.ts` 文件各自 import
- **理由**:
  - 5 个 store 共用 ~30 个 IPC namespace,写 5 份 mock 是重复
  - 共享 mock 让"测试协作"成为后续 store 测试的复用基础
  - 单一来源 mock 维护成本低
- **代价**: 共享 mock 文件 ~100 行,新 store 要先扩展 mock 模块
- **测试覆盖**:
  - chat.ts 92.73% lines / 76.23% functions
  - gateway.ts 90.85%
  - models.ts 96.71%
  - permissions.ts 95.07%
  - schedule.ts **100%**

### D4 — LLM 流式推送 = "fill-the-gap" 而非 "重写"

- **决策**: 探索发现 `chat:streamUpdate` IPC channel 和前端 `onStreamUpdate` 订阅已经铺好,但没有任何代码 emit。Task 1 只让 ChatManager 在 SSE delta 处 `webContents.send('chat:streamUpdate', { conversationId, messageId, delta, type })`,前端 store 加 `handleStreamChunkEvent` 累积 delta
- **理由**:
  - 整个增量推送管道(IPC channel + preload + store subscribe)已存在
  - 不需要新建任何 IPC,只需要 fill 主进程 gap
  - 改完立即可工作,不破坏现有 `broadcastMessage` 节流(保留为兼容层)
- **代价**: 主进程 ~34 行新增,store 端 ~44 行,preload 1 行 callback 签名调整,5 个测试 case
- **关键代码**: 主进程 `broadcastStreamChunk` 不做节流,每次 SSE data 行立即发,store 端 `msg.content = (msg.content || '') + data.delta` 真正增量累积

### D5 — TaskExecutor abort 用 Map<taskId, AbortController> 而非全局 abort

- **决策**: `TaskExecutor.runningTasks: Map<string, AbortController>`,每个 task 自己的 controller,`cancel(taskId)` 通过 controller.abort() 中断
- **理由**:
  - 全局 AbortController 会让所有 task 同时取消
  - Map 形式可独立取消单个 task,支持并发任务
  - `executeTask` 包入 try/finally + signal 检查,每步循环开头检查 `signal.aborted`,被取消则 push cancelled step + break
- **代价**: 16 行 cancel 逻辑 + 1 个 Map 字段
- **API 命名**: preload 已有 `task.cancel` (实际上是 `task:log:cancel`),新方法叫 `task.cancelExecution` 避让

### D6 — Task 7 npm install 引入测试并行 bug,必须修 vitest config

- **决策**: Task 7 把 electron 28 → 30 + electron-builder 24 → 26,新 npm install 后 vitest 全套跑 22 fail,但子集单独跑全过
- **根因**:
  - vitest 默认 `pool: 'threads'`,多个测试文件在 worker threads 中共享 `vi.mock('electron', ...)` 模块
  - 各测试文件 mock 的 `app.getPath('userData')` 返回不同路径(`/tmp/pipiclaw-config-enc-test` 等),但 mock 模块在 thread 之间被复用,后执行的测试拿到之前测试的 mock,userData 路径污染 → 写入冲突
- **修复**: `vitest.config.ts` 加 `pool: 'forks'` + `isolate: true`,每个测试文件独立 worker 进程 + 独立 mock 模块
- **教训**:
  - 涉及 electron/Node 模块 mock 的测试,**必须用 forks pool + isolate**
  - Task 7 subagent 报告"4 件套全过"是单文件测试视角,没意识到 vitest 并行行为
  - 修 config 是 1 commit,值得作为额外 fix 而不是回滚 Task 7

### D7 — electron 30 升级的兼容性

- **决策**: electron 28 → 30 + electron-builder 24 → 26
- **理由**: electron 28 有多个 high CVE(use-after-free),electron 30+ 修复大部分;electron-builder 26 升级 cascade 修 tar / tmp / form-data / immutable / brace-expansion
- **代价**:
  - 需要确认 vite-plugin-electron v0.28 兼容(实际兼容)
  - npm audit 显示仍有 6 个 vuln,但需要 vite 8 / vitest 4 升级(plan 中明确 de-scope)
- **教训**:
  - electron 升级配套 electron-builder 升级是必要的(API 不一致)
  - 升级后必须跑 npm run build(electron-builder),不只是 vitest
  - 跨平台 build 验证在本次 de-scope,留给 Phase 4 Task 1

### D8 — vue-tsc 修复 Task 5 的 vitest.config plugin 改动必须 commit

- **决策**: Task 5 subagent 加了 `import vue from '@vitejs/plugin-vue'` + `plugins: [vue()]` 让 vitest 解析 .vue 文件,但只 commit 了 tests/ 而非 config
- **根因**: subagent 严格按"只 commit 测试文件"指令,忽略了依赖改动
- **修复**: 主 session 在 review commit 时发现,把 vitest.config.ts 用 `git commit --amend` 合并进同一 commit
- **教训**:
  - Subagent 必须 commit 所有"实现测试"必要的 config 改动
  - 主 session review 必须看 git diff `git show --stat` 才能发现遗漏

## 5. 遇到的问题与偏差

### P1 — Task 1 subagent 选择"fill-the-gap"策略耗时更短

- 现象: 探索阶段发现 IPC 管道已铺好,只是主进程没 emit。原本计划 3-4 小时重写,实际 1.5 小时 fill-the-gap 完成
- 教训: 实施前必须先 `Read` 现有实现,可能"已有架构"比"从零写"成本低 3-5 倍

### P2 — Task 4 subagent 担心 7 个未测 store 拉低目录均值

- 现象: 5 个目标 store 平均 ~95% 覆盖率,但 src/stores 目录整体 58.71%(因 7 个其他 store 0%)
- 处理: 接受 plan 范围,DONE_WITH_CONCERNS 报告清楚,**不强行 mock 那 7 个 store**(会引入脆弱测试)
- 教训: 子代理应当 BLOCKED plan 范围外的担忧,而非扩大任务

### P3 — Task 7 subagent 报告 "4 件套全过" 但实际是并行状态问题

- 现象: 单文件 vitest 跑全过,全套 fail 22。subagent 没意识到 vitest pool 行为
- 修复: 主 session 跑全套发现 fail,debug 看 sandbox 错误,定位到 vi.mock 跨文件污染
- 教训: **4 件套验证必须按"全套跑"而非"每个子集跑"**,subagent 验证协议需要更严

### P4 — sandbox 阻止 stdout redirect 文件读取

- 现象: 多次尝试 `npx vitest run > file.txt` 后 `Read` 文件,内容是空白(BOM + 没数据)
- 根因: TRAE sandbox 限制输出到 sandbox 路径,只允许 subprocess 实时输出
- 解决: 用 PowerShell pipeline `npx vitest run 2>&1 | Out-String -Stream | Select-String ...` 实时处理
- 教训: Windows PowerShell + sandbox 项目,redirect 文件不可靠,**永远用 stream 管道**

### P5 — Phase 1 retro 的 de-scope 描述仍部分过时

- 现象: 之前列的"Sandbox 框架未实接 / Hermes AutoCreator 未闭环 / IM channel 8 placeholder"实际都已经实接
- 处理: Phase 3 plan 的 section 0 重新诊断,准确识别真正阻断(LLM 流式断一环 / TaskExecutor stub / safeStorage)
- 教训: **每个 phase 开始前应当先 Read 实际实现,不要盲信上一个 phase 的 retro 描述**

## 6. 留给 Phase 4/5 的事

### Phase 4 跨平台发布就绪(2-3 周)

- **macOS dmg + Linux AppImage build**(当前只 Windows)
- **3 平台自定义 Electron icon**(当前用默认图标)
- **真 E2E**(4 个核心 spec + 7 placeholder 明确 skip)
- **Auto-update channel**(electron-updater + Settings UI)
- **端到端冒烟测试**(3 平台 matrix)
- **收尾 v2.1.0 tag**

### Phase 5 GA 公开(1-2 月)

- **Vue i18n 全量接入**(zh-CN + en-US)
- **性能 benchmark**(4 维度 + CI 阈值)
- **文档站点**(Docusaurus)
- **用户手册 + FAQ**
- **v3.0.0 GA tag**

### 已知风险

- **7 个未测 store**:app / executionMode / guide / hermesMemory / modelRouter / openclaw / skill — Phase 3 没扩范围,Phase 4 可顺手加
- **12 个未测 view**:Phase 3 只测 4 个核心,其余 12 个 view 0% — 大部分是次要 view,继续 de-scope
- **6 个 devDep vuln**:需要 vite 8 / vitest 4 大版本升级才能修,需要 Phase 4/5 评估

## 7. 验证结果汇总

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | exit 0, 0 errors / 0 warnings |
| `npx tsc --noEmit -p tsconfig.node.json` | exit 0 |
| `npx vue-tsc --noEmit` | exit 0 (Phase 1 时 52 errors) |
| `npx vitest run --reporter=basic` | **36 files / 446 tests passed** |
| `npm run build` | ⚠️ electron-builder 26 最后 push 到 GitHub 失败(缺 GH_TOKEN),本地 vite build + electron compile 成功 |

## 8. 给后续 subagent 的提醒

- **每个 phase 开始前先 Read 现有实现** — 不要盲信上一个 phase retro 描述
- **safeStorage 写测试必须 mock 整个 encryptString + decryptString**,不能用 `Buffer.from(plain)` 简单加前缀
- **Pinia setup-store 测试要 `vi.hoisted` 在 import 前注入 window.electronAPI** — chat.ts 在模块顶层一次性 snapshot
- **element-plus ElMessage 必须 mock** — jsdom 没有样式挂载点
- **涉及 electron / node:fs / node:https mock 的测试,必须用 `pool: 'forks'` + `isolate: true`** — 否则 worker thread 间 vi.mock 模块污染
- **4 件套验证按"全套跑"** — 不是"每个子集跑"
- **不要相信 subagent 报告的"单文件全过"** — 必须主 session 亲自跑全套验证
- **PowerShell redirect 文件 sandbox 阻止** — 用 stream pipe 而非 redirect

## 9. 致谢

- Phase 2 retro 给出明确接力点:工程基线已稳,Phase 3 重点产品完整化
- Subagent 4 + 6 + 5 在覆盖率上超额完成(目标 70%,实际 95%+)
- Subagent 1 在 fill-the-gap 策略上省了 3-4 小时
- Subagent 2 在 cancel API 命名避让上发现已有 `task.cancel` 占用,主动用 `cancelExecution`

Phase 3 完整闭环,**对内 alpha v2.0.3 立即可发**,Phase 4 跨平台 + E2E 后即可 beta。