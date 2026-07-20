# Retro — Phase 1 优化修复(warning 104→0 + 4 个 dirty file 处理)

**日期:** 2026-07-17
**前置 commit:** `f758696` (Phase 1 engineering hygiene retro)
**最终 commit:** `7ffd4a9`
**参与:** 主会话(systematic-debugging + 直接修)+ 2 个 subagent(批量 batch 1-4 + batch 5/6)

---

## TL;DR

Phase 1 工程化基线之后的"精细打磨"步骤:
1. **Fix-1/2**:撤销 Phase 1 subagent 留下的 4 个 dirty 文件(dist-electron M + tsconfig.json strict: false + Models.vue)→ 仓库干净
2. **Fix-3**:Models.vue lint-fix 改动单独 commit
3. **Fix-4**:**ESLint warning 104 → 0**(目标 ≤30,实际超目标 70 个),分 6 batch:
   - Batch 1: `electron/core/` + `browser/` + `main.ts` + `preload.ts`(93→81)
   - Batch 2: `chat/agent/openclaw/hermes/learning`(81→67)
   - Batch 3: `sandbox/utils/task/skill/permissions/models`(67→53)
   - Batch 4: `src/components/`(53→39)
   - Batch 5: `src/stores/`(37→34)
   - Batch 6: `src/views/` + `preload.ts` `ExecutionPlanStep` interface(34→0)
4. **Fix-5**:CI 上 vue-tsc 软错保留(因为 52 个真实 vue-tsc 类型错未修),属于 Phase 2 工作

**最终状态**:lint 0 errors / **0 warnings** / vitest 192/192 / tsc clean / playwright 20 tests / git clean。

---

## Commit 链(Phase 1 修复段,共 8 commit)

```
7ffd4a9 chore(eslint) batch6 drop unused in src views and ExecutionPlanStep in preload (37 to 0 warnings)
74a9128 chore(eslint) batch5 drop unused vars in src stores (37 to 34 warnings)
55f97a2 chore(eslint) batch4 drop unused imports and props alias in src components (53 to 39 warnings)
b5dc3df chore(eslint) batch3 drop unused imports in sandbox utils task skill permissions models (67 to 53 warnings)
df5af41 chore(eslint) batch2 drop unused imports and rename unused args in chat openclaw hermes learning (81 to 67 warnings)
278e0cb chore(eslint) batch1 drop unused imports across electron core (93 to 81 warnings)
fff4926 chore(eslint) drop eslintignore + caughtErrors pattern (104 to 93 warnings)
479899a fix(models) lint cleanup baseUrl check plus add provider field on submit
```

外加 Fix-1/2 通过 `git checkout -- dist-electron/main.js dist-electron/preload.js tsconfig.json` 撤销 Phase 1 subagent 未提交的 working tree 改动。

---

## 验证结果(主会话兜底)

| 验证 | 结果 |
|------|------|
| `npm run lint` | ✅ exit 0,**0 errors / 0 warnings** |
| `npx tsc --noEmit -p tsconfig.node.json` | ✅ exit 0,0 lines |
| `npx vitest run --reporter=dot` | ✅ **192/192 passed**(22 test files) |
| `npx playwright test --list` | ✅ **20 tests in 10 files** |
| `git status --short` | ✅ clean |
| `npx vue-tsc --noEmit` | ⚠️ **52 errors**(留 Phase 2) |

---

## 修复策略详解

### Fix-1/2/3: 撤销 + 提交 Phase 1 subagent 留下的 dirty
- Phase 1 subagent 在 working tree 改了 `dist-electron/main.js` + `dist-electron/preload.js` + `tsconfig.json`(`strict: false` 降级)+ `Models.vue`(lint-fix),但只 commit 了 `Models.vue` 部分 lint-fix(commit `5f92095`)+ `shims.d.ts`(commit `2b63b0d`)
- working tree 残留的 3 个文件改动用 `git checkout --` + 单独 commit Models.vue 完整 lint-fix(commit `479899a`)
- **关键发现**:tsconfig.json `strict: false` 改动**没 commit**(只 working tree dirty),`git checkout` 等于恢复 git HEAD 的 `strict: true` — 不需要再做 strict 恢复

