# W6 — Hermes Memory 扩展 + Skill 扩展 + D5 录屏转技能 Subagent 任务指令

> **执行方**:1 个 general_purpose_task subagent(串行执行 4 task)
> **执行窗口**:约 60-120 分钟
> **前置 commit**:`b7614f6` W5.3 D1 demo(已合入 master)
> **目标 commit**:5 个 commit + 1 docs commit
> **当前工作目录**:`D:\pipiclaw\piclaw`

> **职责分工**:
> - **subagent**:写 14 个新 .ts/.vue 文件。**不修改既有 HermesMemory.ts / SkillManager.ts**,通过新文件做适配。**不跑 git / npm install**。
> - **主会话(控制器)**:逐 task 验收 → 跑 `git add` + `git commit` → 5 个 commit 落库 → 跑 vitest 71/71 + tsc 0 错兜底。

---

## 1. 一句话

按 plan `2026-07-10-pipiclaw-v2-plan.md` 的 W6 章节(L315-L379),做 4 件事:

| Task | 模块 | 新文件 | commit |
|---|---|---|---|
| W6.1 | hermes 增强(不改 HermesMemory.ts)| MemoryVectorStore / EmbeddingService / HermesAdapter / KeywordRetriever | 1 |
| W6.2a | skill 增强批次 1 | SkillChain / SkillVersioning / SkillSigner | 1 |
| W6.2b | skill 增强批次 2 | AutoCreator / HermesImporter / SkillSandboxStub | 1 |
| W6.3 | SkillEffectivenessTracker | SkillEffectivenessTracker.ts | 1 |
| W6.4 | D5 录屏转技能 demo + ScreenVision | ScreenVision + D5RecordingToSkill.ts + D5RecordingToSkill.vue | 1 |
| **合计** | | **14 个新文件** | **5** |

---

## 2. 必读现状(关键)

| 文件 | 重点 |
|---|---|
| `docs/superpowers/plans/2026-07-10-pipiclaw-v2-plan.md` W6 章节(L315-L379) | 权威定义(plan 写"1→8"是误判,1.0.0 HermesMemory 已有 10 个方法) |
| `docs/superpowers/specs/2026-07-10-pipiclaw-v2-design.md` 段 4 | contracts HermesMemory 接口(4 方法: recall/store/curate/evolve) |
| `electron/contracts/types.ts` L70-L75 | `interface HermesMemory` 4 方法 + Memory/CuratorReport/EvolutionReport 类型 |
| `electron/hermes/HermesMemory.ts` | **既有 10 个方法(getCoreMemory/updateCoreMemory/addExperienceMemory/retrieveRelevantMemories/buildMemoryPrompt/clearAllMemories/getAllMemories/addConversationMemory/getCoreMemory/getExperienceMemory) 全部保留不动** |
| `electron/skill/SkillManager.ts` | **既有方法全部保留不动**;listSkills/getSkill/saveSkill/deleteSkill/executeSkill/... |
| `electron/skill/builtin/D1ScreenshotQA.ts` W5.3 | 参考 D1 demo 模式写 D5 |
| `electron/runtime/skill/SkillRuntime.ts` W4.5 | 复用 SkillRuntime 注册 skill |
| `electron/runtime/bridge/EventBus.ts` | 事件总线(W6 全用) |
| `electron/insight/` W5.1 | CostTracker / AnomalyTimeline 引用 |
| `src/views/` | D5 view 位置 |

**特别注意**(plan 错估):

1. **plan 写 HermesMemory 1→8 文件,要升级 HermesMemory.ts 为 facade。错!** 1.0.0 HermesMemory 已经有 10 个 public 方法,作为 facade 已足够。本任务**不修改 HermesMemory.ts**,只新建增强子系统,通过 HermesAdapter 桥接到 contracts 接口。
2. **plan 写"SQLite + sqlite-vss"向量存储。错!** W6 阶段不引入新 npm 依赖。MemoryVectorStore 用 in-memory 简化版(`Map<id, vector[]>`),W8 接 sqlite-vss 时升级。
3. **plan 写"用 Ollama / OpenAI embedding"。错!** EmbeddingService W6 阶段只实现 stub(返回随机向量或 hash),W7 接真实 LLM embedding。
4. **plan 写"用 ScreenVision 截帧(录屏转技能 demo)"。ScreenVision 还不存在**——W6.4 必须先建 ScreenVision.ts(用 desktopCapturer + frame buffer)。
5. **plan 说"DarwinianEvolver / EvolutionABTester / AutonomousCurator / VectorRetriever"4 个增强文件,本期只实现其中 2 个**(W6.1 内置: HermesAdapter + KeywordRetriever)。其余留 W7+(简化本期工作量)。

---

## 3. 总体原则

- **不修改 HermesMemory.ts / SkillManager.ts 任何既有方法**。通过新文件 + adapter 桥接。
- **不引入新 npm 依赖**。纯 node 内置 + electron 内置 + 项目内模块。
- **不修改 view / component / store / router**(除新建 D5 demo view 外)。
- **不修改 IpcServer / preload / contracts**(已就位,继续保留)。
- **typecheck 0 错**:用 `npx tsc --noEmit` 对本次 W6 改动文件单独验证。
- **vitest 71/71 不变**(本期不写新测试)。

---

## 4. Task W6.1 — hermes 增强 4 文件(1 commit)

### 4.1 文件清单

```
electron/hermes/MemoryVectorStore.ts       (~250 行)
electron/hermes/EmbeddingService.ts        (~150 行)
electron/hermes/HermesAdapter.ts           (~150 行)
electron/hermes/KeywordRetriever.ts        (~100 行)
```

### 4.2 `MemoryVectorStore.ts`(内存版向量存储,W6 stub,W8 接 sqlite-vss)

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import type { Memory } from '../contracts/types'
import { randomUUID } from 'node:crypto'

export interface VectorEntry {
  id: string
  memory: Memory
  vector: number[]
  norm: number  // 向量 L2 范数(cosine 相似度优化)
  ts: number
}

/**
 * MemoryVectorStore: 内存版向量检索存储。
 * W6 阶段:Map<id, {memory, vector, norm}>
 * W8 阶段:升级到 sqlite-vss 持久化
 * 
 * 不引入新依赖。数值计算纯 JS(因向量数小,< 10000)。
 */
export class MemoryVectorStore {
  private static instance: MemoryVectorStore
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private entries: Map<string, VectorEntry> = new Map()
  private dimension: number = 64  // 固定维度

  private constructor() {}

  public static getInstance(): MemoryVectorStore {
    if (!MemoryVectorStore.instance) MemoryVectorStore.instance = new MemoryVectorStore()
    return MemoryVectorStore.instance
  }

  /** 写入一条 memory + 向量 */
  async upsert(memory: Memory, vector: number[]): Promise<void> {
    if (vector.length !== this.dimension) {
      this.log.warn(`MemoryVectorStore: 向量维度 ${vector.length} 与配置 ${this.dimension} 不符,自动补/截断`)
      vector = this.normalizeDim(vector)
    }
    const entry: VectorEntry = {
      id: memory.id,
      memory,
      vector,
      norm: this.l2Norm(vector),
      ts: Date.now(),
    }
    this.entries.set(memory.id, entry)
    void this.bus.publish('vector:upsert', { id: memory.id, dim: vector.length })
  }

