<template>
  <div class="permissions-page">
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">权限管理</h1>
        <el-tag v-if="permissionsStore.activeSet" type="primary" effect="dark">
          当前: {{ permissionsStore.activeSet.name }}
        </el-tag>
      </div>
      <div class="header-right">
        <Breadcrumb />
        <el-button type="primary" @click="handleCreateSet">
          <el-icon><Plus /></el-icon>
          新建权限集
        </el-button>
      </div>
    </div>

    <div class="permissions-content" v-loading="permissionsStore.loading">
      <div class="permissions-layout">
        <!-- 左侧: 权限集列表 -->
        <div class="sets-panel">
          <div class="panel-header">
            <span class="panel-title">权限集</span>
          </div>
          <el-scrollbar class="sets-list">
            <div
              v-for="set in permissionsStore.permissionSets"
              :key="set.id"
              class="set-item"
              :class="{ active: set.id === permissionsStore.activeSetId }"
              @click="handleSelectSet(set)"
            >
              <div class="set-info">
                <div class="set-header">
                  <span class="set-icon">{{ getSetIcon(set.template) }}</span>
                  <span class="set-name">{{ set.name }}</span>
                  <el-tag v-if="set.id === permissionsStore.activeSetId" size="small" type="success">
                    使用中
                  </el-tag>
                </div>
                <div class="set-desc">{{ set.description }}</div>
              </div>
            </div>
          </el-scrollbar>
        </div>

        <!-- 右侧: 权限详情 -->
        <div class="detail-panel" v-if="selectedSet">
          <div class="detail-header">
            <div class="detail-title">
              <span class="detail-icon">{{ getSetIcon(selectedSet.template) }}</span>
              <span>{{ selectedSet.name }}</span>
            </div>
            <div class="detail-actions">
              <el-button
                v-if="selectedSet.id !== permissionsStore.activeSetId"
                type="success"
                size="small"
                @click="handleActivate"
              >
                激活
              </el-button>
              <el-button
                size="small"
                @click="handleDuplicate"
              >
                复制
              </el-button>
              <el-button
                v-if="selectedSet.template === 'custom'"
                size="small"
                type="danger"
                text
                @click="handleDelete"
              >
                删除
              </el-button>
            </div>
          </div>

          <div class="detail-body">
            <div class="info-row">
              <span class="info-label">模板:</span>
              <span class="info-value">{{ getTemplateName(selectedSet.template) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">描述:</span>
              <span class="info-value">{{ selectedSet.description }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">权限数量:</span>
              <span class="info-value">{{ selectedSet.rules.length }} 项</span>
            </div>
          </div>

          <el-divider />

          <div class="rules-section">
            <div class="section-header">
              <span class="section-title">权限规则</span>
            </div>
            <div class="rules-list">
              <div
                v-for="rule in selectedSet.rules"
                :key="rule.id"
                class="rule-item"
              >
                <div class="rule-header">
                  <span class="rule-icon">{{ getCategoryIcon(rule.category) }}</span>
                  <span class="rule-name">{{ getCategoryName(rule.category) }}</span>
                  <el-tooltip :content="rule.description" placement="top">
                    <el-icon class="rule-info"><InfoFilled /></el-icon>
                  </el-tooltip>
                </div>
                <div class="rule-control">
                  <el-select
                    :model-value="rule.level"
                    @change="(val) => handleLevelChange(rule.id, val)"
                    :disabled="selectedSet.template !== 'custom'"
                    size="small"
                  >
                    <el-option
                      v-for="level in permissionLevels"
                      :key="level.value"
                      :label="level.name"
                      :value="level.value"
                    >
                      <div class="level-option">
                        <span>{{ level.name }}</span>
                        <span class="level-desc">{{ level.description }}</span>
                      </div>
                    </el-option>
                  </el-select>
                </div>
              </div>
            </div>
          </div>

          <template v-if="selectedSet.template === 'custom'">
            <el-divider />
            <div class="advanced-section">
              <div class="section-header">
                <span class="section-title">路径限制</span>
              </div>
              <div class="path-rules">
                <div v-for="rule in selectedSet.rules.filter(r => r.category === 'filesystem')" :key="rule.id" class="path-rule">
                  <div class="path-row">
                    <span class="path-label">允许路径:</span>
                    <el-tag
                      v-for="(path, idx) in rule.allowedPaths || []"
                      :key="idx"
                      size="small"
                      closable
                      @close="handleRemovePath(rule, 'allowed', idx)"
                    >
                      {{ path }}
                    </el-tag>
                    <span v-if="!rule.allowedPaths?.length" class="path-empty">无限制</span>
                  </div>
                  <div class="path-row">
                    <span class="path-label">禁止路径:</span>
                    <el-tag
                      v-for="(path, idx) in rule.deniedPaths || []"
                      :key="idx"
                      size="small"
                      type="danger"
                      closable
                      @close="handleRemovePath(rule, 'denied', idx)"
                    >
                      {{ path }}
                    </el-tag>
                    <span v-if="!rule.deniedPaths?.length" class="path-empty">无</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div class="detail-empty" v-else>
          <el-empty description="请选择一个权限集查看详情" />
        </div>
      </div>
    </div>

    <!-- 新建权限集对话框 -->
    <el-dialog
      v-model="createDialogVisible"
      title="新建权限集"
      width="500px"
    >
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="createForm.name" placeholder="权限集名称" />
        </el-form-item>
        <el-form-item label="基于模板" prop="template">
          <el-select v-model="createForm.template" placeholder="选择模板">
            <el-option label="安全模式 (严格限制)" value="safe" />
            <el-option label="标准模式 (平衡)" value="standard" />
            <el-option label="开放模式 (几乎无限制)" value="permissive" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="createForm.description" type="textarea" :rows="2" placeholder="描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreateSubmit">创建</el-button>
      </template>
    </el-dialog>

    <!-- 复制对话框 -->
    <el-dialog
      v-model="duplicateDialogVisible"
      title="复制权限集"
      width="400px"
    >
      <el-form label-width="80px">
        <el-form-item label="新名称">
          <el-input v-model="duplicateName" placeholder="输入新名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="duplicateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleDuplicateSubmit">复制</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import Breadcrumb from '@/components/layout/Breadcrumb.vue';
import { Plus, InfoFilled } from '@element-plus/icons-vue';
import { usePermissionsStore, type PermissionSet, type PermissionLevel } from '@/stores/permissions';

const permissionsStore = usePermissionsStore();

const selectedSet = ref<PermissionSet | null>(null);
const createDialogVisible = ref(false);
const duplicateDialogVisible = ref(false);
const submitting = ref(false);
const duplicateName = ref('');
const createFormRef = ref();

const createForm = reactive({
  name: '',
  template: 'standard' as 'safe' | 'standard' | 'permissive',
  description: ''
});

const createRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  template: [{ required: true, message: '请选择模板', trigger: 'change' }]
};

const permissionLevels = [
  { value: 'none', name: '禁止', description: '完全禁止' },
  { value: 'read', name: '只读', description: '仅允许读取' },
  { value: 'write', name: '读写', description: '允许读取和写入' },
  { value: 'execute', name: '执行', description: '允许执行操作' },
  { value: 'all', name: '完全', description: '允许所有操作' }
];

onMounted(async () => {
  await permissionsStore.fetchPermissionSets();
  if (permissionsStore.activeSet) {
    selectedSet.value = permissionsStore.activeSet;
  }
});

function getSetIcon(template: string): string {
  const icons: Record<string, string> = {
    safe: '🛡️',
    standard: '⚖️',
    permissive: '🔓',
    custom: '✏️'
  };
  return icons[template] || '📋';
}

function getTemplateName(template: string): string {
  const names: Record<string, string> = {
    safe: '安全模式',
    standard: '标准模式',
    permissive: '开放模式',
    custom: '自定义'
  };
  return names[template] || template;
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    filesystem: '📁',
    network: '🌐',
    process: '⚙️',
    system: '🖥️',
    clipboard: '📋',
    shell: '💻',
    environment: '🔧'
  };
  return icons[category] || '📦';
}

function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    filesystem: '文件系统',
    network: '网络',
    process: '进程',
    system: '系统',
    clipboard: '剪贴板',
    shell: 'Shell',
    environment: '环境变量'
  };
  return names[category] || category;
}

