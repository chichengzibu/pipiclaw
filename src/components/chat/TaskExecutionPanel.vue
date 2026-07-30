<template>
  <div class="task-execution-panel" v-if="visible">
    <div class="panel-header">
      <div class="panel-title">
        <el-icon class="title-icon" :size="18">
          <component :is="getModeIcon()" />
        </el-icon>
        <span class="title-text">{{ getTitle() }}</span>
      </div>
      <div class="panel-actions">
        <el-button
          v-if="status === 'executing'"
          type="danger"
          size="small"
          @click="handleCancel"
        >
          终止执行
        </el-button>
        <el-button
          v-if="status === 'completed' || status === 'failed'"
          type="primary"
          size="small"
          @click="handleClose"
        >
          关闭
        </el-button>
      </div>
    </div>

    <div class="panel-content">
      <div class="execution-info">
        <el-tag :type="getStatusType()" size="small">
          {{ getStatusText() }}
        </el-tag>
        <span class="execution-mode">
          {{ getModeText() }}
        </span>
        <span v-if="duration" class="execution-duration">
          {{ duration }}ms
        </span>
      </div>

      <div class="steps-container">
        <div
          v-for="step in steps"
          :key="step.order"
          class="step-item"
          :class="[step.status, getRiskClass(step.riskLevel)]"
        >
          <div class="step-header">
            <span class="step-order">{{ step.order }}</span>
            <el-icon class="step-icon" :size="14" :class="`is-${step.status}`">
              <component :is="getStepIcon(step.status)" />
            </el-icon>
            <span class="step-description">{{ step.description }}</span>
          </div>

          <div class="step-details">
            <div class="step-operation">
              <span class="label">操作:</span>
              <code class="value">{{ step.operation }}</code>
            </div>

            <div v-if="step.permissionCheck" class="step-permission">
              <span class="label">权限:</span>
              <el-tag
                :type="step.permissionCheck.allowed ? 'success' : 'danger'"
                size="small"
              >
                {{ step.permissionCheck.allowed ? '通过' : '拒绝' }}
              </el-tag>
              <span class="permission-detail">
                {{ step.permissionCheck.category }}/{{ step.permissionCheck.action }}
              </span>
              <span v-if="!step.permissionCheck.allowed && step.permissionCheck.reason" class="permission-reason">
                {{ step.permissionCheck.reason }}
              </span>
            </div>

            <div v-if="step.result && step.status === 'success'" class="step-result">
              <span class="label">结果:</span>
              <span class="result-text">{{ step.result }}</span>
            </div>

            <div v-if="step.error && step.status === 'failed'" class="step-error">
              <span class="label">错误:</span>
              <span class="error-text">{{ step.error }}</span>
            </div>

            <div v-if="step.status === 'blocked'" class="step-blocked">
              <el-icon class="blocked-icon" :size="14" color="var(--el-color-danger)"><CircleClose /></el-icon>
              <span class="blocked-text">权限不足，此步骤被拦截</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="summary" class="execution-summary">
        <div class="summary-label">执行摘要:</div>
        <div class="summary-text">{{ summary }}</div>
      </div>

      <div v-if="error && status === 'failed'" class="execution-error">
        <div class="error-label">错误信息:</div>
        <div class="error-message">{{ error }}</div>
        <div v-if="guidance" class="error-guidance">
          <div class="guidance-label">修复建议:</div>
          <div class="guidance-text">{{ guidance }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CircleCheck, CircleClose, Clock, Refresh, Warning, Lock, Promotion, Lightning, VideoPause, QuestionFilled } from '@element-plus/icons-vue';

interface StepPermissionCheck {
  category: string;
  action: string;
  resource?: string;
  allowed: boolean;
  reason?: string;
}

interface Step {
  order: number;
  operation: string;
  description: string;
  params: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'blocked';
  permissionCheck?: StepPermissionCheck;
  result?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
  duration?: number;
}

const props = defineProps<{
  visible: boolean;
  taskId?: string;
  mode?: string;
  status: 'parsing' | 'executing' | 'completed' | 'failed';
  steps: Step[];
  summary?: string;
  error?: string;
  guidance?: string;
  duration?: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'cancel'): void;
}>();

const getModeIcon = () => {
  switch (props.mode) {
    case 'safe': return 'Lock';
    case 'plan': return 'Promotion';
    case 'craft': return 'Lightning';
    default: return 'Lightning';
  }
};

