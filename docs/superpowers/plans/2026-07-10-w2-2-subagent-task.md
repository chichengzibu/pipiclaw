# W2.2 — 12 View 视觉翻新 Subagent 任务指令

> **执行方**:1 个 general_purpose_task subagent(串行处理 12 view)
> **执行窗口**:约 30-60 分钟
> **前置 commit**:`bdcf97b` Apple HIG design tokens(已合入 master)
> **目标 commit**:12 个 `feat(view-<name>): Apple HIG refresh` commit
> **当前工作目录**:`D:\pipiclaw\piclaw`
> **node_modules**:已通过 `npm install --ignore-scripts` 就位(vitest/jsdom 可用)
>
> **职责分工**:
> - **subagent**:改文件(12 个 view)+ 自查清单 + 返回每 view 的 diff 统计 + 难题/决策报告。**不跑 git**。
> - **主会话(控制器)**:逐个 view 验收 → 跑 `git add` + `git commit` → 12 个 commit 落库 → 跑全量 vitest 兜底。

---

## 1. 任务一句话

把 12 个 view 的视觉风格从"混杂 px / 硬编码色 / 随意圆角"统一到 **Apple HIG**,
借助 `src/styles/tokens.css` 已就位的 8 组 CSS 变量,完成视觉翻新 + 12 个独立 commit。

---

## 2. 已有资源(不要重新发明)

### 2.1 Apple HIG Tokens(`src/styles/tokens.css`,132 行)

> subagent **必须先 Read 这个文件** 了解全部可用变量,不要凭想象硬编码 px。

| 类别 | 变量 |
|---|---|
| Spacing | `--space-xs`(4)/`sm`(8)/`md`(16)/`lg`(24)/`xl`(32)/`2xl`(48)/`3xl`(64) |
| Typography | `--font-size-display`(28)/`title-1`(22)/`title-2`(17)/`body`(15)/`callout`(13)/`caption-1`(11)/`caption-2`(9) |
|  | `--font-weight-regular`(400)/`medium`(500)/`semibold`(600)/`bold`(700) |
|  | `--line-height-tight`(1.2)/`normal`(1.5)/`relaxed`(1.7) |
|  | `--font-family-system` / `--font-family-mono` |
| Motion | `--ease-spring` / `--ease-standard` / `--ease-decelerate` / `--ease-accelerate` |
|  | `--duration-fast`(200ms)/`base`(300ms)/`slow`(500ms) |
| Radius | `--radius-sm`(4)/`md`(8)/`lg`(12)/`xl`(16)/`pill`(999) |
| Layout | `--title-bar-height`(32)/`side-nav-width`(200)/`side-nav-width-collapsed`(64)/`inspector-width`(360)/`content-max-width`(1200)/`content-padding`(16) |
| Shadow | `--shadow-sm` / `md` / `lg` / `xl`(暗色下透明度从 0.04 升到 0.2+) |
| Z-index | `--z-base`(1)/`elevated`(10)/`dropdown`(100)/`modal`(1000)/`toast`(2000)/`tooltip`(3000) |
| Components | `--button-height-sm`(24)/`md`(32)/`lg`(40)、`--input-height-md`(32)、`--icon-size-sm`(14)/`md`(16)/`lg`(20)/`xl`(24) |

### 2.2 SCSS 主题色系统(`src/styles/variables.scss`,258 行,**5 主题**)

> subagent **不要改这个文件**——颜色主题已完整,翻新时**只引用** SCSS 变量即可。

主题清单:
- `warm-tech`(默认)
- `ocean-blue`
- `forest-green`
- `elegant-purple`
- `sakura-pink`

每个主题通过 SCSS mixin `@include theme(theme-name) { ... }` 注入 `--page-bg / --text-primary / --card-bg / --primary-color` 等颜色变量。

### 2.3 `global.scss` 已 `@use` tokens.css

任何 view / component 都可以直接 `var(--space-md)`。

---

## 3. 12 View 翻新顺序(串行)

> **建议顺序**:从"最简单"到"最复杂",让 subagent 越做越熟练。

| # | View | 文件 | 估计 SCSS 行数 | 难度 |
|---|---|---|---|---|
| 1 | Help | `src/views/Help.vue` | ~150 | 简单 |
| 2 | RemoteControl | `src/views/RemoteControl.vue` | ~150 | 简单 |
| 3 | Schedule | `src/views/Schedule.vue` | ~260 | 简单 |
| 4 | PluginMarket | `src/views/PluginMarket.vue` | ~140 | 中 |
| 5 | SkillMarket | `src/views/SkillMarket.vue` | ~150 | 中 |
| 6 | Models | `src/views/Models.vue` | ~600 | 中 |
| 7 | Permissions | `src/views/Permissions.vue` | ~400 | 中 |
| 8 | Tasks | `src/views/Tasks.vue` | ~510 | 中 |
| 9 | SkillsView | `src/views/SkillsView.vue` | 中 |
| 10 | Settings | `src/views/Settings.vue` | ~850 | 复杂 |
| 11 | Dashboard | `src/views/Dashboard.vue` | ~150 | 复杂(密集布局) |
| 12 | Chat | `src/views/Chat.vue` | ~1560 | 极复杂(主战场) |

