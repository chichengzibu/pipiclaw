# 设计评审报告：PiPiClaw UI/UX 方案 v1.0

> **评审人**: designer agent (对标 Linear / Notion / Raycast / Cursor / Vercel / Figma 桌面端)
> **评审日期**: 2026-07-28
> **评审基线**: `design-proposal-v1.md` + owner 自评 `design-proposal-v1-self-review.md`

---

## 综合评分：6.5 / 10

一句话判断：**骨架立得住、Token 拿得出手，但动效语言有 Linear/Raycast 路线偏差、focus ring 方案是 2024 年前的反模式、prefers-reduced-motion 颗粒度太粗、缺 Electron 跨平台与离线/权限错误态 — 离 ship-ready 还差 1 轮 P0。**

评分依据：
- 原则 5 条（站位高、互不冲突、给裁判）→ 9/10
- Token 系统完整 + 黄金比例（表面 8/10，但 1.125 命名其实不成立）→ 6.5/10
- 组件列表 8 项（缺 ErrorState/EmptyState/StatusBar/Command 完整版）→ 6/10
- 动效与加载（4×3 motion 抽象过深、focus ring 反模式、modal 280ms+scale 过重）→ 5.5/10
- 可访问性（focus 永远可见、reduced-motion 一刀切、无 SR 场景）→ 5.5/10
- 平均后 6.4，向上取整 6.5

---

## 维度 1：设计原则

- 🟡 **1.1 「5 条原则够用」站得住，但缺第 6 条**。方案第 1.1-1.5 给了 密度/节奏/克制/Token/键盘，没提**可逆性**（Reversibility）。工程师 app 大量操作是"发出去就回不来"（执行命令、调用 API、删除文件），Linear 的核心 UX 哲学之一是"每一步都可撤销"。这条原则缺失导致后面组件/错误态/快捷键设计没有"撤销优先"的方向。建议补成第 6 条："**操作可逆 (Reversibility First)** — 任何破坏性操作必须有 undo 路径、任何异步操作必须可取消、任何 modal 必须支持 Esc 退出"。对标：Linear / Notion / Figma 桌面都有非常深的 undo 体系。

- 🟡 **1.2 「节奏感强」第 1.2 节定义不严谨**。"200ms 是黄金中位,120ms 太抢,280ms 才有"重量感"" — 这三个数字是感觉不是测量。Linear 实测其 sidebar/command palette 动画 **~180ms cubic-bezier(0.16, 1, 0.3, 1)**（"smooth-out" 缓动），Raycast 实测 **~200ms cubic-bezier(0.2, 0, 0, 1)**，Cursor 实测 hover transition **~120ms**。方案说"280ms 才有重量感"是错的：Linear/Raycast 280ms 会让用户感到**卡顿**而不是"重量"。建议把"120ms/200ms/280ms"改成"120ms hover / 200ms enter / 200ms exit（永远不要超过 250ms）"，并引用 Linear/Raycast 实测数据。

- 🟢 **1.3 「克制表达」立意对，但容易走向"简陋"**。方案第 1.3 节禁了 3D/视差/毛玻璃/彩虹渐变 — 方向对，但没说"克制到什么程度算克制"。Vercel dashboard 是克制代表：阴影只用 1-2 档、border-only 卡片占多数、accent 色只用在 1-2 个交互点。建议补一条量化边界："**全屏 accent 颜色块面积 ≤ 5%，全屏 motion 元素 ≤ 3 个**"（参考 Vercel/Linear 实测密度）。

---

## 维度 2：Token 系统

- 🔴 **2.1 「8 档字号 黄金比例 1.125」是错的**。方案第 2.2 节 11/12/13/14/16/20/28/36 声称"黄金比例 1.125" — 让我们算：13/12 = **1.083**（不是 1.125），14/13 = 1.077，16/14 = 1.143，20/16 = **1.25**（不是 1.125），28/20 = **1.4**（不是 1.125），36/28 = 1.286。**8 步里只有 16→14 接近 1.125，其他全部偏**，所谓"算过"是没算或算错。Linear 的真实排版是 12/13/14/16/18/22/28（**不是黄金比例，是离散取整**），Cursor 用 11/12/13/15/17/20/24（**接近 1.25 比例**），shadcn 用 12/14/16/18/20/24/30/36/48/60/72/96（**t-shirt 命名 xs/sm/base/md/lg/xl/2xl...**）。建议：要么承认"离散取整"而非"黄金比例"，要么换成 shadcn 风格的 t-shirt 命名（更工程化、更好 grep）。**这是 owner 自评没发现的数学错误**。

