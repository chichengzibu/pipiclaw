# B 子项目 — 真实 IM 账号接入 Design Spec

> **生成日期**:2026-07-16
> **作者**:brainstorming skill(主会话)
> **前置 commit**:A spec 落库
> **定位**:v2.0.0 GA 后第三阶段实战验证,P2 子项目
> **前置依赖**:**子项目 C 完成**(Docker 沙盒可用,部分 IM 流量走容器)

---

## 1. 一句话

把 v2.0.0 的 **3 个真接 IM 通道**(飞书 FeishuChannel / 钉钉 DingTalkChannel / 企微 WechatWorkChannel)**用真实 appId/secret 跑通**,实现真实双向消息收发(用户发消息 → ChannelRouter 路由 → AgentBrain 解析 → 回复)。

---

## 2. 背景与现状

### 2.1 3 真接通道当前实装度(W7.2 已就位)

| 通道 | HTTP fetch 实现 | 配置字段 | 鉴权 endpoint | 发送 endpoint |
|---|---|---|---|---|
| **FeishuChannel** | ✅ | appId / appSecret | `https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal` | `https://open.feishu.cn/open-apis/im/v1/messages` |
| **DingTalkChannel** | ✅ | appKey / appSecret + Robot webhook | `https://oapi.dingtalk.com/gettoken` | `https://oapi.dingtalk.com/robot/oos/send` |
| **WechatWorkChannel** | ✅ | corpId / corpSecret + agentId | `https://qyapi.weixin.qq.com/cgi-bin/gettoken` | `https://qyapi.weixin.qq.com/cgi-bin/message/send` |

### 2.2 8 占位通道(本期不动)
WeChat / QQ / Telegram / Slack / Discord / WhatsApp / Lark / Rocket → W12+ 接 SDK,本任务不动

### 2.3 关键依赖清单
- **3 平台开发者账号**:飞书 https://open.feishu.cn/ + 钉钉 https://open-dev.dingtalk.com/ + 企微 https://work.weixin.qq.com/wework_admin/
- **3 应用凭证**:appId/appSecret × 3 + corpId/corpSecret + AgentId
- **公网回调 URL**:3 个 IM 平台都需要,**必须公网可达**(本机调试需内网穿透 ngrok/frp 或公网服务器)
- **白名单 IP**:3 平台回调 IP 需加白名单
- **API 权限**:消息收发权限(企业自建应用)

### 2.4 已建组件(不动)
- `IMConfigStore.ts` W7.2:配置持久化到 `userData/im-config.json` ✅
- `IMMessageStore.ts` W7.2:消息内存存储 ✅
- `IMPermissionManager.ts` W7.2:用户白名单 ✅
- `IMSecurityManager.ts` W7.2:消息安全过滤 ✅
- `IMMessageRouter.ts` W7.2:消息路由 ✅
- `ChannelRouter.ts` W7.2:统一通道管理 ✅
- 3 真接通道 `FeishuChannel.ts` / `DingTalkChannel.ts` / `WechatWorkChannel.ts` W7.2 ✅

### 2.5 缺什么
- ❌ UI 配置入口(用户在哪填 appId/secret?)→ 当前无 `/settings/im-accounts` view
- ❌ 内网穿透引导文档
- ❌ 真实环境验证脚本

---

## 3. 设计方案(3 选项 + 推荐)

### 方案 1: **3 平台全接 + UI 配置 view + ngrok 引导**(推荐)
**5 步**:
1. **Step 1 加 IM 账号配置 view**:
   - 新建 `src/views/ImAccounts.vue`(~250 行)
   - 3 平台表单(每个 appId/appSecret/webhook + 测试按钮)
   - 通过 IPC 调 main 进程 `channel-config:save` 持久化到 im-config.json
   - 末尾追加 `src/router/index.ts` 1 route `/settings/im-accounts`
2. **Step 2 main 进程 IPC handler**:
   - 在 `electron/core/IpcServer.ts` 加 2 handler:
     - `channel-config:get` 返回当前配置列表
     - `channel-config:save` 持久化
   - `electron/preload.ts` 暴露 `electronAPI.channelConfig.{get, save}`
3. **Step 3 IMConfigStore 增强**:
   - `IMConfigStore.getInstance().set('im-feishu', { appId, appSecret, enabled: true })`
   - 已有,无需改
4. **Step 4 ngrok 引导文档**:
   - 写 `docs/superpowers/retros/2026-07-16-b-im-account-integration/ngrok-setup.md`
   - 含 ngrok 安装 + 启动 + 把 ngrok URL 填到 IM 平台回调 URL 步骤
5. **Step 5 真实环境验证**:
   - 用户按文档配飞书账号 → 用真实飞书账号发"hi" → 看 ChannelRouter 收到 + AgentBrain 解析 + ChannelRouter.send 回复
   - 截图归档