### Fix-4 batch 1: electron/core/ + main.ts + preload.ts + browser/
- 删除未用 imports:`ExecutionMode` / `EXECUTION_MODE_CONFIGS` / `Task` / `GlobalShortcut` / `Scheduler` / `ParsedInstruction` / `ExecutionModeConfig` / `ExecutionPlan` / `* as fs` / `* as path`
- 重命名未用 args 为 `_args`:`params` / `riskLevel`

### Fix-4 batch 2: chat/agent/openclaw/hermes/learning
- 删除未用 imports:`ipcMain` / `OpenClawGateway` / `OpenClawOperationStatus` / `randomUUID`
- 重构 `let resultData` 为 `const`(用 IIFE inline)
- 删 unused const block:`const experienceMemory =` / `const buffer = await screenshot()` / `let guidance` block
- 重命名 args 为 `_argName`:`traceId` / `settings` / `operationType` / `result` / `fingerprint`

### Fix-4 batch 3: sandbox/utils/task/skill/permissions/models
- 删除未用 imports:`randomUUID` / `ChatMessage` / `app` / `SkillParameter` / `PermissionCategory` / `PROVIDER_DEFAULTS`
- 删除 unused errorMsg block(13 行代码)
- 重命名 args:`containerPort` / `config` / `parameters` / `perm`

### Fix-4 batch 4: src/components/
- 删除未用 Element Plus icons:`HomeFilled` / `ChatDotRound` / `Box` / `Setting` / `ElMessage` / `ElMessageBox` / `computed` / `watch`
- Vue 3 auto-prop 解构:`const props = defineProps<{...}>()` → `defineProps<{...}>()`

### Fix-4 batch 5: src/stores/
- 删除未用 ref:`previousId` / `complexity` / `permissionsStore`
- 重命名未用 args:`getModelForMessage(content, hasAttachments)` → `(_content, _hasAttachments)`(签名不变)

### Fix-4 batch 6: src/views/ + preload.ts
- 删除未用 icons:`Setting` / `ArrowDown` / `Download` / `ChatLineSquare` / `Edit` / `MagicStick` / `Tools` / `Plus` / `Upload` / `ElNotification` / `ref` / `useRouter` / `router`
- 删除未用 ref / function:
  - Chat.vue:`expandedTaskResults` / `debugInfo` / `toggleTaskResult` / `currentPermissionSetId` / `getSetIcon` / `handlePermissionSetChange` / `handleEditAndResend` / `handleExport` / `handleExecutionModeChange` / `handleTestDetection` / `handleOpenDevTools` / `handleStop`
  - Dashboard.vue:`router` / `ref`
  - Settings.vue:`handleSyncOllama`
  - Models.vue template:`(model, index)` → `model`(删 unused index)
- 删除 preload.ts 未用 interface `ExecutionPlanStep`(13 行)

---

## 决策记录

### Fix-1/2 撤销 dirty files
Phase 1 subagent 留下的 4 个 dirty 状态文件,如果直接 commit 会有两个问题:
1. `dist-electron/*.js` 是 build artifact,不应 commit(已经被 gitignore 预期)
2. `tsconfig.json` 把 `strict: true` 改 `false` 是降级质量,违反工程化目标

`git checkout` 撤销 working tree 改动(因为没 commit),等于恢复 HEAD 状态。Models.vue 的 lint-fix 改动单独 commit,因为它有价值。

### Fix-4 batch 拆分
按目录分 6 batch,每个 batch 改完跑全套验证( lint + tsc + vitest )后 commit。这样:
- 单 commit 风险小,易 revert
- 验证失败只影响一个 batch,易定位
- git log 显示清晰的演进

