# PiPiClaw 重设计 v2.1 · 改稿方案

> **关系**: 接 `redesign-v2-spec.md` (v2.0 详细方案)
> **基于**: v2.0 self-review (owner 7.0) + v2.0 designer-review (5.5) + v2.0 final-review (5.8)
> **目标**: 修 5 P0 + 6 P1 + 4 owner 补 = 15 项改稿,出 ship-ready
> **作者**: Mavis
> **日期**: 2026-07-28

---

## 0. v2.0 → v2.1 改稿总览

| # | 类别 | 改稿 | 来源 | 状态 |
|---|---|---|---|---|
| **P0-1** | 架构 | 右栏默认展开 → **默认折叠** | designer C-1 | ✅ 必改 |
| **P0-2** | 架构 | 5 Tab → **1 主区 + 3 辅助面板 + 砍 Files** | designer B-2 | ✅ 必改 |
| **P0-3** | 状态机 | 4 状态 → **5 状态加"待审阅"** | designer C-3 | ✅ 必改 |
| **P0-4** | 组件 | ThinkingIndicator 砍**文字翻牌** | designer D-1 | ✅ 必改 |
| **P0-5** | 字体 | Inter 中文 fallback → **双语字体方案** | designer E-1 | ✅ 必改 |
| **P1-1** | 导航 | 4 工作区平铺 → **树形 + 顶栏固定** | designer B-1 | 🟡 建议改 |
| **P1-2** | AI 模式 | 主动建议弹窗 → **内嵌系统消息** | designer C-4 | 🟡 建议改 |
| **P1-3** | 响应式 | < 1280 自动折叠 → **3 断点具体化** | designer F-3 | 🟡 建议改 |
| **P1-4** | 组件 | ToolCallCard 4 状态 → **5 状态 + 默认折叠** | designer D-2 | 🟡 建议改 |
| **P1-5** | 组件 | MemoryChip 3 档没说 → **系统自动评分 + 用户覆盖** | designer D-3 | 🟡 建议改 |
| **P1-6** | 发布 | 26 commit 直接 ship → **灰度发布节奏** | designer F-1 | 🟡 建议改 |
| **补-1** | 工程 | 后端 IPC 改造方案 (4 AI 组件依赖) | owner | 🟡 补 |
| **补-2** | 迁移 | v4.3.1 → v4.4.0 老用户迁移 (路由/主题) | owner | 🟡 补 |
| **补-3** | 平台 | macOS / Windows 平台差异 (顶栏/快捷键/高对比度) | owner | 🟡 补 |
| **补-4** | 工程 | vite manualChunks + 路由懒加载具体配置 | owner | 🟡 补 |

**总计 15 项**,3-4 天改稿,出 v2.1 ship-ready。

---

## 1. 战略定位 (修 v2.0 偏差)

### 1.1 v2.0 错在哪
v2.0 写"AI 是用户的主协作方,不是工具箱"——**这是 2024 共识,不是差异化**。Cursor/Continue.dev/Cody/Notion AI 全部这样定位。

### 1.2 v2.1 真差异化
**"PiPiClaw 是唯一让 AI 协作过程可见的工作台"**——产品定义,不是功能描述。

具体说:
- Cursor 把 AI 藏在 chat 里(隐藏式协作)
- Notion AI 嵌在 paragraph 里(被动触发)
- Continue.dev 让 AI 在侧栏(无状态可见)
- **PiPiClaw 把"AI 在干嘛"做成全局可见 + 主动可视化**——思考过程、工具调用、记忆引用、待审阅

### 1.3 改稿影响
- 战略一句话替换 v2.0 0.1 节
- 0.3 节去掉"PiPiClaw = Linear + Cursor + Raycast"组合式描述
- 加 1.4 节"AI 协作可视化的 4 个具体形式"

### 1.4 AI 协作可视化的 4 个形式

| 形式 | 视觉 | 触发 |
|---|---|---|
| **思考可见** | ThinkingIndicator + reasoning 摘要 | AI 思考时 |
| **工具可见** | ToolCallCard 实时状态 + 进度 | AI 调工具时 |
| **记忆可见** | MemoryChip 引用高亮 | AI 用记忆时 |
| **审阅可见** | 5 状态"待审阅"卡片 | AI 完成时 |

**4 个形式 = 4 个差异化护城河**,对应 4 个 AI 专属组件(已存在于 v2.0 3.3 节,需 v2.1 重做 ThinkingIndicator 和 ToolCallCard)。

---

## 2. 信息架构 (修 v2.0 错误)

### 2.1 整体布局 (v2.1)