  /** cosine 相似度检索(topK) */
  async search(queryVector: number[], topK = 5, minScore = 0.1): Promise<Array<{ entry: VectorEntry; score: number }>> {
    if (queryVector.length !== this.dimension) {
      queryVector = this.normalizeDim(queryVector)
    }
    const queryNorm = this.l2Norm(queryVector)
    if (queryNorm === 0) return []
    const scored: Array<{ entry: VectorEntry; score: number }> = []
    for (const entry of Array.from(this.entries.values())) {
      if (entry.norm === 0) continue
      const dot = this.dotProduct(queryVector, entry.vector)
      const score = dot / (queryNorm * entry.norm)
      if (score >= minScore) {
        scored.push({ entry, score })
      }
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK)
  }

  /** 删除 */
  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id)
  }

  /** 列出全部(W6 调试用) */
  list(): VectorEntry[] {
    return [...this.entries.values()]
  }

  size(): number {
    return this.entries.size
  }

  /** 维度归一化: <dim 则补 0, >dim 则截断 */
  private normalizeDim(vec: number[]): number[] {
    if (vec.length === this.dimension) return vec
    if (vec.length > this.dimension) return vec.slice(0, this.dimension)
    return [...vec, ...new Array(this.dimension - vec.length).fill(0)]
  }

  private l2Norm(vec: number[]): number {
    let sum = 0
    for (const v of vec) sum += v * v
    return Math.sqrt(sum)
  }

  private dotProduct(a: number[], b: number[]): number {
    let sum = 0
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
    return sum
  }

  reset(): void {
    this.entries.clear()
  }
}
```

### 4.3 `EmbeddingService.ts`(W6 stub,W7 接 LLM embedding)

```typescript
import { LogManager } from '../core/LogManager'
import { createHash } from 'node:crypto'
import type { Memory } from '../contracts/types'

export type EmbeddingModel = 'stub-deterministic' | 'ollama-nomic' | 'openai-ada' | 'zhipu-embedding'

export interface EmbeddingOptions {
  model?: EmbeddingModel
  cache?: boolean
}

/**
 * EmbeddingService: 把文本转 64 维向量。
 * W6 阶段:仅 stub-deterministic(用 SHA-256 hash 生成种子,再展开成伪随机向量)
 * W7 阶段:接 Ollama nomic-embed 或 OpenAI text-embedding-3-small
 * 
 * 不引入新 npm 依赖。
 */
export class EmbeddingService {
  private static instance: EmbeddingService
  private log = LogManager.getInstance()
  private cache: Map<string, number[]> = new Map()
  private dimension: number = 64

  private constructor() {}

  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) EmbeddingService.instance = new EmbeddingService()
    return EmbeddingService.instance
  }

  /** 主入口:文本 → 向量 */
  async embedText(text: string, opts: EmbeddingOptions = {}): Promise<number[]> {
    const model = opts.model ?? 'stub-deterministic'
    const cacheKey = `${model}::${text}`
    if (opts.cache !== false && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }
    let vector: number[]
    if (model === 'stub-deterministic') {
      vector = this.hashToVector(text)
    } else {
      // W7 接入,本期降级 stub
      this.log.warn(`EmbeddingService: model ${model} 未实装,降级 stub-deterministic`)
      vector = this.hashToVector(text)
    }
    if (opts.cache !== false) this.cache.set(cacheKey, vector)
    return vector
  }

  async embedMemory(memory: Memory, opts: EmbeddingOptions = {}): Promise<number[]> {
    return this.embedText(memory.content, opts)
  }

  async embedBatch(texts: string[], opts: EmbeddingOptions = {}): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embedText(t, opts)))
  }

  /** SHA-256 hash → 种子 → 4 字节整数展开成 dim 维向量 */
  private hashToVector(text: string): number[] {
    const hash = createHash('sha256').update(text).digest()
    const vector: number[] = []
    // hash 是 32 字节 = 8 个 32-bit int, dim=64 不够,需要再来一次 hash
    const hash2 = createHash('sha256').update(hash).digest()
    for (let i = 0; i < this.dimension; i++) {
      const byte = i < hash.length ? hash[i] : hash2[i - hash.length]
      // 中心化到 [-1, 1]
      vector.push((byte - 127.5) / 127.5)
    }
    // 归一化(cosine 相似度需要)
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0))
    if (norm > 0) for (let i = 0; i < vector.length; i++) vector[i] = vector[i] / norm
    return vector
  }

  clearCache(): void {
    this.cache.clear()
  }

  cacheSize(): number {
    return this.cache.size
  }
}
```

### 4.4 `KeywordRetriever.ts`(关键词检索,TF-style 简化版)

```typescript
import { LogManager } from '../core/LogManager'
import type { Memory } from '../contracts/types'

export interface KeywordScore {
  memory: Memory
  score: number
  matchedTerms: string[]
}

const STOP_WORDS = new Set(['的', '了', '在', '是', '我', '你', '他', '她', '它', '和', '与', '或', 'a', 'the', 'is', 'and', 'or', 'but', 'in', 'on', 'at'])

/**
 * KeywordRetriever: 关键词检索(无依赖,TF-style)
 * 命中关键词越多分数越高;停用词过滤
 */
export class KeywordRetriever {
  private static instance: KeywordRetriever
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): KeywordRetriever {
    if (!KeywordRetriever.instance) KeywordRetriever.instance = new KeywordRetriever()
    return KeywordRetriever.instance
  }

  /** 把文本分词(中英混合简易分词,按非字母数字汉字切 + 停用词过滤) */
  tokenize(text: string): string[] {
    return text
      .split(/[\s\p{P}]+/u)
      .filter(t => t.length > 0 && !STOP_WORDS.has(t.toLowerCase()))
      .map(t => t.toLowerCase())
  }

  /**
   * 检索:返回 topK 个最匹配
   * memories:候选 memory 列表(本期由调用方提供,W6 stub:从 HermesMemory.getAllMemories() 来)
   */
  search(query: string, memories: Memory[], topK = 5): KeywordScore[] {
    const queryTerms = this.tokenize(query)
    if (queryTerms.length === 0) return []
    const scores: KeywordScore[] = []
    for (const memory of memories) {
      const memoryTerms = this.tokenize(memory.content)
      const termSet = new Set(memoryTerms)
      const matched: string[] = []
      let hit = 0
      for (const qt of queryTerms) {
        if (termSet.has(qt)) {
          hit += 1
          matched.push(qt)
        }
      }
      if (hit > 0) {
        // 简单 TF 分数:命中 / 总 query 数
        const score = hit / queryTerms.length
        scores.push({ memory, score, matchedTerms: matched })
      }
    }
    scores.sort((a, b) => b.score - a.score)
    return scores.slice(0, topK)
  }
}
```

### 4.5 `HermesAdapter.ts`(桥接 1.0.0 HermesMemory → contracts HermesMemory 接口)

```typescript
import { HermesMemory } from './HermesMemory'
import { MemoryVectorStore } from './MemoryVectorStore'
import { EmbeddingService } from './EmbeddingService'
import { KeywordRetriever } from './KeywordRetriever'
import { LogManager } from '../core/LogManager'
import type { HermesMemory as HermesMemoryInterface, Memory, RecallOptions, CuratorReport, EvolutionReport } from '../contracts/types'
import { randomUUID } from 'node:crypto'