### 删未用 function / interface 不补"修复"代码
大量 function / interface 是开发过程遗留的"为未来用"代码,但模板没绑、store 没调用。**删 unused 比保留注释更干净**:
- 例:`handleTestDetection` 是开发者自用的 debug 工具,删
- 例:`ExecutionPlanStep` 是为未来 ExecutionPlan 功能预留的 type,删(连同 ExecutionPlan 接口一起)

如果未来真需要这些功能,从 git 历史恢复比维护 dead code 好。

### Vue 3 `<script setup>` auto-prop 解构
不需要 `const props = defineProps<>()` 解包,Vue 编译器自动在 template 暴露 `defineProps` 的字段。所以 `const props = ...` 然后 template 用 `props.x` 也可以,但更地道是直接 `defineProps<>()` + template 用 `x`。**Phase 1 修 lint 优先级大于风格统一**,只删 unused,不动用 props 的地方。

---

## 遇到的问题 / 偏差

### subagent 中断
Phase 1 subagent 在 Batch 5 中途被中断,实际完成 Batch 1-4(93→39),剩 Batch 5/6 由主会话接管继续完成(39→0)。

### 误判 warning 位置
Chat.vue 看到 `ExecutionPlanStep` 出现在 line 452,实际是 `electron/preload.ts:452`(vue-tsc 错误的 lint 错位显示)。修了 Chat.vue 没效,最后在 preload.ts 找到真正的未用 interface。

### SearchReplace 字符匹配
`SearchReplace` 工具对 `Setting, Promotion` 等 import 行第一次没生效(可能因 lint 缓存或字符)。再读一次再编辑就生效。

### PowerShell `&&` 不支持
多次用 `cd dir && cmd` 失败,改用 `;` 串联或拆分。

### `head` / `wc` 不存在
改用 PowerShell `Measure-Object` 和 `Get-Content`。

---

## 不在 Phase 1 修复范围(留给 Phase 2/3)

### Phase 2 — vue-tsc 0 错(52 errors)
需要修的真实代码问题:
- `src/views/Chat.vue` (20 errors):`executingTask` / `currentTaskResult` / `isGenerating` / `skipped` 不在 TaskStep / MessageStatus 等
- `src/stores/app.ts` (8 errors):`window` config 上 `data` / `config` / `env` 属性缺失(electronAPI 类型不完整)
- `src/views/Permissions.vue` (4 errors):类型定义窄化
- `src/components/settings/McpServerFormDialog.vue` (3 errors):`FormInstance` / `FormRules` 应该从 element-plus 拿不是 vue
- `src/views/LlmConfig.vue` (3 errors):provider fallback 流程类型推断窄
- ... 其他 10+ 文件 1-2 个错

**Phase 2 plan 必须先做**:补 stores / types / API contract,然后 vue-tsc 0 错,然后 CI 升级 `vue-tsc --noEmit` 为 hard-fail

### Phase 3 — i18n / 安全加密 / coverage
- 安全:`LlmConfigStore` 的 apiKey 应该用 Electron safeStorage 加密
- i18n:`src/locales/` 已存在但 Vue 页面大多硬编码中文
- coverage:CI 加 `@vitest/coverage-v8` 目标 > 70%

### Phase 4 — 真 e2e CI + D2Prime 部署 + auto-update
- CI 上的 e2e 是 soft-fail,需要真 docker 跑
- D2Prime 真实部署 30s 端到端验证
- electron-builder auto-update channel

---

## 给后续 subagent 的提醒

- **`git status --short` 必须 0** before commit,working tree 干净是基本盘
- **`SearchReplace` 失败时 Read 后再试** — 字符匹配不总是 silent,有时需重读最新内容
- **vue-tsc 错的"行号"可能错位**,看到 line 452 报错要 grep 真实文件位置
- **`dist-electron/*.js` 不应 commit**,build artifact 已经被 .gitignore,working tree dirty 时 `git checkout --` 即可
- **CI 注释明确标注 soft-fail Phase X**,Phase 1/2/3/4 状态要在 CI yml 写清楚
- **删 unused function 比保留 + 注释更干净**,从 git history 找比维护 dead code 易