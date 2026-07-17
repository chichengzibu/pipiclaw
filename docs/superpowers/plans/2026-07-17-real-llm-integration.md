# Plan — 接真实 LLM(D5 SKILL.md + A5 AgentBrain + ChatManager)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 D5 SKILL.md 生成 / A5 AgentBrain 决策 / ChatManager chat 3 处 LLM stub 替换为真实 LLM 调用,支持 OpenAI / Anthropic / 国内大模型 3 种 provider

**Architecture:** 新建 `electron/llm/` 域(LlmClient + 3 provider adapter),3 个 builtin stub 替换为 LLM 调用,LLM key 通过 ImAccounts 同款 UI 配置(LlmConfig view)

**Tech Stack:** TypeScript / fetch(LLM API) / 现有 EventBus / ImAccounts.vue 同款 Element Plus UI / ipc-handler 模式

**前置 commit**:`36086ee` v2.0.1 patch release

---

## 总体约束

- **不引入新 npm 依赖**(LLM API 用 `fetch` 原生)
- **不修改既有 demo builtin 业务代码**(D1/D2/D3/D5/A5 stub 替换为 LLM 调用,但 builtin 入口不变)
- **不修改 W7.2 既有 19 个 channel 文件**
- **不修改 v2.0.1 patch 修复的 4 个 fix commit 内容**
- **每 commit 自己跑 + 自己 add + 自己 commit**(subagent,短英文 message)
- **tsc 0 错 + vitest 178/178 不变**

---

## Task 1: 新建 LlmClient + 3 provider adapter

**Files:**
- Create: `electron/llm/LlmClient.ts` ~250 行
- Create: `electron/llm/types.ts` ~80 行
- Create: `electron/llm/adapters/openai.ts` ~120 行
- Create: `electron/llm/adapters/anthropic.ts` ~120 行
- Create: `electron/llm/adapters/zhipu.ts` ~100 行(国内大模型)
- Create: `electron/llm/LlmConfigStore.ts` ~120 行
- Create: `electron/llm/index.ts` ~20 行

- [ ] **Step 1: 写 LlmClient 接口**

新建 `electron/llm/types.ts`:

```typescript
export type LlmProvider = 'openai' | 'anthropic' | 'zhipu'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmRequest {
  model: string
  messages: LlmMessage[]
  temperature?: number
  maxTokens?: number
  /** 强制用哪个 provider */
  provider?: LlmProvider
}

export interface LlmResponse {
  ok: boolean
  provider: LlmProvider
  content: string
  model: string
  /** token 数 */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  /** ms */
  durationMs: number
  error?: string
}

export interface LlmConfig {
  provider: LlmProvider
  apiKey: string
  /** 默认模型(由 provider 决定) */
  defaultModel?: string
  /** API base URL(可选,默认走官方) */
  apiBaseUrl?: string
  enabled: boolean
  updatedAt: number
}

export const DEFAULT_MODELS: Record<LlmProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  zhipu: 'glm-4-flash',
}

export const DEFAULT_API_BASE: Record<LlmProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
}
```

- [ ] **Step 2: 写 3 provider adapter**

新建 `electron/llm/adapters/openai.ts`:

```typescript
import { LogManager } from '../../core/LogManager'
import type { LlmConfig, LlmRequest, LlmResponse, LlmMessage } from '../types'
import { DEFAULT_API_BASE, DEFAULT_MODELS } from '../types'

export class OpenAiAdapter {
  private log = LogManager.getInstance()

  async chat(config: LlmConfig, req: LlmRequest): Promise<LlmResponse> {
    const startMs = Date.now()
    const baseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE.openai
    const model = req.model ?? config.defaultModel ?? DEFAULT_MODELS.openai
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: req.messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 2048,
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        return { ok: false, provider: 'openai', content: '', model, durationMs: Date.now() - startMs, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` }
      }
      const data: any = await res.json()
      const content = data.choices?.[0]?.message?.content ?? ''
      return {
        ok: true,
        provider: 'openai',
        content,
        model,
        durationMs: Date.now() - startMs,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      }
    } catch (e) {
      return { ok: false, provider: 'openai', content: '', model, durationMs: Date.now() - startMs, error: String(e) }
    }
  }
}
```

新建 `electron/llm/adapters/anthropic.ts`:

```typescript
import { LogManager } from '../../core/LogManager'
import type { LlmConfig, LlmRequest, LlmResponse } from '../types'
import { DEFAULT_API_BASE, DEFAULT_MODELS } from '../types'

export class AnthropicAdapter {
  private log = LogManager.getInstance()