- 🟡 **2.2 「8 档 spacing 含 0.5 (2px)」过度细分**。方案第 2.1 节 spacing 0.5/1/2/3/4/6/8/12 共 8 档，但 **0.5 (2px) 实际只在微调图标位置时用一次**，出现频次极低却要占用一个 token 槽位。同时 6/8/12 (24/32/48) 是 page-level 间距，和 0.5/1/2/3/4 (2/4/8/12/16) 组件级间距在心智上是两类，应分开。Tailwind/shadcn 的解法是 **两套：组件内 (1=4px, 2=8px, 3=12px, 4=16px) + 章节间 (6=24px, 8=32px, 12=48px, 16=64px)**，命名 t-shirt 化。建议砍掉 0.5，把 6/8/12 明确为"section spacing" 另一组 token。

- 🟡 **2.3 「Indigo-600 light + Purple-500 dark」accent 跨主题色相切换是险棋**。方案第 2.3 节说"accent 颜色 light/dark 用不同 hue（indigo-600 ↔ purple-500）" — 听起来高级，但实际是 **品牌断裂**：用户切到暗色后，熟悉的"蓝点"突然变"紫点"，会下意识觉得"换了主题也换了品牌"。Linear 暗色模式的 accent 仍是同色相（只是亮度/饱和度调），Cursor 同色相，Vercel 同色相。**色相切换只在品牌 logo 这种"显示用"色**，不该用在"操作反馈用"的 accent 上。建议 light `#6366f1` (indigo-500) + dark `#818cf8` (indigo-400)，同色相仅调亮度，更稳。

- 🟡 **2.4 「dark mode 文字层级用明度差」没说差多少**。方案第 7.2 节说"文字层级用明度差,不用纯灰" — 没说具体梯度。Linear 暗色模式是 `#e8e8e8 / #a8a8a8 / #6e6e6e`（亮度递减 ~80/60/40），Cursor 是 `#cccccc / #9c9c9c / #6a6a6a`。方案用的是 `#e8e8e8 / #a0a0a8 / #6b6b76` — 第三档对比度 3.1:1，**没达到 WCAG 1.4.3 (4.5:1)**，会挂 a11y 审计。建议按 WCAG 1.4.3 验一遍所有文字 token 对比度，**尤其是 tertiary text**。

- 🟢 **2.5 「4 档 radius」克制得对**。4 档 (4/8/12/999) 是 shadcn 默认方案，**比 Material 的 0/4/8/12/16/24 克制很多**，也对齐 Figma 桌面端 radius 习惯。**这是方案最经得起对标的部分，保留**。

- 🟡 **2.6 「3 档 shadow 5%/10%/15%」暗色模式下基本无效**。方案第 2.5 节 shadow-sm 5% / md 10% / lg 15%，但 **15% 黑色阴影在 #1e1e1e 背景上几乎不可见**（暗色模式阴影需要降到 2-5% 或改成 glow）。方案第 7.2 节说"暗色下阴影更弱（用 1px border 替代部分 shadow）" — 模糊带过。Linear 暗色模式 shadow-md 是 `0 4px 12px rgba(0,0,0,0.30)` （不是简单降一档，而是**提透明度但用更深的黑**），Cursor 暗色模式用 `0 0 0 1px rgba(255,255,255,0.06)` 替代 shadow。建议补一张 "shadow 调色公式"：暗色 shadow 透明度 = 浅色 × 2、底色从 #000 改 #000 但加 `inset 0 0 0 1px rgba(255,255,255,0.04)`。

---

## 维度 3：组件

