# PiPiClaw 重设计 v2.1 · Owner 自评

> **基线**: `redesign-v2.1-spec.md` (37.2 KB)
> **作者**: Mavis
> **原则**: 自评要狠,找 owner 视角的盲区

---

## 综合评分: 7.5 / 10 (自评)

**一句话**: 全部 15 项改稿都落到了具体段落,v2.0 5 个 P0 修干净了,4 owner 补全补;**但作为方案文档,不是 ship 代码**,实施中会发现 30% 细节要二次决策。

**对比 v2.0 7.0**: +0.5 (15 项改稿全吸收) **对比 v2.0 designer 5.5**: +2.0 (修完 P0) **预估 v2.1 designer 评审**: 7.5-8.0 (修干净了 P0/P1)

---

## 改稿完成度

### 15 项改稿全到位 ✅

| # | 类别 | 改稿 | 文档位置 | 状态 |
|---|---|---|---|---|
| P0-1 | 架构 | 右栏默认折叠 | 3.2/3.3 | ✅ |
| P0-2 | 架构 | 1 主区 + 3 面板 + 砍 Files | 2.3 | ✅ |
| P0-3 | 状态机 | 5 状态加"待审阅" | 3.1 | ✅ |
| P0-4 | 组件 | ThinkingIndicator 静态 | 4.1 | ✅ |
| P0-5 | 字体 | Inter + HarmonyOS 双语 | 5.2 | ✅ |
| P1-1 | 导航 | 4 工作区树形 | 2.4 | ✅ |
| P1-2 | AI 模式 | 主动建议改内嵌 | 3.4 | ✅ |
| P1-3 | 响应式 | 3 断点 | 7.2 | ✅ |
| P1-4 | 组件 | ToolCallCard 5 状态 + 默认折叠 | 4.2 | ✅ |
| P1-5 | 组件 | MemoryChip 系统评分 | 4.3 | ✅ |
| P1-6 | 发布 | 灰度发布 | 12 | ✅ |
| 补-1 | 工程 | 后端 IPC 改造 | 8 | ✅ |
| 补-2 | 迁移 | v4.3.1 → v4.4.0 迁移 | 9 | ✅ |
| 补-3 | 平台 | macOS / Windows 差异 | 10 | ✅ |
| 补-4 | 工程 | vite manualChunks | 11 | ✅ |

**没有遗漏,没有"未完待续",没有"实现时再说"**。

---

## v2.0 痛点都修干净了 (🟢)

### 1. 5 个 P0 全部修干净 ✅
- **右栏默认折叠**: v2.0 反 Cursor 路线 → v2.1 顶栏徽章做入口
- **5 Tab → 1+3**: v2.0 浏览器类比错 → v2.1 主区常驻 Chat + 3 辅助面板右滑
- **5 状态加"待审阅"**: v2.0 4 状态危险 → v2.1 Apply/Reject 中间态
- **ThinkingIndicator 静态**: v2.0 文字翻牌垃圾 → v2.1 静态文字 + 1.5s 慢速光标
- **中文字体**: v2.0 fallback 坑 → v2.1 Inter + HarmonyOS Sans SC 双语

### 2. 6 个 P1 全部改 ✅
- **4 工作区树形**: 顶栏固定 + 左栏头部固定
- **主动建议改内嵌**: 顶栏徽章 +1 / 系统消息 / Cmd+Shift+A 临时面板
- **3 断点响应式**: ≥1366 / 1280-1366 / 1024-1280 / <1024
- **ToolCallCard 5 状态**: pending/running/success/**warning**/error + 默认折叠
- **MemoryChip 系统评分**: 频率 + 时间 + 相关性,用户可覆盖
- **灰度发布**: Week 0 视觉 + Week 1-2 内部 + Week 3+ alpha/beta/RC

