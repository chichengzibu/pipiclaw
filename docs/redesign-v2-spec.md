# PiPiClaw 重设计 v2.0 · 详细方案

> **关系**: 接 `redesign-v2-direction.md` (方向决策)
> **路线**: A. AI-Native Workspace (Linear 路线)
> **工期**: 6 周 (精致版)
> **主题**: 强制 light + dark 2 套,砍掉 5 套彩色
> **作者**: Mavis
> **日期**: 2026-07-28
> **目标版本**: PiPiClaw v4.4.0 / v5.0.0

---

## 0. 战略定位

### 0.1 一句话
**PiPiClaw 是"AI-native 工作台"——所有任务围绕 AI 协作展开,AI 是用户的主协作方,不是工具箱。**

### 0.2 跟 v1.0 的本质区别

| 项 | v1.0 (在现有上加) | v2.0 (重设计) |
|---|---|---|
| 信息架构 | 14 路由平铺 | 1 工作区 + Tab + AI 协作面板 |
| 路由 | 14 个独立 | 4 个工作区 + 主区 Tab |
| AI 角色 | 问的对象 (Chat 页) | 协作方 (右栏常驻可见) |
| 任务模型 | "我去 Chat 问 AI" | "AI 跟我一起干" |
| 主区 | 单页填充 | Tab 切换多上下文 |
| 顶栏 | Logo + 路由名 | 全局上下文 + AI 状态 + Cmd+K |
| 状态可见 | 散落在各页 | 全局 StatusBar + 顶栏 AI 状态 |

### 0.3 跟头部产品的对标

| 产品 | 信息架构 | PiPiClaw 学什么 |
|---|---|---|
| **Linear** | 列表 + 命令面板 + 详情侧栏 | 任务流 + 命令面板的克制 |
| **Cursor** | 编辑器 + AI 侧栏 (可隐藏) | AI 侧栏交互 |
| **Raycast** | 命令面板为中心 | Cmd+K 的极致 |
| **Notion** | 三栏 + 块 | 三栏布局的密度感 |

**PiPiClaw = Linear (任务流) + Cursor (AI 协作) + Raycast (Cmd+K)**

---

## 1. 信息架构重设计

### 1.1 全局布局 (1280×800 起)

