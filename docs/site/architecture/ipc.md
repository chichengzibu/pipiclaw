# PiPiClaw IPC 协议

> 主进程 ↔ 渲染端 107 个 handler + 多个 event 的完整索引。
> 实测来源:`dist-electron/main.js` 启动后 `ipcMain.eventNames().length`。

## 总览

| 类别 | Handler 数 | 模块 |
| --- | ---: | --- |
| Window / Dialog | 11 | `core/IpcServer.ts` |
| Gateway | 8 | `core/IpcServer.ts` |
| Hermes (记忆) | 2 | `core/IpcServer.ts` |
| Skills | 5 | `core/IpcServer.ts` |
| App / Config | 4 | `core/IpcServer.ts` |
| Models | 9 | `core/IpcServer.ts` |
| Permissions | 11 | `core/IpcServer.ts` |
| Chat | 11 | `core/IpcServer.ts` |
| Tasks | 13 | `core/IpcServer.ts` |
| Execution Mode | 4 | `core/IpcServer.ts` |
| Files | 5 | `core/IpcServer.ts` |
| Conversation Export | 1 | `core/IpcServer.ts` |
| OpenClaw | 5 | `core/IpcServer.ts` |
| MCP | 6 | `core/IpcServer.ts` |
| AutoUpdater | 4 | `core/AutoUpdater.ts` |
| **合计** | **~107** | |

> **说明**: 数字来自 [性能基准报告](../perf/baseline.md) 的 B1 实测。Phase 3 / 4 后稳定在 100 ~ 110 区间。

---

## Window / Dialog (11)

| Handler | 描述 |
| --- | --- |
| `dialog:openFile` | 弹出文件选择对话框 |
| `window:minimize` | 最小化主窗口 |
| `window:maximize` | 最大化主窗口 |
| `window:close` | 关闭主窗口 |
| `window:isMaximized` | 查询最大化状态 |
| `window:setAlwaysOnTop` | 设置窗口置顶 |
| `window:isAlwaysOnTop` | 查询置顶状态 |
| `window:setEdgeHide` | 边缘隐藏 |
| `window:isEdgeHide` | 查询边缘隐藏 |
| `window:showMini` | 显示 mini 窗口 |
| `window:hideToTray` | 隐藏到托盘 |

---

## Gateway (8)

| Handler | 描述 |
| --- | --- |
| `gateway:start` | 启动 OpenClaw gateway |
| `gateway:stop` | 停止 |
| `gateway:restart` | 重启 |
| `gateway:status` | 查询状态 |
| `gateway:repair` | 修复 |
| `gateway:logs` | 拉日志 |
| `gateway:config:get` | 读配置 |
| `gateway:config:set` | 写配置 |

---

## Hermes 记忆 (2)

| Handler | 描述 |
| --- | --- |
| `hermes:getMemories` | 拉所有记忆 |
| `hermes:saveCoreMemory` | 保存核心记忆 |

---

## Skills (5)

| Handler | 描述 |
| --- | --- |
| `skills:list` | 列出已安装技能 |
| `skills:toggle` | 启用 / 禁用 |
| `skills:reload` | 热加载 |
| `skills:importFile` | 从文件导入 |
| `skills:importUrl` | 从 URL 导入 |

---

## App / Config (4)

| Handler | 描述 |
| --- | --- |
| `app:version` | 版本号 |
| `config:get` | 单 key 读 |
| `config:set` | 单 key 写 |
| `config:getAll` | 全量 |

---

## Models (9)

| Handler | 描述 |
| --- | --- |
| `models:list` | 列出 |
| `models:get` | 单查 |
| `models:add` | 新增 |
| `models:update` | 更新 |
| `models:delete` | 删除 |
| `models:toggle` | 启用 / 禁用 |
| `models:test` | 测试连接 |
| `models:syncOllama` | 同步 Ollama 模型列表 |
| `models:fetch` | 从 provider 拉模型 |
| `models:getTemplates` | 模型模板 |

---

## Permissions (11)

| Handler | 描述 |
| --- | --- |
| `permissions:list` | 列权限集 |
| `permissions:get` | 单查 |
| `permissions:active` | 当前激活 |
| `permissions:setActive` | 切换 |
| `permissions:create` | 新建 |
| `permissions:update` | 更新 |
| `permissions:updateRule` | 更新单条规则 |
| `permissions:delete` | 删除 |
| `permissions:duplicate` | 复制 |
| `permissions:check` | 检查操作是否允许 |
| `permissions:reset` | 重置到默认 |

