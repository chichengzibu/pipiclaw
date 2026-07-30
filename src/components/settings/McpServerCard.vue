<template>
  <el-card class="mcp-server-card" shadow="hover">
    <div class="card-header">
      <div class="server-info">
        <div class="server-icon">
          <el-icon class="icon-emoji" :size="24"><Connection /></el-icon>
        </div>
        <div class="server-details">
          <h4 class="server-name">{{ server.name }}</h4>
          <span class="server-command">{{ truncateCommand(server.command) }}</span>
        </div>
      </div>
      <div class="status-indicator">
        <el-tag :type="server.enabled ? 'success' : 'info'" size="small" effect="plain">
          {{ server.enabled ? '已启用' : '已禁用' }}
        </el-tag>
      </div>
    </div>

    <div class="card-body">
      <div class="meta-row">
        <span class="meta-label">参数:</span>
        <span class="meta-value">{{ argsDisplay }}</span>
      </div>
      <div class="meta-row" v-if="server.env && Object.keys(server.env).length > 0">
        <span class="meta-label">环境变量:</span>
        <span class="meta-value">{{ Object.keys(server.env).join(', ') }}</span>
      </div>
    </div>

    <template #footer>
      <div class="card-actions">
        <el-button size="small" @click="handleTest">
          测试连接
        </el-button>
        <el-button size="small" @click="handleEdit">
          编辑
        </el-button>
        <el-button size="small" type="danger" text @click="handleDelete">
          删除
        </el-button>
      </div>
    </template>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Connection } from '@element-plus/icons-vue';

interface McpServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

const props = defineProps<{ server: McpServer }>();

const argsDisplay = computed<string>(() => {
  const args = props.server.args;
  return args && args.length > 0 ? args.join(', ') : '-';
});

const emit = defineEmits<{
  edit: [];
  delete: [];
  test: [];
}>();

function truncateCommand(command: string): string {
  if (command.length <= 40) return command;
  return command.substring(0, 40) + '...';
}

function handleEdit(): void {
  emit('edit');
}

function handleDelete(): void {
  emit('delete');
}

function handleTest(): void {
  emit('test');
}
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.mcp-server-card {
  transition: all 0.3s;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.server-info {
  display: flex;
  gap: 12px;
  flex: 1;
}

.server-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--el-color-primary-light-9);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-emoji {
  color: var(--el-color-primary);
}

.server-details {
  flex: 1;
  min-width: 0;
}

.server-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.server-command {
  font-size: 13px;
  color: var(--text-secondary);
  font-family: 'Consolas', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-body {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.meta-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-bottom: 8px;
  font-size: 13px;
}

.meta-label {
  color: var(--text-secondary);
  font-weight: 500;
  flex-shrink: 0;
}

.meta-value {
  color: var(--text-primary);
  word-break: break-all;
}

.card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
