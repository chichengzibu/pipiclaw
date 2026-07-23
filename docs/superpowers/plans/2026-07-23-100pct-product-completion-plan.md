# PiPiClaw 100% 完整产品化计划

> **作者**: Mavis (MiniMax Code 助理) | **日期**: 2026-07-23 | **适用版本**: v3.0.0 (GA) → v4.0.0 (Production-Ready)

## TL;DR

PiPiClaw 当前是 **"60-70% 完整产品"**:
- ✅ 架构扎实 (Electron 30 + Vue 3 + TS + Pinia + Element Plus)
- ✅ 486 单元测试 + 17 真 e2e 通过
- ✅ i18n / 文档 / 性能基准 / 自动更新 已建
- ❌ v3.0.0 GA 居然没跑过 `npm run build`,**主导航 broken** 还能 release
- ❌ Hermes 记忆/学习停留在 demo
- ❌ OpenClaw 自动化 6/10 真实场景是 placeholder spec
- ❌ 174 commit 未 push,工程纪律脆弱

**目标**:在 6 个 phase 内把 PiPiClaw 打造成 100% 完整、可发布、可维护的产品。

---

## 现状盘点(2026-07-23 当日审计)

### 刚发现的 4 个隐藏 bug(均已修)

| # | Bug | 影响 | 修复文件 |
|---|---|---|---|
| 1 | `main.ts` 没全局注册 `@element-plus/icons-vue` | 14 个 nav-item 图标全渲染失败 | `src/main.ts` |
| 2 | `index.html` CSP 缺 `'unsafe-eval'` | Vue 运行时 `new Function()` 被拦 | `index.html` |
| 3 | `SideNav.vue` 缺 `min-width` 兜底 | 窗口被压时 SideNav 折叠消失 | `src/components/layout/SideNav.vue` |
| 4 | `WindowManager` 拿错 `repoRoot`,tests 找不到 main.js | e2e 永远跑不起来 | `tests/e2e/helpers/electron-app.ts` |

### 工程质量层(马上要修的)

- [ ] **174 个 commit 未 push**(`git push` 一把梭,远程冲突需先 `fetch` 协商)
- [ ] **release checklist 不含 `npm run build`** —— v3.0.0 是这样漏过 SideNav broken 的
- [ ] **CI 不硬 fail** `npm run build`(`c0e69fe` 改过一次又松了)
- [ ] **测试硬编码中文**(`chat-agent.spec.ts` 用 `:has-text("对话")` 假设 zh-CN)
- [ ] **placeholder icon 长期没换**(之前 `icon.ico` 101 字节 16x16 跑了一年)

### 功能成熟度层

| 模块 | 成熟度 | 证据 |
|---|---|---|
| LLM 集成 | 50% | 3 provider 通了,但 `LlmAgentBrain` 大部分场景走 stub fallback |
| Hermes 记忆 | 30% | 单元测试有,e2e 无,自动生成技能未跑通真实工作流 |
| OpenClaw 自动化 | 50% | 4 个 sandbox 模板 + Playwright + Jupyter,但 6/10 e2e placeholder |
| Skills 系统 | 40% | builtin 有,market/import/auto-gen 未跑通真实用户 |
| 权限系统 | 60% | 3 模板 + 7 类别 + 自定义规则,但 IPC 路径未 e2e |
| 模型管理 | 50% | CRUD + 测试连接有,自动 discover/配比未做 |
| IM 集成 | 30% | UI 有,真飞书/钉钉凭证接通的 e2e 全 skip |
| 自动更新 | 40% | wired 但 `latest.yml` 是测试产物,签名未配 |
| 多端构建 | 60% | macOS / Linux 配置了,实际只 Windows 跑过 |

---

## North Star: "100% 完整产品" 的定义