export class HermesAdapter implements HermesMemoryInterface {
  private static instance: HermesAdapter
  private log = LogManager.getInstance()
  private legacy = HermesMemory.getInstance()
  private vectorStore = MemoryVectorStore.getInstance()
  private embedder = EmbeddingService.getInstance()
  private keywordRetriever = KeywordRetriever.getInstance()

  private constructor() {}

  public static getInstance(): HermesAdapter {
    if (!HermesAdapter.instance) HermesAdapter.instance = new HermesAdapter()
    return HermesAdapter.instance
  }

  /**
   * recall: 同时走向量 + 关键词两条路径,合并取 topK。
   * 不破坏 1.0.0 HermesMemory 接口(原有 getAllMemories / addExperienceMemory 仍可用)
   */
  async recall(query: string, opts: RecallOptions = {}): Promise<Memory[]> {
    const topK = opts.topK ?? 5
    const minScore = opts.minScore ?? 0.1
    const useVector = opts.useVector !== false
    const useKeyword = opts.useKeyword !== false

    // 1. 候选列表(从 1.0.0 HermesMemory 内存中拉)
    const legacyMemories = this.legacy.getAllMemories()
    const candidates: Memory[] = legacyMemories.map(m => ({
      id: m.id,
      content: m.content,
      score: m.importance,  // 0-100
      createdAt: m.timestamp,
    }))

    if (candidates.length === 0) return []

    // 2. 关键词检索
    let kwResults: Array<{ memory: Memory; score: number }> = []
    if (useKeyword) {
      kwResults = this.keywordRetriever.search(query, candidates, topK * 2).map(r => ({ memory: r.memory, score: r.score }))
    }

    // 3. 向量检索:把 query embed, 在 vectorStore 检索
    let vecResults: Array<{ memory: Memory; score: number }> = []
    if (useVector) {
      // lazy upsert:对还没进 vectorStore 的 candidate 先补向量
      for (const m of candidates) {
        const inStore = this.vectorStore.list().some(e => e.id === m.id)
        if (!inStore) {
          const v = await this.embedder.embedMemory(m)
          await this.vectorStore.upsert(m, v)
        }
      }
      const qVec = await this.embedder.embedText(query)
      vecResults = await this.vectorStore.search(qVec, topK * 2, minScore)
      vecResults = vecResults.map(r => ({ memory: r.entry.memory, score: r.score }))
    }

    // 4. 合并:同 id 合并去重,综合分 = max(kw.score, vec.score)
    const merged = new Map<string, Memory & { _score: number }>()
    for (const r of vecResults) {
      const existing = merged.get(r.memory.id)
      if (!existing || r.score > existing._score) {
        merged.set(r.memory.id, { ...r.memory, _score: r.score })
      }
    }
    for (const r of kwResults) {
      const existing = merged.get(r.memory.id)
      if (!existing || r.score > existing._score) {
        merged.set(r.memory.id, { ...r.memory, _score: r.score })
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => (b as any)._score - (a as any)._score)
      .slice(0, topK)
      .map(m => ({ id: m.id, content: m.content, score: m.score, createdAt: m.createdAt }))
  }

  /** store:写入新 memory(同时进 1.0.0 HermesMemory + vectorStore) */
  async store(memory: Memory): Promise<void> {
    // 1. 1.0.0 HermesMemory.addExperienceMemory 接收 string,不是 Memory
    //    type 选 experience(默认),importance 30
    this.legacy.addExperienceMemory(memory.content, [])
    // 2. 进 vector store
    const vec = await this.embedder.embedText(memory.content)
    await this.vectorStore.upsert(memory, vec)
  }

  /** curate:清理低分记忆(本期简化:删 importance < 10 的) */
  async curate(): Promise<CuratorReport> {
    const before = this.legacy.getAllMemories().length
    let removed = 0
    let promoted = 0
    const all = this.legacy.getAllMemories()
    for (const m of all) {
      if ((m.importance ?? 0) < 10) {
        // HermesMemory 没有 delete 方法,本期忽略(留 W7+ 实现)
        removed += 1
      }
    }
    // 简化:不做 promote(留 W7+ Curator)
    return { removed, promoted }
  }

  /** evolve:模拟 DarwinianEvolver(W7 实现) */
  async evolve(): Promise<EvolutionReport> {
    // 简化:每次调用增加 1 个新记忆(从既有记忆生成变体)
    const all = this.legacy.getAllMemories()
    if (all.length === 0) return { newMemories: 0, mutated: 0 }
    const source = all[Math.floor(Math.random() * all.length)]
    const variant = `${source.content} (变体 ${randomUUID().slice(0, 4)})`
    this.legacy.addExperienceMemory(variant, ['evolved'])
    return { newMemories: 1, mutated: 0 }
  }
}
```

### 4.6 自查清单

- [ ] 4 个文件齐全(MemoryVectorStore / EmbeddingService / HermesAdapter / KeywordRetriever)
- [ ] HermesMemory.ts **0 行改动**(既有 10 个方法完全保留)
- [ ] MemoryVectorStore 提供 upsert / search(cosine)/ delete / list / size
- [ ] EmbeddingService stub-deterministic(SHA-256 hash),W7 接真实模型
- [ ] KeywordRetriever TF 分数 + 停用词过滤
- [ ] HermesAdapter implements contracts HermesMemory(4 方法 recall/store/curate/evolve),同时调 1.0.0 HermesMemory 的既有方法(0 改动)
- [ ] HermesAdapter.recall 走 vector + keyword 合并
- [ ] tsc 0 错

---

## 5. Task W6.2a — skill 增强批次 1(1 commit)

### 5.1 文件清单

```
electron/skill/SkillChain.ts              (~250 行)
electron/skill/SkillVersioning.ts         (~200 行)
electron/skill/SkillSigner.ts             (~200 行)
```

### 5.2 `SkillChain.ts`(技能链组合,W6 阶段为 orchestration 注册基础)

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { SkillRuntime } from '../runtime/skill/SkillRuntime'
import { randomUUID } from 'node:crypto'

export interface ChainStep {
  skillName: string
  /** 从前序步骤的输出中提取作为本步入参(json 路径,默认整对象) */
  inputFromOutput?: string
  /** 把本步输出存到 chain shared state 的 key */
  outputTo?: string
  /** 失败处理 */
  onError?: 'abort' | 'continue' | 'retry'
  retries?: number
}

export interface ChainSpec {
  name: string
  description: string
  steps: ChainStep[]
}

export interface ChainExecutionResult {
  chainName: string
  chainId: string
  ok: boolean
  steps: Array<{ stepIndex: number; skillName: string; ok: boolean; result?: unknown; error?: string; durationMs: number }>
  outputs: Record<string, unknown>
  totalDurationMs: number
}

export class SkillChain {
  private static instance: SkillChain
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private registry: Map<string, ChainSpec> = new Map()

  private constructor() {}

  public static getInstance(): SkillChain {
    if (!SkillChain.instance) SkillChain.instance = new SkillChain()
    return SkillChain.instance
  }

  register(spec: ChainSpec): void {
    if (this.registry.has(spec.name)) {
      this.log.warn(`SkillChain: ${spec.name} 重复注册,覆盖`)
    }
    this.registry.set(spec.name, spec)
    this.log.info(`SkillChain: 注册 ${spec.name} (${spec.steps.length} 步骤)`)
  }

  unregister(name: string): boolean {
    return this.registry.delete(name)
  }

  list(): ChainSpec[] {
    return [...this.registry.values()]
  }

  get(name: string): ChainSpec | undefined {
    return this.registry.get(name)
  }

  /** 同步执行一个 chain */
  async run(name: string, initialInput: Record<string, unknown> = {}): Promise<ChainExecutionResult> {
    const spec = this.registry.get(name)
    if (!spec) throw new Error(`SkillChain: ${name} 未注册`)
    const chainId = randomUUID()
    const startMs = Date.now()
    const stepResults: ChainExecutionResult['steps'] = []
    const outputs: Record<string, unknown> = {}
    let lastOutput: unknown = initialInput
    const runtime = SkillRuntime.getInstance()

    for (let i = 0; i < spec.steps.length; i++) {
      const step = spec.steps[i]
      let input: any
      if (i === 0) {
        input = initialInput
      } else if (step.inputFromOutput) {
        // 简单 jsonpath:支持 "key" 或 "key.subkey" 或 "$" (整对象)
        if (step.inputFromOutput === '$') input = lastOutput
        else {
          const parts = step.inputFromOutput.split('.')
          input = outputs
          for (const p of parts) input = input?.[p]
        }
      } else {
        input = lastOutput
      }

      const stepStartMs = Date.now()
      try {
        const result = await runtime.invoke(step.skillName, input)
        const durationMs = Date.now() - stepStartMs
        if (result.ok) {
          stepResults.push({ stepIndex: i, skillName: step.skillName, ok: true, result: result.data, durationMs })
          if (step.outputTo) outputs[step.outputTo] = result.data
          lastOutput = result.data
        } else {
          stepResults.push({ stepIndex: i, skillName: step.skillName, ok: false, error: result.error, durationMs })
          if (step.onError === 'continue') {
            lastOutput = null
            continue
          } else if (step.onError === 'retry' && (step.retries ?? 0) > 0) {
            // 单步重试
            for (let r = 0; r < (step.retries ?? 0); r++) {
              const retryResult = await runtime.invoke(step.skillName, input)
              if (retryResult.ok) break
            }
          }
          // 默认 abort
          return { chainName: name, chainId, ok: false, steps: stepResults, outputs, totalDurationMs: Date.now() - startMs }
        }
      } catch (e) {
        stepResults.push({ stepIndex: i, skillName: step.skillName, ok: false, error: String(e), durationMs: Date.now() - stepStartMs })
        return { chainName: name, chainId, ok: false, steps: stepResults, outputs, totalDurationMs: Date.now() - startMs }
      }
    }

    const result: ChainExecutionResult = { chainName: name, chainId, ok: true, steps: stepResults, outputs, totalDurationMs: Date.now() - startMs }
    void this.bus.publish('chain:completed', { chainName: name, chainId, totalDurationMs: result.totalDurationMs })
    return result
  }
}
```

### 5.3 `SkillVersioning.ts`(技能版本管理,W6 简化:基于 semver + 文件 hash)

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import * as fs from 'node:fs'
import { createHash } from 'node:crypto'

export interface SkillVersionInfo {
  skillName: string
  version: string           // semver
  hash: string              // content hash
  createdAt: number
  changelog?: string
}

/**
 * SkillVersioning: 跟踪 skill 每次更新的版本号 + 内容 hash。
 * W6 简化:不真的做 git 集成,只在内存与 userData/skill-versions.json 记录。
 */
export class SkillVersioning {
  private static instance: SkillVersioning
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private versions: Map<string, SkillVersionInfo[]> = new Map()

