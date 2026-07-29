<!--
  Dashboard - v4.4 重做
  设计:
  - 4 张 stat-card 横排 (今日对话 / Token 用量 / 技能数 / IM 渠道)
  - 网关状态 section (启动/停止/重启,Apple HIG 风格)
  - 快捷操作 3 张卡片 (chat / skills / settings)
  - 全部走 token 系统,4 档 spacing/radius/shadow,focus-visible 继承全局
-->
<template>
  <div class="dashboard-page">
    <!-- 顶部统计 -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">今日对话</div>
        <div class="stat-value">12</div>
        <div class="stat-trend stat-trend-up">+3 较昨日</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Token 用量</div>
        <div class="stat-value">42.8K</div>
        <div class="stat-trend">≈ ¥0.07</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">已装技能</div>
        <div class="stat-value">2</div>
        <div class="stat-trend stat-trend-up">+1 本周</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">IM 渠道</div>
        <div class="stat-value">0</div>
        <div class="stat-trend stat-trend-muted">未连接</div>
      </div>
    </div>

    <!-- 网关状态 -->
    <section class="section">
      <div class="section-h">
        <h2>OpenClaw 网关</h2>
        <GatewayStatusBadge />
      </div>
      <div class="gateway-grid">
        <div class="gateway-info">
          <div class="info-row">
            <span class="info-label">状态</span>
            <el-tag :type="statusTagType" size="small" effect="light" round>
              {{ gatewayStore.stateText }}
            </el-tag>
          </div>
          <div class="info-row">
            <span class="info-label">端口</span>
            <span class="info-value">{{ gatewayStore.status.port || '—' }}</span>
          </div>
        </div>
        <div class="gateway-actions">
          <el-button
            type="primary"
            size="default"
            :loading="gatewayStore.isStarting"
            :disabled="gatewayStore.isRunning || gatewayStore.isStarting"
            @click="handleStart"
          >
            <el-icon><VideoPlay /></el-icon>
            启动
          </el-button>
          <el-button
            size="default"
            :loading="gatewayStore.status.state === 'stopping'"
            :disabled="!gatewayStore.isRunning"
            @click="handleStop"
          >
            <el-icon><VideoPause /></el-icon>
            停止
          </el-button>
          <el-button
            size="default"
            :loading="gatewayStore.loading && !gatewayStore.isStarting"
            :disabled="gatewayStore.isStarting || gatewayStore.status.state === 'stopping'"
            @click="handleRestart"
          >
            <el-icon><Refresh /></el-icon>
            重启
          </el-button>
        </div>
      </div>
      <el-alert
        v-if="gatewayStore.status.error"
        class="gateway-error"
        title="网关运行异常"
        type="error"
        :description="gatewayStore.status.error"
        show-icon
        :closable="false"
      />
    </section>

    <!-- 快捷操作 -->
    <section class="section">
      <div class="section-h">
        <h2>快速开始</h2>
        <a class="section-more" href="#">查看全部 →</a>
      </div>
      <div class="action-grid">
        <div class="action-card" @click="$router.push('/chat')">
          <div class="action-icon">
            <el-icon :size="18"><ChatDotRound /></el-icon>
          </div>
          <div class="action-text">
            <div class="action-title">新建对话</div>
            <div class="action-desc">跟 AI 助手聊天 (Ctrl N)</div>
          </div>
          <el-icon class="action-arrow"><ArrowRight /></el-icon>
        </div>
        <div class="action-card" @click="$router.push('/skills')">
          <div class="action-icon">
            <el-icon :size="18"><Box /></el-icon>
          </div>
          <div class="action-text">
            <div class="action-title">浏览技能</div>
            <div class="action-desc">2 已安装 · 11 可用</div>
          </div>
          <el-icon class="action-arrow"><ArrowRight /></el-icon>
        </div>
        <div class="action-card" @click="$router.push('/models')">
          <div class="action-icon">
            <el-icon :size="18"><Cpu /></el-icon>
          </div>
          <div class="action-text">
            <div class="action-title">切换模型</div>
            <div class="action-desc">qwen3.5:9b · 23s/5场景</div>
          </div>
          <el-icon class="action-arrow"><ArrowRight /></el-icon>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import GatewayStatusBadge from '@/components/common/GatewayStatusBadge.vue';