```
┌─────────────────────────────────────────────────────────────────┐
│ [顶栏 48px] Logo · 全局上下文 · AI 状态 · Cmd+K 入口 · 用户头像  │
├──────────┬──────────────────────────────────┬───────────────────┤
│          │                                  │                   │
│  [左栏]  │  [主区 自适应]                    │  [右栏 320px]     │
│  240px   │                                  │  AI 协作面板      │
│  任务流  │  Tab 栏 40px: 当前任务的所有上下文 │  可折叠 (默认展开)│
│          │  ┌────────────────────────────┐  │                   │
│ 会话/任务 │  │  Chat / Code / Skill /     │  │  思考中/执行中    │
│ 列表     │  │  Memory / Tool 等          │  │  待审阅/已完成    │
│          │  └────────────────────────────┘  │  + AI 主动建议    │
│          │  内容区: 当前 Tab 内容             │                   │
│          │                                  │                   │
├──────────┴──────────────────────────────────┴───────────────────┤
│ [底栏 24px] 模型: qwen3:14b · 网络: ✓ · 权限: 开放 · ⌘K 命令  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 路由改造 (14 → 4)

| 原路由 | 改造后 | 说明 |
|---|---|---|
| `/dashboard` | **删** | 默认进 Chat 主区,不再单独 Dashboard |
| `/chat` | `/workspace/:taskId/chat` | 主区 Chat Tab |
| `/chat/:id` | `/workspace/:taskId/chat/:convId` | 任务内会话 |
| `/skills` | `/skills` | 保留为工作区切换的"技能市场" |
| `/skills/:id` | `/skills/:skillId` | 技能详情 + 安装 |
| `/models` | `/models` | 保留为"模型管理"工作区 |
| `/models/:id` | `/models/:modelId` | 模型详情 + 配置 |
| `/clawhub` | `/clawhub` | ClawHub 工作区(技能市场) |
| `/im` | `/im` | IM 管理工作区 |
| `/im/:channel` | `/im/:channel` | IM 频道详情 |
| `/settings` | `/settings` | 设置工作区 |
| 7 个 devOnly | **删** | 生产不暴露 |

**改造后 4 个工作区**:
- **Workspace** (默认): 任务流 + Chat + AI 协作 (核心)
- **Skills**: 技能市场
- **Models**: 模型管理
- **Settings**: 设置

**IM 和 ClawHub 怎么办**: 
- IM 改为"右栏的 IM 通知" + 顶栏图标
- ClawHub 合并到 Skills 工作区作为子页面

### 1.3 主区 Tab 系统

每个任务(workspace 路由下的 taskId)有 5 个 Tab:

| Tab | 内容 | 默认 |
|---|---|---|
| **Chat** | AI 对话流 | ✓ 默认 |
| **Code** | 代码编辑 + 预览(若有) | 可选 |
| **Memory** | 该任务的记忆/上下文 | 可选 |
| **Tools** | 工具调用历史 | 可选 |
| **Files** | 附件/上传文件 | 可选 |

**Tab 栏交互**:
- 横向排列,超出滚动
- 中键关闭
- 拖拽排序
- 双击重命名
- Cmd+1~5 切换

### 1.4 右栏 AI 协作面板

**默认展开,4 种状态视觉化**:

| 状态 | 视觉 | 交互 |
|---|---|---|
| **空闲** | 头像 + "Ask AI anything..." 输入框 | 输入即问 |
| **思考中** | shimmer 文字流 + 状态文字"正在分析..." | 显示思考摘要 |
| **执行中** | ToolCallCard 列表 + 进度条 | 可取消/暂停 |
| **完成** | 总结卡片 + 相关建议 | 可应用到主区 |

**关键差异**: AI 状态**全局可见** (顶栏也有 AI 状态徽章),用户不离开主区也知道 AI 在干嘛。

### 1.5 顶栏 (48px)

| 区域 | 内容 |
|---|---|
| 左 | Logo (24px) + 当前工作区名 |
| 中 | 当前任务标题(可点击切换) + 任务状态徽章 |
| 右 | AI 状态徽章 + Cmd+K 入口 + 用户头像 |

### 1.6 底栏 (24px)

| 区域 | 内容 |
|---|---|
| 左 | 当前模型 · 状态 |
| 中 | 网络状态 · 权限状态 |
| 右 | ⌘K 命令 · 快捷键提示 |

### 1.7 侧栏 (240px) — 任务流

**Linear 风格列表**:
- 顶部: 任务组(可折叠) + 筛选器 + 排序
- 中部: 任务列表(虚拟滚动)
- 底部: + 新建任务

**每个任务卡片**:
- 任务名(13px medium)
- 状态点(4 色: idle/thinking/executing/done)
- 模型徽章(qwen3/llama/gpt-oss)
- 最后活动时间(11px tertiary)
- hover 时显示更多操作

---

## 2. 视觉语言 v2

### 2.1 双字体系统

| 用途 | 字体 | 原因 |
|---|---|---|
| UI / 正文 | **Inter** | Linear/Cursor 标配,可读性高 |
| 代码 / 数据 | **Geist Mono** | Vercel 字体,等宽,AI 工具标配 |
| 中文 | 跟随 UI(Inter 的中文 fallback) | 不切字体,保证一致感 |

### 2.2 字号 (7 档,t-shirt 命名)

| Token | Size / Line | 用途 |
|---|---|---|
| `--text-xs` | 11/16 | caption / label |
| `--text-sm` | 12/18 | small / meta |
| `--text-base` | 13/20 | **body (default)** |
| `--text-md` | 14/22 | emphasized body |
| `--text-lg` | 16/24 | h3 |
| `--text-xl` | 20/28 | h2 |
| `--text-2xl` | 28/36 | h1 |

**承认**: 离散取整,不是黄金比例 (修正 v1.0 错误)

### 2.3 Spacing (2 套)

**组件内** (1=4px, 2=8px, 3=12px, 4=16px):
- `space-1` 4px
- `space-2` 8px (default)
- `space-3` 12px
- `space-4` 16px

**章节间** (6=24px, 8=32px, 12=48px, 16=64px):
- `space-6` 24px
- `space-8` 32px (section default)
- `space-12` 48px
- `space-16` 64px

### 2.4 颜色 (2 套,同色相仅调亮度)

#### Light (Tare 浅色)
- bg-primary `#ffffff`
- bg-secondary `#f7f7f8`
- bg-tertiary `#efeff1`
- text-primary `#1a1a1a`
- text-secondary `#6b6b76`
- text-tertiary `#a0a0a8`
- border `#e5e5e7`
- **accent `#6366f1` (indigo-500)** ← 同色相
- accent-soft `#eef2ff`
- success `#10b981`
- warning `#f59e0b`
- danger `#ef4444`
- info `#3b82f6`