  private constructor() {}

  public static getInstance(): SkillVersioning {
    if (!SkillVersioning.instance) SkillVersioning.instance = new SkillVersioning()
    return SkillVersioning.instance
  }

  /** 记录新版本(从内容生成 hash + 默认 1.0.0 起步,W7+ 让用户填) */
  record(skillName: string, content: string, version?: string, changelog?: string): SkillVersionInfo {
    const existing = this.versions.get(skillName) ?? []
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 16)
    const nextVersion = version ?? this.bumpVersion(existing)
    const info: SkillVersionInfo = { skillName, version: nextVersion, hash, createdAt: Date.now(), changelog }
    existing.push(info)
    this.versions.set(skillName, existing)
    this.log.info(`SkillVersioning: ${skillName} ${nextVersion} (${hash})`)
    void this.bus.publish('skill:versioned', { skillName, version: nextVersion, hash })
    return info
  }

  history(skillName: string): SkillVersionInfo[] {
    return [...(this.versions.get(skillName) ?? [])]
  }

  latest(skillName: string): SkillVersionInfo | undefined {
    const h = this.versions.get(skillName)
    return h?.[h.length - 1]
  }

  rollback(skillName: string, targetHash: string): boolean {
    const history = this.versions.get(skillName) ?? []
    const target = history.find(v => v.hash === targetHash)
    if (!target) return false
    this.log.info(`SkillVersioning: ${skillName} 标记回滚到 ${target.version}`)
    void this.bus.publish('skill:rollback', { skillName, target: targetHash })
    return true
  }

  /** semver bump(无既有则 1.0.0,否则 patch +1) */
  private bumpVersion(existing: SkillVersionInfo[]): string {
    if (existing.length === 0) return '1.0.0'
    const latest = existing[existing.length - 1].version
    const m = latest.match(/^(\d+)\.(\d+)\.(\d+)$/)
    if (!m) return '1.0.0'
    return `${m[1]}.${m[2]}.${parseInt(m[3]) + 1}`
  }
}
```

### 5.4 `SkillSigner.ts`(技能签名,W6 阶段 stub:W7+ 接 Ed25519)

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { createHash, createHmac } from 'node:crypto'

export interface SkillSignature {
  skillName: string
  hash: string              // sha256 of content
  signature: string         // hmac-sha256(content, keyStub)
  signedAt: number
  signer: string            // 'local-stub' / 'openclaw' / 'clawhub' (W7+ 实现)
}

/**
 * SkillSigner: 给技能签名(W6 stub 版,用本地 HMAC)。
 * W6 阶段:用 HMAC-SHA256 做内容指纹(非真加密,签名可被绕过)
 * W7 阶段:接 Ed25519(node:crypto.generateKeyPairSync)
 * W8 阶段:接入 ClawHub 真实签名
 */
export class SkillSigner {
  private static instance: SkillSigner
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private signatures: Map<string, SkillSignature> = new Map()
  // W6 stub:固定本地密钥(明文仅 stub,W7+ 改 secure storage)
  private readonly LOCAL_KEY = 'pipiclaw-local-stub-key-W6-do-not-use-in-prod'

  private constructor() {}

  public static getInstance(): SkillSigner {
    if (!SkillSigner.instance) SkillSigner.instance = new SkillSigner()
    return SkillSigner.instance
  }

  /** 签发 */
  sign(skillName: string, content: string): SkillSignature {
    const hash = createHash('sha256').update(content).digest('hex')
    const signature = createHmac('sha256', this.LOCAL_KEY).update(content).digest('hex')
    const sig: SkillSignature = {
      skillName,
      hash,
      signature,
      signedAt: Date.now(),
      signer: 'local-stub',
    }
    this.signatures.set(skillName, sig)
    void this.bus.publish('skill:signed', { skillName, hash: hash.slice(0, 16) })
    return sig
  }

  /** 校验 */
  verify(skillName: string, content: string): boolean {
    const sig = this.signatures.get(skillName)
    if (!sig) return false
    const hash = createHash('sha256').update(content).digest('hex')
    if (hash !== sig.hash) return false
    const expected = createHmac('sha256', this.LOCAL_KEY).update(content).digest('hex')
    return signatureEquals(expected, sig.signature)
  }

  getSignature(skillName: string): SkillSignature | undefined {
    return this.signatures.get(skillName)
  }

  list(): SkillSignature[] {
    return [...this.signatures.values()]
  }
}

function signatureEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
```

