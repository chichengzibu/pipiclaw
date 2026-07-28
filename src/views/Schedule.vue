<template>
  <div class="schedule-page">
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">{{ t('schedule.title') }}</h1>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>
          {{ t('schedule.createTask') }}
        </el-button>
      </div>
    </div>

    <div class="schedule-intro">
      <el-alert :title="t('schedule.intro')" type="info" :closable="false" show-icon />
    </div>

    <div class="schedule-content">
      <el-empty v-if="tasks.length === 0" :description="t('schedule.title')" />

      <el-table v-else :data="tasks" stripe>
        <el-table-column :label="t('common.name')" prop="name" min-width="160" />
        <el-table-column :label="t('schedule.instruction')" prop="instruction" min-width="240" show-overflow-tooltip />
        <el-table-column :label="t('schedule.scheduleType')" prop="scheduleType" width="120">
          <template #default="scope"><template v-if="scope?.row">
            <el-tag size="small">{{ getScheduleTypeLabel(scope.row?.scheduleType) }}</el-tag>
          </template></template>
        </el-table-column>
        <el-table-column :label="t('common.status')" prop="enabled" width="120">
          <template #default="scope"><template v-if="scope?.row">
            <el-switch
              :model-value="scope.row?.enabled"
              @change="(val: boolean) => handleToggle(scope.row?.id, val)"
            />
          </template></template>
        </el-table-column>
        <el-table-column :label="t('common.createTime')" prop="createdAt" width="180" />
        <el-table-column :label="t('common.actions')" width="200" fixed="right">
          <template #default="scope"><template v-if="scope?.row">
            <el-button size="small" @click="openEditDialog(row)">{{ t('common.edit') }}</el-button>
            <el-button size="small" @click="viewHistory(row)">{{ t('schedule.history') }}</el-button>
            <el-button size="small" type="danger" text @click="handleDelete(row)">
              {{ t('common.delete') }}
            </el-button>
          </template></template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? t('schedule.editTask') : t('schedule.createTask')"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item :label="t('schedule.taskName')" prop="name">
          <el-input v-model="form.name" :placeholder="t('schedule.taskNamePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('schedule.taskDesc')">
          <el-input v-model="form.description" type="textarea" :rows="2" :placeholder="t('schedule.taskDescPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('schedule.instruction')" prop="instruction">
          <el-input v-model="form.instruction" type="textarea" :rows="3" :placeholder="t('schedule.instructionPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('schedule.scheduleType')">
          <el-select v-model="form.scheduleType">
            <el-option :label="t('schedule.once')" value="once" />
            <el-option :label="t('schedule.daily')" value="daily" />
            <el-option :label="t('schedule.weekly')" value="weekly" />
            <el-option :label="t('schedule.monthly')" value="monthly" />
            <el-option :label="t('schedule.cron')" value="cron" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.scheduleType === 'cron'" :label="t('schedule.cronExpr')">
          <el-input v-model="form.cron" placeholder="0 0 * * *" />
        </el-form-item>
        <el-form-item :label="t('schedule.retryCount')">
          <el-input-number v-model="form.retryCount" :min="0" :max="10" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button @click="handleImportFromMarket">
          {{ t('schedule.importFromMarket') }}
        </el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isEditing ? t('common.save') : t('common.create') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 历史记录对话框 -->
    <el-dialog v-model="historyVisible" :title="t('schedule.history')" width="700px">
      <el-table :data="history" stripe>
        <el-table-column :label="t('schedule.execTime')" prop="executedAt" width="180" />
        <el-table-column :label="t('common.status')" prop="status" width="100">
          <template #default="scope"><template v-if="scope?.row">
            <el-tag :type="getStatusTagType(scope.row?.status)">{{ getStatusLabel(scope.row?.status) }}</el-tag>
          </template></template>
        </el-table-column>
        <el-table-column :label="t('schedule.duration')" prop="duration" width="100" />
        <el-table-column :label="t('common.description')" prop="errorMessage" show-overflow-tooltip />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { Plus } from '@element-plus/icons-vue';

const { t } = useI18n();

interface ScheduleTask {
  id: string;
  name: string;
  description: string;
  instruction: string;
  scheduleType: 'once' | 'daily' | 'weekly' | 'monthly' | 'cron';
  cron?: string;
  retryCount: number;
  enabled: boolean;
  createdAt: string;
}