```
┌─────────────────────────────────────────────────────────────────┐
│ [顶栏 48px] Logo · 工作区切换 (固定) · 当前任务 · AI 状态徽章 ·  │  ← 顶栏固定
├──────────┬──────────────────────────────────┬───────────────────┤
│          │                                  │                   │
│  [左栏]  │  [主区 自适应]                    │  [右栏 320px]     │
│  240px   │                                  │  **默认折叠**      │
│  任务树  │  常驻 Chat (任务主线)             │  Cmd+L 打开       │
│  顶部固定│  + 3 辅助面板(Code/Memory/Tools) │  宽度可拖          │
│  Logo/搜索│ 右滑入,不占 Tab 槽位              │                   │
│  /视图   │                                  │  4 状态视觉化      │
│          │                                  │  (空闲/思考/执行/  │
│          │                                  │   待审阅/完成)     │
├──────────┴──────────────────────────────────┴───────────────────┤
│ [底栏 24px] 模型: qwen3:14b · 网络: ✓ · 权限: 开放 · ⌘L AI · ⌘K │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 P0-1 修:右栏默认折叠 (Cursor 路线)

**v2.0 错**: 1.1/1.4 节"右栏 320px 默认展开"——反 Cursor 路线,占 25% 屏幕

**v2.1 改**:
- **默认折叠** (核心修改)
- **顶栏 AI 状态徽章 = 状态显示 + 入口**
  - 状态点(4 色)+ 状态文字("Thinking..." / "Executing..." / "Done")
  - 点击或 Cmd+L 打开右栏
  - 打开后宽度可拖
- **右栏职责**: 详细面板 (ToolCallCard 列表 / MemoryChip 列表 / 待审阅队列)
- **不在右栏时**: 状态信息通过顶栏徽章 + Chat 流里的"系统消息"可见

**对照**:
- Cursor: Cmd+L 默认关 ✅
- VS Code Copilot: 默认关 ✅
- Continue.dev: 默认关 ✅
- Raycast AI: 弹出窗口 ✅
- Notion / Linear: 无 AI 协作右栏(AI 嵌内容) ✅

**PiPiClaw**: Cmd+L 默认关(对标) + 顶栏徽章做入口(差异化)

### 2.3 P0-2 修:5 Tab → 1 主区 + 3 辅助面板 + 砍 Files

**v2.0 错**: 1.3 节"5 Tab (Chat/Code/Memory/Tools/Files) + 拖拽/中键关闭/双击重命名"——浏览器 Tab 类比错

**v2.1 改**:
- **主区常驻 Chat** (任务主线,不切换)
- **3 辅助面板** (右滑打开,不占 Tab):
  - **Code 面板** (从右滑入,300ms): 若任务涉及代码,显示产物
  - **Memory 面板** (从右滑入,300ms): 查看/管理当前任务记忆
  - **Tools 面板** (从右滑入,300ms): 工具调用历史
- **砍 Files** — 改用 Chat 附件:
  - 文件上传 → 显示在 Chat 消息卡片
  - 文件元信息(类型/大小/时间)在卡片上
  - 点击卡片 → 在 Memory 面板展开

**为什么砍 Files Tab**:
- 文件是**附件**,绑在消息/任务上,不是独立维度
- Linear/Cursor/Notion/Raycast 都没有 "Files Tab"
- "我刚上传了 1 张图" 不需要开 1 个 Tab 来管

**主区 5 状态对应交互** (替换 v2.0 Tab 切换):
| 状态 | 主区显示 | 辅助面板 |
|---|---|---|
| 空闲 | Chat 输入框 | 无 |
| 思考 | Chat 流底部 ThinkingIndicator | Tools 面板可开 |
| 执行 | Chat 流底部 ToolCallCard | Tools 面板自动开 |
| 待审阅 | Chat 流系统消息 | 右栏自动开 (待审阅队列) |
| 完成 | Chat 流继续 | 无 |

### 2.4 P1-1 修:4 工作区树形 (Linear 路线)

**v2.0 错**: 1.2 节"4 工作区切换"——切工作区丢上下文(选中态/滚动位置/筛选)

**v2.1 改**:
- **顶栏固定 4 工作区入口** (Logo 右边)
  - Workspace / Skills / Models / Settings
  - 永远显示,不随内容变
  - 当前激活高亮
- **左栏顶部固定头部** (不随工作区变)
  - Logo / 搜索框 / 视图切换
- **左栏中下部随工作区变** (任务流 / 技能列表 / 模型列表)
- **4 工作区不是平铺切换**,是"上下文切换",但左栏头部固定保证导航不丢

**对照**:
- Linear: 顶栏固定 + 中栏随视图变(无工作区切换概念)
- Notion: 左栏顶部固定 Logo/搜索/收藏,中栏随页面变
- PiPiClaw v2.1: 顶栏 4 工作区固定 + 左栏顶部固定 + 中下部随工作区变

### 2.5 路由改造 (14 → 4 + 主区)

**v2.0 改造 → v2.1 不变**:
- `/dashboard` 删
- `/chat` → `/workspace/:taskId/chat` (主区常驻)
- `/skills` → `/skills` (工作区)
- `/models` → `/models` (工作区)
- `/settings` → `/settings` (工作区)
- IM 合并到右栏通知 + 顶栏图标
- ClawHub 合并到 Skills 子页
- 7 个 devOnly 删

**v2.1 加辅助面板路由** (不是 Tab,是 panel):
- `/workspace/:taskId/code` → Code 面板右滑
- `/workspace/:taskId/memory` → Memory 面板右滑
- `/workspace/:taskId/tools` → Tools 面板右滑

**重定向** (老用户迁移,见 补-2):
- `/chat/:id` → `/workspace/:taskId/chat/:convId`
- `/skills/abc` → `/skills/abc` (保留,工作区内路由)
- `/im/abc` → 右栏 IM 通知 (无独立页面)

---

## 3. AI 协作右栏 (v2.1 重做)

### 3.1 状态机: 4 → 5 状态 (P0-3)

**v2.0 错**: 1.4 节"4 状态(空闲/思考/执行/完成)"——缺"待审阅"

**v2.1 5 状态**:

| 状态 | 视觉 | 触发 | 下一步 |
|---|---|---|---|
| **空闲** | 头像 + "Ask AI anything..." | 无 AI 活动 | 输入即问 |
| **思考** | 静态文字 "Thinking..." + 1.5s 慢速光标扫过 (P0-4) | AI 接收 prompt 后 | 进入"执行"或"完成" |
| **执行** | ToolCallCard 列表 + 实时进度条 | AI 调工具 | 回到"思考"或"完成"或"待审阅" |
| **待审阅** ⭐ | Apply / Reject 按钮 + 结果预览 (P0-3 新) | AI 完成破坏性操作(改文件/删文件) | 用户点 Apply → "完成" / Reject → "空闲" |
| **完成** | 总结卡片 + 状态点 | AI 完成(无破坏性操作) | 回到"空闲" |

**"待审阅"为什么是 P0**:
- AI 工具的常见 pattern: AI 自动完成 → 用户确认才落地
- Cursor "Apply/Reject" / Vercel v0 "Regenerate/Use this" / GitHub Copilot Workspace
- PiPiClaw 缺"待审阅"= AI 自动改代码/删文件/发消息用户无确认 = 危险设计

**4 状态 → 5 状态迁移**:
- 老 v2.0 "完成" 拆成:
  - 无破坏性操作 → 5 状态"完成"
  - 有破坏性操作 → 5 状态"待审阅"

### 3.2 右栏面板 (P0-1 实施细节)

**默认折叠,Cmd+L 打开**:

打开后右栏显示 4 段:
1. **AI 状态指示** (顶部 32px): 5 状态徽章 + 切换按钮
2. **当前任务进度** (中间): ThinkingIndicator / ToolCallCard 列表
3. **待审阅队列** (新): Apply/Reject 按钮组
4. **记忆引用** (底部): MemoryChip 列表(可滚动)

**关闭方式**:
- Cmd+L 再次按
- 顶栏徽章点击(切换)
- ESC (不冲突其他 modal)
- 关闭后状态记忆(下次打开恢复)

**宽度可拖**:
- 默认 320px
- 拖拽范围 240-480px
- 宽度持久化到 localStorage

### 3.3 顶栏 AI 状态徽章 (P0-1 实施细节)

**位置**: 顶栏右区,Cmd+K 入口左边

**视觉** (5 状态对应):
| 状态 | 徽章 |
|---|---|
| 空闲 | 灰色圆点 + "AI idle" |
| 思考 | 紫色 pulse 圆点 + "Thinking..." (1.5s 慢速) |
| 执行 | 蓝色 pulse 圆点 + "Executing 1 tool..." |
| 待审阅 | 黄色 +1 徽章 + "1 review pending" |
| 完成 | 绿色 2s 后回到 "AI idle" |

**交互**:
- 点击 → 切换右栏开/关
- hover → tooltip 显示详细状态
- +1 待审阅 → 红点闪烁吸引注意 (200ms 闪 3 次)

### 3.4 主动建议改内嵌 (P1-2)

**v2.0 错**: 6.6 节"AI 主动建议以卡片形式插入"——反模式(Slackbot/Cortana/Clippy 都死在这)

**v2.1 改**:
- **不做主动弹窗**
- AI 建议改用:
  1. **顶栏徽章 +1** (轻量提示)
  2. **Chat 流系统消息** (灰色,标 `[AI 建议]`,用户自然看到)
  3. **Cmd+Shift+A 打开"AI 最近活动"面板** (临时,看完可关)
- **不打断用户**: AI 建议永远在主区可见,不在右栏主动弹

---

## 4. 4 AI 专属组件 (重做)

### 4.1 ThinkingIndicator (P0-4 重做)

**v2.0 错**: 3.3.1 节"80-300ms 随机切换文字"——垃圾动画

**v2.1 重做**:
- **静态文字** "Thinking..." (固定,不动)
- **光标**: 1.5s 慢速从左扫到右,再淡出(0.3s),再淡入(0.3s),循环
- **可选**: 显示最近 1 步 reasoning 摘要 (从 LLM 的 reasoning tokens 拿)
- **functional animation**: prefers-reduced-motion 下保留静态文字 + 静态光标点(不闪烁)

**对照**:
- Cursor: 静态文字 "Thinking..." + 不动画的灰点 ✅
- ChatGPT: 静态文字 "Reasoning..." + 圆点 ✅
- Claude.ai: 静态文字 + 渐变 pulse ✅
- Vercel v0: 静态文字 "Generating..." ✅

**v2.1 PiPiClaw**: 静态文字 + 1.5s 慢速光标 (Cursor 路线) ✅

### 4.2 ToolCallCard (P1-4 重做)

**v2.0 错**: 3.3.2 节"4 状态 + 完整参数结果"——5 状态缺 warning,默认展开占空间

**v2.1 重做**:
- **5 状态**: pending / running / success / **warning**(新) / error
- **默认折叠**: 只显示工具名 + 状态点 + 头部 Apply/Reject
- **点击展开**: 在右栏占 100% 宽度显示完整参数/结果
- **取消/重试** 在头部右上角小图标,不占底部
- **5 状态颜色**:
  - pending: 灰
  - running: 蓝 (pulse)
  - success: 绿
  - warning: 黄 (部分成功)
  - error: 红

### 4.3 MemoryChip (P1-5 补)

**v2.0 缺**: 3.3.3 节"3 档重要性没说谁决定"

**v2.1 补**:
- **系统自动评分** (基础分):
  - 出现频率 (40%): 这条记忆被引用次数
  - 时间衰减 (30%): 距离现在越近分越高
  - 任务相关性 (30%): 与当前任务相关度 (用 embedding 余弦相似度)
- **用户可覆盖**: 右键菜单"提升/降低"覆盖系统评分
- **3 档颜色**: 高 (accent) / 中 (gray) / 低 (gray-light)
- **hover tooltip**: 显示评分明细("基于 12 次引用 + 3 天前 + 相关度 0.87")

### 4.4 SkillCard (保持 v2.0)

**保留 v2.0 3.3.4 节**:
- 240×120 卡片网格
- Skills 工作区专用(不在右栏用)
- Linear 风格

---

## 5. 视觉语言 v2.1 (P0-5 中文字体)

### 5.1 v2.0 错: 中文 fallback 坑

v2.0 2.1 节"中文跟随 UI fallback"——Inter 不带中文,fallback 到思源黑体,中文字符宽度跟 Inter 拉丁字母不一致 → 中英混排行高错位。

### 5.2 v2.1 双语字体方案

| 用途 | 西文 | 中文 | Fallback |
|---|---|---|---|
| UI / 正文 | **Inter** | **HarmonyOS Sans SC** | PingFang SC / Microsoft YaHei |
| Code / 数据 | **Geist Mono** | **JetBrains Mono**(带中文) / 思源等宽 | - |

**HarmonyOS Sans SC**:
- 华为开源,中英双语
- 字形对齐 Inter 风格
- 字符宽度和 Inter 接近(中英混排不跳行)
- 免费商用

**字体加载**:
```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Variable.woff2') format('woff2-variations');
  font-display: swap;
  font-weight: 100 900;
}

