<template>
  <div class="models-page">
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">{{ t('models.title') }}</h1>
        <span class="provider-count">{{ t('models.providerCount', { enabled: modelsStore.enabledCount, total: modelsStore.totalCount }) }}</span>
      </div>
      <div class="header-right">
        <Breadcrumb />
        <el-button type="primary" @click="handleAddProvider">
          <el-icon><Plus /></el-icon>
          {{ t('models.addProvider') }}
        </el-button>
      </div>
    </div>

    <div class="models-content" v-loading="modelsStore.loading">
      <el-empty v-if="modelsStore.providers.length === 0" :description="t('models.noProviders')">
        <el-button type="primary" @click="handleAddProvider">{{ t('models.addProvider') }}</el-button>
      </el-empty>

      <div v-else class="provider-grid">
        <el-card
          v-for="provider in modelsStore.providers"
          :key="provider.id"
          class="provider-card"
          :class="{ enabled: provider.enabled, disabled: !provider.enabled }"
          shadow="never"
        >
          <template #header>
            <div class="provider-header">
              <div class="provider-info">
                <span class="provider-icon">{{ getProviderIcon(provider.type, provider.name) }}</span>
                <div class="provider-title">
                  <span class="provider-name">{{ provider.name }}</span>
                  <span class="provider-type">{{ getProviderTypeName(provider.type, provider.name) }}</span>
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
                {{ provider.enabled ? t('models.enabled') : t('models.disabled') }}
              </el-tag>
              <span class="model-count">{{ t('models.modelsCount', { count: provider.models.length }) }}</span>
            </div>

            <div class="models-tag-cloud" v-if="provider.models && provider.models.length > 0">
              <el-tag
                v-for="model in provider.models.slice(0, 8)"
                :key="model.id"
                size="small"
                effect="plain"
                type="info"
              >
                {{ model.name }}
                <span class="model-cap-tag" v-if="model.capabilities.length > 0">
                  [{{ model.capabilities[0] }}]
                </span>
              </el-tag>
              <span class="more-models-tip" v-if="provider.models.length > 8">
                {{ t('models.moreModels', { count: provider.models.length - 8 }) }}
              </span>
            </div>
            <div v-else class="no-models">
              <span>{{ provider.type === 'volc_ark' ? t('models.noModelsVolc') : t('models.noModels') }}</span>
            </div>
          </div>

          <template #footer>
            <div class="provider-actions">
              <el-button
                size="small"
                :loading="modelsStore.isTesting(provider.id)"
                @click="handleTest(provider.id)"
              >
                {{ t('models.testConnection') }}
              </el-button>
              <el-button size="small" @click="handleManageModels(provider)">
                {{ t('models.manageModels') }}
              </el-button>
              <el-button
                v-if="!isVolcEngineProvider(provider)"
                size="small"
                @click="handleFetchModels(provider.id)"
              >
                {{ t('models.fetchModels') }}
              </el-button>
              <el-button size="small" @click="handleEdit(provider)">
                {{ t('common.edit') }}
              </el-button>
              <el-button
                size="small"
                type="danger"
                text
                @click="handleDelete(provider.id, provider.name)"
              >
                {{ t('common.delete') }}
              </el-button>
            </div>
          </template>
        </el-card>
      </div>
    </div>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? t('models.editProvider') : t('models.addProvider')"
      width="700px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="120px"
      >
        <el-form-item :label="t('models.providerName')" prop="name">
          <el-input v-model="formData.name" :placeholder="t('models.providerNamePlaceholder')" />
        </el-form-item>

        <el-form-item v-if="!isEditing" :label="t('models.type')" prop="type">
          <el-select v-model="formData.type" :placeholder="t('models.selectType')" @change="handleTypeChange">
            <el-option
              v-for="template in allProviderOptions"
              :key="template.type"
              :value="template.type"
            >
              <span style="margin-right: var(--space-sm);">{{ getProviderIcon(template.type, template.name) }}</span>
              {{ template.name }}
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item :label="t('models.apiUrl')" prop="baseUrl">
          <el-input v-model="formData.baseUrl" :placeholder="t('models.apiUrlPlaceholder')" />
        </el-form-item>

        <el-form-item :label="t('models.apiKey')" prop="apiKey">
          <el-input
            v-model="formData.apiKey"
            type="password"
            show-password
            :placeholder="t('models.apiKeyPlaceholder')"
          />
          <div v-if="currentProviderType === 'volc_ark'" class="form-tip">
            {{ t('models.apiKeyVolcTip') }}
          </div>
          <div v-if="currentProviderType === 'anthropic'" class="form-tip">
            {{ t('models.apiKeyAnthropicTip') }}
          </div>
        </el-form-item>

        <template v-if="currentProviderType === 'azure'">
          <el-form-item :label="t('models.deploymentName')" prop="deploymentName">
            <el-input v-model="formData.deploymentName" :placeholder="t('models.deploymentPlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('models.apiVersion')" prop="apiVersion">
            <el-input v-model="formData.apiVersion" :placeholder="t('models.apiVersionPlaceholder')" />
          </el-form-item>
        </template>

        <template v-if="currentProviderType === 'anthropic'">
          <el-form-item :label="t('models.organization')" prop="organization">
            <el-input v-model="formData.organization" :placeholder="t('models.organizationPlaceholder')" />
          </el-form-item>
        </template>

        <el-form-item :label="t('models.timeout')" prop="timeout">
          <el-input-number
            v-model="formData.timeout"
            :min="5000"
            :max="300000"
            :step="5000"
          />
          <span class="form-tip">{{ t('models.timeoutUnit') }}</span>
        </el-form-item>

        <el-form-item :label="t('models.modelId')" prop="modelId">
          <el-input v-model="formData.modelId" :placeholder="isVolcEngineForm() ? t('models.modelIdPlaceholder') : t('models.modelIdPlaceholderNormal')" />
          <div v-if="isVolcEngineForm()" class="form-tip">
            {{ t('models.volcCodingPlanHint') }}
          </div>
        </el-form-item>

        <el-form-item :label="t('models.enabled_')">
          <el-switch v-model="formData.enabled" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isEditing ? t('common.save') : t('common.add') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 测试结果对话框 -->
    <el-dialog v-model="testDialogVisible" :title="t('models.testResultTitle')" width="400px">
      <div v-if="testResult">
        <el-result
          :icon="testResult.success ? 'success' : 'error'"
          :title="testResult.success ? t('models.connectionSuccess') : t('models.connectionFailed')"
        >
          <template #sub-title>
            <div v-if="testResult.success">
              <p>{{ t('models.latencyMs', { ms: testResult.latency }) }}</p>
            </div>
            <div v-else>
              <p>{{ testResult.error }}</p>
            </div>
          </template>
        </el-result>
      </div>
    </el-dialog>

    <!-- 管理模型对话框 -->
    <el-dialog v-model="manageModelsDialogVisible" :title="t('models.manageModelsTitle')" width="600px">
      <div v-if="currentProvider">
        <div class="model-list">
          <el-empty v-if="editingModels.length === 0" :description="t('models.noModels')" />
          <div v-else>
            <div v-for="(model, index) in editingModels" :key="model.id" class="model-item">
              <span class="model-name">{{ model.name }}</span>
              <el-button size="small" type="danger" text @click="removeModel(index)">{{ t('common.delete') }}</el-button>
            </div>
          </div>
        </div>

        <el-divider />

        <div class="add-model">
          <el-input v-model="newModelId" :placeholder="t('models.inputNewModelId')" style="margin-right: var(--space-sm);" />
          <el-button type="primary" @click="addModel">{{ t('models.addModel') }}</el-button>
        </div>
      </div>

      <template #footer>
        <el-button @click="manageModelsDialogVisible = false">{{ t('common.close') }}</el-button>
        <el-button type="primary" @click="saveModels">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import Breadcrumb from '@/components/layout/Breadcrumb.vue';
