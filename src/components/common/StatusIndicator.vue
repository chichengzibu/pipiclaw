<template>
  <div class="status-indicator" :class="statusClass">
    <span class="status-dot"></span>
    <span class="status-text">{{ displayText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  status: 'success' | 'warning' | 'error' | 'info' | 'pending';
  text?: string;
}

const props = withDefaults(defineProps<Props>(), {
  status: 'info',
  text: ''
});

const statusClass = computed(() => `status-${props.status}`);

const defaultTextMap: Record<string, string> = {
  success: '运行中',
  warning: '警告',
  error: '错误',
  info: '正常',
  pending: '等待中'
};

const displayText = computed(() => {
  return props.text || defaultTextMap[props.status];
});
</script>

<style lang="scss" scoped>
.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-success .status-dot {
  background-color: var(--el-color-success);
  box-shadow: 0 0 4px var(--el-color-success);
}

.status-warning .status-dot {
  background-color: var(--el-color-warning);
  box-shadow: 0 0 4px var(--el-color-warning);
}

.status-error .status-dot {
  background-color: var(--el-color-danger);
  box-shadow: 0 0 4px var(--el-color-danger);
}

.status-info .status-dot {
  background-color: var(--el-color-info);
  box-shadow: 0 0 4px var(--el-color-info);
}

.status-pending .status-dot {
  background-color: var(--el-color-primary);
  box-shadow: 0 0 4px var(--el-color-primary);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