function handleSelectSet(set: PermissionSet): void {
  selectedSet.value = set;
}

async function handleActivate(): Promise<void> {
  if (!selectedSet.value) return;
  const success = await permissionsStore.setActiveSet(selectedSet.value.id);
  if (success) {
    ElMessage.success(`已激活 "${selectedSet.value.name}"`);
  }
}

function handleCreateSet(): void {
  createForm.name = '';
  createForm.template = 'standard';
  createForm.description = '';
  createDialogVisible.value = true;
}

async function handleCreateSubmit(): Promise<void> {
  if (!createFormRef.value) return;
  await createFormRef.value.validate(async (valid) => {
    if (!valid) return;
    submitting.value = true;
    try {
      const templateDescs: Record<string, string> = {
        safe: '严格限制，仅允许基本操作',
        standard: '平衡模式，允许常见操作',
        permissive: '开放模式，允许几乎所有操作'
      };
      const result = await permissionsStore.createPermissionSet({
        name: createForm.name,
        template: createForm.template,
        description: createForm.description || templateDescs[createForm.template],
        rules: []
      });
      if (result) {
        ElMessage.success('权限集创建成功');
        createDialogVisible.value = false;
        selectedSet.value = result;
      }
    } finally {
      submitting.value = false;
    }
  });
}