import { useModelsStore, PROVIDER_DEFAULTS, type ProviderConfig, type ProviderFormData } from '@/stores/models';
import { Plus } from '@element-plus/icons-vue';

const { t } = useI18n();

const modelsStore = useModelsStore();

const dialogVisible = ref(false);
const testDialogVisible = ref(false);
const manageModelsDialogVisible = ref(false);
const submitting = ref(false);
const isEditing = ref(false);
const editingId = ref('');
const formRef = ref();
const testResult = ref<{ success: boolean; latency?: number; error?: string } | null>(null);
const togglingProviders = ref<Set<string>>(new Set());
const currentProvider = ref<ProviderConfig | null>(null);
const newModelId = ref('');
const editingModels = ref<any[]>([]);

function isVolcEngineProvider(provider: ProviderConfig): boolean {
  return provider.type === 'volc_ark' || (!!provider.baseUrl && provider.baseUrl.includes('coding/v3'));
}

function isVolcEngineForm(): boolean {
  return formData.type === 'volc_ark' || (!!(formData as any).baseUrl && (formData as any).baseUrl.includes('coding/v3'));
}

const currentProviderType = computed(() => formData.type || 'openai');

const formData = reactive<ProviderFormData & { modelId: string }>({
  name: '',
  type: 'openai',
  enabled: true,
  baseUrl: '',
  apiKey: '',
  organization: '',
  deploymentName: '',
  apiVersion: '',
  timeout: 60000,
  maxRetries: 3,
  modelId: ''
});