**验收**:
- 飞书 / 钉钉 / 企微 3 平台各真实收发 ≥1 条消息
- ImAccounts view 可用,可配可保存可启停
- ngrok 文档完备,新用户按文档 30 分钟内可跑通

**风险**:
- 飞书/钉钉/企微 平台审核:个人开发者账号只能创建测试应用,**不能发群消息**,需在测试组织内测试
- 内网穿透:ngrok 免费版限速,公网服务器需自己买
- 鉴权失败率高(平台文档不一,需仔细配置)
- 频率限制:飞书 50 QPS / 钉钉 100 QPS

### 方案 2: **只接 1 平台(飞书)+ UI view**
省去钉钉/企微,只做飞书全链路

**风险**:B 子项目只覆盖 1/3 平台,W13+ 再补

### 方案 3: **跳过 UI,只写脚本 + IMConfigStore 手动 JSON 编辑**
用命令行脚本 `scripts/im-account-setup.mjs` 写 im-config.json,无 UI

**风险**:用户体验差,W14+ 还得补 UI

---

### **推荐:方案 1**(3 平台全接 + UI view + ngrok 文档)
- 完整闭环:UI 配 → 持久化 → 真实收发
- 1-3 天(取决于平台审核 + 回调 URL 调试时间)

---

## 4. 架构与组件

### 4.1 不引入新 npm 依赖
- IM 通道用 `fetch` 原生(W7.2 已实现)
- 内网穿透引导用 ngrok CLI(系统外部工具,不进 npm)
- UI 用现有 Element Plus + Apple HIG tokens

### 4.2 不修改既有 IM 通道代码
- W7.2 19 个 channel 文件 0 改动(已能跑 fetch,只是需要真实凭证)
- subagent 只做:加 UI view + IpcServer handler + preload 暴露 + ngrok 文档 + 真实环境验证

### 4.3 新增文件

| 文件 | 行数 | 作用 |
|---|---|---|
| `src/views/ImAccounts.vue` | ~250 | IM 账号配置 UI(3 平台表单) |
| `electron/skill/builtin/ImAccountSetup.ts`(可选) | ~150 | 命令行脚本入口(供高级用户)|
| `docs/superpowers/retros/2026-07-16-b-im-account-integration/ngrok-setup.md` | ~100 | ngrok 内网穿透引导 |
| `docs/superpowers/retros/2026-07-16-b-im-account-integration/retros.md` | ~150 | 真实环境验证报告 |

### 4.4 改文件
- `src/router/index.ts` 末尾追加 1 route(`/settings/im-accounts`)
- `electron/core/IpcServer.ts` 末尾追加 2 handler(`channel-config:get` / `channel-config:save`)
- `electron/preload.ts` 末尾追加 electronAPI.channelConfig.{get, save}

---

## 5. 数据流与错误处理

### 5.1 配置流程
```
用户打开 /settings/im-accounts
   │
   ├─→ ImAccounts.vue mount
   │    └─→ electronAPI.channelConfig.get() → 拉取当前 im-config.json
   │         └─→ 显示 3 平台表单(每个显示当前 appId/secret/webhook + enabled)
   │
   ├─→ 用户填飞书 appId/secret + 点"测试连接"
   │    ├─→ electronAPI.channelConfig.test({ platform: 'im-feishu', appId, appSecret })
   │    │    └─→ main 进程调飞书 getAccessToken
   │    │         └─→ 返回 { ok: true, version } 或 { ok: false, error }
   │    └─→ UI 显示测试结果
   │
   └─→ 用户点"保存"
        └─→ electronAPI.channelConfig.save({ platform: 'im-feishu', config: { appId, appSecret, enabled: true } })
             └─→ main 进程 IMConfigStore.set('im-feishu', config) → 持久化到 im-config.json
```

### 5.2 消息收发流程(以飞书为例)
```
飞书用户发消息"hi"到企业应用
   │
   ├─→ 飞书服务器回调到公网 URL(ngrok 转发 → 本机 PiPiClaw)
   │    └─→ IpcServer.channel-handler(从 W7.3 已有,本任务不增) → ChannelRouter.handleIncoming
   │         ├─→ IMPermissionManager.isAllowed(userId) → true
   │         ├─→ IMSecurityManager.process(msg) → cleanContent
   │         └─→ IMMessageRouter.matchRule('hi') → 命中规则(若有)
   │
   ├─→ AgentBrain.think({ content: 'hi' }) → decision
   │    └─→ decision.action = 'reply', payload.text = 'hello!'
   │
   └─→ ChannelRouter.send(channelId, { to: userId, text: 'hello!' })
        ├─→ FeishuChannel.send({ to: userId, text: 'hello!' })
        │    ├─→ getAccessToken() (缓存 60s 安全余量)
        │    ├─→ POST /open-apis/im/v1/messages
        │    └─→ 飞书推送消息给用户
        └─→ IMMessageStore.record('out', msg)
```

