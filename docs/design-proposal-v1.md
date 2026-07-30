# PiPiClaw UI/UX 设计方案 v1.0

> **状态**: 方案稿，待评审
> **适用版本**: PiPiClaw v4.4.0+
> **作者**: Mavis (root session)
> **创建日期**: 2026-07-28
> **对标产品**: Linear / Notion / Raycast / Cursor / Vercel / Figma 桌面端

---

## 0. TL;DR

PiPiClaw 当前的 UI 状态是「能跑」但「不够工程师友好」——元素偏大、间距松散、动画稀缺、加载全是菊花 + 文字。本方案给出从 token 到组件到动效的完整设计语言，目标是让 PiPiClaw 在密度、节奏、克制感上对齐 Linear / Raycast / Cursor 头部水准。

核心改造点 5 项：
1. **Token 化** — 8 档 spacing / 8 档字号 / 4 档 radius / 4 档 motion 全局统一
2. **密度升级** — 默认字号 13px（不是 14px），间距 8px 起步
3. **动画纪律** — duration ≤ 300ms 硬上限，ease-out 黄金标准
4. **加载四模式** — spinner / skeleton / progress / stream 各自适用场景
5. **键盘可达** — Cmd+K 全局命令面板、focus ring 永远在、prefers-reduced-motion 兼容

---

## 1. 设计原则（5 条）

### 1.1 密度优先（Density First）
- 工程师 / 创作者用户的耐心 < 200ms，3 秒没反馈就焦虑
- 一屏要装下能装下的信息，不靠滚动凑
- 对标: Linear 列表 32px 行高、Cursor sidebar 240px 宽

### 1.2 节奏感强（Rhythmic Motion）
- 所有动效 duration ≤ 300ms,超出就是拖沓
- 默认 ease-out `cubic-bezier(0.2, 0, 0, 1)`,不能有弹簧/弹性
- 200ms 是黄金中位,120ms 太抢,280ms 才有"重量感"

### 1.3 克制表达（Restraint）
- 不做 3D 翻转 / 视差 / 鼠标跟随 / 弹性动画
- 不用彩虹渐变 / 阴影泛滥 / 毛玻璃过度
- 信任用户智商,不解释显而易见的事

### 1.4 一致 Token（Token Discipline）
- 8px 网格 4 档 spacing 是上限,不能再多
- 字号黄金比例 1.125,8 档够用 11/12/13/14/16/20/28/36
- 任何组件只能用 token,不能"这套卡片我想用 13px 圆角"

### 1.5 键盘可达（Keyboard First）
- 所有功能可键盘操作,不依赖鼠标
- focus ring 永远可见（accent 2px 透明 0.2）
- prefers-reduced-motion 必须尊重

---

## 2. Design Token 系统

### 2.1 Spacing（4 档 + 4 扩展 = 8 档,4px 网格）

| Token | 值 | 用途 |
|---|---|---|
| `--space-0-5` | 2px | 微调 |
| `--space-1` | 4px | 图标与文字间距 |
| `--space-2` | 8px | 默认间距 |
| `--space-3` | 12px | 卡片内 padding |
| `--space-4` | 16px | section padding |
| `--space-6` | 24px | 大块间距 |
| `--space-8` | 32px | page padding |
| `--space-12` | 48px | hero spacing |

### 2.2 Typography（8 档,黄金比例 1.125）

| Token | Size / Line | Weight | 用途 |
|---|---|---|---|
| `--text-xs` | 11/16 | 400 | caption / label / badge |
| `--text-sm` | 12/18 | 400 | small / meta |
| `--text-base` | 13/20 | 400 | body (default) |
| `--text-md` | 14/22 | 500 | emphasized body |
| `--text-lg` | 16/24 | 500 | h3 |
| `--text-xl` | 20/28 | 600 | h2 |
| `--text-2xl` | 28/36 | 600 | h1 |
| `--text-3xl` | 36/44 | 700 | display |

注：默认 body 13px（不是 14px），是工程师 app 的标准密度。

### 2.3 Color（light + dark 两套,共 22 个 token）

#### Light (Tare 浅色)
| Token | 值 | 用途 |
|---|---|---|
| `--bg-primary` | `#ffffff` | 主背景 |
| `--bg-secondary` | `#f7f7f8` | 次背景(sidebar/card) |
| `--bg-tertiary` | `#efeff1` | 三级背景(hover) |
| `--text-primary` | `#1a1a1a` | 主文字 |
| `--text-secondary` | `#6b6b76` | 次文字 |
| `--text-tertiary` | `#a0a0a8` | 三级文字(placeholder) |
| `--border` | `#e5e5e7` | 边框 |
| `--accent` | `#4f46e5` | 主题色(indigo-600) |
| `--accent-soft` | `#eef2ff` | accent 软背景 |
| `--success` | `#10b981` | 成功 |
| `--warning` | `#f59e0b` | 警告 |
| `--danger` | `#ef4444` | 危险 |