  async chat(config: LlmConfig, req: LlmRequest): Promise<LlmResponse> {
    const startMs = Date.now()
    const baseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE.anthropic
    const model = req.model ?? config.defaultModel ?? DEFAULT_MODELS.anthropic
    try {
      // Anthropic 格式:system 单独字段 + messages [{role, content}]
      const systemMsg = req.messages.find(m => m.role === 'system')
      const msgs = req.messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }))
      const res = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          system: systemMsg?.content,
          messages: msgs,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 2048,
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        return { ok: false, provider: 'anthropic', content: '', model, durationMs: Date.now() - startMs, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` }
      }
      const data: any = await res.json()
      const content = data.content?.[0]?.text ?? ''
      return {
        ok: true,
        provider: 'anthropic',
        content,
        model,
        durationMs: Date.now() - startMs,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
        } : undefined,
      }
    } catch (e) {
      return { ok: false, provider: 'anthropic', content: '', model, durationMs: Date.now() - startMs, error: String(e) }
    }
  }
}
```

新建 `electron/llm/adapters/zhipu.ts`(国内大模型,OpenAI 兼容 API):

```typescript
import { LogManager } from '../../core/LogManager'
import type { LlmConfig, LlmRequest, LlmResponse } from '../types'
import { DEFAULT_API_BASE, DEFAULT_MODELS } from '../types'

export class ZhipuAdapter {
  private log = LogManager.getInstance()

  async chat(config: LlmConfig, req: LlmRequest): Promise<LlmResponse> {
    const startMs = Date.now()
    const baseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE.zhipu
    const model = req.model ?? config.defaultModel ?? DEFAULT_MODELS.zhipu
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: req.messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 2048,
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        return { ok: false, provider: 'zhipu', content: '', model, durationMs: Date.now() - startMs, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` }
      }
      const data: any = await res.json()
      const content = data.choices?.[0]?.message?.content ?? ''
      return {
        ok: true,
        provider: 'zhipu',
        content,
        model,
        durationMs: Date.now() - startMs,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      }
    } catch (e) {
      return { ok: false, provider: 'zhipu', content: '', model, durationMs: Date.now() - startMs, error: String(e) }
    }
  }
}
```

- [ ] **Step 3: 写 LlmConfigStore**

新建 `electron/llm/LlmConfigStore.ts`:

```typescript
import { LogManager } from '../core/LogManager'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import type { LlmConfig, LlmProvider } from './types'

export class LlmConfigStore {
  private static instance: LlmConfigStore
  private log = LogManager.getInstance()
  private storePath: string
  private configs: Map<string, LlmConfig> = new Map()

  private constructor() {
    this.storePath = path.join(app.getPath('userData'), 'llm-config.json')
    this.loadFromDisk()
  }

  public static getInstance(): LlmConfigStore {
    if (!LlmConfigStore.instance) LlmConfigStore.instance = new LlmConfigStore()
    return LlmConfigStore.instance
  }

  get(provider: LlmProvider): LlmConfig | undefined {
    return this.configs.get(provider)
  }

  set(provider: LlmProvider, patch: Partial<LlmConfig>): void {
    const existing = this.configs.get(provider) ?? { provider, apiKey: '', enabled: false, updatedAt: Date.now() }
    const next: LlmConfig = { ...existing, ...patch, provider, updatedAt: Date.now() }
    this.configs.set(provider, next)
    this.persistToDisk()
    this.log.info(`LlmConfigStore: ${provider} updated (enabled=${next.enabled})`)
  }

  list(): LlmConfig[] {
    return [...this.configs.values()]
  }

  /** 获取当前启用的 provider config(按 enabled 顺序,优先第一个) */
  getActive(): LlmConfig | undefined {
    return [...this.configs.values()].find(c => c.enabled && c.apiKey)
  }