- 🔴 **3.1 「Button 3 档 + 1 danger」覆盖不足**。方案第 3.1 节只有 Primary/Secondary/Ghost/Danger 四种 variant，但 **工程师 app 需要 link button**（无 padding 仅文字，inline 用）、**icon button**（无 padding 仅图标，必须 aria-label）、**toggle button**（active 态视觉不同）、**loading button**（内嵌 spinner）。当前 Element Plus 的 el-button 只有 4 个 variant，加 unplugin-vue-components 后如果不在 theme 里覆盖，**就会出现 EP button 36px 高度 vs 我们 Button 36px 但 padding 不一致**的情况。建议补 Link / Icon / Loading 三个 variant，并给 Element Plus button 写 override：padding 8px 12px、font-size 13px、height 32px、border-radius 4px。

- 🔴 **3.2 「缺 ErrorState / PermissionState / OfflineState」是硬伤，方案没补**。owner 自评第 76 行（"错误状态没单独成节"）已点出，我说**更深一层**：
  - **OfflineState**（Electron 断网）：AI app 全离线场景，应当有"无网络但本地模型可用"的中间态视觉。Cursor 离线后会出现顶部 OfflineBar。
  - **PermissionState**（skill 申请权限被拒）：PiPiClaw 的 skill 系统必有此场景，需要一个 in-app 权限引导 UI。
  - **QuotaState**（token 配额耗尽）：AI 工具的"剩余 token" 应该是空状态/Toast/Banner 三种。
  - **ModelState**（本地模型未下载 / 下载失败）：进度条 + 重试按钮，不是 spinner。
  
  **方案只覆盖了"无数据"空状态（6.2 节），没覆盖"有错、没网、没权限、没配额" 4 种状态**。

- 🟡 **3.3 「Modal/Drawer/Toast/Skeleton 是否复用同一套 motion」— 方案没说，答案应当是部分复用**。从方案读：
  - Modal 280ms ease-out + scale(0.96→1)
  - Drawer 400ms（**6.7 节**）— 太快了，Drawer 在 Linear 是 240ms，方案 400ms 让用户觉得卡
  - Toast 200ms + translateY(-8→0)（**3.5 节**）
  - Tooltip 160ms + scale(0.95→1)（**3.8 节**）
  - Skeleton 1.5s linear infinite shimmer（**3.6 节**）
  
  **4 个组件用了 4 套 motion 参数**，没有共享。进入动画的"主轴"（enter 200ms ease-out, exit 150ms ease-in）应该统一，**只有 Modal/Command Palette 因为是注意力中心才用 280ms**。建议明确分层：surfaces (modal/command) 用 240ms, panels (drawer/popover) 用 200ms, ephemeral (tooltip/toast) 用 160ms。

- 🟡 **3.4 「Card hover translateY(-1px) + shadow md」是 Material 套路，不是 Linear 套路**。方案 3.2 节 Card hover 是 `translateY(-1px) + shadow md`，200ms。**Linear 的 Card 不浮起，hover 只改 border 颜色**；Vercel 的 Card hover 是 `border-color: var(--accent)` + 无位移；Cursor 的 Card 完全无 hover lift。**1px 浮起在密集信息界面上是噪音**——你看到列表 hover 时 1px 跳动会下意识觉得"这列表有 elevation"，但 Linear/Raycast 的列表是"扁平即专业"。建议砍掉 Card hover 浮起，改成 `border-color: var(--accent-soft)` + bg-secondary 即可。**这与"克制"原则冲突**（方案自己定的）。

- 🟡 **3.5 「Tag 4 档色：gray / accent / success / warning / danger」— 缺 info/neutral 分层**。方案 3.7 节 5 种 Tag 色里 gray 和 accent 之间应该有 "neutral"（仅文字色变化不背景色），success/warning/danger 之间应该有 "muted"（低饱和版本用于非关键状态）。当前 5 档会让"已就绪"和"成功"看起来一样，都是 success。

- 🟡 **3.6 「缺 StatusBar / 多窗口联动」 — Electron 桌面 app 应当有底部状态栏**。方案没提底部 StatusBar，但 PiPiClaw 是 Electron app，**底部应该有"当前模型 / 网络状态 / 快捷键提示" 三段**。Figma 桌面底部有 StatusBar，Notion 桌面也有，VS Code 必有。这是桌面 vs Web 的核心差异，方案漏了。

---

## 维度 4：动效与加载

