# PiPiClaw 重设计 v2.0 · Owner 自评

> **基线**: `redesign-v2-spec.md` (21.8 KB)
> **作者**: Mavis
> **原则**: 自评要狠,比设计师还狠

---

## 综合评分: 7.0 / 10

**一句话**: 战略定位立得住 (AI-Native Workspace),信息架构重塑够彻底,吸收了 v1.0 所有 P0/P1 改进;但**工程实现细节不到位**,26 commit 实施路线过于理想,缺后端能力对接,缺老用户迁移具体方案。

---

## 做得好的 (🟢 亮点)

### 1. 战略定位"AI-Native Workspace"立得住
- 不是"AI 桌面助手"这种空话,是"任务流 + AI 协作可见化"
- 跟 Linear/Cursor/Raycast 对标清晰,差异化明显:"AI 是协作方,不是工具"
- **这是 v1.0 完全没有的维度** — v1.0 只在 token 层面修,v2.0 重新想产品

### 2. 14 → 4 路由改造是真正的"重设计"
- 砍 5 个 devOnly + Dashboard + ClawHub + IM 独立页面 → 4 工作区
- 整合逻辑清楚:功能相近的合并,核心的留作工作区
- **对标 Notion/Cursor 都有"几个工作区切换 + 主区"模式**

### 3. 三栏布局 + AI 协作右栏是最大创新
- 240 / 主 / 320 比例合理
- AI 状态全局可见(顶栏徽章 + 右栏)
- 4 状态视觉化(空闲/思考/执行/完成)
- **PiPiClaw 差异化价值在这里** — 其他 AI 工具没有"AI 协作面板常驻可见"

### 4. 吸收了 v1.0 所有 P0/P1 改进
- focus-visible ✓
- 字号数学错误修正(t-shirt 命名) ✓
- 4 状态组件补全 ✓
- prefers-reduced-motion 颗粒度 ✓
- SR 5 场景 ✓
- 路由 0ms → 80ms ✓
- 路由引用 Linear 错误修正 ✓
- 同色相 accent ✓
- Card hover 改 Linear 路线 ✓
- Modal 改纯 fade ✓
- Drawer 400ms → 240ms ✓
- Command Palette 200/200 对称 ✓
- Stream 3 圆点 → shimmer 文字流 ✓
- 暗色 HSL 调色公式 ✓

### 5. 4 个 AI 专属组件是真实价值
- ThinkingIndicator (shimmer 文字流)
- ToolCallCard (4 状态)
- MemoryChip
- SkillCard

**这 4 个组件是"AI 工具该有的视觉语言"**,不是装饰。

### 6. 6 周 26 commit 实施路线有节奏
- 第 1 周: 视觉语言 (基础)
- 第 2 周: 信息架构 (重塑)
- 第 3 周: AI 组件 (价值)
- 第 4 周: 核心组件 (打磨)
- 第 5 周: 动效 + a11y (合规)
- 第 6 周: 性能 + ship (验证)

**节奏合理**,每周有 ship 节点。

---

## 做得不够的 (🟡 升级点)

### 1. **后端能力对接没说清** 🟡
- 4 个 AI 专属组件 (ThinkingIndicator / ToolCallCard / MemoryChip / SkillCard) 需要后端 IPC 事件
- 现在 LlmAgentBrain 输出是字符串,ThinkingIndicator 需要结构化事件 `{type: 'thinking', content: '...'}`
- ToolCallCard 需要工具调用结构化数据
- MemoryChip 需要记忆 API

**修补方向**: 补一节"后端 IPC 改造",列出 v4.3.x 现在的 LlmAgentBrain 怎么改造成 emit 结构化事件

### 2. **Tab 系统的"Code/Memory/Tools/Files"具体内容没说** 🟡
- 4 周里说"主区 Tab 系统: Chat/Code/Memory/Tools/Files 5 个 Tab"
- 但 Code Tab 是 Monaco 还是 textarea?还是嵌入式 IDE?
- Memory Tab 是怎么呈现?时间线?网格?
- Tools Tab 是怎么排序?
- Files Tab 是怎么上传?

**修补方向**: 补"5 Tab 详细规格",每个 Tab 至少 1 段具体描述

