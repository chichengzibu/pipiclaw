# PiPiClaw 重设计 v2.0 方向

> **关系**: 接 `design-proposal-v1.md` (token/组件/动效) 之后,**重新思考 PiPiClaw 该长成什么样**
> **作者**: Mavis
> **日期**: 2026-07-28
> **路线**: 大刀阔斧重设计 (用户拍板)
> **v1.0 的命运**: v1.0 是"在现有上加" → v2.0 是"如果 PiPiClaw 明天重新发布"

---

## 0. 重设计的本质

v1.0 解决的是"现在 UI 不够工程师友好,加 token 体系"——这是**工程优化**。
v2.0 要解决的是"**PiPiClaw 作为 AI 桌面工具,核心定位是什么?应该给用户什么独特价值?**"——这是**产品重定位**。

一句话: **v1.0 是装修,v2.0 是拆墙重新盖。**

---

## 1. 现在 PiPiClaw 是什么样 (现状诊断)

### 1.1 当前架构
- **14 个独立路由**: Dashboard / Chat / Skills / Models / ClawHub / IM / Settings / 7 个 devOnly
- **侧边栏**: 14 个图标 + 标签
- **主区**: 单页面填充
- **顶部**: TitleBar + 路由面包屑
- **AI 入口**: 散落在 Chat、IM、Agent 各处

### 1.2 问题 (从用户视角)
- **任务被路由切碎**: 用户想"用 AI 帮写代码",要 Chat → 选模型 → 写 prompt → 看结果,流程断裂
- **AI 是工具,不是协作方**: 现在 PiPiClaw 把 AI 当成"问问题的对象",而不是"一起干活的搭档"
- **状态分散**: 模型状态在 Models 页、技能状态在 Skills 页、权限在 Settings 页,用户在主区工作时不知道后台在干嘛
- **信息密度 vs 单调**: 列表很密集,但操作面板很大空白(像 Material)

### 1.3 跟头部产品的差距

| 产品 | 核心定位 | 信息架构 | AI 角色 |
|---|---|---|---|
| **Cursor** | 程序员 AI IDE | 编辑器 + AI 侧栏(可隐藏) | 协作方(可以改代码) |
| **Linear** | 任务管理 | 列表 + 详情 + 命令面板 | 自动化(创建/分配任务) |
| **Raycast** | 启动器 + 工具集 | 命令面板 + 扩展 | 工具(执行命令) |
| **Notion** | 文档协作 | 块 + 页面 + 协作 | AI 写作伙伴 |
| **PiPiClaw (当前)** | **AI 桌面助手** | **14 路由平铺** | **问问题的对象** |

**问题**: PiPiClaw 的定位"AI 桌面助手"听起来跟 OpenAI ChatGPT 桌面版没区别,**没有独特价值**。

---

## 2. 重设计 3 个核心方向 (请选 1)

### 方向 A: AI-Native Workspace (Linear 路线)
**核心**: PiPiClaw 是"AI 协作的工作台",所有任务围绕 AI 展开

- **信息架构**:
  ```
  ┌─ 全局顶栏 (Cmd+K + 当前会话 + AI 状态)
  ├─ 左: 会话/任务流 (Linear 风格列表,可拖拽)
  ├─ 中: 主工作区 (Chat / Code / Skills 共享区域,Tab 切换)
  ├─ 右: AI 协作面板 (可隐藏,显示思考/工具/记忆)
  └─ 底: StatusBar (模型/网络/权限/快捷键)
  ```
- **AI 角色**: 协作者 (用户在工作,AI 主动建议)
- **关键改造**:
  - 14 路由 → 4 主区 (Chat / Workspace / Skills / Settings)
  - 顶部栏永远是 Cmd+K + 当前上下文
  - AI 状态全局可见
- **对标**: Cursor + Linear 混合
- **风险**: 大改路由,旧 URL 全失效
- **预计工时**: 4-6 周,30+ commit

### 方向 B: Command-First Launcher (Raycast 路线)
**核心**: PiPiClaw 是"AI 增强的启动器",Cmd+K 是一切入口