| 维度 | 100% 标准 |
|---|---|
| **功能完整** | 用户从安装到完成"自动化整理下载文件夹"这种真实任务,全流程无 placeholder |
| **工程质量** | `npm run build && npm run lint && npm run typecheck && npm test && npm run smoke` 全绿 + 0 个 placeholder spec |
| **可发布** | Windows .exe 装在裸机上能跑所有 14 个导航 + 7 个 sandbox 模板;macOS / Linux 至少 CI 出包 |
| **可维护** | release 前必须:1 个新 commit = 1 个 e2e 守卫;CHANGELOG / docs 与代码同源 |
| **可学习** | 用户用 1 周,系统能从 0 个 skill 长到 ≥ 3 个 auto-generated skill(用户可见) |
| **可分发** | 自动更新能跑 + code signed + 用户能反馈 issue |

---

## 路线图(6 个 phase,按依赖排序)

### **Phase 0: 工程纪律(必须先做,否则后面全白做)**

**目标**:让"v3.0.0 主导航 broken 还能 release"这种事**永远不再发生**。

#### 任务清单

- [ ] **T0.1 推送 174 个未 push commit**
  - `git fetch origin`,检查冲突
  - 协商解决(可能需要 rebase / 协商保留策略)
  - `git push origin master`,远程和本地同步
  - **完成定义**: `git status` 显示 `Your branch is up to date with 'origin/master'.`

- [ ] **T0.2 把今天 9 个修复合 1 个 commit**
  - `src/main.ts` (icons 全局注册)
  - `src/components/layout/SideNav.vue` (min-width)
  - `index.html` (CSP)
  - `electron/core/WindowManager.ts` (PIPICLAW_E2E env)
  - `tests/e2e/helpers/electron-app.ts` (路径 bug + env)
  - `tests/e2e/chat-agent.spec.ts` (locale-aware)
  - `tests/e2e/settings-p7.spec.ts` (locale-aware)
  - `tests/e2e/a5-computer-use.spec.ts` (locale-aware)
  - `tests/e2e/ui-smoke.spec.ts` (新增,4 个综合测试)
  - commit msg: `fix(release) SideNav icons + CSP + e2e locale-aware: bring v3.0.0 to actually working`
  - 同时 `git rm debug.log`(tracked 但已废)

- [ ] **T0.3 修 release checklist,加 hard-fail `npm run build`**
  - 编辑 `.github/workflows/ci.yml`,加 step:
    ```yaml
    - name: Build
      run: npm run build
    ```
  - 必须 pass 才能 merge
  - 同步更新 `docs/release/alpha-notes.md`,加 "release checklist" 段落

- [ ] **T0.4 给所有 e2e 加 "fresh env" 守卫**
  - 在 `helpers/electron-app.ts` 里加 `clear-userData-dir` 选项
  - CI 上每次跑前清 userData,避免 localStorage 污染
  - 默认开 `fresh: true`

- [ ] **T0.5 `npm run icons` 跑一次,生成正式图标**
  - 当前 7 个 `resources/icon-*.png` 是 `npm install png2icons` + `npm run icons` 出来的
  - 需要决定:这 7 个 PNG 加到 `.gitignore` 还是 commit 进 repo
  - **建议 commit 进 repo**(`generate-icons.mjs` 跑 1 次,后续重跑要重生成)
  - 把 `png2icons` 加到 `devDependencies`(刚才 `--no-save` 装的,没存)

- [ ] **T0.6 写 `RELEASE_CHECKLIST.md`**
  - 每次 `npm run release` 前必走:
    1. `npm run lint` → 0 errors
    2. `npm run typecheck` → 0 errors
    3. `npm test` → 全过
    4. `npm run smoke` → 全过
    5. `E2E_ELECTRON=1 npm run test:e2e` → 全过
    6. **`npm run build` → 必须出 .exe,体积 ≤ 100MB** ← 关键
    7. 装机到干净 Win10 VM,跑 5 分钟,无报错
  - 放到 `docs/release/RELEASE_CHECKLIST.md`

#### 验收
- `git log` 最近一个 commit 是 v3.0.0 之后的 fix,SideNav 真实可见
- CI 上 `npm run build` 必须 hard pass
- 7 个 icon PNG commit 进 repo

---

### **Phase 1: 14 个导航 × 7 个 sandbox 全跑通**

**目标**:产品清单上每条都能用,没有"已建但未跑通"。

#### 任务清单

