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
                {{ provider.enabled ? '已启用' : '已禁用' }}
              </el-tag>
              <span class="model-count">{{ provider.models.length }} 个模型</span>
            </div>

            <div class="models-tag-cloud" v-if="provider.models && provider.models.length > 0">
              <el-tag
                v-for="(model, index) in provider.models.slice(0, 8)"
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
                +{{ provider.models.length - 8 }} 个模型
              </span>
            </div>
            <div v-else class="no-models">
              <el-tooltip 
                :content="provider.type === 'volc_ark' ? '暂无模型配置，请手动添加' : '暂无模型配置'" 
                placement="top" 
                :disabled="(provider.type === 'volc_ark' ? '暂无模型配置，请手动添加' : '暂无模型配置').length <= 40"
              >
                <span>{{ truncateText(provider.type === 'volc_ark' ? '暂无模型配置，请手动添加' : '暂无模型配置', 40) }}</span>
              </el-tooltip>
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
              <el-button size="small" @click="handleManageModels(provider)">
                管理模型
              </el-button>
              <el-button
                v-if="!isVolcEngineProvider(provider)"
                size="small"
                @click="handleFetchModels(provider.id)"
              >
                拉取模型
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
      :title="isEditing ? '编辑供应商' : '添加供应商'"
      width="700px"
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

        <el-form-item v-if="!isEditing" label="类型" prop="type">
          <el-select v-model="formData.type" placeholder="选择提供商类型" @change="handleTypeChange">
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
          <div v-if="currentProviderType === 'volc_ark'" class="form-tip">
            <el-tooltip content="请输入火山方舟创建的长效 API Key（通常以 ark- 开头，而非 IAM 访问密钥）" placement="top" :disabled="'请输入火山方舟创建的长效 API Key（通常以 ark- 开头，而非 IAM 访问密钥）'.length <= 40">
              <span>{{ truncateText('请输入火山方舟创建的长效 API Key（通常以 ark- 开头，而非 IAM 访问密钥）', 40) }}</span>
            </el-tooltip>
          </div>
          <div v-if="currentProviderType === 'anthropic'" class="form-tip">
            <el-tooltip content="请输入 Anthropic API Key（从 console.anthropic.com 获取）" placement="top" :disabled="'请输入 Anthropic API Key（从 console.anthropic.com 获取）'.length <= 40">
              <span>{{ truncateText('请输入 Anthropic API Key（从 console.anthropic.com 获取）', 40) }}</span>
            </el-tooltip>
          </div>
        </el-form-item>

        <template v-if="currentProviderType === 'azure'">
          <el-form-item label="部署名称" prop="deploymentName">
            <el-input v-model="formData.deploymentName" placeholder="Azure 部署名称" />
          </el-form-item>
          <el-form-item label="API 版本" prop="apiVersion">
            <el-input v-model="formData.apiVersion" placeholder="例如：2024-02-01" />
          </el-form-item>
        </template>

        <template v-if="currentProviderType === 'anthropic'">
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

        <el-form-item label="模型ID" prop="modelId">
          <el-input v-model="formData.modelId" :placeholder="isVolcEngineForm() ? '请输入模型ID，如 doubao-pro-32k-240615 或 ark-code-latest' : '请输入模型ID'" />
          <div v-if="isVolcEngineForm()" class="form-tip">
            Coding Plan 支持的模型：doubao-pro-32k-240615, doubao-pro-4k-240515, doubao-lite-32k-240428, doubao-pro-128k-240615
          </div>
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
              <el-tooltip :content="testResult.error" placement="top" :disabled="testResult.error && testResult.error.length <= 40">
                <p>{{ testResult.error ? truncateText(testResult.error, 40) : '' }}</p>
              </el-tooltip>
            </div>
          </template>
        </el-result>
      </div>
    </el-dialog>

    <!-- 管理模型对话框 -->
    <el-dialog v-model="manageModelsDialogVisible" title="管理模型" width="600px">
      <div v-if="currentProvider">
        <div class="model-list">
          <el-empty v-if="editingModels.length === 0" description="暂无模型" />
          <div v-else>
            <div v-for="(model, index) in editingModels" :key="model.id" class="model-item">
              <span class="model-name">{{ model.name }}</span>
              <el-button size="small" type="danger" text @click="removeModel(index)">删除</el-button>
            </div>
          </div>
        </div>
        
        <el-divider />
        
        <div class="add-model">
          <el-input v-model="newModelId" placeholder="输入新模型ID" style="margin-right: var(--space-sm);" />
          <el-button type="primary" @click="addModel">添加模型</el-button>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="manageModelsDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="saveModels">保存</el-button>
      </template>
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

function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
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