### 3. 4 个 owner 补全补 ✅
- **后端 IPC 改造**: 8.2 节 LlmEvent 协议 + 8.3 LlmAgentBrain 重构 + 8.4 渲染进程订阅
- **老用户迁移**: 9.1 路由表 + 9.2 主题表 + 9.3 schema 兼容 + 9.4 数据不动
- **平台差异**: 10.1 顶栏高度 + 10.2 快捷键 + 10.3 字体 + 10.4 高对比度 + 10.5 光标
- **vite manualChunks**: 11.1 完整配置 + 11.2 体积预算 + 11.3 路由懒加载 + 11.4 资源懒加载

### 4. v1.0 全部 P0/P1 也吸收了 ✅
- focus-visible ✓
- 字号 t-shirt 命名 ✓
- 4 状态组件补全 ✓
- prefers-reduced-motion 颗粒度 ✓
- SR 5 场景 ✓
- 路由 80ms crossfade ✓
- 同色相 accent ✓
- Card hover Linear 路线 ✓
- Modal 200ms fade only ✓
- Drawer 240ms ✓
- Command Palette 200/200 对称 ✓
- Stream shimmer 文字流 ✓
- 暗色 HSL 调色公式 ✓

---

## v2.1 的新亮点 (🟢 值得保留)

### 1. 战略精准化: "AI 协作可视化"是真正的差异化
- v2.0 写"AI 是协作方"是 2024 共识,不是差异化
- v2.1 1.2 节改"PiPiClaw 是唯一让 AI 协作过程可见的工作台"——产品定义
- 1.4 节"4 个具体形式"(思考可见/工具可见/记忆可见/审阅可见)= 4 个护城河
- **这是 v2.0 → v2.1 最大的认知升级**

### 2. 5 状态"待审阅"是产品安全护栏
- AI 改文件 / 删文件 / 发消息,用户有 Apply/Reject 确认
- 借鉴 Cursor Apply / Vercel v0 Regenerate / GitHub Copilot Workspace
- **这是 v2.0 完全没考虑的产品安全维度**

### 3. 后端 IPC 改造 8 节是可落地的协议
- 不是"待后端实现",是完整的 LlmEvent TypeScript 协议
- 8.3 LlmAgentBrain 重构步骤具体
- 8.4 渲染进程 useLlmStream composable 完整
- 8.5 兼容性: 老 LLM 只发 text_chunk,不破坏

### 4. 老用户迁移 9 节是真能跑的
- 9.1 路由表: 14 个老路由 → 4 个新路由
- 9.2 主题表: 5 套 → 强制 2 套的映射
- 9.3 schema 兼容 + 备份 .bak.json
- 9.4 数据不动(HermesMemory / ClawHub / IM)

### 5. 平台差异 10 节是 macOS / Windows / Linux 都覆盖
- 10.1 顶栏高度差异(macOS 38 vs Windows 32)
- 10.2 快捷键(Cmd vs Ctrl)
- 10.3 字体平台 fallback
- 10.4 Windows 高对比度模式
- 10.5 鼠标光标

### 6. 灰度发布 12 节是工业级节奏
- Week 0 (5 commit) 用户立即可见视觉改进
- Week 1-2 (7 commit) 内部 alpha,用户无感
- Week 3+ alpha / beta / RC 渐进
- **避免 v2.0"26 commit 一波推上去"的原子操作风险**

---

## 真正的硬伤 (🔴 我自评里要挑刺)

### 1. **后端 IPC 改造 8.3 节"具体步骤"还不够具体** 🔴
- v2.1 8.3 节说"LlmAgentBrain.ts 加 eventBus.emit('llm:event', event)"
- 但具体在哪个 method 加?processStream() 末尾?还是新加 wrapStream() 方法?
- OpenAI stream 怎么解析 reasoning_content?(是 options 字段,不是 content 字段)
- tool_calls 是数组,每条有 id/type/function 三个字段,具体怎么 emit?