#### Dark (Cursor 深色,同色相 +8% L, -15% S)
- bg-primary `#1e1e1e`
- bg-secondary `#252526`
- bg-tertiary `#2d2d30`
- text-primary `#e8e8e8`
- text-secondary `#a8a8a8` (3.5:1, 修 v1.0 不达标)
- text-tertiary `#6e6e6e`
- border `#3a3a3d`
- **accent `#818cf8` (indigo-400)** ← 同色相,仅调亮度
- accent-soft `#3b2966`
- success `#34d399`
- warning `#fbbf24`
- danger `#f87171`
- info `#60a5fa`

### 2.5 Radius (4 档)

| Token | 值 | 用途 |
|---|---|---|
| `--radius-sm` | 4px | input / tag |
| `--radius-md` | 8px | button / card (default) |
| `--radius-lg` | 12px | modal / panel |
| `--radius-full` | 999px | avatar / pill |

### 2.6 Shadow (3 档,暗色模式公式化)

**Light**:
- shadow-sm `0 1px 2px rgba(0,0,0,0.05)`
- shadow-md `0 4px 12px rgba(0,0,0,0.10)`
- shadow-lg `0 12px 32px rgba(0,0,0,0.15)`

**Dark (调色公式: opacity × 2, + inset border)**:
- shadow-sm `0 1px 2px rgba(0,0,0,0.20), inset 0 0 0 1px rgba(255,255,255,0.04)`
- shadow-md `0 4px 12px rgba(0,0,0,0.40), inset 0 0 0 1px rgba(255,255,255,0.06)`
- shadow-lg `0 12px 32px rgba(0,0,0,0.60), inset 0 0 0 1px rgba(255,255,255,0.08)`

### 2.7 Motion (2 套,极简)

| Token | 值 | 用途 |
|---|---|---|
| `--duration-fast` | 120ms | hover / focus |
| `--duration-base` | 200ms | 默认过渡 |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | ease-out-quint |

**纪律**:
- **禁 ≥ 300ms** (除了页面切换 80ms)
- **Drawer 240ms** (替换 v1.0 400ms 违规)
- **Modal 200ms fade only** (替换 v1.0 scale)

---

## 3. 核心组件 v2

### 3.1 8 个基础组件 (基于 v1.0 升级)

| 组件 | v1.0 | v2.0 变化 |
|---|---|---|
| **Button** | 3 档 + danger | + Link / Icon / Loading / Toggle (4 个新 variant) |
| **Card** | hover translateY | **改**: 仅 border-color + bg-secondary (Linear 路线) |
| **Input** | 36px | 加 sm(28px) / md(36px) / lg(44px) 三档 |
| **Modal** | scale 280ms | **改**: 纯 opacity fade 200ms |
| **Toast** | 4 档色 | 加 4 档色 + aria-live |
| **Skeleton** | 1.5s shimmer | 加 reduced-motion fallback |
| **Tag** | 5 档 | 加 muted 变体 + info 变体 |
| **Tooltip** | 160ms | 保留,加 reduced-motion fallback |