const getTitle = () => {
  switch (props.status) {
    case 'parsing': return '正在解析指令...';
    case 'executing': return '任务执行中...';
    case 'completed': return '任务执行完成';
    case 'failed': return '任务执行失败';
    default: return '任务执行';
  }
};

const getStatusType = () => {
  switch (props.status) {
    case 'parsing': return 'info';
    case 'executing': return 'warning';
    case 'completed': return 'success';
    case 'failed': return 'danger';
    default: return 'info';
  }
};

const getStatusText = () => {
  switch (props.status) {
    case 'parsing': return '解析中';
    case 'executing': return '执行中';
    case 'completed': return '已完成';
    case 'failed': return '失败';
    default: return '未知';
  }
};

const getModeText = () => {
  switch (props.mode) {
    case 'safe': return '安全模式';
    case 'plan': return '计划模式';
    case 'craft': return '全量模式';
    default: return '';
  }
};

const getStepIcon = (status: string) => {
  switch (status) {
    case 'pending': return 'Clock';
    case 'running': return 'Refresh';
    case 'success': return 'CircleCheck';
    case 'failed': return 'CircleClose';
    case 'skipped': return 'VideoPause';
    case 'blocked': return 'Warning';
    default: return 'QuestionFilled';
  }
};

const getRiskClass = (riskLevel: string) => {
  switch (riskLevel) {
    case 'low': return 'risk-low';
    case 'medium': return 'risk-medium';
    case 'high': return 'risk-high';
    default: return '';
  }
};

const handleClose = () => {
  emit('close');
};

const handleCancel = () => {
  emit('cancel');
};
</script>

<style lang="scss" scoped>
.task-execution-panel {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 12px;
  margin-bottom: 16px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--el-color-primary-light-9);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-color-primary);
}

.title-icon {
  display: inline-flex;
  align-items: center;
  color: var(--el-color-primary);
}

.panel-actions {
  display: flex;
  gap: 8px;
}

.panel-content {
  padding: 16px;
}

.execution-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 13px;
}

.execution-mode,
.execution-duration {
  color: var(--el-text-color-secondary);
}

.steps-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-item {
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 12px;
  border-left: 3px solid var(--el-border-color);

  &.risk-low {
    border-left-color: var(--el-color-success);
  }

  &.risk-medium {
    border-left-color: var(--el-color-warning);
  }

  &.risk-high {
    border-left-color: var(--el-color-danger);
  }

  &.success {
    background: rgba(103, 194, 58, 0.05);
  }

  &.failed {
    background: rgba(245, 108, 108, 0.05);
  }

  &.blocked {
    background: rgba(245, 108, 108, 0.1);
  }

  &.running {
    background: rgba(230, 162, 60, 0.05);
  }
}

.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}

.step-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: var(--el-color-primary-light-8);
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.step-icon {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}
.step-icon.is-success { color: var(--el-color-success); }
.step-icon.is-failed  { color: var(--el-color-danger); }
.step-icon.is-blocked { color: var(--el-color-danger); }
.step-icon.is-running { color: var(--el-color-warning); animation: task-spin 1.2s linear infinite; }
.step-icon.is-pending { color: var(--el-text-color-placeholder); }
.step-icon.is-skipped { color: var(--el-text-color-secondary); }

@keyframes task-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.step-description {
  color: var(--text-color);
}

.step-details {
  padding-left: 28px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}

.step-operation,
.step-permission,
.step-result,
.step-error {
  display: flex;
  align-items: center;
  gap: 6px;
}

.label {
  color: var(--el-text-color-secondary);
  min-width: 40px;
}

.value {
  background: var(--el-fill-color);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 11px;
}

.permission-detail {
  color: var(--el-text-color-secondary);
}

.permission-reason {
  color: var(--el-color-danger);
  font-size: 11px;
}

.result-text {
  color: var(--el-color-success);
  word-break: break-all;
}

.error-text {
  color: var(--el-color-danger);
  word-break: break-all;
}

.step-blocked {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-color-danger);
  font-weight: 500;
}

.blocked-icon {
  display: inline-flex;
  align-items: center;
}

.execution-summary {
  margin-top: 16px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.summary-label,
.error-label,
.guidance-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.summary-text {
  font-size: 13px;
  color: var(--text-color);
}

.execution-error {
  margin-top: 16px;
  padding: 12px;
  background: rgba(245, 108, 108, 0.05);
  border: 1px solid var(--el-color-danger-light-5);
  border-radius: 8px;
}

.error-message {
  font-size: 13px;
  color: var(--el-color-danger);
  word-break: break-all;
}

.error-guidance {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.guidance-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
