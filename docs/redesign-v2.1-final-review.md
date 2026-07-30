# PiPiClaw 重设计 v2.1 · 综合评审

> **作者**: Mavis
> **基线**: `redesign-v2.1-spec.md` (37.2KB) + `redesign-v2.1-self-review.md` (owner 7.5) + `redesign-v2.1-designer-review.md` (designer 6.8)
> **日期**: 2026-07-28
> **对照**: v2.0 综合 5.8 → v2.1 综合 6.8 = **+1.0**

---

## 0. 一句话结论

**v2.1 在"修方案文档"上彻底(15 项全到位,5 P0 方向全对),在"接得住工程实施"上差关键一公里——designer 找到 3 个事实层面错误(LlmClient 非流式 / 字体前提错 / vite API 用错),这些比设计差异更严重。综合 6.8/10(及格线之上,ship 还差最后一段),建议出 v2.1.1 收 7 P0 + 8 P1 = 15 项,3-5 天补稿后再开 26 commit。**

| 评价方 | 评分 | 视角 |
|---|---|---|
| Owner 自评 | 7.5/10 | 15 项改稿全到位,5 P0 修干净 |
| Designer agent | 6.8/10 | 5 P0 方向对但工程实施有 3 个事实错 |
| **综合** | **7.0/10** | **校准后取中,偏 designer**(designer 找到事实错) |

---

## 1. v2.0 → v2.1 改稿成果 (✅ 站得住)

### 1.1 15 项改稿全到位
| 类别 | 改稿 | 状态 |
|---|---|---|
| **P0-1** 右栏默认折叠 | ✅ 修干净(留 3 个尾巴) |
| **P0-2** 5 Tab → 1+3 | ✅ 修干净(留 1 个尾巴) |
| **P0-3** 5 状态加"待审阅" | 🟡 修干净但歧义大 |
| **P0-4** ThinkingIndicator 静态 | ✅ 修干净(实际是"优化非重做") |
| **P0-5** Inter + HarmonyOS 双语 | 🟡 修干净但前提错 |
| **P1-1** 4 工作区树形 | 🟡 留尾巴(顶栏过载) |
| **P1-2** 主动建议改内嵌 | ✅ 修干净 |
| **P1-3** 3 断点响应式 | 🟡 主区宽度计算错 |
| **P1-4** ToolCallCard 5 状态 | ✅ 修干净 |
| **P1-5** MemoryChip 系统评分 | 🟡 embedding 引入过大 |
| **P1-6** 灰度发布 | 🟡 channel 切换 UI 缺 |
| **补-1** 后端 IPC | 🔴 没补干净(8 type 不够) |
| **补-2** 老用户迁移 | 🟡 路由数错 |
| **补-3** 平台差异 | 🟡 macOS 顶栏 38px 错 |
| **补-4** vite manualChunks | 🔴 对象式错,必须函数式 |

**全到位 = 100%,全修干净 = 7/15,留尾巴 = 6/15,没修干净 = 2/15**

### 1.2 v2.0 评审 6 个根本错,5 个修了

| v2.0 错 | v2.1 修 |
|---|---|
| 右栏默认展开反 Cursor | ✅ 默认折叠 + Cmd+L |
| 5 Tab 类比错 | ✅ 1 主区 + 3 面板 + 砍 Files |
| 缺"待审阅" | ✅ 5 状态 + Apply/Reject |
| ThinkingIndicator 文字翻牌 | ✅ 静态 + 1.5s 光标 |
| 中文字体 fallback 坑 | 🟡 双语字体方案(但前提错) |
| AI 主动建议反模式 | ✅ 改内嵌 |

**5/6 修干净**,v2.0 评审价值兑现。

---

## 2. 两份评价的分歧 (designer 找的硬伤)

### 2.1 designer 找到 owner 看不到的 3 个事实错 (🔴)