---

## Chat (11)

| Handler | 描述 |
| --- | --- |
| `chat:conversations` | 列所有对话 |
| `chat:conversation:get` | 单查 |
| `chat:conversation:create` | 新建 |
| `chat:conversation:update` | 更新(标题 / metadata) |
| `chat:conversation:delete` | 删除 |
| `chat:conversation:archive` | 归档 |
| `chat:conversation:pin` | 置顶 |
| `chat:message:send` | 发消息 |
| `chat:message:stop` | 停止生成 |
| `chat:message:continue` | 继续生成 |
| `chat:lastModel:get` | 最近使用的模型 |
| `chat:settings:get` / `chat:settings:update` | Chat 设置 |

### Chat 事件 (push 主进程 → 渲染端)

| Event | 描述 |
| --- | --- |
| `chat:onStreamChunk` | 流式 token 增量 |
| `chat:onMessage` | 整条消息(降级兼容) |
| `chat:onConversationUpdate` | 对话元数据变更 |

---

## Tasks (13)

| Handler | 描述 |
| --- | --- |
| `task:execute` | 启动任务 |
| `task:cancel` | 取消 |
| `task:executeTool` | 单工具执行 |
| `task:toolsGet` | 列出可用工具 |
| `task:gatewayCheck` | 检查 gateway |
| `task:trace` | 记录 trace |
| `task:confirm-preview` | 用户确认执行计划 |
| `task:log:get` | 拉单任务日志 |
| `task:log:query` | 多条件查询 |
| `task:log:delete` | 删除单条 |
| `task:log:deleteBatch` | 批量删 |
| `task:log:export` | 导出 |
| `task:log:stats` | 统计 |
| `task:log:retry` | 重试失败任务 |
| `task:log:cancel` | 取消正在跑的任务 |

---

## Execution Mode (4)

| Handler | 描述 |
| --- | --- |
| `execution:mode:get` | 读取当前模式 |
| `execution:mode:set` | 切换 |
| `execution:mode:check` | 检查某操作是否允许 |
| `execution:mode:cancel` | 取消当前正在跑的执行 |

---

## Files (5)

| Handler | 描述 |
| --- | --- |
| `file:parse` | 解析文件 |
| `file:parseBatch` | 批量解析 |
| `file:readClipboardImage` | 读剪贴板图片 |
| `file:getInfo` | 文件元数据 |
| `file:getAllowedExtensions` | 允许的扩展名 |

---

## Conversation Export (1)

| Handler | 描述 |
| --- | --- |
| `conversation:export` | 导出 md / pdf / word |

---

## OpenClaw (5)

| Handler | 描述 |
| --- | --- |
| `openclaw:execute` | 执行操作 |
| `openclaw:batch-execute` | 批量 |
| `openclaw:check-permission` | 检查权限 |
| `openclaw:get-audit-logs` | 审计日志 |
| `openclaw:health-check` | 健康检查 |

---

## MCP (6)

| Handler | 描述 |
| --- | --- |
| `mcp:list` | 列出 MCP server |
| `mcp:add` | 新增 |
| `mcp:update` | 更新 |
| `mcp:remove` | 删除 |
| `mcp:toggle` | 启用 / 禁用 |
| `mcp:test` | 测试连接 |

---

## AutoUpdater (4)

| Handler | 描述 |
| --- | --- |
| `autoUpdater:check` | 检查更新 |
| `autoUpdater:download` | 下载 |
| `autoUpdater:install` | 安装并重启 |
| `autoUpdater:getVersion` | 当前版本 |

---

## 性能要点

- IPC 调用每次 ~0.5ms(本地)
- 107 个 handler 不等于 107 个网络 round-trip
- `chat:onStreamChunk` 高频(每 token),其他 handler 偶尔触发

---

## 新增 handler 流程

1. 在 `electron/core/IpcServer.ts` 注册
2. 在 `electron/types/ipc.d.ts` 加类型
3. preload 暴露 `electronAPI.xxx.methodName()`
4. src/types/api.d.ts 加 frontend 类型
5. 测试 mock `ipcMain.handle`,断言注册

详见 [扩展开发](extension.md)。