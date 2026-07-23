# PiPiClaw 扩展开发

> 如何扩展 PiPiClaw:添加新 LLM provider / 新 IM channel / 新权限规则 / 新视图。

## 总览

扩展 PiPiClaw 主要有 4 类入口:

1. **LLM provider** — `electron/llm/adapters/`
2. **IM channel** — `electron/channel/`
3. **Permission 规则类型** — `electron/permissions/`
4. **Renderer 视图** — `src/views/`

---

## 1. 添加新 LLM provider

### 步骤

1. 创建 `electron/llm/adapters/<name>.ts`
2. 实现 `LlmAdapter` interface:
   ```ts
   export interface LlmAdapter {
     name: string
     chat(req: LlmChatRequest): Promise<LlmChatResponse>
     streamChat(req: LlmChatRequest, onChunk: (chunk: string) => void): Promise<void>
     listModels(): Promise<LlmModelInfo[]>
   }
   ```
3. 在 `electron/llm/LlmClient.ts` 注册:
   ```ts
   case 'myprovider':
     return new MyProviderAdapter(config)
   ```
4. 在 `electron/llm/types.ts` 加 provider 类型
5. 写测试: `tests/unit/llm/myprovider-adapter.test.ts`
6. 更新 IPC handler 数量(如加 `models:myproviderAction`)

### 例子

参考 `electron/llm/adapters/zhipu.ts`(智谱 GLM)。

---

## 2. 添加新 IM channel

### 步骤

1. 创建 `electron/channel/<Name>Channel.ts`
2. 实现 `IMChannel` interface:
   ```ts
   export interface IMChannel {
     name: string
     connect(config: IMConfig): Promise<void>
     disconnect(): Promise<void>
     sendMessage(target: string, content: IMMessageContent): Promise<void>
     onMessage(handler: (msg: IMIncomingMessage) => void): void
   }
   ```
3. 在 `electron/channel/index.ts` 导出
4. 在 `electron/channel/ChannelRouter.ts` 注册路由
5. `IMConfigStore` 加 channel type 配置项
6. UI 加设置表单:`src/views/ImAccounts.vue`
7. 测试

### 例子

参考 `electron/channel/FeishuChannel.ts`(飞书)。

---

## 3. 添加新权限规则类型

### 步骤

1. 在 `electron/permissions/PermissionTypes.ts` 加规则类型:
   ```ts
   type RuleType = 'path' | 'api' | 'network' | 'myrule'
   interface MyRule { type: 'myrule'; pattern: string; action: 'allow' | 'deny' | 'ask' }
   ```
2. 在 `electron/permissions/PermissionManager.ts` 加检查逻辑:
   ```ts
   case 'myrule':
     return this.checkMyRule(req, rule)
   ```
3. UI 加规则编辑表单:`src/views/Permissions.vue`
4. 测试

---

## 4. 添加新视图

### 步骤

1. 创建 `src/views/MyView.vue`(用 Element Plus + Vue 3 setup)
2. 在 `src/router/index.ts` 注册路由
3. 在 `src/components/layout/SideNav.vue` 加导航项
4. 如需持久化状态 → 加 Pinia store `src/stores/my.ts`
5. 如需主进程支持 → 加 IPC handler + types + 测试
6. i18n: `src/locales/zh-CN.ts` 加 key

### 例子

参考 `src/views/Chat.vue` / `src/views/Tasks.vue`。

---

## 5. 添加新 IPC handler

### 步骤

1. 在 `electron/core/IpcServer.ts` `registerHandlers()` 内:
   ```ts
   ipcMain.handle('mymodule:myAction', async (_, arg) => {
     // 业务逻辑
     return result
   })
   ```
2. 类型: `electron/types/ipc.d.ts`
   ```ts
   export interface IpcHandlers {
     'mymodule:myAction': (arg: MyArg) => Promise<MyResult>
   }
   ```
3. preload 暴露:
   ```ts
   contextBridge.exposeInMainWorld('electronAPI', {
     mymodule: { myAction: (arg) => ipcRenderer.invoke('mymodule:myAction', arg) }
   })
   ```
4. frontend 类型:`src/types/api.d.ts`
   ```ts
   mymodule?: { myAction: (arg: MyArg) => Promise<MyResult> }
   ```
5. 测试:`tests/unit/IpcServer.test.ts` 或对应模块测试

### 命名约定

- `<domain>:<verb>` 或 `<domain>:<entity>:<verb>`
- 例:`chat:message:send` / `models:list` / `autoUpdater:check`
- 不用驼峰,用冒号分隔

---

## 6. 添加新技能 (Skill)

### 文件结构

```
skills/
  my-skill/
    skill.md          # frontmatter + 描述 + prompt
    icon.png          # 可选
    README.md         # 可选
```

### skill.md 示例

```markdown
---
name: my-skill
version: 1.0.0
description: |
  简短描述这个技能干什么
author: <your-name>
license: MIT
trigger:
  - type: keyword
    keywords: [关键词1, 关键词2]
inputs:
  - name: url
    type: string
    required: true
    description: 目标 URL
outputs:
  - name: result
    type: object
    description: { ... }
---

# 描述

详细描述技能做什么。

## Prompt 模板

```
请按以下格式处理 {{ url }}:
...
```

## 工具列表

- read_file
- write_file
- shell
```

### 流程

1. 写到 `skills/<name>/skill.md`
2. 通过 UI 导入(技能市场 → 我的技能 → 导入)
3. 或 CLI: `tar czf my-skill.tar.gz skill.md`
4. 测试:跑一遍 `npm run test -- skill`

---

## 7. 测试规范

| 测试类型 | 工具 | 位置 | 频率 |
| --- | --- | --- | --- |
| 单元测试 | vitest | `tests/unit/` | 每次 commit |
| 集成测试 | vitest | `tests/integration/` | 每次 commit |
| E2E 真测 | Playwright | `tests/e2e/` | nightly / 手动 |
| Smoke | node:fs | `scripts/smoke-test.mjs` | 每次 commit |

### 单元测试最小模板

```typescript
import { describe, it, expect, vi } from 'vitest'
import { MyModule } from '../../electron/mymodule/MyModule'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
}))

describe('MyModule', () => {
  it('basic behavior', () => {
    const m = new MyModule()
    expect(m.foo()).toBe('bar')
  })
})
```

---

## 8. 提 PR 流程

1. Fork 仓库
2. 新建分支 `feat/your-feature-name`
3. 改代码 + 加测试
4. `npm run lint && npx tsc --noEmit && npx vue-tsc --noEmit && npx vitest run && npm run smoke`
5. 全过 → 提 PR,标题 `feat(scope): summary`
6. CI 跑 4 件套 + smoke
7. Reviewer approve → merge

---

## 下一步

- 看 [IPC 协议](ipc.md) 决定要加哪些 handler
- 看 [架构总览](overview.md) 了解模块边界
- 看 [Phase 3 retro](../superpowers/retros/2026-07-22-phase3-product-quality/retro.md) 看最近的设计决策