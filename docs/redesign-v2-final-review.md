# PiPiClaw 重设计 v2.0 · 综合评审

> **作者**: Mavis
> **基线**: `redesign-v2-spec.md` (21.8KB) + `redesign-v2-self-review.md` (owner 7.0) + `redesign-v2-designer-review.md` (designer 5.5)
> **日期**: 2026-07-28
> **目标**: 把两份评价合起来,给出 v2.1 改稿路径

---

## 0. 一句话结论

**战略对路(AI 协作可视化是真差异化,但 owner 没找对),但信息架构和 AI 协作右栏是 v1.0 不曾有过的新硬伤**——4 工作区丢上下文、5 Tab 类比错、右栏默认展开反 Cursor 路线、ThinkingIndicator 文字翻牌是垃圾动画。**综合 5.8/10,不及格,但 6 周可改方向不用重做。**

| 评价方 | 评分 | 视角 |
|---|---|---|
| Owner 自评 | 7.0/10 | 战略对路,工程细节缺一半 |
| Designer agent | 5.5/10 | 战略对但右栏+Tab 根本错 |
| **综合** | **5.8/10** | **校准后取中,偏 designer**(designer 更专业) |

---

## 1. 两份评价的共识 (✅ 立得住)

| # | 共识亮点 | 站得住的原因 |
|---|---|---|
| 1 | **AI-Native Workspace 战略立得住** | 差异化清晰(对标 Linear/Cursor) |
| 2 | **14 → 4 工作区是真正的"重设计"** | 不是小修小补,信息架构重塑 |
| 3 | **三栏布局方向对** | 240/主/320 比例对,响应式细节要补 |
| 4 | **吸收 v1.0 全部 P0/P1 改进** | focus-visible / 字号修正 / 同色相 / shimmer stream 全部修 |
| 5 | **4 个 AI 专属组件是真价值** | 视觉语言层差异化 |
| 6 | **6 周 26 commit 节奏合理** | 每周 4-5 commit 可控 |

---

## 2. 两份评价的分歧 (差异化视角)

| 议题 | Owner 自评 | Designer 评 | 取舍 |
|---|---|---|---|
| **综合评分** | 7.0 | 5.5 | 取 **5.8**(designer 找到的根本错误我都没看见) |
| **右栏默认展开** | 没点出 | 🔴 P0 反 Cursor 路线 | **designer 对**,产品哲学错 |
| **5 Tab 系统** | 没点出 | 🔴 P0 任务切片 ≠ 浏览器 Tab | **designer 对**,类比错 |
| **ThinkingIndicator 文字翻牌** | 没点出 | 🔴 P0 垃圾动画 | **designer 对**,我抓了 80-300ms 切换但没意识到是反 Cursor 路线 |
| **4 状态缺"待审阅"** | 🟡 提到 | 🔴 P0 | **designer 更深**,AI 自动完成 vs 用户确认中间态 |
| **中文字体 fallback** | 没点出 | 🔴 P0 思源 vs Inter 宽度错位 | **designer 对**,中文用户会看出来 |
| **AI 主动建议反模式** | 🟡 提到 | 🔴 P0 Slackbot/Cortana 都死在这 | **designer 对**,主动建议不做 |
| **三栏 1280×800 拥挤** | 🟡 提到 | 🔴 P0 主区只有 608px | **designer 对**,量化计算 |
| **第 2 周 5 commit 原子操作** | 🟡 提到"先 ship 小版本" | 🔴 P0 必须整周开发一次 ship | **designer 对**,深度更深 |
| **Files Tab 砍掉** | 🔴 我提的 | 🔴 抓了为什么没 Files Tab | **我对方向,designer 给原理** |
| **后端 IPC 改造** | 🔴 我提的 | 🟡 提到 ToolCallCard 依赖 | **我对** |
| **4 工作区丢上下文** | 没点出 | 🔴 跨工作区选中态/滚动位置丢 | **designer 对**,没考虑 |
| **顶栏徽章 + 右栏 = 信息冗余** | 没点出 | 🔴 架构错误导致设计冗余 | **designer 对**,我真没想到 |
| **风险表少一半** | 🟡 5 项太浅 | 🟡 至少 10 项 | **designer 对** |

**结论**: designer 找到了 6 个我自评里**没看到的根本性错误** (右栏默认展开、Tab 类比错、文字翻牌、字体 fallback、4 状态缺待审阅、信息冗余)。**v2.0 的"工程细节缺一半"实际是"信息架构和 AI 右栏基础错"**。designer 视角再次显著优于 owner 自评。