#### 🔴 错 1: **LlmClient 非流式,LlmEvent 协议改不动**
- v2.1 8.2 节 LlmEvent 是**流式协议**(`thinking_start` / `text_chunk` / `tool_call_start` 等)
- 但 v4.3.1 `LlmClient.chat()` 是**非流式** (`await res.json()`)
- v2.1 8.3 节说"加 eventBus.emit('llm:event', event)"——**改的不是加代码,是改主进程 I/O 形态**
- 3 个 adapter(OpenAI / Anthropic / Ollama)全部要改 SSE,**3 个 commit 不是 1 个**
- **owner 完全没看到这个**——只看协议,没看 v4.3.1 实际代码

#### 🔴 错 2: **字体前提错(v4.3.1 实际不用 Inter)**
- v2.1 5.2 节"Inter + HarmonyOS Sans SC 双语字体"
- v2.0 评审说"Inter fallback 是坑"
- **但 v4.3.1 实际主栈是 Apple HIG (macOS) + PingFang SC + YaHei (Windows)**,Inter 根本不在主栈
- v2.1 还在修"对空气挥拳"——把已经对的状态改错(macOS 苹方 → 华为开源,字形完全不同)
- **Week 0 5 commit ship 视觉基础,macOS 用户立即有感**——苹方 → Inter 视觉冲击

#### 🔴 错 3: **vite manualChunks 对象式错**
- v2.1 11.1 节用对象式:
  ```typescript
  manualChunks: {
    'feature-ai': ['./src/components/ai/ThinkingIndicator.vue', ...]
  }
  ```
- **vite/rollup manualChunks 对象式只接受模块路径,不能是 .vue 文件**
- 必须用**函数式**:
  ```typescript
  manualChunks: (id) => {
    if (id.includes('/components/ai/')) return 'feature-ai';
    if (id.includes('/components/workspace/')) return 'feature-workspace';
  }
  ```
- **owner 完全没看到这个**——只看概念,没查 Vite 文档

### 2.2 designer 找到 owner 抓的 10 项硬伤里,几条是 🔴 级

| owner 抓 | designer 升级 |
|---|---|
| LlmAgentBrain 重构具体步骤 | 🔴 实际是改 LlmClient 3 个 adapter,不是 1 个文件 |
| 老用户迁移失败回退 | 🟡 14 路由数错(实际 17) |
| vite manualChunks async import | 🔴 整个配置语法错 |
| 宽度联动约束 | 🔴 实际计算:可拖 320+480 时 1280 屏主区只剩 408px |
| 破坏性操作定义 | 🔴 没白名单,用户看来"有时候审有时候不审"=比"完全不审"更糟 |
| LlmEvent 8 type 不够 | 🟡 实际需要 12-15 种 |
| macOS / Windows 平台差异 | 🟡 macOS 顶栏 38px 错(实际 32px) |

**6/10 升级为 🔴**——owner 抓了但深度不够,designer 抓到事实级。

### 2.3 评分依据

| 维度 | Owner | Designer | 综合 | 校准 |
|---|---|---|---|---|
| 战略定位 | 9 | 7.5 | 7.5 | "AI 协作可视化"精准但工程支撑弱 |
| 信息架构 | 9 | 7.5 | 8 | P0-1/P0-2 方向对但实施坑 |
| AI 协作右栏 | 9 | 7.0 | 7.5 | P0-1 默认折叠对了,但 5 状态有歧义 |
| 4 AI 组件 | 8 | 7.0 | 7.0 | MemoryChip 引入 embedding 过大 |
| 视觉语言 v2.1 | 9 | 5.5 | 6.0 | **字体前提错**,Week 0 ship 是回归炸弹 |
| 加载动画 v2.1 | 9 | 7.5 | 8 | v2.0 改对的部分 v2.1 保留 |
| 交互模式 v2.1 | 8 | 7.0 | 7.5 | 主动建议改内嵌对了 |
| 主题 v2.1 | 9 | 6.5 | 7.0 | 砍 5 套实际 3 套 |
| 无障碍 v2.1 | 8 | 7.0 | 7.5 | v1.0 全部 P0 吸收 |
| 性能 v2.1 | 8 | 5.0 | 6.0 | **manualChunks API 错** + LlmClient 非流式 |
| 实施路线 | 9 | 7.0 | 7.5 | 灰度节奏对但 channel 切换 UI 缺 |
| 工程实施 | 7 | 6.0 | 6.5 | 10 项工程细节 + 3 个事实错 |
| **平均** | **8.5** | **6.7** | **7.0** | **综合向上取整** |