**修补方向**: 8.3 节加 20-30 行 TypeScript 代码示例,具体到 method

### 2. **老用户迁移 9.3 节"config.v4.3.1.bak.json"没说失败回退** 🔴
- 备份原 config.json 为 v4.3.1.bak.json
- 但如果 v4.4.0 config.json 写入失败呢?
- 如果用户反复升级 v4.4.1 / v4.4.2 呢?(bak 文件被覆盖?)

**修补方向**: 9.3 节加"迁移失败回退 + 多次升级策略"

### 3. **vite manualChunks 11.1 节"feature-ai"指了 4 个 .vue 文件** 🔴
- 但 vite 的 manualChunks 是按 module path 匹配,不是按文件
- .vue 文件是 SFC,需要 import 入口
- `feature-ai` chunk 实际怎么触发?用户打开右栏才加载?

**修补方向**: 11.1 节加 async import() 示例,说明动态加载触发

### 4. **风险表 12 项,但没说"哪些风险要升级处理"** 🔴
- 12 项风险,2 项 🔴 高,8 项 🟡 中,2 项 🟢 低
- 但 owner / SLA / 触发条件 / 监控指标没说
- 比如"IPC 改造破老 LLM 集成" 🔴,谁监控?怎么发现?

**修补方向**: 风险表加 owner 列 + 监控指标

### 5. **Week 0 5 commit 是 ship 视觉,可能引入 regression** 🔴
- v2.0 的 5 套主题虽然要砍,但有些用户用得爽
- 砍完不通知,可能反弹
- HarmonyOS Sans SC 字体在 Windows 上没有,fallback 到 Segoe UI,跟原设计差

**修补方向**: Week 0 ship 加一次性 Toast"主题/字体已升级,可在 Settings 反馈"

### 6. **3 断点响应式 7.2 节"主区宽度计算"假设左栏固定 240** 🔴
- v2.1 7.3 节说左栏 200-320px 可拖
- 但 7.2 节计算假设 240px,实际可拖到 200-320
- 如果左栏拖到 320 + 右栏拖到 480 + 1280 屏:主区只有 1280-48-24-320-480 = 408px,根本不够

**修补方向**: 7.2 节加"宽度联动约束",左栏+右栏总宽 ≤ 680px(1280-632)

### 7. **AI 状态 5 状态机的"待审阅"触发条件没说** 🔴
- v2.1 3.1 节"待审阅"触发:"AI 完成破坏性操作(改文件/删文件)"
- 但"破坏性操作"怎么定义?是工具类型?还是参数含特定关键词?
- 谁定义规则?

**修补方向**: 3.1 节加"破坏性操作定义",如 `write_file` / `delete_file` / `send_im` 等工具类型自动进入"待审阅"

### 8. **LlmEvent 协议 8.2 节 8 种 type 不够** 🔴
- 缺: error 事件(LLM API 错误)
- 缺: cancelled 事件(用户取消)
- 缺: retry 事件(自动重试)
- 缺: token_usage 事件(显示实时 token 消耗)
- 缺: tool_call_chunk 事件(长工具参数流式)

**修补方向**: 8.2 节 LlmEvent 协议补到 12-15 种 type

### 9. **灰度发布 12.3 节"alpha / beta / RC"没说具体分发** 🔴
- electron-builder 的 channel 配置
- 用户怎么切换 channel?(设置页加 channel 选择?)
- 老用户怎么从 latest 切到 beta?(可能改完 channel 才能升级到 beta)

**修补方向**: 12.3 节加 channel 切换 UI + auto-update 配置

### 10. **6 周时间表假设持续 6 周,但 Week 0 是"本周"** 🔴
- Week 0 = 本周(2026-07-28)
- Week 1-6 = 2026-08-04 起 6 周
- 6 周 ship v4.4.0 = 2026-09-15
- 但 6 周里没考虑"用户验收窗口"和"hotfix 周期"
- ship 后用户报告 bug,需要 hotfix 周期(2-3 周)