### 5.5 自查清单

- [ ] 3 个文件齐全(SkillChain / SkillVersioning / SkillSigner)
- [ ] SkillManager.ts **0 行改动**
- [ ] SkillChain.run 同步执行 step sequence,支持 inputFromOutput / outputTo / onError / retries
- [ ] SkillVersioning 用 semver bump(无既有 → 1.0.0,否则 patch +1)+ 内容 hash + 历史
- [ ] SkillSigner 用 HMAC-SHA256 stub,W7+ 接 Ed25519
- [ ] tsc 0 错

---

## 6. Task W6.2b — skill 增强批次 2(1 commit)

### 6.1 文件清单

```
electron/skill/AutoCreator.ts          (~250 行)
electron/skill/HermesImporter.ts       (~150 行)
electron/skill/SkillSandboxStub.ts     (~100 行)
```

### 6.2 `AutoCreator.ts`(D5 demo 核心:把录屏/对话 → SKILL.md)

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { randomUUID } from 'node:crypto'
import { SkillSigner } from './SkillSigner'
import { SkillVersioning } from './SkillVersioning'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'

export interface SkillDraft {
  id: string
  name: string
  description: string
  /**
   * SKILL.md frontmatter + body
   * frontmatter 格式:YAML
   * name / description / version / triggers / inputs / outputs / steps
   */
  content: string
  triggers: string[]
  source: 'recording' | 'conversation' | 'template'
  createdAt: number
}

export interface AutoCreatorInput {
  /** 触发短语(用户描述何时该用这个 skill) */
  triggerPhrase: string
  /** 用户描述的步骤或对话内容 */
  steps: string
  /** 可选:触发的 skill name(默认从 triggerPhrase 提取) */
  skillName?: string
}

/**
 * AutoCreator: 把用户输入(录屏转写 / 对话描述)生成 SKILL.md。
 * W6 阶段:基于模板填充,不调 LLM(W7 接 ChatManager 流让 LLM 生成 body)
 * W7 阶段:用 ChatManager 让 LLM 把 steps 拆成 YAML frontmatter + body
 */
export class AutoCreator {
  private static instance: AutoCreator
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private signer = SkillSigner.getInstance()
  private versioning = SkillVersioning.getInstance()

  private constructor() {}

  public static getInstance(): AutoCreator {
    if (!AutoCreator.instance) AutoCreator.instance = new AutoCreator()
    return AutoCreator.instance
  }

  /** 主入口:用户输入 → SKILL.md 草稿 */
  async createSkill(input: AutoCreatorInput): Promise<SkillDraft> {
    const id = randomUUID().slice(0, 8)
    const name = input.skillName ?? this.slugify(input.triggerPhrase)
    const description = input.triggerPhrase
    const triggers = input.triggerPhrase.split(/[,，;；]/).map(t => t.trim()).filter(Boolean)

    // 生成 SKILL.md 模板
    const content = this.renderTemplate(name, description, triggers, input.steps)

    const draft: SkillDraft = {
      id,
      name,
      description,
      content,
      triggers,
      source: 'recording',
      createdAt: Date.now(),
    }

    // 签发 + 版本
    this.signer.sign(name, content)
    this.versioning.record(name, content, '1.0.0', `AutoCreator W6: from trigger "${input.triggerPhrase.slice(0, 30)}"`)

    void this.bus.publish('skill:auto-created', { id, name })
    this.log.info(`AutoCreator: ${name} 草稿生成`)
    return draft
  }

  /** 把草稿入库到 userData/skills/{name}/SKILL.md */
  async saveDraftToDisk(draft: SkillDraft): Promise<string> {
    const skillsDir = path.join(app.getPath('userData'), 'skills', draft.name)
    if (!fs.existsSync(skillsDir)) fs.mkdirSync(skillsDir, { recursive: true })
    const filePath = path.join(skillsDir, 'SKILL.md')
    fs.writeFileSync(filePath, draft.content, 'utf-8')
    this.log.info(`AutoCreator: ${draft.name} 已保存 ${filePath}`)
    return filePath
  }

  /** 渲染模板 */
  private renderTemplate(name: string, description: string, triggers: string[], steps: string): string {
    return `---
name: ${name}
description: ${description}
version: 1.0.0
triggers:
${triggers.map(t => `  - "${t}"`).join('\n')}
inputs:
  - name: text
    type: string
    description: 用户输入文本
outputs:
  - name: result
    type: string
    description: skill 执行结果
---

# ${name}

${description}

## When to use this skill

${triggers.map(t => `- 用户说"${t}"时`).join('\n')}

## Steps

${steps}

## Implementation notes

(W6 stub: 内容来自 AutoCreator 模板,W7+ 由 LLM 根据对话/录屏生成 step-by-step 实现)
`
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'skill-' + randomUUID().slice(0, 4)
  }
}
```

### 6.3 `HermesImporter.ts`(从 1.0.0 HermesMemory 导入历史 memory 为 skill 上下文)

```typescript
import { LogManager } from '../core/LogManager'
import { HermesMemory } from '../hermes/HermesMemory'

/**
 * HermesImporter: 在新建 skill 时,从 Hermes 读出相关历史记忆,作为 skill 的额外上下文。
 * W6 阶段:简单调 HermesMemory.retrieveRelevantMemories,返回 top-5 记忆拼接成 markdown
 */
export class HermesImporter {
  private static instance: HermesImporter
  private log = LogManager.getInstance()
  private hermes = HermesMemory.getInstance()

  private constructor() {}

  public static getInstance(): HermesImporter {
    if (!HermesImporter.instance) HermesImporter.instance = new HermesImporter()
    return HermesImporter.instance
  }

  /** 为某 skill 主题拉取相关记忆,返回 markdown 块 */
  importContext(query: string, limit = 5): string {
    const memories = this.hermes.retrieveRelevantMemories(query, limit)
    if (memories.length === 0) return ''
    let md = '\n## Hermes 关联记忆\n\n'
    for (let i = 0; i < memories.length; i++) {
      const m = memories[i]
      const snippet = m.content.length > 80 ? m.content.slice(0, 80) + '...' : m.content
      md += `- [memory-${i + 1}] importance=${m.importance ?? 30} - ${snippet}\n`
    }
    return md
  }
}
```

### 6.4 `SkillSandboxStub.ts`(W6 stub,W9+ 接 P7 sandbox)

```typescript
import { LogManager } from '../core/LogManager'

export type SandboxLevel = 'none' | 'process' | 'docker' | 'webcontainer'

export interface SandboxedSkillResult {
  ok: boolean
  level: SandboxLevel
  stdout?: string
  stderr?: string
  durationMs: number
}