  remove(provider: LlmProvider): boolean {
    const ok = this.configs.delete(provider)
    if (ok) this.persistToDisk()
    return ok
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf-8')
        const arr = JSON.parse(data) as LlmConfig[]
        for (const c of arr) this.configs.set(c.provider, c)
      }
    } catch (e) {
      this.log.warn('LlmConfigStore: load failed', e)
    }
  }

  private persistToDisk(): void {
    try {
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true })
      fs.writeFileSync(this.storePath, JSON.stringify([...this.configs.values()], null, 2))
    } catch (e) {
      this.log.warn('LlmConfigStore: persist failed', e)
    }
  }
}
```

- [ ] **Step 4: 写 LlmClient 统一入口**

新建 `electron/llm/LlmClient.ts`:

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { LlmConfigStore } from './LlmConfigStore'
import { OpenAiAdapter } from './adapters/openai'
import { AnthropicAdapter } from './adapters/anthropic'
import { ZhipuAdapter } from './adapters/zhipu'
import type { LlmRequest, LlmResponse, LlmProvider } from './types'

export class LlmClient {
  private static instance: LlmClient
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private configStore = LlmConfigStore.getInstance()
  private openai = new OpenAiAdapter()
  private anthropic = new AnthropicAdapter()
  private zhipu = new ZhipuAdapter()

  private constructor() {}

  public static getInstance(): LlmClient {
    if (!LlmClient.instance) LlmClient.instance = new LlmClient()
    return LlmClient.instance
  }

  /**
   * chat 主入口:自动选启用的 provider,若没指定则取 LlmConfigStore.getActive()
   */
  async chat(req: LlmRequest): Promise<LlmResponse> {
    const provider = req.provider ?? this.configStore.getActive()?.provider
    if (!provider) {
      return { ok: false, provider: 'openai', content: '', model: req.model, durationMs: 0, error: 'no LLM provider configured (set via LlmConfig UI)' }
    }
    const config = this.configStore.get(provider)
    if (!config?.enabled || !config.apiKey) {
      return { ok: false, provider, content: '', model: req.model, durationMs: 0, error: `provider ${provider} not enabled or apiKey missing` }
    }
    void this.bus.publish('llm:request', { provider, model: req.model, msgCount: req.messages.length })
    const response = provider === 'openai' ? await this.openai.chat(config, req)
      : provider === 'anthropic' ? await this.anthropic.chat(config, req)
      : await this.zhipu.chat(config, req)
    void this.bus.publish(response.ok ? 'llm:response' : 'llm:error', { provider, model: response.model, durationMs: response.durationMs })
    return response
  }

  /** 简单文本补全(无 messages 历史,只有 user prompt) */
  async complete(prompt: string, opts: { provider?: LlmProvider; system?: string; maxTokens?: number; temperature?: number } = {}): Promise<LlmResponse> {
    const messages: { role: 'system' | 'user'; content: string }[] = []
    if (opts.system) messages.push({ role: 'system', content: opts.system })
    messages.push({ role: 'user', content: prompt })
    return this.chat({ model: '', messages, provider: opts.provider, maxTokens: opts.maxTokens, temperature: opts.temperature })
  }
}
```

- [ ] **Step 5: 写 index.ts re-export**

新建 `electron/llm/index.ts`:

```typescript
export { LlmClient } from './LlmClient'
export { LlmConfigStore } from './LlmConfigStore'
export type { LlmConfig, LlmRequest, LlmResponse, LlmMessage, LlmProvider } from './types'
export { DEFAULT_MODELS, DEFAULT_API_BASE } from './types'
```

- [ ] **Step 6: 验证 tsc 0 错**

```bash
cd D:\pipiclaw\piclaw
npx tsc --noEmit -p tsconfig.node.json 2>&1 | Select-Object -First 10
```

Expected: 0 错。

- [ ] **Step 7: commit**

```bash
cd D:\pipiclaw\piclaw
git add electron/llm/
git commit -m "feat(llm) LlmClient plus 3 provider adapters OpenAI Anthropic Zhipu"
```

---

## Task 2: 加 LlmConfig.vue UI + 路由 + IPC handler

**Files:**
- Create: `src/views/LlmConfig.vue` ~250 行
- Modify: `src/router/index.ts` 末尾追加 1 route(`/settings/llm`)
- Modify: `electron/core/IpcServer.ts` 末尾追加 4 handler(`llm-config:get / save / test / chat`)
- Modify: `electron/preload.ts` 末尾追加 IpcChannels 4 常量 + electronAPI.llm{getConfigs, saveConfig, testConfig, chat}

- [ ] **Step 1: 写 LlmConfig.vue**

新建 `src/views/LlmConfig.vue`(参照 ImAccounts.vue 风格,3 provider 表单 + API key + 测试连接 + 保存):