#### Dark (Cursor 深色)
| Token | 值 | 用途 |
|---|---|---|
| `--bg-primary` | `#1e1e1e` | 主背景 |
| `--bg-secondary` | `#252526` | 次背景 |
| `--bg-tertiary` | `#2d2d30` | hover |
| `--text-primary` | `#e8e8e8` | 主文字 |
| `--text-secondary` | `#a0a0a8` | 次文字 |
| `--text-tertiary` | `#6b6b76` | 三级 |
| `--border` | `#3a3a3d` | 边框 |
| `--accent` | `#7c3aed` | 主题色(purple-500) |
| `--accent-soft` | `#3b2966` | 软背景 |
| `--success` | `#34d399` | 成功 |
| `--warning` | `#fbbf24` | 警告 |
| `--danger` | `#f87171` | 危险 |

### 2.4 Radius（4 档,克制不滥用）

| Token | 值 | 用途 |
|---|---|---|
| `--radius-sm` | 4px | input / tag / 紧凑元素 |
| `--radius-md` | 8px | button / card (default) |
| `--radius-lg` | 12px | modal / large card |
| `--radius-full` | 999px | avatar / pill |

### 2.5 Shadow（3 档,暗色模式下降一档使用）

| Token | 值 | 用途 |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | 卡片 / 浮层 |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.10)` | hover 浮起 |
| `--shadow-lg` | `0 12px 32px rgba(0,0,0,0.15)` | modal / dropdown |

### 2.6 Motion（4 duration × 3 easing,克制不抽象）

| Token | 值 | 用途 |
|---|---|---|
| `--duration-fast` | 120ms | hover / focus / 颜色变化 |
| `--duration-base` | 200ms | 默认过渡 |
| `--duration-slow` | 280ms | modal / 命令面板 |
| `--duration-slower` | 400ms | page transition / theme switch |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | ease-out 默认 |
| `--ease-emphasized` | `cubic-bezier(0.4, 0, 0.2, 1)` | 进入 |
| `--ease-decelerate` | `cubic-bezier(0, 0, 0.2, 1)` | 退出 |

---

## 3. 核心组件

### 3.1 Button（3 档 + 1 danger,3 种 size）

| 变体 | 视觉 | 交互 |
|---|---|---|
| **Primary** | bg-accent + 白字 + shadow sm | hover: 加深 5% + shadow md;active: scale(0.98) |
| **Secondary** | bg-primary + 1px border | hover: bg-secondary;active: scale(0.98) |
| **Ghost** | 无背景,无边框 | hover: bg-secondary;active: scale(0.98) |
| **Danger** | bg-danger + 白字 | hover: 加深 5% |

Size: `sm` 28px / `md` 36px (default) / `lg` 44px

### 3.2 Card
- 结构: `bg-primary` + 1px border + `--radius-md` + `--shadow-sm`
- Hover (可交互卡片): shadow md + translateY(-1px),200ms ease-out
- Active: 回到 shadow sm

### 3.3 Input
- 36px 高（default size） / 28px (sm) / 44px (lg)
- 1px border + `--radius-sm`
- Focus: border accent + 2px ring (accent 透明度 0.2)
- Error: border danger + 下方 12px 文字说明

### 3.4 Modal
- 居中,max-width 560px (default) / 720px (lg)
- `bg-primary` + `--radius-lg` + `--shadow-lg`
- Backdrop: `bg-black/40` + `backdrop-blur(4px)`
- **进入**: `scale(0.96 → 1)` + `opacity 0 → 1`,280ms ease-out
- **退出**: `scale(1 → 0.98)` + `opacity 1 → 0`,240ms ease-in

### 3.5 Toast
- 右上角或顶部居中,stack 最多 3 个
- 4 档: success / warning / error / info
- 左侧 4px 颜色条 + 图标 + 文字 + 可选 action
- **进入**: `translateY(-8px → 0)` + `opacity 0 → 1`,200ms
- **自动关闭**: 3s (有 action 的 5s)

### 3.6 Skeleton
- 静态骨架 + shimmer 横向渐变循环,1.5s linear infinite
- 预设: text-line / text-paragraph(3 行) / card / list-item
- 颜色: `bg-tertiary` + shimmer 用 `bg-secondary` 叠加 20% 透明

### 3.7 Tag / Badge
- 24px 高,padding 0 8px,`--radius-sm` 或 `--radius-full`
- 4 档色: gray / accent / success / warning / danger

### 3.8 Tooltip
- `bg-primary` + 1px border + `--radius-sm` + shadow md
- 字号 `--text-xs`
- **出现**: `scale(0.95 → 1)` + `opacity 0 → 1`,160ms
- 延迟 400ms 显示（hover 停留才出）

---

## 4. 动画与动效

### 4.1 微交互（11 项,优先级 P0/P1 分级）

#### P0（必须做,基础体感）
1. **按钮 hover**: bg 加深 5%,120ms
2. **按钮 press**: `scale(0.98)`,80ms
3. **卡片 hover**: `translateY(-1px)` + shadow md,200ms
4. **focus 光晕**: ring 透明度 0 → 0.2,120ms
5. **模态进入**: `scale(0.96 → 1)` + opacity 0 → 1,280ms
6. **列表 stagger**: 每项延迟 30ms 入场,200ms duration

#### P1（升级点,体验加分）
7. **图标 hover**: `rotate(5deg)`,200ms
8. **数字 count up**: 500ms ease-out
9. **Tab indicator 滑动**: 200ms ease-out
10. **Tooltip 出现**: `scale(0.95 → 1)` + opacity,160ms
11. **命令面板**: `scale(0.98 → 1)` + opacity,200ms

### 4.2 路由切换
- **默认**: 0ms 瞬时切换（Linear 路线）
- **可选**: fade 200ms（在用户偏好里开）
- **不做**: slide / 缩放 / 3D 翻页（工程师 app 不需要）

### 4.3 主题切换
- 全局过渡 `color, background-color, border-color` 200ms
- 用 View Transitions API 做渐进增强（Chrome 111+）

### 4.4 关键页面动画

| 场景 | 动画 |
|---|---|
| Chat 输入框 focus | border 颜色过渡 200ms |
| 消息流新消息 | `translateY(8px → 0)` + opacity,200ms |
| Skill 加载 | spinner + 文字 "正在加载 X..." |
| Tool call 执行 | 状态卡片 pulse + "执行中..." |
| 侧边栏展开/收起 | width 200ms ease-out |
| 自动更新检测到 | UpdateBanner 从顶部滑入 200ms |

---

## 5. 加载动画（4 种模式,各自适用场景）

### 5.1 Spinner — 短任务 < 1s
- 16px 圆环,`stroke-dashoffset` 动画
- 360°/0.8s 线性循环
- 颜色 `--accent`
- **不用菊花,只一个旋转圈**
- 适用: 按钮 loading、表格刷新、单个图标

### 5.2 Skeleton — 中任务 1-3s
- 静态骨架 + shimmer 横向渐变
- 1.5s linear infinite
- **不能整个屏幕都是 skeleton,只骨架用户即将看到的内容**
- 适用: 列表加载、聊天初始加载、卡片网格

### 5.3 Progress — 长任务 > 3s,有明确进度
- 进度条 + 百分比 + 当前阶段文字
- 进度条 200ms 缓动（不平滑跳变）
- 阶段文字: "下载模型中..."、"解析技能中..."、"注册权限..."
- 适用: 技能安装、模型下载、文件上传、Ollama 拉取

### 5.4 Stream — 不可预测时长的任务
- 打字机式逐字显示（聊天回复）
- 3 个 pulse 圆点,各延迟 100ms
- **必须有"思考中"和"正在输出"两态,不要混**
- 适用: AI 流式输出、Agent 执行、命令输出

---

## 6. 交互模式

### 6.1 全局命令面板 (Cmd+K)
- **触发**: 全局 Cmd+K / Ctrl+K,焦点在 input/textarea/contenteditable 时不抢
- **进入**: 200ms scale(0.98 → 1) + opacity,backdrop blur(4px)
- **退出**: 100ms 立即消失
- **内容**: 命令列表 + 最近使用 + 模糊搜索
- **键盘**: ↑↓ 导航,Enter 执行,Tab 切换分类,Esc 关闭

### 6.2 Chat 智能空状态
- 大图标 (48px) + 标题 (text-xl) + 描述 (text-base secondary)
- 3-4 个 quick prompt 卡片
- quick prompt 卡片 hover: border accent + 微缩放 `scale(1.01)`,200ms

### 6.3 列表 hover 操作
- 默认: 操作按钮 opacity 0（不可见）
- 行 hover: opacity 0.4（半透明,提示存在）
- 按钮 hover: opacity 1
- 200ms 过渡
- **设计意图**: 减少视觉噪音,鼠标移到才显形

### 6.4 拖拽排序
- 拖起: `scale(1.02)` + shadow lg,200ms
- 拖动中: `rotate(1deg)` 微动
- 放置: `scale(1)` + shadow sm

### 6.5 表单错误反馈
- focus 失焦时校验
- 错误: border danger + 下方 12px 红色说明,`slideDown` 200ms
- 成功: 短暂绿色脉冲 500ms

### 6.6 通知
- Toast 顶部居中,4 档色,自动消失
- 重要通知（更新检测）: UpdateBanner 顶部常驻,可关闭

### 6.7 模态 vs Drawer
- 居中 < 600px 内容 → Modal
- 侧边辅助信息（设置 / 详情）→ Drawer,从右滑入,400ms

---

## 7. 暗色模式

### 7.1 切换方式
- 设置页手动切换
- 跟随系统（默认,`prefers-color-scheme`）

### 7.2 适配原则
- 重新调色,不是简单 invert（`#1a1a1a` ↔ `#e8e8e8` 不是反相）
- 暗色下阴影更弱（用 1px border 替代部分 shadow）
- 文字层级用明度差,不用纯灰
- accent 颜色 light/dark 用不同 hue（indigo-600 ↔ purple-500）,不是同一色不同亮度

