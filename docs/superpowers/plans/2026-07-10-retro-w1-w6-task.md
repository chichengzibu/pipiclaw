# W1-W6 累积成果复盘 — Subagent 任务指令

> **执行方**:1 个 general_purpose_task subagent
> **执行窗口**:约 30-60 分钟(纯审计,不改代码)
> **前置 commit**:`d81d83b` W6 D5 demo(已合入 master)
> **当前工作目录**:`D:\pipiclaw\piclaw`
> **node_modules**:已就位

> **职责分工**:
> - **subagent**:纯审计 / 复盘,只读不写。**不修改任何文件 / 不跑 git / 不跑 npm install**。
> - **主会话(控制器)**:把复盘报告整理成"可发布文档",放在 `docs/superpowers/retros/` 目录。

---

## 1. 一句话

对 PiPiClaw v2 计划执行 W1-W6(42 个 commit,69 个新文件)的**累积成果**做全面复盘。覆盖 4 个维度:

1. **架构一致性**(8 能力域骨架 + runtime 5 子系统 + agent 域 18 文件等是否真接通)
2. **代码质量**(命名规范 / 类型完备性 / 单例模式 / 错误处理 / 测试覆盖)
3. **依赖状态**(git status / package.json / 预存 typecheck 错误 / 预存 runtime 风险)
4. **预存问题清单**(W7+ 必须修复 vs 可延后 vs 不必修)

---

## 2. 必读现状

| 文件 / 目录 | 重点 |
|---|---|
| `docs/superpowers/plans/2026-07-10-pipiclaw-v2-plan.md` | 12 周实施计划(W1-W6 已完成,W7-W12 待办) |
| `docs/superpowers/specs/2026-07-10-pipiclaw-v2-design.md` 段 4 | 8 能力域蓝图 + 关键接口签名 |
| `docs/superpowers/plans/2026-07-10-w2.2-subagent-task.md` 等 6 个 W 任务指令 | 每个 W 的偏差记录 |
| `git log --oneline` | 42 个 commit 链 |
| `electron/` 全部 .ts 文件(约 100 个)| 实际代码状态 |
| `src/views/` 12 个 view | 前端视图 |
| `tests/unit/` | vitest 71/71 |

---

## 3. 总体原则

- **纯审计**。不改任何代码。
- **不跑 git / npm install / build**。
- **可跑**:`npx vitest run`(确认 71/71 仍过)、`npx tsc --noEmit`(列出预存错误数)、`git log --oneline`、`git status --short`、文件 Read/Glob/Grep。
- **可不动**:`package.json`(`cat` 看一下当前 dependencies,不要改)。
- 返回**结构化报告**(markdown 文本),分 4 个章节 + 总结。

---

## 4. 复盘维度 1:架构一致性

### 4.1 能力域接通检查

读 `electron/contracts/CapabilityRegistry.ts` + 6 个 W3.1 域根目录的 `index.ts`,确认:

- [ ] **10 Domain 类型**(chat / memory / agent / skill / permission / task / openclaw / connector / computeruse / sandbox / insight / contentgen / browser / hermes)在 contracts 中定义
- [ ] **CapabilityRegistry.register** 实际被调用次数(grep `CapabilityRegistry.getInstance().register`)
- [ ] 哪些域**实际 registered**(main.ts 或 boot 流程)
- [ ] 哪些域**只是骨架**(W3.1 的 index.ts 声明但 W5+ 还没真正实现 register)

### 4.2 Runtime 5 子系统接通检查

读 `electron/runtime/` 5 个目录,确认:

- [ ] **actor** (Actor + MessageQueue + ActorRegistry) — 有谁真的注册过 actor?(grep `ActorRegistry.getInstance().register`)
- [ ] **bridge** (EventBus + IpcBridge + HttpBridge) — 有谁真的 subscribe / publish 过?(grep `EventBus.getInstance().subscribe` + `.publish`)
- [ ] **conversation** (State + Transition + Conversation) — 有谁真的创建过 Conversation 实例?(grep `new Conversation`)
- [ ] **scheduler** (PriorityQueue + TaskQueue + Scheduler) — 有谁真的 `new Scheduler` 过?(grep `new Scheduler`)
- [ ] **skill runtime** (Context + Invocation + SkillRuntime) — 有谁真的 register 过 skill?(grep `SkillRuntime.getInstance().register`)