---

## 4. 每 View 翻新的具体动作(逐条核对清单)

### 4.1 间距(最常改)

- [ ] 所有 `padding: <X>px` / `margin: <X>px` → 改为 `var(--space-{xs|sm|md|lg|xl|2xl|3xl})`
- [ ] 奇数 px(如 `5px` `7px` `13px` `15px` `21px` `27px` `45px`)→ 强制改为 4 的倍数
- [ ] `gap: <X>px` → 同样改为 token
- [ ] 行高 `1.2 / 1.5 / 1.7` → `var(--line-height-{tight|normal|relaxed})`

### 4.2 字号 / 字重

- [ ] `font-size: 14px / 15px / 16px / 18px / 20px / 24px` → 7 档 token(`caption-2` 9 / `caption-1` 11 / `callout` 13 / `body` 15 / `title-2` 17 / `title-1` 22 / `display` 28)
- [ ] `font-weight: 400 / 500 / 600 / 700` → 4 档 token
- [ ] `font-family: -apple-system, ...` 长串 → `var(--font-family-system)`(除非已是等效 fallback)

### 4.3 圆角

- [ ] `border-radius: 4px / 6px / 8px / 10px / 12px / 16px` → 5 档 token
- [ ] 标签 / pill 形 → `var(--radius-pill)`

### 4.4 阴影

- [ ] `box-shadow: 0 2px 8px rgba(0,0,0,0.06)` 等硬编码 → `var(--shadow-{sm|md|lg|xl})`
- [ ] 暗色下阴影会随 `prefers-color-scheme` 自动加深,无需手动调

### 4.5 Z-index

- [ ] `z-index: 999 / 9999` 魔数 → 6 档 token
- [ ] dropdown/modal/toast/tooltip 必须用对应档

### 4.6 颜色

- [ ] **不要碰颜色变量**(`var(--text-primary)` `var(--page-bg)` 等已由 variables.scss 5 主题管理)
- [ ] `color: #xxx` / `background: #xxx` / `background-color: #xxx` 硬编码 → 必须改为 SCSS 主题色变量
  - 例:`color: #333` → `color: var(--text-primary)`
  - 例:`background: #fff` → `background: var(--card-bg)`
  - 例:`border: 1px solid #ddd` → `border: 1px solid var(--border-color)`
- [ ] 实在没有对应 SCSS 变量(如警告色 / 成功色)→ 沿用 `var(--el-color-warning)` / `var(--el-color-success)`(Element Plus 已集成)

### 4.7 动效

- [ ] `transition: all 0.2s ease` → `transition: all var(--duration-fast) var(--ease-standard)`
- [ ] 交互态:hover / focus / active → 统一用 `--duration-fast`(200ms)

### 4.8 组件尺寸

- [ ] 按钮高度:`height: 28px / 32px / 36px / 40px` → `--button-height-{sm|md|lg}`
- [ ] 输入框:`height: 32px` → `--input-height-md`
- [ ] 图标:`width/height: 14/16/20/24px` → `--icon-size-{sm|md|lg|xl}`

### 4.9 布局 / 容器

- [ ] 标题栏 32px → `var(--title-bar-height)`
- [ ] 侧边栏 200/64px → `var(--side-nav-width{,-collapsed})`
- [ ] 检查器 360px → `var(--inspector-width)`
- [ ] 内容最大宽度 1200px → `var(--content-max-width)`
- [ ] 内容内边距 16px → `var(--content-padding)`

---

## 5. 验收清单(每个 view 改完前自查)

> subagent 在每个 view 改完、commit 前,必须跑一遍这 8 项自查。

