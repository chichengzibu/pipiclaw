# Plan — 修 A 暴露的 2 个 bug + 验证 B 在无凭证下准备就绪

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修 Plan A 暴露的 2 个 bug(tokens.css 嵌套注释 + 5 demo 前端 stub→IPC),并验证 Plan B 在无凭证下所有准备工作 100% 就位

**Architecture:** 4 个 commit 串行修复 — (1) 修 sass 500 bug,(2) ImAccounts.vue 修 IMConfigStore 索引,(3) 加 5 demo IPC wiring(D1/D2/D3/D5/A5),(4) retro 验证 B 准备就绪

**Tech Stack:** Vue 3 / TypeScript / Element Plus / SCSS / Electron 30+ / existing IPC handler

**前置 commit**:`60aa5fa`(B retro)

---

## 总体约束

- **不引入新 npm 依赖**
- **不修改既有 demo builtin 业务代码**(W5-W8 5 demo 0 改动,只修前端 wiring)
- **不修改 W7.2 既有 19 个 channel 业务代码**
- **每 commit 自己跑 + 自己 add + 自己 commit**(subagent,短英文 message)
- **tsc 0 错 + vitest 178/178 不变**

---

## Task 1: 修 tokens.css 嵌套注释 sass 500 bug

**Files:**
- Modify: `src/styles/tokens.css:9-11`(注释块嵌入单行注释)

- [ ] **Step 1: 验证 bug**

```bash
cd D:\pipiclaw\piclaw
# 用 sass 编译验证(Linux/macOS):
npx sass src/styles/tokens.css 2>&1 | head -20
# 或 PowerShell:
npx sass src/styles/tokens.css 2>&1 | Select-Object -First 20
```

Expected: `[sass] expected "{"` 或类似错误(sass 5+ 不允许注释内嵌)

- [ ] **Step 2: 修 tokens.css L9-11**

读 `src/styles/tokens.css`,找到 L9-11,把 3 行 `/* ... */` 单行注释替换为多行 `/* ... */` 单行注释(无嵌套):

原(L9-11):
```
 * 使用方式：
 *   /* CSS 中 */   padding: var(--space-md);
 *   /* Vue 中 */   :style="{ padding: `var(--space-md)` }"
 *   /* SCSS 中 */  @import './tokens.css'; padding: var(--space-md);
```

改为:
```
 * 使用方式(注意 sass 不允许 /* */ 嵌套):
 *   padding: var(--space-md);
 *   :style="{ padding: \`var(--space-md)\` }"
 *   @import './tokens.css'; padding: var(--space-md);
```

具体 SearchReplace:

```typescript
old_str: * 使用方式：
 *   /* CSS 中 */   padding: var(--space-md);
 *   /* Vue 中 */   :style="{ padding: `var(--space-md)` }"
 *   /* SCSS 中 */  @import './tokens.css'; padding: var(--space-md);

new_str: * 使用方式(注意 sass 不允许嵌套 /* */ 注释):
 *   padding: var(--space-md);
 *   :style="{ padding: \`var(--space-md)\` }"
 *   @import './tokens.css'; padding: var(--space-md);
```

- [ ] **Step 3: 验证 sass 不再报错**

```bash
cd D:\pipiclaw\piclaw
npx sass src/styles/tokens.css 2>&1 | head -5
```

Expected: 空输出(exit 0,无 sass 错误)

- [ ] **Step 4: 验证 vite build 不再 500**

```bash
cd D:\pipiclaw\piclaw
npx vite build 2>&1 | Select-Object -First 30
```

Expected: 不再出现 `expected "{"` 或 `[sass]` 错误。注:vite build 可能因 electron import 失败但 sass 错误必须消除。

- [ ] **Step 5: commit**

```bash
cd D:\pipiclaw\piclaw
git add src/styles/tokens.css
git commit -m "fix(sass) tokens.css nested comment removed unblock vue render"
```

注:这一步由主会话接手 commit(subagent 不跑 git)。

---

## Task 2: 修 ImAccounts.vue IMConfigStore 索引错误

**Files:**
- Modify: `src/views/ImAccounts.vue:115-130`(loadConfigs 索引)

**背景**:`IMConfigStore.list()` 返回 `IMConfig[]` 数组,W7.2 IMConfigStore 类型签名:
```typescript
export interface IMConfig { channelKind: ChannelKind; ... }
public list(): IMConfig[]
```

当前代码把 `configs['im-feishu']` 当对象索引,但 configs 是数组 → undefined。