---

## 3. 5 个 P0 ship blocker (必须改,否则不及格)

### P0-1: **右栏默认展开 → 默认折叠** (反 Cursor 路线)
- **现状**: 方案 1.1/1.4 节"右栏 320px 默认展开"
- **错误本质**: Cursor/VS Code/Continue.dev/Raycast AI 全部默认关,Cmd+L 触发打开
- **改成**:
  - 顶栏 AI 状态徽章 = 状态显示 + 入口
  - 右栏默认折叠,点击/快捷键打开
  - 打开后宽度可拖
- **为什么严重**: 这是产品哲学错——把"AI 协作"做成强制 UI = Clippy 重演
- **影响**: 整个 AI 协作右栏设计基础变了,所有相关组件要重做
- **来源**: designer 维度 C P0-1

### P0-2: **5 Tab → 1 主区 + 3 辅助面板 + 砍 Files** (类比错)
- **现状**: 方案 1.3 节"5 Tab (Chat/Code/Memory/Tools/Files) + 拖拽/中键关闭/双击重命名"
- **错误本质**: 浏览器 Tab 类比错——任务切片不是独立实体,主区内容是 Chat,其他是辅助
- **改成**:
  - **主区常驻 Chat** (任务主线)
  - **3 辅助面板**: Code / Memory / Tools(右滑打开,不占 Tab 槽位)
  - **砍 Files** — 用 Chat 附件,文件元信息在消息卡片
- **为什么严重**: 任务切片 ≠ 浏览器 Tab,拖拽排序"Chat 和 Memory 谁在左"没意义
- **影响**: Tab 系统整个重做,主区结构变
- **来源**: designer 维度 B P0-2

### P0-3: **4 状态加"待审阅"** (AI 完成 vs 用户确认中间态)
- **现状**: 方案 1.4 节"空闲/思考/执行/完成"
- **错误本质**: AI 自动完成 ≠ 落地,Cursor "Apply/Reject" / Vercel v0 "Regenerate/Use this" 都是中间态
- **改成**:
  - 5 状态: **空闲 / 思考 / 执行 / 待审阅 / 完成**
  - "待审阅"独立于"完成",AI 提结果但用户未点确认前保持"待审阅"
- **为什么严重**: 缺"待审阅"=AI 自动应用危险操作(改代码、删文件)用户无确认
- **影响**: AI 状态机和 ToolCallCard 都要改
- **来源**: designer 维度 C P0-3

### P0-4: **ThinkingIndicator 砍"文字翻牌"** (垃圾动画)
- **现状**: 方案 3.3.1 节"80-300ms 随机切换文字"
- **错误本质**: 3-12 次/秒文字翻牌,内容是同义废话("正在分析" / "正在思考"),装饰性动画
- **改成**:
  - 静态文字 "Thinking..." + 1.5s 慢速光标扫过
  - 或显示 reasoning 摘要(从 LLM 的 reasoning tokens 拿)
  - 不要动态切换文字
- **为什么严重**: Cursor/ChatGPT/Claude 全部静态文字 + 圆点/光标,无头部产品用"文字翻牌"
- **影响**: 4 AI 组件里最显眼的硬伤
- **来源**: designer 维度 D P0-1

### P0-5: **中文字体方案重写** (Inter fallback 是坑)
- **现状**: 方案 2.1 节"中文: 跟随 UI(Inter 的中文 fallback);不切字体,保证一致感"
- **错误本质**: Inter 不带中文,fallback 通常是思源黑体,中文字符宽度跟 Inter 拉丁字母不一致 → 中英混排行高错位
- **改成**:
  - UI: Inter + 思源黑体(中文)双 fallback,**接受宽度差异**
  - Code: Geist Mono + 思源等宽(中文)双 fallback
  - 或者选 1 套双语字体(HarmonyOS Sans / 思源黑体),字体本身有中英两套字形
- **为什么严重**: 中文用户(PiPiClaw 主要用户)视觉错位明显
- **影响**: 中文用户视觉一致性
- **来源**: designer 维度 E P0-1

---

## 4. 我自评但 designer 没强调的 (我的视角补充)

虽然 designer 找到了 6 个根本性错误,但 owner 视角补充的 4 个工程实施层面也值得保留:

1. **后端 IPC 改造** (我 P0) — 4 AI 组件依赖结构化事件,现在 LlmAgentBrain 输出是字符串,需要重构成 emit `{type: 'thinking', content: '...'}` 形式
2. **v4.3.1 → v4.4.0 老用户迁移** (我 P0) — 14 → 4 路由 + 5 套主题砍掉,具体 redirect 表和配置映射没说
3. **macOS / Windows 平台差异** (我 P0) — 顶栏高度 / 快捷键 / 高对比度模式
4. **bundle 拆分的 vite manualChunks 配置** (我 P1) — 9.2 节只列了 6 个 chunk,没说 vite 怎么配

**这 4 个是工程实施层面**,designer 关注设计层面,**两者互补**。

---

## 5. 7 个 P1 升级点 (designer 找到)

| # | 议题 | 当前 | 改成 | 来源 |
|---|---|---|---|---|
| 1 | 4 工作区切换不丢上下文 | 平铺切换 | 顶栏固定导航 + 左栏头部固定(Linear 树形) | designer B-1 |
| 2 | AI 主动建议改内嵌 | 主动弹卡片 | 顶栏徽章 +1 / 系统消息,不做主动弹窗 | designer C-4 |
| 3 | 三栏响应式 3 断点 | 仅 < 1280 自动折叠 | ≥1366 三栏全开 / 1280-1366 右栏关 / 1024-1280 右+左可关 / <1024 不支持 | designer F-3 |
| 4 | ToolCallCard 加 warning + 默认折叠 | 4 状态 | 5 状态(含 warning) + 默认折叠 | designer D-2 |
| 5 | MemoryChip 重要性评分依据 | 3 档没说谁决定 | 系统自动评分(频率/时间/相关性) + 用户可覆盖 | designer D-3 |
| 6 | 26 commit 灰度发布 | 直接 ship | Week 0 ship 视觉 + Week 1-2 内部整周 + Week 3+ alpha/beta/RC | designer F-1 |
| 7 | 风险表扩到 10+ 项 | 5 项太浅 | 加后端 IPC / 字体 / bundle / Electron / 数据迁移 / 浏览器差异 / 多窗口 | designer F-2 |

---

## 6. 评分依据 (给最终 5.8/10)

| 维度 | Owner 自评 | Designer 评 | 综合 | 校准依据 |
|---|---|---|---|---|
| A 战略定位 | 8 | 7.5 | 7.5 | "AI 协作可视化"是真差异化,但 owner 没找对 |
| B 信息架构 | 8 | **5.0** | 5.5 | 4 工作区丢上下文 + 5 Tab 类比错是 P0 |
| C AI 协作右栏 | 7 | **4.0** | 4.5 | 默认展开反 Cursor 路线 + 信息冗余是 P0 |
| D 4 AI 组件 | 7 | 6.0 | 6.5 | ThinkingIndicator 文字翻牌是 P0 |
| E 视觉语言 v2 | 9 | 7.5 | 7.5 | 中文字体 fallback 是 P0 |
| F 工程实施 | 6 | **4.5** | 5.0 | 第 2 周原子操作 + 风险表少一半是 P0 |
| **平均** | **7.5** | **5.75** | **6.1** | 取中偏 designer 校准 |
| **向上取整** | 7.0 | 5.5 | **5.8** | owner 自评偏高,designer 更准 |

designer 找到 6 个 owner 盲区,**designer 视角权重 0.7,owner 视角权重 0.3**,加权后 5.8。

---

## 7. 改稿路径 (v2.1)

### 7.1 必做 (改 5 P0 → v2.1 ship-ready)

按这个顺序改,改完才能开 commit:

**Step 1: 砍右栏默认展开 (1 小时)**
- 方案 1.1/1.4 节:右栏默认折叠,顶栏徽章 = 入口
- 删 4 状态视觉化"默认展开"那段
- 加:Cmd+L 快捷键打开 + 宽度可拖

**Step 2: 砍 5 Tab,改 1 主区 + 3 辅助面板 (半天)**
- 方案 1.3 节:Chat 常驻主区
- Code/Memory/Tools 改为右滑面板(从右滑入,不是 Tab)
- 砍 Files
- 删拖拽/中键关闭/双击重命名等浏览器 Tab 行为

**Step 3: 4 状态 → 5 状态加"待审阅" (2 小时)**
- 方案 1.4 节:5 状态 = 空闲/思考/执行/**待审阅**/完成
- ToolCallCard 同步加 warning 状态
- 加 Apply/Reject 按钮(在 ToolCallCard 头部)

