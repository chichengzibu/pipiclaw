<template>
  <div class="tasks-page">
    <div class="page-header">
      <h1 class="page-title">{{ t('tasks.title') }}</h1>
      <Breadcrumb />
    </div>

    <div class="tasks-content">
      <div class="tasks-sidebar">
        <div class="stats-cards">
          <div class="stat-card">
            <div class="stat-value">{{ stats.total }}</div>
            <div class="stat-label">{{ t('common.status') }}</div>
          </div>
          <div class="stat-card success">
            <div class="stat-value">{{ stats.success }}</div>
            <div class="stat-label">{{ t('tasks.success') }}</div>
          </div>
          <div class="stat-card danger">
            <div class="stat-value">{{ stats.failed }}</div>
            <div class="stat-label">{{ t('tasks.failed') }}</div>
          </div>
        </div>

        <div class="filter-section">
          <div class="filter-title">{{ t('common.filter') }}</div>
          <el-select v-model="filterStatus" :placeholder="t('common.status')" clearable size="small">
            <el-option :label="t('common.status')" value="" />
            <el-option :label="t('tasks.success')" value="success" />
            <el-option :label="t('tasks.failed')" value="failed" />
            <el-option :label="t('tasks.running')" value="running" />
            <el-option :label="t('tasks.pending')" value="pending" />
          </el-select>
          <el-select v-model="filterMode" :placeholder="t('common.type')" clearable size="small">
            <el-option :label="t('common.type')" value="" />
            <el-option label="安全模式" value="safe" />
            <el-option label="计划模式" value="plan" />
            <el-option label="全量模式" value="craft" />
          </el-select>
          <el-input
            v-model="filterKeyword"
            :placeholder="t('common.search')"
            clearable
            size="small"
            prefix-icon="Search"
          />
        </div>

        <div class="actions-bar">
          <el-button
            type="danger"
            size="small"
            :disabled="selectedTasks.length === 0"
            @click="handleBatchDelete"
          >
            {{ t('common.delete') }} ({{ selectedTasks.length }})
          </el-button>
        </div>

        <el-scrollbar class="tasks-list">
          <div
            v-for="task in filteredTasks"
            :key="task.id"
            class="task-item"
            :class="{ active: selectedTaskId === task.id, [task.status]: true }"
            @click="handleSelectTask(task)"
          >
            <div class="task-item-header">
              <span class="task-status-icon">{{ getStatusIcon(task.status) }}</span>
              <span class="task-mode-icon">{{ getModeIcon(task.mode) }}</span>
              <span class="task-time">{{ formatTime(task.createdAt) }}</span>
            </div>
            <div class="task-item-content">
              {{ task.instruction }}
            </div>
            <div class="task-item-footer">
              <span class="task-duration" v-if="task.duration">
                {{ task.duration }}ms
              </span>
              <span class="task-steps">
                {{ task.steps?.length || 0 }} {{ t('tasks.actions') }}
              </span>
            </div>
          </div>
          <div v-if="filteredTasks.length === 0" class="empty-list">
            {{ t('tasks.noTasks') }}
          </div>
        </el-scrollbar>
      </div>

      <div class="task-detail">
        <template v-if="selectedTask">
          <div class="detail-header">
            <div class="detail-title">
              <span class="title-icon">{{ getStatusIcon(selectedTask.status) }}</span>
              <span class="title-text">{{ t('tasks.title') }}</span>
            </div>
            <div class="detail-actions">
              <el-button size="small" @click="handleExport('json')">
                {{ t('common.export') }} JSON
              </el-button>
              <el-button size="small" @click="handleExport('txt')">
                {{ t('common.export') }} TXT
              </el-button>
              <el-button
                v-if="selectedTask.status === 'failed'"
                type="primary"
                size="small"
                @click="handleRetry"
              >
                {{ t('tasks.retry') }}
              </el-button>
              <el-button
                v-if="selectedTask.status === 'running'"
                type="danger"
                size="small"
                @click="handleCancel"
              >
                {{ t('tasks.cancel') }}
              </el-button>
            </div>
          </div>

          <div class="detail-info">
            <div class="info-item">
              <span class="info-label">任务ID:</span>
              <code class="info-value">{{ selectedTask.id }}</code>
            </div>
            <div class="info-item">
              <span class="info-label">执行模式:</span>
              <el-tag size="small">{{ getModeText(selectedTask.mode) }}</el-tag>
            </div>
            <div class="info-item">
              <span class="info-label">状态:</span>
              <el-tag :type="getStatusType(selectedTask.status)" size="small">
                {{ getStatusText(selectedTask.status) }}
              </el-tag>
            </div>
            <div class="info-item">
              <span class="info-label">耗时:</span>
              <span class="info-value">{{ selectedTask.duration || 0 }}ms</span>
            </div>
            <div class="info-item">
              <span class="info-label">创建时间:</span>
              <span class="info-value">{{ formatDateTime(selectedTask.createdAt) }}</span>
            </div>
          </div>

          <div class="detail-instruction">
            <div class="section-title">指令</div>
            <div class="instruction-text">{{ selectedTask.instruction }}</div>
          </div>

          <div class="detail-steps">
            <div class="section-title">执行步骤 ({{ selectedTask.steps?.length || 0 }})</div>
            <div class="steps-list">
              <div
                v-for="step in selectedTask.steps"
                :key="step.order"
                class="step-item"
                :class="[step.status, getRiskClass(step.riskLevel)]"
              >
                <div class="step-header">
                  <span class="step-order">{{ step.order }}</span>
                  <span class="step-icon">{{ getStepIcon(step.status) }}</span>
                  <span class="step-description">{{ step.description }}</span>
                </div>
                <div class="step-details">
                  <div class="detail-row">
                    <span class="row-label">操作:</span>
                    <code class="row-value">{{ step.operation }}</code>
                  </div>
                  <div v-if="step.permissionCheck" class="detail-row">
                    <span class="row-label">权限:</span>
                    <el-tag
                      :type="step.permissionCheck.allowed ? 'success' : 'danger'"
                      size="small"
                    >
                      {{ step.permissionCheck.allowed ? '通过' : '拒绝' }}
                    </el-tag>
                    <span class="row-value">
                      {{ step.permissionCheck.category }}/{{ step.permissionCheck.action }}
                    </span>
                  </div>
                  <div v-if="step.result && step.status === 'success'" class="detail-row">
                    <span class="row-label">结果:</span>
                    <span class="row-value success">{{ step.result }}</span>
                  </div>
                  <div v-if="step.error" class="detail-row">
                    <span class="row-label">错误:</span>
                    <span class="row-value error">{{ step.error }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="selectedTask.summary" class="detail-summary">
            <div class="section-title">摘要</div>
            <div class="summary-text">{{ selectedTask.summary }}</div>
          </div>

          <div v-if="selectedTask.error" class="detail-error">
            <div class="section-title">错误信息</div>
            <div class="error-text">{{ selectedTask.error }}</div>
          </div>
        </template>

        <div v-else class="empty-detail">
          <el-icon :size="64" color="var(--el-text-color-secondary)"><Document /></el-icon>
          <p>选择一个任务查看详情</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { Document } from '@element-plus/icons-vue';
import Breadcrumb from '@/components/layout/Breadcrumb.vue';

const { t } = useI18n();

interface TaskLogStep {
  order: number;
  operation: string;
  description: string;
  params: Record<string, any>;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'blocked';
  riskLevel?: 'low' | 'medium' | 'high';
  permissionCheck?: {
    category: string;
    action: string;
    resource?: string;
    allowed: boolean;
    reason?: string;
  };
  result?: string;
  error?: string;
}

interface TaskLogEntry {
  id: string;
  conversationId: string;
  instruction: string;
  mode: string;
  status: string;
  steps: TaskLogStep[];
  summary: string;
  error?: string;
  duration?: number;
  createdAt: number;
  startTime?: number;
  endTime?: number;
  retryCount: number;
}

interface TaskLogStats {
  total: number;
  success: number;
  failed: number;
  cancelled: number;
  byMode: Record<string, number>;
}

const electronAPI = window.electronAPI as any;

const tasks = ref<TaskLogEntry[]>([]);
const stats = ref<TaskLogStats>({
  total: 0,
  success: 0,
  failed: 0,
  cancelled: 0,
  byMode: {}
});
const selectedTaskId = ref<string | null>(null);
const selectedTask = ref<TaskLogEntry | null>(null);
const selectedTasks = ref<string[]>([]);
const filterStatus = ref('');
const filterMode = ref('');
const filterKeyword = ref('');

const filteredTasks = computed(() => {
  let result = tasks.value;

  if (filterStatus.value) {
    result = result.filter(t => t.status === filterStatus.value);
  }

  if (filterMode.value) {
    result = result.filter(t => t.mode === filterMode.value);
  }

  if (filterKeyword.value) {
    const keyword = filterKeyword.value.toLowerCase();
    result = result.filter(t =>
      t.instruction.toLowerCase().includes(keyword) ||
      t.summary.toLowerCase().includes(keyword)
    );
  }

  return result;
});

onMounted(async () => {
  await fetchTasks();
  await fetchStats();
});

async function fetchTasks(): Promise<void> {
  try {
    const result = await electronAPI?.task?.queryLogs({
      limit: 100
    });
    if (result?.success && result.data) {
      tasks.value = result.data;
    }
  } catch (err) {
    console.error('[Tasks] 获取任务列表失败:', err);
  }
}

async function fetchStats(): Promise<void> {
  try {
    const result = await electronAPI?.task?.getStats();
    if (result?.success && result.data) {
      stats.value = result.data;
    }
  } catch (err) {
    console.error('[Tasks] 获取统计失败:', err);
  }
}

function handleSelectTask(task: TaskLogEntry): void {
  selectedTaskId.value = task.id;
  selectedTask.value = task;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'success': return '✅';
    case 'failed': return '❌';
    case 'running': return '🔄';
    case 'cancelled': return '⏹️';
    default: return '❓';
  }
}

