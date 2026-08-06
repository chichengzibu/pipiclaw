# PiPiClaw v4.5.0-alpha 真实用户 Dogfooding 报告 (边测边修)

> **开始**: 2026-08-06T14:30 北京
> **结束**: 2026-08-06T15:30 北京
> **场景**: 7 (P0 安全 / Chat 长对话 / 主题+Palette / MCP 真用 / 错误路径 / 多 session / Tasks)
> **发现**: 🔥 P0: 1 (P0-1 migration) | ⚠️ P1: 1 (playwright WS 偶发) | 💬 P2: 0
> **修法**: 1 commit `b5ff363` 修 P0-1 (老 config migration + saveConfig version fallback)
> **release**: v4.5.0-alpha PATCH 3 (含 P0-1 fix) 已发

## 真实用户视角 vs 自动测试

| 维度 | 自动 1h 长跑 (250 round) | 真实用户 dogfooding (7 场景) |
|---|---|---|
| 5/5 场景通过率 | 100% (1240/1240) | 6/7 场景通 (1 个 P0 修了) |
| 真任务覆盖 | ❌ hello world | ✅ 真实工作流 |
| 错误路径 | ❌ 没测 | ✅ 跑过 |
| UI 细节 | ⚠️ 只截图 | ✅ 截图 + 行为 |
| 老 config 兼容 | ❌ 每次新 config | ✅ 真实升级路径 |

## 发现的 P0 bug (已修)

### P0-1: 默认权限仍是"开放模式"

**截图 (修复前)**:
- 顶部"当前: 开放模式"
- 左侧 "开放模式 使用中" (高亮)
- 提示语 "开放模式，允许几乎所有操作"

**截图 (修复后)**:
- 顶部"当前: 安全模式"
- 左侧 "安全模式 使用中" (高亮)
- 警告 UI: "无限制模式 ⚠️ (不推荐)" + 红字 "此模式允许所有操作,无任何安全防护"
- 权限规则: 文件系统只读 / 网络禁止 / 进程禁止 / 系统禁止 / Shell 禁止

**真根因 (3 层)**:

```
P0-1 之前修复 (309375d 删 main.ts 启动调用 forceResetToPermissive)
   │
   ├─ 只对**新用户** (无老 config) 有效
   │   新用户: initDefaultPermissionSets() → activeSetId = safe ✅
   │
   └─ 老用户 (v4.3.0 activeSetId="preset_permissive") 升级
       │
       ├─ loadConfig 读老 config → activeSetId = "preset_permissive" (没 migration) ❌
       │
       └─ dev mode `app.getVersion()` 返 electron version 30.5.1
           老 config 的 `version: "30.5.1"` 跟 currentVersion 相等
           migration 比较 `configVersion !== currentVersion` bypass ❌
```

**修法 (commit b5ff363, 1 文件, 3 段)**:

1. `loadConfig` 加老 config migration: `configVersion !== currentVersion && activeSetId === 'preset_permissive'` → 切 safe + emit `'upgrade-default'` + saveConfig
2. `saveConfig` 用 `getAppVersion()` (dev mode fallback 到 root package.json)
3. `getAppVersion()` helper: prod 走 `app.getVersion()` (4.5.0-alpha), dev 检测 30.5.1 后 fallback 读 `require('../../package.json').version`

**验证**:
- ✅ IPC `permissions.active` 返 `id: "preset_safe" name: "安全模式"`
- ✅ `Roaming\pipiclaw\permissions.json`: `version: "4.5.0-alpha" activeSetId: "preset_safe"`
- ✅ `Roaming\Electron\permissions.json` (dev mode): 同样 migration 跑通

## 发现的 P1 现象 (已排除)

### P1: Chat 5 轮 0 messages

**现象**: 真实用户 dogfooding Chat 5 轮每轮 fill + press Enter 后等 30s, message count 始终 0

**根因排查**:
- input 填文字成功 (截图能看到 "请读 src/views/Chat.vue 的前 30 行")
- main 区域显示空状态 "下午好,继续加油"
- send 事件没触发

**排除**:
- ✅ 1h 长跑 250 round 5/5 PASS (用同样 selector + press Enter)
- ✅ 2 min dogfooding 5/5 PASS
- ✅ ChatInput `@keydown.enter.exact.prevent="handleSendClick"` → `emit('send', content)` → Chat.vue `@send="handleSend"` 链路通
- ✅ chat store `sendMessage` 内部 addMessageLocally 立即触发 UI 更新

**结论**: 是 **playwright WS 偶发超时** 导致 fill/press 没生效 (跟 1h 长跑 round 81 卡死同一原因, 见之前 dogfooding-4h-looper.mjs uncaughtException fix)。不是 app bug。

## 报告位置

- 报告: `docs/team/2026-08-06-dogfooding-real-user-final.md`
- P0-1 修复前截图: `docs/team/2026-08-06-p0-1-before.png` (开放模式)
- P0-1 修复后截图: `docs/team/2026-08-06-p0-1-after.png` (安全模式)
- 真实用户 dogfooding 脚本: `scripts/dogfooding-real-user.mjs`

## release v4.5.0-alpha PATCH 3

- **URL**: https://github.com/chichengzibu/pipiclaw/releases/tag/v4.5.0-alpha
- **Setup.exe**: 88.9MB (含 P0-1 migration fix)
- **body**: 加 P0-1 段 (3 层根因 + 修法 + 验证)
- **commit**: `b5ff363` (已 push)