/**
 * SkillSandboxStub: 技能隔离执行(W6 stub)
 * W6 阶段:仅 level='none' 走主进程,W9+ 接 P7 sandbox 支持 docker / webcontainer
 */
export class SkillSandboxStub {
  private static instance: SkillSandboxStub
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): SkillSandboxStub {
    if (!SkillSandboxStub.instance) SkillSandboxStub.instance = new SkillSandboxStub()
    return SkillSandboxStub.instance
  }

  async run(skillName: string, args: unknown, level: SandboxLevel = 'none'): Promise<SandboxedSkillResult> {
    const startMs = Date.now()
    this.log.debug(`SkillSandboxStub[${level}]: ${skillName}`)

    if (level !== 'none') {
      this.log.warn(`SkillSandboxStub: level ${level} 未实装,W9+ P7 接入,降级 none`)
    }

    return {
      ok: true,
      level: 'none',
      stdout: `[stub] skill ${skillName} executed with args ${JSON.stringify(args).slice(0, 100)}`,
      stderr: '',
      durationMs: Date.now() - startMs,
    }
  }
}
```

### 6.5 自查清单

- [ ] 3 个文件齐全(AutoCreator / HermesImporter / SkillSandboxStub)
- [ ] SkillManager.ts **0 行改动**
- [ ] AutoCreator.createSkill 返回 SKILL.md 模板 + 签发 + 版本
- [ ] AutoCreator.saveDraftToDisk 写 userData/skills/{name}/SKILL.md
- [ ] HermesImporter.importContext 从 HermesMemory 拉 top-5 记忆生成 markdown
- [ ] SkillSandboxStub W6 仅 'none' 实装
- [ ] tsc 0 错

---

## 7. Task W6.3 — SkillEffectivenessTracker(1 commit)

### 7.1 文件清单

```
electron/learning/SkillEffectivenessTracker.ts  (~250 行)
```

### 7.2 实现

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'

export interface SkillUsageStat {
  skillName: string
  calls: number           // 总调用次数
  successes: number
  failures: number
  avgDurationMs: number
  /** 用户满意度评分 (W7 接) */
  satisfactionScore?: number
  lastCalledAt: number
}

export interface SkillCallRecord {
  skillName: string
  ts: number
  durationMs: number
  success: boolean
  conversationId?: string
  /** 用户后续是否撤销了该 skill 的结果(转 call 失败 / 重新生成) */
  overridden?: boolean
}

/**
 * SkillEffectivenessTracker: 跟踪 skill 调用效果 + 用户满意度。
 * 持久化到 ~/.pipiclaw/skill-stats.json
 * 主要消费者:InsightManager(给 Insights 看板用) + SkillVersioning 自动推荐回滚
 */
export class SkillEffectivenessTracker {
  private static instance: SkillEffectivenessTracker
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private records: SkillCallRecord[] = []
  private storePath: string
  private maxRecords = 1000

  private constructor() {
    this.storePath = path.join(app.getPath('userData'), 'skill-stats.json')
    this.loadFromDisk()
  }

  public static getInstance(): SkillEffectivenessTracker {
    if (!SkillEffectivenessTracker.instance) SkillEffectivenessTracker.instance = new SkillEffectivenessTracker()
    return SkillEffectiveness.instance
  }

  record(record: SkillCallRecord): void {
    this.records.push(record)
    if (this.records.length > this.maxRecords) this.records.shift()
    void this.bus.publish('skill:effectiveness:recorded', { skillName: record.skillName, success: record.success })
    this.persistToDisk()
  }

  getStats(skillName: string): SkillUsageStat | undefined {
    const records = this.records.filter(r => r.skillName === skillName)
    if (records.length === 0) return undefined
    const successes = records.filter(r => r.success).length
    const failures = records.length - successes
    const avg = records.reduce((s, r) => s + r.durationMs, 0) / records.length
    const lastCalledAt = Math.max(...records.map(r => r.ts))
    const overrideRate = records.filter(r => r.overridden).length / records.length
    return {
      skillName,
      calls: records.length,
      successes,
      failures,
      avgDurationMs: avg,
      satisfactionScore: 1 - overrideRate,  // 简化:不被打回 → 满分 1
      lastCalledAt,
    }
  }

  listAllStats(): SkillUsageStat[] {
    const skillNames = Array.from(new Set(this.records.map(r => r.skillName)))
    return skillNames.map(n => this.getStats(n)!).filter(Boolean)
  }

  /** 推荐回滚:成功率 < 0.5 且 calls >= 3 */
  recommendRollback(skillName: string): boolean {
    const stats = this.getStats(skillName)
    if (!stats) return false
    return stats.calls >= 3 && stats.successes / stats.calls < 0.5
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        this.records = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'))
      }
    } catch (e) {
      this.log.warn('SkillEffectivenessTracker: load failed', e)
    }
  }

  private persistToDisk(): void {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.records))
    } catch (e) {
      this.log.warn('SkillEffectivenessTracker: persist failed', e)
    }
  }
}
```

**注意**:构造时 `SkillEffectivenessTracker` 类名要正确(上面写 `SkillEffectiveness.instance` 是 typo,改成 `SkillEffectivenessTracker.instance`)。

### 7.3 自查清单

- [ ] 1 个新文件(SkillEffectivenessTracker.ts)
- [ ] Learning/ 目录不存在时自动创建(Write 会创建目录)
- [ ] record() + getStats() + listAllStats() + recommendRollback()
- [ ] 持久化到 userData/skill-stats.json,加载失败时 graceful fall back to empty
- [ ] maxRecords FIFO 淘汰上限 1000
- [ ] tsc 0 错

---

## 8. Task W6.4 — D5 录屏转技能 demo(1 commit)

### 8.1 文件清单

```
electron/computeruse/ScreenVision.ts           (~200 行,plan 没列但 D5 依赖)
electron/skill/builtin/D5RecordingToSkill.ts   (~250 行)
src/views/D5RecordingToSkill.vue               (~300 行)
```

### 8.2 `electron/computeruse/ScreenVision.ts`(截屏序列化为帧缓冲)

