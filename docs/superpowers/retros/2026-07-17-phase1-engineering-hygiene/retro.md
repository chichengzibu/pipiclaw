# Phase 1 Retro — Engineering Hygiene (2026-07-17)

> 对应 plan: [2026-07-17-phase1-engineering-hygiene.md](../../plans/2026-07-17-phase1-engineering-hygiene.md)
> 对应 CHANGELOG: v2.0.2

## 1. TL;DR

工程化基线从 **3/5 → 4.5/5**。四个 task 全部完成:

| 维度 | Before (v2.0.1) | After (v2.0.2) |
| --- | --- | --- |
| Lint | 无 ESLint 配置,`npm run lint` 不存在有效规则 | ESLint 9 flat config,0 errors / 104 warnings |
| CI | 5/7 step 带 `\|\| echo soft-fail`,真实错误被吞 | `lint` / `build` hard-fail,vue-tsc / sandbox / e2e soft-fail 标注 Phase 来源 |
| 仓库干净度 | 56 个 untracked 文件 + 多个未 commit 脚本 | untracked = 0,scripts/tests/shims.d.ts 全部进 git |
| 文档同步 | README 写 OpenAI/Anthropic/Azure/Ollama,实际只 3 个 provider | README 同步 3 provider / 11 IM channel / sandbox P7 / 7 retro + 7 plan 索引 |
| Test | 192/192 passed | 192/192 passed(未修改任何已有测试,只新增 6 个 unit test 进 git) |

**核心交付:**
1. **真实 lint 暴露**: ESLint flat config 跑通,104 warning 不是错误
2. **CI 不再藏 bug**: lint / build 失败会立刻 red
3. **仓库无 untracked**: 30+ 临时文件进 `.gitignore`,辅助脚本进 git
4. **文档与代码同步**: README / CHANGELOG / INDEX 三件套对齐实际状态

## 2. Commit 列表

Phase 1 共 **6 个 commit**(在 `ba7c2e9` 计划 commit 之后):

| Hash | Task | Subject |
| --- | --- | --- |
| `5f92095` | T1(已完成,见 v2.0.2 之前) | `style(eslint) initial pass auto-fix plus manual cleanup` |
| `81974d2` | T1(已完成,见 v2.0.2 之前) | `chore(eslint) flat config 9 + typescript + vue plugin enabled` |
| `c0e69fe` | T2 | `ci(workflow) hard-fail lint build plus playwright config and @playwright/test devDep` |
| `2b63b0d` | T3 | `chore(scripts tests) commit probe scripts and new unit tests plus shims.d.ts` |
| `c161cc7` | T3 | `chore(gitignore) extend for step logs and probe scripts and smoke-tmp` |
| `ff00762` | T4 | `docs(readme changelog index) sync with actual 3 LLM provider 11 IM channel sandbox P7` |
| `<本 commit>` | T4 | `docs(retro) Phase 1 engineering hygiene 4.5/5 baseline` |

## 3. 新增文件

| 文件 | 用途 | 行数 |
| --- | --- | --- |
| `eslint.config.js` | ESLint 9 flat config(typescript-eslint + eslint-plugin-vue + globals) | ~80 行 |
| `playwright.config.ts` | Playwright e2e 配置(CI / 本地双模式,E2E_BASE_URL env 支持) | 28 行 |
| `docs/CHANGELOG-INDEX.md` | 7 retro + 7 plan + 4 spec 统一索引 | ~45 行 |
| `docs/superpowers/retros/2026-07-17-phase1-engineering-hygiene/retro.md` | 本文件 | (本文) |

## 4. 决策记录

### D1 — ESLint 用 flat config(ESLint 9+ 推荐)

- **决策**: 采用 `eslint.config.js` flat config 格式,不用 `.eslintrc.json`
- **理由**:
  - ESLint 9 默认就是 flat config,旧 `.eslintrc` 会在 v10 移除
  - flat config 支持 `ignores` 数组(更直观)+ `languageOptions` 细粒度控制
  - 与 TypeScript / Vue plugin 的最新文档对齐
- **代价**: 旧 ESLint 兼容需要额外 `.eslintignore` fallback(已加)

### D2 — playwright config 不强制 webServer(支持 E2E_BASE_URL 环境变量)

