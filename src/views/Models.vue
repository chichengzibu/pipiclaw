<template>
  <div class="models-page">
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">模型管理</h1>
        <span class="provider-count">{{ modelsStore.enabledCount }}/{{ modelsStore.totalCount }} 已启用</span>
      </div>
      <div class="header-right">
        <Breadcrumb />
        <el-button type="primary" @click="handleAddProvider">
          <el-icon><Plus /></el-icon>
          添加提供商
        </el-button>
      </div>
    </div>

    <div class="models-content" v-loading="modelsStore.loading">
      <el-empty v-if="modelsStore.providers.length === 0" description="暂无模型提供商">
        <el-button type="primary" @click="handleAddProvider">添加提供商</el-button>
      </el-empty>

      <div v-else class="provider-grid">
        <el-card
          v-for="provider in modelsStore.providers"
          :key="provider.id"
          class="provider-card"
          :class="{ disabled: !provider.enabled }"
          shadow="hover"
        >
          <template #header>
            <div class="provider-header">
              <div class="provider-info">
                <span class="provider-icon">{{ getProviderIcon(provider.type) }}</span>
                <div class="provider-title">
                  <span class="provider-name">{{ provider.name }}</span>
                  <span class="provider-type">{{ getProviderTypeName(provider.type) }}</span>
                </div>
              </div>
              <el-switch
                :model-value="provider.enabled"
                @change="(val: boolean) => handleToggle(provider.id, val)"
                :loading="isToggling(provider.id)"
              />
            </div>
          </template>

          <div class="provider-body">
            <div class="connection-status">
              <el-tag
                :type="provider.enabled ? 'success' : 'info'"
                size="small"
                effect="plain"
              >
                {{ provider.enabled ? '已启用' : '已禁用' }}
              </el-tag>
              <span class="model-count">{{ provider.models.length }} 个模型</span>
            </div>

            <div class="models-list" v-if="provider.models.length > 0">
              <el-scrollbar class="models-scrollbar">
                <div
                  v-for="model in provider.models"
                  :key="model.id"
                  class="model-item"
                  :class="{ default: model.id === provider.defaultModel }"
                >
                  <span class="model-name">{{ model.name }}</span>
                  <span class="model-capabilities">
                    <el-tag
                      v-for="cap in model.capabilities.slice(0, 2)"
                      :key="cap"
                      size="small"
                      effect="plain"
                      type="info"
                    >{{ cap }}</el-tag>
                  </span>
                </div>
              </el-scrollbar>
            </div>
            <div v-else class="no-models">
              暂无模型配置
            </div>
          </div>

          <template #footer>
            <div class="provider-actions">
              <el-button
                size="small"
                :loading="modelsStore.isTesting(provider.id)"
                @click="handleTest(provider.id)"
              >
                测试连接
              </el-button>
              <el-button
                v-if="provider.type === 'ollama'"
                size="small"
                :loading="modelsStore.isSyncing(provider.id)"
                @click="handleSyncOllama(provider.id)"
              >
                同步模型
              </el-button>
              <el-button size="small" @click="handleEdit(provider)">
                编辑
              </el-button>
              <el-button
                size="small"
                type="danger"
                text
                @click="handleDelete(provider.id, provider.name)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-card>
      </div>
    </div>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑提供商' : '添加提供商'"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="120px"
      >
        <el-form-item label="提供商名称" prop="name">
          <el-input v-model="formData.name" placeholder="例如：OpenAI" />
        </el-form-item>

        <el-form-item label="类型" prop="type">
          <el-select v-model="formData.type" placeholder="选择提供商类型" @change="handleTypeChange">
            <el-option label="OpenAI" value="openai" />
            <el-option label="Anthropic" value="anthropic" />
            <el-option label="DeepSeek" value="deepseek" />
            <el-option label="Azure OpenAI" value="azure" />
            <el-option label="Ollama (本地)" value="ollama" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </el-form-item>

        <el-form-item label="API 地址" prop="baseUrl">
          <el-input v-model="formData.baseUrl" placeholder="API Base URL" />
        </el-form-item>

        <el-form-item label="API Key" prop="apiKey">
          <el-input
            v-model="formData.apiKey"
            type="password"
            show-password
            placeholder="输入 API Key"
          />
        </el-form-item>

        <template v-if="formData.type === 'azure'">
          <el-form-item label="部署名称" prop="deploymentName">
            <el-input v-model="formData.deploymentName" placeholder="Azure 部署名称" />
          </el-form-item>
          <el-form-item label="API 版本" prop="apiVersion">
            <el-input v-model="formData.apiVersion" placeholder="例如：2024-02-01" />
          </el-form-item>
        </template>

        <template v-if="formData.type === 'anthropic'">
          <el-form-item label="组织 ID" prop="organization">
            <el-input v-model="formData.organization" placeholder="可选" />
          </el-form-item>
        </template>

        <el-form-item label="超时时间" prop="timeout">
          <el-input-number
            v-model="formData.timeout"
            :min="5000"
            :max="300000"
            :step="5000"
          />
          <span class="form-tip">毫秒</span>
        </el-form-item>

        <el-form-item label="启用">
          <el-switch v-model="formData.enabled" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isEditing ? '保存' : '添加' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 测试结果对话框 -->
    <el-dialog v-model="testDialogVisible" title="连接测试结果" width="400px">
      <div v-if="testResult">
        <el-result
          :icon="testResult.success ? 'success' : 'error'"
          :title="testResult.success ? '连接成功' : '连接失败'"
        >
          <template #sub-title>
            <div v-if="testResult.success">
              <p>响应时间: {{ testResult.latency }}ms</p>
            </div>
            <div v-else>
              <p>{{ testResult.error }}</p>
            </div>
          </template>
        </el-result>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import Breadcrumb from '@/components/layout/Breadcrumb.vue';
