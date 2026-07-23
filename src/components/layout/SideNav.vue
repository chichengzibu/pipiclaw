<template>
  <aside class="side-nav" :style="{ width: sidebarWidth + 'px' }">
    <nav class="nav-list">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
      >
        <el-icon class="nav-icon">
          <component :is="item.icon" />
        </el-icon>
        <span class="nav-text">{{ t(item.titleKey) }}</span>
      </router-link>
    </nav>

    <!-- 底部信息 -->
    <div class="nav-footer">
      <el-select
        class="lang-switcher"
        :model-value="currentLocale"
        size="small"
        @change="handleLocaleChange"
      >
        <el-option label="简体中文" value="zh-CN" />
        <el-option label="English" value="en-US" />
      </el-select>
      <div class="version-info">
        <span class="version-label">PiPiClaw</span>
        <span class="version-number">v{{ appStore.version }}</span>
      </div>
      <GatewayStatusBadge />
    </div>

    <div
      class="resize-handle"
      @mousedown="startResize"
    ></div>
  </aside>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import GatewayStatusBadge from '@/components/common/GatewayStatusBadge.vue';
import { useAppStore } from '@/stores/app';
import i18n, { setLocale, type SupportedLocale } from '@/locales';

const { t } = useI18n();
const route = useRoute();
const appStore = useAppStore();

const navItems = [
  { path: '/dashboard', titleKey: 'nav.dashboard', icon: 'HomeFilled' },
  { path: '/chat', titleKey: 'nav.chat', icon: 'ChatDotRound' },
  { path: '/skills', titleKey: 'nav.skills', icon: 'Box' },
  { path: '/settings', titleKey: 'nav.settings', icon: 'Setting' },
  { path: '/help', titleKey: 'nav.help', icon: 'QuestionFilled' },
  { path: '/models', titleKey: 'nav.models', icon: 'Cpu' },
  { path: '/permissions', titleKey: 'nav.permissions', icon: 'Lock' },
  { path: '/plugin-market', titleKey: 'nav.plugins', icon: 'Shop' },
  { path: '/remote-control', titleKey: 'nav.remoteControl', icon: 'Connection' },
  { path: '/schedule', titleKey: 'nav.schedule', icon: 'Calendar' },
  { path: '/skill-market', titleKey: 'nav.skillMarket', icon: 'Goods' },
  { path: '/tasks', titleKey: 'nav.tasks', icon: 'List' },
  { path: '/d1-demo', titleKey: 'nav.demo.d1', icon: 'Camera' },
  { path: '/d5-demo', titleKey: 'nav.demo.d5', icon: 'VideoCamera' }
];

const sidebarWidth = ref(200);
const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
let isResizing = false;

const currentLocale = computed<string>(() => i18n.global.locale.value as string);

function handleLocaleChange(value: string | number | boolean | undefined): void {
  if (typeof value === 'string') {
    setLocale(value as SupportedLocale);
  }
}

const isActive = (path: string): boolean => {
  return route.path === path || route.path.startsWith(path + '/');
};

const startResize = (_e: MouseEvent) => {
  isResizing = true;
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
};

const handleResize = (e: MouseEvent) => {
  if (!isResizing) return;

  const newWidth = e.clientX;
  if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
    sidebarWidth.value = newWidth;
  }
};

const stopResize = () => {
  isResizing = false;
  document.body.style.userSelect = '';
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  // 保存宽度到本地存储
  localStorage.setItem('sidebarWidth', sidebarWidth.value.toString());
};

onMounted(() => {
  // 从本地存储恢复宽度（如果有）
  const savedWidth = localStorage.getItem('sidebarWidth');
  if (savedWidth) {
    const parsedWidth = parseInt(savedWidth);
    if (parsedWidth >= MIN_WIDTH && parsedWidth <= MAX_WIDTH) {
      sidebarWidth.value = parsedWidth;
    }
  }
});

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
});
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.side-nav {
  display: flex;
  flex-direction: column;
  height: 100%;
  flex-shrink: 0;
  background-color: var(--bg-color);
  border-right: 1px solid var(--border-color);
  position: relative;
}

.nav-list {
  display: flex;
  flex-direction: column;
  padding: 16px 8px;
  gap: 4px;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-color-secondary);
  transition: all 0.2s;
}

.nav-item:hover {
  background-color: var(--hover-bg-color);
  color: var(--text-color);
}

.nav-item.active {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.nav-item.active .nav-icon {
  color: var(--el-color-primary);
}

.nav-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.nav-text {
  font-size: 14px;
  font-weight: 500;
}

.nav-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.lang-switcher {
  width: 100%;
}

.version-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.version-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.version-number {
  font-size: 12px;
  color: var(--text-secondary);
}

.resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  background-color: transparent;
  transition: background-color 0.2s;
  z-index: 10;
}

.resize-handle:hover {
  background-color: var(--el-color-primary-light-5);
}
</style>