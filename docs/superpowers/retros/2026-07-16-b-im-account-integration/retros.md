# B 子项目 — 真实 IM 账号接入 报告

**日期**: 2026-07-16 / 2026-07-17
**真实环境**: Windows (sandbox subagent), Node 18+, 无 ngrok / 无 3 平台开发者凭证

## 1. ImAccounts.vue 配置 UI

| 项 | 状态 |
|---|---|
| `src/views/ImAccounts.vue` 创建(251 行) | ✅ |
| `/settings/im-accounts` 路由(在 `src/router/index.ts` 末尾追加) | ✅ |
| `channel-config:get` IPC handler(`electron/core/IpcServer.ts:1730`) | ✅ |
| `channel-config:save` IPC handler(`IpcServer.ts:1741`) | ✅ |
| `channel-config:test` IPC handler(`IpcServer.ts:1752`) | ✅ |
| `electronAPI.channelConfig.{get,save,test}` preload 暴露(`electron/preload.ts:1022`) | ✅ |
| `ngrok-setup.md` 文档(58 行) | ✅ |
| 3 平台表单(飞书 / 钉钉 / 企微) + 测试连接 + 保存所有 按钮 | ✅ |

### ImAccounts.vue 实现说明
- **3 个 el-tab-pane**:飞书(App ID + App Secret + 启用 Switch) / 钉钉(App Key + App Secret + Robot Webhook + 启用 Switch) / 企微(Corp ID + Corp Secret + Agent ID + 启用 Switch)
- **数据加载**:`onMounted` 调 `electronAPI.channelConfig.get()`,从 IMConfigStore.list() 返回的 `IMConfig[]`(按 `channelKind` 索引)填充表单
- **测试连接**:点击 → `electronAPI.channelConfig.test({ platform, config })` → 主进程临时 set config → new Channel → healthCheck() → 返回 `{ ok, message }`
- **保存所有**:Promise.all(3 个 save)+ alert 提示
- **使用流程 el-card**:6 步引导(创建应用 → 拿凭证 → 装 ngrok → 配回调 URL → 填凭证 → 真收发)

### ImAccounts.vue 与 Plan A 已知 bug
**`src/styles/tokens.css:9-11` 嵌套 `/* */` 注释 → sass 500 → Vue app 整体白屏**(Plan A 暴露,subagent 不修)。ImAccounts.vue 也用 `<style lang="scss" scoped>`,所以一旦 ImAccounts 路由被访问,有可能撞同 bug。**retro 明确标注**:前端 UI 受 Plan A 暴露的 tokens.css bug 影响,主会话需先修 tokens.css 才能让 ImAccounts.vue 在浏览器渲染。

### ImAccounts.vue 偏离 plan 的小调整
plan 中 `loadConfigs()` 用 `configs.imFeishu.appId` 这种 camelCase 字段读 IMConfigStore.list()。但 IMConfigStore.list() 实际返回 `IMConfig[]`,数组项字段是 `channelKind: 'im-feishu'` 这种 kebab-case 风格,所以应按 `configs['im-feishu'].appId` 索引。**subagent 已修正**。这是个小调整,不影响 plan 设计意图。

---

## 2. ngrok 内网穿透引导

- 文档路径:`docs/superpowers/retros/2026-07-16-b-im-account-integration/ngrok-setup.md`
- 内容:macOS / Windows / Linux 三平台安装 + 注册账号 + 启动 + 3 平台回调 URL 配置 + 注意事项(URL 变化 / 限速)
- 未在 sandbox 内实跑 ngrok(外部 CLI,沙箱不允许)

---

## 3. 飞书真实环境验证(B-3)

**凭证状态:缺失** — 用户未提供飞书 appId / appSecret。

**subagent 验证范围(只能做的)**:
- ✅ ImAccounts UI 飞书 Tab 可配(App ID / App Secret / 启用 Switch)
- ✅ 测试连接按钮 wired 到 `channel-config:test` IPC
- ✅ `FeishuChannel.healthCheck()` 真实 fetch `https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal`(W7.2 已实现)
- ✅ `IMConfigStore.set('im-feishu', config)` 持久化到 `userData/im-config.json`
- ❌ 真实发消息:无凭证,无 ngrok,**未跑**

**真实收发测试** — 待用户后续提供凭证 + 启动 ngrok + 配置回调 URL 后跑:
```bash
# 启动 ngrok
ngrok http 5173

# 飞书开放平台 → 应用 → 事件订阅 → 请求 URL: https://xxxx.ngrok-free.app/im/webhook/feishu
# (PiPiClaw 端 IM webhook 路由 /im/webhook/feishu 由后续 W12.B 接)

# PiPiClaw /settings/im-accounts 填入凭证 → 测试连接 → 保存
# 用飞书 APP 发"hi" → PiPiClaw 应自动回复
```

**截图归档**:
- 飞书 APP 收到 PiPiClaw 自动回复的截图 — ❌ 凭证缺失,未跑
- PiPiClaw 主界面显示消息收发日志的截图 — ❌ 凭证缺失,未跑

---

## 4. 钉钉真实环境验证(B-4)

**凭证状态:缺失** — 用户未提供钉钉 appKey / appSecret / webhook。