---

## 8. 无障碍

### 8.1 键盘
- 所有交互元素 Tab 可达
- focus ring 永远可见（accent 2px 透明度 0.2）
- 模态打开: 焦点移到内部,关闭: 回到触发点
- 命令面板: 打开自动 focus 输入框

### 8.2 减少动画
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    transform: none !important;
  }
}
```

### 8.3 对比度
- 正文 vs 背景 ≥ 4.5:1 (WCAG AA)
- 大文字 ≥ 3:1
- 工具: a11y-lint + axe-core 集成到 CI

### 8.4 ARIA
- 所有 icon-only 按钮加 aria-label
- 模态用 role="dialog" aria-modal="true"
- Toast 用 role="status" aria-live="polite"

---

## 9. 实施路线（3 周,12 个 commit）

### 第 1 周（基础 token + 核心组件）
1. `feat(tokens): 引入 design token CSS 变量系统`
2. `feat(button): Button 3 档 3 size + press 反馈`
3. `feat(card): Card 组件 + hover lift`
4. `feat(input): Input 组件 + focus ring`
5. `feat(skeleton): Skeleton 组件 + shimmer 动画`
6. `feat(modal): Modal 组件 + scale 进入`

### 第 2 周（交互 + 命令面板）
7. `feat(command-palette): 全局命令面板 + 键盘`
8. `feat(hover-actions): 列表 hover 操作按钮淡入`
9. `feat(empty-states): Chat / Skills / Models 智能空状态`
10. `feat(theme): 主题切换 + View Transitions`

### 第 3 周（暗色 + 无障碍 + 加载统一）
11. `feat(dark-mode): Cursor 深色主题 token 适配`
12. `feat(a11y): focus ring + reduced-motion + aria`
13. `feat(loaders): 4 种加载模式统一组件`

---

## 10. 度量与验收

### 10.1 视觉一致性
- 组件审查 0 偏差（无"我自己再调一下"）
- 所有 spacing/radius/color 走 token（ESLint 规则）
- 任何新组件必须从 5 个候选组件复用,不能新建

### 10.2 性能
- LCP < 1.5s
- FID < 100ms
- 动画不引起重排（只用 transform/opacity）

### 10.3 用户感知
- 命令面板打开 < 200ms (P90)
- 主题切换 < 200ms
- 模态出现 < 280ms
- 路由切换 0ms（瞬时）

### 10.4 可访问性
- WCAG 2.1 AA 全通过
- axe-core 0 violations
- 键盘可达 100%

---

## 11. 反例（明确不做的事）

| 类别 | 反例 | 理由 |
|---|---|---|
| 动画 | 弹性 bounce / 3D 翻页 / 视差 | 工程师 app 显轻浮 |
| 视觉 | 彩虹渐变 / 阴影泛滥 / 毛玻璃过度 | 噪音 > 信息 |
| 字号 | 10 / 15 / 17 / 18 混乱 | 节奏感缺失 |
| 圆角 | 6 / 10 / 14 / 20 混用 | 选不出来 |
| 主题 | 5+ 套彩色 | 决策疲劳 |
| 加载 | 满屏菊花 + "加载中..." | 廉价感 |
| 错误 | 弹窗堆叠 | 噪音 |
| 路由 | slide / 缩放 | 工程师 app 嫌慢 |

---

## 12. 附录：参考截图与对照

实际对照来源：
- **Linear** sidebar + command palette: https://linear.app
- **Raycast** store + command palette: https://raycast.com
- **Cursor** editor + chat: https://cursor.com
- **Vercel** dashboard + deploy log: https://vercel.com/dashboard
- **Notion** sidebar + block menu: https://notion.so

---

**下一步**: 进入评审环节,owner 自评 + designer agent 评审 + 综合打分。