- **信息架构**:
  ```
  默认隐藏主窗口
  Cmd+Alt+P → 调出命令面板
  命令面板 = AI 输入 + 命令搜索 + 快速操作
  Enter → 执行(打开应用/执行命令/问 AI/跑技能)
  ```
- **AI 角色**: 工具 (用户主动调用)
- **关键改造**:
  - 主窗口默认隐藏,常驻任务栏
  - Cmd+K 是一切入口,不是"快捷键"
  - AI 是命令面板里的一个命令("Ask AI: ...")
- **对标**: Raycast + Spotlight
- **风险**: 用户习惯要重塑,新用户上手成本高
- **预计工时**: 3-4 周,20+ commit

### 方向 C: 三栏任务中心 (Notion + Cursor 路线)
**核心**: PiPiClaw 是"AI 桌面控制中心",管理所有 AI 任务

- **信息架构**:
  ```
  ┌─ 顶栏 (Logo + 全局搜索 + AI 状态)
  ├─ 左栏 (240px): 工作区切换 (Chat / Skills / Models / IM / Tasks)
  ├─ 中栏 (主): 任务流 (会话列表 + 任务卡片)
  ├─ 右栏 (320px, 可关): 任务详情 + AI 操作面板
  └─ 底栏: StatusBar
  ```
- **AI 角色**: 智能体 (每个任务有 AI 状态: 思考中/执行中/待审阅/已完成)
- **关键改造**:
  - 三栏布局,右栏是 AI 操作核心
  - 任务有 4 状态视觉化(用 stream 4 模式映射)
  - 路由变成"工作区切换"而不是"页面跳转"
- **对标**: Notion 三栏 + Cursor AI 面板
- **风险**: 中等,需要重做布局但不破路由
- **预计工时**: 4-5 周,25+ commit

---

## 3. 共同的设计语言 (无论选哪个方向都做)

不管选 A/B/C,以下 6 项都做,这些是 v1.0 升级版:

### 3.1 视觉语言 v2
- **1 套深色 + 1 套浅色**,不再 5 套
- **字体**: Inter → Geist Mono (代码区) + Inter (UI 区),**双字体**
- **密度**: 默认 13px body,8px 间距起步
- **accent**: 同色相仅调亮度(light indigo-500, dark indigo-400)
- **radius**: 4 档(4/8/12/999)

### 3.2 核心组件 v2 (在 v1.0 基础上补)
- **补状态组件**: OfflineBar / PermissionPrompt / QuotaBar / ModelStatus
- **补 AI 专属组件**:
  - `<ThinkingIndicator>` (AI 思考中,shimmer 文字流)
  - `<ToolCallCard>` (工具调用,带状态 4 色)
  - `<MemoryChip>` (记忆标签,可点击展开)
  - `<SkillCard>` (技能卡片,Linear 风格)
- **改 Card hover**: 砍掉 translateY,只改 border-color

### 3.3 动效 v2
- **focus-visible** (替换"永远可见")
- **路由 80ms crossfade** (替换 0ms)
- **Modal 200ms fade only** (替换 280ms scale)
- **Command Palette 200/200 对称** (替换 200/100 不对称)
- **Stream shimmer 文字流** (替换 3 圆点)

### 3.4 加载 v2
- 4 模式保留: spinner / skeleton / progress / stream
- **新增 "thinking" 5 模式** (shimmer 文字流,Cursor 路线)
- **prefers-reduced-motion**: 保留 functional animation,禁 transform 装饰

### 3.5 a11y v2
- focus-visible 全站应用
- 屏幕阅读器 5 场景补全
- macOS / Windows 平台 focus ring 差异
- skip-to-content 链接

### 3.6 性能 v2
- LCP < 1.5s
- 命令面板 enter < 200ms (P90)
- 路由切换 80ms
- bundle 拆包: 主区 / 命令面板 / AI 渲染分离

---

## 4. 重设计 v2.0 的 token (替换 v1.0)

