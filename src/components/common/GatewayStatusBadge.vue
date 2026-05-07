<template>
  <div class="gateway-status-badge" :class="statusClass">
    <span class="status-dot" :class="{ 'pulse': isStarting || isStopping }"></span>
    <span class="status-text">{{ stateText }}</span>
    <span v-if="status.port" class="status-port">:{{ status.port }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * PiPiClaw - 网关状态指示器组件
 */

import { computed } from 'vue';
import { useGatewayStore } from '@/stores/gateway';

const gatewayStore = useGatewayStore();

const status = computed(() => gatewayStore.status);
const stateText = computed(() => gatewayStore.stateText);
const isStarting = computed(() => gatewayStore.isStarting);
const isStopping = computed(() => gatewayStore.isStopping);

const statusClass = computed(() => `status-${status.value.state}`);
</script>

<style scoped>
.gateway-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  background-color: var(--bg-color-secondary);
  border: 1px solid var(--border-color);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-stopped .status-dot {
  background-color: var(--el-color-info);
}

.status-starting .status-dot,
.status-stopping .status-dot {
  background-color: var(--el-color-primary);
}

.status-running .status-dot {
  background-color: var(--el-color-success);
  box-shadow: 0 0 4px var(--el-color-success);
}

.status-failed .status-dot {
  background-color: var(--el-color-danger);
  box-shadow: 0 0 4px var(--el-color-danger);
}

.pulse {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.9);
  }
}

.status-text {
  color: var(--text-color);
}

.status-port {
  color: var(--text-color-secondary);
  font-size: 11px;
}
</style>
