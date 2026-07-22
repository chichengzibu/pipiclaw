# E2E Testing Guide

PiPiClaw 桌面端 (Electron + Vue 3) 的端到端测试指南。

> Phase 4 Task 3 产出,本目录的所有 `tests/e2e/*.spec.ts` 通过 `_electron` API
> 直接驱动 Electron renderer,而不是用 chromium + dev server。

## TL;DR

```bash
# 1. 列出所有 spec(不启动 Electron,只数 spec)
npx playwright test --list

# 2. 跑全部(默认 CI skip 防御性跳过 4 个真实 spec)
npx playwright test

# 3. 本地手动跑真测试(需先 build)
npm run build
E2E_ELECTRON=1 npx playwright test tests/e2e/chat-agent.spec.ts

# 4. 跑所有 active spec
E2E_ELECTRON=1 npx playwright test
```

## 架构选择

| 维度              | 选择                                       | 原因                            |
|------------------|--------------------------------------------|--------------------------------|
| 浏览器/进程       | **Electron 主进程 + Renderer**              | PiPiClaw 是桌面 app,不是 web     |
| 驱动方式          | `@playwright/test._electron.launch`        | Playwright 官方支持 Electron    |
| Config webServer  | 关闭                                       | 不需要 vite dev server          |
| Project           | `electron` 单 project                       | Electron 唯一目标               |
| CI 是否默认跑     | 否                                         | 启动慢 (5–15s),需要 E2E_ELECTRON |
| 并行              | `workers: 1, fullyParallel: false`          | Electron 资源重                 |
| 沙箱              | `--no-sandbox`                              | Windows / Linux CI 容器需要      |

## Spec 分类

### 4 个 Real Spec (需 `E2E_ELECTRON=1`)

| Spec                              | 覆盖                                       | Skip 条件                 |
|-----------------------------------|-------------------------------------------|--------------------------|
| `tests/e2e/chat-agent.spec.ts`     | Chat 入口 / 新建会话 / 输入框挂载          | !E2E_ELECTRON            |
| `tests/e2e/settings-p7.spec.ts`    | 设置页标签 / 主题选择 / 快捷键 / 模型 tab   | !E2E_ELECTRON            |
| `tests/e2e/a5-computer-use.spec.ts`| A5 demo 渲染 / sandbox 运行 / 步骤详情     | !E2E_ELECTRON            |
| `tests/e2e/d2prime-30s.spec.ts`    | D2-Prime 渲染 / 流程卡片 / 30s stub        | !E2E_ELECTRON (主) + E2E_D2_PRIME_30S (benchmark) |

### 7 个 Placeholder Spec (永久 skip)

| Spec                                  | 跳过原因                                | 已有覆盖                                                  |
|---------------------------------------|----------------------------------------|-----------------------------------------------------------|
| `d3-feishu.spec.ts`                    | 需飞书 sandbox bot + ngrok 公网回调     | `tests/integration/channel-to-agent.test.ts`              |
| `insight-trace.spec.ts`                | 需先产生 trace 数据                     | `tests/integration/insight-trace.test.ts`                 |
| `d2prime-docker-missing.spec.ts`       | 需卸载 docker(CI 不可行)               | `tests/unit/DockerDetector.test.ts`                       |
| `d2prime-oom.spec.ts`                  | 需真 OOM trigger(可能卡死真机)         | `tests/unit/ResourceLimits.test.ts`                       |
| `d2prime-port-conflict.spec.ts`        | 占用端口影响其他 dev 进程                | `tests/unit/PortForwarder.test.ts`                        |
| `d2prime-screenshot.spec.ts`           | 依赖 30s+ 真 sandbox 启动                | 与 `d2prime-30s.spec.ts` 重叠,Phase 5 任务                |

所有 placeholder 用 `test.describe.skip(...)` 包装,明确写入跳过原因注释。

## 本地运行步骤

```bash
# 1. 构建(必须,dist-electron/main.js 是 e2e 的入口)
npm run build

# 2. 列出所有 spec
npx playwright test --list

# 3. 单个 spec(推荐先这样)
E2E_ELECTRON=1 npx playwright test tests/e2e/chat-agent.spec.ts

# 4. 全部 active spec
E2E_ELECTRON=1 npx playwright test --project=electron

# 5. UI 模式(debug 用,可选)
E2E_ELECTRON=1 npx playwright test --ui
```