@font-face {
  font-family: 'HarmonyOS Sans SC';
  src: url('/fonts/HarmonyOS-Sans-SC.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+4E00-9FFF; /* 中文字符范围 */
  font-weight: 300 700;
}
```

**font-family 栈**:
```css
--font-ui: 'Inter', 'HarmonyOS Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Source Code Pro', 'Consolas', monospace;
--font-cjk: 'HarmonyOS Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
```

**CSS font-feature-settings**:
```css
body {
  font-family: var(--font-ui);
  font-feature-settings: 'kern' 1, 'liga' 1;
  font-synthesis: none;
}
```

**接受宽度差异**:
- 思源黑体和 Inter 字符宽度仍不完全对齐
- 通过 `font-feature-settings 'palt' 1` (比例字距) 调
- 中文为主的界面用 `--font-cjk` 优先

### 5.3 其他视觉 token 不变

v2.0 2.2-2.7 节 token 系统 v2.1 全部保留:
- 7 档 t-shirt 字号
- 2 套 spacing (组件内 1-4, 章节间 6-16)
- 同色相 accent (indigo-500/indigo-400)
- 4 档 radius
- 暗色 shadow 公式 (opacity × 2 + inset border)
- 2 套 motion (fast 120ms / base 200ms)

---

## 6. 加载动画 v2.1 (修 v2.0)

### 6.1 Stream 加载 (修 v2.0)

v2.0 5.4 节"shimmer 文字流"——**保留**,这是 v2.0 修 v1.0 改对的部分。

### 6.2 Thinking 加载 (P0-4 重做)

v2.0 5.5 节"独立 thinking 模式"——**改成 v2.1 5.4 节**:
- 静态文字 "Thinking..." + 1.5s 慢速光标 (替换文字翻牌)
- 集成到 ThinkingIndicator 组件,不单独成节
- functional animation,reduced-motion 下保留

---

## 7. 响应式 (P1-3 3 断点)

### 7.1 v2.0 错: < 1280 自动折叠一句话带过

v2.0 11 节风险表"1024 拥挤 🔴 高"——没说 1024-1280 怎么办

### 7.2 v2.1 三栏 3 断点

| 断点 | 顶栏 | 左栏 | 主区 | 右栏 | 适用 |
|---|---|---|---|---|---|
| **≥ 1366px** | 48px | 240 | 自适应 | 320 默认开 | 大屏 |
| **1280-1366px** | 48px | 240 | 自适应 | 320 默认关 | 标准 |
| **1024-1280px** | 48px | 240 (可关汉堡) | 自适应 | 关闭 | 笔记本 |
| **< 1024px** | 48px | 关闭 | 自适应 | 关闭 | 小屏 |
| **< 768px** | 不支持,显示"请在桌面使用" | | | | |

**主区宽度计算** (1366 起):
- 1366 - 48 - 24 - 240 - 320 = 734 (可接受)
- 1366 - 48 - 24 - 240 - 0 = 1054 (好)

**主区宽度计算** (1024):
- 1024 - 48 - 24 - 240 - 0 = 712 (可)
- 1024 - 48 - 24 - 0 - 0 = 952 (好但左栏没了)

**左栏能藏吗?**
- PiPiClaw 是任务流驱动,左栏是核心
- 藏左栏 = 用户看不到任务列表 = 失去主导航
- **左栏在 1024-1280 可关(汉堡菜单),但默认开**

**右栏能藏吗?**
- 右栏是 AI 协作详情
- 藏右栏 = AI 状态不详细可见
- **右栏默认关(顶栏徽章够用),用户主动 Cmd+L 打开**

### 7.3 三栏宽度可拖

- 顶栏 48px (固定)
- 底栏 24px (固定)
- 左栏 200-320px (可拖,默认 240)
- 右栏 240-480px (可拖,默认 320)
- 主区 自适应

**宽度持久化**: localStorage `pipiclaw.layout` 存 `{left: 240, right: 320}`

---

## 8. 后端 IPC 改造 (补-1)

### 8.1 现状

v4.3.1 现在 LlmAgentBrain 输出是字符串流,前端 Chat 流是字符串拼接。

**问题**: v2.1 的 4 AI 组件需要结构化事件:
- ThinkingIndicator 需要 `thinking` 事件
- ToolCallCard 需要 `tool_call` 事件 (含 start/arg/end/status)
- MemoryChip 需要 `memory_ref` 事件
- "待审阅" 需要 `pending_review` 事件

### 8.2 v2.1 IPC 事件协议

```typescript
// 主进程 → 渲染进程的 LLM 事件流
type LlmEvent = 
  | { type: 'thinking_start', content: string }     // ThinkingIndicator
  | { type: 'thinking_end' }
  | { type: 'tool_call_start', tool: string, args: any }  // ToolCallCard
  | { type: 'tool_call_arg', tool: string, chunk: string }
  | { type: 'tool_call_end', tool: string, result: any, status: 'success' | 'warning' | 'error' }
  | { type: 'memory_ref', memoryId: string, relevance: number }  // MemoryChip
  | { type: 'pending_review', action: 'apply' | 'reject', diff: any }  // 待审阅
  | { type: 'text_chunk', content: string }  // Chat 流
  | { type: 'done', usage: any };
```

### 8.3 LlmAgentBrain 重构

**当前**: `LlmAgentBrain.ts` 输出 OpenAI 兼容的字符串流
**v2.1 改造**: 解析 OpenAI stream → emit `LlmEvent` 事件到 EventBus → IpcBridge 转发到渲染进程

**改造点**:
- `electron/agent/LlmAgentBrain.ts` 加 `eventBus.emit('llm:event', event)`
- `electron/llm/LlmClient.ts` 加 OpenAI stream 解析 (提取 reasoning_content, tool_calls)
- `electron/runtime/bridge/IpcBridge.ts` 注册 `llm:event` 转发到 webContents.send

### 8.4 渲染进程订阅

```typescript
// src/composables/useLlmStream.ts
import { onMounted, onUnmounted } from 'vue';

export function useLlmStream(handlers: {
  onThinking?: (content: string) => void;
  onToolCall?: (event: ToolCallEvent) => void;
  onMemoryRef?: (memoryId: string, relevance: number) => void;
  onPendingReview?: (action: string, diff: any) => void;
  onTextChunk?: (content: string) => void;
  onDone?: (usage: any) => void;
}) {
  const listener = (_event: any, data: LlmEvent) => {
    switch (data.type) {
      case 'thinking_start': handlers.onThinking?.(data.content); break;
      case 'tool_call_start': handlers.onToolCall?.(data); break;
      // ...
    }
  };
  onMounted(() => window.electronAPI.on('llm:event', listener));
  onUnmounted(() => window.electronAPI.off('llm:event', listener));
}
```

### 8.5 兼容性

- 老 LLM (非 thinking 模型) 全部 emit `text_chunk` + `done`,**不破坏现有功能**
- 新 LLM (thinking 模型) 额外 emit `thinking_start` + `tool_call_*`
- 渲染进程 handlers 可选,旧组件不订阅就不触发

---

## 9. 老用户迁移 v4.3.1 → v4.4.0 (补-2)

### 9.1 路由迁移表

| v4.3.1 路由 | v4.4.0 路由 | 迁移方式 |
|---|---|---|
| `/dashboard` | `/workspace` | router redirect |
| `/chat` | `/workspace` | router redirect |
| `/chat/:convId` | `/workspace/default/chat/:convId` | 自动建默认 task |
| `/skills` | `/skills` | 不变 |
| `/skills/:id` | `/skills/:id` | 不变 |
| `/models` | `/models` | 不变 |
| `/models/:id` | `/models/:id` | 不变 |
| `/clawhub` | `/skills?tab=clawhub` | redirect + 锚点 |
| `/im` | 右栏 IM 通知 | UI 重映射,无 URL |
| `/im/:channel` | 右栏 IM 通知 | UI 重映射,无 URL |
| `/settings` | `/settings` | 不变 |
| 7 个 devOnly | 删除,改 cmd 触发 | 不迁移 |

### 9.2 主题配置迁移

```typescript
// v4.3.1 config.json
{ "app": { "theme": "purple" } }

// v4.4.0 迁移
{ "app": { "theme": "dark" } }  // 'purple' 强制 → 'dark'
```

**映射表**:
| v4.3.1 theme | v4.4.0 theme |
|---|---|
| `light` | `light` |
| `dark` | `dark` |
| `purple` | `dark` (强制) |
| `blue` | `light` (强制) |
| `green` | `light` (强制) |
| 其他 | `auto` (跟随系统) |

**用户提示**: 启动时弹一次性 Toast "主题已迁移到新版,可在 Settings 修改"

### 9.3 配置文件 schema 兼容

v4.4.0 启动时:
1. 读 v4.3.1 config.json
2. 跑 migration 函数:
   - 路由字段(如有)按 9.1 表转换
   - theme 字段按 9.2 表转换
   - 新字段用默认值填充
3. 备份原 config.json 为 `config.v4.3.1.bak.json`
4. 写 v4.4.0 config.json
5. 用户下次启动无感

### 9.4 数据库迁移

HermesMemory (记忆库) 数据不动,schema 不变。
ClawHub 已安装技能不动,manifest 兼容。
IM 通道配置不动,只改 UI 入口。

---

## 10. 平台差异 (补-3)

### 10.1 顶栏高度

| 平台 | 顶栏高度 | 底栏高度 | 原因 |
|---|---|---|---|
| macOS (retina) | 38px | 22px | 避 traffic light (28px) + spacing |
| Windows | 32px | 24px | 标准高度 |
| Linux | 32px | 24px | 标准高度 |

**Traffic Light 处理** (macOS):
- macOS 顶栏左侧 80px 留给 traffic light (红黄绿三圆点)
- Logo / 工作区切换 从 80px 后开始
- `padding-left: 80px` on macOS

### 10.2 快捷键

| 功能 | macOS | Windows | Linux |
|---|---|---|---|
| AI 右栏 | Cmd+L | Ctrl+L | Ctrl+L |
| 命令面板 | Cmd+K | Ctrl+K | Ctrl+K |
| 新建任务 | Cmd+N | Ctrl+N | Ctrl+N |
| 关闭应用 | Cmd+Q | Ctrl+Q | Ctrl+Q |
| 主题切换 | Cmd+Shift+T | Ctrl+Shift+T | Ctrl+Shift+T |

**检测方式**:
```typescript
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const mod = isMac ? 'Cmd' : 'Ctrl';
```

### 10.3 字体平台 fallback

```css
--font-ui: 'Inter', 'HarmonyOS Sans SC',
  -apple-system,        /* macOS: SF Pro */
  BlinkMacSystemFont,   /* Chrome macOS */
  'Segoe UI',           /* Windows */
  sans-serif;

--font-mono: 'JetBrains Mono', 'Source Code Pro',
  'SF Mono',            /* macOS */
  Menlo,                /* macOS older */
  Consolas,             /* Windows */
  monospace;
```

### 10.4 高对比度模式 (Windows)

```css
@media (prefers-contrast: more) {
  :root {
    --text-primary: #000;
    --text-secondary: #000;
    --border: #000;
    --bg-primary: #fff;
  }
  [data-theme="dark"] {
    --text-primary: #fff;
    --text-secondary: #fff;
    --border: #fff;
    --bg-primary: #000;
  }
}
```

**focus ring 高对比度**: 3px solid (替换 2px),对比度 ≥ 4.5:1

### 10.5 鼠标光标

- 文本输入框: `cursor: text`
- 可点击: `cursor: pointer`
- 拖拽: `cursor: grab` / `cursor: grabbing`
- 禁用: `cursor: not-allowed`

---

## 11. 性能 v2.1 (补-4 vite manualChunks)

### 11.1 v2.0 bundle 拆分方案 (具体配置)

```typescript
// vite.config.mts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-element': ['element-plus', '@element-plus/icons-vue'],
          'vendor-markdown': ['markdown-it', 'highlight.js', 'prismjs'],
          'vendor-monaco': ['monaco-editor'],  // Code 面板用
          'vendor-chart': ['chart.js', 'd3'],   // 仪表盘
          
          'feature-ai': [
            './src/components/ai/ThinkingIndicator.vue',
            './src/components/ai/ToolCallCard.vue',
            './src/components/ai/MemoryChip.vue',
            './src/components/ai/AICollabPanel.vue',
            './src/composables/useLlmStream.ts',
          ],
          'feature-cmdk': [
            './src/components/command/CommandPalette.vue',
            './src/composables/useCommandPalette.ts',
          ],
          'feature-workspace': [
            './src/views/Workspace.vue',
            './src/components/workspace/ChatTab.vue',
            './src/components/workspace/CodePanel.vue',
            './src/components/workspace/MemoryPanel.vue',
            './src/components/workspace/ToolsPanel.vue',
          ],
        }
      }
    }
  }
});
```

### 11.2 chunk 体积预算

| Chunk | 目标 | 实测 |
|---|---|---|
| main.js | < 500KB gzipped | 现状 ~280KB |
| vendor-vue | < 100KB | ~40KB |
| vendor-element | < 200KB | ~150KB |
| feature-ai | < 200KB | 待测 |
| feature-cmdk | < 100KB | 待测 |
| feature-workspace | < 200KB | 待测 |
| vendor-monaco | < 300KB | 懒加载 |

**目标总 bundle**: < 1.5MB gzipped (现状 ~1.2MB,加新功能后预估 1.4MB)

### 11.3 路由懒加载

```typescript
// router/index.ts
const routes = [
  { 
    path: '/workspace/:taskId', 
    component: () => import('@/views/Workspace.vue'),
    children: [
      { path: 'chat', component: () => import('@/components/workspace/ChatTab.vue') },
      { path: 'code', component: () => import('@/components/workspace/CodePanel.vue') },
      { path: 'memory', component: () => import('@/components/workspace/MemoryPanel.vue') },
      { path: 'tools', component: () => import('@/components/workspace/ToolsPanel.vue') },
    ]
  },
  { 
    path: '/skills', 
    component: () => import('@/views/Skills.vue')  // 独立 chunk
  },
  // ...
];
```

### 11.4 资源懒加载

- 字体: `font-display: swap` (v2.1 5.2 已加)
- 图片: `loading="lazy"`
- Monaco Editor: 只在 Code 面板打开时 import
- 图表: 只在仪表盘打开时 import

---

## 12. 6 周 26 commit 实施路线 (P1-6 灰度)

### 12.1 v2.0 错: 26 commit 直接 ship

v2.0 10 节"6 周 26 commit 节奏对"——但 designer 抓"第 2 周 5 commit 是原子操作,不能分批"。

### 12.2 v2.1 灰度发布节奏

| 阶段 | 周次 | 内容 | 用户可见 |
|---|---|---|---|
| **Week 0 (前置)** | 本周 | 5 commit MVP: 砍 5 套主题 + Inter+思源 + tokens 重构 + focus-visible + bundle 拆 | ✅ 立即 |
| **Week 1-2 内部** | 2 周 | 信息架构重塑(14→4 路由 + 三栏 + 4 工作区树形 + 5 状态 + IPC 改造) | ❌ 内部 alpha |
| **Week 3 alpha** | 1 周 | AI 组件(4 个 AI 组件 + 后端结构化事件) | 🟡 alpha 分支 |
| **Week 4 beta** | 1 周 | 动效 + a11y + 性能 | 🟡 beta 分支 |
| **Week 5 rc** | 1 周 | bug 修复 + 老用户迁移测试 | 🟡 RC 分支 |
| **Week 6 ship** | 1 周 | v4.4.0 (或 v5.0.0) 正式发布 | ✅ 正式 |

### 12.3 26 commit 重排 (按 v2.1 灰度)

**Week 0 (前置, 5 commit) - 用户立即可见**:
1. `feat(theme): 删除 5 套主题,强制 light+dark 2 套`
2. `feat(font): Inter + HarmonyOS Sans SC 双语字体加载`
3. `feat(tokens): 重构 CSS 变量,7 档 t-shirt 字号 + 2 套 spacing`
4. `feat(accent): 同色相跨主题,indigo-500 ↔ indigo-400`
5. `feat(focus): focus-visible 全站替换`

**Week 1-2 (内部, 7 commit) - 一次性 ship**:
6. `refactor(ipc): LlmAgentBrain 改造,emit 结构化 LlmEvent`
7. `refactor(routes): 14 路由 → 4 工作区,加 redirect`
8. `feat(layout): AppLayout 三栏 (240/主/320)`
9. `feat(sidenav): 4 工作区树形 + 左栏头部固定`
10. `feat(topbar): 顶栏固定导航 + AI 状态徽章`
11. `feat(rightpanel): AI 协作右栏,默认折叠 + 5 状态 + Cmd+L 触发`
12. `feat(workspace): 主区常驻 Chat + 3 辅助面板路由`

**Week 3 (alpha, 4 commit)**:
13. `feat(thinking): ThinkingIndicator 重做(静态文字 + 1.5s 光标)`
14. `feat(toolcall): ToolCallCard 5 状态 + warning + 默认折叠 + Apply/Reject`
15. `feat(memory): MemoryChip 系统自动评分 + 用户可覆盖`
16. `feat(skill): SkillCard 保留,只在 Skills 工作区用`

**Week 4 (beta, 4 commit)**:
17. `feat(motion): 修 7 个 v2.0 反模式 (focus/route/Modal/Drawer/Palette/Stream/reduced-motion)`
18. `feat(a11y): SR 5 场景 + skip-link + 平台 focus ring 差异`
19. `feat(responsive): 3 断点响应式 + 宽度可拖`
20. `perf(bundle): vite manualChunks + 路由懒加载`

**Week 5 (rc, 4 commit)**:
21. `feat(state): OfflineBar / PermissionPrompt / QuotaBar / ModelStatus`
22. `feat(button): 7 variant (含 Link/Icon/Loading/Toggle)`
23. `feat(migrate): v4.3.1 → v4.4.0 老用户迁移 (路由/主题/配置)`
24. `test(integration): 26 commit 集成测试 + 老用户迁移 E2E`

**Week 6 (ship, 2 commit)**:
25. `docs: 重设计 v2.1 README + 截图 + 视频 + 迁移指南`
26. `release: v4.4.0 (或 v5.0.0) ship`

**总计 26 commit 不变**,但分阶段 ship 风险降低。

### 12.4 灰度发布配置

```typescript
// electron-builder.json5
publish: {
  provider: 'github',
  owner: 'chichengzibu',
  repo: 'pipiclaw',
  releaseType: 'release',  // main channel
  // v2.1 加:beta channel
  // channel: 'latest' | 'beta' | 'alpha'
}
```

**auto-update channel**:
- 正式用户: `latest`
- 内部测试: `beta` (auto-update 检查 beta)
- 内部 alpha: `alpha` (不 auto-update,手动下载)

---

## 13. 风险与回退 v2.1 (扩到 12 项)

v2.0 11 节 5 项太浅,designer 抓的。v2.1 扩到 12 项:

| # | 风险 | 等级 | 回退策略 | Owner |
|---|---|---|---|---|
| 1 | 路由改造破老用户书签 | 🟡 | 写 redirect 表,自动迁移 | migration agent |
| 2 | 5 套主题被砍反弹 | 🟡 | v4.3.x 单独发 5 套主题 patch | release agent |
| 3 | 三栏布局在 1024 拥挤 | 🔴 | 右栏默认关,左栏汉堡菜单 | design |
| 4 | 26 commit 集成风险 | 🟡 | 每周内部 alpha,周末集成测试 | dev lead |
| 5 | AI 状态右栏分心 | 🟢 | 改 P0-1 默认折叠后风险降 | - |
| 6 | 后端 IPC 改造破老 LLM 集成 | 🔴 | 兼容 emit,老 LLM 只发 text_chunk | electron dev |
| 7 | Inter + HarmonyOS 字体加载慢 | 🟡 | font-display: swap + preload | perf |
| 8 | bundle 体积回退 | 🟡 | manualChunks 拆分,目标 < 1.5MB | perf |
| 9 | Electron 主进程兼容性 | 🟡 | 保留旧 IPC channel,新 IPC 增量加 | electron dev |
| 10 | 老用户配置数据丢失 | 🟡 | 备份 config.v4.3.1.bak.json | migration |
| 11 | Electron Chromium 渲染差异 | 🟡 | -webkit- 前缀 + backdrop-filter 测试 | e2e |
| 12 | 多窗口架构未来兼容 | 🟢 | Pinia 全局状态 + hash router 预留 | architect |

---

## 14. 关键文件改动列表 (v2.1)

### 14.1 新增

- `src/components/layout/AppShell.vue` (三栏容器)
- `src/components/layout/TopBar.vue` (顶栏,带 AI 状态徽章)
- `src/components/layout/StatusBar.vue` (底栏)
- `src/components/ai/ThinkingIndicator.vue` (重做,静态文字)
- `src/components/ai/ToolCallCard.vue` (重做,5 状态 + 默认折叠)
- `src/components/ai/MemoryChip.vue` (重做,系统评分)
- `src/components/ai/AICollabPanel.vue` (右栏,默认折叠)
- `src/components/ai/AiStatusBadge.vue` (顶栏徽章)
- `src/components/workspace/ChatTab.vue` (主区 Chat,常驻)
- `src/components/workspace/CodePanel.vue` (辅助面板)
- `src/components/workspace/MemoryPanel.vue` (辅助面板)
- `src/components/workspace/ToolsPanel.vue` (辅助面板)
- `src/components/state/OfflineBar.vue`
- `src/components/state/PermissionPrompt.vue`
- `src/components/state/QuotaBar.vue`
- `src/components/state/ModelStatus.vue`
- `src/composables/useLlmStream.ts` (订阅 LlmEvent)
- `src/composables/useLayout.ts` (布局状态 + 宽度持久化)
- `electron/agent/LlmEventBus.ts` (新事件总线)
- `electron/migrations/v4.3-to-v4.4.ts` (老用户迁移)
- `src/styles/tokens-v2.scss` (新 token 系统)
- `public/fonts/Inter-Variable.woff2` (字体文件)
- `public/fonts/HarmonyOS-Sans-SC.woff2` (字体文件)

### 14.2 重写

- `src/router/index.ts` (4 工作区 + 3 辅助面板路由)
- `src/components/layout/SideNav.vue` → 任务树
- `src/components/command/CommandPalette.vue` (重写,200/200)
- `src/views/Chat.vue` → 嵌入 Workspace
- `src/views/Skills.vue` (合并 ClawHub 子页)
- `src/views/Settings.vue` (theme 砍 5 套)
- `electron/agent/LlmAgentBrain.ts` (emit LlmEvent)
- `electron/llm/LlmClient.ts` (解析 reasoning_content + tool_calls)
- `electron/runtime/bridge/IpcBridge.ts` (注册 llm:event)
- `vite.config.mts` (manualChunks)

### 14.3 删除

- 5 套主题相关配置
- 9 个 devOnly 路由(改 cmd 触发)
- `src/views/ImManagement.vue` → 合并到右栏
- `src/views/ClawHub.vue` → 合并到 Skills
- `src/views/Dashboard.vue` → 删,默认进 Workspace

---

## 15. 度量验收 v2.1

| 指标 | 目标 | 测量方法 | 验证周期 |
|---|---|---|---|
| 视觉一致性 | 0 偏差 | ESLint + 视觉回归 | 每个 commit |
| LCP | < 1.5s | Lighthouse CI | Week 4 + 6 |
| 命令面板 enter | < 200ms (P90) | Performance API | Week 4 + 6 |
| AI 状态右栏 enter | < 280ms (P90) | Performance API | Week 4 + 6 |
| 路由切换 | 80ms | Performance API | Week 4 + 6 |
| 主题切换 | 200ms | Performance API | Week 4 + 6 |
| a11y | 0 violations | axe-core CI | Week 5 + 6 |
| 老用户迁移 | 100% 自动 | redirect + theme mapping | Week 5 |
| bundle 主包 | < 1.5MB gzipped | vite-bundle-visualizer | Week 4 + 6 |
| 字体加载 | < 100ms (cached) | WebPageTest | Week 2 |
| 4 状态正确性 | 100% | unit + e2e | Week 3 + 6 |
| 后端 IPC 兼容 | 100% (老 LLM 不破) | 集成测试 | Week 2 + 6 |

---

## 16. 实施时间表 (v2.1 灰度)

| Week | 内容 | Commit | 用户可见 | 风险 |
|---|---|---|---|---|
| **0 (前置)** | 视觉基础 (5 套主题/字体/token/accent/focus) | 5 | ✅ 立即 | 🟢 低 |
| **1-2 (内部)** | 信息架构重塑 (IPC/路由/三栏/树形/右栏/主区) | 7 | ❌ 内部 alpha | 🔴 高 |
| **3 (alpha)** | 4 AI 组件 (重做) | 4 | 🟡 alpha 分支 | 🟡 中 |
| **4 (beta)** | 动效/a11y/性能 (修 v2.0 反模式) | 4 | 🟡 beta 分支 | 🟡 中 |
| **5 (rc)** | 状态组件/按钮变体/迁移/集成测试 | 4 | 🟡 RC 分支 | 🟡 中 |
| **6 (ship)** | docs + release v4.4.0 | 2 | ✅ 正式 | 🟢 低 |
| **总计** | | **26** | | |

**Week 0 用户能立即看到改进**——视觉基础改了,体验立刻不一样。
**Week 1-2 用户看不到变化**——内部开发信息架构。
**Week 3+ alpha/beta/RC 渐进发布**——有 bug 立即回滚。

---

## 17. v2.1 ship-ready 检查清单

### 17.1 P0 5 项全修 ✅
- [x] P0-1 右栏默认折叠 (3.2/3.3)
- [x] P0-2 5 Tab → 1 主区 + 3 面板 + 砍 Files (2.3)
- [x] P0-3 4 状态 → 5 状态 + 待审阅 (3.1)
- [x] P0-4 ThinkingIndicator 砍翻牌 (4.1)
- [x] P0-5 Inter + HarmonyOS 双语字体 (5.2)

### 17.2 P1 6 项全改 ✅
- [x] P1-1 4 工作区树形 (2.4)
- [x] P1-2 主动建议改内嵌 (3.4)
- [x] P1-3 3 断点响应式 (7.2)
- [x] P1-4 ToolCallCard 5 状态 + 默认折叠 (4.2)
- [x] P1-5 MemoryChip 系统评分 (4.3)
- [x] P1-6 灰度发布节奏 (12)

### 17.3 owner 补 4 项全补 ✅
- [x] 补-1 后端 IPC 改造 (8)
- [x] 补-2 老用户迁移 (9)
- [x] 补-3 平台差异 (10)
- [x] 补-4 vite manualChunks (11)

### 17.4 v1.0 P0/P1 全吸收 ✅
- [x] focus-visible
- [x] 字号 t-shirt 命名
- [x] 4 状态组件
- [x] prefers-reduced-motion 颗粒度
- [x] SR 5 场景
- [x] 路由 80ms crossfade
- [x] 同色相 accent
- [x] Card hover Linear 路线
- [x] Modal 200ms fade only
- [x] Drawer 240ms
- [x] Command Palette 200/200 对称
- [x] Stream shimmer 文字流
- [x] 暗色 HSL 调色公式

---

## 18. 总结

**v2.1 相对 v2.0 的核心改进**:
- **战略精准化**: "AI 协作可视化"是真正的差异化(不是 "AI 是协作方")
- **架构修正**: 右栏默认折叠 + 1 主区 + 3 面板 + 5 状态
- **组件升级**: ThinkingIndicator 静态 + ToolCallCard 5 状态 + MemoryChip 系统评分
- **字体方案**: Inter + HarmonyOS 双语(中文用户视觉一致)
- **工程落地**: 后端 IPC + 老用户迁移 + 平台差异 + manualChunks
- **灰度发布**: Week 0 ship 视觉 + Week 1-2 内部 + Week 3+ alpha/beta/RC

**v2.1 是 ship-ready 候选**,可以进入 26 commit 实施。

**评估预估**:
- v2.0 综合 5.8/10 (不及格)
- v2.1 预计 8.0+/10 (ship-ready) — 修全部 P0 + P1 + 补,补完工程实施细节
- 关键看 designer 评审验证

**下一步**: owner 自评 → designer 评审 → v2.1 final。