### 3.2 4 个状态组件 (新)

| 组件 | 用途 | 关键交互 |
|---|---|---|
| **OfflineBar** | 顶部离线提示 | 自动检测,网络恢复时滑出 |
| **PermissionPrompt** | 技能申请权限 | in-app 引导,允许/拒绝/详细 |
| **QuotaBar** | token 配额提示 | 顶部 Toast / 进度条 / 空状态 三态 |
| **ModelStatus** | 模型状态(加载/就绪/失败) | 进度条 + 重试按钮 + 切换 |

### 3.3 4 个 AI 专属组件 (新)

#### 3.3.1 `<ThinkingIndicator>` (AI 思考中)
- **shimmer 文字流** (替换 v1.0 3 圆点)
- 视觉: 一行灰色文字,光标左右扫过
- 文字: "正在分析上下文..."  (动态切换)
- 时长: 80-300ms 随机,模拟思考
- **状态**: idle / thinking / done

#### 3.3.2 `<ToolCallCard>` (工具调用)
- Linear 风格卡片
- 头部: 工具图标 + 名称 + 状态徽章(4 色)
- 内容: 参数 + 结果预览
- 底部: 执行时间 + 取消/重试
- **状态**: pending / running / success / error
- 可展开/折叠

#### 3.3.3 `<MemoryChip>` (记忆标签)
- 11px 圆角矩形
- 颜色: 按重要性分 3 档(高/中/低)
- 文字: 记忆摘要
- hover: 显示完整内容 tooltip
- 点击: 跳转到 Memory Tab

#### 3.3.4 `<SkillCard>` (技能卡片)
- 240×120 卡片网格
- 顶部: 技能图标 + 名称
- 中部: 描述(2 行截断)
- 底部: 安装次数 + 评分
- hover: 边框 accent + 阴影
- 点击: 展开详情 drawer

---

## 4. 动效 v2 (修 v1.0 反模式)

### 4.1 必改 (P0)

| 项 | v1.0 错 | v2.0 改 | 依据 |
|---|---|---|---|
| **focus ring** | 永远可见 (反模式) | `:focus-visible` 仅键盘 | WCAG 2.4.7 现代共识 |
| **路由切换** | 0ms 引用 Linear (错的) | 80ms crossfade | Linear 实测 60-100ms |
| **Modal** | scale 280ms | 纯 opacity 200ms | Raycast 路线 |
| **Drawer** | 400ms 违规 | 240ms | 修自己定的 300ms 上限 |
| **Command Palette** | enter 200 / exit 100 | 200 / 200 对称 | Raycast 实测 200/180 |
| **Stream 加载** | 3 圆点 iMessage 套路 | shimmer 文字流 | Cursor/Claude 路线 |
| **prefers-reduced-motion** | 一刀切 (loading 失效) | 保留 functional 动画 | WCAG 2.3.3 例外 |

### 4.2 微交互 (11 项,在 v1.0 基础上调)

| 微交互 | v2.0 参数 | 触发 |
|---|---|---|
| 按钮 hover | bg 加深 5%, 120ms | 全站 |
| 按钮 press | scale(0.98), 80ms | 全站 |
| 卡片 hover | border-color + bg-secondary, 200ms (替换 translateY) | 可交互卡片 |
| focus 光晕 | 2px accent outline, 120ms (`:focus-visible`) | 键盘 |
| 模态进入 | opacity 0→1, 200ms (无 scale) | Modal |
| 列表 stagger | 30ms 延迟, 200ms | 任务列表/消息 |
| 图标 hover | rotate(5deg), 200ms | 可点击图标 |
| 数字 count up | 500ms ease-out | 数据面板 |
| Tab indicator 滑动 | 200ms ease-out | Tab 切换 |
| Tooltip 出现 | scale(0.95→1) + opacity, 160ms | hover 400ms 后 |
| 命令面板 | scale(0.98→1) + opacity, 200ms | Cmd+K |

