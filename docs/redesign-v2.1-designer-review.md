# 设计评审报告:PiPiClaw 重设计 v2.1

> **评审者**: designer agent
> **基线**: `redesign-v2.1-spec.md` (37.2 KB) + `redesign-v2.1-self-review.md` (owner 7.5)
> **对照**: `redesign-v2-designer-review.md` (v2.0 评 5.5) + **v4.3.1 实际代码** (`src/` / `electron/`)
> **原则**: v2.0 评审过的问题不重复;**重点验证 5 P0 是否真改干净 + 找 v2.1 实施时才暴露的问题**;不客气。

---

## 综合评分:**6.8 / 10**

**一句话判断**:5 P0 的**方向**全对(默认折叠 / 1 主区 + 3 面板 / 5 状态 / 静态光标 / Inter+思源),owner 自评 7.5 给得高是因为 v2.0→v2.1 真的进步巨大——但**v2.0 评审的根问题没根治**,v2.1 在"修方案文档"上很彻底,在"接得住工程实施"上仍差关键一公里:第一,**v2.0 描述的是虚构产品**(实际 v4.3.1 已经有 3 套主题、SF Pro 字体栈、折叠的 ThinkingBlock,不存在 v2.0 说的 5 套主题/Inter fallback/80ms 翻牌),v2.1 继承的是"对空气挥拳";第二,**LlmAgentBrain 重构在 v2.1 8.3 节是"承诺级"代码,缺 30% 关键决策**——LlmClient 实际是非流式 JSON,LlmEvent 流式 emit 改的不是加代码而是改主进程 I/O 形态,补-1 P0 没补干净;第三,**Week 0 5 commit ship 视觉基础是最大的回归炸弹**——砍 3 套主题在已有 3-mode 系统上加 mapping,Windows 用户已用 YaHei 切到 Inter 看不到差别,但 macOS 用户 PingFang → Inter 立即有感;灰度不灰度,直接一刀切。**综合 6.8(及格线之上,ship 还差最后一段):P0 修干净 7.5、P1 全收 7.0、补补漏 6.0、对齐实际代码 5.5,加权和 owner 自评 7.5 砍 0.7。**

**对比**:
- v2.0 designer 5.5 → v2.1 6.8:**+1.3**(P0 全修值得 +1.5,但工程实施和实际代码对齐问题扣 0.2)
- v2.0 owner 7.0 → v2.1 owner 7.5:同向(+0.5)
- **综合 6.8**(我独立给分,不受 owner 自评 7.5 影响——v2.1 实施风险比方案文档大,这是 owner 视角看不到的)

---

## 维度 1:5 P0 验证(核心)

### P0-1 右栏默认折叠:🟡 留尾巴(方向对,实施有坑)

**方案 2.2 节 / 3.2 节** 明确"默认折叠 + Cmd+L + 顶栏 AI 状态徽章 = 入口",**方向 100% 正确**,对照 Cursor / VS Code Copilot / Continue.dev / Raycast AI 全部默认关,**PiPiClaw v2.1 跟对了行业**。

**验证证据** ✅ 方案层面:
- 2.2 节"默认折叠"明确写入
- 3.3 节"顶栏 AI 状态徽章 = 状态显示 + 入口"分工清晰
- 关闭方式 4 路径(Cmd+L / 顶栏点击 / ESC / 状态记忆)合理

**但** 🟡 实施层面有 3 个 v2.0 没考虑、v2.1 实施时才暴露的尾巴:

#### 🟡 1.1 "首次启动"展开诱惑——onboarding 引导可能破坏默认折叠

**方案没规定**首次启动的引导。Linear / Notion 第一次开都会**自动展开**右栏(因为是空 UI,需要示范给用户看)。如果 PiPiClaw v2.1 走这条:

> 首次启动 → FirstLaunchGuide 触发 → "AI 协作可视化"是核心差异化 → 引导把右栏打开给用户演示 → 引导结束不强制关闭 → **用户记忆里"右栏是默认开的"**

**这会直接破坏 P0-1 的产品哲学**。Raycast / Notion AI / Cursor 都吃过这个亏——引导期打开的浮窗,90% 用户不会再关。

**改稿建议**: 首次启动引导**不要开右栏**,只让顶栏徽章"+1"提示用户"这里有点东西",让用户主动按 Cmd+L。这是 Cursor 路线(默认关 + 引导不破例)。

#### 🟡 1.2 顶栏徽章 "+1" 闪烁 3 次的"200ms"——WCAG 闪烁阈值

**方案 3.3 节**: "+1 待审阅 → 红点闪烁吸引注意 (200ms 闪 3 次)"。

**WCAG 2.3.1 三次闪烁阈值**: **任何 1 秒内闪 3 次以上**的视觉信号 = 失败(可能诱发光敏性癫痫)。200ms × 3 = 600ms,严格说不违规(1 秒内闪 5 次才算),但**接近边界**。

**更好的做法**(对标 Linear 任务提醒):
- 不用红点闪烁,用**持续呼吸光晕**(2s 周期 opacity 0.4 ↔ 1.0 循环)
- 或**待审阅图标变实心**(空心 → 实心 + 数字徽章),不闪烁
- **闪烁 = 视觉暴力**,呼吸 = 视觉礼仪

**改稿建议**: 200ms × 3 闪烁 → 2s 呼吸光晕,WCAG 2.3.1 通过 + 不刺眼。

#### 🟡 1.3 顶栏徽章在 Cmd+K 入口"左边"——小屏时挤压

**方案 3.3 节**: "位置: 顶栏右区,Cmd+K 入口左边"。

**实际 v4.3.1 TitleBar.vue** 已经占用了:主题切换 + 最小化 + 最大化 + 关闭 4 个 window controls + 主题按钮 = **右区已很挤**。再插"AI 状态徽章" + "Cmd+K 入口" + "用户头像"(原 v2.0 1.5 节提的)——**3 个新元素塞进 32px 高度的顶栏右区**。

**对比 Linear**: Linear 顶栏右区只有 1 个 + 按钮 + 1 个头像,**克制**。Cursor 顶栏右区是"AI 状态 + 头像" 2 个元素。PiPiClaw 顶栏右区要塞 3-4 个,**密度是 Linear 的 2 倍**。

**改稿建议**: 顶栏右区布局重新设计——`[主题切换] [AI 状态徽章] [Cmd+K] [用户头像] [⋯ 系统菜单]`,**总宽 ≤ 280px**,超过就折叠成 icon-only。Linear / Raycast / Figma 都是这套("过度拥挤就折叠菜单")。

---

### P0-2 5 Tab → 1 主区 + 3 辅助面板 + 砍 Files:✅ 修干净

**方案 2.3 节** 明确:
- 主区常驻 Chat(任务主线,不切换)
- 3 辅助面板(Code/Memory/Tools)从右滑入,**不占 Tab 槽位**(300ms)
- 砍 Files Tab,改用 Chat 附件

**方向 100% 正确**,对照 VS Code / Notion / Linear 全部走"主区常驻 + 侧栏浮层"路线。

**验证证据** ✅:
- 2.3 节"主区 5 状态对应交互"表清晰:空闲 → Chat 输入框 / 思考 → Chat 流底部 ThinkingIndicator / 执行 → Chat 流底部 ToolCallCard / 待审阅 → 右栏自动开 / 完成 → Chat 流继续
- **辅助面板"从右滑入"不挤压主区**——这是 2.3 节"不占 Tab 槽位"的明确承诺

**对标**:
- VS Code:主区编辑器常驻,右栏 / 底栏面板独立 toggle ✅
- Notion:中栏页面常驻,右栏评论/分享默认关 ✅
- Linear:中栏任务列表常驻,右栏详情临时 ✅

**但** 🟡 1 个细节 owner 没想到:

#### 🟡 2.1 3 辅助面板不能同时开两个

**方案 2.3 节**: "Code 面板 (从右滑入)" / "Memory 面板 (从右滑入)" / "Tools 面板 (从右滑入)"——没说 3 个同时打开怎么办。

**实际场景**: AI 任务跑的时候,用户想同时看 Memory 面板(记忆引用)+ Tools 面板(工具调用历史)。如果**开 Memory 关 Tools / 开 Tools 关 Memory** = 用户要做选择题,**烦**。

**对标**:
- VS Code:左 / 右 / 底 3 个独立 panel,互不冲突
- Figma:左(Layers) + 右(Properties) + 底(Prototype) 3 个独立 panel
- PiPiClaw v2.1:右栏 1 个 + 3 个辅助面板 right-slide,**这是 1 个右栏,不是 3 个独立 panel**

**改稿建议**: 3 辅助面板**可堆叠**(同时开),宽度自动分配。比如:右栏 320px + Memory 280px + Tools 280px = 880px,超过 1280 就警告用户"主区只剩 400px"。

---

### P0-3 4 状态 → 5 状态 + "待审阅":🟡 修干净但"破坏性操作"歧义大

**方案 3.1 节** 明确 5 状态(空闲 / 思考 / 执行 / **待审阅** / 完成),借鉴 Cursor Apply / Vercel v0 Regenerate / GitHub Copilot Workspace——**方向 100% 正确**。

**验证证据** ✅:
- 3.1 节"待审阅 ⭐"独立成状态
- Apply / Reject 按钮明确(对标 Cursor / Vercel v0)
- "4 状态 → 5 状态迁移"表清晰(无破坏性操作 → 完成;有破坏性操作 → 待审阅)