### 3. **老用户迁移具体方案没说** 🟡
- 14 → 4 路由改造:老用户的 `/skills/abc` 怎么跳到新 `/skills`?
- 5 套主题被砍:老用户配置 `theme: 'purple'` 怎么办?
- 跨版本升级:从 v4.3.1 直接跳到 v4.4.0,配置文件 schema 怎么兼容?

**修补方向**: 补"v4.3.1 → v4.4.0 迁移方案",至少:
- 路由 redirect 表
- 主题配置映射表
- 配置文件 schema 兼容

### 4. **三栏布局的响应式没说清** 🟡
- 主方案说 < 1280px 右栏自动折叠
- 但 1024 × 768 是常见笔记本分辨率,主区会被挤压
- 移动端 / 平板怎么办?(虽然 PiPiClaw 是桌面 app,但 Electron 也可能跑 web)
- 窗口拖拽改大小时,三栏宽度怎么响应?

**修补方向**: 补"三栏响应式",至少 3 个断点:
- ≥ 1440px: 三栏全展开
- 1280-1440px: 三栏但可调
- 1024-1280px: 右栏默认折叠
- < 1024px: 移动布局(可能不支持)

### 5. **StatusBar 24px 信息密度不够** 🟡
- 24px 高要装"模型 + 网络 + 权限 + 快捷键"4 段
- 4 段挤在 24px 会很乱
- 没考虑 StatusBar 元素超出宽度时怎么办

**修补方向**: 补"StatusBar 信息架构",元素优先级 + 折叠策略

### 6. **AI 协作右栏的"主动建议"逻辑没说** 🟡
- 6.6 节说"AI 主动建议以卡片形式插入"
- 但什么时候插入?基于什么信号?用户可配置吗?
- 主动建议 = 烦人 = 关闭,这是 AI 工具常见反模式

**修补方向**: 补"AI 主动建议触发条件 + 用户配置",至少:
- 触发:AI 完成任务后,检测上下文相关性
- 配置:用户可关 / 调频率
- 节奏:不连续打扰,5 分钟内最多 1 次

### 7. **4 状态视觉化 (空闲/思考/执行/完成) 的过渡没说** 🟡
- 4 状态间怎么切换?
- 思考 → 执行的过渡是不是要明确视觉?现在没说
- 多任务并发时(用户问了 2 个问题,1 个思考中 1 个已完成)怎么呈现?

**修补方向**: 补"4 状态过渡 + 并发任务"规格

### 8. **bundle 拆包的具体方案不细** 🟡
- 9.2 节列了 6 个 chunk,但没说 vite manualChunks 怎么配
- 没说哪些第三方库单独拆
- 没说 vendor 怎么切

**修补方向**: 补"vite.config manualChunks 配置示例"

---

## 真正的硬伤 (🔴 必须改)

### 1. **26 commit 集成风险没说灰度策略** 🔴
- v4.4.0 直接从 v4.3.1 跳,中间没有 beta
- 26 commit 一波推上去,出 bug 难回滚
- 没考虑"v4.4.0-beta.1 / beta.2 / rc.1"节奏

**修补方向**: 补"发布节奏":
- 第 1-3 周:每周内部 alpha
- 第 4-5 周:用户 beta (auto-update channel = beta)
- 第 6 周:RC + ship

### 2. **没考虑 Electron 多窗口的兼容** 🔴
- 现在 PiPiClaw 是单窗口
- v2.0 顶栏 + 三栏布局,如果未来要支持"主窗口 + 任务窗口"怎么办?
- 单窗口的 router push 在多窗口架构下要重写

**修补方向**: 补"未来多窗口兼容",至少:
- 状态用 Pinia 全局管理,不绑死在 window
- 路由用 hash 模式(不依赖 history)

### 3. **没考虑 macOS / Windows 平台差异** 🔴
- v2.0 是 6 周精致版,但只说"macOS focus ring 可保留,Windows 高对比度"
- TitleBar 在 macOS 用 traffic light,在 Windows 用 4 按钮
- 顶栏 48px 高度在 macOS retina 下要调
- 快捷键 Cmd vs Ctrl 全程没提

**修补方向**: 补"平台差异规格"表:
- macOS: 顶栏 28px (避开 traffic light), Cmd 快捷键
- Windows: 顶栏 32px, Ctrl 快捷键
- 高对比度模式 fallback