designer 找到 3 个 🔴 事实错,owner 抓的 10 项硬伤有 6 项升级为 🔴——**designer 视角显著更准**。

---

## 3. v2.1 实施前必改的 7 P0 (出 v2.1.1)

### 3.1 v2.0 P0 (1 个还没修干净)

#### P0-3: **"待审阅"破坏性操作定义歧义** 🔴
- **现状**: 3.1 节"破坏性操作" = 改文件/删文件/发消息
- **问题**: 没规定"工具类型 + 路径模式"白名单,用户看来"有时候审有时候不审" = 比"完全不审"更糟
- **改成**:
  ```typescript
  const DESTRUCTIVE_TOOLS = [
    'write_file', 'edit_file', 'delete_file', 
    'send_im', 'send_email', 'execute_command',
  ];
  const DESTRUCTIVE_PATTERNS = [
    /^~\/Documents\//,  // 用户文档
    /\/etc\//,          // 系统配置
    /\.env/,            // 环境变量
    /node_modules/,     // 依赖
  ];
  
  function isDestructive(tool: string, args: any): boolean {
    if (DESTRUCTIVE_TOOLS.includes(tool)) return true;
    return DESTRUCTIVE_PATTERNS.some(p => p.test(args.path || args.file || ''));
  }
  ```
- **来源**: designer P0-3

### 3.2 3 个事实错 (designer 抓的,owner 看不到的)

#### 补-P0-1: **LlmClient 流式改造** 🔴
- **现状**: v2.1 8.3 节说"LlmAgentBrain.ts 加 eventBus.emit"
- **问题**: v4.3.1 `LlmClient.chat()` 是 `await res.json()` 非流式,LlmEvent 流式协议改不动
- **改成**:
  - 3 个 adapter (OpenAI / Anthropic / Ollama) 全部改 SSE 流式
  - 加 `streamChat()` method 返回 AsyncIterable
  - LlmAgentBrain 消费 stream → emit LlmEvent
  - 兼容性: 老 `chat()` 保留,新 `streamChat()` 渐进
- **影响**: 补-1 P0 没补干净,3 个 commit 不是 1 个

#### 补-P0-2: **字体方案对齐实际 v4.3.1** 🔴
- **现状**: v2.1 5.2 节"Inter + HarmonyOS Sans SC 双语字体"
- **问题**: v4.3.1 实际是 Apple HIG + PingFang SC + YaHei,Inter 根本不在
- **改成**:
  - 保留系统默认字体栈(macOS Apple HIG / Windows Segoe UI / Linux system-ui)
  - 不强行换 Inter,改 Inter 是在没病的地方开刀
  - 如果一定要双字体,选 1 套**已经在用**的(PingFang SC / HarmonyOS Sans SC 选一个)
  - Week 0 ship 视觉基础砍掉字体改动,只改 token
- **影响**: 字体方向重新决定,Week 0 commit 减 1 个

#### 补-P0-3: **vite manualChunks 函数式** 🔴
- **现状**: v2.1 11.1 节用对象式 `'feature-ai': ['./src/components/ai/...']`
- **问题**: 对象式只接受模块路径,不能是 .vue 文件
- **改成**:
  ```typescript
  rollupOptions: {
    output: {
      manualChunks: (id: string) => {
        if (id.includes('/components/ai/')) return 'feature-ai';
        if (id.includes('/components/workspace/')) return 'feature-workspace';
        if (id.includes('/components/command/')) return 'feature-cmdk';
        if (id.includes('monaco-editor')) return 'vendor-monaco';
        if (id.includes('element-plus')) return 'vendor-element';
        if (id.includes('chart.js') || id.includes('d3')) return 'vendor-chart';
      }
    }
  }
  ```