### 4.3 ChatManager 接入点检查

读 `electron/chat/ChatManager.ts` 906-963 行(W4.6 新增方法)+ W5 agent 域的 AgentBrain:

- [ ] W5.2.2 AgentBrain 是否实现了 contracts AgentBrain 接口的 5 方法?
- [ ] AgentBrainImpl 是否有公开方法供 ChatManager.registerAgent 调用?
- [ ] ChatManager 的 _emitStreamChunk 是否有任何调用方?
- [ ] ChatManager 的 streamHandlers 是否有任何订阅方?

### 4.4 IPC namespace 接通检查

读 `electron/core/IpcServer.ts` 1569-1718 行(W3.3 新增 handler)+ `electron/preload.ts` IpcChannels + electronAPI:

- [ ] W3.3 新增的 13 个 `ipcMain.handle` 是否有任何渲染端调用方?(grep `electronAPI.agent` / `.channel` / `.sandbox` / `.insight`)
- [ ] `runtime:ipc-bridge` channel(W4.2 IpcBridge)是否在 IpcServer 注册?(注意 W4.2 没改 IpcServer,可能漏掉)

### 4.5 域间契约一致性

读 `electron/contracts/types.ts`:

- [ ] 7 个域入口接口(AgentBrain / HermesMemory / Skill / Channel / Sandbox / Connector / TraceCollector)签名 vs 1.0.0 真实实现
- [ ] `HermesAdapter`(W6.1)implements `HermesMemory` 接口,但 `HermesMemory` 接口 4 方法签名 vs HermesAdapter 实际签名是否完全一致?
- [ ] W5.2.2 AgentBrain 5 方法 vs contracts AgentBrain 接口签名
- [ ] W5.3 D1 view 用的 stream 接口 vs ChatManager W4.6 暴露的 StreamChunk 类型

### 4.6 Demo 接通状态

读 W5/W6 的 demo 代码:

- [ ] **D1 截屏问答**: `globalShortcut.register('CommandOrControl+Shift+S', ...)` 实际在 main.ts 启动时注册了吗?(grep `registerD1ScreenshotShortcut`)
- [ ] **D5 录屏转技能**: `D5RecordingToSkill` 是否被 main.ts 注册?(grep `D5RecordingToSkill` 或 `d5:recording-to-skill`)
- [ ] 渲染端 view 注册到 router 了吗?(grep `D1ScreenshotDemo\|D5RecordingToSkill` in `src/router/` 或 `src/App.vue`)

---

## 5. 复盘维度 2:代码质量

### 5.1 命名规范一致性

- [ ] 单例类:用 `getInstance()`(全部?还是有的用 static method 直接调?)
- [ ] Domain 命名:`AgentBrain` vs `AgentBrainImpl`(Duck-typed bridge helper 模式)
- [ ] 文件命名:`PascalCase.ts`(electron)vs `camelCase.ts`(部分工具)
- [ ] 类成员:`private static instance` / `private constructor` / `public static getInstance` 三件套是否齐全

### 5.2 TypeScript 类型完备性

- [ ] 找出所有 `any` 用法(grep `: any` in `electron/`)
- [ ] 找出所有 `as unknown as X` cast(W4 / W5 用了很多)
- [ ] 找出所有 `@ts-ignore` / `@ts-expect-error`(应当为零)
- [ ] 找出所有 `as any`(应当为零)

### 5.3 错误处理一致性

- [ ] try/catch 模式:catch block 是 `String(e)` 还是 `error.message`?
- [ ] 错误日志:用 `this.log.error('msg', error)` 还是 `console.error('msg', error)`?
- [ ] 失败容错:很多子系统用 `if (!result.ok) return early` 还是 `throw`?

### 5.4 测试覆盖

- [ ] 列出当前所有 unit test(`tests/unit/` 下所有文件 + test 数量)
- [ ] 71/71 仍然通过?(`npx vitest run` 验证)
- [ ] 哪些关键模块**完全没有 unit test**?(特别是 SkillChain / HermesAdapter / CostTracker / AgentBrain 等)
- [ ] 给出"应该但还没写"的 test 优先级清单

### 5.5 资源管理

- [ ] 是否所有订阅都有 unsubscribe?
- [ ] 是否所有 setInterval 都有 clearInterval?
- [ ] 是否所有 fs.WriteFile 都有 error try/catch?

