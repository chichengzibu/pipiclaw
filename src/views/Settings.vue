<template>
  <div class="settings-page">
    <div class="page-header">
      <h1 class="page-title">{{ t('settings.title') }}</h1>
    </div>

    <div class="settings-content">
      <el-tabs v-model="activeTab" class="settings-tabs">
        <el-tab-pane :label="t('settings.basicTab')" name="basic">
          <div class="tab-content">
            <el-card class="settings-card">
              <el-form label-width="140px">
                <el-form-item :label="t('settings.selectTheme')">
                  <el-radio-group v-model="selectedTheme" @change="handleThemeChange">
                    <el-radio-button value="light">☀️ 浅色</el-radio-button>
                    <el-radio-button value="dark">🌙 深色</el-radio-button>
                    <el-radio-button value="system">🖥️ 跟随系统</el-radio-button>
                  </el-radio-group>
                </el-form-item>
                <el-form-item :label="t('settings.guide')">
                  <el-button type="primary" size="small" @click="appStore.openGuide">
                    {{ t('settings.openGuide') }}
                  </el-button>
                </el-form-item>
                <!-- P4-T5.4: 反馈按钮 → 自动附加崩溃报告 -->
                <el-form-item :label="t('settings.feedback')">
                  <el-button type="warning" size="small" @click="showFeedbackModal = true">
                    {{ t('settings.openFeedback') }}
                  </el-button>
                </el-form-item>
              </el-form>
            </el-card>

            <el-card class="settings-card">
              <template #header><span>{{ t('settings.shortcut') }}</span></template>
              <el-form label-width="140px">
                <el-form-item :label="t('settings.globalShortcut')">
                  <ShortcutRecorder
                    v-model="shortcutConfig.toggle"
                    default-accelerator="Ctrl+Alt+P"
                  />
                  <div class="form-tip">{{ t('settings.shortcutTip') }}</div>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="saveShortcutConfig">{{ t('settings.saveShortcut') }}</el-button>
                  <el-button @click="resetShortcutConfig">{{ t('settings.resetShortcut') }}</el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="t('settings.modelsTab')" name="models">
          <div class="tab-content">
            <div class="section-header">
              <div class="section-info">
                <span class="provider-count">{{ modelsStore.enabledCount }}/{{ modelsStore.totalCount }} {{ t('models.enabled') }}</span>
              </div>
              <el-button type="primary" @click="handleAddProvider">
                <el-icon><Plus /></el-icon>
                {{ t('models.addProvider') }}
              </el-button>
            </div>

            <el-empty v-if="modelsStore.providers.length === 0" :description="t('models.noProviders')">
              <el-button type="primary" @click="handleAddProvider">{{ t('models.addProvider') }}</el-button>
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
                      {{ provider.enabled ? t('models.enabled') : t('models.disabled') }}
                    </el-tag>
                    <span class="model-count">{{ t('models.modelsCount', { count: provider.models.length }) }}</span>
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
                            v-for="cap in (model.capabilities || []).slice(0, 2)"
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
                    {{ t('models.noModels') }}
                  </div>
                </div>

                <template #footer>
                  <div class="provider-actions">
                    <el-button
                      size="small"
                      :loading="modelsStore.isTesting(provider.id)"
                      @click="handleTestProvider(provider.id)"
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
                    <el-button size="small" @click="handleEditProvider(provider)">
                      {{ t('common.edit') }}
                    </el-button>
                    <el-button
                      size="small"
                      type="danger"
                      text
                      @click="handleDeleteProvider(provider.id, provider.name)"
                    >
                      {{ t('common.delete') }}
                    </el-button>
                  </div>
                </template>
              </el-card>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="t('settings.mcpTab')" name="mcp">
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

        <el-tab-pane :label="t('settings.memoryTab')" name="memory">
          <div class="tab-content">
            <el-card class="settings-card">
              <el-form label-width="120px">
                <el-form-item :label="t('settings.coreMemory')">
                  <el-input
                    v-model="hermesMemoryStore.editingCoreMemory"
                    type="textarea"
                    :rows="6"
                    :placeholder="t('settings.coreMemoryPlaceholder')"
                    @input="handleCoreMemoryChange"
                  />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" size="small" @click="saveCoreMemory">
                    {{ t('settings.saveCoreMemory') }}
                  </el-button>
                  <el-button size="small" type="danger" @click="clearAllMemories">
                    {{ t('settings.clearAllMemory') }}
                  </el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="t('settings.aboutTab')" name="about">
          <div class="tab-content">
            <el-card class="settings-card">
              <template #header><span>{{ t('about.appInfo') }}</span></template>
              <el-form label-width="120px">
                <el-form-item :label="t('about.currentVersion')">
                  <span class="version-text">{{ appVersion || t('about.loadingVersion') }}</span>
                </el-form-item>
                <el-form-item :label="t('about.updateStatus')">
                  <el-tag v-if="updateStatus === 'idle'" type="info" effect="plain">{{ t('about.updateIdle') }}</el-tag>
                  <el-tag v-else-if="updateStatus === 'checking'" type="info" effect="plain">{{ t('about.updateChecking') }}</el-tag>
                  <el-tag v-else-if="updateStatus === 'up-to-date'" type="success" effect="plain">{{ t('about.updateUpToDate') }}</el-tag>
                  <el-tag v-else-if="updateStatus === 'available'" type="warning" effect="plain">{{ t('about.updateAvailable', { version: availableVersion }) }}</el-tag>
                  <el-tag v-else-if="updateStatus === 'downloading'" type="warning" effect="plain">{{ t('about.updateDownloading') }}</el-tag>
                  <el-tag v-else-if="updateStatus === 'downloaded'" type="success" effect="plain">{{ t('about.updateDownloaded') }}</el-tag>
                  <el-tag v-else-if="updateStatus === 'error'" type="danger" effect="plain">{{ t('about.updateError') }}</el-tag>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" :loading="isChecking" @click="handleCheckUpdate">{{ t('about.checkUpdate') }}</el-button>
                  <el-button
                    v-if="updateStatus === 'available'"
                    type="primary"
                    :loading="isDownloading"
                    @click="handleDownloadUpdate"
                  >
{{ t('about.downloadUpdate', { version: availableVersion }) }}
</el-button>
                  <el-button
                    v-if="updateStatus === 'downloaded'"
                    type="success"
                    @click="handleInstallUpdate"
                  >
{{ t('about.installUpdate') }}
</el-button>
                </el-form-item>
                <el-form-item v-if="updateError" label=" ">
                  <div class="error-text">{{ updateError }}</div>
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
      :title="isEditingModel ? t('models.editProvider') : t('models.addProvider')"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="modelFormRef"
        :model="modelFormData"
        :rules="modelFormRules"
        label-width="120px"
      >
        <el-form-item :label="t('models.providerName')" prop="name">
          <el-input v-model="modelFormData.name" :placeholder="t('models.providerNamePlaceholder')" />
        </el-form-item>

        <el-form-item :label="t('models.type')" prop="type">
          <el-select v-model="modelFormData.type" :placeholder="t('models.selectType')" @change="handleTypeChange">
            <el-option
              v-for="template in allProviderOptions"
              :key="template.type"
              :value="template.type"
            >
              <span style="margin-right: var(--space-sm);">{{ getProviderIcon(template.type) }}</span>
              {{ template.name }}
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item :label="t('models.apiUrl')" prop="baseUrl">
          <el-input v-model="modelFormData.baseUrl" :placeholder="t('models.apiUrlPlaceholder')" />
        </el-form-item>

        <el-form-item :label="t('models.apiKey')" prop="apiKey">
          <el-input
            v-model="modelFormData.apiKey"
            type="password"
            show-password
            :placeholder="t('models.apiKeyPlaceholder')"
          />
          <div v-if="modelFormData.type === 'volc_ark'" class="form-tip">
            {{ t('models.apiKeyVolcTip') }}
          </div>
          <div v-if="modelFormData.type === 'anthropic'" class="form-tip">
            {{ t('models.apiKeyAnthropicTip') }}
          </div>
        </el-form-item>

        <template v-if="modelFormData.type === 'azure'">
          <el-form-item :label="t('models.deploymentName')" prop="deploymentName">
            <el-input v-model="modelFormData.deploymentName" :placeholder="t('models.deploymentPlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('models.apiVersion')" prop="apiVersion">
            <el-input v-model="modelFormData.apiVersion" :placeholder="t('models.apiVersionPlaceholder')" />
          </el-form-item>
        </template>

        <template v-if="modelFormData.type === 'anthropic'">
          <el-form-item :label="t('models.organization')" prop="organization">
            <el-input v-model="modelFormData.organization" :placeholder="t('models.organizationPlaceholder')" />
          </el-form-item>
        </template>

        <el-form-item :label="t('models.timeout')" prop="timeout">
          <el-input-number
            v-model="modelFormData.timeout"
            :min="5000"
            :max="300000"
            :step="5000"
          />
          <span class="form-tip">{{ t('models.timeoutUnit') }}</span>
        </el-form-item>

        <el-form-item :label="t('models.modelId')">
          <el-input v-model="modelFormData.modelId" :placeholder="isVolcEngineForm() ? t('models.modelIdPlaceholder') : t('models.modelIdPlaceholderNormal')" />
          <div v-if="isVolcEngineForm()" class="form-tip">
            {{ t('models.volcCodingPlanHint') }}
          </div>
        </el-form-item>

        <el-form-item :label="t('models.enabled_')">
          <el-switch v-model="modelFormData.enabled" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="modelDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="modelSubmitting" @click="handleModelSubmit">
          {{ isEditingModel ? t('common.save') : t('common.add') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 模型测试结果对话框 -->
    <el-dialog v-model="modelTestDialogVisible" :title="t('models.testResultTitle')" width="400px">
      <div v-if="modelTestResult">
        <el-result
          :icon="modelTestResult.success ? 'success' : 'error'"
          :title="modelTestResult.success ? t('models.connectionSuccess') : t('models.connectionFailed')"
        >
          <template #sub-title>
            <div v-if="modelTestResult.success">
              <p>{{ t('models.latencyMs', { ms: modelTestResult.latency }) }}</p>
            </div>
            <div v-else>
              <p>{{ modelTestResult.error }}</p>
            </div>
          </template>
        </el-result>
      </div>
    </el-dialog>

    <!-- 管理模型对话框 -->
    <el-dialog v-model="manageModelsDialogVisible" :title="t('models.manageModelsTitle')" width="600px">
      <div v-if="currentProvider">
        <div class="model-list">
          <el-empty v-if="editingModels.length === 0" description="暂无模型" />
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
        <el-button @click="manageModelsDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveModels">{{ t('common.save') }}</el-button>
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
import { useI18n } from 'vue-i18n';
import ShortcutRecorder from '@/components/settings/ShortcutRecorder.vue';
import FeedbackModal from '@/components/common/FeedbackModal.vue';
import McpServerCard from '@/components/settings/McpServerCard.vue';
import McpServerFormDialog from '@/components/settings/McpServerFormDialog.vue';
import { useAppStore } from '@/stores/app';
import { useHermesMemoryStore } from '@/stores/hermesMemory';
import { useModelsStore, PROVIDER_DEFAULTS, type ProviderConfig, type ProviderFormData } from '@/stores/models';
import { Plus } from '@element-plus/icons-vue';

const { t } = useI18n();

const appStore = useAppStore();
const hermesMemoryStore = useHermesMemoryStore();
const modelsStore = useModelsStore();

const activeTab = ref('basic');
const selectedTheme = ref(appStore.themeMode);
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
  return provider.type === 'volc_ark' || Boolean(provider.baseUrl && provider.baseUrl.includes('coding/v3'));
}

function isVolcEngineForm(): boolean {
  return modelFormData.type === 'volc_ark' || Boolean(modelFormData.baseUrl && modelFormData.baseUrl.includes('coding/v3'));
}

const modelFormRules = computed(() => ({
  name: [{ required: true, message: t('models.pleaseEnterName'), trigger: 'blur' }],
  type: [{ required: true, message: t('models.pleaseSelectType'), trigger: 'change' }],
  baseUrl: [{ required: true, message: t('models.pleaseEnterApiUrl'), trigger: 'blur' }]
}));

const allProviderOptions = computed(() => {
  const templates = [...modelsStore.providerTemplates];
  // 确保自定义选项始终在最后
  if (!templates.find(t => t.type === 'custom')) {
    templates.push({ name: t('models.customOption'), type: 'custom', defaultConfig: {} });
  }
  return templates;
});

// MCP 配置相关
const mcpServers = ref<any[]>([]);
const mcpDialogVisible = ref(false);
const editingServer = ref<any>(null);

// 关于 / 自动更新
const appVersion = ref('');
type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'downloaded' | 'error';
const updateStatus = ref<UpdateStatus>('idle');
const availableVersion = ref('');
const updateError = ref('');
const isChecking = ref(false);
const isDownloading = ref(false);

const handleThemeChange = (themeKey: 'light' | 'dark' | 'system'): void => {
  appStore.setTheme(themeKey);
  ElMessage.success(t('settings.themeChanged'));
};

async function loadShortcutConfig(): Promise<void> {
  try {
    if ((window as any).electronAPI?.shortcut) {
      const result = await (window as any).electronAPI.shortcut.get();
      if (result?.success && result?.data) {
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
        ElMessage.success(t('settings.shortcutSaved'));
      } else {
        ElMessage.error(result?.error || t('settings.saveFailed'));
      }
    }
  } catch (error) {
    console.error('保存快捷键配置失败:', error);
    ElMessage.error(t('settings.saveFailed'));
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
  ElMessage.success(t('settings.coreMemorySaved'));
}

async function clearAllMemories(): Promise<void> {
  try {
    await ElMessageBox.confirm(t('dialog.confirmClearMemory'), t('dialog.clearMemoryTitle'), {
      confirmButtonText: t('dialog.clearMemoryButton'),
      cancelButtonText: t('dialog.cancelButton'),
      type: t('dialog.warningType') as 'warning'
    });
    hermesMemoryStore.setCoreMemory('');
    hermesMemoryStore.setExperienceMemory('');
    hermesMemoryStore.setMemories([]);
    hermesMemoryStore.editingCoreMemory = '';
    await hermesMemoryStore.saveCoreMemory('');
    ElMessage.success(t('settings.memoriesCleared'));
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
  const map: Record<string, string> = {
    openai: t('models.typeOpenai'),
    anthropic: t('models.typeAnthropic'),
    deepseek: t('models.typeDeepseek'),
    azure: t('models.typeAzure'),
    ollama: t('models.typeOllama'),
    openrouter: t('models.typeOpenrouter'),
    volc_ark: t('models.typeVolcArk'),
    custom: t('models.typeCustom')
  };
  return map[type] || type;
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
          ElMessage.success(t('models.providerSaved'));
          modelDialogVisible.value = false;
        }
      } else {
        const result = await modelsStore.addProvider(clonedFormData);
        if (result) {
          ElMessage.success(t('models.providerAdded'));
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
    ElMessage.success(enabled ? t('models.enabled') : t('models.disabled'));
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
      ElMessage.success(t('models.modelsFound', { count: result.models.length }));
    } else if (result.error) {
      ElMessage.warning(result.error);
    }
  } else if (result.error) {
    ElMessage.error(t('models.fetchFailed', { error: result.error }));
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
    ElMessage.success(t('models.providerSaved'));
    manageModelsDialogVisible.value = false;
  } catch (error) {
    ElMessage.error(t('settings.saveFailed'));
  }
}

async function handleDeleteProvider(id: string, name: string): Promise<void> {
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

// ============ 关于 / 自动更新 ============

async function loadAppVersion(): Promise<void> {
  try {
    const result = await (window as any).electronAPI?.autoUpdater?.getVersion?.();
    if (result?.success && typeof result.data === 'string') {
      appVersion.value = result.data;
    } else {
      const v = await (window as any).electronAPI?.app?.getVersion?.();
      if (v?.success && typeof v.data === 'string') {
        appVersion.value = v.data;
      }
    }
  } catch (e) {
    console.error('加载版本号失败:', e);
  }
}

async function handleCheckUpdate(): Promise<void> {
  const api = (window as any).electronAPI?.autoUpdater;
  if (!api?.check) {
    ElMessage.warning(t('about.notSupported'));
    return;
  }
  isChecking.value = true;
  updateError.value = '';
  updateStatus.value = 'checking';
  try {
    const result = await api.check();
    if (!result?.success) {
      updateStatus.value = 'error';
      updateError.value = result?.error || t('about.checkFailed');
      ElMessage.error(updateError.value);
    } else {
      const version = result?.data?.version;
      if (version && version !== appVersion.value) {
        availableVersion.value = version;
        updateStatus.value = 'available';
        ElMessage.success(t('about.newVersionFound', { version }));
      } else {
        updateStatus.value = 'up-to-date';
        ElMessage.success(t('about.alreadyLatest'));
      }
    }
  } catch (e: any) {
    updateStatus.value = 'error';
    updateError.value = String(e?.message || e);
    ElMessage.error(updateError.value);
  } finally {
    isChecking.value = false;
  }
}

async function handleDownloadUpdate(): Promise<void> {
  const api = (window as any).electronAPI?.autoUpdater;
  if (!api?.download) {
    ElMessage.warning(t('about.notSupported'));
    return;
  }
  isDownloading.value = true;
  updateStatus.value = 'downloading';
  try {
    const result = await api.download();
    if (result?.success) {
      ElMessage.success(t('about.downloadStarted'));
    } else {
      updateStatus.value = 'available';
      ElMessage.error(result?.error || t('about.downloadFailed'));
    }
  } catch (e: any) {
    updateStatus.value = 'error';
    updateError.value = String(e?.message || e);
    ElMessage.error(updateError.value);
  } finally {
    isDownloading.value = false;
  }
}

async function handleInstallUpdate(): Promise<void> {
  const api = (window as any).electronAPI?.autoUpdater;
  if (!api?.install) {
    ElMessage.warning(t('about.notSupported'));
    return;
  }
  try {
    await api.install();
  } catch (e: any) {
    ElMessage.error(String(e?.message || e));
  }
}

function bindAutoUpdaterEvents(): void {
  const api = (window as any).electronAPI?.autoUpdater;
  if (!api) return;
  api.onUpdateAvailable?.((data: { version: string }) => {
    availableVersion.value = data.version;
    if (data.version !== appVersion.value) {
      updateStatus.value = 'available';
    }
  });
  api.onUpdateDownloaded?.((data: { version: string }) => {
    availableVersion.value = data.version;
    updateStatus.value = 'downloaded';
    ElMessage.success(t('about.downloadedHint', { version: data.version }));
  });
  api.onError?.((data: { message: string }) => {
    if (updateStatus.value === 'checking' || updateStatus.value === 'downloading') {
      updateStatus.value = 'error';
      updateError.value = data.message;
    }
  });
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
  loadAppVersion();
  bindAutoUpdaterEvents();
});
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.settings-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--bg-secondary);
  color: var(--fg-primary);
  box-sizing: border-box;
  overflow: hidden;
}