const formRules = {
  name: [{ required: true, message: '请输入提供商名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择提供商类型', trigger: 'change' }],
  baseUrl: [{ required: true, message: '请输入 API 地址', trigger: 'blur' }]
};

const allProviderOptions = computed(() => {
  const templates = [...modelsStore.providerTemplates];
  // 确保自定义选项始终在最后
  if (!templates.find(t => t.type === 'custom')) {
    templates.push({ name: '自定义', type: 'custom', defaultConfig: {} });
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
  const selectedTemplate = modelsStore.providerTemplates.find(t => t.type === type);
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
    openai: 'OpenAI',
    anthropic: 'Anthropic Claude',
    deepseek: 'DeepSeek',
    azure: 'Azure OpenAI',
    ollama: 'Ollama 本地',
    openrouter: 'OpenRouter',
    volc_ark: '火山引擎',
    custom: '自定义',
    '智谱 AI': '智谱 AI',
    '月之暗面': '月之暗面 (Kimi)',
    'MiniMax': 'MiniMax',
    '零一万物': '零一万物',
    '百川智能': '百川智能',
    '阿里百炼': '阿里百炼',
    '硅基流动': '硅基流动'
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
    ElMessage.success('保存成功');
    manageModelsDialogVisible.value = false;
  } catch (error) {
    ElMessage.error('保存失败');
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
  
  // 回填基本信息
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
      // 创建模型数据
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

      if (isEditing.value) {
        const result = await modelsStore.updateProvider(editingId.value, submitData);
        if (result) {
          ElMessage.success('保存成功');
          dialogVisible.value = false;
        }
      } else {
        const result = await modelsStore.addProvider(submitData);
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

  if (result?.success) {
    setTimeout(async () => {
      const fetchResult = await modelsStore.fetchModels(id);
      if (fetchResult.success) {
        ElMessage.success(`发现 ${fetchResult.models.length} 个模型`);
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
      ElMessage.success(`发现 ${result.models.length} 个模型`);
    } else if (result.error) {
      ElMessage.warning(result.error);
    }
  } else if (result.error) {
    ElMessage.error(`获取模型列表失败: ${result.error}`);
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
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--content-padding);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.page-title {
  font-size: var(--font-size-title-1);
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
  margin: 0;
}

.provider-count {
  font-size: var(--font-size-body);
  color: var(--el-text-color-secondary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.models-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: var(--space-md);
}

.provider-card {
  transition: all var(--duration-base) var(--ease-standard);
  height: 200px;
  display: flex;
  flex-direction: column;
  padding: var(--space-md);

  :deep(.el-card__header) {
    height: var(--space-2xl);
    padding: 0;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  :deep(.el-card__body) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0;
  }

  :deep(.el-card__footer) {
    height: var(--button-height-lg);
    padding: 0;
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

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
  width: 100%;
}

.provider-info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.provider-icon {
  font-size: var(--space-xl);
}

.provider-title {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.provider-name {
  font-size: var(--font-size-title-2);
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
}

.provider-type {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-secondary);
}

.provider-body {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
  flex-shrink: 0;
}

.model-count {
  font-size: var(--font-size-callout);
  line-height: var(--line-height-normal);
  color: var(--el-text-color-secondary);
}

.models-tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  flex: 1;
  align-content: flex-start;

  :deep(.el-tag) {
    font-size: var(--font-size-caption-1);
    height: var(--button-height-sm);
  }
}

.model-cap-tag {
  font-size: var(--font-size-caption-1);
  margin-left: var(--space-xs);
  opacity: 0.8;
}

.more-models-tip {
  font-size: var(--font-size-callout);
  line-height: var(--line-height-normal);
  color: var(--el-text-color-secondary);
  padding: var(--space-xs) 0;
}

.no-models {
  font-size: var(--font-size-callout);
  line-height: var(--line-height-normal);
  color: var(--el-text-color-secondary);
  text-align: center;
  padding: var(--space-lg);
}

.provider-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
  flex-wrap: wrap;
  width: 100%;
}

.volc-tip {
  margin-bottom: var(--space-lg);
}

.model-row {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
  padding: var(--space-sm);
  background: var(--el-fill-color-light);
  border-radius: var(--radius-sm);

  :deep(.el-form-item) {
    margin-bottom: 0;
    flex: 1;
  }
}

.form-item-input {
  flex: 1;
}

.form-item-select {
  width: 100%;
}

.form-tip {
  margin-left: var(--space-sm);
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-callout);
  line-height: var(--line-height-normal);
}

.model-list {
  max-height: 300px;
  overflow-y: auto;
}

.model-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-sm);
  margin-bottom: var(--space-sm);
  background: var(--el-fill-color-light);
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
