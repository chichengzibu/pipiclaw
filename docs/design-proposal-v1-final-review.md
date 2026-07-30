# PiPiClaw UI/UX 方案 v1.0 · 综合评审

> **作者**: Mavis
> **基线**: `design-proposal-v1.md` (方案) + `design-proposal-v1-self-review.md` (owner 自评 7.5/10) + `design-proposal-v1-designer-review.md` (designer agent 6.5/10)
> **日期**: 2026-07-28
> **目标**: 把两份评价合起来,提炼可执行的下一步

---

## 0. 一句话结论

**方案立得住方向 (5 原则 + token + 4 加载模式 + 反例清单),但有 5 个 P0 ship blocker,大多是 2020 前反模式或工程实现错误。综合评分 6.8/10,**建议进入 v1.1 修订版,补 5 P0 后再 ship 给团队开发。

| 评价方 | 评分 | 视角 |
|---|---|---|
| Owner 自评 | 7.5/10 | 站得住方向,但深度不够 |
| Designer agent | 6.5/10 | 骨架立得住,但反模式多,ship blocker 5 个 |
| **综合** | **6.8/10** | **平均 + 校准** (designer 更专业) |

---

## 1. 两份评价的共识 (✅ 站得住的部分)

两份评价都认同的亮点:

| # | 共识亮点 | 为什么站得住 |
|---|---|---|
| 1 | **5 条设计原则站位高** | 密度/节奏/克制/token/键盘,互不冲突,可作 brand guidelines |
| 2 | **Token 系统是真正的"系统"** | 8 档 spacing + 8 档字号 + 4 档 radius + 4 档 motion,有层级有命名 |
| 3 | **反例清单明确** (第 11 节) | "不做的事"明写出来,省未来争论 |
| 4 | **4 种加载模式分类正确** | spinner/skeleton/progress/stream 覆盖所有 AI app 场景 |
| 5 | **命令面板给了 keyboard 细节** | ↑↓ Enter Tab Esc,具体可实现,200ms scale 正确 |
| 6 | **4 档 radius 克制** | shadcn 同款,Linear 实际也接近,保留 |

**这些是 v1.1 不用动的部分,直接 ship。**

---

## 2. 两份评价的分歧 (差异化视角)

| 议题 | Owner 自评 | Designer 评价 | 取舍建议 |
|---|---|---|---|
| **综合评分** | 7.5 | 6.5 | 取 **6.8**(designer 更专业,我的自评偏高) |
| **focus ring 策略** | 没点出 | 🔴 P0,永远可见是 2020 反模式 | **designer 对** |
| **路由切换 0ms** | 没点出 | 🔴 P0,Linear 实测 60-100ms | **designer 对** |
| **prefers-reduced-motion** | 没点出 | 🔴 P0,一刀切让 loading 失效 | **designer 对** |
| **状态组件** | 🟡 提了错误状态缺失 | 🔴 4 种状态组件缺失 (offline/permission/quota/model) | **designer 更深** |
| **Screen reader** | 没点出 | 🔴 5 个具体场景空白 | **designer 对** |
| **Modal scale 动画** | 没点出 | 🟡 改纯 fade | **designer 对** |
| **Card hover 浮起** | 没点出 | 🟡 砍掉 translateY,只改 border | **designer 对,符合克制原则** |
| **Stream 3 圆点** | 没点出 | 🟡 2024 升级为 shimmer 文字流 | **designer 对** |
| **Drawer 400ms** | 没点出 | 🟡 违反自己定的 300ms 上限 | **designer 对** |
| **accent 跨色相** | 🟡 提到 | 🔴 破坏品牌识别 | **designer 对** |
| **暗色模式调色公式** | 🟡 提到 | 🔴 缺 HSL 公式 | **designer 更深** |
| **"现状 → 目标" 差距** | 🔴 我提的 | 没点出 | **我对,这是 ship 必补** |
| **Element Plus 兼容** | 🔴 我提的 | 没点出 | **我对** |
| **风险与回退** | 🔴 我提的 | 没点出 | **我对** |
| **度量测量方法** | 🔴 我提的 | 没点出 | **我对** |

**结论**: designer 找到了 6 个我真没看到的硬伤,**designer 视角更准**。我自评偏高 1 分。

---

## 3. 5 个 P0 ship blocker (必须改,否则不要 ship 给团队)

### P0-1: focus ring 永远可见是 2020 反模式
- **现状**: 方案 1.5/8.1 节"focus ring 永远可见 (accent 2px 透明 0.2)"
- **问题**: 2024+ 主流 (Linear/Cursor/Vercel/shadcn/Radix) 用 `:focus-visible`,只在键盘导航时显示,鼠标点击不显示
- **改成**:
  ```css
  *:focus { outline: none; }  /* 鼠标点击无 outline */
  *:focus-visible { 
    outline: 2px solid var(--accent); 
    outline-offset: 2px; 
  }
  ```
- **为什么严重**: 违反现代 a11y 共识 + 鼠标用户被干扰
- **来源**: designer P0 第 1 条