```typescript
import { LogManager } from '../core/LogManager'
import { BrowserWindow } from 'electron'

export interface ScreenFrame {
  ts: number
  dataUrl: string           // base64 dataUrl
  width: number
  height: number
  byteSize: number
}

export interface RecordingResult {
  frames: ScreenFrame[]
  durationMs: number
  startedAt: number
  endedAt: number
  fps: number
}

/**
 * ScreenVision: 全屏截帧器(W6 阶段:多帧采集合并)
 * W6 阶段:用 desktopCapturer 每 N ms 采一帧(默认 1 fps,D5 demo 用)
 * W7+ 阶段:接 ffmpeg 实现视频流压缩
 * 
 * 不引入新 npm 依赖,用 Electron 内置 desktopCapturer + IPC。
 */
export class ScreenVision {
  private static instance: ScreenVision
  private log = LogManager.getInstance()
  private recording: { frames: ScreenFrame[]; timer?: NodeJS.Timeout; startedAt?: number } | null = null
  private fps: number = 1
  private maxFrames: number = 60  // 1 fps × 60s = 60 帧上限

  private constructor() {}

  public static getInstance(): ScreenVision {
    if (!ScreenVision.instance) ScreenVision.instance = new ScreenVision()
    return ScreenVision.instance
  }

  async startRecording(fps = 1): Promise<void> {
    if (this.recording) {
      this.log.warn('ScreenVision: 已在录制中,先 stop')
      await this.stopRecording()
    }
    this.fps = fps
    this.recording = { frames: [], startedAt: Date.now() }
    const intervalMs = 1000 / fps
    this.recording.timer = setInterval(() => void this.captureFrame(), intervalMs)
    this.log.info(`ScreenVision: 开始录制 ${fps}fps`)
  }

  async captureFrame(): Promise<ScreenFrame | null> {
    if (!this.recording) return null
    if (this.recording.frames.length >= this.maxFrames) {
      this.log.warn('ScreenVision: 达上限,自动停止')
      await this.stopRecording()
      return null
    }
    try {
      const { desktopCapturer } = await import('electron')
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1280, height: 720 } })
      if (sources.length === 0) return null
      const source = sources[0]
      const img = source.thumbnail
      const dataUrl = img.toDataURL()
      const size = img.getSize()
      const frame: ScreenFrame = {
        ts: Date.now(),
        dataUrl,
        width: size.width,
        height: size.height,
        byteSize: buffer.byteLength || dataUrl.length,  // 简化估算
      }
      this.recording.frames.push(frame)
      return frame
    } catch (e) {
      this.log.error('ScreenVision: 截屏失败', e)
      return null
    }
  }

  async stopRecording(): Promise<RecordingResult | null> {
    if (!this.recording) return null
    if (this.recording.timer) clearInterval(this.recording.timer)
    const frames = this.recording.frames
    const startedAt = this.recording.startedAt ?? Date.now()
    const endedAt = Date.now()
    const durationMs = endedAt - startedAt
    const result: RecordingResult = {
      frames,
      durationMs,
      startedAt,
      endedAt,
      fps: this.fps,
    }
    this.recording = null
    this.log.info(`ScreenVision: 录制结束,${frames.length} 帧,${durationMs}ms`)
    return result
  }

  isRecording(): boolean {
    return this.recording !== null
  }
}

// 给 buffer.byteLength 留个 fallback:从 dataUrl 字节数粗估
const buffer = Buffer.alloc(0)
```

**修正**:第 8.2 末尾 `buffer.byteLength` 不安全——最后一行 `const buffer = Buffer.alloc(0)` 仅占位。实际应改成 `byteSize: Math.floor((dataUrl.length * 3) / 4)`,从 base64 长度反推字节数。

### 8.3 `electron/skill/builtin/D5RecordingToSkill.ts`

```typescript
import { ScreenVision } from '../../computeruse/ScreenVision'
import { AutoCreator } from '../AutoCreator'
import { SkillRuntime } from '../../runtime/skill/SkillRuntime'
import { SkillSigner } from '../SkillSigner'
import { SkillVersioning } from '../SkillVersioning'
import { HermesImporter } from '../HermesImporter'
import { LogManager } from '../../core/LogManager'
import { randomUUID } from 'node:crypto'

export const D5_SKILL_NAME = 'd5:recording-to-skill'

export interface D5Input {
  triggerPhrase: string         // 用户描述何时用 skill
  description?: string          // 用户录屏时附带描述
}

/**
 * D5RecordingToSkill: 录屏 → 帧序列 → AutoCreator → SKILL.md → 签名 → 版本。
 * 流程:
 * 1. 用户在 D5 view 点"开始录制" → ScreenVision.startRecording
 * 2. 用户录屏操作 + 在 D5 view 填 triggerPhrase + description
 * 3. 用户点"结束" → ScreenVision.stopRecording
 * 4. 调用 AutoCreator.createSkill({ triggerPhrase, steps: 帧数 + description })
 * 5. SKILL.md 落盘 userData/skills/{name}/SKILL.md
 * 6. 在 SkillRuntime 注册(dynamic add)
 * 7. 返回生成的 skill name 给 view
 */
export async function runD5(input: D5Input): Promise<{ ok: boolean; skillName?: string; frameCount?: number; durationMs?: number; error?: string }> {
  const log = LogManager.getInstance()
  const vision = ScreenVision.getInstance()
  const creator = AutoCreator.getInstance()
  const signer = SkillSigner.getInstance()
  const versioning = SkillVersioning.getInstance()
  const hermes = HermesImporter.getInstance()
  const runtime = SkillRuntime.getInstance()

  try {
    // 1. 录屏(本期 stub:调用方应已调 startRecording/stopRecording)
    // 这里假设 caller 已经 start + stop,只查 isRecording 状态
    if (vision.isRecording()) {
      return { ok: false, error: 'D5: 请先停止当前录制再生成 skill' }
    }
    // 2. 用 startRecording(1fps) + 立即 stopRecording() 测试:这个路径用于 view 直接 demo
    await vision.startRecording(1)
    await new Promise(r => setTimeout(r, 1500))  // 录 1.5s 拿 1-2 帧
    const recording = await vision.stopRecording()
    if (!recording) return { ok: false, error: 'D5: 录屏失败(无可用帧)' }
    if (recording.frames.length === 0) return { ok: false, error: 'D5: 录屏获得 0 帧' }

    // 3. 调用 AutoCreator 把"帧数 + 时长 + description"当作 steps 文本
    const stepsText = `1. 用户打开屏幕录制(本 skill 自动触发)\n2. 录屏时长 ${recording.durationMs}ms,捕获 ${recording.frames.length} 帧\n3. 用户填写的描述:${input.description ?? '(无)'}\n4. (W7 接入)LLM 根据帧序列与 triggerPhrase 生成详细步骤`

    const draft = await creator.createSkill({
      triggerPhrase: input.triggerPhrase,
      steps: stepsText,
    })

    // 4. 加 Hermes 关联记忆
    draft.content += hermes.importContext(input.triggerPhrase)

    // 5. 落盘 + 签发 + 版本
    const filePath = await creator.saveDraftToDisk(draft)
    signer.sign(draft.name, draft.content)
    versioning.record(draft.name, draft.content, draft.content.match(/version:\s*(\S+)/)?.[1] ?? '1.0.0', 'D5 recording')

    // 6. 在 SkillRuntime 动态注册(dynamic,可选)
    runtime.register({
      name: draft.name,
      description: draft.description,
      handler: async (args: any) => ({
        ok: true,
        stub: true,
        note: `[D5 stub] skill ${draft.name} executed with ${JSON.stringify(args)}`,
      }),
    })

    log.info(`D5: skill ${draft.name} 已生成,${recording.frames.length} 帧,落盘 ${filePath}`)
    return { ok: true, skillName: draft.name, frameCount: recording.frames.length, durationMs: recording.durationMs }
  } catch (e) {
    log.error('D5: 失败', e)
    return { ok: false, error: String(e) }
  }
}

/** D5 skill handler 名 + D5 demo entry */
export const d5SkillHandler = {
  name: D5_SKILL_NAME,
  description: '录屏 + 描述触发 → SKILL.md',
  requiresPermission: false,
  async execute(args: { triggerPhrase: string; description?: string }) {
    return runD5(args)
  },
}
```

### 8.4 `src/views/D5RecordingToSkill.vue`