1. [ ] **已 Read** 这个 view 文件 + `tokens.css` + `variables.scss`
2. [ ] **未修改** `tokens.css` / `variables.scss` / `global.scss`(其他 view / 公共组件)
3. [ ] **未修改** `<script setup>` 内任何 TypeScript / Vue 逻辑
4. [ ] **未修改** `<template>` 结构、组件引用、事件名(纯样式翻新,不改行为)
5. [ ] **未引入** 新的 npm 依赖
6. [ ] 所有 `padding/margin/gap` 改成 4 的倍数 token,无奇数 px
7. [ ] 所有 `font-size` 改用 7 档 token
8. [ ] 所有 `border-radius` 改用 5 档 token
9. [ ] 所有 `box-shadow` 改用 4 档 token
10. [ ] 所有 `z-index` 改用 6 档 token(0 和未指定除外)
11. [ ] 所有硬编码颜色 `#xxx` 改为 SCSS 主题色变量
12. [ ] 没有 `transition: all 0.Xs ease` 魔数,改用 `--duration-*` + `--ease-*`
13. [ ] `npx vitest run` 仍然 71/71 通过(无 regression)

---

## 6. 提交规范

### 6.1 提交粒度

**每个 view 一个 commit**。12 view = 12 commit。

### 6.2 Commit 消息格式

```
feat(view-<kebab-name>): Apple HIG visual refresh

W2.2 — 12 view 视觉翻新第 N/12 站

- 间距: <X> 处 padding/margin/gap 改为 --space-* 4 的倍数 token
- 字号: <X> 处 font-size 改为 --font-size-* 7 档 token
- 圆角: <X> 处 border-radius 改为 --radius-* 5 档 token
- 阴影: <X> 处 box-shadow 改为 --shadow-* 4 档 token
- 颜色: <X> 处硬编码色改为 var(--text-primary/--page-bg/--border-color) 等主题变量
- 动效: <X> 处 transition 改为 --duration-* + --ease-* token
- 布局: <X> 处宽度/高度改为 --button-height-* / --input-height-* / --icon-size-* 等 token

保留: 1.0.0 全部 5 主题 SCSS 颜色系统;模板结构与组件引用不动。
```

### 6.3 禁止事项(commit message 不写)

- 不写 emoji
- 不写"wip" / "draft" / "todo"
- 不写 BREAKING CHANGE(纯样式翻新不破坏 API)

---

## 7. Subagent 工作流(伪代码)

```
for i, view in enumerate(12_views, 1):
    1. Read(view_path)                              # 必读
    2. Read('src/styles/tokens.css')                # 重读,确认变量名
    3. grep 当前 view 的硬编码色、魔数 px、奇数 px
    4. plan:列出本 view 要改的位置(每行 <空格><token>)
    5. Edit(view_path, old_str, new_str)            # 多次 Edit
    6. 自查清单 13 项
    7. echo "==== i/12 <view> READY FOR COMMIT ===="  # 不跑 git,留给主会话
8. 最后报告:12 view 的 diff 统计 + 自查清单 13 项 + 难题/决策
```

---

## 8. 禁止事项(强约束)

- **不要碰** 任何 `<script>` / `<script setup>` / `*.ts`(纯样式翻新)
- **不要碰** `src/styles/tokens.css`(已就位,不要修改)
- **不要碰** `src/styles/variables.scss`(5 主题系统,不要修改)
- **不要碰** `src/styles/global.scss`(Element Plus 主题覆盖,不要修改)
- **不要碰** `package.json` / `package-lock.json` / `*.test.ts`(已就位)
- **不要碰** `src/router/*` / `src/stores/*`(行为层,不要修改)
- **不要删除** 任何文件
- **不要重命名** 任何 view / component
- **不要新增** 任何 .vue / .ts / .scss / .css 文件(本任务纯改既有文件)

---

## 9. 完成报告(subagent 返回内容)

> subagent 完成 12 view 后,需要在最终消息中**返回以下信息**:

1. **每个 view 的 diff 统计**(X +/Y -, 净行数变化;从控制器 git diff --stat 视角描述)
2. **每 view 改了什么**(摘要:间距 X 处 / 字号 X 处 / 圆角 X 处 / 阴影 X 处 / 颜色 X 处 / 动效 X 处 / 布局 X 处)
3. **自查清单 13 项的勾选结果**(全部 ✓)
4. **遇到的难题 + 决策**(如某处硬编码无对应 token,如何处理)
5. **遗留未改项**(如有,必须解释为何)

> 注:commit hash 和 vitest 全量测试由**主会话**在 subagent 报告后统一跑,不在 subagent 任务范围。

---

## 10. 控制器(主会话)验收

subagent 报告完成后,主会话会:
1. 拉取 12 commit,逐个 `git show --stat` 检查
2. 跑 `npx vitest run` 确认无 regression
3. 跑 `npm run typecheck` 确认 .ts 逻辑没被破坏
4. (可选)运行 `npm run build:win` 确认 build 通过
5. 报告 W2.2 整体结果

---

**任务开始**:subagent 启动后,直接进入循环 12 view。
**任务结束**:12 commit 落库 + vitest 71/71 + 自查清单 13/13 + 报告 6 项。