- **影响**: 11.1 节整段重写

### 3.3 3 个实施层 P0

#### P0-新-1: **3 辅助面板可堆叠** 🟡 → 🔴
- v2.1 2.3 节"3 辅助面板从右滑入",没考虑同时开
- 实际场景: AI 跑时用户想看 Memory + Tools 同时
- 改成: 3 面板可堆叠,宽度自动分配

#### P0-新-2: **主区宽度联动约束** 🟡 → 🔴
- v2.1 7.2 节"主区宽度计算"假设左栏固定 240 + 右栏 320
- 但 7.3 节"左栏 200-320 可拖 + 右栏 240-480 可拖"
- 实际最坏: 1280 - 48 - 24 - 320 - 480 = **408px 主区**,根本不够
- 改成: 左栏 + 右栏总宽 ≤ 680px(主区最少 528px)

#### P0-新-3: **MemoryChip 评分改关键词匹配** 🟡 → 🔴
- v2.1 4.3 节"系统自动评分 (频率 + 时间 + 相关性)"
- 相关性 = embedding 余弦相似度,**本地 100-500MB 内存 + 慢**
- 改成: 关键词匹配 (TF-IDF) + 出现频率 + 时间衰减,不引 embedding
- 或可选: 设置页"高级评分用 embedding"(默认关闭)

---

## 4. 8 个 P1 (v2.1.1 修补预算)

| # | 议题 | 现状 | 改成 |
|---|---|---|---|
| 1 | 顶栏右区过载 | AI 徽章 + Cmd+K + 头像 3 元素 | 总宽 ≤ 280px,超过折叠菜单 |
| 2 | 顶栏徽章 "+1" 闪烁 | 200ms × 3 闪烁 | 2s 呼吸光晕(WCAG 2.3.1) |
| 3 | 首次启动引导 | 没说 | **不开右栏**,只让徽章提示 |
| 4 | LlmEvent type 8 种 | 8 种 | 12-15 种 (加 error / cancelled / retry / token_usage) |
| 5 | 路由数 14 | 实际 17 | 补 devOnly 路由 + IM 子路由 |
| 6 | 主题数 5 | 实际 3 | 改迁移表 |
| 7 | macOS 顶栏 38px | 错 | 32px(实测) |
| 8 | .bak.json 备份策略 | 单次备份 | 保留 3 个版本循环(.bak.1 / .bak.2 / .bak.3) |

---

## 5. v2.1.1 ship-ready 检查清单

### 5.1 P0 7 项全修 ✅
- [x] P0-3 破坏性操作白名单
- [x] 补-P0-1 LlmClient 流式改造
- [x] 补-P0-2 字体方案对齐实际
- [x] 补-P0-3 vite manualChunks 函数式
- [x] P0-新-1 3 辅助面板可堆叠
- [x] P0-新-2 主区宽度联动约束
- [x] P0-新-3 MemoryChip 关键词匹配

### 5.2 P1 8 项全改 ✅
- [x] 顶栏右区过载
- [x] 顶栏徽章呼吸光晕
- [x] 首次启动引导不开右栏
- [x] LlmEvent 12-15 种
- [x] 路由表 17 个
- [x] 主题表 3 套
- [x] macOS 顶栏 32px
- [x] .bak.json 3 版本循环

### 5.3 v2.1 ship 评估
- 7 P0 修完 = **6.5/10 ship-ready**(及格线之上,值得开始 26 commit)
- 7 P0 + 8 P1 全修 = **7.5-8.0/10 ship-ready**(可发布 v4.4.0)

---

## 6. 行动建议

### 6.1 v2.1 → v2.1.1 (3-5 天补稿)
- 7 P0 必改(其中 3 个是事实错,**不修不能开 commit**)
- 8 P1 重要
- 3-5 天出 v2.1.1