const tasks = ref<ScheduleTask[]>([]);
const history = ref<any[]>([]);
const dialogVisible = ref(false);
const historyVisible = ref(false);
const submitting = ref(false);
const isEditing = ref(false);
const formRef = ref();

const form = reactive<ScheduleTask>({
  id: '',
  name: '',
  description: '',
  instruction: '',
  scheduleType: 'daily',
  cron: '',
  retryCount: 0,
  enabled: true,
  createdAt: ''
});

const rules = computed(() => ({
  name: [{ required: true, message: t('schedule.taskNamePlaceholder'), trigger: 'blur' }],
  instruction: [{ required: true, message: t('schedule.pleaseFillNameAndInstruction'), trigger: 'blur' }]
}));

const statusTagType: Record<string, string> = {
  success: 'success',
  failed: 'danger',
  running: 'warning',
  pending: 'info'
};

const statusKey: Record<string, string> = {
  success: 'schedule.statusSuccess',
  failed: 'schedule.statusFailed',
  running: 'schedule.statusRunning',
  pending: 'schedule.statusPending'
};

function getScheduleTypeLabel(type: string): string {
  const map: Record<string, string> = {
    once: t('schedule.once'),
    daily: t('schedule.daily'),
    weekly: t('schedule.weekly'),
    monthly: t('schedule.monthly'),
    cron: t('schedule.cron')
  };
  return map[type] || type;
}

function getStatusLabel(status: string): string {
  return t(statusKey[status] || 'common.loading');
}

function getStatusTagType(status: string): string {
  return statusTagType[status] || 'info';
}

async function loadTasks(): Promise<void> {
  try {
    const result = await (window as any).electronAPI?.schedule?.list?.();
    if (result?.success && Array.isArray(result.data)) {
      tasks.value = result.data;
    }
  } catch (e) {
    console.error('加载定时任务失败:', e);
  }
}

function openCreateDialog(): void {
  isEditing.value = false;
  Object.assign(form, {
    id: '',
    name: '',
    description: '',
    instruction: '',
    scheduleType: 'daily',
    cron: '',
    retryCount: 0,
    enabled: true,
    createdAt: ''
  });
  dialogVisible.value = true;
}

function openEditDialog(task: ScheduleTask): void {
  isEditing.value = true;
  Object.assign(form, { ...task });
  dialogVisible.value = true;
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return;
    submitting.value = true;
    try {
      const api = (window as any).electronAPI?.schedule;
      const payload = { ...form };
      let result;
      if (isEditing.value) {
        result = await api?.update?.(payload);
        if (result?.success) {
          ElMessage.success(t('schedule.taskUpdated'));
        }
      } else {
        result = await api?.add?.(payload);
        if (result?.success) {
          ElMessage.success(t('schedule.taskCreated'));
        }
      }
      if (result?.success) {
        dialogVisible.value = false;
        loadTasks();
      }
    } finally {
      submitting.value = false;
    }
  });
}

async function handleDelete(task: ScheduleTask): Promise<void> {
  try {
    await ElMessageBox.confirm(
      t('schedule.deleteConfirm', { name: task.name }),
      t('dialog.deleteConfirm'),
      {
        confirmButtonText: t('dialog.deleteButton'),
        cancelButtonText: t('dialog.cancelButton'),
        type: t('dialog.warningType') as 'warning'
      }
    );
    const result = await (window as any).electronAPI?.schedule?.remove?.(task.id);
    if (result?.success) {
      ElMessage.success(t('schedule.taskDeleted'));
      loadTasks();
    }
  } catch {}
}

async function handleToggle(id: string, enabled: boolean): Promise<void> {
  const result = await (window as any).electronAPI?.schedule?.setEnabled?.({ id, enabled });
  if (result?.success) {
    ElMessage.success(enabled ? t('schedule.taskEnabled') : t('schedule.taskDisabled'));
    loadTasks();
  }
}

async function viewHistory(task: ScheduleTask): Promise<void> {
  const result = await (window as any).electronAPI?.schedule?.history?.(task.id);
  if (result?.success && Array.isArray(result.data)) {
    history.value = result.data;
    historyVisible.value = true;
  }
}

function handleImportFromMarket(): void {
  ElMessage.info(t('schedule.importDeveloping'));
}

onMounted(loadTasks);
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.schedule-page {
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

.page-title {
  font-size: var(--font-size-title-1);
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
  margin: 0;
}

.schedule-intro {
  margin-bottom: var(--content-padding);
}

.schedule-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>