function handleDuplicate(): void {
  if (!selectedSet.value) return;
  duplicateName.value = `${selectedSet.value.name} (副本)`;
  duplicateDialogVisible.value = true;
}

async function handleDuplicateSubmit(): Promise<void> {
  if (!selectedSet.value || !duplicateName.value) return;
  const result = await permissionsStore.duplicatePermissionSet(selectedSet.value.id, duplicateName.value);
  if (result) {
    ElMessage.success('权限集复制成功');
    duplicateDialogVisible.value = false;
    selectedSet.value = result;
  }
}

async function handleDelete(): Promise<void> {
  if (!selectedSet.value) return;
  try {
    await ElMessageBox.confirm(
      `确定要删除权限集 "${selectedSet.value.name}" 吗？`,
      '删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    );
    const success = await permissionsStore.deletePermissionSet(selectedSet.value.id);
    if (success) {
      ElMessage.success('删除成功');
      selectedSet.value = permissionsStore.permissionSets[0] || null;
    }
  } catch {}
}

async function handleLevelChange(ruleId: string, level: PermissionLevel): Promise<void> {
  if (!selectedSet.value) return;
  await permissionsStore.updatePermissionRule(selectedSet.value.id, ruleId, { level });
}
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.permissions-page {
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

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.permissions-content {
  flex: 1;
  min-height: 0;
}

.permissions-layout {
  display: flex;
  height: 100%;
  gap: var(--content-padding);
}

.sets-panel {
  width: 280px;
  flex-shrink: 0;
  background: var(--el-bg-color);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: var(--space-md);
  border-bottom: 1px solid var(--el-border-color-light);
}

.panel-title {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-body);
  color: var(--text-color);
}

.sets-list {
  flex: 1;
  padding: var(--space-sm);
}

.set-item {
  padding: var(--space-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
  margin-bottom: var(--space-xs);

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.active {
    background: var(--el-color-primary-light-9);
    border: 1px solid var(--el-color-primary-light-5);
  }
}

.set-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.set-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.set-icon {
  font-size: var(--font-size-title-2);
}

.set-name {
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-body);
  color: var(--text-color);
}

.set-desc {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-secondary);
  line-height: var(--line-height-normal);
}

.detail-panel {
  flex: 1;
  background: var(--el-bg-color);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  overflow-y: auto;
  min-width: 0;
}

.detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color);
  border-radius: var(--radius-md);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.detail-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-title-1);
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
}

.detail-icon {
  font-size: var(--font-size-display);
}

.detail-actions {
  display: flex;
  gap: var(--space-sm);
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.info-row {
  display: flex;
  gap: var(--space-sm);
  font-size: var(--font-size-body);
}

.info-label {
  color: var(--el-text-color-secondary);
  width: 70px;
  flex-shrink: 0;
}

.info-value {
  color: var(--text-color);
}

.section-header {
  margin-bottom: var(--space-sm);
}

.section-title {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-body);
  color: var(--text-color);
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.rule-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  background: var(--el-fill-color-light);
  border-radius: var(--radius-sm);
}

.rule-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.rule-icon {
  font-size: var(--font-size-title-2);
}

.rule-name {
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-body);
  color: var(--text-color);
}

.rule-info {
  color: var(--el-text-color-secondary);
  cursor: help;
}

.rule-control {
  min-width: 140px;
}

.level-option {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.level-desc {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-secondary);
}

.advanced-section {
  margin-top: var(--space-md);
}

.path-rules {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.path-rule {
  padding: var(--space-sm);
  background: var(--el-fill-color-lighter);
  border-radius: var(--radius-sm);
}

.path-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
  margin-bottom: var(--space-sm);

  &:last-child {
    margin-bottom: 0;
  }
}

.path-label {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-secondary);
  width: 70px;
}

.path-empty {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-placeholder);
  font-style: italic;
}
</style>