.page-header {
  flex-shrink: 0;
}

.page-title {
  font-size: var(--font-size-title-1);
  font-weight: var(--font-weight-semibold);
  color: var(--fg-primary);
  margin: 0;
  letter-spacing: -0.01em;
}

.settings-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.settings-tabs {
  height: 100%;

  :deep(.el-tabs__header) {
    margin: 0 0 var(--space-3);
    border-bottom: 1px solid var(--border-base);
  }

  :deep(.el-tabs__nav-wrap)::after { background: transparent; }

  :deep(.el-tabs__item) {
    height: 36px;
    line-height: 36px;
    font-size: var(--font-size-callout);
    color: var(--fg-tertiary);
    padding: 0 var(--space-3);
    transition: color var(--duration-fast) var(--ease-standard);
  }

  :deep(.el-tabs__item:hover) { color: var(--fg-primary); }

  :deep(.el-tabs__item.is-active) {
    color: var(--accent-base);
    font-weight: var(--font-weight-medium);
  }

  :deep(.el-tabs__active-bar) { background-color: var(--accent-base); }

  :deep(.el-tabs__content) {
    height: calc(100% - 48px);
    overflow-y: auto;
    padding: 0;
  }
}

/* v4.4 增强: 改用更紧凑的标签栏,左对齐 active 蓝条 */
:deep(.el-tabs--left .el-tabs__header.is-left) {
  margin-right: var(--space-4);
}