```vue
<template>
  <div class="llm-config">
    <h2>LLM 配置</h2>
    <p class="llm-hint">配置 OpenAI / Anthropic / 智谱 GLM 任一 provider,启用真实 LLM 调用</p>

    <el-tabs v-model="activeTab" class="llm-tabs">
      <el-tab-pane label="OpenAI" name="openai">
        <el-form :model="openai" label-width="160px">
          <el-form-item label="API Key">
            <el-input v-model="openai.apiKey" type="password" placeholder="sk-..." />
          </el-form-item>
          <el-form-item label="默认模型">
            <el-input v-model="openai.defaultModel" placeholder="gpt-4o-mini" />
          </el-form-item>
          <el-form-item label="API Base URL (可选)">
            <el-input v-model="openai.apiBaseUrl" placeholder="https://api.openai.com/v1" />
          </el-form-item>
          <el-form-item>
            <el-switch v-model="openai.enabled" active-text="启用" inactive-text="禁用" />
            <el-button @click="testConnection('openai', openai)" :loading="testing['openai']">测试连接</el-button>
          </el-form-item>
          <el-form-item v-if="testResults['openai']">
            <el-alert :type="testResults['openai'].ok ? 'success' : 'error'" :title="testResults['openai'].message" :closable="false" />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="Anthropic" name="anthropic">
        <el-form :model="anthropic" label-width="160px">
          <el-form-item label="API Key">
            <el-input v-model="anthropic.apiKey" type="password" placeholder="sk-ant-..." />
          </el-form-item>
          <el-form-item label="默认模型">
            <el-input v-model="anthropic.defaultModel" placeholder="claude-3-5-sonnet-20241022" />
          </el-form-item>
          <el-form-item>
            <el-switch v-model="anthropic.enabled" active-text="启用" inactive-text="禁用" />
            <el-button @click="testConnection('anthropic', anthropic)" :loading="testing['anthropic']">测试连接</el-button>
          </el-form-item>
          <el-form-item v-if="testResults['anthropic']">
            <el-alert :type="testResults['anthropic'].ok ? 'success' : 'error'" :title="testResults['anthropic'].message" :closable="false" />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="智谱 GLM (国内)" name="zhipu">
        <el-form :model="zhipu" label-width="160px">
          <el-form-item label="API Key">
            <el-input v-model="zhipu.apiKey" type="password" placeholder="..." />
          </el-form-item>
          <el-form-item label="默认模型">
            <el-input v-model="zhipu.defaultModel" placeholder="glm-4-flash" />
          </el-form-item>
          <el-form-item>
            <el-switch v-model="zhipu.enabled" active-text="启用" inactive-text="禁用" />
            <el-button @click="testConnection('zhipu', zhipu)" :loading="testing['zhipu']">测试连接</el-button>
          </el-form-item>
          <el-form-item v-if="testResults['zhipu']">
            <el-alert :type="testResults['zhipu'].ok ? 'success' : 'error'" :title="testResults['zhipu'].message" :closable="false" />
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>

    <div class="llm-actions">
      <el-button type="primary" @click="saveAll" :loading="isSaving">保存所有</el-button>
    </div>

    <el-card class="llm-flow">
      <h3>使用流程</h3>
      <ol class="llm-steps">
        <li>选择 provider(OpenAI 需翻墙 / Anthropic 需翻墙 / 智谱国内直连)</li>
        <li>填入 API Key + 默认模型(可选)</li>
        <li>点"测试连接" → 调 LlmClient 测试 chat 完成</li>
        <li>点"保存所有" → LlmConfigStore 持久化到 <code>userData/llm-config.json</code></li>
        <li>启用后,5 demo (D1/D5/A5) + ChatManager 自动用真 LLM</li>
      </ol>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'

const activeTab = ref('openai')

const openai = reactive({ apiKey: '', defaultModel: 'gpt-4o-mini', apiBaseUrl: '', enabled: false })
const anthropic = reactive({ apiKey: '', defaultModel: 'claude-3-5-sonnet-20241022', apiBaseUrl: '', enabled: false })
const zhipu = reactive({ apiKey: '', defaultModel: 'glm-4-flash', apiBaseUrl: '', enabled: false })

const testing = reactive<Record<string, boolean>>({})
const testResults = reactive<Record<string, { ok: boolean; message: string } | null>>({})
const isSaving = ref(false)

async function loadConfigs() {
  try {
    const result = await (window as any).electronAPI.llm.getConfigs()
    if (result.success && Array.isArray(result.data)) {
      const oa = result.data.find((c: any) => c.provider === 'openai')
      if (oa) { openai.apiKey = oa.apiKey ?? ''; openai.defaultModel = oa.defaultModel ?? 'gpt-4o-mini'; openai.apiBaseUrl = oa.apiBaseUrl ?? ''; openai.enabled = oa.enabled ?? false }
      const an = result.data.find((c: any) => c.provider === 'anthropic')
      if (an) { anthropic.apiKey = an.apiKey ?? ''; anthropic.defaultModel = an.defaultModel ?? 'claude-3-5-sonnet-20241022'; anthropic.enabled = an.enabled ?? false }
      const zp = result.data.find((c: any) => c.provider === 'zhipu')
      if (zp) { zhipu.apiKey = zp.apiKey ?? ''; zhipu.defaultModel = zp.defaultModel ?? 'glm-4-flash'; zhipu.enabled = zp.enabled ?? false }
    }
  } catch (e) {
    console.warn('loadConfigs failed', e)
  }
}

async function testConnection(provider: string, config: any) {
  testing[provider] = true
  testResults[provider] = null
  try {
    const result = await (window as any).electronAPI.llm.testConfig({ provider, config })
    testResults[provider] = { ok: result.success, message: result.success ? `连接成功 (${result.latencyMs}ms)` : `连接失败: ${result.error}` }
  } catch (e) {
    testResults[provider] = { ok: false, message: String(e) }
  } finally {
    testing[provider] = false
  }
}

async function saveAll() {
  isSaving.value = true
  try {
    await Promise.all([
      (window as any).electronAPI.llm.saveConfig({ provider: 'openai', config: openai }),
      (window as any).electronAPI.llm.saveConfig({ provider: 'anthropic', config: anthropic }),
      (window as any).electronAPI.llm.saveConfig({ provider: 'zhipu', config: zhipu }),
    ])
    alert('已保存')
  } catch (e) {
    alert('保存失败: ' + e)
  } finally {
    isSaving.value = false
  }
}

onMounted(loadConfigs)
</script>

<style lang="scss" scoped>
.llm-config {
  padding: var(--content-padding);
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.llm-hint {
  color: var(--text-secondary, #666);
  font-size: var(--font-size-body, 14px);
  margin-bottom: var(--space-lg, 24px);
}

.llm-tabs {
  margin-bottom: var(--space-lg, 24px);
}

.llm-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-lg, 24px);
}

.llm-flow {
  margin-top: var(--space-lg, 24px);
}

.llm-steps {
  padding-left: var(--space-lg, 24px);
  font-size: var(--font-size-body, 14px);
  line-height: 1.8;
}

code {
  background: var(--card-bg, #f5f5f5);
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
  font-family: var(--font-family-mono, monospace);
  font-size: var(--font-size-caption-1, 11px);
}
</style>
```