### 5.3 错误处理
- 飞书 getAccessToken 失败 → 返回 `{ ok: false, error: 'appId/secret 错误' }` → UI 显示红色提示
- 发送消息 401 → 清缓存 token → 重试 1 次 → 仍失败 → 上报 user
- 发送消息频率限制(429)→ 退避 1s → 重试 3 次 → 仍失败 → 上报 user
- 公网回调 URL 不通 → 用户飞书后台配置错误 → 引导用户检查 ngrok 状态

---

## 6. 测试策略

### 6.1 单元测试(已有)
- `tests/unit/IMConfigStore.test.ts`(若有,W7.0 期间未写)
- 真实环境验证为主,unit test 不强求

### 6.2 集成测试(本任务不写,W12+ 评估)
- mock 飞书 / 钉钉 / 企微 API 跑 stub fetch

### 6.3 真实环境验证(本任务核心)
- 飞书:配置 appId/secret → 真实发消息 → 看回复
- 钉钉:同上
- 企微:同上

### 6.4 验收标准
- 飞书 / 钉钉 / 企微 3 平台各真实收发 ≥1 条消息
- ImAccounts view 可配可保存
- ngrok 文档完备

---

## 7. 实施策略

### 7.1 Subagent 派发模式
**1 个 general_purpose_task subagent**(用户需提供 3 平台凭证):
- **Step 1**:写 `src/views/ImAccounts.vue` + IpcServer 2 handler + preload 暴露 + router 1 route
- **Step 2**:写 `docs/superpowers/retros/2026-07-16-b-im-account-integration/ngrok-setup.md`
- **Step 3**:用户配置 3 平台凭证后,subagent 调 `npm run dev` 验证 ImAccounts view 可配可保存
- **Step 4**:用户启动 ngrok,subagent 跑 ImAccountSetup.ts 测试连接
- **Step 5**:用户用真实飞书账号发消息,subagent 截图 ChannelRouter 收到 + AgentBrain 解析 + ChannelRouter.send 回复的整个链路
- **Step 6**:写 retro + commit

**subagent 估算时间**:1-3 天(取决于平台审核 + ngrok 调试)

### 7.2 不做的事
- ❌ 不接 8 占位通道(本期不动)
- ❌ 不接 ngrok 自动启动(用户手启动)
- ❌ 不接真实 LLM(子项目 D)
- ❌ 不修改 W7.2 19 个 channel 文件

---

## 8. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 飞书/钉钉/企微 平台审核 | 高 | 不能发群消息 | 用个人开发者账号 + 测试组织 |
| ngrok 免费版限速 | 高 | 回调延迟高 | 用 ngrok 付费版或公网服务器 |
| 平台鉴权文档不一 | 中 | 配错凭证 | subagent 严格按平台官方文档配 |
| 频率限制 | 中 | 测试期间偶发 429 | 间隔 1s 测 1 条 |
| ImAccounts view 设计欠佳 | 低 | 用户体验差 | 参照 W2 Apple HIG tokens 风格 |

---

## 9. 验收清单

- [ ] `src/views/ImAccounts.vue` 创建,`/settings/im-accounts` 路由可访问
- [ ] IpcServer 末尾追加 `channel-config:get` / `channel-config:save` handler
- [ ] preload 末尾追加 `electronAPI.channelConfig.{get, save, test}`
- [ ] ngrok-setup.md 文档落库,含 30 分钟跑通步骤
- [ ] 飞书 appId/secret 配入 + 真实收发 ≥1 条消息
- [ ] 钉钉 appKey/appSecret + webhook 配入 + 真实收发 ≥1 条
- [ ] 企微 corpId/corpSecret + agentId 配入 + 真实收发 ≥1 条
- [ ] retro 落库,含 3 平台真跑截图
- [ ] 不修改 W7.2 19 个 channel 文件
- [ ] 不新增 npm 依赖
- [ ] vitest 仍 178/178 通过

---

## 10. 不在范围内

- 接 8 占位通道(W12+)
- ngrok 自动启动(本任务用户手启动)
- 接真实 LLM(子项目 D)
- WebContainerRunner 真接(W12+)
- JupyterRunner kernel 真跑(W12+)
- 5 demo 真实截图(子项目 A)

---

**Spec 状态**:已写入并落库(本文件)

**下一步**:
1. 用户审查本 spec → 批准/修改
2. 批准后调用 writing-plans skill 出实施 plan
3. plan 派 subagent 真实环境跑(需用户提前准备 3 平台凭证)