<!--
  SideNav - macOS Sonoma / Apple HIG 风格

  设计:
  - 默认收起成 64px 宽,只显示 icon (像 macOS Finder sidebar)
  - 鼠标悬停时展开到 240px,显示 icon + label + section header
  - 点击 pin 按钮或 Cmd+Shift+S 固定展开
  - Spring animation (cubic-bezier(0.34, 1.56, 0.64, 1))
  - Active state: 蓝色 accent dot + 微背景色
  - Bottom: 用户头像 + 设置入口 (像 macOS 用户切换菜单)
  - Tooltip 在收起状态显示 (macOS dock style)
-->
<template>
  <!-- v4-mockup 风:60px icon-only rail,无文字,无 brand,无 footer -->
  <nav class="sidenav">
    <router-link
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      class="nav-icon"
      :class="{ active: isActive(item.path) }"
      :aria-label="t(item.titleKey)"
      :title="t(item.titleKey)"
    >
      <el-icon :size="18"><component :is="item.icon" /></el-icon>
    </router-link>
    <div class="nav-spacer" />
    <router-link
      :to="settingsPath"
      class="nav-icon"
      :class="{ active: isActive(settingsPath) }"
      :aria-label="t('nav.settings')"
      :title="t('nav.settings')"
    >
      <el-icon :size="18"><Setting /></el-icon>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  House, ChatDotRound, Box, Cpu, List, ChatLineRound, Calendar, Setting
} from '@element-plus/icons-vue'

const { t } = useI18n()
const route = useRoute()

interface NavItem {
  path: string
  titleKey: string
  icon: string
}

/** v4-mockup 风:6 个核心 (Home / Chat / Models / Skills / IM / Schedule) + 底部 Settings */
const navItems: NavItem[] = [
  { path: '/dashboard',     titleKey: 'nav.dashboard',     icon: 'House' },
  { path: '/chat',          titleKey: 'nav.chat',          icon: 'ChatDotRound' },
  { path: '/models',        titleKey: 'nav.models',        icon: 'Cpu' },
  { path: '/skills',        titleKey: 'nav.skills',        icon: 'Box' },
  { path: '/im-management', titleKey: 'nav.imManagement',  icon: 'ChatLineRound' },
  { path: '/schedule',      titleKey: 'nav.schedule',      icon: 'Calendar' },
]

const settingsPath = '/settings'

const isActive = (path: string): boolean =>
  route.path === path || route.path.startsWith(path + '/')
</script>

<style lang="scss" scoped>
/* ========== v4-mockup 同款:60px icon-only rail ========== */
.sidenav {
  width: 60px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 0;
  background: var(--bg-base);
  border-right: 1px solid var(--border-subtle);
}

.nav-icon {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-tertiary);
  background: transparent;
  text-decoration: none;
  position: relative;
  transition: background-color 120ms var(--ease-standard),
    color 120ms var(--ease-standard);

  &:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }

  &.active {
    color: var(--accent-base);
    background: var(--accent-soft);
  }
}

.nav-spacer {
  flex: 1;
  min-height: 8px;
}
</style>