### 4.3 关键页面动画

| 场景 | 动画 |
|---|---|
| 路由切换 | 主区 fade 80ms (Linear 路线) |
| 主题切换 | 全局 200ms color 过渡 |
| Chat 输入框 focus | border 颜色 200ms |
| 消息流新消息 | translateY(8px→0) + opacity, 200ms |
| 任务新建 | 卡片从顶部滑入 200ms |
| AI 状态变化 | 顶栏徽章 crossfade 200ms |
| 自动更新检测 | UpdateBanner 顶部滑入 200ms |
| 侧栏收起/展开 | width 200ms ease-out |

---

## 5. 加载动画 v2 (4 + 1 模式)

### 5.1 Spinner (短任务 < 1s)
- 16px 圆环,`stroke-dashoffset` 动画
- 360°/0.8s 线性循环
- 颜色 `--accent`
- **functional animation**,prefers-reduced-motion 下保留

### 5.2 Skeleton (中任务 1-3s)
- 静态骨架 + shimmer 横向渐变
- 1.5s linear infinite
- **functional animation**,reduced-motion 下保留 (用户需要知道"在加载")

### 5.3 Progress (长任务 > 3s)
- 进度条 + 百分比 + 阶段文字
- 进度条 200ms 缓动
- **functional animation**,reduced-motion 下保留

### 5.4 Stream (AI 流式输出)
- **v2.0 新**: shimmer 文字流 (替换 v1.0 3 圆点)
- 视觉: 文字 + 光标左右扫过
- **functional animation**,reduced-motion 下保留为静态"光标闪烁"

### 5.5 Thinking (新) — AI 思考中
- **独立于 Stream**: 思考 ≠ 输出
- 视觉: 头像 + shimmer 文字 + 状态文字动态切换
- 时长: 80-300ms 随机,模拟思考
- **functional animation**,reduced-motion 下保留

---

## 6. 交互模式 v2

### 6.1 全局命令面板 (Cmd+K)
- **触发**: 全局 Cmd+K / Ctrl+K,焦点在 input 时不抢
- **进入**: 200ms scale(0.98→1) + opacity,backdrop blur(4px)
- **退出**: 200ms 反向 (修 v1.0 100ms 不对称)
- **内容**: 
  - 顶部: 搜索框
  - 中部: 命令分类(切换/导航/技能/AI)
  - 底部: 最近使用 + 快捷键提示
- **键盘**: ↑↓ 导航,Enter 执行,Tab 切换分类,Esc 关闭
- **AI 集成**: 输入"ask:xxx"直接调 AI

### 6.2 Chat 智能空状态
- 大图标 (48px) + 标题 (text-xl) + 描述 (text-base)
- **3-4 个 quick prompt 卡片** (Linear 风格)
- quick prompt hover: border accent + 微缩放

### 6.3 列表 hover 操作
- 默认: 操作按钮 opacity 0
- 行 hover: opacity 0.4
- 按钮 hover: opacity 1
- 200ms 过渡

### 6.4 拖拽排序 (任务/技能/会话)
- 拖起: `scale(1.02)` + shadow lg
- 拖动中: `rotate(1deg)` 微动
- 放置: `scale(1)` + shadow sm

### 6.5 表单错误
- focus 失焦校验
- 错误: border danger + 下方红色说明,`slideDown` 200ms
- 成功: 短暂绿色脉冲 500ms

### 6.6 AI 协作右栏 (新)
- 4 状态视觉化(空闲/思考/执行/完成)
- 状态切换有 crossfade 200ms
- AI 主动建议以卡片形式插入
- 关闭后保留"未读"徽章,顶栏点击重新打开

