<template>
  <div class="permissions-page">
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">{{ t('permissions.title') }}</h1>
        <el-tag v-if="permissionsStore.activeSet" type="primary" effect="dark">
          当前: {{ permissionsStore.activeSet.name }}
        </el-tag>
      </div>
      <div class="header-right">
        <Breadcrumb />
        <el-button type="primary" @click="handleCreateSet">
          <el-icon><Plus /></el-icon>
          {{ t('permissions.createSet') }}
        </el-button>
      </div>
    </div>

    <div class="permissions-content" v-loading="permissionsStore.loading">
      <div class="permissions-layout">
        <!-- 左侧: 权限集列表 -->
        <div class="sets-panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('permissions.sets') }}</span>
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
                  <el-icon class="set-icon" :size="20"><component :is="getSetIcon(set.template)" /></el-icon>
                  <span class="set-name">{{ set.name }}</span>
                  <el-tag v-if="set.id === permissionsStore.activeSetId" size="small" type="success">
                    {{ t('permissions.active') }}
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
              <el-icon class="detail-icon" :size="22"><component :is="getSetIcon(selectedSet.template)" /></el-icon>
              <span>{{ selectedSet.name }}</span>
            </div>
            <div class="detail-actions">
              <el-button
                v-if="selectedSet.id !== permissionsStore.activeSetId"
                type="success"
                size="small"
                @click="handleActivate"
              >
                {{ t('permissions.activate') }}
              </el-button>
              <el-button
                size="small"
                @click="handleDuplicate"
              >
                {{ t('permissions.duplicate') }}
              </el-button>
              <el-button
                v-if="selectedSet.template === 'custom'"
                size="small"
                type="danger"
                text
                @click="handleDelete"
              >
                {{ t('permissions.delete') }}
              </el-button>
            </div>
          </div>

          <div class="detail-body">
            <div class="info-row">
              <span class="info-label">{{ t('permissions.templateColon') }}</span>
              <span class="info-value">{{ getTemplateName(selectedSet.template) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('permissions.descriptionColon') }}</span>
              <span class="info-value">{{ selectedSet.description }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('permissions.ruleCount') }}</span>
              <span class="info-value">{{ t('permissions.rulesCount', { count: selectedSet.rules.length }) }}</span>
            </div>
          </div>

          <el-divider />

          <div class="rules-section">
            <div class="section-header">
              <span class="section-title">{{ t('permissions.rules') }}</span>
            </div>
            <div class="rules-list">
              <div
                v-for="rule in selectedSet.rules"
                :key="rule.id"
                class="rule-item"
              >
                <div class="rule-header">
                  <el-icon class="rule-icon" :size="14"><component :is="getCategoryIcon(rule.category)" /></el-icon>
                  <span class="rule-name">{{ getCategoryName(rule.category) }}</span>
                  <el-tooltip :content="rule.description" placement="top">
                    <el-icon class="rule-info"><InfoFilled /></el-icon>
                  </el-tooltip>
                </div>
                <div class="rule-control">
                  <el-select
                    :model-value="rule.level"
                    @change="(val: PermissionLevel) => handleLevelChange(rule.id, val)"
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
                <span class="section-title">{{ t('permissions.pathRestriction') }}</span>
              </div>
              <div class="path-rules">
                <div v-for="rule in selectedSet.rules.filter(r => r.category === 'filesystem')" :key="rule.id" class="path-rule">
                  <div class="path-row">
                    <span class="path-label">{{ t('permissions.allowedPaths') }}</span>
                    <el-tag
                      v-for="(path, idx) in rule.allowedPaths || []"
                      :key="idx"
                      size="small"
                      closable
                      @close="handleRemovePath(rule, 'allowed', idx)"
                    >
                      {{ path }}
                    </el-tag>
                    <span v-if="!rule.allowedPaths?.length" class="path-empty">{{ t('permissions.none') }}</span>
                  </div>
                  <div class="path-row">
                    <span class="path-label">{{ t('permissions.deniedPaths') }}</span>
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
                    <span v-if="!rule.deniedPaths?.length" class="path-empty">{{ t('permissions.deny') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div class="detail-empty" v-else>
          <el-empty :description="t('permissions.selectSetPrompt')" />
        </div>
      </div>
    </div>

    <!-- 新建权限集对话框 -->
    <el-dialog
      v-model="createDialogVisible"
      :title="t('permissions.createSet')"
      width="500px"
    >
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item :label="t('permissions.nameLabel')" prop="name">
          <el-input v-model="createForm.name" :placeholder="t('permissions.nameLabel')" />
        </el-form-item>
        <el-form-item :label="t('permissions.basedOnTemplate')" prop="template">
          <el-select v-model="createForm.template" :placeholder="t('permissions.basedOnTemplate')">
            <el-option :label="t('permissions.templateSafe')" value="safe" />
            <el-option :label="t('permissions.templateStandard')" value="standard" />
            <el-option :label="t('permissions.templatePermissive')" value="permissive" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('permissions.descriptionLabel')" prop="description">
          <el-input v-model="createForm.description" type="textarea" :rows="2" :placeholder="t('permissions.descriptionLabel')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreateSubmit">{{ t('common.create') }}</el-button>
      </template>
    </el-dialog>

    <!-- 复制对话框 -->
    <el-dialog
      v-model="duplicateDialogVisible"
      :title="t('permissions.duplicateTitle')"
      width="400px"
    >
      <el-form label-width="80px">
        <el-form-item :label="t('permissions.newName')">
          <el-input v-model="duplicateName" :placeholder="t('permissions.newName')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="duplicateDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleDuplicateSubmit">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import Breadcrumb from '@/components/layout/Breadcrumb.vue';
import { Plus, InfoFilled, Lock, Promotion, Unlock, EditPen, Document, Folder, Connection, Operation, Monitor, Lightning, Tools, Box } from '@element-plus/icons-vue';
import { usePermissionsStore, type PermissionSet, type PermissionLevel } from '@/stores/permissions';

const { t } = useI18n();

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

const createRules = computed(() => ({
  name: [{ required: true, message: t('permissions.pleaseEnterName'), trigger: 'blur' }],
  template: [{ required: true, message: t('permissions.pleaseSelectTemplate'), trigger: 'change' }]
}));

const permissionLevels = computed(() => [
  { value: 'none', name: t('permissions.levelNone'), description: t('permissions.levelNoneDesc') },
  { value: 'read', name: t('permissions.levelRead'), description: t('permissions.levelReadDesc') },
  { value: 'write', name: t('permissions.levelWrite'), description: t('permissions.levelWriteDesc') },
  { value: 'execute', name: t('permissions.levelExecute'), description: t('permissions.levelExecuteDesc') },
  { value: 'all', name: t('permissions.levelAll'), description: t('permissions.levelAllDesc') }
]);

onMounted(async () => {
  await permissionsStore.fetchPermissionSets();
  if (permissionsStore.activeSet) {
    selectedSet.value = permissionsStore.activeSet;
  }
});

function getSetIcon(template: string): string {
  const icons: Record<string, string> = {
    safe: 'Lock',
    standard: 'Promotion',
    permissive: 'Unlock',
    custom: 'EditPen'
  };
  return icons[template] || 'Document';
}

function getTemplateName(template: string): string {
  const map: Record<string, string> = {
    safe: t('permissions.templateNameSafe'),
    standard: t('permissions.templateNameStandard'),
    permissive: t('permissions.templateNamePermissive'),
    custom: t('permissions.templateNameCustom')
  };
  return map[template] || template;
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    filesystem: 'Folder',
    network: 'Connection',
    process: 'Operation',
    system: 'Monitor',
    clipboard: 'Document',
    shell: 'Lightning',
    environment: 'Tools'
  };
  return icons[category] || 'Box';
}

function getCategoryName(category: string): string {
  const map: Record<string, string> = {
    filesystem: t('permissions.categoryFilesystem'),
    network: t('permissions.categoryNetwork'),
    process: t('permissions.categoryProcess'),
    system: t('permissions.categorySystem'),
    clipboard: t('permissions.categoryClipboard'),
    shell: t('permissions.categoryShell'),
    environment: t('permissions.categoryEnvironment')
  };
  return map[category] || category;
}

function handleSelectSet(set: PermissionSet): void {
  selectedSet.value = set;
}

async function handleActivate(): Promise<void> {
  if (!selectedSet.value) return;
  const success = await permissionsStore.setActiveSet(selectedSet.value.id);
  if (success) {
    ElMessage.success(t('permissions.activated', { name: selectedSet.value.name }));
  }
}

function handleCreateSet(): void {
  createForm.name = '';
  createForm.template = 'standard';
  createForm.description = '';
  createDialogVisible.value = true;
}

async function handleRemovePath(rule: { allowedDomains?: string[]; deniedDomains?: string[] }, field: 'allowed' | 'denied', idx: number): Promise<void> {
  if (!selectedSet.value) return;
  if (field === 'allowed') {
    rule.allowedDomains?.splice(idx, 1);
  } else {
    rule.deniedDomains?.splice(idx, 1);
  }
  await permissionsStore.updatePermissionSet(selectedSet.value.id, { rules: selectedSet.value.rules });
  ElMessage.success(t('permissions.pathRemoved'));
}

async function handleCreateSubmit(): Promise<void> {
  if (!createFormRef.value) return;
  await createFormRef.value.validate(async (valid: boolean) => {
    if (!valid) return;
    submitting.value = true;
    try {
      const templateDescs: Record<string, string> = {
        safe: t('permissions.templateDescSafe'),
        standard: t('permissions.templateDescStandard'),
        permissive: t('permissions.templateDescPermissive')
      };
      const result = await permissionsStore.createPermissionSet({
        name: createForm.name,
        template: createForm.template,
        description: createForm.description || templateDescs[createForm.template],
        rules: []
      });
      if (result) {
        ElMessage.success(t('permissions.created'));
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
    ElMessage.success(t('permissions.duplicated'));
    duplicateDialogVisible.value = false;
    selectedSet.value = result;
  }
}

async function handleDelete(): Promise<void> {
  if (!selectedSet.value) return;
  try {
    await ElMessageBox.confirm(
      t('permissions.deleteConfirmText', { name: selectedSet.value.name }),
      t('permissions.deleteConfirmTitle'),
      {
        confirmButtonText: t('dialog.deleteButton'),
        cancelButtonText: t('dialog.cancelButton'),
        type: t('dialog.warningType') as 'warning'
      }
    );
    const success = await permissionsStore.deletePermissionSet(selectedSet.value.id);
    if (success) {
      ElMessage.success(t('permissions.deleted'));
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent-base);
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent-base);
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-secondary);
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