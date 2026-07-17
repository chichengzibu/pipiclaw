<template>
  <div class="llm-config-page">
    <header class="page-header">
      <h1>LLM 配置</h1>
      <p class="subtitle">配置多家 LLM provider 的 API Key 和默认模型,启用后会驱动所有 demo / builtin / chat 场景。</p>
    </header>

    <el-alert
      v-if="status"
      :type="status.success ? 'success' : 'error'"
      :title="status.success ? '操作成功' : '操作失败'"
      :description="status.message"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    />

    <el-card v-for="row in providers" :key="row.provider" class="provider-card">
      <template #header>
        <div class="provider-card-header">
          <div class="provider-title">
            <span class="provider-icon">{{ row.icon }}</span>
            <span class="provider-name">{{ row.label }}</span>
            <el-tag v-if="row.config?.enabled" type="success" size="small">已启用</el-tag>
            <el-tag v-else type="info" size="small">未启用</el-tag>
          </div>
          <el-switch
            v-model="row.config!.enabled"
            @change="(val: boolean) => save(row, val)"
            :loading="row.saving"
            active-color="#67c23a"
            inactive-color="#dcdfe6"
          />
        </div>
      </template>

      <el-form :model="row.config" label-position="top">
        <el-form-item label="API Key">
          <el-input
            v-model="row.config!.apiKey"
            placeholder="sk-..."
            show-password
            clearable
            @blur="save(row, row.config!.enabled)"
          />
        </el-form-item>

        <el-form-item label="默认模型">
          <el-select
            v-model="row.config!.defaultModel"
            placeholder="选择或输入自定义模型 ID"
            filterable
            allow-create
            default-first-option
            style="width: 100%"
            @change="save(row, row.config!.enabled)"
          >
            <el-option v-for="m in row.modelOptions" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>

        <el-form-item label="自定义 API Base URL(可选)">
          <el-input
            v-model="row.config!.apiBaseUrl"
            :placeholder="row.defaultBase"
            clearable
            @blur="save(row, row.config!.enabled)"
          />
        </el-form-item>

        <el-form-item>
          <el-button :loading="row.testing" @click="testConnection(row)" type="primary" plain>
            {{ row.testing ? '测试中...' : '连接测试' }}
          </el-button>
          <el-text v-if="row.testResult" :type="row.testResult.ok ? 'success' : 'danger'" class="test-result">
            <span v-if="row.testResult.ok">✓ {{ row.testResult.summary }}</span>
            <span v-else>✗ {{ row.testResult.error }}</span>
          </el-text>
        </el-form-item>
      </el-form>
    </el-card>

    <section class="tips">
      <h3>使用提示</h3>
      <ol>
        <li>每家 provider 独立配置,API Key 与 model 都保存在本地 userData 目录的 <code>llm-config.json</code> 中,不会被上传到任何第三方。</li>
        <li>ChatManager 内置模型通道与 LLM 配置可独立使用;若启用 LLM provider,demo(D5 / A5)与 agent brain 会优先调用此处配置。</li>
        <li>"连接测试" 会发起一次最小化的 ping 请求(默认 prompt "ping"),用于校验 API Key 是否可用,不会产生显著费用。</li>
      </ol>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'

interface LlmConfig {
  provider: 'openai' | 'anthropic' | 'zhipu'
  apiKey: string
  defaultModel: string
  apiBaseUrl: string
  enabled: boolean
  updatedAt: number
}

interface ProviderRow {
  provider: 'openai' | 'anthropic' | 'zhipu'
  label: string
  icon: string
  defaultBase: string
  modelOptions: string[]
  config: LlmConfig | undefined
  saving: boolean
  testing: boolean
  testResult?: { ok: boolean; summary?: string; error?: string }
}

const PROVIDER_META: Omit<ProviderRow, 'config' | 'saving' | 'testing' | 'testResult'>[] = [
  { provider: 'openai', label: 'OpenAI', icon: '🟢', defaultBase: 'https://api.openai.com/v1', modelOptions: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'] },
  { provider: 'anthropic', label: 'Anthropic Claude', icon: '🟣', defaultBase: 'https://api.anthropic.com/v1', modelOptions: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'] },
  { provider: 'zhipu', label: '智谱 GLM', icon: '🔵', defaultBase: 'https://open.bigmodel.cn/api/paas/v4', modelOptions: ['glm-4-flash', 'glm-4-plus', 'glm-4-air'] },
]

const providers = reactive<ProviderRow[]>(
  PROVIDER_META.map(meta => ({
    ...meta,
    config: { provider: meta.provider, apiKey: '', defaultModel: meta.modelOptions[0], apiBaseUrl: '', enabled: false, updatedAt: 0 },
    saving: false,
    testing: false,
  }))
)

const status = ref<{ success: boolean; message: string } | null>(null)

async function loadAll() {
  const res = await window.electronAPI.llmConfig.list()
  if (res.success && Array.isArray(res.data)) {
    for (const row of providers) {
      const found = res.data.find((c: any) => c.provider === row.provider) as Partial<LlmConfig> | undefined
      if (found) {
        row.config = {
          provider: row.provider,
          apiKey: found.apiKey ?? '',
          enabled: !!found.enabled,
          defaultModel: found.defaultModel ?? row.modelOptions[0],
          apiBaseUrl: found.apiBaseUrl ?? '',
          updatedAt: found.updatedAt ?? 0,
        }
      }
    }
  }
}

async function save(row: ProviderRow, _enabled: boolean) {
  row.saving = true
  try {
    const res = await window.electronAPI.llmConfig.upsert({
      provider: row.provider,
      apiKey: row.config!.apiKey,
      enabled: row.config!.enabled,
      defaultModel: row.config!.defaultModel,
      apiBaseUrl: row.config!.apiBaseUrl,
    })
    status.value = res.success ? { success: true, message: `${row.label} 已保存` } : { success: false, message: res.error || '保存失败' }
  } finally {
    row.saving = false
    setTimeout(() => (status.value = null), 3000)
  }
}

async function testConnection(row: ProviderRow) {
  row.testing = true
  row.testResult = undefined
  try {
    await save(row, row.config!.enabled)
    const res = await window.electronAPI.llmConfig.test({ provider: row.provider, prompt: 'ping' })
    if (res.success && res.data?.ok) {
      row.testResult = { ok: true, summary: `${res.data.model} · ${res.data.durationMs}ms · ${res.data.content.slice(0, 60)}` }
    } else {
      row.testResult = { ok: false, error: res.data?.error || res.error || '未知错误' }
    }
  } catch (e) {
    row.testResult = { ok: false, error: String(e) }
  } finally {
    row.testing = false
  }
}

onMounted(loadAll)
</script>

<style scoped>
.llm-config-page {
  max-width: 920px;
  margin: 0 auto;
  padding: 24px;
}

.page-header h1 {
  font-size: 24px;
  margin: 0 0 8px 0;
}

.subtitle {
  color: var(--el-text-color-secondary);
  margin: 0 0 24px 0;
  font-size: 14px;
}

.provider-card {
  margin-bottom: 16px;
}

.provider-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.provider-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.provider-icon {
  font-size: 22px;
}

.provider-name {
  font-weight: 600;
  font-size: 16px;
}

.test-result {
  margin-left: 16px;
  font-size: 13px;
}

.tips {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 16px 24px;
  margin-top: 24px;
}

.tips h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
}

.tips ol {
  margin: 0;
  padding-left: 20px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.tips code {
  background: var(--el-bg-color);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
}
</style>