- **决策**: `webServer` 字段在 `E2E_BASE_URL` 环境变量已设置时为 `undefined`(用现成的 dev server)
- **理由**:
  - Phase 1 的 e2e spec 多是 placeholder,真跑要 Electron renderer,本地起 `npm run dev` + 浏览器即可
  - CI 上未来要跑真 e2e 时,可直接用 `E2E_BASE_URL` 接 staging 服务,不用改 config
  - 避免 config 启动 npm 子进程(`npm run dev`)在 CI 环境上的兼容问题
- **代价**: 第一次本地跑要手动起 dev server;`reuseExistingServer` 在非 CI 模式自动复用

### D3 — vue-tsc 0 错 de-scope 到 Phase 2(不动手)

- **决策**: Plan 原本要求 vue-tsc 修到 0 错,实际跑发现 **41 个错误**,主要在:
  - `src/views/Chat.vue` / `LlmConfig.vue` / `Permissions.vue` / `Schedule.vue` / `SkillMarket.vue` 的 props 类型缺
  - `src/stores/*.ts` 缺字段回填
  - `electron/types/*.d.ts` 部分 declaration 不匹配
- **理由**:
  - 41 错误的根因是代码本身状态问题(stores 字段缺失 + types 不完整),不是工程化配置问题
  - 修 vue-tsc 需要回填 stores 字段、扩 types 声明,工作量大且会引入业务改动
  - Phase 1 范围只覆盖工程化基线,业务修整超出范围
- **代价**: CI 上 `vue-tsc` 保留 soft-fail 并标注 "Phase 2 follow-up",文档里明确这是已知 de-scope
- **后续**: Phase 2 启动时第一个 task 就是补 stores 字段 + 扩 types,然后 re-enable vue-tsc hard-fail

### D4 — `@playwright/test` 装入 devDependencies

- **决策**: Phase 1 commit 中追加 `@playwright/test@^1.59.1` 到 devDependencies
- **理由**:
  - package.json 已有 `playwright@^1.59.1`(库),但 `playwright.config.ts` 必须用 `@playwright/test`(test runner)
  - 缺失会让 `npx playwright test --list` 报 `Cannot find module '@playwright/test'`
  - 这是配置生效的必要依赖,不是新增能力
- **代价**: package.json / package-lock.json 同步更新,符合 plan "新增 npm 依赖必须 commit 在 package.json + package-lock.json"

### D5 — 新增 `src/shims.d.ts` 进 git

- **决策**: 把 `src/shims.d.ts` 也 commit 进 git(plan 没明确要求)
- **理由**:
  - 文件已在 `tsconfig.json` 的 `include` 里(`src/shims.d.ts` 显式列出)
  - 提供 `vue-i18n` 和 `element-plus/dist/locale/*.mjs` 的 ambient 声明
  - 不 commit 的话,别人 clone 出来 `vue-tsc` 会缺模块声明(虽然 Phase 1 vue-tsc 是 soft-fail,但这是会咬人的坑)
- **代价**: 1 个新增 tracked 文件,无副作用

## 5. 遇到的问题 / 偏差

### P1 — `cd /d` 在 PowerShell 7+ 不支持

- **现象**: 第一次跑命令 `cd /d D:\...` 被 PowerShell 7 parser 拒绝(`&&` 也不能用)
- **解决**: 改用 `cd D:\...;` (分号) 单条命令 + 后续 `npx ...`
- **影响**: 无,只是命令风格调整

### P2 — `playwright` 与 `@playwright/test` 是两个包

- **现象**: `npx playwright test --list` 报 `Cannot find module '@playwright/test'`
- **根因**: `package.json` 有 `playwright`(库)没有 `@playwright/test`(test runner),而 config 文件 import 的就是 `@playwright/test`
- **解决**: `npm install --save-dev @playwright/test@^1.59.1`,同步 package.json + package-lock.json

### P3 — subagent 上下文断 + 中途接手

- **现象**: Plan 写到一半 subagent 在 T1 完成后中断,主 session 推进 T2/T3/T4 的整体方向,但具体 commit 由新 subagent 完成
- **影响**:
  - 主 session 评估 vue-tsc(de-scope)+ 决策 framework 已固化
  - 新 subagent 接手时按 plan 文件执行,T1 已 commit 不动,只在 `ba7c2e9` 之后追加
  - 工作模式 1+2+3 拆分是 plan 设计好的容错,实际验证有效
- **教训**: Plan 中明确 "每个 task 内部 step 必须按顺序",subagent 中断后接手 subagent 按 plan 走就能恢复

