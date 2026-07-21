# Phase 2 — Vue-TSC 0 错 + CI Hard-Fail

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修 52 个 vue-tsc 类型错误 + 升级 CI 让 `vue-tsc --noEmit` 从 soft-fail 变为 hard-fail + 添加 tsconfig 完整 strict 配置。

**Architecture:**
- 用 systematic-debugging 分析每个错的根因,分批修
- 7 个 batch 按文件聚类(避免跨文件 import 链冲突)
- 每个 batch 单独 commit,跑全套验证
- 最后改 `.github/workflows/ci.yml` 把 vue-tsc 升 hard-fail
- 最后写 retro + plan-update 文档

**Tech Stack:** TypeScript strict + vue-tsc + ESLint + Pinia + Element Plus + Vue 3

---

## 现状(Before)

| 项目 | 状态 |
|------|------|
| `vue-tsc --noEmit` | ❌ 52 errors(15 个文件) |
| CI `vue-tsc --noEmit` | soft-fail (Phase 2 follow-up 标记) |
| 单元测试 | 192/192 ✅ |
| ESLint | 0 errors / 0 warnings ✅ |
| `tsc -p tsconfig.node.json` | ✅ exit 0 |
| `git status` | clean ✅ |

## 错分布(优先修大文件)

```
20 src/views/Chat.vue              ← 最大头
 8 src/stores/app.ts               ← window.electronAPI 类型不全
 4 src/views/Permissions.vue
 3 src/components/settings/McpServerFormDialog.vue  ← FormInstance/FormRules 路径错
 3 src/views/LlmConfig.vue
 2 src/views/SkillMarket.vue       ← types/skill.d.ts 不在 tsconfig include
 2 src/views/Settings.vue
 2 src/components/settings/McpServerCard.vue
 2 src/stores/modelRouter.ts
 1 src/views/Schedule.vue
 1 src/components/chat/TaskResultCard.vue
 1 src/components/common/GatewayStatusBadge.vue
 1 src/stores/chat.ts
 1 src/stores/openclaw.ts
 1 src/components/schedule/CronPicker.vue
```

---

## 任务分组(7 个 batch + 升级 CI + 文档)

**总 commit 数:** 9

### Task 1: 修 tsconfig — 把 types/ 加入 include(影响 Skill 类型推断)

**Files:**
- Modify: `tsconfig.json:23`
- Test: `npx vue-tsc --noEmit 2>&1 | Measure-Object -Line`

- [ ] **Step 1.1: 修改 tsconfig.json include**

```json
"include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue", "types/**/*.d.ts"],
```

- [ ] **Step 1.2: 验证 vue-tsc 错数减少**

```bash
npx vue-tsc --noEmit 2>&1 | Tee-Object vue-tsc-current.txt
Get-Content vue-tsc-current.txt | Where-Object { $_ -match 'error TS' } | Measure-Object -Line
```

预期:**SkillMarket.vue 从 3 错 → 1 错**(其他 2 错是 types 引出来的相关)。

- [ ] **Step 1.3: 全套验证**

```bash
npm run lint && npx tsc --noEmit -p tsconfig.node.json && npx vitest run --reporter=dot 2>&1 | tail -5
```

必须:lint 0 / tsc 0 / vitest 192。

- [ ] **Step 1.4: Commit**

```bash
git add tsconfig.json
git commit -m "fix(tsconfig) include types/**/*.d.ts for Skill type inference"
```

---

### Task 2: 修 src/stores/app.ts(8 错) — window.electronAPI 类型补全

**Files:**
- Modify: `electron/preload.ts:window.electronAPI` 接口定义
- Modify: `src/stores/app.ts:64-161`

- [ ] **Step 2.1: 调查 8 个错的根因**

```bash
Get-Content vue-tsc-errors.txt | Where-Object { $_ -match 'src/stores/app.ts' }
```

错列表(来自前面 retro):
- L64,65: `data` 不存在 type `string` — config.llm.config 返回 string 而不是结构
- L72,82,138,161: `config` 不存在 type `{ window, app }` — config 全局不在 electronAPI
- L89: `env` 不存在 `ImportMeta` — `import.meta.env` 不识别
- L138: `err` 隐式 any — catch 块参数