> 第一次跑会下载 Electron 浏览器内核(若 `npx playwright install` 未执行)。

## 环境变量矩阵

| 变量                     | 默认  | 作用                                                       |
|--------------------------|-------|----------------------------------------------------------|
| `E2E_ELECTRON`            | (unset) | 设 `1` 才启动真 Electron;否则 4 个核心 spec skip         |
| `E2E_D2_PRIME_30S`        | (unset) | 设 `1` 才执行 d2prime-30s benchmark spec(很慢)           |
| `LARK_APP_ID/SECRET`     | (unset) | 暂时未挂到 spec,但预留供 D3 飞书 e2e 启用               |
| `CI`                     | (unset) | 走 html 报告输出 + retries=0                              |

## 调试技巧

- **断点 Electron 启动**:在 `tests/e2e/helpers/electron-app.ts` 的 `electron.launch` 后加 `await app.firstWindow()` 之前,可以插入 `await new Promise(r => setTimeout(r, 60000))` 然后手动 attach DevTools。
- **IPC mock**:在 spec 顶部用 `electronApp.evaluate(({ ipcMain }) => ipcMain.handle('config:set', ...))` 替换默认 handler。
- **窗口截图**:`await window.screenshot({ path: 'tests/e2e-report/foo.png' })`,失败自动归档(`retain-on-failure`)。
- **查看 trace**:`npx playwright show-trace tests/e2e-report/trace.zip`(失败用例才有)。

## Mock LLM Server(可选,Phase 5+)

要让 chat-agent.spec.ts 真正验证"输入 → 助手回复"流,需要 mock LLM HTTP 端:

```ts
// 在 spec 顶部加
const mockServer = await electronApp.context().route('**/openai.com/**', route => {
  route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: 'data: {"choices":[{"delta":{"content":"hello from mock"}}]}\n\ndata: [DONE]\n\n',
  })
})
```

或者更彻底地用 LlmConfigStore 的 baseUrl 切换到本地 mock:

```ts
await electronApp.evaluate(({ BrowserWindow }) => {
  // 通过 IPC 让 LlmConfigStore 把 baseUrl 指向 mock
})
```

参考 [electron/llm/adapters/openai.ts](../electron/llm/adapters/openai.ts) 看 baseUrl 在哪里生效。

## Phase 5 路线

| 任务                                       | 优先级 | 备注                                                |
|--------------------------------------------|-------|-----------------------------------------------------|
| `chat-agent` 跑通 mock LLM 流式接收        | 高     | 验证 .message.streaming UI 动画                      |
| `d2prime-30s` 真启动计时                   | 中     | 需 webContainer crossOriginIsolated + 30s benchmark |
| `d3-feishu` 启用 sandbox bot               | 中     | 需凭证 + ngrok 公网隧道                              |
| 其他 5 个 d2prime-* 用 fake sandbox 复活     | 低     | 电量紧张时跳过                                       |
| 截图归档 baseline(像 Playwright `_screenshot_`)| 低     | UI 视觉回归                                          |
| 在 `npm run lint` / `vue-tsc` / `vitest` 中加 e2e 烟测 | 低 | `npx playwright test --list` 应当 0 失败              |

## 常见问题

### Q: 启动报 "Electron failed to launch"

A: 多半是 sandbox 权限。Windows 容器需要 `--no-sandbox`,已在 helper 中加上。如果还失败:
```ts
// tests/e2e/helpers/electron-app.ts
args: [mainEntry, '--no-sandbox', '--disable-gpu'],
```

### Q: `dist-electron/main.js` 不存在

A: `npm run build` 产物。vite-plugin-electron 会从 `electron/main.ts` 编译到 `dist-electron/main.js`。

### Q: Spec 跑但 selector 找不到元素

A: Vue 异步渲染,加 `await window.waitForSelector(...)`。Element Plus 组件的 DOM 结构见[官方文档](https://element-plus.org/zh-CN/component/overview.html)。

### Q: CI 想自动跑

A: GitHub Actions windows-latest runner:
```yaml
- run: npm run build
- run: E2E_ELECTRON=1 npx playwright test --project=electron
```
预计总时长 5–10 分钟(4 spec × 1× Electron 启动 + 真实交互)。