| 项 | v1.0 | v2.0 (重设计版) | 改变原因 |
|---|---|---|---|
| 主题 | 5 套 → 2 套 | **强制 1+1** (深色优先) | 决策疲劳 |
| 字号 | 8 档(数学错) | **7 档 t-shirt 命名** (xs/sm/base/md/lg/xl/2xl) | 工程化 + Linear 对齐 |
| Spacing | 8 档含 0.5 | **2 套**: 组件内 (1-4) + 章节间 (6-16) | shadcn 路线 |
| 字体 | Inter | **Geist Mono + Inter** | AI 工具标配双字体 |
| Accent | 跨色相 (indigo↔purple) | **同色相仅调亮度** | 品牌识别 |
| Motion | 4 duration × 3 easing | **2 套**: fast (120) / base (200),**禁 ≥300ms** | 极简 |
| Radius | 4 档 | 4 档 (保留) | 已合理 |

---

## 5. 决策点: 选 A / B / C

**这是 v2.0 最关键的决策**,定下来后其他都顺着做。

### 我的建议: **方向 C (三栏任务中心)**

**理由**:
1. **风险最低**: 现有 14 路由可以保留为"工作区"切换,主区改布局不破路由
2. **改造最彻底**: 信息架构变,但用户路径不破
3. **AI 价值最显**: 右栏 AI 协作面板让 AI 不再是"问的对象",而是"看的到的协作者"
4. **对标 Notion + Cursor**: 都是已经验证过的模式
5. **工时适中**: 4-5 周,25 commit,跟 v4.3 → v4.4 节奏吻合

**A 太猛** (改路由,风险高),**B 太离经叛道** (默认隐藏窗口,新用户门槛高),**C 刚好**。

---

## 6. 如果选 C,4 周实施路线

### 第 1 周: 视觉语言 v2
1. `feat(theme): 强制 light + dark 2 套,删除 3 套彩色主题`
2. `feat(font): Geist Mono + Inter 双字体加载`
3. `feat(tokens): 重构 CSS 变量,7 档 t-shirt 字号 + 2 套 spacing`
4. `feat(accent): 同色相跨主题,只调亮度`

### 第 2 周: 三栏布局
5. `feat(layout): AppLayout 三栏 (240/主/320)`
6. `feat(sidenav): 14 路由 → 5 工作区切换 (Chat/Workspace/Skills/Models/Settings)`
7. `feat(rightpanel): AI 协作面板,空/思考/执行/完成 4 状态`
8. `feat(statusbar): 底部 StatusBar (模型/网络/权限/快捷键)`

### 第 3 周: AI 专属组件
9. `feat(thinking): ThinkingIndicator shimmer 文字流`
10. `feat(toolcall): ToolCallCard 4 状态色`
11. `feat(memory): MemoryChip + 记忆面板`
12. `feat(skill): SkillCard Linear 风格`

### 第 4 周: 动效 + a11y + 性能
13. `feat(focus): focus-visible 全站替换`
14. `feat(routing): 80ms crossfade`
15. `feat(motion): 禁 ≥300ms 动画,Drawer 改 240ms`
16. `feat(reduced-motion): 颗粒度,保留 functional`
17. `feat(a11y): 屏幕阅读器 5 场景 + skip-link`
18. `feat(perf): bundle 拆包 + 路由懒加载`

**总计 18 commit / 4 周 / v4.4.0 ship**。

---

## 7. 我需要你拍板的 3 件事

1. **方向 A / B / C 选哪个?**
   - 我建议 C (三栏任务中心)
2. **工期 4 周可以吗?** 还是 2 周(精简版)/6 周(精致版)
3. **是否需要保留 v4.3.1 的 5 套主题作为"老用户迁移选项"?** 还是直接砍掉

---

## 8. 评估

| 评估项 | 评分 | 说明 |
|---|---|---|
| 站位 | 8/10 | 信息架构重定位站位高,跟 Linear/Cursor 对齐 |
| 可执行性 | 7/10 | 4 周 18 commit 可行,选 C 风险最低 |
| 创新度 | 6/10 | 三栏布局不新,Notion/Cursor 验证过,稳定但非破局 |
| 跟现状兼容 | 8/10 | 选 C 兼容现有 14 路由,A/B 风险大 |
| 差异化 | 7/10 | "AI 协作面板可见化"是 PiPiClaw 独特价值 |
| **总评** | **7.2/10** | 推荐选 C,4 周可 ship |

---

**下一步**: 等你拍板 A/B/C,然后我开干。