- [ ] **T1.1 把 6 个 placeholder e2e 转真 e2e**(或删除 + 改 issue 跟踪)
  - `d3-feishu.spec.ts` → 拆:UI 走通 + 真凭证放 separate CI job
  - `d2prime-docker-missing.spec.ts` → 改用 npm script 模拟 docker missing
  - `d2prime-oom.spec.ts` → 同上,memory 限制可控
  - `d2prime-port-conflict.spec.ts` → 改程序内模拟
  - `d2prime-screenshot.spec.ts` → 用 headless 模式跑,不真截图
  - `insight-trace.spec.ts` → 拆 trace API 单元测试
  - **每拆一个,提一个 commit,确保 `npm run test:e2e` 不退步**

- [ ] **T1.2 7 个 sandbox 模板各跑一次,出报告**
  - 现状:`SandboxBuilder` 4 个 template(Vite-React / Next.js / FastAPI / Go HTTP)+ `WebContainerRunner` + `JupyterRunner` + `PortForwarder` = 7 个 runtime
  - 每个跑一次(5 分钟内启动 + 200 状态码)
  - 报告写到 `docs/perf/sandbox-validation-2026-07.md`
  - 失败的标 red,8 月前补完

- [ ] **T1.3 14 个 nav route 各开一次,无 JS 错误**
  - 写 e2e 测:`['/dashboard', '/chat', '/skills', '/settings', '/help', '/models', '/permissions', '/plugin-market', '/remote-control', '/schedule', '/skill-market', '/tasks', '/d1-demo', '/d5-demo']`
  - 每个 route 等 1.5s,`pageerror` 监听,任何 console.error 都算 fail
  - 加入 `ui-smoke.spec.ts`

- [ ] **T1.4 测一次"真用"的场景**
  - 写一个 e2e 跑真实工作流:
    1. 打开 Settings → 加 OpenAI provider(用 mock server)
    2. 切回 Chat → 新建对话 → 输入 "列出当前目录文件"
    3. 验证 LLM 真回了(不是 stub)
  - 这个不写,e2e 永远证明不了"LLM 通了"

#### 验收
- `npx playwright test --reporter=line`:**30+ passed, 0 skipped, 0 failed**
- `docs/perf/sandbox-validation-2026-07.md` 7 个 sandbox 全绿
- 14 个 nav route 全部 console-clean

---

### **Phase 2: 真学习(Hermes 2.0)**

**目标**:用户用 1 周,系统自动学会 ≥ 3 个 skill,且用户能在 Skills 页看到生成历史。

#### 现状

- `electron/hermes/MemoryVectorStore.ts` 存在
- `HermesAdapter.getInstance()` 启动时 warmup
- 单元测试 `hermes-adapter.test.ts` 有
- D5 录屏 demo 在 Chat 页里有链接

#### 任务清单

- [ ] **T2.1 Hermes 行为记录 e2e**
  - 写一个 e2e,用户在 Chat 重复 3 次类似操作:
    1. "列出 D:/downloads 文件"
    2. "列出 D:/downloads 文件"
    3. "列出 D:/downloads 文件"
  - 验证:`HermesAdapter.patterns` 数组里出现这个 pattern
  - 验证:Skills 页"提案横幅"出现 "文件列表 D:/downloads"

- [ ] **T2.2 技能自动生成 e2e**
  - pattern 被识别后,点"批准生成 skill"
  - 验证:`skills/auto-generated/file-listing-*/` 目录创建
  - 验证:`skill.md` 包含触发关键词

- [ ] **T2.3 技能热加载 e2e**
  - 生成 skill 后,不重启应用
  - 验证:Chat 页能调用新 skill,返回结果

- [ ] **T2.4 记忆检索 e2e**
  - 用户在 Settings 加 1 条核心记忆"我常用 D:/downloads"
  - 切到 Chat 问"我文件在哪"
  - 验证:系统 prompt 注入"用户偏好 D:/downloads"

- [ ] **T2.5 真实用户回放 1 周数据**
  - 在自己机器上用 1 周,记录 patterns
  - 写 `docs/superpowers/retros/2026-XX-XX-hermes-real-user-week.md`
  - 报告:学会了几个 / 用户接受了几个 / 用户拒绝几个

