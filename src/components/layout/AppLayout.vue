<template>
  <div class="app-layout">
    <TitleBar />

    <!-- 更新提示 banner(非阻塞) -->
    <UpdateBanner />

    <div class="app-content">
      <SideNav />

      <main class="main-content">
        <router-view v-slot="{ Component, route }">
          <transition name="route-fade" mode="out-in">
            <component :is="Component" :key="route.fullPath" />
          </transition>
        </router-view>
      </main>
    </div>

    <div class="app-status-bar">
      <button class="status-item status-shortcut" @click="openPalette" title="命令面板 (Ctrl+K)">
        <el-icon><Search /></el-icon>
        <span>命令</span>
        <kbd>Ctrl K</kbd>
      </button>
      <span class="status-divider">|</span>
      <span class="status-item">PiPiClaw v{{ appStore.version }}</span>
      <span class="status-divider">|</span>
      <span class="status-item">
        <GatewayStatusBadge />
      </span>
    </div>

    <!-- 全局命令面板 (Cmd+K) -->
    <CommandPalette />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useAppStore } from '@/stores/app';
import TitleBar from './TitleBar.vue';
import SideNav from './SideNav.vue';
import GatewayStatusBadge from '@/components/common/GatewayStatusBadge.vue';
import CommandPalette from '@/components/common/CommandPalette.vue';
import UpdateBanner from '@/components/common/UpdateBanner.vue';
import { Search } from '@element-plus/icons-vue';

const appStore = useAppStore();

function openPalette(): void {
  window.dispatchEvent(new CustomEvent('cmd:open-palette'));
}

interface ToastDetail {
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
}

function onToast(e: Event): void {
  const ce = e as CustomEvent<ToastDetail>;
  const { type, text } = ce.detail || { type: 'info', text: '' };
  if (!text) return;
  switch (type) {
    case 'success': ElMessage.success(text); break;
    case 'error': ElMessage.error(text); break;
    case 'warning': ElMessage.warning(text); break;
    default: ElMessage.info(text);
  }
}

onMounted(() => {
  window.addEventListener('cmd:toast', onToast);
});

onUnmounted(() => {
  window.removeEventListener('cmd:toast', onToast);
});
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.app-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--bg-color);
}

.app-content {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.main-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: $content-padding;
  background-color: var(--bg-color-secondary);
}

.app-status-bar {
  display: flex;
  align-items: center;
  height: 24px;
  padding: 0 12px;
  background-color: var(--bg-color);
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-color-secondary);
  flex-shrink: 0;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-divider {
  margin: 0 8px;
  color: var(--border-color);
}

.status-shortcut {
  background: transparent;
  border: 1px solid var(--border-base);
  color: var(--fg-secondary);
  padding: 0 8px;
  height: 18px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 11px;
  font-family: inherit;
  transition: background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard);

  .el-icon {
    font-size: 11px;
  }

  kbd {
    font-family: var(--font-family-mono);
    font-size: 9px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-base);
    border-radius: 2px;
    padding: 0 3px;
    margin-left: 2px;
    color: var(--fg-tertiary);
  }

  &:hover {
    background: var(--bg-hover);
    border-color: var(--border-strong);
    color: var(--fg-primary);
  }
}
</style>