### 4. **"5 Tab" 缺一个:Files 不一定是合理 Tab** 🔴
- 5 Tab: Chat / Code / Memory / Tools / Files
- Files 是不是过度拆分?用户上传 1 个文件是不是要专门一个 Tab?
- Linear/Cursor 没有 "Files" Tab,文件是 attach 到 chat 的

**修补方向**: 砍掉 Files Tab,改为 Chat 的附件功能;5 Tab → 4 Tab

### 5. **6 周从 0 到 v4.4.0 太赶,缺"先做哪 5 个 commit"** 🔴
- 用户已经 ship v4.3.1,要等 6 周才有 v4.4.0
- 6 周内用户的体验提升是 0 (本地代码可能未 commit 也可能未 push)
- 应该先 ship 1 个小版本(2-3 commit)给用户提反馈,再 ship 大版本

**修补方向**: 调整实施路线:
- **Week 0** (本周): 5 commit MVP 单独 ship 一个小版本 (视觉 + 主题砍 5 套)
- **Week 1-3**: 信息架构 + AI 组件
- **Week 4-5**: 动效 + a11y
- **Week 6**: 性能 + ship

---

## 自评打分明细

| 维度 | 评分 | 说明 |
|---|---|---|
| 战略定位 | 9/10 | AI-Native Workspace 立得住,有差异化 |
| 信息架构 | 8/10 | 14→4 + 三栏 + Tab 思路对,细节不够 |
| 视觉语言 v2 | 9/10 | 吸收 v1.0 P0,双字体,same-hue accent |
| 核心组件 v2 | 7/10 | 4 AI 组件新意够,但依赖后端结构化事件 |
| 动效 v2 | 9/10 | 修了 v1.0 全部反模式,shimmer stream |
| 加载 v2 | 8/10 | 4+1 模式,thinking 独立 |
| 交互模式 v2 | 7/10 | AI 右栏新意,主动建议逻辑没说 |
| 主题 v2 | 8/10 | 砍 5 套,迁移方案没说 |
| 无障碍 v2 | 8/10 | 修了 v1.0 全部 P0 |
| 性能 v2 | 7/10 | bundle 拆分有思路,manualChunks 配置没说 |
| 实施路线 | 6/10 | 26 commit 节奏对,缺灰度 |
| 工程风险 | 5/10 | 缺多窗口 / 平台差异 / 后端对接 |
| **总评** | **7.0/10** | 战略对,实施细节缺 |

---

## 修补优先级

### P0 (必须补,否则不建议开干)
1. 后端 IPC 改造(4 AI 组件依赖结构化事件)
2. 5 Tab 详细规格(尤其 Code/Memory/Tools)
3. v4.3.1 → v4.4.0 老用户迁移方案
4. 26 commit 灰度发布节奏
5. macOS / Windows 平台差异
6. 三栏响应式(3 断点)
7. 砍 Files Tab(过度拆分)

### P1 (重要补充,提升方案完整度)
8. AI 主动建议触发逻辑
9. 4 状态过渡 + 并发任务
10. StatusBar 信息架构
11. vite manualChunks 配置示例
12. bundle 拆分 + 路由懒加载具体方案
13. 多窗口兼容(状态层 + hash router)

### P2 (加分项)
14. AI 协作右栏的 4 状态详细视觉稿
15. 5 Tab 的键盘切换 (Cmd+1~5)
16. 顶栏 AI 状态徽章具体设计

---

## 总结

**v2.0 战略对路,信息架构重塑够狠,但工程实现细节缺一半**。

**最大盲区**: 我又没看到的硬伤在 5 Tab 设计(Code/Memory/Tools 怎么实现) 和 后端结构化事件(4 AI 组件的依赖)。

**跟 v1.0 比**: v1.0 是"原则对细节错",v2.0 是"战略对工程错"。v2.0 比 v1.0 站位高,但实施风险更大。

**适不适合开始 26 commit 实施**: **不适合直接开干**,需要补 7 个 P0 才能稳。

**适不适合作为 v4.4.0 候选方案**: 适合,但要 v2.1 修订 P0 后再开始 commit。