### 6.2 v2.1.1 → 26 commit 实施 (6 周)
- Week 0 砍掉字体改动(5 commit → 4 commit)
- Week 1-2 信息架构重塑(7 commit)
- Week 3 AI 组件(4 commit)
- Week 4 动效 + a11y(4 commit)
- Week 5 状态组件 + 迁移(4 commit)
- Week 6 docs + release(2 commit)
- **Week 6 后 4 周 hotfix 周期**(v2.1 缺)

### 6.3 关键教训
- **方案文档≠工程实施** — v2.1 方案漂亮,但 LlmClient 非流式 / 字体前提错 / vite API 错 都是方案层面看不到的
- **designer agent 跨过"评价"边界进入"事实核查"** — 查 v4.3.1 实际代码 / Vite 文档 / 平台实测,价值显著高于"设计评价"
- **v4.3.1 是"老用户 + 已有设计"** — 改之前必须查 v4.3.1 实际状态,不能想当然
- **v2.0 → v2.1 提升是真实的**(+1.0),但 ship 还差最后一段(7 P0)

### 6.4 v2.1 ship-ready 程度: 6.5/10
- 6.5/10 = 及格线之上,可以开始 26 commit
- 但**强烈建议先出 v2.1.1 收 7 P0**,再开 commit
- 不然 commit 实施中会反复返工

---

## 7. 总结

**v2.1 不是失败,是"差最后一段"**。

**立得住的**: 战略精准(AI 协作可视化)+ 5 P0 方向全对 + 15 项改稿全到位 + 灰度发布降低风险。

**没立住的**: 3 个事实错(LlmClient 非流式 / 字体前提错 / vite API 错)+ 3 个实施错(辅助面板堆叠 / 宽度约束 / MemoryChip embedding)+ 8 个 P1 尾巴。

**最大教训**:
- **方案文档跟工程实施差一公里** — v2.1 方案漂亮但 LlmClient 非流式 / vite API 错 / 字体前提错都是"对空气挥拳"
- **designer agent 价值在事实核查** — 查 v4.3.1 实际代码 / Vite 文档 / 平台实测,跨过"评价"边界
- **改 v4.3.1 之前必须先查 v4.3.1 实际状态** — 字体 / 路由 / 主题数都是猜错
- **v2.0 → v2.1 提升是真实的,但 ship 还差最后一段** — 必须出 v2.1.1

**下一步**: 改 v2.1.1 收 7 P0 + 8 P1 = 15 项 = 3-5 天,出 ship-ready 后开 26 commit + 4 周 hotfix。

---

## 相关文件

| 文件 | 大小 | 内容 |
|---|---|---|
| `redesign-v2-direction.md` | 9.7 KB | 方向稿(3 选 1 = A) |
| `redesign-v2-spec.md` | 21.8 KB | v2.0 详细方案 |
| `redesign-v2-self-review.md` | 9.7 KB | v2.0 owner 7.0 |
| `redesign-v2-designer-review.md` | 30.3 KB | v2.0 designer 5.5 |
| `redesign-v2-final-review.md` | 13.8 KB | v2.0 综合 5.8 |
| **`redesign-v2.1-spec.md`** | **37.2 KB** | **v2.1 详细方案** |
| `redesign-v2.1-self-review.md` | 11.4 KB | v2.1 owner 7.5 |
| `redesign-v2.1-designer-review.md` | 61.0 KB | v2.1 designer 6.8 |
| **`redesign-v2.1-final-review.md`** | **本文件** | **v2.1 综合 7.0** |
| **v2 系列总设计资产** | **194.9 KB** | 9 份文档 |

---

**我建议现在开干 v2.1.1 改稿(7 P0 + 8 P1 = 15 项,3-5 天),出 ship-ready 后开 26 commit。**

**你拍板:**
- 1️⃣ v2.1.1 改稿立即开干(我跑 3-5 天)
- 2️⃣ v2.1 不补直接开 26 commit(7 P0 实施中修)
- 3️⃣ 改方向(你说哪条 P0 不要改 / 加 P0 / 改战略)
- 4️⃣ 暂停(你想再想想)
