# PiPiClaw 重设计 v2.1.1 · 综合评审

> **作者**: Mavis
> **基线**: `redesign-v2.1.1-spec.md` (66.4KB) + `redesign-v2.1.1-self-review.md` (owner 8.5) + `redesign-v2.1.1-designer-review.md` (designer 6.5)
> **日期**: 2026-07-28
> **结论**: **v2.1.1 不适合直接开 26 commit**,1500 行代码 90% 跑不动,需出 v2.1.2 修 5 P0 才能 ship

---

## 0. 一句话结论

**v2.1.1 制造了"看起来对但跑不动"的假象——1500 行代码 90% 引用不存在的文件/npm 包,vite.config.mts 重写会破坏 Electron 集成,backupConfig 删除循环是死代码。综合 6.5/10(比 v2.1 6.8 降 0.3),owner 自评 8.5 偏高 2.0。建议出 v2.1.2 收 5 P0 才能 ship。**

| 评价方 | 评分 | 视角 |
|---|---|---|
| Owner 自评 | 8.5/10 | 15 项改稿全到位 + 全给代码,工程实施 7→9 |
| Designer agent | 6.5/10 | 3 事实错 0 个真修干净,1500 行 90% 假代码 |
| **综合** | **6.5/10** | **校准后取 designer**(designer 跨过"评价"边界做了代码 review) |

---

## 1. v2.0 → v2.1 → v2.1.1 真实进展 (✅ 但要诚实地看)

| 版本 | 综合评分 | 真实进展 |
|---|---|---|
| v2.0 | 5.8/10 | 战略对,信息架构错 |
| v2.1 | 7.0/10 (+1.2) | 5 P0 方向对,工程细节缺 |
| **v2.1.1** | **6.5/10 (-0.5)** | **1500 行代码 90% 假代码,vite 重写破集成** |

**v2.1.1 相对 v2.1 是降分**,不是升分。这是 v2 系列最大的警示。

### 真实提升 (✅)
- 字体: 砍 Inter 改动 = 真修干净 (但其实不用修,v4.3.1 本来就没 Inter)
- P0-1 破坏性白名单: 真有代码 + 实施细节
- P1 样式细节: TopBar / AiStatusBadge / Onboarding 几个组件是真的

### 制造的问题 (🔴)
- LlmClient 改一半 + 4 个新错 (假 npm 包/假 provider/错 Anthropic API/破坏 3-adapter)
- vite.config.mts 重写会破坏 vite-plugin-electron 集成
- backupConfig 删除循环是死代码 (i=3 时检查 bak.4.json 永远不存在)
- 1500 行代码 90% 引用不存在的文件/目录/npm 包

---

## 2. 3 事实错验证 (designer 抓的核心)

| 事实错 | v2.1 状态 | v2.1.1 改 | designer 评 |
|---|---|---|---|
| **LlmClient 非流式** | 协议改不动 | LlmClient.ts 完整重写 250 行 | 🟡 **改一半 + 4 新错**(假 npm 包 @anthropic-ai/sdk 0 个,假 streamAnthropic 缺 thinking_start/end,假 streamOllama content 累积非 delta,破坏 3-adapter 架构) |
| **字体前提错** | Inter 在主栈 | 砍 Inter 改动 | ✅ **修干净**(但其实不用修,v4.3.1 本来就没 Inter,这是"修对空气挥拳") |
| **vite manualChunks API** | 对象式错 | 函数式 manualChunks(id) | 🟡 **方向对(沿用 v4.3.1 函数式),但 3 个 chunk 永远空(monaco/chart 不在 package.json) + 1 个会反弹(element-plus 强制合并) + 重写破坏 vite-plugin-electron 集成** |

**3 事实错:0 个真修干净,1 个是"修对空气",2 个改一半**

---

## 3. 7 P0 工程实施验证

| P0 | 改 | designer 评 |
|---|---|---|
| **P0-1** | DESTRUCTIVE_TOOLS + PATTERNS | ✅ 真修 (这一项是 v2.1.1 唯一完美 P0) |
| **P0-2** | LlmClient 3 adapter SSE | 🔴 改一半 + 4 新错 (见上) |
| **P0-3** | 砍 Inter 改动 | 🟡 真修(但不用修) |
| **P0-4** | vite manualChunks 函数式 | 🔴 3 chunk 空 + 1 反弹 + 破坏 Electron 集成 |
| **P0-5** | 3 辅助面板可堆叠 | 🟡 5 实施错(缺同类型去重/最大堆叠数/持久化/key 错) |
| **P0-6** | 主区宽度联动约束 | 🟡 MIN_MAIN_AREA 528 太松 + 没考虑 1024 屏 |
| **P0-7** | MemoryChip TF-IDF | 🔴 撤 embedding 错(脱离 v4.3.1 已 ship 架构) + 引用不存在 memory.ts |