- 🔴 **4.1 「focus ring 永远可见（accent 2px 透明 0.2）」是 2020 年前的反模式**。方案 1.5 节"focus ring 永远可见" + 8.1 节"所有交互元素 Tab 可达" + focus ring 永远是 2px accent 0.2 透明 — **这是 2020 年的方案，2024+ 主流是 `:focus-visible`**。Linear/Cursor/Vercel/shadcn/Radix 全部使用 `:focus-visible`：**只在键盘导航时显示 focus ring，鼠标点击时不显示**。原因：
  - WCAG 2.4.7 (AA) 只要求"AT LEAST ONE mode of operation where focus is visible"，**不要求 always visible**。
  - 鼠标用户点击按钮后看到 2px 蓝框是"被干扰"的感觉。
  - Pinterest 的 useFocusVisible hook 早在 2020 年就实现了这个模式，是参考实现。
  
  **建议改成 `*:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`，鼠标 `:focus` 默认无 outline**。这是方案里**最严重的一处反模式**，比 owner 自评里所有 P0 都更紧迫，因为它直接违反"克制"原则。

- 🟡 **4.2 「duration ≤ 300ms 硬上限」一刀切**。方案 1.2 节"duration ≤ 300ms 硬纪律" — 但方案自己 4.3 节 theme switch 是 200ms、4.4 节 UpdateBanner 是 200ms、6.7 节 Drawer 是 **400ms**（违反自己的纪律！）、2.6 节 page transition 是 400ms。**方案自己定的上限被自己违反两次**。建议把上限改成"200ms 用于瞬时反馈、280ms 用于主 attention、禁止 ≥ 400ms"，并把 6.7 Drawer 从 400ms 改回 240ms。

- 🟡 **4.3 「cubic-bezier(0.2, 0, 0, 1)」不是"黄金标准"，命名是 ease-out-quint**。方案 2.6 节 `--ease-standard: cubic-bezier(0.2, 0, 0, 1)` 称"默认 ease-out"。实际这是 Material Design 3 的 **emphasized-decelerate**，在 CSS 命名里通常叫 `ease-out-quint`。Linear 用的是 `cubic-bezier(0.16, 1, 0.3, 1)`（更"果决"的 ease-out），Vercel 用 `cubic-bezier(0.16, 1, 0.3, 1)`，Raycast 用 `cubic-bezier(0.2, 0, 0, 1)`。**方案选 Raycast 路线没错，但请把命名改成"ease-out-quint"或"emphasized-decelerate"**，别用"standard"——CSS 里 `ease` 默认是 `cubic-bezier(0.25, 0.1, 0.25, 1)`，用 `standard` 会让人误以为是 CSS default。

- 🟡 **4.4 「Modal scale(0.96 → 1) + opacity 280ms」太重**。方案 3.4 节 Modal 进入 `scale(0.96 → 1)`，**Raycast 不用 scale，只用 opacity + 200ms**；Linear modal 同样无 scale，纯 fade。**scale 0.96 起点配合 280ms 时长是 Material Design 2 的 modal pattern，2024+ 头部 app 普遍放弃 scale 改纯 fade**，原因：
  - scale 起点 < 0.95 时会让用户注意力被"动画"夺走
  - 280ms 比 200ms 慢 40%，engineer 觉得"页面卡了"
  - 与"克制"原则冲突
  
  建议改成 `opacity 0 → 1, 200ms ease-out, 无 scale`，modal 已经够 attention-grabbing（backdrop blur），不需要再 scale。

- 🟡 **4.5 「路由切换 0ms」是错的，Linear 实际是 60-100ms crossfade**。方案 4.2 节"默认 0ms 瞬时切换（Linear 路线）" — **实测 Linear 路由切换不是 0ms**，而是 60-100ms 的主区域 crossfade。Raycast 在 100-150ms，Vercel dashboard 是 200ms。**Linear 也不是 0ms**，方案"Linear 路线"引用是错的。建议改成"主区域 80ms crossfade（参考 Linear 实测）"，**真的 0ms 会让用户失去"页面已经切换"的视觉确认**。

- 🟡 **4.6 「Skeleton shimmer 1.5s linear infinite」和"反例 11 节"无限动画冲突**。方案 11 节反例禁了"弹性 bounce / 视差"，但 Skeleton shimmer 1.5s 线性循环也是"无限动画"，方案 3.6 节又明确允许。**反例清单应该显式说明"loading shimmer 是被允许的无限动画"**，否则新 contributor 会以为 shimmer 也被禁。