import { useGatewayStore } from '@/stores/gateway';
import {
  ChatDotRound, Box, ArrowRight,
  VideoPlay, VideoPause, Refresh, Cpu,
} from '@element-plus/icons-vue';

const gatewayStore = useGatewayStore();

const statusTagType = computed(() => {
  const map: Record<string, string> = {
    running: 'success',
    starting: 'warning',
    stopped: 'info',
    failed: 'danger',
    stopping: 'warning',
  };
  return map[gatewayStore.status.state] || 'info';
});

const handleStart = async () => { await gatewayStore.start(); };
const handleStop = async () => { await gatewayStore.stop(); };
const handleRestart = async () => { await gatewayStore.restart(); };

onMounted(() => { gatewayStore.initialize(); });
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.dashboard-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  box-sizing: border-box;
  overflow-y: auto;
  background-color: var(--bg-secondary);
}

/* ==================== Stat Grid ==================== */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
}

.stat-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  transition: all var(--duration-fast) var(--ease-standard);
}

.stat-card:hover {
  border-color: var(--accent-base);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.stat-label {
  font-size: var(--font-size-caption-1);
  color: var(--fg-tertiary);
  margin-bottom: var(--space-1);
}

.stat-value {
  font-size: var(--font-size-title-1);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.02em;
  color: var(--fg-primary);
  line-height: 1.1;
}

.stat-trend {
  font-size: var(--font-size-caption-2);
  color: var(--fg-tertiary);
  margin-top: var(--space-1);
}

.stat-trend-up { color: var(--success); }
.stat-trend-muted { color: var(--fg-quaternary); }

/* ==================== Section ==================== */
.section {
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.section-h {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.section-h h2 {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  color: var(--fg-primary);
  margin: 0;
}

.section-more {
  font-size: var(--font-size-caption-1);
  color: var(--accent-base);
  text-decoration: none;
}
.section-more:hover { text-decoration: underline; }

/* ==================== Gateway ==================== */
.gateway-grid {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.gateway-info {
  display: flex;
  gap: var(--space-4);
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.info-label {
  font-size: var(--font-size-caption-2);
  color: var(--fg-tertiary);
}

.info-value {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-medium);
  color: var(--fg-primary);
}

.gateway-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.gateway-actions .el-button {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.gateway-error { margin-top: var(--space-3); }

/* ==================== Action Grid ==================== */
.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}

.action-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  cursor: pointer;
  transition: all var(--duration-base) var(--ease-standard);
  text-align: left;
}

.action-card:hover {
  border-color: var(--accent-base);
  background: var(--accent-soft);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.action-icon {
  width: var(--space-2xl);
  height: var(--space-2xl);
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  color: var(--accent-base);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.action-text {
  flex: 1;
  min-width: 0;
}

.action-title {
  font-size: var(--font-size-callout);
  font-weight: var(--font-weight-medium);
  color: var(--fg-primary);
}

.action-desc {
  font-size: var(--font-size-caption-1);
  color: var(--fg-tertiary);
  margin-top: 2px;
}

.action-arrow {
  font-size: var(--icon-size-md);
  color: var(--fg-tertiary);
  flex-shrink: 0;
  transition: transform var(--duration-fast) var(--ease-standard);
}

.action-card:hover .action-arrow {
  color: var(--accent-base);
  transform: translateX(2px);
}

/* ==================== Responsive ==================== */
@media (max-width: 900px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
  .action-grid { grid-template-columns: 1fr; }
}
</style>