const formRules = computed(() => ({
  name: [{ required: true, message: t('models.pleaseEnterName'), trigger: 'blur' }],
  type: [{ required: true, message: t('models.pleaseSelectType'), trigger: 'change' }],
  baseUrl: [{ required: true, message: t('models.pleaseEnterApiUrl'), trigger: 'blur' }]
}));

const allProviderOptions = computed(() => {
  const templates = [...modelsStore.providerTemplates];
  if (!templates.find(tmpl => tmpl.type === 'custom')) {
    templates.push({ name: t('models.customOption'), type: 'custom', defaultConfig: {} });
  }
  return templates;
});

onMounted(async () => {
  await Promise.all([
    modelsStore.fetchProviders(),
    modelsStore.fetchProviderTemplates()
  ]);
});

function handleTypeChange(type: string): void {
  const selectedTemplate = modelsStore.providerTemplates.find(tmpl => tmpl.type === type);
  if (selectedTemplate) {
    formData.name = selectedTemplate.defaultConfig.name || '';
    formData.baseUrl = selectedTemplate.defaultConfig.baseUrl || '';
    formData.timeout = selectedTemplate.defaultConfig.timeout || 60000;
    formData.maxRetries = selectedTemplate.defaultConfig.maxRetries || 3;
  } else if (type === 'custom') {
    formData.name = '';
    formData.baseUrl = '';
  } else {
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
}

function getProviderTypeName(type: string, name?: string): string {
  const names: Record<string, string> = {
    openai: t('models.typeOpenai'),
    anthropic: t('models.typeAnthropic'),
    deepseek: t('models.typeDeepseek'),
    azure: t('models.typeAzure'),
    ollama: t('models.typeOllama'),
    openrouter: t('models.typeOpenrouter'),
    volc_ark: t('models.typeVolcArk'),
    custom: t('models.typeCustom'),
    '智谱 AI': t('models.typeZhipu'),
    '月之暗面': t('models.typeKimi'),
    'MiniMax': t('models.typeMiniMax'),
    '零一万物': t('models.typeYi'),
    '百川智能': t('models.typeBaichuan'),
    '阿里百炼': t('models.typeAliyun'),
    '硅基流动': t('models.typeSilicon')
  };
  return names[type] || (name ? names[name] || type : type);
}

function getProviderIcon(type: string, name?: string): string {
  if (type === 'custom' && name) {
    const customIcons: Record<string, string> = {
      '智谱 AI': '💡',
      '月之暗面': '🌙',
      'MiniMax': '⭐',
      '零一万物': '✨',
      '百川智能': '🌊',
      '火山引擎': '🌋',
      '阿里百炼': '🐏',
      '硅基流动': '🔬'
    };
    return customIcons[name] || '⚙️';
  }
  const icons: Record<string, string> = {
    openai: '🤖',
    anthropic: '🧠',
    deepseek: '🔮',
    azure: '☁️',
    ollama: '🦙',
    openrouter: '🌐',
    volc_ark: '🌋',
    custom: '⚙️'
  };
  return icons[type] || '📦';
}

function handleManageModels(provider: ProviderConfig): void {
  currentProvider.value = provider;
  editingModels.value = JSON.parse(JSON.stringify(provider.models));
  newModelId.value = '';
  manageModelsDialogVisible.value = true;
}

function addModel(): void {
  if (!newModelId.value.trim()) return;

  editingModels.value.push({
    id: newModelId.value.trim(),
    name: newModelId.value.trim(),
    capabilities: ['chat']
  });

  newModelId.value = '';
}

function removeModel(index: number): void {
  editingModels.value.splice(index, 1);
}

async function saveModels(): Promise<void> {
  if (!currentProvider.value) return;

  try {
    await modelsStore.updateProvider(currentProvider.value.id, {
      ...currentProvider.value,
      models: editingModels.value
    });
    ElMessage.success(t('models.providerSaved'));
    manageModelsDialogVisible.value = false;
  } catch (error) {
    ElMessage.error(t('error.saveFailed'));
  }
}

async function handleAddProvider(): Promise<void> {
  isEditing.value = false;
  editingId.value = '';

  if (modelsStore.providerTemplates.length === 0) {
    await modelsStore.fetchProviderTemplates();
  }

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
    maxRetries: 3,
    modelId: ''
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
    maxRetries: provider.maxRetries || 3,
    modelId: provider.models && provider.models.length > 0 ? provider.models[0].id : ''
  });

  dialogVisible.value = true;
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return;

    submitting.value = true;
    try {
      const models = formData.modelId ? [{
        id: formData.modelId,
        name: formData.modelId,
        provider: formData.type,
        capabilities: ['chat']
      }] : [];

      const submitData = {
        ...formData,
        models
      };

      const cloned = JSON.parse(JSON.stringify(submitData));

      if (isEditing.value) {
        const result = await modelsStore.updateProvider(editingId.value, cloned);
        if (result) {
          ElMessage.success(t('models.providerSaved'));
          dialogVisible.value = false;
        }
      } else {
        const result = await modelsStore.addProvider(cloned);
        if (result) {
          ElMessage.success(t('models.providerAdded'));
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
    ElMessage.success(enabled ? t('models.enabled') : t('models.disabled'));
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

  if (result?.success) {
    setTimeout(async () => {
      const fetchResult = await modelsStore.fetchModels(id);
      if (fetchResult.success) {
        ElMessage.success(t('models.modelsFound', { count: fetchResult.models.length }));
      } else if (fetchResult.error) {
        ElMessage.warning(fetchResult.error);
      }
    }, 500);
  }
}

async function handleFetchModels(id: string): Promise<void> {
  const result = await modelsStore.fetchModels(id);
  if (result.success) {
    if (result.models.length > 0) {
      ElMessage.success(t('models.modelsFound', { count: result.models.length }));
    } else if (result.error) {
      ElMessage.warning(result.error);
    }
  } else if (result.error) {
    ElMessage.error(t('models.fetchFailed', { error: result.error }));
  }
}

async function handleDelete(id: string, name: string): Promise<void> {
  try {
    await ElMessageBox.confirm(
      t('models.deleteConfirmText', { name }),
      t('models.deleteConfirmTitle'),
      {
        confirmButtonText: t('dialog.deleteButton'),
        cancelButtonText: t('dialog.cancelButton'),
        type: t('dialog.warningType') as 'warning'
      }
    );

    const success = await modelsStore.deleteProvider(id);
    if (success) {
      ElMessage.success(t('models.providerDeleted'));
    }
  } catch (error) {
    void error;
  }
}
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.models-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--bg-secondary);
  box-sizing: border-box;
  overflow: hidden;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.page-title {
  font-size: var(--font-size-title-1);
  font-weight: var(--font-weight-semibold);
  color: var(--fg-primary);
  margin: 0;
  letter-spacing: -0.01em;
}

.provider-count {
  font-size: var(--font-size-callout);
  color: var(--fg-tertiary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.models-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.provider-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-2);
}

.provider-card {
  transition: all var(--duration-base) var(--ease-standard);
  position: relative;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-base);
  background: var(--bg-elevated);

  &.enabled {
    border-color: var(--accent-base);
    background: var(--accent-soft);
  }

  &.enabled::before {
    content: "";
    position: absolute;
    left: -1px; top: 6px; bottom: 6px;
    width: 3px;
    background: var(--accent-base);
    border-radius: 0 2px 2px 0;
  }

  :deep(.el-card__header) {
    padding: var(--space-2) var(--space-3);
    display: flex;
    align-items: center;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  :deep(.el-card__body) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-3);
  }

  :deep(.el-card__footer) {
    padding: var(--space-2) var(--space-3);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    border-top: 1px solid var(--border-subtle);
  }

  &.disabled {
    opacity: 0.85;

    .provider-name {
      color: var(--fg-secondary);
    }
  }
}