function getModeIcon(mode: string): string {
  switch (mode) {
    case 'safe': return '🔒';
    case 'plan': return '⚖️';
    case 'craft': return '🔓';
    default: return '⚡';
  }
}

function getStatusType(status: string): string {
  switch (status) {
    case 'success': return 'success';
    case 'failed': return 'danger';
    case 'running': return 'warning';
    case 'cancelled': return 'info';
    default: return 'info';
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'success': return '成功';
    case 'failed': return '失败';
    case 'running': return '进行中';
    case 'cancelled': return '已取消';
    default: return '未知';
  }
}

function getModeText(mode: string): string {
  switch (mode) {
    case 'safe': return '安全模式';
    case 'plan': return '计划模式';
    case 'craft': return '全量模式';
    default: return '未知';
  }
}

function getStepIcon(status: string): string {
  switch (status) {
    case 'pending': return '⏳';
    case 'running': return '🔄';
    case 'success': return '✅';
    case 'failed': return '❌';
    case 'skipped': return '⏭️';
    case 'blocked': return '🚫';
    default: return '❓';
  }
}

function getRiskClass(riskLevel?: string): string {
  switch (riskLevel) {
    case 'low': return 'risk-low';
    case 'medium': return 'risk-medium';
    case 'high': return 'risk-high';
    default: return '';
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}

async function handleExport(format: 'json' | 'txt'): Promise<void> {
  if (!selectedTask.value) return;

  try {
    const result = await electronAPI?.task?.exportLog(selectedTask.value.id, format);
    if (result?.success && result.data) {
      const blob = new Blob([result.data], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `task-${selectedTask.value.id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      ElMessage.success('导出成功');
    }
  } catch (err) {
    ElMessage.error('导出失败');
  }
}

async function handleRetry(): Promise<void> {
  if (!selectedTask.value) return;

  try {
    ElMessageBox.confirm('确定要重试此任务吗？', '确认重试', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    const result = await electronAPI?.task?.retry(selectedTask.value.id);
    if (result?.success) {
      ElMessage.success('任务已重新提交');
      await fetchTasks();
      await fetchStats();
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error('重试失败');
    }
  }
}

async function handleCancel(): Promise<void> {
  if (!selectedTask.value) return;

  try {
    await electronAPI?.task?.cancel(selectedTask.value.id);
    ElMessage.success('任务已终止');
    await fetchTasks();
    await fetchStats();
  } catch (err) {
    ElMessage.error('终止失败');
  }
}

async function handleBatchDelete(): Promise<void> {
  if (selectedTasks.value.length === 0) return;

  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedTasks.value.length} 个任务吗？`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const result = await electronAPI?.task?.deleteLogs(selectedTasks.value);
    if (result?.success) {
      ElMessage.success(`已删除 ${result.data} 个任务`);
      selectedTasks.value = [];
      selectedTaskId.value = null;
      selectedTask.value = null;
      await fetchTasks();
      await fetchStats();
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
}
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.tasks-page {
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

.tasks-content {
  flex: 1;
  display: flex;
  gap: var(--content-padding);
  min-height: 0;
}

.tasks-sidebar {
  width: 360px;
  flex-shrink: 0;
  background: var(--el-bg-color);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-sm);
}

.stat-card {
  background: var(--el-fill-color-light);
  border-radius: var(--radius-md);
  padding: var(--space-sm);
  text-align: center;

  &.success {
    background: rgba(103, 194, 58, 0.1);
    .stat-value { color: var(--el-color-success); }
  }

  &.danger {
    background: rgba(245, 108, 108, 0.1);
    .stat-value { color: var(--el-color-danger); }
  }
}

.stat-value {
  font-size: var(--font-size-title-1);
  font-weight: var(--font-weight-semibold);
  color: var(--el-color-primary);
}

.stat-label {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-secondary);
  margin-top: var(--space-xs);
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.filter-title {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-secondary);
  font-weight: var(--font-weight-medium);
}

.actions-bar {
  display: flex;
  gap: var(--space-sm);
}

.tasks-list {
  flex: 1;
  min-height: 0;
}

.task-item {
  background: var(--el-fill-color-light);
  border-radius: var(--radius-md);
  padding: var(--space-sm);
  margin-bottom: var(--space-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
  border: 1px solid transparent;

  &:hover {
    background: var(--el-fill-color);
  }

  &.active {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  &.success {
    border-left: 3px solid var(--el-color-success);
  }

  &.failed {
    border-left: 3px solid var(--el-color-danger);
  }

  &.running {
    border-left: 3px solid var(--el-color-warning);
  }
}

.task-item-header {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-xs);
}

.task-status-icon,
.task-mode-icon {
  font-size: var(--font-size-caption-1);
}

.task-time {
  margin-left: auto;
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-secondary);
}

.task-item-content {
  font-size: var(--font-size-callout);
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-item-footer {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-xs);
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-secondary);
}

.empty-list {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--el-text-color-secondary);
}

.task-detail {
  flex: 1;
  background: var(--el-bg-color);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  overflow-y: auto;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.detail-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.title-icon {
  font-size: var(--font-size-title-2);
}

.title-text {
  font-size: var(--font-size-title-2);
  font-weight: var(--font-weight-semibold);
}

.detail-actions {
  display: flex;
  gap: var(--space-sm);
}

.detail-info {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.info-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-callout);
}

.info-label {
  color: var(--el-text-color-secondary);
}

.info-value {
  color: var(--text-color);
}

.section-title {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
  margin-bottom: var(--space-sm);
}

.detail-instruction {
  margin-bottom: var(--space-lg);
}

.instruction-text {
  background: var(--el-fill-color-light);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  font-size: var(--font-size-callout);
  line-height: var(--line-height-relaxed);
}

.detail-steps {
  margin-bottom: var(--space-lg);
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.step-item {
  background: var(--el-fill-color-light);
  border-radius: var(--radius-md);
  padding: var(--space-sm);
  border-left: var(--space-xs) solid var(--el-border-color);

  &.risk-low { border-left-color: var(--el-color-success); }
  &.risk-medium { border-left-color: var(--el-color-warning); }
  &.risk-high { border-left-color: var(--el-color-danger); }
  &.success { background: rgba(103, 194, 58, 0.05); }
  &.failed { background: rgba(245, 108, 108, 0.05); }
}

.step-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--space-sm);
}

.step-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--space-lg);
  height: var(--space-lg);
  background: var(--el-color-primary-light-8);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-caption-1);
  font-weight: var(--font-weight-semibold);
  color: var(--el-color-primary);
}

.step-icon {
  font-size: var(--font-size-body);
}

.step-description {
  color: var(--text-color);
}

.step-details {
  padding-left: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.detail-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-caption-1);
}

.row-label {
  color: var(--el-text-color-secondary);
  min-width: 50px;
}

.row-value {
  color: var(--text-color);
  font-size: var(--font-size-caption-1);

  &.success { color: var(--el-color-success); }
  &.error { color: var(--el-color-danger); }
}

code {
  background: var(--el-fill-color);
  padding: var(--space-xs) var(--space-xs);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-caption-1);
}

.detail-summary,
.detail-error {
  margin-bottom: var(--space-lg);
}

.summary-text {
  background: var(--el-fill-color-light);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  font-size: var(--font-size-callout);
}

.error-text {
  background: rgba(245, 108, 108, 0.05);
  border: 1px solid var(--el-color-danger-light-5);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  font-size: var(--font-size-callout);
  color: var(--el-color-danger);
}

.empty-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);

  p {
    margin-top: var(--space-md);
  }
}
</style>