### 6.7 模态 vs Drawer vs 右栏
- **居中 < 600px** → Modal (200ms fade)
- **侧边辅助(设置)** → Drawer (240ms 从右滑入)
- **AI 协作(主区辅助)** → 右栏(默认展开,可关)

---

## 7. 主题 v2 — 强制 2 套

### 7.1 删除 5 套彩色
- v4.3.1 的 5 套主题在 v4.4.0 完全删除
- 配置文件 `app.theme` 改为只接受 `light` / `dark` / `auto`
- 自动迁移:老用户的"purple"等强制映射到 `light` 或 `dark`

### 7.2 dark mode 调色公式
- bg-primary: HSL H 不变, S -15%, L 减到 ~12%
- text-primary: H 不变, S -20%, L 加到 ~91%
- accent: H 不变, S -15%, L +8% (indigo-500 → indigo-400)
- shadow: opacity × 2, + inset border (Linear 暗色模式)

### 7.3 平台差异
- **macOS**: 系统 focus ring 蓝色可保留,不强加 accent
- **Windows**: 高对比度模式下用系统色

---

## 8. 无障碍 v2

### 8.1 focus-visible 全站
```css
*:focus { outline: none; }  /* 鼠标点击无 */
*:focus-visible { 
  outline: 2px solid var(--accent); 
  outline-offset: 2px; 
}
```

### 8.2 屏幕阅读器 5 场景

1. **Toast**: aria-live="polite" + 时间戳
2. **命令面板**: 搜索结果朗读 "命令: 新建会话 [Enter 执行] [Cmd+Shift+N]"
3. **AI 流式输出**: aria-live="polite" + aria-atomic="false"
4. **Modal focus trap**: 自写焦点陷阱(EP dialog 已有,命令面板需自写)
5. **Skip-to-content**: WCAG 2.4.1,Tab 第一个元素