.provider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.provider-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

/* 4 档 provider icon 形状 (跟模型形状对齐) */
.provider-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-callout);
  font-weight: var(--font-weight-semibold);
  flex-shrink: 0;
  background: var(--accent-subtle);
  color: var(--accent-base);
  border-radius: var(--radius-md);
}

.provider-icon.shape-circle { border-radius: 50%; }
.provider-icon.shape-square { border-radius: 4px; }
.provider-icon.shape-hex { border-radius: 6px; }

.provider-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.provider-name {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  color: var(--fg-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.provider-type {
  font-size: var(--font-size-caption-1);
  color: var(--fg-tertiary);
}

.provider-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 0;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.model-count {
  font-size: var(--font-size-caption-1);
  color: var(--fg-tertiary);
}

.models-tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
  overflow-y: auto;
}

.model-cap-tag {
  font-size: 10px;
  color: var(--fg-tertiary);
  margin-left: 4px;
}

.more-models-tip {
  font-size: var(--font-size-caption-1);
  color: var(--fg-tertiary);
}

.no-models {
  font-size: var(--font-size-callout);
  color: var(--fg-tertiary);
  text-align: center;
  padding: var(--space-2);
}

.provider-actions {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
  justify-content: flex-end;
  width: 100%;
}

.form-tip {
  font-size: var(--font-size-caption-1);
  color: var(--fg-tertiary);
  margin-left: var(--space-2);
}

.model-list {
  max-height: 300px;
  overflow-y: auto;
}

.model-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2);
  margin-bottom: var(--space-1);
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
}

.model-name {
  font-size: var(--font-size-body);
}

.add-model {
  display: flex;
  align-items: center;
}
</style>