- [ ] **Step 2.2: 在 preload.ts 补 config / data / env 类型**

在 `electron/preload.ts` 找到 `window.electronAPI` interface 定义,补:
- `config: { get/set llm config: any; get/set ui config: any; get/set defaultModel config: any; }`
- 在 `window.electronAPI.app` 或 root 加 `config` namespace

具体代码参考 `electron/preload.ts` 实际的 `__api.config` 部分,补齐 type 字段。

- [ ] **Step 2.3: 修 `app.ts:64` `data` 和 `config`**

参考 [app.ts:60-90](file:///D:/pipiclaw/piclaw/src/stores/app.ts#L60-L90) 的代码块,改:
- `await window.electronAPI.config.get('llm')` 改用正确类型链
- `catch (err)` 加 `: unknown` 注解

- [ ] **Step 2.4: 验证**

```bash
npx vue-tsc --noEmit 2>&1 | Where-Object { $_ -match 'src/stores/app.ts' } | Measure-Object -Line
```

预期:从 8 错减到 0。

- [ ] **Step 2.5: 全套验证**

```bash
npm run lint && npx tsc --noEmit -p tsconfig.node.json && npx vitest run --reporter=dot 2>&1 | tail -5
```

- [ ] **Step 2.6: Commit**

```bash
git add electron/preload.ts src/stores/app.ts
git commit -m "fix(electron) complete window.electronAPI config data env types"
```

---

### Task 3: 修 src/stores/{chat,modelRouter,openclaw}.ts(4 错)

**Files:**
- Modify: `src/stores/chat.ts:680` (stopped 不在 MessageStatus)
- Modify: `src/stores/modelRouter.ts:89,100` (connected 不存在 model type)
- Modify: `src/stores/openclaw.ts:310` (resource 不存在 OpenClawOperationRequest)

- [ ] **Step 3.1: 调查**

```bash
Get-Content vue-tsc-errors.txt | Where-Object { $_ -match 'src/stores/(chat|modelRouter|openclaw)' }
```

- [ ] **Step 3.2: 修 chat.ts:680**

```ts
// 把 updateMessage 调用中的 status: 'stopped' 改为 status: 'failed' 或加 MessageStatus 类型 'stopped'
```

参考 [chat.ts:680](file:///D:/pipiclaw/piclaw/src/stores/chat.ts#L680) 实际用法。最简:改 'stopped' → 'error' 或 'failed'(在 MessageStatus union 中存在)。

- [ ] **Step 3.3: 修 modelRouter.ts:89,100**

`connected` 属性不在 `ModelInfo` 类型里。最简:删 `connected` 检查,或加到 type。

参考 [modelRouter.ts:89](file:///D:/pipiclaw/piclaw/src/stores/modelRouter.ts#L89) — 改用 `model.provider` 或 model 自身的 `disabled` 字段判断。

- [ ] **Step 3.4: 修 openclaw.ts:310**

`resource` 不存在 OpenClawOperationRequest 类型。检查调用代码,删 `.resource` 或 type 加 `resource` 字段。

- [ ] **Step 3.5: 验证 + 跑全套**

```bash
npx vue-tsc --noEmit 2>&1 | Where-Object { $_ -match 'src/stores/(chat|modelRouter|openclaw)' } | Measure-Object -Line
npm run lint && npx tsc --noEmit -p tsconfig.node.json && npx vitest run --reporter=dot 2>&1 | tail -5
```

预期:stores 错从 4 → 0。

- [ ] **Step 3.6: Commit**

```bash
git add src/stores/chat.ts src/stores/modelRouter.ts src/stores/openclaw.ts
git commit -m "fix(stores) align message status and operation request type"
```

---

### Task 4: 修 src/stores/chat.ts 类型补全(为 Chat.vue 铺路)

**Files:**
- Modify: `src/stores/chat.ts`(加 executingTask / currentTaskResult / isGenerating / showTaskConfirmDialog / pendingTaskPlan / cancelExecuteTask / confirmExecuteTask / setSearchKeyword 字段/方法)

- [ ] **Step 4.1: 调查 Chat.vue 期望的 chat store 接口**

从 vue-tsc 错得到 Chat.vue 引用的 chat store 字段清单:
- `chatStore.executingTask` (ref boolean)
- `chatStore.currentTaskResult` (ref TaskExecutionResult | null)
- `chatStore.isGenerating` (ref boolean)
- `chatStore.showTaskConfirmDialog` (ref boolean)
- `chatStore.pendingTaskPlan` (ref TaskExecutionPlan | null)
- `chatStore.cancelExecuteTask` (function)
- `chatStore.confirmExecuteTask` (function)
- `chatStore.setSearchKeyword` (function keyword: string)

- [ ] **Step 4.2: 在 chat store 加 8 个字段/方法**

参考已有 store 风格(其他 store 在 src/stores/ 下)。具体字段类型根据 Chat.vue 用法推断。

如果发现这些字段本来就不存在(只是 Chat.vue 写错引用),那么改成:
- 不存在的引用:在 Chat.vue 改用替代字段或加 `_` 前缀不引入
- 应该存在的:在 chat store 加

**重要:** 不要随便加看似不存在的字段,先 grep Chat.vue 全文确认引用点。

```bash
Get-ChildItem src/views/Chat.vue | Select-String "executingTask|currentTaskResult|isGenerating|showTaskConfirmDialog|pendingTaskPlan|cancelExecuteTask|confirmExecuteTask|setSearchKeyword"
```

- [ ] **Step 4.3: 验证**

```bash
npx vue-tsc --noEmit 2>&1 | Where-Object { $_ -match 'src/views/Chat\.vue' } | Measure-Object -Line
```

预期:Chat.vue 错从 20 → 至少减少 8(可能更多)。

- [ ] **Step 4.4: 全套**

```bash
npm run lint && npx tsc --noEmit -p tsconfig.node.json && npx vitest run --reporter=dot 2>&1 | tail -5
```

- [ ] **Step 4.5: Commit**

```bash
git add src/stores/chat.ts
git commit -m "feat(chat-store) add executingTask currentTaskResult isGenerating task confirm fields"
```

---

### Task 5: 修 src/views/Chat.vue 剩余 12 错(TaskStep 类型 + highlight + window API + setSearchKeyword 替代)

**Files:**
- Modify: `src/types/agent.ts`(TaskStep.status 加 'skipped')
- Modify: `src/views/Chat.vue:356,408,731,839,841,1244,1369,1389,1439`

- [ ] **Step 5.1: 调查剩余 12 错**

```bash
Get-Content vue-tsc-errors.txt | Where-Object { $_ -match 'src/views/Chat\.vue' }
```

错性质:
- L356: TaskStep.status 不支持 'skipped' — **type 加 'skipped'**
- L408: status 与 'stopped' 比较无交集 — **改 'stopped' → 'error'**(配合 Task 3)
- L731: `highlight` 不在 `MarkedOptions` — **marked 配置类型错,删 highlight 字段**
- L839,841: `window.electronAPI.task` 不存在 — **task 命名空间在 preload 中改名或 type 补 task**
- L1244: `window.electronAPI.conversation` 不存在 — 同上
- L1369,1439: `string | null` 不能传 string — **加 `?? ''` 或 `!.`**
- L1389: confirmExecuteTask 不存在 — **Task 4 应已加,检查 store**

- [ ] **Step 5.2: 修 TaskStep.status type**

```ts
// src/types/agent.ts 或 src/types/task.ts
export interface TaskStep {
  // ...
  status: 'running' | 'failed' | 'success' | 'pending' | 'skipped';
}
```

- [ ] **Step 5.3: 补 electronAPI task / conversation 类型**

如果 preload.ts 没有 `task` 和 `conversation` namespace,Chat.vue 调用的 `window.electronAPI.task.xxx` 和 `window.electronAPI.conversation.xxx` 应该是 typo,改用真实存在的 namespace:

```bash
Get-ChildItem electron/preload.ts | Select-String "contextBridge\|electronAPI"
```

- [ ] **Step 5.4: 修 marked highlight 配置**

`marked.MarkedOptions` 没有 `highlight` 字段(新版 marked API)。删 Chat.vue:731 的 `highlight:` 配置,或改用 `marked.use({})`。

- [ ] **Step 5.5: 修 string | null → string**

Chat.vue:1369,1439 加 `?? ''` 或 `!.`。

- [ ] **Step 5.6: 验证**

```bash
npx vue-tsc --noEmit 2>&1 | Where-Object { $_ -match 'src/views/Chat\.vue' } | Measure-Object -Line
```

预期:Chat.vue 错从 20 → 0。

- [ ] **Step 5.7: 全套**

```bash
npm run lint && npx tsc --noEmit -p tsconfig.node.json && npx vitest run --reporter=dot 2>&1 | tail -5
```

- [ ] **Step 5.8: Commit**

```bash
git add src/types/ src/views/Chat.vue
git commit -m "fix(types+chat) TaskStep skipped status and window API namespace alignment"
```

---

### Task 6: 修 src/views/{Permissions,Schedule,Settings,SkillMarket,LlmConfig}.vue(14 错)

**Files:**
- Modify: `src/views/Permissions.vue:119,155,169,342`
- Modify: `src/views/Schedule.vue:123`
- Modify: `src/views/Settings.vue:425,429`
- Modify: `src/views/SkillMarket.vue:123,135`
- Modify: `src/views/LlmConfig.vue:136,157,176`

- [ ] **Step 6.1: 调查 14 错**

```bash
Get-Content vue-tsc-errors.txt | Where-Object { $_ -match 'src/views/(Permissions|Schedule|Settings|SkillMarket|LlmConfig)\.vue' }
```

错性质:
- Permissions L119,342: `(val: any)` 和 `(valid: any)` 隐式 any — **加类型注解或断言**
- Permissions L155,169: `handleRemovePath` 不存在 — **在 permissions store 加或在 vue 改用其他方法**
- Schedule L123: `'daily' | 'cron'` 比较无交集 — **改逻辑或加 type**
- Settings L425,429: `string | boolean | undefined` 不赋 boolean — **给默认值**
- SkillMarket L123: `Skill` 不在 `@/stores/skill` — **Task 1 加 types include 应已修**
- SkillMarket L135: `param: any` — **加 `(param: SkillParameter) =>` 类型注解**
- LlmConfig L136,157,176: `window.electronAPI.llmConfig` 不存在 — **llmConfig namespace 在 preload type 补**

- [ ] **Step 6.2: 修 Permissions.vue handleRemovePath**

```bash
Get-ChildItem src/views/Permissions.vue | Select-String "handleRemovePath"
```

确认是 Permissions.vue 的本地函数(还是 store 方法)。如果是 store 方法,改 store 加;如果是本地函数缺失,加函数。

- [ ] **Step 6.3: 修 Schedule.vue**

`type === 'daily' | 'cron'` 比较的字段类型窄,改条件表达式。

- [ ] **Step 6.4: 修 Settings.vue 425,429**

`v-model` 或 prop 传的 value 类型宽,加 `as boolean` 或默认值 `?? false`。

- [ ] **Step 6.5: 修 SkillMarket.vue 135**

```ts
skill.parameters.forEach((param: SkillParameter) => {
  executeParams[param.id] = param.defaultValue;
});
```

- [ ] **Step 6.6: 修 LlmConfig.vue llmConfig namespace**

如果 preload.ts 没有 `llmConfig` 命名空间,补;否则 LlmConfig.vue 改用正确 API。

- [ ] **Step 6.7: 验证**

```bash
npx vue-tsc --noEmit 2>&1 | Where-Object { $_ -match 'src/views/(Permissions|Schedule|Settings|SkillMarket|LlmConfig)\.vue' } | Measure-Object -Line
```

预期:从 14 → 0。

- [ ] **Step 6.8: 全套**

```bash
npm run lint && npx tsc --noEmit -p tsconfig.node.json && npx vitest run --reporter=dot 2>&1 | tail -5
```

- [ ] **Step 6.9: Commit**

```bash
git add src/views/
git commit -m "fix(views) Permissions Schedule Settings SkillMarket LlmConfig type alignment"
```

---

### Task 7: 修 components 5 错(CronPicker / GatewayStatusBadge / TaskResultCard / McpServerCard / McpServerFormDialog)

**Files:**
- Modify: `src/components/schedule/CronPicker.vue:140`
- Modify: `src/components/common/GatewayStatusBadge.vue:22`
- Modify: `src/components/chat/TaskResultCard.vue:47`
- Modify: `src/components/settings/McpServerCard.vue:23`
- Modify: `src/components/settings/McpServerFormDialog.vue:68,171`

- [ ] **Step 7.1: 调查 9 错**

```bash
Get-Content vue-tsc-errors.txt | Where-Object { $_ -match 'src/components/' }
```

错性质:
- CronPicker L140: `reactive` 找不到 — **import 没 reactive**
- GatewayStatusBadge L22: `gateway.status.isStopping` 不存在 — **GatewayStatus type 加 isStopping**
- TaskResultCard L47: `step.duration` 可能是 undefined — **加 `?? 0` 或 narrowing**
- McpServerCard L23: `server.args.length` `server.args` 可能是 undefined — **narrowing**
- McpServerFormDialog L68: `FormInstance` `FormRules` 不在 vue — **改从 element-plus 拿**
- McpServerFormDialog L171: `(valid: any)` — **加类型或 `as any`**

- [ ] **Step 7.2: 修 CronPicker.vue**

```ts
import { ref, reactive } from 'vue';  // 确认 reactive 在 import
```

- [ ] **Step 7.3: 修 GatewayStatusBadge.vue**

```ts
// src/stores/gateway.ts 的 GatewayStatus interface 加 isStopping: boolean
interface GatewayStatus {
  // ...
  isStopping: boolean;
}
```

或者改 Badge.vue 用 `gateway.status.stopping` 等已有字段。

- [ ] **Step 7.4: 修 TaskResultCard.vue**

```ts
const duration = step.duration ?? 0;
```

- [ ] **Step 7.5: 修 McpServerCard.vue 23**

```ts
const args = server.args ?? [];
args.length  // 改用局部 const
```

- [ ] **Step 7.6: 修 McpServerFormDialog.vue 68**

```ts
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
```

- [ ] **Step 7.7: 修 McpServerFormDialog.vue 171**

```ts
async function handleSubmit(formRef: FormInstance | undefined, valid: boolean, fields: any) { ... }
```

或者更准确:`(valid: boolean)` 然后模板用 `submitForm` callback 推断。

- [ ] **Step 7.8: 验证**

```bash
npx vue-tsc --noEmit 2>&1 | Where-Object { $_ -match 'src/components/' } | Measure-Object -Line
```

预期:从 9 → 0(其中 chat/TaskResultCard 占 1, common/GatewayStatusBadge 1, schedule/CronPicker 1, settings/McpServerCard 2, settings/McpServerFormDialog 3)。

- [ ] **Step 7.9: 全套**

```bash
npm run lint && npx tsc --noEmit -p tsconfig.node.json && npx vitest run --reporter=dot 2>&1 | tail -5
```

- [ ] **Step 7.10: Commit**

```bash
git add src/components/
git commit -m "fix(components) CronPicker GatewayStatusBadge TaskResultCard McpServerCard FormDialog types"
```

---

### Task 8: vue-tsc 0 错确认 + CI 升级 hard-fail

**Files:**
- Modify: `.github/workflows/ci.yml`(soft-fail → hard-fail)

- [ ] **Step 8.1: 验证 vue-tsc 0 错**

```bash
npx vue-tsc --noEmit 2>&1 | Where-Object { $_ -match 'error TS' } | Measure-Object -Line
```

预期:**0**。

如果还有错,逐个回溯到上面 Task 1-7 修补。

- [ ] **Step 8.2: 修改 ci.yml**

参考 [.github/workflows/ci.yml](file:///D:/pipiclaw/piclaw/.github/workflows/ci.yml),找到 soft-fail 的 vue-tsc 步骤(应该带 `|| true` 或 `soft-fail` 注释),改成 hard-fail:

```yaml
# 修改前
- name: vue-tsc
  run: npx vue-tsc --noEmit || echo 'soft-fail Phase 2 follow-up'

# 修改后
- name: vue-tsc
  run: npx vue-tsc --noEmit
```

- [ ] **Step 8.3: 删除 soft-fail 注释**

如果 ci.yml 中有 "soft-fail Phase 2" 注释,删除或改为 "Phase 2 complete 2026-07-21"。

- [ ] **Step 8.4: 全套验证**

```bash
npm run lint && npx tsc --noEmit -p tsconfig.node.json && npx vue-tsc --noEmit && npx vitest run --reporter=dot 2>&1 | tail -5
```

必须全部 exit 0。

- [ ] **Step 8.5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(workflow) vue-tsc hard-fail Phase 2 complete"
```

---

### Task 9: Phase 2 retro + plan-update 文档

**Files:**
- Create: `docs/superpowers/retros/2026-07-21-phase2-vue-tsc-zero/retro.md`
- Modify: `docs/superpowers/plans/2026-07-17-phase1-engineering-hygiene.md`(append Phase 2 段落)

- [ ] **Step 9.1: 写 Phase 2 retro**

按 Phase 1 retro 风格:
- TL;DR:9 commit + 52 错 → 0 错
- Commit 链
- 验证结果对比表
- 每个 Task 的修复策略详解
- 决策记录(root cause / 批量修法 / 类型安全)
- 遇到的问题 / 偏差
- 不在 Phase 2 范围(Phase 3/4 待办)

- [ ] **Step 9.2: 更新 Phase 1 plan-update 标记 Phase 2 完成**

```bash
cat >> docs/superpowers/plans/2026-07-17-phase1-engineering-hygiene.md <<EOF

---

## Phase 2 Update — 2026-07-21 vue-tsc 0 错

Phase 2 完成:[链接到 plan](2026-07-21-phase2-vue-tsc-zero-errors.md) + [retro](2026-07-21-phase2-vue-tsc-zero/retro.md)。

- vue-tsc 52 errors → 0 errors
- CI 上 vue-tsc 升级 hard-fail
- 9 commit,所有验证通过

EOF
```

- [ ] **Step 9.3: Commit 文档**

```bash
git add docs/
git commit -m "docs(retro) Phase 2 vue-tsc zero errors + plan update"
```

---

## 验证基线(每个 Task 必须跑)

```bash
# lint
npm run lint

# tsc (node only)
npx tsc --noEmit -p tsconfig.node.json

# vue-tsc (目标 0 错)
npx vue-tsc --noEmit 2>&1 | Where-Object { $_ -match 'error TS' } | Measure-Object -Line

# 单元测试
npx vitest run --reporter=dot 2>&1 | tail -5

# e2e 列表(只列不跑)
npx playwright test --list 2>&1 | tail -2
```

每个 Task commit 前必须全部 exit 0 / 0 errors。

---

## 关键提醒

1. **不要修改历史 commit**(Phase 1 fix `fe9dfa7` 之前所有)
2. **不要改 ESLint config**(已经最优)
3. **不要改 package.json scripts**
4. **每个 Task 单独 commit,跑全套验证**
5. **`vue-tsc-errors.txt` 临时文件不 commit**(.gitignore 已忽略)
6. **Root Cause First**:每个错先 grep 上下文,理解为什么,然后修源头而非表象
7. **Type-safe 加严**:能用 narrowing / 类型注解解决的,不用 `as any`
8. **Type-safe 后退**:实在无法 narrow 才用 `as any` 或 disable 注释

---

## 风险与回退

如果某个 Task 卡住 3 次以上:
- 停止 Task,回到 Plan
- 评估是否拆分 Task
- 或 commit 当前进度 + 标注 follow-up,继续下个 Task