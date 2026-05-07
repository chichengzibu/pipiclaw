
<template>
  <div class="task-result-card">
    <div class="task-result-header" @click="toggleExpand">
      <span class="result-icon">{{ success ? '✅' : '❌' }}</span>
      <span class="result-title">
        {{ success ? '任务执行成功' : '任务执行失败' }}
      </span>
      <span v-if="duration != null" class="result-duration">
        · {{ steps.length }} 步 · {{ duration }}ms
      </span>
      <span class="toggle-icon">{{ expanded ? '▼' : '▶' }}</span>
    </div>

    <Transition name="expand">
      <div v-if="expanded" class="task-result-details">
        <div v-if="summary" class="result-summary">
          {{ summary }}
        </div>

        <div v-if="steps.length > 0" class="result-steps">
          <div v-for="step in steps" :key="step.order" class="result-step-item" :class="{ failed: step.status === 'failed' }">
            <span class="step-index">{{ step.order }}</span>
            <span class="step-icon">
              {{ step.status === 'success' ? '✅' : step.status === 'failed' ? '❌' : step.status === 'running' ? '🔄' : '⏳' }}
            </span>
            <div class="step-content">
              <span class="step-description">{{ step.description || '执行步骤' }}</span>
              <div v-if="step.params" class="step-params">
                <span v-if="step.params.filePath || step.params.path" class="param-item">
                  📁 路径：<code>{{ step.params.filePath || step.params.path }}</code>
                </span>
                <span v-if="step.params.content" class="param-item">
                  📝 内容：<code>{{ getContentPreview(step.params.content) }}</code>
                </span>
                <span v-if="step.params.command" class="param-item">
                  💻 命令：<code>{{ step.params.command }}</code>
                </span>
                <span v-if="step.params.newPath" class="param-item">
                  🔄 新路径：<code>{{ step.params.newPath }}</code>
                </span>
                <span v-if="step.params.url" class="param-item">
                  🌐 URL：<code>{{ step.params.url }}</code>
                </span>
              </div>
            </div>
            <span v-if="step.duration > 0" class="step-duration">{{ step.duration }}ms</span>
          </div>
        </div>

        <div v-if="error" class="result-error">
          <span class="error-label">错误详情：</span>
          <span class="error-content">{{ error }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface TaskStep {
  order: number;
  description: string;
  status: 'success' | 'failed' | 'running' | 'pending';
  duration?: number;
  error?: string | null;
  params?: Record<string, any>;
}

interface Props {
  success: boolean;
  duration?: number;
  summary?: string;
  error?: string;
  steps: TaskStep[];
  defaultExpanded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  defaultExpanded: false,
  success: false,
  duration: 0,
  summary: '',
  error: '',
  steps: () => []
});

const expanded = ref(props.defaultExpanded);

const toggleExpand = () => {
  expanded.value = !expanded.value;
};

const getContentPreview = (content: string): string => {
  if (!content) return '';
  return content.length > 100 ? content.substring(0, 100) + '...' : content;
};

watch(() => props.defaultExpanded, (newVal) => {
  if (newVal !== undefined) {
    expanded.value = newVal;
  }
});
</script>

<style lang="scss" scoped>
.task-result-card {
  background: var(--el-fill-color-light);
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
}

.task-result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  padding: 12px 16px;
  background: var(--el-bg-color-page);
  cursor: pointer;
  transition: background 0.2s;
}

.task-result-header:hover {
  background: var(--el-fill-color-lighter);
}

.result-icon {
  font-size: 16px;
}

.result-title {
  color: var(--el-text-color-primary);
  flex: 1;
}

.result-duration {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.toggle-icon {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  transition: transform 0.2s;
}

.task-result-details {
  border-top: 1px solid var(--el-border-color-light);
}

.result-summary {
  padding: 12px 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.result-steps {
  padding: 0 16px 12px;
}

.result-step-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  background: var(--el-bg-color);
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 8px;
}

.result-step-item:last-child {
  margin-bottom: 0;
}

.result-step-item.failed {
  background: var(--el-color-danger-light-9);
  border: 1px solid var(--el-color-danger-light-5);
}

.step-index {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  margin-top: 2px;
}

.result-step-item.failed .step-index {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.step-icon {
  font-size: 14px;
  margin-top: 3px;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
  min-width: 0;
}

.step-description {
  color: var(--el-text-color-primary);
  display: block;
}

.step-params {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.param-item {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.param-item code {
  background: var(--el-fill-color);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.step-duration {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
  margin-top: 4px;
}

.result-error {
  padding: 12px 16px;
  background: var(--el-color-danger-light-9);
  border-top: 1px solid var(--el-color-danger-light-5);
  font-size: 13px;
}

.error-label {
  font-weight: 600;
  color: var(--el-color-danger);
  margin-right: 8px;
}

.error-content {
  color: var(--el-text-color-primary);
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 1000px;
}
</style>