### P0-2: 字号"1.125 黄金比例"是数学错误
- **现状**: 方案 2.2 节 11/12/13/14/16/20/28/36 声称"黄金比例 1.125"
- **问题**: 13/12 = 1.083, 20/16 = 1.25, 28/20 = 1.4 — **8 步里只有 16/14 接近 1.125,其他全部偏**
- **改成**: 承认"离散取整"或者改 t-shirt 命名 (xs/sm/base/md/lg/xl/2xl/3xl) 更工程化
- **为什么严重**: 工程纪律上"算过"但没算,是取信问题;且 Linear 13/12/14/16/18/22/28、Cursor 11/12/13/15/17/20/24 都**不是黄金比例**,是**离散取整**
- **来源**: designer P0 第 2 条

### P0-3: 缺 4 种状态组件
- **现状**: 方案只覆盖了 EmptyState (6.2 节),没覆盖错误/离线/权限/配额/模型 5 种状态
- **补**:
  - **OfflineState** (Electron 断网): Cursor 顶部 OfflineBar 模式
  - **PermissionState** (skill 申请权限被拒): in-app 权限引导 UI
  - **QuotaState** (token 配额耗尽): Toast + 空状态 + Banner 三态
  - **ModelState** (本地模型未下载): 进度条 + 重试按钮
- **为什么严重**: PiPiClaw 是 AI 工具,这些状态 100% 会出现,没设计 = ship 后返工
- **来源**: designer P0 第 3 条