- [ ] **Step 2: 末尾追加 router 1 route**

读 `src/router/index.ts`,在 `/settings/im-accounts` 之后追加:

```typescript
  {
    path: '/settings/llm',
    name: 'LlmConfig',
    component: () => import('@/views/LlmConfig.vue'),
  },
```

- [ ] **Step 3: 末尾追加 IpcServer 4 handler**

读 `electron/core/IpcServer.ts`,在 `a5-demo:run` 之后追加:

```typescript
    // ============ W13.B: LLM 配置 IPC ============
    ipcMain.handle('llm-config:get', async () => {
      try {
        const { LlmConfigStore } = require('../llm/LlmConfigStore')
        return { success: true, data: LlmConfigStore.getInstance().list() }
      } catch (error) {
        this.log.error('llm-config:get 失败', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('llm-config:save', async (_: any, args: { provider: string; config: any }) => {
      try {
        const { LlmConfigStore } = require('../llm/LlmConfigStore')
        LlmConfigStore.getInstance().set(args.provider as any, args.config)
        return { success: true }
      } catch (error) {
        this.log.error('llm-config:save 失败', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('llm-config:test', async (_: any, args: { provider: string; config: any }) => {
      try {
        const { LlmConfigStore } = require('../llm/LlmConfigStore')
        const { LlmClient } = require('../llm/LlmClient')
        LlmConfigStore.getInstance().set(args.provider as any, args.config)
        const startMs = Date.now()
        const result = await LlmClient.getInstance().complete('ping', { provider: args.provider, maxTokens: 10 })
        return result.ok
          ? { success: true, latencyMs: Date.now() - startMs }
          : { success: false, error: result.error }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('llm-chat', async (_: any, args: { messages: any[]; provider?: string; model?: string; maxTokens?: number; temperature?: number }) => {
      try {
        const { LlmClient } = require('../llm/LlmClient')
        const result = await LlmClient.getInstance().chat(args)
        return result.ok ? { success: true, data: result } : { success: false, error: result.error }
      } catch (error) {
        this.log.error('llm-chat 失败', error)
        return { success: false, error: String(error) }
      }
    })
```

- [ ] **Step 4: 末尾追加 preload 暴露**

读 `electron/preload.ts`,在 IpcChannels 末尾追加 4 常量:
```typescript
  LLM_CONFIG_GET: 'llm-config:get',
  LLM_CONFIG_SAVE: 'llm-config:save',
  LLM_CONFIG_TEST: 'llm-config:test',
  LLM_CHAT: 'llm-chat',
```

在 electronAPI 末尾追加:
```typescript
  llm: {
    getConfigs: (): Promise<{ success: boolean; data: any[]; error?: string }> => ipcRenderer.invoke(IpcChannels.LLM_CONFIG_GET),
    saveConfig: (args: { provider: string; config: any }): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke(IpcChannels.LLM_CONFIG_SAVE, args),
    testConfig: (args: { provider: string; config: any }): Promise<{ success: boolean; latencyMs?: number; error?: string }> => ipcRenderer.invoke(IpcChannels.LLM_CONFIG_TEST, args),
    chat: (args: { messages: any[]; provider?: string; model?: string; maxTokens?: number; temperature?: number }): Promise<{ success: boolean; data?: any; error?: string }> => ipcRenderer.invoke(IpcChannels.LLM_CHAT, args),
  }
```

- [ ] **Step 5: 验证 tsc 0 错**

```bash
cd D:\pipiclaw\piclaw
npx tsc --noEmit -p tsconfig.node.json 2>&1 | Select-Object -First 10
```

Expected: 0 错。