#### 验收
- 上面 4 个 e2e 全过
- retro 报告有真实数据
- Phase 2 retro:**Hermes 从 30% 升到 70%**

---

### **Phase 3: 真自动化(OpenClaw 2.0)**

**目标**:至少 3 个真实工作流从 demo 变成 production 流程。

#### 任务清单

- [ ] **T3.1 "自动整理下载文件夹" production 化**
  - 现状:D1 截屏 demo 在,实际逻辑未串通
  - 实现:`{downloads_dir}` -> 按扩展名分类(图片/文档/视频/其他)-> 移动到 `{downloads_dir}/sorted/{type}/`
  - 写 e2e:下载 3 个不同类型文件,跑 skill,验证归位
  - 用户故事:用户说"整理下载文件夹",系统真做

- [ ] **T3.2 "AI 截屏问答" production 化**
  - 现状:D1 demo 有
  - 实现:截屏 → OCR (用 Tesseract 或调 LLM vision) → LLM 回答问题
  - 写 e2e:截屏固定图片,问"图里是什么",验证回答

- [ ] **T3.3 "AI 录屏转技能" production 化**
  - 现状:D5 demo 有
  - 实现:录用户操作 → 解析为 step 序列 → 生成 skill.md
  - 写 e2e:录制 1 个简单的"重命名文件"操作,验证 skill 生成

- [ ] **T3.4 错误恢复**
  - 任何 sandbox 任务失败,系统报告可读的错误(不要 stack trace)
  - 重试 3 次后还失败,提示用户手动介入

#### 验收
- 3 个 production 流程每个 e2e 通过
- 用户能用真实场景而不只是 demo
- Phase 3 retro:**OpenClaw 从 50% 升到 75%**

---

### **Phase 4: 用户体验抛光**

**目标**:非开发者用户首次打开 → 5 分钟内上手,无需看文档。

#### 任务清单

- [ ] **T4.1 优化 FirstLaunchGuide**
  - 现状:`FirstLaunchGuide` 组件存在,但可能过于开发者向
  - 改:3 步引导(选 LLM provider → 测连接 → 试一次对话)
  - 加动画,不要弹窗堆叠

- [ ] **T4.2 错误消息人话化**
  - 把"ECONNREFUSED 127.0.0.1:11434"改成"本地 Ollama 没起来,要不要我帮你启动?"
  - 把"401 Unauthorized"改成"API Key 不对,去设置里检查"
  - 全文搜索 `console.error` 改成用户能懂的文案

- [ ] **T4.3 性能优化**
  - 当前主 bundle 1.14MB → 拆 code-split,目标 < 800KB
  - 冷启动 5s → 目标 3s(测 `electron-builder` 装包后的 `app.whenReady → window.show` 时间)
  - 占内存 300MB → 目标 200MB

- [ ] **T4.4 暗色模式 / 主题切换**
  - 现状:有主题变量,5 套主题定义
  - 加:跟随系统 + 手动切换
  - e2e 测:切暗色 → 所有页面背景变深

- [ ] **T4.5 多窗口 / 标签页**
  - 现状:单窗口
  - 加:多 Chat 标签(参考 Chrome tabs)
  - 进度条 1-2 周

#### 验收
- 一个非开发者朋友试 5 分钟能跑通对话
- 性能预算达标
- 暗色模式生效

---

### **Phase 5: 分发与支持**

**目标**:用户能装到电脑 → 自动更新能跑 → 用户能反馈问题。

#### 任务清单

- [ ] **T5.1 Code signing**
  - 现状:未签名
  - 弄 EV certificate(Windows 需要)
  - `electron-builder.json5` 加 `win.certificateFile`
  - 用户装时无 SmartScreen 警告

- [ ] **T5.2 真自动更新**
  - 现状:AutoUpdater wired,但 `latest.yml` 是测试产物
  - 搭 GitHub Releases pipeline(`.github/workflows/release.yml`)
  - 每次 tag 触发:build + 上传 .exe + 上传 latest.yml
  - 用户在 app 内能看到更新提示

- [ ] **T5.3 macOS / Linux 真实构建**
  - 现状:配置了但只 Windows 跑过
  - CI 跑 macOS runner + Linux runner
  - 产出 .dmg / .AppImage