**subagent 验证范围**:
- ✅ ImAccounts UI 钉钉 Tab 可配(App Key / App Secret + Robot Webhook / 启用 Switch)
- ✅ 测试连接按钮 wired
- ✅ `DingTalkChannel.healthCheck()` 真接 `https://oapi.dingtalk.com/gettoken`(W7.2 已实现)
- ❌ 真实发消息:无凭证,无 ngrok,**未跑**

**真实收发测试** — 待用户后续提供凭证后跑:
```bash
# 钉钉开放平台 → 应用 → 机器人 → 消息接收 URL: https://xxxx.ngrok-free.app/im/webhook/dingtalk
```

**截图归档**:❌ 凭证缺失,未跑

---

## 5. 企微真实环境验证(B-5)

**凭证状态:缺失** — 用户未提供企微 corpId / corpSecret / agentId。

**subagent 验证范围**:
- ✅ ImAccounts UI 企微 Tab 可配(Corp ID / Corp Secret / Agent ID / 启用 Switch)
- ✅ 测试连接按钮 wired
- ✅ `WechatWorkChannel.healthCheck()` 真接 `https://qyapi.weixin.qq.com/cgi-bin/gettoken`(W7.2 已实现)
- ❌ 真实发消息:无凭证,无 ngrok,**未跑**

**真实收发测试** — 待用户后续提供凭证后跑:
```bash
# 企微管理后台 → 应用 → 接收消息服务器 URL: https://xxxx.ngrok-free.app/im/webhook/wechat-work
```

**截图归档**:❌ 凭证缺失,未跑

---

## 6. 整体验收

| 项 | 状态 |
|---|---|
| ImAccounts view 创建 | ✅ |
| /settings/im-accounts 路由可达 | ✅ |
| channel-config:{get, save, test} IPC 注册 | ✅ |
| preload electronAPI.channelConfig 暴露 | ✅ |
| ngrok-setup.md 文档 | ✅ |
| 飞书真实收发 ≥1 条 | ❌ 凭证缺失 |
| 钉钉真实收发 ≥1 条 | ❌ 凭证缺失 |
| 企微真实收发 ≥1 条 | ❌ 凭证缺失 |
| tsc node 0 错 | ✅ |
| vitest 167/178(11 failed — pre-existing sandbox EPERM,与 Plan B 无关) | ⚠️ |

### vitest 11 failures 详情(均与 Plan B 无关)
- `tests/unit/Workspace.test.ts` 7 failed:EPERM `mkdir 'D:\tmp\pipiclaw-ws-userData\sandboxes\...\mnt'`(沙箱文件系统限制)
- `tests/unit/WebContainerRunner.test.ts` 1 failed:同上 EPERM
- `tests/unit/SandboxBuilder.test.ts` 1 failed:`result.ok` 期望 true 实际 false(Sandbox EPERM 副作用)
- `tests/integration/d2prime-end-to-end.test.ts` 2 failed:同上 EPERM

**根因**:subagent 沙箱禁止在 `D:\tmp\pipiclaw-*-userData\` 下创建 sandboxes 目录,与代码无关。**留给主会话兜底**。Plan B 新增的 IPC handler 完全不调用 Workspace/Sandbox,所以 0 regression。

---

## 7. 关键决策 / 难题

1. **`loadConfigs()` 索引键名调整**:plan 写 `configs.imFeishu.appId`(camelCase),实际 IMConfigStore.list() 返回 `IMConfig[]` 按 `channelKind`(`'im-feishu'` kebab-case)索引,改为 `configs['im-feishu'].appId`。**小调整,plan 设计意图不变。**

2. **`tokens.css` Plan A 已知 bug 影响 ImAccounts**:ImAccounts.vue 是 Vue SFC + sass scoped,撞 Plan A 暴露的 tokens.css sass 500 bug。**subagent 不修,留给主会话**。

3. **凭证缺失**:subagent sandbox 内无法真跑 ngrok + 3 平台开发者凭证需用户提供。**B-3/B-4/B-5 仅完成 UI + IPC 配置层验证,真实收发全部 ❌**。

4. **未引入新 npm 依赖**:ImAccounts.vue 只用 `element-plus`(已在用)、Vue 3(已在用)、`window.electronAPI`(已暴露)。✅

5. **未修改 W7.2 既有 19 个 channel 业务代码**:FeishuChannel / DingTalkChannel / WechatWorkChannel / IMConfigStore / IMMessageStore / IMMessageRouter / IMPermissionManager / IMSecurityManager / ChannelRouter 全部 0 改动。Plan B 只新增 ImAccounts.vue + 3 IPC handler + preload 暴露 + 1 route + 1 文档。✅

---

## 8. 遗留未跑项(主会话兜底清单)

- **tokens.css:9-11 嵌套注释 bug 修复**(主会话已知,ImAccounts UI 受影响)
- **用户凭证到位后的 3 平台真实收发测试**(飞书 / 钉钉 / 企微)
- **PiPiClaw 端 `/im/webhook/{feishu,dingtalk,wechat-work}` HTTP webhook 路由**(W12.B+ 接,不在 Plan B 范围)
- **沙箱 EPERM 11 个 vitest failure 兜底**(与 Plan B 无关)
- **8 占位通道未接**:im-wechat / im-qq / im-telegram / im-slack / im-discord / im-whatsapp / im-lark / im-rocket(W12+ 接 SDK)
- **ngrok 自动启动未实现**:用户需手启动(可后续 W13 加)
- **ngrok 公网 URL 动态追踪**:目前 ImAccounts.vue "使用流程"只是文档引导,未自动检测 ngrok URL