### 8.3 prefers-reduced-motion 颗粒度
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
  [data-essential-motion] { animation-duration: revert !important; }
}
```

---

## 9. 性能 v2

### 9.1 性能预算
- LCP < 1.5s
- FID < 100ms
- 命令面板 enter < 200ms (P90)
- 路由切换 80ms
- bundle 主包 < 1.5MB gzipped

### 9.2 bundle 拆包策略
```
main.js          < 500KB    (核心 + 路由)
ai-panel.js      < 200KB    (懒加载,右栏打开时)
command-palette  < 100KB    (懒加载,Cmd+K 时)
charts.js        < 200KB    (懒加载,数据页)
monaco-editor    < 300KB    (懒加载,Code Tab)
```

### 9.3 路由懒加载
- 4 个工作区各自独立 chunk
- 主区 Tab 内容按需加载

---

## 10. 6 周 26 commit 实施路线

### 第 1 周: 视觉语言 v2 (4 commit)
1. `feat(theme): 删除 5 套主题,强制 light+dark 2 套`
2. `feat(font): Geist Mono + Inter 双字体加载`
3. `feat(tokens): 重构 CSS 变量,7 档 t-shirt 字号 + 2 套 spacing`
4. `feat(accent): 同色相跨主题,indigo-500 ↔ indigo-400`

### 第 2 周: 信息架构重塑 (5 commit)
5. `refactor(routes): 14 路由 → 4 工作区 + 主区 Tab`
6. `feat(layout): AppLayout 三栏 (240/主/320)`
7. `feat(sidenav): 任务流 + 状态点 + 拖拽排序`
8. `feat(rightpanel): AI 协作面板,4 状态视觉化`
9. `feat(statusbar): 底部 StatusBar (模型/网络/权限)`

### 第 3 周: AI 专属组件 (4 commit)
10. `feat(thinking): ThinkingIndicator shimmer 文字流`
11. `feat(toolcall): ToolCallCard 4 状态 + 可取消`
12. `feat(memory): MemoryChip + 记忆面板`
13. `feat(skill): SkillCard Linear 风格 240×120`

### 第 4 周: 核心组件升级 (4 commit)
14. `feat(button): 7 variant (含 Link/Icon/Loading/Toggle)`
15. `feat(card): 砍 translateY,改 border-color + bg`
16. `feat(modal): 纯 opacity fade 200ms (替换 scale)`
17. `feat(state): OfflineBar / PermissionPrompt / QuotaBar / ModelStatus`

### 第 5 周: 动效与 a11y (4 commit)
18. `feat(focus): focus-visible 全站替换`
19. `feat(routing): 80ms crossfade 主区`
20. `feat(motion): 修 7 个 v1.0 反模式 (Drawer/Palette/Stream/...)`
21. `feat(a11y): SR 5 场景 + skip-link + 平台差异`

### 第 6 周: 性能 + 测试 + ship (5 commit)
22. `perf(bundle): 拆 6 个 chunk + 路由懒加载`
23. `test(visual): Playwright 视觉回归 + 4 模式加载测试`
24. `test(a11y): axe-core 集成 CI, 0 violations`
25. `docs: 重设计 v2.0 README + 截图 + 视频`
26. `release: v4.4.0 ship (或 v5.0.0)`

---

## 11. 风险与回退

| 风险 | 等级 | 回退策略 |
|---|---|---|
| 路由改造破老用户书签 | 🟡 中 | 写 redirect: 老 URL → 新工作区 |
| 5 套主题被砍反弹 | 🟡 中 | v4.3.x 单独发"5 套主题"patch,不删除 |
| 三栏布局在小屏幕 (1024) 拥挤 | 🔴 高 | 右栏自动折叠 < 1280px,1024px 切移动布局 |
| 26 commit 集成风险 | 🟡 中 | 每周末集成测试,问题立刻回滚单 commit |
| AI 状态右栏分心 | 🟡 中 | 默认可关,顶栏徽章+1 提示 |

---

## 12. 度量验收

| 指标 | 目标 | 测量方法 |
|---|---|---|
| 视觉一致性 | 0 偏差 | ESLint 规则 + 视觉回归 |
| LCP | < 1.5s | Lighthouse CI |
| 命令面板 enter | < 200ms (P90) | Performance API |
| 路由切换 | 80ms | Performance API |
| a11y | 0 violations | axe-core CI |
| 老用户迁移 | 100% 自动 | redirect + theme mapping |
| bundle 主包 | < 1.5MB | vite-bundle-visualizer |

---

## 13. 关键文件改动列表

### 13.1 新增
- `src/components/layout/AppShell.vue` (三栏容器)
- `src/components/layout/TopBar.vue` (顶栏)
- `src/components/layout/StatusBar.vue` (底栏)
- `src/components/ai/ThinkingIndicator.vue`
- `src/components/ai/ToolCallCard.vue`
- `src/components/ai/MemoryChip.vue`
- `src/components/ai/AICollabPanel.vue` (右栏)
- `src/components/state/OfflineBar.vue`
- `src/components/state/PermissionPrompt.vue`
- `src/components/state/QuotaBar.vue`
- `src/components/state/ModelStatus.vue`
- `src/views/Workspace.vue` (主工作区,带 Tab)
- `src/styles/tokens-v2.scss` (新 token 系统)

### 13.2 重写
- `src/router/index.ts` (4 工作区)
- `src/components/layout/SideNav.vue` → 任务流
- `src/components/command/CommandPalette.vue` (重写,200/200)
- `src/views/Chat.vue` → 嵌入 Workspace Tab
- `src/views/Skills.vue` → 合并 ClawHub
- `src/views/Settings.vue` (theme 砍 5 套)

### 13.3 删除
- 5 套主题相关配置
- 9 个 devOnly 路由(改 cmd 触发)
- `src/views/ImManagement.vue` → 合并到右栏
- `src/views/ClawHub.vue` → 合并到 Skills

---

**下一步**: Owner 自评 → designer agent 评审 → v2.0 final。