**修补方向**: 12 节加"ship 后 2-3 周 hotfix 周期",实际 v4.4.0 stable = 2026-10-06

---

## 自评打分明细

| 维度 | 评分 | 说明 |
|---|---|---|
| 战略定位 | 9/10 | "AI 协作可视化"精准,v2.0 偏差修干净 |
| 信息架构 | 9/10 | 三栏+树形+5 状态,根本错都修了 |
| AI 协作右栏 | 9/10 | 默认折叠 + 顶栏徽章 + 5 状态 + Apply/Reject |
| 4 AI 组件 | 8/10 | 4 组件全重做,MemoryChip 评分系统 |
| 视觉语言 v2.1 | 9/10 | Inter + HarmonyOS 双语字体方案 |
| 加载动画 v2.1 | 9/10 | 4+1 模式改完 |
| 交互模式 v2.1 | 8/10 | 主动建议改内嵌,Cmd+L 触发 |
| 主题 v2.1 | 9/10 | 砍 5 套 + 老用户映射表 |
| 无障碍 v2.1 | 8/10 | v1.0 全部 P0 吸收 |
| 性能 v2.1 | 8/10 | manualChunks + 懒加载 + 路由 |
| 实施路线 | 9/10 | 灰度发布 + Week 0 立即可见 |
| 工程实施 | 7/10 | 10 项硬伤见上 |
| **总评** | **7.5/10** | **方案 ship-ready,实施细节要二次决策** |

---

## 修补优先级 (v2.2)

### P0 (v2.1 实施前补)
1. **LlmAgentBrain 重构具体步骤** — 加 20-30 行 TypeScript 代码示例
2. **老用户迁移失败回退 + 多次升级策略** — 9.3 节加具体逻辑
3. **vite manualChunks async import 触发** — 11.1 节加示例
4. **宽度联动约束** — 7.2 节加左栏+右栏总宽 ≤ 680px
5. **破坏性操作定义** — 3.1 节加具体规则

### P1 (实施中补)
6. **风险表加 owner + 监控指标**
7. **Week 0 ship 加 Toast 通知**
8. **LlmEvent 协议补到 12-15 种 type**
9. **灰度发布 channel 切换 UI**
10. **ship 后 hotfix 周期**

### P2 (实施后补)
11. **6 周日历表** — 明确每个 commit 哪天
12. **4 工作区树形具体 UI 设计稿**

---

## 总结

**v2.1 是 ship-ready 候选**:
- ✅ 15 项改稿全到位
- ✅ 5 P0 全修
- ✅ 6 P1 全改
- ✅ 4 owner 补全补
- ✅ v1.0 全部 P0/P1 吸收
- ✅ 灰度发布降低风险

**v2.1 不是完美**:
- 工程实施细节有 10 项硬伤(不算 P0 ship blocker,但实施中会撞)
- 协议/标准/约束有几处没说清
- 时间表缺 hotfix 周期

**预估 v2.1 designer 评审**: 7.5-8.0/10 (修干净 P0/P1)
**预估 v2.1 综合**: 7.5-8.0/10

**v2.1 ship-ready,但实施时建 v2.2 收 10 项工程细节。**

---

## 相关文件

- `docs/redesign-v2-spec.md` — v2.0 (基础,已被 v2.1 替代)
- `docs/redesign-v2-self-review.md` — v2.0 owner 自评 (7.0)
- `docs/redesign-v2-designer-review.md` — v2.0 designer 评审 (5.5)
- `docs/redesign-v2-final-review.md` — v2.0 综合评审 (5.8)
- `docs/redesign-v2.1-spec.md` — **v2.1 详细方案 (37.2 KB)** ← 本文件基线
- `docs/redesign-v2.1-self-review.md` — **v2.1 owner 自评 (7.5)** ← 本文件