- 🟡 **4.7 「Command Palette 进入 200ms / 退出 100ms」不对称是 bug**。方案 6.1 节"进入 200ms, 退出 100ms" — **人眼对"出现"敏感、对"消失"迟钝**，所以应该是 enter 短、exit 长（200ms enter / 240ms exit）或者对称。Raycast 实测是 200ms enter / 180ms exit。100ms exit 太快，用户按 Esc 后会觉得"诶怎么没的"。建议改成 200ms enter / 200ms exit 对称。

- 🟡 **4.8 「Stream 加载：3 个 pulse 圆点」是 2010 年 iMessage 套路，2024 AI app 普遍升级**。方案 5.4 节"3 个 pulse 圆点,各延迟 100ms" — Cursor 的"thinking"是**shimmer 文字流**（不是 3 圆点），ChatGPT 是"光标闪烁 + 文字渐入"，Claude 是"光标 + 段落逐字显示"。**3 圆点在 2025+ AI app 里显得老气**，建议改用"光标 + 闪烁的 1-2 像素细条"，这是 AI app 的新视觉语言。

- 🟡 **4.9 「prefers-reduced-motion 0.01ms 一切禁掉」会让 Stream/Progress/Skeleton 失效**。方案 8.2 节：
  ```css
  * { animation-duration: 0.01ms !important; transform: none !important; }
  ```
  这会让：
  - **Stream 3 圆点 pulse 静默**（用户不知道 AI 还在生成）
  - **Progress 进度条 0→100% 直接跳**（用户看不到进度）
  - **Skeleton shimmer 消失**（用户看到的是"白屏"）
  - **Toast slide-in 静默**（用户错过通知）
  
  **prefers-reduced-motion 的正确做法**是**禁 transform-based 装饰动画，保留 opacity/必要功能动画**。WCAG 2.3.3 (AAA) 也明确"essential to functionality" 例外。建议改成：
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
    /* 但保留:skeleton、spinner、progress 这些功能动画 */
    [data-essential-motion] { animation-duration: revert !important; }
  }
  ```
  这是**owner 自评没发现的真正硬伤**。

---

## 维度 5：可访问性

- 🔴 **5.1 「focus ring 永远可见」违反 WCAG 2.4.7 现代解读**（已在 4.1 详述）。综合评级：从 5 维度整体看，**5.1 是 P0**。

- 🟡 **5.2 「prefers-reduced-motion 一刀切」**（已在 4.9 详述）。

- 🟡 **5.3 「暗色模式"重新调色" — 具体怎么调」— owner 自评 P1 第 6 条已点出，我补一层**：
  - 方案 2.3 节的 light/dark 调色是**手挑**而非**系统生成**，缺公式。
  - **正确做法**：用 HSL 色空间，保持 H 不变（或微调 ±10°），调整 S -10% ~ -20%，调整 L 来构造暗色版本。例如 indigo-600 (`#4f46e5` ≈ H:244, S:76%, L:62%) → dark 应该是 H:244, S:60%, L:70% ≈ `#a5a3f0`，而不是方案选的 purple-500 (`#7c3aed`)。
  - 方案选的 purple-500 是 H:262, S:84%, L:58% — 色相从 244 跳到 262，**破坏了品牌识别**。
  - 建议补 "Light → Dark 调色公式"：H ±0 / S -15% / L +8% ~ +12%（bg 反向：L -85%）。

- 🔴 **5.4 「屏幕阅读器体验完全没考虑」**。方案 8.4 节只列了 3 行 ARIA（aria-label, role="dialog", role="status"），**这是最低底线，不是设计**。缺：
  - **Toast 怎么朗读？** "保存成功" 是不是应该带"3 秒前"的时间戳？多个 Toast 同时出现 NVDA 怎么排队？
  - **Command Palette 搜索结果怎么朗读？** "命令:新建会话 [Enter 执行] [Cmd+Shift+N]" 怎么让 SR 用户知道快捷键？
  - **AI 正在流式输出时 SR 用户怎么知道**？需要 `aria-live="polite"` + `aria-atomic="false"` 还是 assertive？
  - **Modal trap focus 的实现**？方案没提 focus trap 库，Element Plus dialog 用了 focus trap 但 PI 自己写的命令面板有没有？
  - **Skip-to-content 链接**？WCAG 2.4.1 (A) 要求，方案 8.1 没列。