**7 P0:1 个真修(P0-1)+ 2 个修空气(P0-3 砍 Inter,v2.0 字本身就错)+ 4 个改一半(P0-2/P0-4/P0-5/P0-6/P0-7)**

---

## 4. 8 P1 实施细节验证

| P1 | 改 | designer 评 |
|---|---|---|
| **P1-1** | 顶栏右区 ≤ 280px | 🟡 缺中等密度模式(1024 屏是 isNarrow 折叠) |
| **P1-2** | 2s 呼吸光晕 | ✅ 真修 (WCAG 2.3.1 通过) |
| **P1-3** | 首次启动引导 | 🟡 不开右栏对了,但国际化没做 |
| **P1-4** | LlmEvent 15 种 | 🟡 缺 protocolVersion 字段(未来兼容性) |
| **P1-5** | 路由表 17 个 | 🔴 **路由数 23 不 17 + devOnly 5 不 7 + 6 redirect 3 不存在** |
| **P1-6** | 主题表 3 套 | 🟡 跟 v4.3.1 对得上,但老主题迁移函数有 bug |
| **P1-7** | macOS 顶栏 32px | 🟡 改对了,但 Linux/Windows 没说 |
| **P1-8** | .bak.json 3 版本循环 | 🔴 **backupConfig 删除循环是死代码**(`i=3` 时检查 bak.4.json 永远不存在) |

**8 P1:1 个真修(P1-2)+ 5 个改一半 + 2 个实施错(P1-5/P1-8)**

---

## 5. 维度 4 找的 15 个"代码跑不动"问题 (designer)

**1500 行 90% 引用不存在的文件/目录/npm 包**:
- 3 SDK 引入 (`@anthropic-ai/sdk` / `ollama` / 假设的 monaco) 实际 package.json 里没有
- `usePendingReview.ts` 引用了不存在的 composable (Vue composable 跟 Electron main 共用)
- `MemoryScorer.ts` 引用不存在的 `Memory[]` 类型 + 实际 v4.3.1 的 memory 是 SQLite 表
- `useWorkspacePanels.ts` 引用 `useEventBus` 但 useEventBus 实际在 `useEventBus.ts` 不存在
- `TopBar.vue` 的 `WorkspaceSwitcher` 组件不存在
- `CodePanel.vue` / `MemoryPanel.vue` / `ToolsPanel.vue` 不存在
- `AICollabPanel.vue` 不存在
- `ChatTab.vue` / `WorkspaceTab.vue` 不存在
- 等等 ~10+ 引用不存在

**3 个 SDK 引入**:
- `@anthropic-ai/sdk` 0 个 (package.json 没有)
- `ollama` 假设存在 (实际 v4.3.1 用 fetch 不是 SDK)
- `monaco-editor` 假设存在 (package.json 里没有)

**streamAnthropic 缺 thinking_start/end**: 只 emit `thinking_chunk` 不 emit `thinking_start` 和 `thinking_end`,UI 永远不知道什么时候开始/结束

**streamOllama content 累积非 delta**: emit 整个累积 content 而不是 delta,UI 重复显示

**vite.config.mts 重写破坏 vite-plugin-electron 集成**: v4.3.1 用 `vite-plugin-electron` 配置 main process / preload / renderer,重写会破坏

**7 个其他问题**:
1. LlmEvent 缺 protocolVersion
2. TopBar 缺中等密度模式
3. 辅助面板缺同类型去重
4. 辅助面板缺最大堆叠数
5. useLayout 缺 schema 版本
6. 引导缺国际化
7. devOnly 7 vs 实际 5

---

## 6. owner 抓的 10 项硬伤验证 (designer)

| # | owner 抓 | designer 验证 |
|---|---|---|
| 1 | LlmClient stream controller + abort | ✅ 真硬伤 |
| 2 | useLayout schema 版本兼容 | ✅ 真硬伤 |
| 3 | MemoryScorer 中英混排查询 | ✅ 真硬伤 |
| 4 | 破坏性白名单嵌套路径 | ✅ 真硬伤 |
| 5 | 辅助面板最大堆叠数 ≤ 3 | ✅ 真硬伤 |
| 6 | 顶栏 1024 中等密度模式 | ✅ 真硬伤 |
| 7 | LlmEvent protocolVersion | ✅ 真硬伤 |
| 8 | devOnly 触发方式 | ❌ **前提错**(v4.3.1 已经处理,spec 把对改错) |
| 9 | 引导国际化 | ✅ 真硬伤 |
| 10 | Week 6 onboarding 来源 | ✅ 真硬伤(来源是新加的,缺说明) |