---

## 6. 复盘维度 3:依赖状态

### 6.1 Git 状态

跑:
```
git status --short
git log --oneline | wc -l
git log --oneline --since="2026-07-10"  # 最近 commit
```

报告:working tree 干净?commit 总数?最后 commit 时间?

### 6.2 package.json

读 `package.json`:
- [ ] 当前 dependencies 列表(W1 没引入新依赖,但要看现状)
- [ ] 当前 devDependencies(`vitest` 已加,其他?)
- [ ] scripts:`test` / `build:win` / `typecheck` / `lint`(如有)
- [ ] engines 字段

### 6.3 typecheck 状态

跑 `npx tsc --noEmit 2>&1 | tail -50`:
- [ ] 总错误数
- [ ] 列出 1.0.0 预存错误(W3 之前的基线)
- [ ] W1-W6 引入的新错误(应为 0)
- [ ] vue-tsc 状态(是否仍不可用,原因)

### 6.4 runtime 风险

- [ ] 是否所有 W5/W6 新代码在**主进程 vs 渲染进程**分布合理?
- [ ] 是否有新文件 import 了 `electron` 但应在渲染进程跑?(应当错)
- [ ] 是否有新文件引用了浏览器端 API(`window.localStorage`)但在主进程跑?(应当错)

### 6.5 持久化数据位置

列出所有 `app.getPath('userData')` 用法 + 各自文件名:

- CostTracker: `cost-log.json`
- AgentCheckpoint: `checkpoints/{id}.json`
- SkillEffectivenessTracker: `skill-stats.json`
- HermesMemory: `hermes-memory/USER.md` + `MEMORY.md`
- SkillManager: `skills/`
- AutoCreator: `skills/{name}/SKILL.md`

是否冲突?是否需要 namespace 化?

---

## 7. 复盘维度 4:预存问题清单

### 7.1 阻塞 W7+ 的问题(必修)

| 问题 | 影响 | 修复优先级 |
|---|---|---|
| (例: HermesMemory interface gap) | AgentBrain.real 调用 .recall() 时无实现 | 高 |

请**自行找出 5-10 条**,列出:

- 问题描述
- 影响哪个 W7+ 任务
- 修复成本(行数 / 文件数)

### 7.2 可延后的问题

| 问题 | 触发条件 |
|---|---|
| (例: sqlite-vss 未接入,向量存储在内存) | W8+ 当 memory > 10000 时 |

请找出 5-8 条非阻塞性改进。

### 7.3 不必修的问题

- 装饰性渐变 / 字号档位不足 / 已废弃的 Electron API 警告
- 已知的第三方库 deprecation 警告

请找出 3-5 条。

### 7.4 风险评分

- 当前架构能否支撑 W7-W12 的 4 个 Channel + 9 个 Content + 6 个 Connector?
- 预存 70+ 条 tsc 错误中,是否有关键路径会阻塞 main.ts 启动?
- 给出 **0-10 分** 的"可继续 W7 风险评分",并解释。

---

## 8. 总结

汇总成 1 段:
- **优势**(3-5 条)
- **劣势**(3-5 条)
- **建议**(3-5 条,具体到 W7 启动前要做的修复)

---

## 9. subagent 工作流

```
1. Read 任务指令文件(本文件,~250 行)
2. cd D:\pipiclaw\piclaw
3. 跑 git status + git log + git diff(只读)
4. Read 关键文件(每个 W 挑 1-2 个代表性文件):
   - contracts/types.ts
   - contracts/CapabilityRegistry.ts
   - W3.3 IPC 改动(IpcServer.ts 末尾 + preload.ts 末尾)
   - W4.6 ChatManager.ts 906-963
   - W5.2.2 AgentBrain.ts
   - W5.3 D1ScreenshotQA.ts + registerD1ScreenshotShortcut
   - W6.1 HermesAdapter.ts
   - W6.4 ScreenVision.ts + D5RecordingToSkill.ts
5. Grep 检查接通:
   - grep -r 'CapabilityRegistry.getInstance().register' electron/
   - grep -r 'ChatManager.registerAgent\|registerAgent(' electron/
   - grep -r 'registerD1ScreenshotShortcut\|D5RecordingToSkill' electron/ src/
   - grep -r 'window.electronAPI\?.agent\|\.channel\|\.sandbox\|\.insight' src/
6. 跑 npx vitest run 确认 71/71
7. 跑 npx tsc --noEmit 2>&1 | tail -50 统计错误数
8. Read package.json dependencies
9. 汇总成报告(下面 §10 格式)
```