**对标**:
- Cursor: 改文件后出 diff,用户点 Apply 才落地 ✅
- Vercel v0: 生成完出 "Regenerate / Use this" ✅
- GitHub Copilot Workspace: Workspace 改完出"Accept / Discard" ✅

**但** 🟡 owner 自己抓了"破坏性操作定义没说",我要**再深一层**——

#### 🔴 3.1 "破坏性操作"歧义会让"待审阅"失效

**方案 3.1 节**: "AI 完成破坏性操作(改文件/删文件)"。**"破坏性"是白名单还是黑名单?**

**场景分析**:
- `write_file` 改 1 个文件:是破坏性吗?改 README.md 没事,改 `~/.bashrc` 就有事
- `delete_file`:显然是破坏性
- `send_im`:发 Slack 消息——破坏性?取决于收件人
- `git_commit`:本地 commit 不破坏,但 `git push -f` 极破坏
- `run_command`: `rm -rf /` 极破坏,`ls` 不破坏
- `create_file` 新建文件:破坏性?overwrite 已存在的就是,新建空文件不是

**问题**: **"破坏性"不是工具类型决定的,是参数决定的**。`write_file(path="~/.bashrc", content=...)` 比 `delete_file(path="./.git/HEAD")` 更破坏。

**owner 自评 7.5 的硬伤 #7** 抓到了"破坏性操作定义没说",我说**更深一层**——

**3 类规则的"待审阅"触发方案**(按推荐度排序):
1. **工具白名单 + 路径白名单**(最严格,推荐)`: 显式声明"以下工具 + 路径组合 = 待审阅",如 `write_file` + `~/.{bashrc,zshrc,gitconfig}` = 必审;`delete_file` 任何路径 = 必审
2. **工具黑名单**(宽松):`delete_file` / `git push` / `run_command(rm|mv|chmod)` = 必审;其他 = 不审
3. **每次都审**(最严):所有文件改动都进"待审阅"——**这等于把"待审阅"做成常态,失去意义**

**改稿建议**: 3.1 节加 **"破坏性操作 = 工具类型 + 路径模式双匹配"** 表,白名单优先(方案 1)。比如:
```ts
const REVIEW_REQUIRED = [
  { tool: 'write_file', path: /^~\/\.(bash|zsh|git).*/ },
  { tool: 'delete_file', path: /.*/ },
  { tool: 'run_command', cmd: /rm\s+-rf|mv\s+.*\s+\/|chmod\s+777/ },
  { tool: 'send_im', to: /!.*!.*!/ }, // 群发
]
```
否则"待审阅"会因为定义模糊,在用户看来"有时候审有时候不审" = **比"完全不审"更糟**(用户失去对系统的预测性)。

---

### P0-4 ThinkingIndicator 砍文字翻牌:✅ 修干净

**方案 4.1 节** 明确"静态文字 'Thinking...' + 1.5s 慢速光标扫过,再淡出(0.3s),再淡入(0.3s),循环"。

**方向 100% 正确**,对照 Cursor / ChatGPT / Claude.ai / Vercel v0 全部静态文字 + 低频动画。

**验证证据** ✅:
- 静态文字"Thinking..."(固定不动)
- 1.5s 慢速光标(不是 80-300ms 翻牌)
- 可选 reasoning 摘要(从 LLM reasoning tokens 拿)
- prefers-reduced-motion 下保留静态文字 + 静态光标点(不闪烁)

**对标**:
- Cursor: 静态文字 "Thinking..." + 不动画的灰点 ✅
- ChatGPT: 静态文字 "Reasoning..." + 圆点 ✅
- Claude.ai: 静态文字 + 渐变 pulse ✅
- Vercel v0: 静态文字 "Generating..." ✅

**但** 🟡 1 个 owner 没想到的尾巴:

#### 🟡 4.1 v4.3.1 ThinkingBlock 已经是"折叠的",v2.1 重做是"反向工程"

**实际 v4.3.1 思考组件** 是 `src/components/chat/ThinkingBlock.vue`——已经实现:
- 默认折叠(`expanded` 默认 false,见 line 73)
- 静态文字"已思考" / "正在思考…"(没有翻牌)
- 1-click 展开,展开后显示 reasoning 全文
- 2s pulse 动画(line 134)——属于"低频呼吸",不是"翻牌"

**对比 v2.0 spec 3.3.1 节** 说的"80-300ms 随机切换文字"——**v4.3.1 实际代码根本没有这个动画**。v2.0 评审拿"想象中的 80ms 翻牌"开炮,v2.1 在修"根本不存在的 bug"。

**这意味着**:
- **P0-4 在 v2.0 是伪 P0**(实际产品已经接近对的状态)
- v2.1 4.1 节"重做"——但新组件 vs 旧组件的 diff 只有 2 处:**1.5s 慢速光标 vs 2s pulse**、**光标淡出淡入 vs 持续呼吸**

**改稿建议**: 4.1 节不要"重做"ThinkingIndicator,改"**优化**"——保留现有折叠逻辑,只把 2s pulse 改成 1.5s 慢速光标。这是**1 个 commit 的活**,不是 1 个大节的工作量。

---

### P0-5 Inter + HarmonyOS Sans SC 双语字体:🟡 修干净但前提是错的

**方案 5.2 节** 明确:
- UI/正文: Inter + HarmonyOS Sans SC
- Code/数据: Geist Mono + JetBrains Mono (带中文) / 思源等宽
- 接受宽度差异 + `font-feature-settings 'palt' 1` 调字距

**方向 100% 正确**,这是 v2.0 评审"中文 fallback 坑"的标准修法。

**验证证据** ✅:
- 字体加载:`@font-face` + `font-display: swap`
- `unicode-range: U+4E00-9FFF` 限定中文字符
- 字体栈:`Inter, HarmonyOS Sans SC, -apple-system, BlinkMacSystemFont, sans-serif`
- 接受宽度差异 + `palt` 比例字距

**但** 🔴 **前提是错的**:

#### 🔴 5.1 v4.3.1 实际不用 Inter,Inter 在 v2.0 评审里是假想敌

**实际 v4.3.1 tokens.css 123 行**:
```css
--font-family-system: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
  'SF Pro Text', 'Helvetica Neue', Helvetica, Arial,
  'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei',
  sans-serif;
```

**实际 v4.3.1 reset.scss 27 行**:
```css
body {
  font-family: 'Microsoft YaHei', 'PingFang SC', 'Hiragino Sans GB', 'Segoe UI', sans-serif;
}
```

**v4.3.1 实际是 Apple HIG 字体栈 + 中文中文字体优先,Inter 根本不在主栈里**。v2.0 spec 2.1 节"Inter + Geist Mono 双字体"是**虚构的产品状态**。

**v2.1 5.2 节改成 Inter + HarmonyOS Sans SC**——是**把"已对的状态改错**:
- macOS 用户: `PingFang SC` → `HarmonyOS Sans SC`(更窄,中文显示密度不同)
- Windows 用户: `Microsoft YaHei` → `HarmonyOS Sans SC` 走下载路径,fallback 慢 + 视觉差异
- Linux 用户: 原本 fallback 到 `Segoe UI` / 系统无衬线,现在走 HarmonyOS Sans SC 网络下载

**真正该做的**:
- **保留 Apple HIG + PingFang SC + Microsoft YaHei 栈**(已经对)
- 把 Inter 删了,因为 Inter 不在主栈里
- 如果要加 HarmonyOS Sans SC,**只作为 Linux / 缺失中文字体环境的 fallback**,不是首选

**改稿建议**:
```css
--font-family-system: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
  'PingFang SC', 'Microsoft YaHei', 'HarmonyOS Sans SC',  /* Linux fallback */
  sans-serif;