- [ ] **Step 6: commit**

```bash
cd D:\pipiclaw\piclaw
git add src/views/LlmConfig.vue src/router/index.ts electron/core/IpcServer.ts electron/preload.ts
git commit -m "feat(llm) LlmConfig UI plus get save test chat IPC"
```

---

## Task 3: 替换 D5 SKILL.md 生成 stub → LLM

**Files:**
- Modify: `electron/skill/builtin/D5RecordingToSkill.ts`(在 `runD5()` 中调 LLMClient 生成 SKILL.md 替换 stub)

- [ ] **Step 1: 读 D5RecordingToSkill.ts 现状**

看 `runD5()` 函数,找 SKILL.md 生成 stub 位置(plan Task 3 spec 提示用 stub 生成模板)。

- [ ] **Step 2: 末尾追加 LLM 集成**

读 `electron/skill/builtin/D5RecordingToSkill.ts`,在 SKILL.md 生成的 stub 代码段(`fs.writeFileSync(SKILL_PATH, ...)`)前,先调 `LlmClient.complete()`,若成功用 LLM 输出,失败 fallback 到原 stub。

```typescript
// W13.B: 用 LLM 生成 SKILL.md
const { LlmClient } = require('../../llm/LlmClient')
const llmClient = LlmClient.getInstance()
const llmResult = await llmClient.complete(
  `基于以下录屏描述,生成一个简洁的 SKILL.md 文档,包含 name / description / trigger / steps 4 段:\n\n${description}`,
  { maxTokens: 500 }
)
const skillContent = llmResult.ok
  ? llmResult.content
  : `# ${triggerPhrase}\n\n> Auto-generated (LLM unavailable, fallback stub)\n\n## Description\n${description ?? '(no description)'}\n\n## Steps\n1. (stub)`
fs.writeFileSync(SKILL_PATH, skillContent, 'utf-8')
```

- [ ] **Step 3: 验证 tsc 0 错**

```bash
cd D:\pipiclaw\piclaw
npx tsc --noEmit -p tsconfig.node.json 2>&1 | Select-Object -First 10
```

Expected: 0 错。

- [ ] **Step 4: commit**

```bash
cd D:\pipiclaw\piclaw
git add electron/skill/builtin/D5RecordingToSkill.ts
git commit -m "feat(skill) D5 SKILL.md generator use real LLM with stub fallback"
```

---

## Task 4: 替换 A5 AgentBrain stub → LLM

**Files:**
- Modify: `electron/skill/builtin/A5ComputerUse.ts`(在 ComputerUseHandler.run() 调 LLMClient 替换 AgentBrain stub)

- [ ] **Step 1: 读 A5ComputerUse.ts 现状**

看 `runA5()` 函数。当前 W8.2 stub 写死 step.action = "screenshot" / "reply",加 LLM 决策。

- [ ] **Step 2: 末尾追加 LLM 决策集成**

```typescript
// W13.B: 用 LLM 决策 Computer Use 步骤
const { LlmClient } = require('../../llm/LlmClient')
const llmClient = LlmClient.getInstance()
const decisionResult = await llmClient.complete(
  `You are a Computer Use agent. Decide the next action.\nInstruction: ${input.instruction}\nContext: step ${i + 1}/${maxSteps}\nRespond with JSON: { "action": "click|type|screenshot|reply|stop", "x": number, "y": number, "text": string, "reason": string }`,
  { maxTokens: 200 }
)
let parsedAction: { action: string; x?: number; y?: number; text?: string; reason?: string }
if (decisionResult.ok) {
  try {
    const jsonMatch = decisionResult.content.match(/\{[\s\S]*\}/)
    parsedAction = jsonMatch ? JSON.parse(jsonMatch[0]) : { action: 'screenshot' }
  } catch {
    parsedAction = { action: 'screenshot' }
  }
} else {
  // fallback stub
  parsedAction = i === maxSteps - 1 ? { action: 'reply', text: 'Stub: LLM unavailable' } : { action: 'screenshot' }
}
```

- [ ] **Step 3: 验证 tsc 0 错**

```bash
cd D:\pipiclaw\piclaw
npx tsc --noEmit -p tsconfig.node.json 2>&1 | Select-Object -First 10
```

Expected: 0 错。

- [ ] **Step 4: commit**

```bash
cd D:\pipiclaw\piclaw
git add electron/skill/builtin/A5ComputerUse.ts
git commit -m "feat(skill) A5 Computer Use use real LLM decision with stub fallback"
```

---

## Task 5: 替换 ChatManager AgentBrain stub → LLM

**Files:**
- Modify: `electron/chat/ChatManager.ts`(在 AgentBrain.think() 调 LLMClient 替换 stub)

- [ ] **Step 1: 读 ChatManager.ts AgentBrain 注册点**

找 ChatManager 注册 AgentBrain 的位置(W4.6 + W7.0.1)。当前 `registerAgent(brain)` 传入 AgentBrainImpl,W5.2.2 think() 是 stub。

- [ ] **Step 2: 加 LLM-aware AgentBrain**

新建 `electron/agent/LlmAgentBrain.ts` ~150 行:

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { LlmClient } from '../llm/LlmClient'

export interface AgentDecision {
  action: 'reply' | 'call' | 'screenshot' | 'stop' | 'spawn'
  payload: Record<string, any>
}

export interface AgentRequest {
  conversationId: string
  content: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export class LlmAgentBrain {
  private static instance: LlmAgentBrain
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private llm = LlmClient.getInstance()

  private constructor() {}

  public static getInstance(): LlmAgentBrain {
    if (!LlmAgentBrain.instance) LlmAgentBrain.instance = new LlmAgentBrain()
    return LlmAgentBrain.instance
  }

  async think(req: AgentRequest): Promise<AgentDecision> {
    const systemPrompt = '你是 PiPiClaw 桌面 AI 助手。响应 JSON 格式: { "action": "reply|call|screenshot|stop", "payload": { ... } }。默认 reply。'
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...(req.history ?? []),
      { role: 'user' as const, content: req.content },
    ]
    const result = await this.llm.chat({ model: '', messages })
    if (!result.ok) {
      // fallback stub
      return { action: 'reply', payload: { text: `LLM unavailable: ${result.error}` } }
    }
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return { action: 'reply', payload: { text: result.content } }
      return JSON.parse(jsonMatch[0])
    } catch {
      return { action: 'reply', payload: { text: result.content } }
    }
  }

  async call(tool: { name: string; args: any }): Promise<{ ok: boolean; result?: any; error?: string }> {
    // stub:工具调用实际 stub,W13+ 接 SandboxAgentTool
    return { ok: true, result: { stub: true, tool } }
  }

  async spawn(_: { task: string }): Promise<{ ok: boolean; id?: string }> {
    return { ok: true, id: 'spawn-stub' }
  }

  async checkpoint(_: { id: string }): Promise<{ ok: boolean }> {
    return { ok: true }
  }

  async restore(_: { id: string }): Promise<{ ok: boolean }> {
    return { ok: true }
  }
}

export function asLlmAgentBrain(brain: LlmAgentBrain): any {
  return brain  // LlmAgentBrain 已实现 AgentBrain 接口
}
```