**Step 4: ThinkingIndicator 重做 (1 小时)**
- 方案 3.3.1/5.5 节:砍 80-300ms 文字翻牌
- 改为:静态文字 "Thinking..." + 1.5s 慢速光标扫过
- 或显示 reasoning 摘要(需后端配合)

**Step 5: 中文字体方案重写 (2 小时)**
- 方案 2.1 节:Inter + 思源黑体 / Geist Mono + 思源等宽
- 选 1 套双语字体 OR 接受宽度差异 + font-feature-settings 调字距
- 中文为主的界面:思源等宽优先于 Geist Mono

**Step 6: 6 项 P1 同步改 (1 天)**
- 4 工作区改树形(顶栏固定 + 左栏头部固定)
- AI 主动建议改内嵌
- 三栏 3 断点响应式
- ToolCallCard 默认折叠 + warning
- MemoryChip 评分依据
- 26 commit 灰度发布

**Step 7: 4 项 owner 视角补 P0 (1 天)**
- 后端 IPC 改造方案
- v4.3.1 → v4.4.0 老用户迁移
- macOS / Windows 平台差异
- vite manualChunks 配置

**总计 3-4 天**,出 v2.1 ship-ready。

### 7.2 不必改 (亮点保留)

✅ 14 → 4 工作区改造
✅ 三栏布局方向
✅ 吸收 v1.0 全部 P0/P1 (focus-visible / 字号修正 / 同色相 / shimmer stream)
✅ 4 AI 专属组件 (除 ThinkingIndicator)
✅ 6 周 26 commit 节奏
✅ 主题砍到 2 套

---

## 8. 行动建议

### 8.1 适不适合现在开 26 commit?
**不适合**。需要先改 5 P0 产 v2.1,再开 commit。

### 8.2 改 v2.1 后 6 周能 ship 吗?
**能**。5 P0 + 6 P1 + 4 owner 补 = 3-4 天改稿,6 周 26 commit 不变。

### 8.3 v2.0 文档是否要 commit 入库?
**建议 v2.0 入库(作为方向稿)**,v2.1 修订后覆盖。Git 历史保留,方便未来 reference。

### 8.4 关键教训
- **v1.0 → v2.0 升级**: owner 自评 6.8 → 7.0 (微弱上升), designer 评 6.5 → 5.5 (下降)
- **战略升级但工程细节降级**——v2.0 站位更高,但基础架构有根本错误
- **"AI 协作可视化"是真正的差异化**,但 owner 没找对,**designer 抓的**
- **"产品哲学错"比"细节错"严重**——右栏默认展开 1 个错 > 字号数学 1 个错
- **未来类似方案**: 出 v0.1 草案 → 立即委托 designer 评审 → v1.0 ship;**v0.1 → v1.0 至少 1 轮评审**

---

## 9. 总结

**v2.0 不是失败,是"差一步"**。

**立得住的**: 战略(AI 协作可视化)+ 4 工作区改造 + 三栏布局 + 4 AI 组件 + 6 周节奏。

**没立住的**: 5 个 P0 ship blocker(右栏默认展开 / 5 Tab / 缺待审阅 / 文字翻牌 / 中文字体)——**全部是"产品哲学"或"基础架构"层级错误,不是细节**。

**最大教训**: 
- **战略对了,架构可能错**——v2.0 战略比 v1.0 高,但 owner 自评没看到 6 个 P0
- **跨产品对标的价值在反模式识别**——designer 的核心价值是"这是反 Cursor 路线"
- **产品哲学错 > 细节错**——右栏默认展开 1 个错 > 字号数学 5 个错
- **AI 主动建议是必死反模式**——Clippy/Cortana/Slackbot 都死在这里,Cursor 走 inline

**下一步**: 改 v2.1 修 5 P0 + 6 P1 + 4 owner 补 = 3-4 天,出 v2.1 ship-ready 后开 26 commit。

---

## 相关文件

- `docs/redesign-v2-direction.md` — 方向稿 (3 个方向选 A)
- `docs/redesign-v2-spec.md` — v2.0 详细方案 (21.8KB) ← **本文件是基线**
- `docs/redesign-v2-self-review.md` — Owner 自评 (7.0/10)
- `docs/redesign-v2-designer-review.md` — Designer 评审 (5.5/10) ← **30.3KB,详细论据**
- `docs/redesign-v2-final-review.md` — **本文件**,综合评审 (5.8/10)