```
**去掉 Inter**(没用),**保留中文系统字体优先**(macOS/Win 用户零感知),**HarmonyOS Sans SC 只在 Linux 兜底**。这才符合"中文字体优化"的真实目的。

**改稿成本**:
- v2.1 5.2 节加 1 段说明"HarmonyOS Sans SC 仅 Linux fallback"
- 删 v2.1 14.1 节 `public/fonts/Inter-Variable.woff2`(不需要 Inter)
- 保留 `public/fonts/HarmonyOS-Sans-SC.woff2` 用于 Linux

#### 🟡 5.2 字体加载失败没 fallback 路径

**方案 5.2 节**: `font-display: swap`,但没说 CDN 失效 / 网络差时怎么办。

**对标 Linear / Figma**: 都是**自托管**字体文件,不依赖 CDN。PiPiClaw v2.1 把字体放 `public/fonts/` 是自托管(好),但**没说 .woff2 文件 size、压缩、子集化**。

**潜在问题**:
- Inter Variable .woff2 全字体集 ~280KB,中文 HarmonyOS Sans SC ~3-5MB
- 第一次访问 5MB 字体在弱网 = 3-5s 文字不可见(`font-display: swap` 会先用 fallback,后切到目标字体)
- 中文子集化(只打包常用 3500 字)可以把 HarmonyOS 压到 ~800KB,但 v2.1 没提

**改稿建议**:
- 字体子集化: 中文只保留 GB2312 / 现代常用 3500 字
- preload 关键字体:`<link rel="preload" href="/fonts/HarmonyOS-Sans-SC.woff2" as="font" crossorigin>`
- 加 `font-display: optional`(失败就用 fallback,不强求 swap)

---

## 维度 2:6 P1 验证

### P1-1 4 工作区树形:🟡 修对方向但顶栏硬塞 4 工作区过载

**方案 2.4 节** 明确:
- 顶栏固定 4 工作区入口(Workspace / Skills / Models / Settings)——永远显示,不随内容变
- 左栏顶部固定头部(Logo / 搜索 / 视图切换)
- 左栏中下部随工作区变

**对标 Linear / Notion 路线**——这个方向 100% 正确,v2.0 评审抓的"切工作区丢上下文"得到根治。

**但** 🟡 实施层有 3 个尾巴:

#### 🟡 1.1 顶栏硬塞 4 工作区 + AI 状态徽章 + Cmd+K + 用户头像 = 顶栏过载

**实际 v4.3.1 TitleBar.vue** 已经占用了:主题切换 + 最小化 + 最大化 + 关闭 4 个 window controls。**32px 高度**的顶栏要塞:

- 4 工作区切换器(Workspace / Skills / Models / Settings)→ 4 × 80px = 320px
- AI 状态徽章 → 100px
- Cmd+K 入口 → 80px
- 用户头像 + 主题切换 + 4 个 window controls = 200px
- **总计 700px+** —— **1280 屏去掉这些只剩 580px 给左栏 + 主区 + 右栏**

**1280 屏根本没空间**。对标 Linear: 顶栏**只有 3 元素**(Logo / 视图切换 / 用户头像),不塞 AI 状态。

**改稿建议**:
- 4 工作区放**左栏头部固定区**,不放顶栏(Linear 路线)
- 顶栏只放: AI 状态徽章 + Cmd+K + 用户头像 + window controls
- 左栏头部固定区: Logo + 4 工作区切换 + 搜索框 + 视图切换

#### 🟡 1.2 4 工作区当前激活高亮——但 v2.1 没规定"激活态视觉"

**方案 2.4 节** "当前激活高亮"——但没说用什么视觉(底色?下划线?小圆点?侧边 accent bar?)。

**对标**:
- Linear 顶栏激活态:**底色 + 加粗文字**(2 个信号叠加,识别快)
- Notion 左栏激活态:**底色 + 左侧 accent bar**(2 个信号)
- VS Code 侧栏激活态:**左侧 accent bar + 加粗**(2 个信号)

**改稿建议**: 4 工作区激活态用"**底色 bg-hover + 加粗 font-weight 600**",2 个信号叠加,跟 Linear / Notion 一致。

#### 🟡 1.3 切工作区"不丢上下文"——但"上下文"具体是什么没说

**方案 2.4 节** "4 工作区不是平铺切换,是上下文切换,但左栏头部固定保证导航不丢"——但**没说什么是"上下文"**:
- 任务流列表的滚动位置?筛选条件?选中态?
- Chat 主区的对话滚动位置?输入框内容?
- 右栏是否展开?展开状态记忆?

**v2.0 评审抓的"切工作区丢上下文"问题在 v2.1 还是没 100% 解决**——只解决了"导航不丢"(Logo / 搜索 / 视图在),**没解决"内容状态保留"**(任务 A 的 Chat 滚动位置、任务 B 的 Memory 面板展开状态)。

**改稿建议**: 2.4 节加"切工作区保留:任务流滚动位置 / Chat 滚动位置 / 右栏展开状态 / 输入框内容",4 项明确。

---

### P1-2 主动建议改内嵌:✅ 修干净

**方案 3.4 节** "不做主动弹窗,改用: 顶栏徽章 +1 / Chat 流系统消息 / Cmd+Shift+A 临时面板"——**100% 对**。

**对照** v2.0 评审的"AI 主动建议 = Clippy 死法"——v2.1 完全接收,改成 Slack-style 通知(红点 + 临时面板)。

**对标**:
- Linear:任务提醒走顶部 + 通知中心,不弹窗 ✅
- Notion:评论提醒走右上角红点 + 通知抽屉 ✅
- Slack:未读走侧栏红点 + 通知中心 ✅
- Cursor:inline ghost text 补全,不弹窗 ✅

**PiPiClaw v2.1**:顶栏徽章 +1 + Chat 系统消息 + Cmd+Shift+A 临时面板,3 通道组合,跟 Linear 路线完全一致。**保留**。

**但** 🟡 1 个尾巴:

#### 🟡 2.1 系统消息的"灰度" 跟 Chat 消息流没区分

**方案 3.4 节**: "Chat 流系统消息(灰色,标 `[AI 建议]`,用户自然看到)"。

**但"灰色"不够区分**——Chat 流主消息里有用户消息(深色)、AI 回复(浅色)、**AI 系统消息**(灰色)——3 种灰度区分,在小屏 1280 主区只有 ~500px 宽的情况下,**用户容易把"系统消息"当"AI 回复"看**。

**改稿建议**: 系统消息用**左侧 icon 标识**(📌 / 🔔)+ 背景底色 + 文字,3 信号叠加。Linear 的"系统事件"消息就是这样(icon + 底色 + 文字)。

---

### P1-3 3 断点响应式:🟡 修对方向但主区宽度计算错

**方案 7.2 节** 明确 3 断点(≥1366 / 1280-1366 / 1024-1280 / <1024)——**方向对**,比 v2.0"1024 拥挤"一句话带过具体多了。

**但** 🔴 **宽度计算有 2 个错误**:

#### 🔴 3.1 主区宽度计算假设左栏固定 240,实际可拖到 200-320

**方案 7.2 节**:
> 1366 - 48 - 24 - 240 - 320 = 734 (可接受)
> 1024 - 48 - 24 - 240 - 0 = 712 (可)

**方案 7.3 节**: "左栏 200-320px 可拖,默认 240" + "右栏 240-480px 可拖,默认 320"。

**owner 自评硬伤 #6** 抓了"主区宽度计算假设左栏固定 240,实际可拖"——**这是真硬伤**。

**真实最坏情况**:
- 1280 屏 + 左栏拖到 320 + 右栏拖到 480 + 顶栏 48 + 底栏 24 = **1280 - 48 - 24 - 320 - 480 = 408px 主区**
- 408px 主区扣 16px padding × 2 = **376px 实际内容区**
- **376px 主区**——连一条 Chat 消息都放不下完整 Markdown 块

**改稿建议**:
- 7.2 节加**宽度联动约束**:左栏 + 右栏总宽 ≤ 主区最小宽度
- 主区最小宽度 = 360px(可以放 Chat 消息)
- 公式:`left + right ≤ viewport - topbar - statusbar - 360`
- 1280 屏: `left + right ≤ 1280 - 48 - 24 - 360 = 848`,默认 left=240, right=320 = 560 ≤ 848 ✅
- 1280 屏极端: left=320, right=480 = 800 ≤ 848 ✅ 还能
- **但 1024 屏**:`left + right ≤ 1024 - 48 - 24 - 360 = 592`,默认 left=240, right=320 = 560 ≤ 592 ✅
- **1024 屏极端**: left=320, right=480 = 800 > 592 ❌——左栏拖到 320 时右栏最大只能 272

**改稿建议补充**: 7.3 节加"宽度拖动时联动约束",拖一个栏时另一个栏按公式反向收缩。

#### 🟡 3.2 < 1024px 不支持没解释

**方案 7.2 节** "**< 1024px** | 48px | 关闭 | 自适应 | 关闭 | 小屏"。
**"关闭" 左栏 + "关闭" 右栏**——**主区就是 1024-48-24 = 952px,够用**。
但**PiPiClaw 是任务流驱动,左栏是核心导航**——藏左栏 = 用户看不到任务列表 = **失去主导航**。

**v2.0 评审已经抓过这个**:**左栏是必需品,不是可选项**。v2.1 7.2 节"关闭"左栏的方案没解决"藏左栏 = 失去主导航"。

**改稿建议**:
- **1024-1280px**:左栏**汉堡菜单**(可关可开,默认开)——不是直接关
- **< 1024px**:跟 v2.1 7.2 节一样,"请在桌面使用"提示(不做移动端)
- 1024-1280 时左栏"默认开但可关",关的时候顶栏出现 ☰ 汉堡按钮(Linear / Notion 移动端路线)

#### 🟡 3.3 < 768px 不支持——但 v2.1 7.2 节显示"请在桌面使用"是个完整页?

**方案 7.2 节** "< 768px | 不支持,显示'请在桌面使用'"——但没说这个"不支持"页是:
- 简单的 modal 遮罩?
- 单独的友好页面(带下载链接 / 截图示意)?
- 真的硬阻断(用户没法用)?

**Linear 路线**:`< 768px` 显示一个**美化的空状态页**(带产品截图 + 下载桌面端的 CTA),不是硬 modal。

**改稿建议**: 7.2 节加"` < 768px` 显示空状态页(产品截图 + '请在桌面使用' + macOS/Win/Linux 下载按钮),不硬阻断"。

---

### P1-4 ToolCallCard 5 状态 + 默认折叠:✅ 修干净

**方案 4.2 节** 明确 5 状态(pending / running / success / **warning** / error)+ 默认折叠(只显示工具名 + 状态点 + 头部 Apply/Reject)+ 取消/重试在头部右上角小图标。

**方向 100% 正确**,对照 Cursor Apply 流程 / Vercel v0 Regenerate 流程。

**验证证据** ✅:
- 5 状态颜色明确(灰 / 蓝 pulse / 绿 / 黄 / 红)
- 默认折叠(只显示工具名 + 状态点)
- 点击展开(右栏 100% 宽)
- 取消/重试在头部(不占底部)

**对标**:
- Cursor: Apply 头部 inline 按钮 ✅
- Vercel v0: 5 状态颜色(灰 / 蓝 / 绿 / 黄 / 红)✅
- GitHub Copilot Workspace: 头部 Accept / Discard inline ✅

**保留**。

**但** 🟡 1 个小尾巴:

#### 🟡 4.1 warning 状态的"部分成功"定义没说

**方案 4.2 节** "warning: 黄 (部分成功)"——但"部分成功"具体定义没说。

**场景**:
- `write_batch_files(files=[a, b, c])` → 3 个文件写,2 成功 1 失败 = warning
- `run_command(cmd="...")` → 退出码 0 但 stderr 有 warning = warning
- `delete_file(path=.../.../nonexistent)` → 0 字节文件不存在 = error 还是 warning?

**改稿建议**: 4.2 节加"warning 触发条件":
- 批量操作:全部成功 = success,部分成功 = warning,全部失败 = error
- 单个操作:成功 = success,失败 = error,**不区分 warning**
- `run_command`:退出码 0 + stderr warning = warning(只读 stderr 不算)

---

### P1-5 MemoryChip 系统评分:🟡 修对方向但算法可实现性没保障

**方案 4.3 节** 明确"系统自动评分(40% 出现频率 + 30% 时间衰减 + 30% 任务相关性)+ 用户可覆盖(右键菜单) + 3 档颜色 + hover tooltip 显示评分明细"——**方向 100% 正确**,v2.0 评审抓的"3 档重要性没说谁决定"得到根治。

**但** 🔴 **算法可实现性没保障**:

#### 🔴 5.1 任务相关性 30% 用"embedding 余弦相似度"——embedding 从哪来?

**方案 4.3 节**: "任务相关性 (30%): 与当前任务相关度 (用 embedding 余弦相似度)"。

**实际 v4.3.1 已有 HermesMemory**(`electron/hermes/`),从代码看是**关键词匹配的记忆系统**,没有 embedding 基础设施。引入 embedding 余弦相似度 = 引入一个**完整的新子系统**:
- Embedding 模型(Qwen3-embedding?bge-small?OpenAI text-embedding-3?)
- 向量存储(本地 indexedDB?SQLite?chroma?)
- 每次 MemoryChip 评分 = 1 次 embedding + 1 次向量检索(用户每次 hover chip 都要算 = 性能灾难)
- **embedding 模型本身要 100-500MB 内存 + 首次加载 5-10s**

**owner 没意识到**这不只是"30% 权重",是**整个 memory 系统的架构升级**。

**改稿建议**:
- **方案 A (推荐)**:用关键词匹配(已存在)代替 embedding,30% 任务相关性 = "记忆关键词 ∩ 当前任务关键词 / 总关键词数"
- **方案 B (备选)**:embedding 走云端 API(OpenAI / Qwen),不本地下载模型,成本 = $0.0001/1k token,但**用户隐私问题**(记忆数据出本地)
- **方案 C (放弃)**:V2.1 先不做任务相关性,只 70%(40% 频率 + 30% 时间),3 档评分用相对值

#### 🟡 5.2 用户覆盖 UI 是"右键菜单"——但 MemoryChip 怎么右键?

**方案 4.3 节**: "用户可覆盖: 右键菜单'提升/降低'覆盖系统评分"。

**MemoryChip 是 Chat 流里的 inline chip**(类似 Notion 的 @mention 标签),**右键菜单在 Chat 流上下文里语义混乱**——用户右键 chip 是想:
- 提升重要性(系统评分)
- 看评分明细(已有 hover tooltip)
- 复制 chip 内容
- 删除该记忆
- 跳转到记忆库(Memory 面板)
- **5 个动作挤在右键菜单不直观**

**改稿建议**: MemoryChip 不用右键菜单,用**左键点击展开 popover**(类似 Notion 的 @mention hover 弹层):
- 顶部: 评分明细(频率/时间/相关性)
- 中部: 提升/降低按钮(覆盖系统评分)
- 底部: 跳转到记忆库 / 删除

**保留右键菜单作为高级功能**,默认走 popover。

---

### P1-6 灰度发布:🟡 修对方向但 channel 切换 UI 没规定

**方案 12 节** 明确 6 周灰度发布(Week 0 视觉 / Week 1-2 内部 / Week 3-4 alpha/beta / Week 5 RC / Week 6 ship)——**方向 100% 正确**,v2.0 评审抓的"26 commit 直接 ship 风险"得到根治。

**但** 🔴 **owner 自评硬伤 #9** 抓的"alpha/beta/RC 没说具体分发"**是真硬伤**——

#### 🔴 6.1 用户怎么从 latest 切到 beta / alpha?

**方案 12.4 节** 配置写了:
```typescript
publish: { channel: 'latest' | 'beta' | 'alpha' }
```
**但用户**怎么切换 channel?**没有 channel 切换 UI 规定**:
- Settings 页面加 channel 选择?(好)
- URL 参数 `?channel=beta`?(hack)
- 单独的 dev tools 入口?(隐蔽)
- **什么都不做,channel 由 owner 控制,用户只能等推送?**

**对标**:
- Vercel:Settings → Preferences → Beta Features toggle
- Linear:Settings → Account → "Receive beta updates" checkbox
- Figma:Settings → "Use beta desktop app" toggle

**改稿建议**:
- 12.4 节加"channel 切换 UI = Settings → General → '更新通道'(stable / beta / alpha)下拉框"
- UI 上要明确告知"alpha 通道可能不稳定,仅推荐开发/测试"
- 默认 stable,改完 channel 后立即触发 auto-update 检查

#### 🟡 6.2 Week 0 ship 视觉基础 = 强制升级?

**方案 12.3 节** "Week 0 (前置, 5 commit) - 用户立即可见"——**但 v4.3.1 → v4.4.0 是不是强制升级**?

**实际场景**:
- v4.3.1 已经在用户机器上
- Week 0 ship 视觉基础 = 5 commit
- **这 5 commit 是 v4.3.x 还是 v4.4.0?**
- 如果 v4.3.x → 老用户的 v4.3.1 不升级
- 如果 v4.4.0 → 老用户必须升级才能看到新视觉

**v2.1 没说 Week 0 ship 怎么分发的**。

**改稿建议**:
- 12.3 节加"Week 0 ship 是 v4.3.5 patch(纯视觉,不涉及 IPC 改造),不是 v4.4.0 major"
- v4.3.5 ship 后用户能立即看到新视觉(主题/字体/token/accent/focus)
- v4.4.0 是 Week 6 ship(信息架构 + AI 组件)
- **2 段式发布降低风险**——v4.3.5 试水,v4.4.0 才有信心

#### 🟡 6.3 alpha 用户怎么"反馈"?

**方案 12.2 节** "Week 3 alpha ... 用户可见 🟡 alpha 分支"。

**但 alpha 用户怎么反馈 bug**?
- v2.1 没规定 alpha 用户的反馈路径
- 没有"alpha 用户 = 1% 抽样"的策略
- 没有"alpha 用户的反馈收集 UI"(v4.3.1 已经有 FeedbackModal,但没说 alpha 是否强制)

**改稿建议**:
- 12.2 节加"alpha 用户 = 内部 5-10 人 + 主动报名的外部用户,Settings 显示'你正在使用 alpha 通道',一键反馈按钮"
- 12.4 节加"alpha 用户的反馈 UI = 顶栏 +1 红点 + '反馈此版本'入口(带版本号自动 prefill)"

---

## 维度 3:4 owner 补 验证

### 补-1 后端 IPC 改造:🔴 没补干净(LlmClient 实际是非流式)

**方案 8.2 节** 给了 LlmEvent 8 种 type 协议,**方向对**。

**owner 自评硬伤 #1** 抓了"LlmAgentBrain 重构具体步骤还不够具体"——**是真硬伤**,我要**再深一层**:

#### 🔴 1.1 v2.1 8.2 节 LlmEvent 是"事件流"语义,但 v4.3.1 LlmClient 是"完整响应"语义

**实际 v4.3.1 `electron/llm/LlmClient.ts`**:
```ts
async chat(req: LlmRequest): Promise<LlmResponse> {
  // ...
  const response = provider === 'openai' ? await this.openai.chat(config, req) : ...
  return response
}
```

**实际 v4.3.1 `electron/llm/adapters/openai.ts` line 47**:
```ts
const data: any = await res.json()  // 一次性拿完整 JSON
const choice = data.choices?.[0]
const msg = choice?.message
// ...
let content = msg?.content ?? ''
```

**LlmClient.chat() 是一次性返回完整 LlmResponse,不是流式**。

**v2.1 8.2 节 LlmEvent 是流式事件协议**(thinking_start / tool_call_start / tool_call_arg / text_chunk),**但 LlmClient 实际不是流式**。

**这意味着 v2.1 8.3 节"LlmAgentBrain 改造 emit LlmEvent 事件" 需要**:
1. **LlmClient 改成流式**(解析 OpenAI SSE 格式,不再 `await res.json()`)
2. **LlmAgentBrain 包装 LlmClient 流式输出** → emit LlmEvent
3. **IpcBridge 转发事件** → 渲染进程订阅

**这 3 步不是 1 个 commit,是 1 个完整的子项目**——LlmClient 流式改造涉及 3 个 adapter(OpenAI / Anthropic / Zhipu),每个 adapter 都要从 `await res.json()` 改成 `for await (const chunk of res.body)`。

**v2.1 8.3 节** 只说"LlmAgentBrain.ts 加 eventBus.emit('llm:event', event)"——**漏掉了 LlmClient 流式改造**。**这是 P0 级遗漏,不是 P1**。

**改稿建议**:
- 8.3 节重写,加 LlmClient 流式改造:
  ```ts
  // 新增 electron/llm/LlmStreamAdapter.ts
  async function* streamLlm(req: LlmRequest): AsyncGenerator<LlmEvent> {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { ... },
      body: JSON.stringify({ ...req, stream: true }),  // stream: true
    })
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()  // 保留不完整行
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6))
          if (data.choices[0].delta.content) {
            yield { type: 'text_chunk', content: data.choices[0].delta.content }
          }
          if (data.choices[0].delta.tool_calls) {
            // ...
          }
        }
      }
    }
    yield { type: 'done', usage: ... }
  }
  ```
- 3 个 adapter(OpenAI / Anthropic / Zhipu)都要重写
- **3 个 commit 而不是 1 个**

#### 🔴 1.2 LlmEvent 协议 8 种 type 不够

**owner 自评硬伤 #8** 抓了"缺 error / cancelled / retry / token_usage / tool_call_chunk"——**5 种遗漏都是真 P0**:
- `error` 事件:LLM API 错误(网络错误 / 4xx / 5xx),没有这个事件 = 用户看到"思考中..."卡死
- `cancelled` 事件:用户主动取消(现在已经有 `handleCancel` in TaskExecutionPanel.vue)
- `token_usage` 事件:实时显示 token 消耗(对 quota 用户重要)
- `tool_call_chunk` 事件:长工具参数流式(`write_file` 大 JSON 参数要分片)
- `reasoning_chunk` 事件:reasoning tokens 流式(ThinkingIndicator 显示摘要)

**改稿建议**: 8.2 节 LlmEvent 协议扩到 12-15 种 type(补 error / cancelled / token_usage / tool_call_chunk / reasoning_chunk / retry)。

#### 🟡 1.3 老 LLM 兼容路径没说

**方案 8.5 节** "老 LLM (非 thinking 模型) 全部 emit `text_chunk` + `done`,不破坏现有功能"——但**"老 LLM 兼容"是怎么判定的**?

- LLM 模型声明 thinking 能力?OpenAI o1 系列 / DeepSeek R1 / Qwen3 是哪些?
- 用户在 Settings 配置 LLM,产品代码怎么知道"这个 LLM 支持 thinking"?
- **LlmConfig 已有 provider / model / apiKey 字段,没有 "supportsThinking" 字段**

**改稿建议**:
- 8.5 节加"LlmConfig 增 `capabilities: { thinking: bool, toolCalls: bool }` 字段"
- LlmConfigStore 默认能力基于 provider/model 推断
- LlmStreamAdapter 根据 capabilities 决定 emit 哪些事件

---

### 补-2 老用户迁移:🟡 14 路由全映射但版本号算错

**方案 9.1 节** 给了完整路由映射表——**方向对**。

**但** 🟡 **2 个问题**:

#### 🟡 2.1 实际 v4.3.1 有 23 路由,不是 14

**实际 v4.3.1 `src/router/index.ts`** 有 23 个路由,6 个 devOnly:
- 生产: 17 路由
- devOnly: 6 路由

**v2.1 9.1 节** 路由表只列了 14 路由,跟 v2.0 一致——**v2.0 spec 本身就是错的**,v2.1 继承。

**真实路由**:
- 17 个生产路由:`/dashboard` `/chat` `/skills` `/settings` `/help` `/models` `/permissions` `/plugin-market` `/remote-control` `/schedule` `/skill-market` `/tasks` `/settings/im-accounts` `/im-management` `/clawhub` `/model-compare` `/settings/llm-config`
- 6 个 devOnly:`/d1-demo` `/d5-demo` `/d3-demo` `/a5-demo` `/d2-prime-demo` `/` 根路由 redirect

**改稿建议**: 9.1 节重写完整路由表(17 路由 + 6 devOnly)。

#### 🟡 2.2 `/chat/:id` 重定向逻辑有歧义

**方案 9.1 节**: "/chat/:convId | /workspace/default/chat/:convId | 自动建默认 task"。

**问题**: v2.1 路由改造是 `/workspace/:taskId/chat`,但老路由 `/chat/:convId` 是**会话**维度,不是**任务**维度。

**真实迁移**:
- 老用户书签 `/chat/abc-123`(会话 ID = abc-123)
- v4.4.0 路由 `/workspace/:taskId/chat/:convId` 需要 2 个参数
- "自动建默认 task" → 创建一个 taskId="default"的伪任务,所有老会话都挂到 default task 下
- **default task 不能被删除**(否则老会话链接全失效)

**改稿建议**:
- 9.1 节加"default task 概念":所有 `/chat/:convId` 都映射到 `default-task`,default task 是系统任务,不可删
- 9.4 节"数据库迁移"加"HermesMemory 加 taskId 字段,老记忆归 default-task"

#### 🟡 2.3 v4.3.1 主题只有 3 mode(light/dark/system),不是 5 套

**方案 9.2 节** 主题映射表:
```ts
{ light, dark, purple, blue, green, other }
```

**实际 v4.3.1 `stores/app.ts`** ThemeMode = `'light' | 'dark' | 'system'`,**只有 3 mode,没有 5 套彩色主题**。

**v2.0 评审的"砍 5 套主题"在 v2.1 9.2 节 还在**——**v2.1 还在修根本不存在的 5 套主题**。

**改稿建议**: 9.2 节重写:
```ts
{ light, dark, system }
// v4.4.0: 砍 system(强制 light/dark 二选一,自动跟随系统)
const THEME_MIGRATION: Record<string, string> = {
  light: 'light',
  dark: 'dark',
  system: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
}
```
**Week 0 不要砍 system 模式**——用户已经习惯"跟随系统",砍了会反弹。

---

### 补-3 平台差异:🟡 大部分对,但 Linux 覆盖率不足

**方案 10 节** 5 个子节(顶栏高度 / 快捷键 / 字体 / 高对比度 / 光标)——**方向对**。

**但** 🟡 **3 个问题**:

#### 🟡 3.1 macOS 顶栏高度 38px vs 实际 32px

**方案 10.1 节**: "macOS (retina) | 38px | 22px | 避 traffic light (28px) + spacing"

**实际 v4.3.1 `$title-bar-height: 32px;`** —— 当前 v4.3.1 macOS 顶栏就是 32px,不是 38px。

**改稿建议**:
- 10.1 节 macOS 顶栏改 32px(沿用 v4.3.1)
- traffic light 适配:`padding-left: 80px` 给 macOS(让出 28px + 52px spacing)
- Windows / Linux 顶栏也是 32px(不要 32/24 不一致,统一)

#### 🟡 3.2 Linux 高对比度模式没规定

**方案 10.4 节** 只规定 Windows 高对比度(`@media (prefers-contrast: more)`)——但 **prefers-contrast 是 CSS 标准,Linux 也支持**。

**改稿建议**:
- 10.4 节去掉"Windows"限定,改"跨平台高对比度模式"
- Linux GNOME / KDE 都支持 `prefers-contrast`,Win10/11 也支持
- 现有 `@media (prefers-contrast: more)` 已经跨平台,不需要特别标 Windows

#### 🟡 3.3 鼠标光标规定过细

**方案 10.5 节** 4 种 cursor(text / pointer / grab/grabbing / not-allowed)——**太细**。**实际 v4.3.1 已经在用 Element Plus,Element Plus 默认就有 cursor 样式,不需要再规定**。

**改稿建议**: 10.5 节压缩到 1 句话"沿用 Element Plus 默认 cursor,自定义组件统一用 text/pointer/grab",删详细 4 种规定。

---

### 补-4 vite manualChunks:🔴 配置可跑但有 2 个错误

**方案 11.1 节** 给了 manualChunks 完整配置——**方向对**。

**但** 🔴 **owner 自评硬伤 #3** 抓了"feature-ai 指了 4 个 .vue 文件"——**是真硬伤,我要再深一层**。

#### 🔴 4.1 manualChunks 不能直接指 .vue 文件路径

**实际 vite/rollup 规则**:`manualChunks` 按**模块 ID**(一般是 package name 或 import 路径)匹配,**不是 .vue 文件路径**。

**方案 11.1 节**:
```ts
manualChunks: {
  'feature-ai': [
    './src/components/ai/ThinkingIndicator.vue',  // ❌ 错
    './src/components/ai/ToolCallCard.vue',         // ❌ 错
    // ...
  ]
}
```

**正确写法**(Vite 5+)是**函数式 manualChunks**:
```ts
manualChunks(id) {
  if (id.includes('/components/ai/')) return 'feature-ai'
  if (id.includes('/components/command/')) return 'feature-cmdk'
  if (id.includes('/views/Workspace') || id.includes('/components/workspace/')) return 'feature-workspace'
  if (id.includes('monaco-editor')) return 'vendor-monaco'
  // ...
}
```

**对象式 manualChunks** 只能匹配 npm package 名(`vendor-vue: ['vue', 'vue-router', 'pinia']` 这种),**不能匹配源文件路径**。

**改稿建议**: 11.1 节 manualChunks 改用**函数式**,`feature-ai` 块用 `id.includes('/components/ai/')` 匹配。

#### 🔴 4.2 feature-ai 4 个组件怎么触发加载?需要 async import

**方案 11.1 节** `feature-ai` 块包含 4 个 AI 组件——但**这 4 个组件在 AppLayout 顶层 `import`** 的话,**整个 AppLayout 一加载就把 feature-ai 全加载了,失去"懒加载"意义**。

**正确做法**:
- 4 个 AI 组件改成**动态 import**:
  ```ts
  // src/components/ai/AICollabPanel.vue
  const ThinkingIndicator = defineAsyncComponent(() => import('./ThinkingIndicator.vue'))
  const ToolCallCard = defineAsyncComponent(() => import('./ToolCallCard.vue'))
  // ...
  ```
- 或者**整个 AICollabPanel 用 defineAsyncComponent** 加载,在用户按 Cmd+L 时才加载

**改稿建议**:
- 11.1 节加"feature-ai 懒加载触发方式:用户按 Cmd+L → 加载 AICollabPanel chunk → 内部 4 组件走 import 同步加载"
- 11.3 节路由懒加载 + AICollabPanel 懒加载 = 双层懒加载

#### 🟡 4.3 vendor-monaco 体积预算 300KB 不准

**方案 11.2 节** "vendor-monaco | < 300KB | 懒加载"。

**真实 Monaco Editor 包大小**(gzip 前):
- `monaco-editor` full: ~4MB gzip 后 ~1.2MB
- `monaco-editor/esm/vs/editor/editor.api`: ~3MB gzip 后 ~900KB

**300KB 预算严重低估**。

**改稿建议**:
- 11.2 节 vendor-monaco 预算改 < 1.2MB(gzipped)
- 或者用 `@codingame/monaco-vscode-api` 子集(只 Editor,不包完整 IDE),约 600KB gzipped
- Code 面板的 Monaco 用法 = 用户主动开 Code 面板才加载,体验影响小

#### 🟡 4.4 路由懒加载缺 Skills/Models/Settings 拆分

**方案 11.3 节** 路由懒加载:
```ts
const routes = [
  { path: '/workspace/:taskId', component: () => import('@/views/Workspace.vue'), children: [...] },
  { path: '/skills', component: () => import('@/views/Skills.vue') },
  // ...
]
```

**Workspace.vue 一个组件含 ChatTab + CodePanel + MemoryPanel + ToolsPanel 4 个子路由**——如果 4 个都用 `() => import()`,会拆 4 个 chunk + 1 个 Workspace 父 = 5 个 chunk。

**但 Skills.vue 是单 chunk,Models.vue 是单 chunk,Settings.vue 是单 chunk**——3 个工作区**没有进一步拆分**(Skills 子页 / Models 子页 / Settings 5 个 tab 都是单 chunk 内)。

**改稿建议**:
- 11.3 节加"Skills 子页 / Models 子页 / Settings 5 个 tab 各自独立 chunk"
- 路由全部用 () => import,确保每个独立子页都是独立 chunk

---

## 维度 4:v2.1 新增的硬伤(重点)

> owner 抓了 10 项工程细节硬伤,这里加 10 项**v2.1 实施时才暴露的问题**

### 🔴 1. Week 0 ship 视觉基础在 macOS = 视觉冲击

**方案 12.3 节** "Week 0 (前置, 5 commit) - 用户立即可见"。

**v2.1 Week 0 改的 5 项**:
1. 砍 5 套主题 → 强制 light/dark
2. Inter + HarmonyOS Sans SC 字体
3. tokens 重构(7 档 t-shirt + 2 套 spacing)
4. 同色相 accent(从 #818cf8 改 indigo-500/indigo-400)
5. focus-visible 全站替换

**对 macOS 用户的视觉冲击**:
- 字体从 `PingFang SC` → `Inter + HarmonyOS Sans SC` → **字形差异**:
  - 拉丁字符:PingFang SC 不带拉丁,fallback 到 Helvetica Neue,Inter 是新的视觉
  - 中文字符:从 PingFang SC (苹方) → HarmonyOS Sans SC(华为开源)→ **字形完全不同**(苹方圆润,华为偏方)
- accent 从 iOS 蓝(#007aff,实际 v4.3.1 颜色) → indigo(#818cf8) → **跨色相**
- 砍 5 套主题 → 用户可能从 purple 切到 dark,**整体观感大变**

**对 Windows 用户的视觉冲击**:
- 字体 Microsoft YaHei → Inter + HarmonyOS Sans SC → 走下载路径,**首屏字体切换 = 视觉抖动**
- 主题强制映射(如果 v4.3.1 有 purple 用户,迁移到 dark)

**老用户反馈必然来一波**——"我用了半年的主题被砍了""字体怎么变了""accent 颜色怎么不一样了"。

**改稿建议**:
- Week 0 5 commit 改完后,**启动时弹一次性 Toast**:"v4.3.5 视觉基础已升级(主题/字体/accent),如有不适可在 Settings → Feedback 反馈"
- macOS / Windows 字体加载用 `font-display: optional`(失败就 fallback,不强求)
- 砍主题分 2 步:Week 0 砍 purple/blue/green(强制映射到 light/dark),保留 light/dark/system

### 🟡 2. 三栏布局在 macOS retina 的 high DPI 渲染

**方案 7.2 节** 宽度计算全是"逻辑像素"(px)——但 macOS retina 实际渲染是 2x 物理像素。

**潜在问题**:
- macOS retina 13" 默认 1440×900 逻辑像素 = 2880×1800 物理像素
- 顶栏 32px 逻辑 = 64px 物理
- 主区宽度 1440-48-24-240-320 = 808px 逻辑 = 1616px 物理
- **1616px 物理像素能放什么**? 文字、icon 渲染都需要 retina 资源(@2x / @3x)

**v2.1 没说**:
- 图标 / 截图资源是否 retina 适配
- 字体 hinting 在 retina 上的表现(HarmonyOS Sans SC 是否提供 @2x 字体文件)
- **backdrop-filter blur(20px)** 在 retina 上是否正常(实际 v4.3.1 SideNav.vue 用 `backdrop-filter: saturate(180%) blur(20px)`,Electron Chromium 是支持,但 retina 渲染性能有影响)

**改稿建议**:
- 7.2 节加"macOS retina 适配:图标用 @2x / @3x 资源,字体 hinting 关闭(-webkit-font-smoothing: antialiased)"
- 7.2 节加"backdrop-filter 在 macOS 上保留,在 Windows / Linux 上降级(避免 Chromium 性能问题)"

### 🟡 3. 5 状态切换的视觉一致性

**方案 3.1 节 / 3.3 节** 5 状态(空闲/思考/执行/待审阅/完成)的视觉:
- 顶栏徽章: 灰 / 紫 pulse / 蓝 pulse / 黄 +1 / 绿
- 右栏: 不同卡片布局

**状态切换的视觉过渡**没说。

**问题**:
- `空闲 → 思考`: 顶栏徽章从灰 → 紫 pulse,**怎么变?**突然变?渐变?
- `思考 → 执行`: 紫 → 蓝,**同时存在吗?**思考结束立即变执行,还是 0.3s 过渡?
- `执行 → 待审阅`: 蓝 → 黄 +1,**+1 数字怎么显示?**突然出现?数字滚动?
- `待审阅 → 完成`: 黄 → 绿,**Apply 后的过渡动画?**

**Linear / Figma 怎么做的**:
- **状态切换是图标 morph 动画**(用 SVG path interpolation)
- **颜色是瞬切,不渐变**(避免颜色叠加产生奇怪中间色)
- **数字 +1 是滚动进入**(不是淡入)

**改稿建议**:
- 3.1 节加"状态切换视觉规范:颜色瞬切,图标 morph 动画(200ms ease),数字滚动(0.3s)"

### 🟡 4. 老用户迁移时,如果用户改过 14 路由的书签,迁移后能直接到吗?

**方案 9.1 节** 路由表给了完整的旧→新映射——但**没说书签迁移**:

- 用户在浏览器收藏了 `/chat/abc-123`(老 v4.3.1 路由)
- 用户升级到 v4.4.0
- Electron 是**新窗口 + 内部 router**,不是浏览器,没有"书签"概念
- **但用户的"快速访问"是 Cmd+P / 搜索栏 / Recent Items**

**改稿建议**:
- 9.1 节加"Recent Items 迁移:老 v4.3.1 的 Recent Items(用户在 Chat 里的 Recent)迁移到 v4.4.0 的 task 列表"
- 9.3 节加"用户首选项迁移:老用户设置的快捷键、主题、字体大小都按 9.2 表迁移"

### 🟡 5. 灰度发布的 channel 切换 UI 在哪?

**P1-6 已经抓了"alpha/beta/RC 没说具体分发"**——再加一层:

**channel 切换 UI 缺失会导致**:
- alpha 用户没法主动选 alpha
- beta 用户升级后默认还是 stable
- **owner 没法在 Settings 远程推 alpha**(没有 OTA 切换 channel 的 UI)

**改稿建议**:
- 12.4 节加"channel 切换 UI = Settings → General → '更新通道'下拉框(stable / beta / alpha)"
- Settings 选项"参与 alpha 测试"加 disclaimer:"alpha 通道可能不稳定,数据可能丢失"
- 默认 stable,改完 channel 后立即触发 auto-update 检查

### 🟡 6. Inter 字体在 Windows 网络环境差时加载失败的 fallback

**方案 5.2 节** `font-display: swap` + Inter 字体 280KB——Windows 网络差时,Inter 加载需要 1-3s。

**真实场景**:
- 用户在咖啡店 / 火车上用 PiPiClaw
- Inter 加载中 → 文字先用 fallback 显示(Microsoft YaHei / Segoe UI)
- 1-3s 后 Inter 加载完 → **文字突然变窄**(Inter 比 Microsoft YaHei 窄 ~10%)→ **整页布局抖动**
- 用户体验 = "刷新一下页面就抖"

**v2.1 没规定**:
- fallback 字体 → Inter 切换的"layout shift"控制
- 是否用 `size-adjust` CSS 属性预占 Inter 宽度
- 是否 preload 关键字体

**改稿建议**:
- 5.2 节加`@font-face` 用 `size-adjust: 100%; ascent-override: 90%; descent-override: 22%; line-gap-override: 0%;` 让 fallback 字体预占 Inter 宽度
- preload 关键字体:`<link rel="preload" href="/fonts/Inter-Variable.woff2" as="font" crossorigin>`
- **但根据 P0-5 的根因**,Inter 根本不在主栈,这个问题不存在——只要 v2.1 按 P0-5 改稿建议改

### 🟡 7. 4 工作区树形 + 4 辅助面板路由同时存在,导航逻辑混乱

**方案 2.4 节** 4 工作区(Workspace/Skills/Models/Settings)。
**方案 2.3 节** 3 辅助面板(Code/Memory/Tools)。

**用户能通过哪些路径进入同一个 Code 面板**:
- 工作区切换 → 任务 → 工具栏"Code"按钮(?)
- Cmd+Shift+C 直达(?)
- Chat 消息里的"在 Code 面板打开"(?)

**v2.1 没说**辅助面板的入口在哪、Cmd+? 快捷键是什么。

**改稿建议**:
- 2.3 节加"3 辅助面板入口:
  - Code: 顶栏工具栏 / 任务卡片"在 Code 打开"按钮 / Cmd+Shift+C
  - Memory: 顶栏工具栏 / 任务卡片"查看记忆"按钮 / Cmd+Shift+M
  - Tools: 顶栏工具栏 / Cmd+Shift+T"
- 2.3 节加"3 辅助面板切换:Cmd+Shift+C/M/T 互斥切换(开一个自动关另一个)"
- 跟 P0-2 抓的"3 辅助面板不能同时开两个"对应

### 🟡 8. 8 种 LlmEvent type 的渲染进程订阅生命周期

**方案 8.4 节** `useLlmStream` composable——但**没说事件订阅的生命周期**:
- 用户从 Workspace 切到 Skills → 渲染进程组件卸载 → `onUnmounted` 应该 off 订阅
- 用户切回 Workspace → 组件重新 mount → **之前的 thinking 事件还应该显示吗?**
- 如果用户在 Skills 工作区时 AI 还在思考,事件流一直 emit → 渲染进程订阅但没 UI 显示 = **事件丢失**

**改稿建议**:
- 8.4 节加"事件订阅生命周期:订阅在 Workspace 组件 mount,off 在 unmount;切走时事件 buffer 在 pinia 暂存,切回时 replay"
- 用 Pinia 暂存最近 5 分钟事件,Workspace 重新 mount 时 replay

### 🟡 9. 老用户迁移的"config.v4.3.1.bak.json"会被覆盖

**方案 9.3 节** "备份原 config.json 为 `config.v4.3.1.bak.json`"。

**owner 自评硬伤 #2** 抓了"v4.4.0 config.json 写入失败 / 多次升级"——**是真硬伤**:
- 用户升级 v4.3.1 → v4.4.0 → 备份 v4.3.1.bak.json
- 用户升级 v4.4.0 → v4.4.1 → 又备份 v4.4.0.bak.json(覆盖了 v4.3.1.bak.json!?)
- 如果 v4.4.1 写 v4.4.0.bak.json 失败 → 用户想 rollback 找不到 v4.3.1

**改稿建议**:
- 9.3 节加"备份策略:每次升级保留**最近 3 个版本的备份**(v4.3.1.bak.json / v4.4.0.bak.json / v4.4.1.bak.json),超过 3 个最旧的删"
- 9.3 节加"失败回退:写新 config 失败时,保留旧 config 不动,弹错误提示'升级失败,需要手动恢复'"

### 🟡 10. 5 P0 修干净后,v2.1 仍缺"周 ship 验证 + 早期用户反馈"

**方案 12.3 节** 6 周 26 commit 节奏——但**没说 ship 后怎么收集早期用户反馈**。

**v2.0 评审抓的"ship 风险"在 v2.1 12.4 节只解决了"alpha/beta 内部测试"——**没解决"ship 后第 1 周 / 第 2 周 / 第 4 周的用户反馈怎么收"**。

**改稿建议**:
- 12.4 节加"ship 后 4 周用户反馈收集:
  - Week 1: 监控 crash rate / LCP / Cmd+L 触发成功率
  - Week 2: 监控 active users / retention / feedback modal 提交数
  - Week 4: 评估是否回滚 / 走 hotfix / 走 v4.4.1"
- 12.4 节加"ship 后 4 周 hotfix 周期"——owner 自评硬伤 #10 抓了

---

## 对标参考(v2.1 涉及)

### Cursor (AI 侧栏)

- **Cmd+L** 打开/关闭 AI 侧栏,**默认关闭** ✅ (v2.1 P0-1 对)
- **Apply / Reject 流程** 在工具调用后,默认折叠,点击 Apply 才落地 ✅ (v2.1 P0-3 对)
- **静态 "Thinking..."** + 不动画的灰点 ✅ (v2.1 P0-4 对)
- **AI 状态只在侧栏内,不全局可见** ❌ (v2.1 顶栏徽章做入口 = 差异化,保留)
- **inline ghost text 补全** — v2.1 不做(Chat 是显式输入,不 inline 补全) — **保留**
- **PiPiClaw 学到了**: 侧栏默认关 + Apply/Reject + 静态思考
- **PiPiClaw 没学到**: 工具调用 diff preview(用 diff editor 显示改动,v2.1 只说"Apply/Reject 按钮"没规定怎么预览 diff)

### Linear (任务流 + 视图切换不丢上下文)

- **顶栏固定**: Logo / 视图切换(My Issues / Inbox / Projects) / 搜索 / 用户头像 ✅ (v2.1 P1-1 对)
- **中栏随视图变**,**不丢上下文**(滚动位置 / 筛选 / 选中态 都保留)✅ (v2.1 顶栏固定 + 左栏头部固定对,但**任务流内部状态没说保留**)
- **Cmd+K 命令面板** 默认关,200/200 对称动画 ✅
- **任务详情侧栏是临时浮层**,不是常驻 ✅ (v2.1 P0-1 对)
- **PiPiClaw 学到了**: 顶栏固定 + Cmd+K + 临时右栏
- **PiPiClaw 没学到**: 视图切换不丢上下文(任务流内部状态)**——v2.1 仍差这层**

### Notion (三栏布局 + 右栏默认无)

- **三栏**: 左 workspace 树(永远在)+ 中页面 + 右评论(默认无)✅ (v2.1 对)
- **左栏顶部固定**: Logo / 搜索 / 收藏 ✅ (v2.1 P1-1 对)
- **右栏默认无**,只在需要时显示(评论/分享)✅ (v2.1 P0-1 对)
- **workspace 树形**,不是平铺切换 ✅ (v2.1 P1-1 对)
- **PiPiClaw 学到了**: 三栏 + 树形 + 右栏默认无

### Vercel v0 (5 状态 + Regenerate 流程)

- **静态 "Generating..."** + 渐变 pulse ✅ (v2.1 P0-4 对)
- **生成完成后** 出现 "Regenerate / Use this" 按钮 ✅ (v2.1 P0-3 对)
- **状态可见化 = 内嵌在内容里**,不浮层 ✅
- **PiPiClaw 学到了**: 5 状态 + Regenerate 流程

### GitHub Copilot Workspace (待审阅流程)

- **Workspace 改完出"Accept / Discard"** ✅ (v2.1 P0-3 对)
- **多文件 diff** preview,用户一次性 Accept 全部 ✅ (v2.1 P0-3 部分对——但没说多文件 diff preview 怎么展示)
- **PiPiClaw 学到了**: 待审阅流程
- **PiPiClaw 没学到**: 多文件 diff preview(实际 v2.1 P0-3 只说"Apply/Reject 按钮",没规定怎么展示 diff)

### Figma 桌面 (多平台差异)

- **macOS / Windows / Linux** 顶栏高度差异(macOS 28px / Windows 32px / Linux 32px) ✅ (v2.1 P10.1 对)
- **traffic light 适配**(macOS 左侧 80px 让出)✅ (v2.1 P10.1 对)
- **快捷键差异**(Cmd vs Ctrl)✅ (v2.1 P10.2 对)
- **鼠标光标细节** ✅ (v2.1 P10.5 对,但过细)
- **PiPiClaw 学到了**: 平台差异全覆盖
- **PiPiClaw 没学到**: Figma 的"draft / saved / published"三态可见化(Layers 面板的实心/空心点)— **可借鉴到 v2.1 的工具调用状态**

---

## 改稿优先级

### P0(v2.1 → v2.2 必须改,7 项)

1. **LlmClient 流式改造**(补-1 8.3 节) — **LlmEvent 协议建立在 LlmClient 已经是流式的前提上,实际不是。这是 P0 级遗漏。** 改:`electron/llm/adapters/{openai,anthropic,zhipu}.ts` 全部从 `await res.json()` 改成 SSE 解析
2. **破坏性操作定义(P0-3)** — 加"工具类型 + 路径模式"白名单,否则"待审阅"失效
3. **vite manualChunks 函数式改写(补-4)** — `manualChunks` 函数式不是对象式,`feature-ai` 用 `id.includes('/components/ai/')` 匹配 + 4 AI 组件 `defineAsyncComponent` 触发
4. **P0-5 字体方案对齐实际代码** — 保留 Apple HIG + PingFang SC + Microsoft YaHei 栈,Inter 删,HarmonyOS Sans SC 只作 Linux fallback
5. **P0-4 ThinkingIndicator 优化不是重做** — 实际 v4.3.1 ThinkingBlock 已经是折叠静态,v2.1 4.1 节是"1 个 commit 的活",不是"重做 1 个大节"
6. **路由表 14 → 17** — 实际 v4.3.1 有 17 生产路由,9.1 节补全
7. **LlmEvent 8 → 12 type** — 补 error / cancelled / token_usage / tool_call_chunk / reasoning_chunk

### P1(v2.1.1 建议改,8 项)

8. **顶栏过载** — 4 工作区改放左栏头部固定区,不放顶栏
9. **主区宽度联动约束** — `left + right ≤ viewport - topbar - statusbar - 360`
10. **3 辅助面板可堆叠** — 同时开 2-3 个,自动宽度分配
11. **MemoryChip 任务相关性 30% 走关键词匹配** — embedding 引入太重,V2.1 先用关键词,后阶段再升级
12. **老用户迁移备份最近 3 版本** — v4.3.1 / v4.4.0 / v4.4.1 都保留
13. **Week 0 ship 加一次性 Toast** — 视觉冲击预警
14. **taskId 概念补全** — 所有 `/chat/:convId` 映射到 `default-task` 不可删
15. **ship 后 4 周用户反馈收集 + hotfix 周期** — 12.4 节补

### P2(亮点保留,7 项)

16. **"AI 协作可视化"战略定位** — v2.0 → v2.1 最大认知升级,1.2 节保留
17. **4 个 AI 协作形式**(思考/工具/记忆/审阅可见)— 1.4 节 4 个护城河保留
18. **"待审阅"独立状态** — P0-3 修干净后是真正的产品安全护栏,3.1 节保留
19. **6 周灰度发布节奏** — 12 节 6 周分阶段 ship 风险降
20. **Inter / HarmonyOS 字体方案方向** — 5.2 节方向对,只是落地细节错(P0-5)
21. **3 断点响应式 ≥1366 / 1280-1366 / 1024-1280 / <1024** — 7.2 节对
22. **路由懒加载 + AICollabPanel 双层懒加载** — 11.3 节对(改完 4.1 / 4.2 后)

---

## 总结

**v2.1 是 ship-ready 候选的下一步——但 v2.1 自身还差一段**:

### 修干净的部分 ✅
- **P0 方向全对**(5 个 P0 方向 100% 对路):默认折叠 / 1 主区 + 3 面板 / 5 状态 / 静态光标 / 双语字体
- **P1 全收**(6 个 P1 全改):树形 / 内嵌 / 3 断点 / 5 状态 / 系统评分 / 灰度
- **补补大部分对**(4 个 owner 补方向对):IPC 协议 / 老用户迁移 / 平台差异 / manualChunks

### 没修干净的部分 🟡 / 🔴
- **LlmClient 流式改造**(P0 级遗漏,不是 P1)— v2.1 8.3 节承诺流式事件,但 v4.3.1 LlmClient 是非流式,需要 3 个 adapter 全部重写
- **P0-3 "破坏性操作"歧义** — 没有"工具类型 + 路径模式"双匹配白名单,"待审阅"会失效
- **P0-5 字体方案前提错** — v2.0 评审的"Inter 中文 fallback 坑"在 v4.3.1 实际代码不存在,Inter 不在主栈里,v2.1 还在修假想敌
- **vite manualChunks 对象式错** — `manualChunks` 实际是函数式匹配模块 ID,不是对象式指 .vue 文件路径
- **v2.0 评审的 6 个根问题里"切换工作区不丢上下文"只解决了一半**(导航不丢,**任务流内部状态不丢没说**)

### v2.1 实施时才会暴露的 10 个硬伤
- Week 0 ship 视觉冲击(macOS PingFang → HarmonyOS 字体差异)
- macOS retina high DPI 渲染(backdrop-filter 性能)
- 5 状态切换视觉一致性(状态间 morph 动画)
- 老用户书签迁移到 Recent Items
- channel 切换 UI 缺失
- Inter 字体加载失败 fallback layout shift
- 4 工作区 + 3 辅助面板同时存在的导航逻辑混乱
- LlmEvent 订阅生命周期(切走时事件丢失)
- 老用户迁移备份被覆盖
- ship 后 4 周用户反馈 + hotfix 周期缺失

### 综合 6.8 怎么来的

| 维度 | 评分 | 说明 |
|---|---|---|
| 战略定位 | 8.5/10 | "AI 协作可视化"精准,v2.0 偏差修干净 |
| 信息架构 | 7.5/10 | 三栏+树形+5 状态方向对,实施细节有坑 |
| AI 协作右栏 | 7.5/10 | 默认折叠+顶栏徽章+5 状态对,但 P0-3 破坏性操作定义没解 |
| 4 AI 组件 | 7.0/10 | 4 组件全"重做",实际 P0-4 是"优化"不是"重做" |
| 视觉语言 v2.1 | 7.0/10 | Inter+HarmonyOS 方向对,但前提错(实际不用 Inter) |
| 加载动画 v2.1 | 7.5/10 | 静态文字 + 1.5s 光标对 |
| 交互模式 v2.1 | 7.0/10 | 主动建议改内嵌对,3 辅助面板堆叠没说 |
| 主题 v2.1 | 6.5/10 | 砍 5 套主题是修假想敌(v4.3.1 实际只有 3 套) |
| 响应式 v2.1 | 6.5/10 | 3 断点对,主区宽度计算错(可拖宽度没说联动) |
| 平台差异 | 7.0/10 | 5 子节对,macOS 顶栏 38px 错(实际 32px) |
| 性能 v2.1 | 6.0/10 | manualChunks 函数式错,4.1/4.2 错 |
| 实施路线 | 7.5/10 | 6 周灰度对,channel 切换 UI 缺 |
| 工程实施 | 5.5/10 | LlmClient 流式改造 P0 级遗漏,LlmEvent 8 type 不够 |
| **总评** | **6.8/10** | **P0 修干净方向,工程实施差关键一公里,ship 还差最后一段** |

### 跟 v2.0 对比

- v2.0: 战略对架构错(5.5/10) — 5 P0 全部错方向
- v2.1: P0 方向对但工程实施错(6.8/10) — 5 P0 方向对,LlmClient 流式 + 字体前提 + manualChunks 函数式 3 个实施遗漏
- v2.0 → v2.1 进步 +1.3,**值得 ship 准备**,但 v2.1 自身要再过 1 轮(7 项 P0 + 8 项 P1)才能进 26 commit

**v2.1 ship-ready 程度**: **6.5/10**(及格线之上,值得开始 26 commit,但 v2.1 实施中会撞 7 项 P0 遗漏,需要在 v2.1.1 hotfix 修)

**v2.1 → v2.1.1 修补预算**: 7 P0 + 8 P1 = 15 项 = **3-5 天补稿 + 1 周实施**

**v2.1.1 → 26 commit 实施**: 6 周节奏合理,**Week 0 视觉基础先 ship**(但加 Toast 预警),**Week 1-2 内部开发**,**Week 3+ alpha/beta/RC**,**Week 6 v4.4.0 ship + 4 周 hotfix 周期**

---

## 相关文件

- `docs/redesign-v2-spec.md` — v2.0 基础方案
- `docs/redesign-v2-self-review.md` — v2.0 owner 自评 (7.0)
- `docs/redesign-v2-designer-review.md` — v2.0 designer 评审 (5.5) ← **我之前评的**
- `docs/redesign-v2-final-review.md` — v2.0 综合评审 (5.8)
- `docs/redesign-v2.1-spec.md` — **v2.1 详细方案 (37.2 KB)** ← 本评审基线
- `docs/redesign-v2.1-self-review.md` — **v2.1 owner 自评 (7.5)**
- `docs/redesign-v2.1-designer-review.md` — **v2.1 designer 评审 (6.8)** ← 本文件
- `src/router/index.ts` — v4.3.1 实际 23 路由(17 生产 + 6 devOnly)
- `src/styles/tokens.css` — v4.3.1 实际字体栈(SF Pro 优先,Inter 不在主栈)
- `src/styles/reset.scss` — v4.3.1 实际 body font(Microsoft YaHei 优先)
- `src/components/chat/ThinkingBlock.vue` — v4.3.1 实际 ThinkingBlock(已折叠+静态)
- `src/components/layout/AppLayout.vue` — v4.3.1 实际布局(无右栏)
- `src/components/layout/TitleBar.vue` — v4.3.1 实际顶栏(无 AI 状态徽章)
- `src/components/layout/SideNav.vue` — v4.3.1 实际侧栏(3 工作区分组)
- `src/views/Settings.vue` — v4.3.1 实际主题选项(3 mode,非 5 套)
- `electron/llm/LlmClient.ts` — v4.3.1 实际 LlmClient(非流式)
- `electron/llm/adapters/openai.ts` — v4.3.1 实际 OpenAI adapter(await res.json)
- `electron/agent/AgentEventBus.ts` — v4.3.1 实际事件总线(已有 agent:* 事件)
- `electron/agent/LlmAgentBrain.ts` — v4.3.1 实际 LlmAgentBrain(单次 think/call/spawn)