### P4 — 4 个 M 状态文件未处理(`dist-electron/main.js` / `dist-electron/preload.js` / `src/views/Models.vue` / `tsconfig.json`)

- **现象**: 这些是历史 commit 之后 working tree 残留的修改,不属于 Phase 1
- **决策**: **不动它们**(plan 明确"不修改 history commit 之前的修改")
- **后续**: 这些改动属于 Stage 之前的 staged dirty state,可能是 electron-builder / vite build 过程中残留,需要单独 commit 或 stash

### P5 — `vitest-step1.txt` 在 .gitignore 之外的额外模式

- **现象**: T3 Step 5 验证时发现还有 `vitest-step1.txt` 一个 untracked 文件
- **决策**: 主动加 `vitest-step*.txt` 到 `.gitignore`(plan 没明确列)
- **理由**: 与 plan 的 `tsc-step*.txt` / `lint-step*.txt` 同模式,统一规则

## 6. 留给 Phase 2/3/4 的事

### Phase 2 — 产品质量

- **vue-tsc 0 错**: 回填 `src/stores/*.ts` 字段 + 扩 `electron/types/*.d.ts`,把 CI 上的 vue-tsc 改回 hard-fail
- **WebContainerRunner renderer 真接**: 把 `@webcontainer/api` 在 renderer 里真接起来,跑 D2-Prime demo 真实链路
- **LLM 流式输出 SSE**: ChatManager 加 stream handler,前端显示 token-by-token
- **LLM Provider 自动 fallback**: 主 provider 失败自动切下一个
- **LlmConfig.vue 单元测试**: 覆盖 provider 切换 / apiKey 校验
- **11 IM channel 8 placeholder UI 标记**: 在 `ImAccounts.vue` 上对 8 个未实接的 channel 显示「待集成」标签

### Phase 3 — 产品打磨

- **Hermes 自我学习 AutoCreator 闭环**: 模式识别 → 提案 → 用户确认 → 自动生成 skill
- **LlmConfigStore / IMConfigStore safeStorage 加密**: apiKey / secret 用 `electron.safeStorage` 加密持久化
- **Vue i18n 全量接入**: `src/locales/{zh-CN,en-US}.ts` 内容填完整 + vue-i18n 实接
- **CI coverage step 目标 > 70%**: `npm run test:coverage` 上 CI,阈值 70% 起步

### Phase 4 — 战略级

- **真 docker e2e CI**: 去掉 sandbox / e2e 的 soft-fail,真跑 docker
- **D2-Prime 30s 端到端真实部署**: 从 prompt → WebContainer 启动 → 端口转发 → URL 返回 < 30s
- **electron-builder auto-update channel**: 配置 release channel + 自动升级
- **性能 benchmark**: LLM 延迟 / sandbox 启动时间 / IPC 响应时间

## 7. 验证结果汇总

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | exit 0, **0 errors / 104 warnings** |
| `npx tsc --noEmit -p tsconfig.node.json` | exit 0 |
| `npx vitest run --reporter=dot` | **192/192 passed**(22 test files) |
| `npx vue-tsc --noEmit` | **41 errors**(soft-fail, de-scope to Phase 2) |
| `npx playwright test --list` | **10 spec / 20 test cases** |
| `git status --short`(T3 完成后) | 仅 4 个历史遗留 M(不属于 Phase 1) |

## 8. 给后续 subagent 的提醒

- **vue-tsc 41 错是 Phase 1 已知 de-scope**: 第一个 Phase 2 task 必须解决,否则 CI 红色风险长期悬挂
- **ESLint 104 warning 不是错误**: 多数是 `@typescript-eslint/no-unused-vars` 类,Phase 2 决定要不要清(可能改成 import order / prefer-const 等规则)
- **`@playwright/test` 是 test runner 不是 library**: package.json 必须有,否则 config 加载失败
- **README 与代码同步是 recurring 工作**: 每次新增 feature / 修改路由 / 增 provider 都应同步 README,不能攒到下次 retro
- **`.gitignore` 模式要统一**: `*-step*.txt` 这种模式覆盖 step logs / probe scripts / smoke tmp,新增的临时文件都用同模式

## 9. 致谢

- T1(ESLint)由前一 subagent 完成,本 subagent 接手 T2/T3/T4
- 主 session 在 vue-tsc de-scope 决策上提供关键输入
- Plan 文件本身就是最好的协作媒介 — 接手 subagent 直接按 plan 走即可,不需要 context 同步