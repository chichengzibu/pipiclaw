<template>
  <div class="settings-page">
    <div class="page-header">
      <h1 class="page-title">系统设置</h1>
    </div>

    <div class="settings-content">
      <el-tabs v-model="activeTab" class="settings-tabs">
        <el-tab-pane label="基础设置" name="basic">
          <div class="tab-content">
            <el-card class="settings-card">
              <el-form label-width="140px">
                <el-form-item label="选择主题">
                  <el-select v-model="selectedTheme" placeholder="请选择主题" @change="handleThemeChange">
                    <el-option 
                      v-for="theme in appStore.availableThemes" 
                      :key="theme.key"
                      :label="theme.name" 
                      :value="theme.key"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="新手引导">
                  <el-button type="primary" size="small" @click="appStore.openGuide">
                    重新打开新手引导
                  </el-button>
                </el-form-item>
              </el-form>
            </el-card>

            <el-card class="settings-card">
              <template #header><span>快捷键设置</span></template>
              <el-form label-width="140px">
                <el-form-item label="全局唤起快捷键">
                  <ShortcutRecorder 
                    v-model="shortcutConfig.toggle" 
                    default-accelerator="Ctrl+Alt+P" 
                  />
                  <div class="form-tip">按 Ctrl+Alt+P（Windows）或 Cmd+Option+P（macOS）快速唤起/隐藏窗口</div>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="saveShortcutConfig">保存设置</el-button>
                  <el-button @click="resetShortcutConfig">恢复默认</el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </div>
        </el-tab-pane>

        <el-tab-pane label="模型管理" name="models">
          <div class="tab-content">
            <div class="section-header">
              <div class="section-info">
                <span class="provider-count">{{ modelsStore.enabledCount }}/{{ modelsStore.totalCount }} 已启用</span>
              </div>
              <el-button type="primary" @click="handleAddProvider">
                <el-icon><Plus /></el-icon>
                添加提供商
              </el-button>
            </div>

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
                      @change="(val: boolean) => handleToggleProvider(provider.id, val)"
                      :loading="isTogglingProvider(provider.id)"
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
                      @click="handleTestProvider(provider.id)"
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
                    <el-button size="small" @click="handleEditProvider(provider)">
                      编辑
                    </el-button>
                    <el-button
                      size="small"
                      type="danger"
                      text
                      @click="handleDeleteProvider(provider.id, provider.name)"
                    >
                      删除
                    </el-button>
                  </div>
                </template>
              </el-card>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="MCP 配置" name="mcp">
          <div class="tab-content">
            <div class="section-header">
              <span class="mcp-count">{{ mcpServers.length }} 个已配置</span>
              <el-button type="primary" @click="openAddDialog">
                <el-icon><Plus /></el-icon>
                添加 MCP Server
              </el-button>
            </div>

            <el-empty v-if="mcpServers.length === 0" description="暂无 MCP Server 配置">
              <el-button type="primary" @click="openAddDialog">添加 MCP Server</el-button>
            </el-empty>

            <div v-else class="mcp-grid">
              <McpServerCard
                v-for="server in mcpServers"
                :key="server.name"
                :server="server"
                @edit="openEditDialog(server)"
                @delete="handleDeleteServer(server.name)"
                @test="handleTestServer(server.name)"
              />
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="记忆管理" name="memory">
          <div class="tab-content">
            <el-card class="settings-card">
              <el-form label-width="120px">
                <el-form-item label="核心记忆">
                  <el-input 
                    v-model="hermesMemoryStore.editingCoreMemory" 
                    type="textarea" 
                    :rows="6"
                    placeholder="存储用户偏好、习惯、固定规则"
                    @input="handleCoreMemoryChange" 
                  />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" size="small" @click="saveCoreMemory">
                    保存核心记忆
                  </el-button>
                  <el-button size="small" type="danger" @click="clearAllMemories">
                    清空所有记忆
                  </el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 模型管理对话框 -->
    <el-dialog
      v-model="modelDialogVisible"
      :title="isEditingModel ? '编辑提供商' : '添加提供商'"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="modelFormRef"
        :model="modelFormData"
        :rules="modelFormRules"
        label-width="120px"
      >
        <el-form-item label="提供商名称" prop="name">
          <el-input v-model="modelFormData.name" placeholder="例如：OpenAI" />
        </el-form-item>

        <el-form-item label="类型" prop="type">
          <el-select v-model="modelFormData.type" placeholder="选择提供商类型" @change="handleTypeChange">
            <el-option 
              v-for="template in allProviderOptions" 
              :key="template.type" 
              :value="template.type"
            >
              <span style="margin-right: 8px;">{{ getProviderIcon(template.type) }}</span>
              {{ template.name }}
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item label="API 地址" prop="baseUrl">
          <el-input v-model="modelFormData.baseUrl" placeholder="API Base URL" />
        </el-form-item>

        <el-form-item label="API Key" prop="apiKey">
          <el-input
            v-model="modelFormData.apiKey"
            type="password"
            show-password
            placeholder="输入 API Key"
          />
          <div v-if="modelFormData.type === 'volc_ark'" class="form-tip">
            请输入火山方舟 API Key（通常以 ark- 开头）
          </div>
          <div v-if="modelFormData.type === 'anthropic'" class="form-tip">
            请输入 Anthropic API Key（从 console.anthropic.com 获取）
          </div>
        </el-form-item>

        <template v-if="modelFormData.type === 'azure'">
          <el-form-item label="部署名称" prop="deploymentName">
            <el-input v-model="modelFormData.deploymentName" placeholder="Azure 部署名称" />
          </el-form-item>
          <el-form-item label="API 版本" prop="apiVersion">
            <el-input v-model="modelFormData.apiVersion" placeholder="例如：2024-02-01" />
          </el-form-item>
        </template>

        <template v-if="modelFormData.type === 'anthropic'">
          <el-form-item label="组织 ID" prop="organization">
            <el-input v-model="modelFormData.organization" placeholder="可选" />
          </el-form-item>
        </template>

        <el-form-item label="超时时间" prop="timeout">
          <el-input-number
            v-model="modelFormData.timeout"
            :min="5000"
            :max="300000"
            :step="5000"
          />
          <span class="form-tip">毫秒</span>
        </el-form-item>

        <el-form-item label="模型ID">
          <el-input v-model="modelFormData.modelId" :placeholder="isVolcEngineForm() ? '请输入模型ID，如 doubao-pro-32k-240615 或 ark-code-latest' : '请输入模型ID'" />
          <div v-if="isVolcEngineForm()" class="form-tip">
            Coding Plan 支持的模型：doubao-pro-32k-240615, doubao-pro-4k-240515, doubao-lite-32k-240428, doubao-pro-128k-240615
          </div>
        </el-form-item>

        <el-form-item label="启用">
          <el-switch v-model="modelFormData.enabled" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="modelDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="modelSubmitting" @click="handleModelSubmit">
          {{ isEditingModel ? '保存' : '添加' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 模型测试结果对话框 -->
    <el-dialog v-model="modelTestDialogVisible" title="连接测试结果" width="400px">
      <div v-if="modelTestResult">
        <el-result
          :icon="modelTestResult.success ? 'success' : 'error'"
          :title="modelTestResult.success ? '连接成功' : '连接失败'"
        >
          <template #sub-title>
            <div v-if="modelTestResult.success">
              <p>响应时间: {{ modelTestResult.latency }}ms</p>
            </div>
            <div v-else>
              <p>{{ modelTestResult.error }}</p>
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
          <el-input v-model="newModelId" placeholder="输入新模型ID" style="margin-right: 8px;" />
          <el-button type="primary" @click="addModel">添加模型</el-button>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="manageModelsDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveModels">保存</el-button>
      </template>
    </el-dialog>

    <!-- MCP Server 表单对话框 -->
    <McpServerFormDialog
      v-model="mcpDialogVisible"
      :server="editingServer"
      @save="handleSaveMcp"
    />

    <FeedbackModal v-model="showFeedbackModal" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import ShortcutRecorder from '@/components/settings/ShortcutRecorder.vue';
import FeedbackModal from '@/components/common/FeedbackModal.vue';
import McpServerCard from '@/components/settings/McpServerCard.vue';
import McpServerFormDialog from '@/components/settings/McpServerFormDialog.vue';
import { useAppStore } from '@/stores/app';
import { useHermesMemoryStore } from '@/stores/hermesMemory';
import { useModelsStore, PROVIDER_DEFAULTS, type ProviderConfig, type ProviderFormData } from '@/stores/models';
import { Plus } from '@element-plus/icons-vue';

const appStore = useAppStore();
const hermesMemoryStore = useHermesMemoryStore();
const modelsStore = useModelsStore();

const activeTab = ref('basic');
const selectedTheme = ref(appStore.currentTheme);
const showFeedbackModal = ref(false);

const shortcutConfig = ref({ toggle: 'Ctrl+Alt+P' });

// 模型管理相关
const modelDialogVisible = ref(false);
const modelTestDialogVisible = ref(false);
const modelSubmitting = ref(false);
const isEditingModel = ref(false);
const editingModelId = ref('');
const modelFormRef = ref();
const modelTestResult = ref<{ success: boolean; latency?: number; error?: string } | null>(null);
const togglingProviders = ref<Set<string>>(new Set());

const modelFormData = reactive<ProviderFormData & { modelId: string }>({
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

// 管理模型对话框相关
const manageModelsDialogVisible = ref(false);
const currentProvider = ref<ProviderConfig | null>(null);
const editingModels = ref<any[]>([]);
const newModelId = ref('');

function isVolcEngineProvider(provider: ProviderConfig): boolean {
  return provider.type === 'volc_ark' || (provider.baseUrl && provider.baseUrl.includes('coding/v3'));
}

function isVolcEngineForm(): boolean {
  return modelFormData.type === 'volc_ark' || (modelFormData.baseUrl && modelFormData.baseUrl.includes('coding/v3'));
}

const modelFormRules = {
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

// MCP 配置相关
const mcpServers = ref<any[]>([]);
const mcpDialogVisible = ref(false);
const editingServer = ref<any>(null);

const handleThemeChange = (themeKey: string): void => {
  appStore.setTheme(themeKey);
  ElMessage.success('主题已切换');
};

async function loadShortcutConfig(): Promise<void> {
  try {
    if ((window as any).electronAPI?.shortcut) {
      const result = await (window as any).electronAPI.shortcut.get();
      if (result?.success && result?.data) {
        // 确保返回的数据有有效的值，否则使用默认值
        shortcutConfig.value = {
          toggle: result.data.toggle || 'Ctrl+Alt+P'
        };
      }
    }
  } catch (error) {
    console.error('加载快捷键配置失败:', error);
  }
}

async function saveShortcutConfig(): Promise<void> {
  try {
    if ((window as any).electronAPI?.shortcut) {
      const result = await (window as any).electronAPI.shortcut.set('toggle', shortcutConfig.value.toggle);
      if (result?.success) {
        ElMessage.success('快捷键设置已保存');
      } else {
        ElMessage.error(result?.error || '保存失败');
      }
    }
  } catch (error) {
    console.error('保存快捷键配置失败:', error);
    ElMessage.error('保存失败');
  }
}

function resetShortcutConfig(): void {
  shortcutConfig.value.toggle = 'Ctrl+Alt+P';
  saveShortcutConfig();
}

let memorySaveTimer: any = null;
function handleCoreMemoryChange(value: string): void {
  if (memorySaveTimer) {
    clearTimeout(memorySaveTimer);
  }
  memorySaveTimer = setTimeout(async () => {
    await hermesMemoryStore.updateCoreMemory(value);
  }, 500);
}

async function saveCoreMemory(): Promise<void> {
  await hermesMemoryStore.updateCoreMemory(hermesMemoryStore.editingCoreMemory);
  ElMessage.success('核心记忆已保存');
}

async function clearAllMemories(): Promise<void> {
  try {
    await ElMessageBox.confirm('确定要清空所有记忆吗？此操作不可恢复！', '清空确认', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning'
    });
    hermesMemoryStore.setCoreMemory('');
    hermesMemoryStore.setExperienceMemory('');
    hermesMemoryStore.setMemories([]);
    hermesMemoryStore.editingCoreMemory = '';
    await hermesMemoryStore.saveCoreMemory('');
    ElMessage.success('所有记忆已清空');
  } catch {}
}

function getProviderIcon(type: string): string {
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

function getProviderTypeName(type: string): string {
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
  return names[type] || type;
}

function handleTypeChange(type: string): void {
  const selectedTemplate = modelsStore.providerTemplates.find(t => t.type === type);
  if (selectedTemplate) {
    modelFormData.name = selectedTemplate.defaultConfig.name || '';
    modelFormData.baseUrl = selectedTemplate.defaultConfig.baseUrl || '';
    modelFormData.timeout = selectedTemplate.defaultConfig.timeout || 60000;
    modelFormData.maxRetries = selectedTemplate.defaultConfig.maxRetries || 3;
  } else if (type === 'custom') {
    modelFormData.name = '';
    modelFormData.baseUrl = '';
  } else {
    const defaults = PROVIDER_DEFAULTS[type as keyof typeof PROVIDER_DEFAULTS];
    if (defaults) {
      modelFormData.baseUrl = defaults.baseUrl || '';
      modelFormData.timeout = defaults.timeout || 60000;
      modelFormData.maxRetries = defaults.maxRetries || 3;
      if (defaults.name) {
        modelFormData.name = modelFormData.name || defaults.name;
      }
    }
  }
}

async function handleAddProvider(): Promise<void> {
  isEditingModel.value = false;
  editingModelId.value = '';
  
  // 确保 providerTemplates 数据已加载
  if (modelsStore.providerTemplates.length === 0) {
    await modelsStore.fetchProviderTemplates();
  }
  
  Object.assign(modelFormData, {
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
  modelDialogVisible.value = true;
}

function handleEditProvider(provider: ProviderConfig): void {
  isEditingModel.value = true;
  editingModelId.value = provider.id;
  Object.assign(modelFormData, {
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
  modelDialogVisible.value = true;
}

async function handleModelSubmit(): Promise<void> {
  if (!modelFormRef.value) return;

  await modelFormRef.value.validate(async (valid: boolean) => {
    if (!valid) return;

    modelSubmitting.value = true;
    try {
      // 构建要提交的数据
      const models = modelFormData.modelId ? [{
        id: modelFormData.modelId,
        name: modelFormData.modelId,
        capabilities: ['chat']
      }] : [];
      
      const submitData = { 
        ...modelFormData,
        models 
      };

      // 深拷贝表单数据，避免 Vue 响应式对象无法被 Electron IPC 序列化
      const clonedFormData = JSON.parse(JSON.stringify(submitData));
      
      if (isEditingModel.value) {
        const result = await modelsStore.updateProvider(editingModelId.value, clonedFormData);
        if (result) {
          ElMessage.success('保存成功');
          modelDialogVisible.value = false;
        }
      } else {
        const result = await modelsStore.addProvider(clonedFormData);
        if (result) {
          ElMessage.success('添加成功');
          modelDialogVisible.value = false;
        }
      }
    } finally {
      modelSubmitting.value = false;
    }
  });
}

async function handleToggleProvider(id: string, enabled: boolean): Promise<void> {
  togglingProviders.value.add(id);
  try {
    await modelsStore.toggleProvider(id, enabled);
    ElMessage.success(enabled ? '已启用' : '已禁用');
  } finally {
    togglingProviders.value.delete(id);
  }
}

function isTogglingProvider(id: string): boolean {
  return togglingProviders.value.has(id);
}

async function handleTestProvider(id: string): Promise<void> {
  const result = await modelsStore.testProvider(id);
  modelTestResult.value = result;
  modelTestDialogVisible.value = true;
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

async function handleSyncOllama(id: string): Promise<void> {
  const success = await modelsStore.syncOllamaModels(id);
  if (success) {
    ElMessage.success('模型同步成功');
  }
}

async function handleDeleteProvider(id: string, name: string): Promise<void> {
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
  } catch {}
}

async function loadMcpServers(): Promise<void> {
  try {
    const result = await (window as any).electronAPI?.mcp?.list();
    if (result?.success && result?.data) {
      mcpServers.value = result.data;
    }
  } catch (error) {
    console.error('加载 MCP Server 失败:', error);
  }
}

function openAddDialog(): void {
  editingServer.value = null;
  mcpDialogVisible.value = true;
}

function openEditDialog(server: any): void {
  editingServer.value = { ...server };
  mcpDialogVisible.value = true;
}

async function handleSaveMcp(data: any): Promise<void> {
  try {
    let result;
    if (data.isEdit) {
      result = await (window as any).electronAPI?.mcp?.update(data);
    } else {
      result = await (window as any).electronAPI?.mcp?.add(data);
    }

    if (result?.success) {
      ElMessage.success(data.isEdit ? '更新成功' : '添加成功');
      mcpDialogVisible.value = false;
      loadMcpServers();
    } else {
      ElMessage.error(result?.error || '保存失败');
    }
  } catch (error) {
    console.error('保存 MCP Server 失败:', error);
    ElMessage.error('保存失败');
  }
}

async function handleDeleteServer(name: string): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定要删除 MCP Server "${name}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const result = await (window as any).electronAPI?.mcp?.remove(name);
    if (result?.success) {
      ElMessage.success('删除成功');
      loadMcpServers();
    }
  } catch {}
}

async function handleTestServer(name: string): Promise<void> {
  try {
    const result = await (window as any).electronAPI?.mcp?.test(name);
    if (result?.success) {
      ElMessage.success('连接测试成功');
    } else {
      ElMessage.error('连接测试失败: ' + (result?.error || '未知错误'));
    }
  } catch (error) {
    console.error('测试 MCP Server 连接失败:', error);
    ElMessage.error('连接测试失败');
  }
}

onMounted(async () => {
  loadShortcutConfig();
  hermesMemoryStore.fetchMemories();
  await Promise.all([
    modelsStore.fetchProviders(),
    modelsStore.fetchProviderTemplates()
  ]);
  await loadMcpServers();
});
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.settings-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--page-bg) !important;
  color: var(--text-primary) !important;
}

.page-header {
  margin-bottom: $content-padding;
  flex-shrink: 0;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary) !important;
  margin: 0;
}

.settings-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background-color: var(--page-bg) !important;
}

.settings-tabs {
  height: 100%;

  :deep(.el-tabs__header) {
    margin: 0;
  }

  :deep(.el-tabs__content) {
    height: calc(100% - 60px);
    overflow-y: auto;
    padding-top: $content-padding;
  }
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: $content-padding;
  padding: 0 $content-padding;
}

.settings-card {
  background-color: var(--card-bg) !important;
  border-color: var(--border-color) !important;
  color: var(--text-primary) !important;

  :deep(.el-card__header) {
    border-color: var(--border-color) !important;
  }
}

.settings-card :deep(.el-form-item__label) {
  color: var(--text-primary) !important;
}

.settings-card :deep(.el-input__wrapper) {
  background-color: var(--card-bg) !important;
  color: var(--text-primary) !important;
  border-color: var(--border-color) !important;
}

.form-tip {
  font-size: 12px;
  color: var(--text-secondary) !important;
  margin-left: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.provider-count, .mcp-count {
  font-size: 14px;
  color: var(--text-secondary);
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
  color: var(--text-primary);
}

.provider-type {
  font-size: 12px;
  color: var(--text-secondary);
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
  color: var(--text-secondary);
}

.models-list {
  max-height: 300px;
}

.models-scrollbar {
  max-height: 300px;
}

.model-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--border-color);
  border-radius: 4px;

  &.default {
    border: 1px solid var(--el-color-primary-light-5);
    background: var(--el-color-primary-light-9);
  }
}

.model-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.model-capabilities {
  display: flex;
  gap: 4px;
}

.no-models {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  padding: 20px;
}

.provider-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.model-list {
  max-height: 300px;
  overflow-y: auto;
}

.model-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 8px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.model-name {
  font-size: 14px;
}

.add-model {
  display: flex;
  align-items: center;
}

.mcp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: $content-padding;
}
</style>