- [ ] **T5.4 用户反馈通道**
  - 现状:无
  - 加:Settings → "反馈"按钮 → 弹窗 → 自动生成系统信息 + 用户描述 → 提交到 GitHub Issue
  - 或集成 Sentry(自费)

- [ ] **T5.5 文档完整化**
  - 现状:`docs/site/` 有骨架
  - 加:每个主要功能 1 个 5 分钟上手视频(GIF 或 mp4)
  - 加:troubleshooting 扩充到 30 条
  - 加:FAQ 扩充到 50 条

- [ ] **T5.6 营销物料**
  - 一个 hero GIF(展示主流程)
  - 截图集(5 张关键页面)
  - README 重写(放 hero + 截图 + 5 行安装 + 5 行使用)

#### 验收
- Windows 装机无 SmartScreen 警告
- 自动更新跑通 1 次完整周期
- macOS / Linux 有 build artifact
- 反馈通道收到 ≥ 1 条真实反馈

---

### **Phase 6: 100% 验收 & v4.0.0 Release**

**目标**:所有 phase 完成 → 出 v4.0.0 "Production-Ready"。

#### 任务清单

- [ ] **T6.1 全量回归**
  - 跑一遍:
    - `npm run lint` (0 errors)
    - `npm run typecheck` (0 errors)
    - `npm test` (all pass)
    - `npm run smoke` (all pass)
    - `E2E_ELECTRON=1 npm run test:e2e` (all pass)
    - `npm run build` (成功,出 .exe)
    - `npm run perf` (性能符合预算)

- [ ] **T6.2 Beta 试用**
  - 找 3-5 个非开发者,装 .exe,各用 1 周
  - 收集反馈,修 critical bug

- [ ] **T6.3 v4.0.0 Release Notes**
  - 写 `CHANGELOG.md` v4.0.0 条目
  - 整理 retro 文档:`docs/superpowers/retros/2026-XX-XX-v4-100pct.md`

- [ ] **T6.4 tag + push**
  - `git tag v4.0.0`
  - `git push origin v4.0.0` → 触发 release workflow
  - 验证自动更新检测到 v4.0.0

#### 验收
- v4.0.0 装机在 5 个不同 Win10 机器,都跑通
- 自动更新跑通
- retro 文档:PiPiClaw 从 60% → 100%

---

## 时间预估

| Phase | 工作量 | 估时 |
|---|---|---|
| P0 工程纪律 | 改 5 个文件 + 1 个 checklist | **3-5 天** |
| P1 14×7 全跑通 | e2e 改写 + sandbox 报告 | **1-2 周** |
| P2 真学习(Hermes 2.0) | 4 个 e2e + 1 周真用 | **2-3 周** |
| P3 真自动化(OpenClaw 2.0) | 3 个 production 流程 | **3-4 周** |
| P4 UX 抛光 | 5 个子项 | **2 周** |
| P5 分发与支持 | 6 个子项 | **2-3 周** |
| P6 100% 验收 | 回归 + beta + release | **1 周** |
| **总计** | | **约 3 个月** |

---

## 风险登记

| 风险 | 影响 | 缓解 |
|---|---|---|
| Hermes 真实学习效果 < 预期 | Phase 2 延期 | 用真实数据回放,看 baseline |
| Code signing 证书贵 / 流程慢 | Phase 5 延期 | 先用开源签名,生产再换 |
| macOS 跑不起来 | Phase 5 延期 | 早期就在 macOS runner 跑 |
| 自动更新被打回 / 提示 | Phase 5 | 加 graceful fallback |
| 用户反馈没人响应 | Phase 5 | 自己先回 1 周 |

---

## 立即可执行(下一个 PR)

按优先级,以下这些**今天就能 commit**:
1. **commit 1**:SideNav icons + CSP + e2e locale-aware(8 个文件改动)
2. **commit 2**:`.gitignore` 加 `debug.log` + `npm run icons` 后 commit 7 个 PNG
3. **commit 3**:RELEASE_CHECKLIST.md 新建

要不要我现在就把 commit 1 + 2 + 3 一起提了?提完整个 P0 就基本收尾。