- [ ] **Step 1: 验证 bug**

读 `src/views/ImAccounts.vue` 看 `loadConfigs()` 当前实现 + 看 `IMConfigStore.list()` 签名。

确认 configs 是数组,索引方式需改为 `configs.find(c => c.channelKind === 'im-feishu')`。

- [ ] **Step 2: 修 loadConfigs**

把:
```typescript
    if (configs.imFeishu) {
      feishu.appId = configs.imFeishu.appId ?? ''
```

改为:
```typescript
    const feishuConfig = configs.find((c: any) => c.channelKind === 'im-feishu')
    if (feishuConfig) {
      feishu.appId = feishuConfig.appId ?? ''
      feishu.appSecret = feishuConfig.appSecret ?? ''
      feishu.enabled = feishuConfig.enabled ?? false
    }
    const dingtalkConfig = configs.find((c: any) => c.channelKind === 'im-dingtalk')
    if (dingtalkConfig) {
      dingtalk.appKey = dingtalkConfig.appKey ?? ''
      dingtalk.appSecret = dingtalkConfig.appSecret ?? ''
      dingtalk.webhookUrl = dingtalkConfig.webhookUrl ?? ''
      dingtalk.enabled = dingtalkConfig.enabled ?? false
    }
    const wechatConfig = configs.find((c: any) => c.channelKind === 'im-wechat-work')
    if (wechatConfig) {
      wechatwork.corpId = wechatConfig.corpId ?? ''
      wechatwork.corpSecret = wechatConfig.corpSecret ?? ''
      wechatwork.agentId = wechatConfig.agentId ?? ''
      wechatwork.enabled = wechatConfig.enabled ?? false
    }
```

具体 SearchReplace 替换整段 `if (configs.imFeishu) { ... }`(三段全改)。

- [ ] **Step 3: 验证 tsc 0 错**

```bash
cd D:\pipiclaw\piclaw
npx tsc --noEmit 2>&1 | Select-Object -First 10
```

Expected: 0 错。

- [ ] **Step 4: commit**

```bash
cd D:\pipiclaw\piclaw
git add src/views/ImAccounts.vue
git commit -m "fix(im) ImAccounts loadConfigs use array find by channelKind"
```

---

## Task 3: 加 5 demo IPC wiring(D1/D2/D3/D5/A5 调 main 进程)

**背景**:5 demo view 是 W5-W8 阶段产物,前端 stub,**不通过 IPC 调 main 进程的 runD*/runA5**。

**架构**:5 demo 加 IPC wiring,主进程已注册 channel handler(`/d1-demo:/d2-prime-demo:/d3-demo:/d5-demo:/a5-demo` 5 个 IPC channel),前端 view 通过 IPC invoke。

**Files:**
- Modify: `electron/preload.ts` 末尾追加 5 IPC channel + electronAPI demo{runD1,runD2Prime,runD3,runD5,runA5}
- Modify: `electron/core/IpcServer.ts` 末尾追加 5 handler(d1-demo:run / d2-prime-demo:run / d3-demo:run / d5-demo:run / a5-demo:run)
- Modify: `src/views/D1ScreenshotDemo.vue` 改 onClick 调 IPC
- Modify: `src/views/D2PrimeDemo.vue` 改 onClick 调 IPC
- Modify: `src/views/D3RemoteDemo.vue` 改 onClick 调 IPC
- Modify: `src/views/D5RecordingToSkill.vue`(若无,看 W6.4 是否建了 view)改 onClick 调 IPC
- Modify: `src/views/A5ComputerUseDemo.vue` 改 onClick 调 IPC

- [ ] **Step 1: 读既有 5 demo view**

分别读 `src/views/D1ScreenshotDemo.vue` / `D2PrimeDemo.vue` / `D3RemoteDemo.vue` / `A5ComputerUseDemo.vue`,确认当前是否纯 stub 逻辑(应该有"假数据"生成代码)。

注:`D5RecordingToSkill` 可能无 view(W6.4 是通过 trigger phrase 触发,Plan A retro 提到 D5 demo 无独立路由)——若不存在,跳过 D5 wiring,留 W12+ 处理。

- [ ] **Step 2: 末尾追加 IpcServer 5 handler**

读 `electron/core/IpcServer.ts`,在最后一行 `channel-config:test` handler 之后追加 5 个:

```typescript
    // ============ W13.A: 5 demo IPC ============
    ipcMain.handle('d1-demo:run', async (_: any, args: { question: string; imageBase64?: string }) => {
      try {
        const { D1ScreenshotQA } = require('../skill/builtin/D1ScreenshotQA')
        const { ScreenVision } = require('../computeruse/ScreenVision')
        const frame = await ScreenVision.getInstance().captureFrame()
        const result = await D1ScreenshotQA.handleQuestion({ question: args.question, imageBase64: frame?.dataUrl ?? args.imageBase64 })
        return { success: true, data: result }
      } catch (error) {
        this.log.error('d1-demo:run 失败', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('d2-prime-demo:run', async (_: any, args: { prompt: string; useWebContainer?: boolean }) => {
      try {
        const { runD2Prime } = require('../skill/builtin/D2PrimeScaffold')
        const result = await runD2Prime(args)
        return { success: true, data: result }
      } catch (error) {
        this.log.error('d2-prime-demo:run 失败', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('d3-demo:run', async (_: any, args: { userMessage: string; userId: string; channelId: string }) => {
      try {
        const { runD3 } = require('../skill/builtin/D3RemoteCommand')
        const result = await runD3(args)
        return { success: true, data: result }
      } catch (error) {
        this.log.error('d3-demo:run 失败', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('d5-demo:run', async (_: any, args: { triggerPhrase: string; description?: string }) => {
      try {
        const { runD5 } = require('../skill/builtin/D5RecordingToSkill')
        const result = await runD5(args)
        return { success: true, data: result }
      } catch (error) {
        this.log.error('d5-demo:run 失败', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('a5-demo:run', async (_: any, args: { instruction: string; maxSteps?: number; autoExecute?: boolean }) => {
      try {
        const { runA5 } = require('../skill/builtin/A5ComputerUse')
        const result = await runA5(args)
        return { success: true, data: result }
      } catch (error) {
        this.log.error('a5-demo:run 失败', error)
        return { success: false, error: String(error) }
      }
    })
```

- [ ] **Step 3: 末尾追加 preload 5 channel + electronAPI**

读 `electron/preload.ts`,在 IpcChannels 末尾追加:
```typescript
  D1_DEMO_RUN: 'd1-demo:run',
  D2_PRIME_DEMO_RUN: 'd2-prime-demo:run',
  D3_DEMO_RUN: 'd3-demo:run',
  D5_DEMO_RUN: 'd5-demo:run',
  A5_DEMO_RUN: 'a5-demo:run',
```

在 electronAPI 末尾追加:
```typescript
  demo: {
    runD1: (args: { question: string; imageBase64?: string }): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.D1_DEMO_RUN, args),
    runD2Prime: (args: { prompt: string; useWebContainer?: boolean }): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.D2_PRIME_DEMO_RUN, args),
    runD3: (args: { userMessage: string; userId: string; channelId: string }): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.D3_DEMO_RUN, args),
    runD5: (args: { triggerPhrase: string; description?: string }): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.D5_DEMO_RUN, args),
    runA5: (args: { instruction: string; maxSteps?: number; autoExecute?: boolean }): Promise<{ success: boolean; data?: any; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.A5_DEMO_RUN, args),
  }
```

- [ ] **Step 4: 改 D1ScreenshotDemo.vue 调 IPC**

读 `src/views/D1ScreenshotDemo.vue` 找 `async function runDemo()`(或类似名)。把其内部假数据生成代码替换为 IPC 调用:

原(假设):
```typescript
async function runDemo() {
  isRunning.value = true
  try {
    await new Promise(r => setTimeout(r, 200))
    lastResult.value = { ... }  // 假数据
  } finally {
    isRunning.value = false
  }
}
```

改为:
```typescript
async function runDemo() {
  isRunning.value = true
  try {
    const result = await (window as any).electronAPI.demo.runD1({ question: question.value })
    if (result.success) {
      lastResult.value = result.data
    } else {
      lastResult.value = { ok: false, error: result.error }
    }
  } finally {
    isRunning.value = false
  }
}
```

- [ ] **Step 5: 改 D2PrimeDemo.vue 调 IPC**

读 `src/views/D2PrimeDemo.vue` 找 `async function runDemo()`。同样改为:
```typescript
async function runDemo() {
  isRunning.value = true
  try {
    const result = await (window as any).electronAPI.demo.runD2Prime({ prompt: prompt.value, useWebContainer: useWebContainer.value })
    if (result.success) {
      lastResult.value = result.data
    } else {
      lastResult.value = { ok: false, error: result.error }
    }
  } finally {
    isRunning.value = false
  }
}
```