**9/10 认可 owner 抓的**。但 owner 漏了**更严重的 10 个**:
1. LlmClient 改一半 (假 npm 包 + 假 streamAnthropic + 假 streamOllama)
2. vite.config.mts 重写破集成
3. backupConfig 删除循环死代码
4. P1-5 路由数 23 不是 17
5. 1500 行 90% 引用不存在
6. streamAnthropic 缺 thinking_start/end
7. streamOllama content 累积非 delta
8. 3 SDK 引入 (实际 package.json 没有)
9. P0-7 撤 embedding 脱离 v4.3.1 已 ship 架构
10. P0-4 3 chunk 永远空 + 1 反弹

---

## 7. 跨产品对标 (v2.1.1 涉及)

| 产品 | 学到了 | 没学到 |
|---|---|---|
| **Cursor** | 默认折叠 / Apply Reject / 静态思考 | diff preview |
| **Linear** | Cmd+K | 顶栏密度比 Linear 高 33% |
| **Vercel v0** | 静态文字 + Regenerate | 改用 SDK 违背 v4.3.1 的 raw fetch 选型 |
| **Notion** | 3 面板可堆叠 | 树形左栏 |
| **Raycast** | Cmd+K | AI 不是扩展(PiPiClaw AI 是主功能) |

---

## 8. v2.1.1 → v2.1.2 修补预算 (5 P0)

designer 给了 5 P0 必改项(v2.1.1 → v2.1.2):

### P0-2.1: **LlmClient 改回 raw fetch (不引入 SDK)**
- v4.3.1 用 `fetch()` + `ReadableStream` 不是 SDK
- 改回 raw fetch,跟 v4.3.1 架构一致
- 3 adapter (OpenAI / Anthropic / Ollama) 全部用 fetch 流式
- 删 `@anthropic-ai/sdk` / `ollama` 引用

### P0-4.1: **vite.config.mts 不重写,只补 manualChunks**
- v4.3.1 现有 vite.config.ts 是基于 `vite-plugin-electron`
- **只在现有配置上加 manualChunks**,不重写整个文件
- 验证 chunk 拆分不会破 Electron 集成

### P0-5.1: **路由表重数 (实际 23,不是 17)**
- 数 v4.3.1 实际路由(不是猜 17)
- devOnly 实际 5 个不是 7 个
- 6 redirect 表 3 个不存在,要重数

### P0-8.1: **backupConfig 删除循环修对**
- 当前 `for (let i = 3; i >= 1; i--)` 删除 bak.4.json 永远不存在 → 死代码
- 改成 `for (let i = MAX_BACKUPS; i > 1; i--)` 然后 `fs.renameSync(bak.(i-1) → bak.i)`

### P0-N.1: **不存在文件改路径**
- 1500 行代码 90% 引用不存在的文件
- 要么创建这些文件,要么改引用到实际文件
- 重点: `useEventBus.ts` / `WorkspaceSwitcher.vue` / `CodePanel.vue` 等 10+ 不存在

---

## 9. v2.1.1 ship-ready 程度评估

### 9.1 综合 6.5/10
- 6.5 = 及格线
- 5 P0 + 12 P1 修补后可到 7.5-8.0
- **不建议直接开 26 commit**

### 9.2 真实进展 vs owner 自评

| 维度 | owner 自评 | designer 评 | 校准 |
|---|---|---|---|
| 战略定位 | 9 | 8 | 8.0 |
| 信息架构 | 9 | 7.5 | 7.5 (代码 5 实施错) |
| AI 协作右栏 | 9 | 7 | 7.0 (5 状态机 实施错) |
| 4 AI 组件 | 9 | 5 | 5.0 (MemoryChip 撤 embedding 错) |
| 视觉语言 | 8 | 6 | 6.0 (字体修空气) |
| 加载动画 | 9 | 8 | 8.0 (保留 v2.0 改对) |
| 交互模式 | 9 | 7 | 7.0 (3 面板 5 实施错) |
| 主题 | 9 | 7 | 7.0 (3 套对但老迁移 bug) |
| 无障碍 | 8 | 7 | 7.0 (a11y 部分实施) |
| 性能 | 9 | 4 | 4.0 (vite 重写破集成) |
| 实施路线 | 9 | 7 | 7.0 (灰度对但代码跑不动) |
| 工程实施 | 9 | 4 | 4.0 (1500 行 90% 假代码) |
| **平均** | **8.8** | **6.4** | **6.4** |

**designer 跨过"评价"边界进入"代码 review"——查 v4.3.1 实际代码、查 npm 包、查 Vite 文档——找到 1500 行 90% 假代码**。

**owner 自评 8.5 偏高 2.0**——这是 v2.1 6.8 + v2.1.1 改进的 1.0 加成,但实际工程实施跑不起来。