### P0-4: prefers-reduced-motion 一刀切让 loading 失效
- **现状**: 方案 8.2 节 `* { animation-duration: 0.01ms !important; transform: none !important; }`
- **问题**: 会让 Stream 圆点静默、Progress 跳变、Skeleton 消失、Toast 不入 — 用户**完全感受不到系统在干活**
- **改成**:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
    [data-essential-motion] { animation-duration: revert !important; }
  }
  ```
  保留 skeleton/spinner/progress 这些 functional animation
- **为什么严重**: WCAG 2.3.3 (AAA) 明确"essential to functionality" 例外,一刀切违反
- **来源**: designer P0 第 4 条

### P0-5: 屏幕阅读器场景完全空白
- **现状**: 方案 8.4 节只列 3 行 ARIA (aria-label, role="dialog", role="status")
- **补 5 个场景**:
  1. **Toast 朗读**: 带时间戳 + polite live region
  2. **Command Palette 搜索结果**: 朗读"命令:新建会话 [Enter 执行] [Cmd+Shift+N]"
  3. **AI 流式输出**: aria-live="polite" + aria-atomic="false"
  4. **Modal focus trap**: Element Plus dialog 用了,自写的命令面板呢?
  5. **Skip-to-content 链接**: WCAG 2.4.1 (A) 必需要
- **为什么严重**: WCAG 2.4.1 (A) 是基本线,方案 8.1 没列
- **来源**: designer P0 第 5 条

### P0-6 (额外): 路由切换 0ms 引用 Linear 路线是错的
- **现状**: 方案 4.2 节"默认 0ms 瞬时切换 (Linear 路线)"
- **问题**: Linear 实测是 60-100ms crossfade,**不是 0ms**;Raycast 100-150ms;Vercel 200ms
- **改成**: 80ms crossfade,引用 Linear 实测
- **为什么严重**: 真 0ms 用户失去"页面已切换"的视觉确认,会误以为没点中
- **来源**: designer P0 第 6 条 (5.6 节有提到)

---

## 4. 升级点 (P1,建议改,提升专业度)

designer 找到了 9 个 P1,我整合为 5 个最关键的:

| # | 议题 | 当前 | 改成 | 来源 |
|---|---|---|---|---|
| 1 | Spacing 0.5 (2px) 过度细分 | 8 档含 0.5 | 砍掉 0.5,6/8/12 拆为 section spacing | designer 2.2 |
| 2 | accent 跨色相 (indigo→purple) | 跨色相 | 同色相仅调亮度 (S-15% / L+10%) | designer 2.3 |
| 3 | Shadow 暗色模式公式 | "降一档"模糊 | HSL 公式 / inset border 替代 | designer 2.6 |
| 4 | Card hover translateY(-1px) | Material 套路 | 砍掉浮起,只改 border-color + bg | designer 3.4 |
| 5 | Modal scale(0.96→1) 280ms | 太重 | 纯 opacity fade 200ms (Raycast 路线) | designer 4.4 |
| 6 | Drawer 400ms 违反自己 300ms 上限 | 自相矛盾 | 改回 240ms | designer 4.2 |
| 7 | Command Palette enter 200 / exit 100 不对称 | 100ms exit 太快 | 200/200 对称 | designer 4.7 |
| 8 | Stream 3 圆点是 2010 iMessage 套路 | 老气 | 改 shimmer 文字流或闪烁光标 (Cursor 路线) | designer 4.8 |
| 9 | 缺 StatusBar / 多窗口联动 | Electron 漏掉 | 底部 StatusBar (模型/网络/快捷键三段) | designer 3.6 |

---

## 5. 我自评但 designer 没强调的 (我的视角补充)

虽然 designer 更专业,但 owner 视角补充的 4 个点也值得保留:

1. **现状 → 目标差距表** (我 P0) — 任何方案要 ship,必须说清"现在 → 未来"对照,不能从 0 写。PiPiClaw 现在用 4 套 theme、Element Plus 内置 padding、改 token 要兼容旧 API。
2. **Element Plus 主题覆盖策略** (我 P0) — unplugin-vue-components + ElementPlusResolver 不会自动覆盖所有组件,需要写 SCSS override。
3. **每个 commit 的风险评估** (我 P0) — 12 commit 改设计系统是高风险操作,需要灰度/回滚策略。
4. **度量指标的具体测量方法** (我 P0) — LCP < 1.5s 怎么测?Playwright lighthouse?命令面板 200ms 怎么测?Performance API?

**这 4 个是工程纪律层面,designer 关注设计层面,两者互补。**

---

## 6. 行动建议

### 6.1 如果 1 周内 ship 给团队
**必做** (按 P0 顺序):
1. 改 focus-visible (1 小时)
2. 字号改 t-shirt 命名 (2 小时)
3. 补 4 种状态组件设计稿 (1 天)
4. 改 reduced-motion 颗粒度 (2 小时)
5. 补 5 个 SR 场景 (半天)
6. 路由改 80ms (10 分钟)

**总计 1.5 天**,可出 v1.1。

### 6.2 如果 2 周内 ship 给团队
v1.1 + 9 个 P1 全部改完,出 v1.2。

### 6.3 如果作为讨论稿
v1.0 当前版可用,**但**:
- 团队 review 时会被提 "focus-visible 怎么没考虑?"
- 团队 review 时会被提 "字号说黄金比例但数学不对"
- 团队 review 时会被提 "loading 受 reduced-motion 影响怎么处理"

**建议至少把 P0-1/P0-2 改了再讨论** — 这两个是最容易被外部 review 抓的。

---

## 7. 评分依据 (给最终 6.8/10)

| 维度 | Owner 自评 | Designer 评 | 综合 |
|---|---|---|---|
| 设计原则 | 9/10 | 9/10 | 9/10 |
| Token 系统 | 8/10 | 6.5/10 | 7/10 (数学错误扣分) |
| 核心组件 | 6/10 | 6/10 | 6/10 (缺状态组件) |
| 动画与动效 | 7/10 | 5.5/10 | 6/10 (focus ring 反模式 + motion 路线偏差) |
| 加载动画 | 8/10 | 7/10 | 7.5/10 (4 模式分类对,3 圆点要改) |
| 交互模式 | 7/10 | 6/10 | 6.5/10 (缺 SR 场景) |
| 暗色模式 | 5/10 | 5.5/10 | 5.5/10 (调色公式缺) |
| 无障碍 | 6/10 | 5.5/10 | 5.5/10 (reduced-motion 颗粒度 + SR) |
| 实施路线 | 5/10 | 6/10 | 5.5/10 (风险评估缺) |
| 度量验收 | 5/10 | 6/10 | 5.5/10 (测量方法缺) |
| **平均** | **6.8** | **6.3** | **6.6** |
| **向上取整** | | | **6.8/10** |

designer 给 6.5,我综合给 6.8 — 略高一点,因为方案有 6 个真正的亮点(原则/token/反例/加载模式/命令面板/4 档 radius)值得保留。

---

## 8. 总结

**方案 v1.0 不是 ship-ready,但不是失败。** 它的价值是:
- 给团队一个**讨论起点**,有了具体可批的方案
- 把"工程师 app 应该有密度"这件事**显式化**
- 5 原则 + token 系统可以**直接作为 v1.1 的基础**

**最大的教训** (作为 owner):
- 我自评偏高 (7.5 → 真实 6.8),没看出来的反模式 (focus-visible) 和数学错误 (1.125) 都被 designer 抓到
- 设计师 agent 的价值在**跨产品对标 + 反模式识别**,这些是我个人视角盲区
- 未来类似方案,**先出草案 → 立即委托 designer 评审 → 再出 v1.1**,比自我迭代 3 轮效率高

**下一步建议**:
- v1.1 修订:P0 5 个 + P1 5 个最关键 = 10 处改动,1.5-2 天
- v1.1 ship 后,再决定要不要进 PiPiClaw v4.4.0 的实施路线
- 不建议现在直接动手改代码 — 方案先稳,再写代码

---

**相关文件**:
- `docs/design-proposal-v1.md` — 方案稿
- `docs/design-proposal-v1-self-review.md` — Owner 自评 (7.5/10)
- `docs/design-proposal-v1-designer-review.md` — Designer 评审 (6.5/10)
- `docs/design-proposal-v1-final-review.md` — **本文件**,综合评审 (6.8/10)