import { useModelsStore, PROVIDER_DEFAULTS, type ProviderConfig, type ProviderFormData } from '@/stores/models';
import { Plus } from '@element-plus/icons-vue';

const modelsStore = useModelsStore();

const dialogVisible = ref(false);
const testDialogVisible = ref(false);
const submitting = ref(false);
const isEditing = ref(false);
const editingId = ref('');
const formRef = ref();
const testResult = ref<{ success: boolean; latency?: number; error?: string } | null>(null);
const togglingProviders = ref<Set<string>>(new Set());

const formData = reactive<ProviderFormData>({
  name: '',
  type: 'openai',
  enabled: true,
  baseUrl: '',
  apiKey: '',
  organization: '',
  deploymentName: '',
  apiVersion: '',
  timeout: 60000,
  maxRetries: 3
});

const formRules = {
  name: [{ required: true, message: '请输入提供商名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择提供商类型', trigger: 'change' }],
  baseUrl: [{ required: true, message: '请输入 API 地址', trigger: 'blur' }]
};

onMounted(async () => {
  await modelsStore.fetchProviders();
});

function getProviderIcon(type: string): string {
  const icons: Record<string, string> = {
    openai: '🤖',
    anthropic: '🧠',
    deepseek: '🔮',
    azure: '☁️',
    ollama: '🦙',
    custom: '⚙️'
  };
  return icons[type] || '📦';
}

function getProviderTypeName(type: string): string {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic Claude',
    deepseek: 'DeepSeek',
    azure: 'Azure OpenAI',
    ollama: 'Ollama 本地',
    custom: '自定义'
  };
  return names[type] || type;
}

function handleTypeChange(type: string): void {
  const defaults = PROVIDER_DEFAULTS[type as keyof typeof PROVIDER_DEFAULTS];
  if (defaults) {
    formData.baseUrl = defaults.baseUrl || '';
    formData.timeout = defaults.timeout || 60000;
    formData.maxRetries = defaults.maxRetries || 3;
    if (defaults.name) {
      formData.name = formData.name || defaults.name;
    }
  }
}

function handleAddProvider(): void {
  isEditing.value = false;
  editingId.value = '';
  Object.assign(formData, {
    name: '',
    type: 'openai',
    enabled: true,
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    organization: '',
    deploymentName: '',
    apiVersion: '',
    timeout: 60000,
    maxRetries: 3
  });
  dialogVisible.value = true;
}

function handleEdit(provider: ProviderConfig): void {
  isEditing.value = true;
  editingId.value = provider.id;
  Object.assign(formData, {
    name: provider.name,
    type: provider.type,
    enabled: provider.enabled,
    baseUrl: provider.baseUrl || '',
    apiKey: provider.apiKey || '',
    organization: provider.organization || '',
    deploymentName: provider.deploymentName || '',
    apiVersion: provider.apiVersion || '',
    timeout: provider.timeout || 60000,
    maxRetries: provider.maxRetries || 3
  });
  dialogVisible.value = true;
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    submitting.value = true;
    try {
      if (isEditing.value) {
        const result = await modelsStore.updateProvider(editingId.value, formData);
        if (result) {
          ElMessage.success('保存成功');
          dialogVisible.value = false;
        }
      } else {
        const result = await modelsStore.addProvider(formData);
        if (result) {
          ElMessage.success('添加成功');
          dialogVisible.value = false;
        }
      }
    } finally {
      submitting.value = false;
    }
  });
}

async function handleToggle(id: string, enabled: boolean): Promise<void> {
  togglingProviders.value.add(id);
  try {
    await modelsStore.toggleProvider(id, enabled);
    ElMessage.success(enabled ? '已启用' : '已禁用');
  } finally {
    togglingProviders.value.delete(id);
  }
}

function isToggling(id: string): boolean {
  return togglingProviders.value.has(id);
}

async function handleTest(id: string): Promise<void> {
  const result = await modelsStore.testProvider(id);
  testResult.value = result;
  testDialogVisible.value = true;
}

async function handleSyncOllama(id: string): Promise<void> {
  const success = await modelsStore.syncOllamaModels(id);
  if (success) {
    ElMessage.success('模型同步成功');
  }
}

async function handleDelete(id: string, name: string): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定要删除提供商 "${name}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const success = await modelsStore.deleteProvider(id);
    if (success) {
      ElMessage.success('删除成功');
    }
  } catch {
    // 用户取消
  }
}
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.models-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $content-padding;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.provider-count {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.models-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: $content-padding;
}

.provider-card {
  transition: all 0.3s;

  &.disabled {
    opacity: 0.7;

    .provider-header {
      .provider-name {
        color: var(--el-text-color-secondary);
      }
    }
  }
}

.provider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.provider-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.provider-icon {
  font-size: 32px;
}

.provider-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.provider-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.provider-type {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.provider-body {
  padding: 8px 0;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.model-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.models-list {
  max-height: 300px;
}

.models-scrollbar {
  max-height: 300px;
}

.models-list > .models-scrollbar :deep(.el-scrollbar__wrap) {
  overflow-x: hidden;
}

.models-list > .models-scrollbar :deep(.el-scrollbar__view) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;

  &.default {
    border: 1px solid var(--el-color-primary-light-5);
    background: var(--el-color-primary-light-9);
  }
}

.model-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color);
}

.model-capabilities {
  display: flex;
  gap: 4px;
}

.more-models {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 4px 12px;
}

.no-models {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
  padding: 20px;
}

.provider-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.form-tip {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
}
</style>