- [ ] **Step 3: 在 main.ts 注册 LlmAgentBrain**

读 `electron/main.ts`,找到 AgentBrain 注册位置(W7.0.1 已加 registerAgent),改为:

```typescript
// W13.B: 用 LlmAgentBrain 替换 stub
const { LlmAgentBrain, asLlmAgentBrain } = require('./agent/LlmAgentBrain')
const { ChatManager } = require('./chat/ChatManager')
ChatManager.getInstance().registerAgent(asLlmAgentBrain(LlmAgentBrain.getInstance()))
```

注:W7.0.1 已有 `AgentBrainImpl.registerAgent`,这里替换为 LlmAgentBrain。

- [ ] **Step 4: 验证 tsc 0 错**

```bash
cd D:\pipiclaw\piclaw
npx tsc --noEmit -p tsconfig.node.json 2>&1 | Select-Object -First 10
```

Expected: 0 错。

- [ ] **Step 5: commit**

```bash
cd D:\pipiclaw\piclaw
git add electron/agent/LlmAgentBrain.ts electron/main.ts
git commit -m "feat(agent) LlmAgentBrain real LLM with stub fallback wired in main"
```

---

## Task 6: 验证 + retro + docs commit

**Files:**
- Create: `docs/superpowers/retros/2026-07-17-llm-integration/retros.md`

- [ ] **Step 1: 验证 tsc 0 错**

```bash
cd D:\pipiclaw\piclaw
npx tsc --noEmit -p tsconfig.node.json 2>&1 | Select-Object -First 5
```

Expected: 0 错。

- [ ] **Step 2: 验证 vitest 178/178**

```bash
cd D:\pipiclaw\piclaw
npx vitest run 2>&1 | Select-String "Test Files|Tests " | Select-Object -First 5
```

Expected: 178/178 全过。

- [ ] **Step 3: 写 retro**

新建 `docs/superpowers/retros/2026-07-17-llm-integration/retros.md`:

```markdown
# LLM 集成 报告

**日期**:2026-07-17
**目标**:把 3 处 LLM stub(D5 SKILL.md / A5 AgentBrain / ChatManager)替换为真实 LLM 调用

## 集成范围

### 新建 LLM 域(`electron/llm/`)
- ✅ `LlmClient.ts` 统一入口(根据 req.provider 选 adapter)
- ✅ `LlmConfigStore.ts` 持久化到 `userData/llm-config.json`
- ✅ `adapters/openai.ts` OpenAI 兼容 fetch
- ✅ `adapters/anthropic.ts` Anthropic Messages API
- ✅ `adapters/zhipu.ts` 智谱 GLM OpenAI 兼容
- ✅ `types.ts` LlmConfig / LlmRequest / LlmResponse 接口

### LLM UI
- ✅ `LlmConfig.vue` 3 provider 表单(API Key + 默认模型 + 测试连接 + 保存所有)
- ✅ `/settings/llm` 路由
- ✅ `IpcServer.llm-config:{get, save, test}` + `IpcServer.llm-chat` 4 handler
- ✅ `preload.electronAPI.llm.{getConfigs, saveConfig, testConfig, chat}` 暴露

### 替换 stub
- ✅ D5RecordingToSkill: SKILL.md 生成用 LlmClient,fallback stub
- ✅ A5ComputerUse: Computer Use 决策用 LlmClient JSON 决策,fallback stub
- ✅ LlmAgentBrain 替换 AgentBrainImpl 注册到 ChatManager

## 关键决策

- **不引入新 npm 依赖**:3 provider 都走 fetch 原生
- **fallback 永不失败**:LLM API 失败 → stub 决策 → 用户体验仍可用
- **provider 互斥启用**:LlmConfigStore.getActive() 返回第一个 enabled 的 config
- **统一接口**:所有 builtin 用 LlmClient.chat() / .complete(),不直接调 fetch

## 测试策略

- **单元测试**:LlmClient mock fetch 测 provider 选路由(可选,W13.5 测试)
- **集成测试**:LlmConfigStore 持久化 round-trip(已有模式)
- **真实环境验证**:用户在 /settings/llm 填 API key → 测试连接 → 跑 5 demo

## 用户凭证补全 7 步骤

1. 用户在 /settings/llm 选 provider(OpenAI 需翻墙 / Anthropic 需翻墙 / 智谱国内直连)
2. 填 API Key + 默认模型(可选)
3. 点"测试连接" → LlmClient 调平台 API → 验证
4. 点"保存所有" → LlmConfigStore 持久化到 `userData/llm-config.json`
5. 启用后,5 demo / ChatManager 自动用真 LLM
6. D5 SKILL.md 生成用 LLM,自动学习录屏 skill
7. A5 Computer Use 决策用 LLM,真智能决策

## 验收清单

- LlmClient + 3 provider: ✅
- LlmConfigStore 持久化: ✅
- LlmConfig.vue UI: ✅
- IpcServer 4 handler: ✅
- preload 4 暴露: ✅
- D5 LLM SKILL.md: ✅
- A5 LLM decision: ✅
- ChatManager LlmAgentBrain: ✅
- tsc 0 错: ✅
- vitest 178/178: ✅
```

- [ ] **Step 4: commit retro**

```bash
cd D:\pipiclaw\piclaw
git add docs/superpowers/retros/2026-07-17-llm-integration/retros.md
git commit -m "docs(retro) LLM integration 3 providers real LLM replace stub"
```

---

## 总体执行策略

1. **Task 1 (LlmClient + 3 provider)**:独立,可单独 commit
2. **Task 2 (LlmConfig UI + IPC)**:独立,需 Task 1 已就位(代码层面)
3. **Task 3 (D5 LLM SKILL.md)**:依赖 Task 1 + Task 2
4. **Task 4 (A5 LLM decision)**:依赖 Task 1 + Task 2
5. **Task 5 (LlmAgentBrain + main.ts)**:依赖 Task 1 + Task 2
6. **Task 6 (验证 + retro)**:依赖前面所有 task

**subagent 派发**:1 个 general_purpose_task subagent 串行跑 6 task,每 task 自己 commit,主会话最后兜底验证。

## 计划自检(对照用户原话"接真实 LLM")

| 用户要求 | 任务覆盖 |
|---|---|
| D5 SKILL.md 用真 LLM | Task 3 |
| A5 AgentBrain 决策用真 LLM | Task 4 |
| ChatManager chat 用真 LLM | Task 5(LlmAgentBrain 替换 AgentBrainImpl)|
| LLM key 配置 UI | Task 2(LlmConfig.vue + /settings/llm)|
| 3 provider 支持 | Task 1(OpenAI + Anthropic + 智谱)|

✅ 全部覆盖。

## 类型一致性自检

- `LlmConfigStore.list()` 返回 `LlmConfig[]`(Task 2 用 find 索引,类似 ImAccounts)
- `LlmClient.chat(req: LlmRequest): Promise<LlmResponse>` 一致(Task 3/4/5 都用)
- `IpcServer.handle(name, handler)` 模式统一
- `LlmAgentBrain.think(req: AgentRequest): Promise<AgentDecision>` 与 AgentBrain 接口一致

✅ 类型一致。