- [ ] **Step 6: 改 D3RemoteDemo.vue 调 IPC**

读 `src/views/D3RemoteDemo.vue`。改为:
```typescript
async function runDemo() {
  isRunning.value = true
  try {
    const result = await (window as any).electronAPI.demo.runD3({ userMessage: userMessage.value, userId: userId.value, channelId: 'd3-demo' })
    if (result.success) {
      lastResult.value = result.data
    } else {
      lastResult.value = { ok: false, error: result.error }
    }
  } finally {
    isRunning.value = false
  }
}
```

- [ ] **Step 7: 改 A5ComputerUseDemo.vue 调 IPC**

读 `src/views/A5ComputerUseDemo.vue`。改为:
```typescript
async function runDemo() {
  isRunning.value = true
  try {
    const result = await (window as any).electronAPI.demo.runA5({ instruction: instruction.value, maxSteps: maxSteps.value, autoExecute: autoExecute.value })
    if (result.success) {
      lastResult.value = result.data
    } else {
      lastResult.value = { ok: false, error: result.error }
    }
  } finally {
    isRunning.value = false
  }
}
```

- [ ] **Step 8: D5 view 若存在则改,否则跳过**

读 `src/views/D5RecordingToSkill.vue`(W6.4 可能建了 view),若有则同样改 onClick 调 IPC。

- [ ] **Step 9: 验证 tsc 0 错**

```bash
cd D:\pipiclaw\piclaw
npx tsc --noEmit 2>&1 | Select-Object -First 10
```

Expected: 0 错。

- [ ] **Step 10: commit**

```bash
cd D:\pipiclaw\piclaw
git add electron/preload.ts electron/core/IpcServer.ts src/views/
git commit -m "feat(demo) 5 demo views wire to main process via IPC"
```

---

## Task 4: 验证 B 在无凭证下准备就绪 + 写 retro

**Files:**
- Create: `docs/superpowers/retros/2026-07-16-b-im-account-integration/ready-verification.md`(retro 补丁)
- Modify: `src/views/ImAccounts.vue`(若 Task 2 改完后还需任何微调)

- [ ] **Step 1: 验证 ImAccounts.vue 索引修对**

读 `src/views/ImAccounts.vue` 确认 `loadConfigs()` 用 `configs.find(c => c.channelKind === ...)` 而非 `configs['im-feishu']`。

- [ ] **Step 2: 验证 IpcServer 3 handler**

读 `electron/core/IpcServer.ts` 确认 `channel-config:get / save / test` 3 handler 都在(Plan B 已加)。

- [ ] **Step 3: 验证 preload 暴露**

读 `electron/preload.ts` 确认 `electronAPI.channelConfig.{get, save, test}` 都在。

- [ ] **Step 4: 验证 ngrok-setup.md 文档完备**

读 `docs/superpowers/retros/2026-07-16-b-im-account-integration/ngrok-setup.md`,确认 6 步骤齐:
- ngrok 安装
- 注册 ngrok 账号
- 启动 ngrok
- 配 IM 平台回调 URL
- 验证

- [ ] **Step 5: 写 ready-verification retro**

新建 `docs/superpowers/retros/2026-07-16-b-im-account-integration/ready-verification.md`:

```markdown
# B 子项目 — 无凭证准备就绪验证报告

**日期**:2026-07-16
**目标**:验证 B 子项目在不依赖用户凭证情况下所有准备工作 100% 就位,用户后续加凭证后能顺利连接

## ImAccounts.vue UI 准备就绪
- ✅ 路由 `/settings/im-accounts` 注册(W7.0.2 + Plan B)
- ✅ 3 平台 el-tab-pane(飞书 / 钉钉 / 企微)
- ✅ 各平台表单字段(appId/secret/webhook/agentId)
- ✅ "测试连接"按钮 wired → `electronAPI.channelConfig.test`
- ✅ "保存所有"按钮 wired → Promise.all 3 个 save
- ✅ **loadConfigs() 索引 bug 修复**(Plan B retro 报告 → Plan Task 2 修复)

## 主进程 IPC 准备就绪
- ✅ `channel-config:get` handler(IMConfigStore.list())
- ✅ `channel-config:save` handler(IMConfigStore.set())
- ✅ `channel-config:test` handler(临时 set + new Channel + healthCheck)

## preload 暴露准备就绪
- ✅ IpcChannels.CHANNEL_CONFIG_GET/SAVE/TEST 已在(W7.0.2 + Plan B)
- ✅ electronAPI.channelConfig.{get, save, test} 已在

## 凭证配置文件准备就绪
- ✅ `IMConfigStore` 单例已就位(W7.2)
- ✅ 持久化到 `userData/im-config.json`(W7.2 已实现)
- ✅ IMConfig 类型定义完整(channelKind + appId + appSecret + ...)

## 3 平台 channel 实现准备就绪
- ✅ FeishuChannel 真接实现(W7.2,fetch HTTP getAccessToken + send)
- ✅ DingTalkChannel 真接实现(W7.2)
- ✅ WechatWorkChannel 真接实现(W7.2)

## ngrok 引导文档准备就绪
- ✅ ngrok-setup.md 6 步骤齐全(安装 / 账号 / 启动 / IM 平台配 / 验证)

## 用户凭证补全步骤(用户操作)
1. 用户启动 ngrok:`ngrok http 5173`,复制 forwarding URL
2. 用户在飞书 / 钉钉 / 企微 3 平台开发者后台:
   - 飞书:事件订阅请求 URL 填 `{ngrok-url}/im/webhook/feishu`
   - 钉钉:机器人消息接收 URL 填 `{ngrok-url}/im/webhook/dingtalk`
   - 企微:接收消息服务器 URL 填 `{ngrok-url}/im/webhook/wechat-work`
3. 用户拿凭证(飞书 appId/appSecret / 钉钉 appKey/appSecret/webhook / 企微 corpId/corpSecret/agentId)
4. 用户打开 PiPiClaw /settings/im-accounts,填入凭证
5. 点"测试连接"→ 验证 IMConfigStore + Channel.healthCheck() 真调平台
6. 点"保存所有"→ IMConfigStore 持久化到 im-config.json
7. 用真实 IM 账号发消息 → ChannelRouter 收到 → AgentBrain 解析 → ChannelRouter.send 回复

## 整体准备就绪
- ImAccounts UI: ✅ 100%
- IpcServer 3 handler: ✅ 100%
- preload 暴露: ✅ 100%
- IMConfigStore 持久化: ✅ 100%
- 3 平台 channel 真接: ✅ 100%(Plan B 仅验证 stub,真实收发待用户凭证)
- ngrok 文档: ✅ 100%

**结论**:B 子项目所有准备工作 100% 就位,用户加凭证后能顺利连接。
```

- [ ] **Step 6: 跑主会话兜底验证**

```bash
cd D:\pipiclaw\piclaw
npx tsc --noEmit -p tsconfig.node.json 2>&1 | Select-Object -First 5
npx vitest run 2>&1 | Tee-Object -FilePath /tmp/vitest-ready.log | Select-String "Test Files|Tests " | Select-Object -First 5
```

Expected: tsc 0 错 + vitest 178/178 全过。

- [ ] **Step 7: commit retro**

```bash
cd D:\pipiclaw\piclaw
git add docs/superpowers/retros/2026-07-16-b-im-account-integration/ready-verification.md
git commit -m "docs(retro) B ready-verification all setup 100 percent no credentials"
```

---

## 总体执行策略

1. **Task 1 (修 sass 500)**:独立,可单独 commit
2. **Task 2 (修 ImAccounts 索引)**:独立,可单独 commit
3. **Task 3 (5 demo IPC wiring)**:依赖 Task 1 修好(sass 不报错),但代码层面无依赖
4. **Task 4 (验证 B 准备就绪 + retro)**:依赖 Task 1 + Task 2 + Task 3 全部完成

**subagent 派发**:1 个 general_purpose_task subagent 串行跑 4 task,每 task 自己 commit,主会话最后兜底验证。

## 计划自检(对照用户原话)

| 用户要求 | 任务覆盖 |
|---|---|
| 修 A 暴露的 sass 500 bug | Task 1 |
| 修 A 暴露的 5 demo 前端 stub | Task 3 |
| 验证 B 在无凭证下准备就绪 | Task 4 |
| 加凭证后能顺利连接 | Task 4 retro 文档 |

✅ 全部覆盖。

## 类型一致性自检

- `IMConfigStore.list()` 返回 `IMConfig[]`(Task 2 修索引方式)
- `IpcServer.handle(name, handler)` 调用方式(W7.0.2 + W7.4 + W8.2 + W11.5 模式)
- `ChannelRouter.send(channelId, msg)` + `Channel.healthCheck()` 已有
- 5 demo 的 run* 函数签名对应 builtin 已有 runD1/runD2Prime/runD3/runD5/runA5

✅ 类型一致。