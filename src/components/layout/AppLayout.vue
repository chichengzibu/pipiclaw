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

    <!-- Floating command button (macOS Spotlight style) -->
    <button
      class="floating-cmd-btn"
      title="命令面板 (Ctrl+K)"
      @click="openPalette"
    >
      <el-icon><Search /></el-icon>
      <span class="cmd-label">命令</span>
      <kbd>⌘K</kbd>
    </button>

    <!-- 全局命令面板 (Cmd+K) -->
    <CommandPalette />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useAppStore } from '@/stores/app';
import { useGatewayStore } from '@/stores/gateway';
import TitleBar from './TitleBar.vue';
import SideNav from './SideNav.vue';
import CommandPalette from '@/components/common/CommandPalette.vue';
import UpdateBanner from '@/components/common/UpdateBanner.vue';
import { Search } from '@element-plus/icons-vue';

const appStore = useAppStore();
const gatewayStore = useGatewayStore();

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
  appStore.initialize();
  gatewayStore.initialize();
  window.addEventListener('cmd:toast', onToast);
  window.addEventListener('keydown', onGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener('cmd:toast', onToast);
  window.removeEventListener('keydown', onGlobalKeydown);
});

function onGlobalKeydown(e: KeyboardEvent): void {
  const candidates: (HTMLElement | null)[] = [
    e.target as HTMLElement | null,
    document.activeElement as HTMLElement | null
  ];
  for (const el of candidates) {
    if (!el) continue;
    const tag = el.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || el.isContentEditable) {
      return;
    }
  }
  const isMod = e.metaKey || e.ctrlKey;
  if (!isMod) return;
  if (e.key === 'k' || e.key === 'K') {
    e.preventDefault();
    openPalette();
    return;
  }
  if (e.key === '/') {
    e.preventDefault();
    openPalette();
    return;
  }
}
</script>

<style lang="scss" scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-base);
  -webkit-font-smoothing: antialiased;
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
  background: var(--bg-base);
  /* 移除 padding — 由各 view 自己控制内边距 (Apple-style content breathing) */
}

/* ========== Floating command button (Spotlight style) ========== */
.floating-cmd-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 16px 0 14px;
  border: none;
  border-radius: 22px;
  background: var(--bg-elevated);
  color: var(--fg-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  box-shadow: var(--shadow-lg);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border: 0.5px solid var(--border-base);
  transition: transform var(--duration-fast) var(--ease-spring),
    box-shadow var(--duration-fast) var(--ease-standard),
    background-color var(--duration-fast) var(--ease-standard);

  .el-icon {
    font-size: 16px;
  }

  kbd {
    font-family: var(--font-family-mono);
    font-size: 11px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-xs);
    padding: 1px 6px;
    margin-left: 4px;
    color: var(--fg-tertiary);
  }

  &:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: var(--shadow-xl);
    background: var(--bg-elevated);
  }

  &:active {
    transform: translateY(0) scale(0.97);
    transition-duration: 80ms;
  }
}
</style>