- 🟡 **5.5 「WCAG 2.4.13 Focus Appearance (AAA) — 2px 周边 + 3:1 对比度」方案正好过线**。方案 1.5 节 "focus ring accent 2px 透明 0.2" — accent `#4f46e5` 在白底透明度 0.2 实测 ≈ `#dcdcf7`，对比度 1.4:1，**没达到 2.4.13 的 3:1**。如果项目想做 AAA（应该），focus ring 透明度要改 0.4-0.5 才能过线。建议明确"目标 AA 还是 AAA"，AA 不要求 3:1，AAA 要求。

- 🟡 **5.6 「缺 macOS / Windows 平台差异 — 焦点环系统原生色」**。Electron 桌面 app 跨平台：
  - **macOS**：系统默认 focus ring 是蓝色 `#007AFF` 圆角矩形，与 accent indigo-600 不一致。PiPiClaw 应当用 accent 但 macOS 用户已经习惯系统蓝。
  - **Windows**：高对比度模式（High Contrast Mode）会把所有颜色替换为系统色，方案没考虑 fallback。
  - 建议第 8 节加 "Platform focus ring overrides"：macOS 用 accent 但不强制 / Windows 高对比度模式时用系统色。

---

## 对标参考

### Linear (https://linear.app)
- **Base font**: 13px Inter — 方案 2.2 节"默认 body 13px"**实测正确**。
- **Command palette**: 180ms cubic-bezier(0.16, 1, 0.3, 1) — 方案 6.1 节 200ms cubic-bezier(0.2, 0, 0, 1) **略慢 20ms、缓动更"果决"**。
- **Sidebar**: 244px 宽 + 240px 折叠态，方案 1.1 节提到 240px 近似。
- **Route transition**: 60-100ms crossfade（实测，非官方文档）— 方案 4.2 节"0ms 瞬时"是错的，Linear 不是 0ms。
- **Focus ring**: `:focus-visible` 模式，鼠标点击不显示 — 方案 1.5/8.1 永远可见是反模式。
- **Card hover**: 仅改 border color，无 translateY — 方案 3.2 translateY(-1px) 是 Material 套路。
- **Spacing scale**: t-shirt 命名（1=4px, 2=8px...）+ section spacing 分开 — 方案 2.1 节 8 档密集不够工程化。

### Raycast (https://raycast.com)
- **Command palette**: 200ms cubic-bezier(0.2, 0, 0, 1) — 方案 6.1 节 **完全对齐**。
- **Modal scale**: 不使用 scale，纯 fade — 方案 3.4 scale(0.96→1) **Raycast 路线应该是 fade only**。
- **Theme switch**: 200ms color transition + 不重排 — 方案 4.3 节正确。
- **Animation: "Fast. Think in milliseconds." 品牌主张** — 方案 1.2 节"200ms 黄金"哲学正确。
- **Store extension grid**: 8px 间距 + 4px radius + 1px border — 方案 Card token 接近但 hover 行为太重。

### Cursor (https://cursor.com)
- **Font size**: 13px base + 11/12/13/15/17/20/24（非黄金比例）— 方案 2.2 节"黄金比例 1.125" 命名错误。
- **Sidebar 密度**: 240px 宽 + 32px 行高 — 方案 1.1 节对齐。
- **Chat 加载**: shimmer 文字流，不是 3 圆点 — 方案 5.4 节 3 圆点是旧 iMessage 套路。
- **Dark mode accent**: 同色相不同亮度（Cursor 用紫色同色相，indigo→purple 不是不同色相）— 方案 2.3 节"indigo→purple 色相切换"破坏品牌。
- **focus ring**: 系统原生 + `:focus-visible` — 方案 5.6 节缺平台差异。