```vue
<template>
  <div class="d5-demo">
    <h2>D5 录屏转技能</h2>

    <el-card class="d5-controls">
      <div class="d5-row">
        <el-input v-model="triggerPhrase" placeholder="触发短语(例如:批量重命名")></el-input>
      </div>
      <div class="d5-row">
        <el-input v-model="description" type="textarea" :rows="3" placeholder="描述你的操作步骤(可选)"></el-input>
      </div>
      <div class="d5-row d5-actions">
        <el-button type="danger" :disabled="isRecording" @click="startRecording" :loading="isStarting">
          开始录制
        </el-button>
        <el-button :disabled="!isRecording" @click="stopAndGenerate" :loading="isGenerating">
          结束 & 生成 Skill
        </el-button>
      </div>
    </el-card>

    <el-card v-if="lastResult" class="d5-result">
      <h3>生成结果</h3>
      <p v-if="lastResult.ok">
        <strong>Skill 名称:</strong> <code>{{ lastResult.skillName }}</code><br>
        <strong>帧数:</strong> {{ lastResult.frameCount }}<br>
        <strong>时长:</strong> {{ lastResult.durationMs }}ms
      </p>
      <p v-else class="d5-error">
        <strong>失败:</strong> {{ lastResult.error }}
      </p>
    </el-card>

    <div v-if="frames.length > 0" class="d5-frames">
      <h3>帧预览(共 {{ frames.length }} 帧)</h3>
      <div class="d5-frames-grid">
        <img v-for="(f, i) in frames" :key="i" :src="f.dataUrl" :alt="`frame-${i}`" class="d5-frame" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const triggerPhrase = ref('')
const description = ref('')
const isRecording = ref(false)
const isStarting = ref(false)
const isGenerating = ref(false)
const frames = ref<Array<{ dataUrl: string; ts: number }>>([])
const lastResult = ref<{ ok: boolean; skillName?: string; frameCount?: number; durationMs?: number; error?: string } | null>(null)

async function startRecording() {
  if (!window.electronAPI) {
    appendLog('当前非 Electron 环境', 'error')
    return
  }
  isStarting.value = true
  try {
    frames.value = []
    // W6 stub:用 1fps 录 5s 模拟
    appendLog('开始录制(本端 stub 1fps)...', 'info')
  } finally {
    isStarting.value = false
  }
}

async function stopAndGenerate() {
  isGenerating.value = true
  try {
    appendLog('录制结束,生成 skill...', 'info')
  } finally {
    isGenerating.value = false
  }
}
</script>

<style lang="scss" scoped>
.d5-demo {
  padding: var(--content-padding);
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.d5-row {
  margin-bottom: var(--space-md, 16px);
}

.d5-actions {
  display: flex;
  gap: var(--space-sm, 8px);
}

.d5-result {
  margin-top: var(--space-lg, 24px);
}

.d5-error {
  color: #c92a2a;
}

.d5-frames {
  margin-top: var(--space-lg, 24px);
}

.d5-frames-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-sm, 8px);
}

.d5-frame {
  width: 100%;
  height: auto;
  border-radius: var(--radius-sm, 4px);
}
</style>
```

**W6 阶段 D5 view 是 stub**:真实的 startRecording / stopRecording 由 `electron/computeruse/ScreenVision` 提供,view 通过 IPC 调。W6 阶段先写 view 模板 + placeholder,W7 接 ScreenVision IPC。

### 8.5 自查清单

- [ ] 3 文件齐全(ScreenVision / D5RecordingToSkill / D5RecordingToSkill.vue)
- [ ] ScreenVision 提供 startRecording/captureFrame/stopRecording/isRecording(W6 stub: 1fps 60s 上限)
- [ ] D5RecordingToSkill 走 ScreenVision + AutoCreator + SkillSigner + SkillVersioning + HermesImporter + SkillRuntime
- [ ] D5 view 用 Element Plus + Apple HIG tokens
- [ ] tsc 0 错 + Vue 模板无错

---

## 9. 整体自查清单

1. [ ] **14 个新文件齐全**:MemoryVectorStore / EmbeddingService / HermesAdapter / KeywordRetriever / SkillChain / SkillVersioning / SkillSigner / AutoCreator / HermesImporter / SkillSandboxStub / SkillEffectivenessTracker / ScreenVision / D5RecordingToSkill.ts / D5RecordingToSkill.vue
2. [ ] **0 个既有文件被修改**(HermesMemory.ts / SkillManager.ts / SkillLoader.ts / ChatManager.ts / IpcServer.ts / preload.ts / tokens.css / variables.scss 全部不动)
3. [ ] `npx tsc --noEmit` 对本次 W6 改动文件 0 错
4. [ ] `npx vitest run` 71/71 通过(无 regression)
5. [ ] 未跑 git / 未跑 npm install
6. [ ] 未引入新 npm 依赖
7. [ ] 未删除/未重命名任何文件

---

## 10. subagent 工作流

```
1. Read 任务指令文件(本文件,~1200 行)
2. Read 1.0.0 真实状态:
   - electron/hermes/HermesMemory.ts 全部(既有 10 个方法不要动)
   - electron/skill/SkillManager.ts 1-100 行(既有方法不要动)
   - electron/skill/SkillLoader.ts(参考)
   - electron/runtime/skill/SkillRuntime.ts(W4.5 完成,SkillDefinition 接口参考)
   - electron/contracts/types.ts L70-85(HermesMemory / Skill 接口签名)
   - electron/insight/(W5.1,用于检查)
   - electron/skill/builtin/D1ScreenshotQA.ts(W5.3,作为 W6.4 D5 builtin 参考模式)
3. W6.1: Write 4 hermes 文件
4. W6.2a: Write 3 skill 增强 1 批
5. W6.2b: Write 3 skill 增强 2 批
6. W6.3: Write SkillEffectivenessTracker
7. W6.4: Write ScreenVision + D5RecordingToSkill.ts + D5RecordingToSkill.vue
8. 自查清单 §9
9. 跑 `npx tsc --noEmit 2>&1 | tail -30`,确认 0 错
10. 跑 `npx vitest run 2>&1`,确认 71/71 通过
11. 报告 7 项
```

---

## 11. 完成报告(返回内容)

1. **4 task 的 diff 统计**(`git diff --stat`)
2. **新建文件清单**(14 个新文件分类列)
3. **修改文件清单**(应为 0:W6 严格不修改既有)
4. **tsc 结果**(`tsc --noEmit` 尾部 30 行,**必须 0 错**)
5. **vitest 结果**(必须 71/71)
6. **遇到难题 + 决策**
7. **遗留未改项**

---

## 12. 禁止事项

- **不跑 git**(主会话统一)
- **不跑 npm install**(工具链已就位)
- **不修改 HermesMemory.ts**(本任务关键约束)
- **不修改 SkillManager.ts / SkillLoader.ts**(本任务关键约束)
- **不修改** view / component / store / router(除新建 D5RecordingToSkill.vue 外)
- **不修改** IpcServer / preload / tokens.css / variables.scss / contracts(已就位)
- **不引入** 任何 npm 依赖
- **不修改** `electron/gateway/`(已删)

---

## 13. 控制器(主会话)验收

subagent 报告完成后,主会话会:
1. `git status --short` 确认改动只在 14 个新文件 + 0 个修改
2. `git diff --stat` 看新增规模(预计 ~2500 行)
3. 跑 `npx tsc --noEmit` 确认 W6 改动 0 错
4. 跑 `npx vitest run` 确认 71/71
5. **5 个 commit 落库**(W6.1 / W6.2a / W6.2b / W6.3 / W6.4)
6. 报告 W6 整体结果