---

## 10. 行动建议

### 10.1 v2.1.1 → v2.1.2 (1 周改稿)
**必改 5 P0** (designer 抓的):
1. LlmClient 改 raw fetch (不引入 SDK)
2. vite.config.mts 不重写,只补 manualChunks
3. 路由表重数 (23 不是 17)
4. backupConfig 删除循环修对
5. 不存在文件改路径

**5 P0 修完**: v2.1.1 6.5 → v2.1.2 7.5-8.0

### 10.2 v2.1.2 → 26 commit 实施 (6 周)
- Week 0 ship 视觉 (4 commit)
- Week 1-2 内部信息架构 (7 commit)
- Week 3 alpha AI 组件 (4 commit)
- Week 4 beta 动效 (4 commit)
- Week 5 rc 状态/迁移 (4 commit)
- Week 6 ship onboarding + docs + release (3 commit)

### 10.3 适不适合直接开 v2.1.1 26 commit?
**不适合**——1500 行 90% 假代码,实施中会反复返工。

### 10.4 适不适合出 v2.1.2?
**适合**——1 周改稿,5 P0 修完,出 ship-ready。

---

## 11. v2 系列最大教训

**v2.0 → v2.1 → v2.1.1 走的弯路**:
- v2.0: 战略对,信息架构错 (5.8)
- v2.1: 5 P0 方向对,工程细节缺 (7.0)
- v2.1.1: 给 1500 行代码,90% 跑不动 (6.5)

**最大教训**:
1. **方案文档跟工程实施差 2 公里** — v2.1.1 给了"看起来对"的代码,实际跑不起来
2. **owner 写代码 review 自己的代码找不到错** — 视角盲区
3. **designer agent 价值最大化在"代码 review"** — 查实际代码、查 npm 包、查 Vite 文档
4. **1500 行 90% 假代码 = 信任崩塌** — 实施手册不能信任,v2.1.1 是"看上去对"
5. **跨过"评价"边界** — designer 从"评价设计"进入"代码 review"找到真错

**未来类似方案**:
- 写方案 → designer 评设计 → 出代码 → designer 评代码 → 修 → ship
- **不能跳过"designer 评代码"环节**

---

## 12. 总结

**v2.1.1 不是失败,是"差最后一段"**。

**立得住的**: P0-1 破坏性白名单 + P1-2 呼吸光晕 + 字体修空气 + 一些 P1 样式细节 (20% 工作量)。

**没立住的**: 1500 行 90% 假代码 + vite 重写破集成 + LlmClient 改一半 + backupConfig 死代码。

**最大教训**: 方案文档跟工程实施差 2 公里。designer agent 价值在代码 review。

**下一步**: 出 v2.1.2 修 5 P0,1 周后 ship-ready 7.5-8.0。

---

## 相关文件

| 文件 | 大小 | 内容 |
|---|---|---|
| `redesign-v2-direction.md` | 9.7 KB | 方向稿 |
| `redesign-v2-spec.md` | 21.8 KB | v2.0 详细方案 |
| `redesign-v2-self-review.md` | 9.7 KB | v2.0 owner 7.0 |
| `redesign-v2-designer-review.md` | 30.3 KB | v2.0 designer 5.5 |
| `redesign-v2-final-review.md` | 13.8 KB | v2.0 综合 5.8 |
| `redesign-v2.1-spec.md` | 37.2 KB | v2.1 详细方案 |
| `redesign-v2.1-self-review.md` | 11.4 KB | v2.1 owner 7.5 |
| `redesign-v2.1-designer-review.md` | 61.0 KB | v2.1 designer 6.8 |
| `redesign-v2.1-final-review.md` | 14.7 KB | v2.1 综合 7.0 |
| **`redesign-v2.1.1-spec.md`** | **66.4 KB** | **v2.1.1 实施手册** |
| `redesign-v2.1.1-self-review.md` | 9.6 KB | v2.1.1 owner 8.5 |
| `redesign-v2.1.1-designer-review.md` | 74.2 KB | v2.1.1 designer 6.5 |
| **`redesign-v2.1.1-final-review.md`** | **本文件** | **v2.1.1 综合 6.5** |
| **v2 系列总设计资产** | **359.8 KB** | 13 份文档 |

---

**v2.1.1 不适合直接开 26 commit,需出 v2.1.2 修 5 P0 才能 ship。**

**你拍板**:
- 1️⃣ 出 v2.1.2 改 5 P0 (1 周改稿后 ship-ready)
- 2️⃣ 跳过 v2.1.2,直接按 v2.1.1 方案开 26 commit (7 P0 实施中修)
- 3️⃣ 暂停,重新评估整个 v2 路线
- 4️⃣ 改方向 (你说哪条不要 / 加 / 改)