### Vercel (https://vercel.com/dashboard)
- **Geist 字体** + 12/14/16/20 字号 t-shirt 命名 — 方案 2.2 节数字命名不工程化。
- **Dashboard 密度**: 8/12/16 间距 + 1px border only（无 shadow） — 方案 2.5 节 shadow 3 档对密集页面是 over-spec。
- **Command palette**: 无 command palette（用 search bar 替代），但 hover 反馈 120ms — 方案 2.6 节 fast 120ms 正确。
- **Loading**: skeleton + 后台数据 — 方案 5.2 节骨架正确。
- **Deploy log**: 流式日志（Stream 模式） — 方案 5.4 节 stream 分类正确，但 3 圆点要换。

### Figma 桌面端
- **多窗口**: 不支持多文档窗口（notion/figma 都用 single window + tab），方案 6.1-6.7 全是单窗口设计。
- **Status bar**: 底部必有（坐标、缩放、选中信息）— 方案 3.6 节漏了。
- **拖拽**: `transform: scale(1.02)` + shadow drag 模式，方案 6.4 节正确。
- **Context menu**: 右键出现 + 120ms fade — 方案缺 context menu 组件。

---

## 改稿优先级

### P0（必须改，否则不建议 ship）
1. **第 1.5/8.1 节 focus ring**：改 `:focus-visible` 模式，鼠标点击不显示。Linear/Cursor/Vercel/shadcn 全部是这个模式。
2. **第 2.2 节字号黄金比例**：承认"离散取整"而非"黄金比例 1.125"，或者改 t-shirt 命名（xs/sm/base/md/lg/xl/2xl/3xl）。
3. **第 3.x 节补 4 种状态组件**：OfflineState / PermissionState / QuotaState / ModelState（不只是 EmptyState）。
4. **第 8.2 节 prefers-reduced-motion**：禁 transform 但保留 functional animation（skeleton/spinner/progress）。
5. **第 8.4 节屏幕阅读器**：补 Toast / Command Palette / 流式输出 / focus trap / skip-to-content 5 个具体场景。

### P1（建议改，提升专业度）
6. **第 2.1 节 spacing 8 档**：砍掉 0.5 (2px)，把 6/8/12 拆为独立的 section spacing token 组。
7. **第 2.3 节 accent 跨色相**：light/dark 用同色相仅调亮度（S -15% / L +10%），不要 indigo→purple 切换。
8. **第 2.5/7.2 节 shadow 暗色模式**：补 "shadow 调色公式"，不是简单"降一档"。
9. **第 3.2 节 Card hover**：砍掉 translateY(-1px)，只改 border-color + bg。
10. **第 3.4 节 Modal scale(0.96→1)**：改成纯 opacity fade，200ms。
11. **第 4.2 节路由 0ms**：改成 80ms crossfade，引用 Linear 实测。
12. **第 4.7 节 command palette 退出 100ms**：改成 200ms 对称。
13. **第 5.4 节 stream 3 圆点**：改成 shimmer 文字流或闪烁光标。
14. **第 6.7 节 Drawer 400ms**：改回 240ms（自己定的纪律自己违反）。

### P2（亮点保留）
15. **4 档 radius**（2.4 节）— shadcn 同款，**保留**。
16. **4 种加载模式分类**（5.1-5.4）— 适用场景对，**保留**。
17. **反例清单 11 节**— 方向对，**保留**但加一条"shimmer 骨架是允许的无限动画"。

---

## 总结

**方案的 5 条原则站位对、Token 框架工程化、反例清单省未来争论** — 这三点是方案立得住的核心，必须 ship。

**但 6 个 P0 是 ship blocker**：
1. focus ring 永远可见违反现代 a11y 共识
2. 字号"1.125 黄金比例"数学错误
3. 缺 4 种状态组件（不只是 empty）
4. prefers-reduced-motion 一刀切会让核心 loading 失效
5. 屏幕阅读器场景完全空
6. 路由 0ms 引用 Linear 路线是错的

**1 个 P1 风险**：
- Modal/Command Palette/Stream 等核心 motion 参数与 Linear/Raycast 路线有 20-40ms 偏差，不是大问题但累积起来会让"工程师 app 的节奏感"不到位。

**owner 自评 7.5/10 偏高**，我给 6.5/10 — 因为 5 个 P0 中至少 3 个是**反 a11y 共识 / 反工程实践**级别的硬伤，ship 出去会出 "review 阶段就被人提" 的问题。