:deep(.el-tabs--left .el-tabs__item.is-active) {
  background: var(--accent-soft);
  border-radius: var(--radius-sm);
  color: var(--accent-base);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 720px;
}

.settings-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  color: var(--fg-primary);
  transition: border-color var(--duration-fast) var(--ease-standard);

  &:hover { border-color: var(--border-strong); }

  :deep(.el-card__header) {
    border-bottom: 1px solid var(--border-subtle);
    padding: var(--space-3) var(--space-4);
  }

  :deep(.el-card__body) {
    padding: var(--space-3) var(--space-4);
  }
}

.settings-card :deep(.el-form-item__label) {
  color: var(--fg-primary);
  font-size: var(--font-size-callout);
  font-weight: var(--font-weight-medium);
}

.settings-card :deep(.el-input__wrapper) {
  background: var(--bg-elevated);
  color: var(--fg-primary);
  border-radius: var(--radius-sm);
  box-shadow: 0 0 0 1px var(--border-base) inset;
}

.settings-card :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--border-strong) inset;
}

.settings-card :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px var(--accent-base) inset;
}

.form-tip {
  font-size: var(--font-size-caption-1);
  color: var(--fg-tertiary);
  margin-left: var(--space-2);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.provider-count, .mcp-count {
  font-size: var(--font-size-body);
  color: var(--text-secondary);
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: var(--content-padding);
}

.provider-card {
  transition: all var(--duration-base) var(--ease-standard);

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
  color: var(--text-primary);
}

.provider-type {
  font-size: var(--font-size-caption-1);
  color: var(--text-secondary);
}

.provider-body {
  padding: var(--space-sm) 0;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.model-count {
  font-size: var(--font-size-caption-1);
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
  padding: var(--space-sm) var(--space-sm);
  background: var(--border-color);
  border-radius: var(--radius-sm);

  &.default {
    border: 1px solid var(--el-color-primary-light-5);
    background: var(--el-color-primary-light-9);
  }
}

.model-name {
  font-size: var(--font-size-callout);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.model-capabilities {
  display: flex;
  gap: var(--space-xs);
}

.no-models {
  font-size: var(--font-size-callout);
  color: var(--text-secondary);
  text-align: center;
  padding: var(--space-lg);
}

.provider-actions {
  display: flex;
  gap: var(--space-sm);
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

.mcp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: var(--content-padding);
}

.version-text {
  font-family: monospace;
  font-size: var(--font-size-body);
  color: var(--text-primary);
}

.error-text {
  color: var(--el-color-danger);
  font-size: var(--font-size-caption-1);
  word-break: break-all;
}
</style>