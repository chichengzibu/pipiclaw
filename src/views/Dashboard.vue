<template>
  <div class="dashboard-page">
    <div class="page-header">
      <h1 class="page-title">首页</h1>
    </div>
    
    <!-- 网关状态卡片 -->
    <el-card class="gateway-card">
      <template #header>
        <div class="card-header">
          <span>网关状态</span>
          <GatewayStatusBadge />
        </div>
      </template>
      <div class="gateway-content">
        <div class="gateway-info">
          <div class="info-item">
            <span class="info-label">当前状态:</span>
            <el-tag :type="statusTagType" size="small">{{ gatewayStore.stateText }}</el-tag>
          </div>
          <div class="info-item">
            <span class="info-label">运行端口:</span>
            <span class="info-value">{{ gatewayStore.status.port || '-' }}</span>
          </div>
          <div class="info-item error-item" v-if="gatewayStore.status.error">
            <el-alert
              title="网关运行异常"
              type="error"
              :description="gatewayStore.status.error"
              show-icon
              :closable="false"
            />
          </div>
        </div>
        <div class="gateway-actions">
          <el-button 
            type="primary" 
            :loading="gatewayStore.isStarting"
            :disabled="gatewayStore.isRunning || gatewayStore.isStarting"
            @click="handleStart"
          >
            <el-icon><VideoPlay /></el-icon>
            启动
          </el-button>
          <el-button 
            type="danger"
            :loading="gatewayStore.status.state === 'stopping'"
            :disabled="!gatewayStore.isRunning"
            @click="handleStop"
          >
            <el-icon><VideoPause /></el-icon>
            停止
          </el-button>
          <el-button 
            :loading="gatewayStore.loading && !gatewayStore.isStarting"
            :disabled="gatewayStore.isStarting || gatewayStore.status.state === 'stopping'"
            @click="handleRestart"
          >
            <el-icon><Refresh /></el-icon>
            重启
          </el-button>
        </div>
      </div>
    </el-card>
    
    <!-- 快捷入口 -->
    <div class="quick-actions-section">
      <h2 class="section-title">快捷操作</h2>
      <div class="quick-actions-grid">
        <div class="action-card" @click="$router.push('/chat')">
          <div class="action-icon">
            <el-icon><ChatDotRound /></el-icon>
          </div>
          <div class="action-content">
            <h3 class="action-title">开始对话</h3>
            <p class="action-desc">与 AI 助手进行对话</p>
          </div>
          <el-icon class="action-arrow"><ArrowRight /></el-icon>
        </div>
        
        <div class="action-card" @click="$router.push('/skills')">
          <div class="action-icon">
            <el-icon><Box /></el-icon>
          </div>
          <div class="action-content">
            <h3 class="action-title">技能管理</h3>
            <p class="action-desc">管理和配置自动化技能</p>
          </div>
          <el-icon class="action-arrow"><ArrowRight /></el-icon>
        </div>
        
        <div class="action-card" @click="$router.push('/settings')">
          <div class="action-icon">
            <el-icon><Setting /></el-icon>
          </div>
          <div class="action-content">
            <h3 class="action-title">系统设置</h3>
            <p class="action-desc">配置应用和模型设置</p>
          </div>
          <el-icon class="action-arrow"><ArrowRight /></el-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElNotification } from 'element-plus';
import GatewayStatusBadge from '@/components/common/GatewayStatusBadge.vue';
import { useGatewayStore } from '@/stores/gateway';
import { ChatDotRound, Box, Setting, ArrowRight, VideoPlay, VideoPause, Refresh } from '@element-plus/icons-vue';

const router = useRouter();
const gatewayStore = useGatewayStore();

const statusTagType = computed(() => {
  const map: Record<string, string> = {
    running: 'success',
    starting: 'warning',
    stopped: 'info',
    failed: 'danger',
    stopping: 'warning'
  };
  return map[gatewayStore.status.state] || 'info';
});

const handleStart = async () => {
  await gatewayStore.start();
};

const handleStop = async () => {
  await gatewayStore.stop();
};

const handleRestart = async () => {
  await gatewayStore.restart();
};

onMounted(() => {
  gatewayStore.initialize();
});
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.dashboard-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  box-sizing: border-box;
  overflow-y: auto;
  background-color: var(--page-bg) !important;
  color: var(--text-primary) !important;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.page-title {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary) !important;
  margin: 0;
}

.gateway-card {
  flex-shrink: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.gateway-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.gateway-info {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.info-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.info-label {
  color: var(--text-secondary) !important;
  font-size: 14px;
}

.info-value {
  color: var(--text-primary) !important;
  font-size: 14px;
  font-weight: 500;
}

.gateway-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}

.gateway-actions .el-button {
  display: flex;
  align-items: center;
  gap: 6px;
}

.quick-actions-section {
  flex: 1;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px 0;
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.action-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: var(--el-color-primary-light-9);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.action-icon .el-icon {
  font-size: 28px;
  color: var(--el-color-primary);
}

.action-content {
  flex: 1;
  min-width: 0;
}

.action-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.action-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.action-arrow {
  font-size: 20px;
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: transform 0.2s;
}

.action-card:hover .action-arrow {
  color: var(--el-color-primary);
  transform: translateX(4px);
}
</style>