---

## 10. 报告格式(返回纯文本 markdown)

```markdown
# W1-W6 累积成果复盘报告

## 维度 1:架构一致性

### 1.1 能力域接通
- 10 Domain 在 contracts 中定义: ✓ / ✗ (差哪几个)
- 实际 register 调用: N 次 / domain 名
- 只有骨架未实现: 哪些

### 1.2 Runtime 5 子系统接通
- actor: register 调用 N 次 / 列举调用方
- bridge: publish/subscribe 各 N 次
- conversation: instance 创建 N 个
- scheduler: instance 创建 N 个
- skill runtime: skill 注册 N 个

### 1.3 ChatManager 接入点
- registerAgent 是否被调用: yes/no + 调用方
- _emitStreamChunk 是否被调用: yes/no + 调用方
- streamHandlers 订阅者: N 个

### 1.4 IPC namespace 接通
- W3.3 13 handler 在 renderer 调用: N 处
- runtime:ipc-bridge 是否漏注册: yes/no

### 1.5 域间契约一致性
- HermesMemory interface gap: yes/no + 详情
- AgentBrain 5 方法签名 vs 真实: 列出差异
- StreamChunk 类型对齐: yes/no

### 1.6 Demo 接通状态
- D1 全局快捷键注册: yes/no
- D5 builtin 注册: yes/no
- D1/D5 view 在 router 注册: yes/no

## 维度 2:代码质量

### 2.1 命名规范一致性
- 单例模式: N 处 / 总数
- Bridge helper 模式: yes/no
- 文件命名一致性: yes/no

### 2.2 TypeScript 类型完备性
- `: any` 使用: N 处
- `as unknown as X` cast: N 处
- `@ts-ignore`: N 处
- `as any`: N 处

### 2.3 错误处理
- try/catch 模式: 描述
- 错误日志: 描述
- 失败容错: 描述

### 2.4 测试覆盖
- 当前 unit test: 71/71 ✓
- 完全没 test 的关键模块: 列出前 5
- 应写 test 优先级清单

### 2.5 资源管理
- 订阅泄漏风险: N 处
- 定时器清理: yes/no
- fs 写入错误处理: yes/no

## 维度 3:依赖状态

### 3.1 Git
- working tree: 干净 / dirty
- commit 总数: N
- 最近 commit: hash + 时间

### 3.2 package.json
- dependencies: 列出
- devDependencies: 列出
- scripts: 列出
- engines: 列出

### 3.3 typecheck
- 总错误数: N
- 1.0.0 预存错误: N
- W1-W6 新错误: 0 (应当)
- vue-tsc 状态: 描述

### 3.4 runtime 风险
- 主进程/渲染进程分布: 评估
- electron import 错位: N
- 浏览器 API 错位: N

### 3.5 持久化数据
- userData 文件清单: 列出 + namespace 评估

## 维度 4:预存问题清单

### 4.1 必修(阻塞 W7+)
| 问题 | 影响 | 修复成本 |
|---|---|---|
| ... | ... | ... |

### 4.2 可延后
| 问题 | 触发条件 |
|---|---|
| ... | ... |

### 4.3 不必修
- ...

### 4.4 风险评分
- W7 可继续性: X/10
- 解释: ...

## 总结

### 优势
1. ...
2. ...

### 劣势
1. ...
2. ...

### W7 启动前建议
1. ...
2. ...
```

---

## 11. 禁止事项

- **不改任何文件**(纯审计)
- **不跑 git commit**(只读 git status/log/diff/show)
- **不跑 npm install**(工具链已就位)
- **不跑 npm run build**(只读,不构建)
- **不修改 package.json**
- **不创建新文件**(除非审计必需,但要回报告说明)

---

## 12. 控制器(主会话)验收

subagent 报告完成后,主会话会:
1. 把报告保存到 `docs/superpowers/retros/2026-07-15-w1-w6-retro.md`
2. 跑一次 git commit 落库复盘文档
3. 整理成用户友好的"复盘摘要"返回给用户