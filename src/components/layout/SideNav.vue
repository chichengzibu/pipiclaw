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
  <aside
    class="side-nav expanded"
  >
    <!-- 顶部品牌 (极简:只 logo) -->
    <div class="brand" :title="`PiPiClaw v${appStore.version}`">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2L3 7v10l9 5 9-5V7l-9-5z"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
            fill="var(--accent-soft)"
          />
          <path
            d="M12 7v10M7 9.5l10 5M17 9.5l-10 5"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linejoin="round"
            opacity="0.7"
          />
        </svg>
      </div>
    </div>

    <!-- 核心导航 (8 个,无分组无 header,Linear / Raycast 风格) -->
    <nav class="nav-list">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
        :title="!expanded ? t(item.titleKey) : ''"
      >
        <el-icon class="nav-icon"><component :is="item.icon" /></el-icon>
        <span v-if="expanded" class="nav-label">{{ t(item.titleKey) }}</span>
      </router-link>
    </nav>

    <!-- 底部仅 user avatar (无 theme 切换 / collapse 按钮) -->
    <div class="nav-footer">
      <div class="user-avatar" :title="`PiPiClaw v${appStore.version}`">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="9" r="3.5" stroke="currentColor" stroke-width="1.5" />
          <path
            d="M5 20c0-3.5 3.13-6 7-6s7 2.5 7 6"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'

const { t } = useI18n()
const route = useRoute()
const appStore = useAppStore()

interface NavItem {
  path: string
  titleKey: string
  icon: string
}

/** 8 个核心 (Linear / Raycast 风格:无分组,极简) */
const navItems: NavItem[] = [
  { path: '/dashboard',    titleKey: 'nav.dashboard',    icon: 'HomeFilled' },
  { path: '/chat',         titleKey: 'nav.chat',         icon: 'ChatDotRound' },
  { path: '/skills',       titleKey: 'nav.skills',       icon: 'Box' },
  { path: '/models',       titleKey: 'nav.models',       icon: 'Cpu' },
  { path: '/tasks',        titleKey: 'nav.tasks',        icon: 'List' },
  { path: '/im-management', titleKey: 'nav.imManagement', icon: 'ChatLineRound' },
  { path: '/schedule',     titleKey: 'nav.schedule',     icon: 'Calendar' },
  { path: '/settings',     titleKey: 'nav.settings',     icon: 'Setting' },
]

/** 始终展开 (Linear / Raycast 风格:无折叠) */
const expanded = ref(true)

const isActive = (path: string): boolean =>
  route.path === path || route.path.startsWith(path + '/')
</script>

<style lang="scss" scoped>
/* ========== 容器 (极简 Linear 风格) ========== */
.side-nav {
  --nav-width: 56px;
  --nav-width-expanded: 200px;
  display: flex;
  flex-direction: column;
  width: var(--nav-width);
  height: 100%;
  flex-shrink: 0;
  background: var(--bg-material);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-right: 1px solid var(--border-subtle);
  transition: width var(--duration-slow) var(--ease-spring);
  position: relative;
  overflow: hidden;
  user-select: none;

  &.expanded {
    width: var(--nav-width-expanded);
  }
}

/* ========== 品牌 (只 logo) ========== */
.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 0 16px;
  flex-shrink: 0;
}

.brand-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-base);
  border-radius: 8px;
  background: var(--accent-soft);

  svg {
    width: 18px;
    height: 18px;
  }
}

/* ========== 核心导航 (单列,无分组) ========== */
.nav-list {
  flex: 1;
  padding: 4px 8px;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 1px;

  &::-webkit-scrollbar {
    width: 0;
  }
}

/* ========== 导航项 (Linear / Raycast 风) ========== */
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  height: 36px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--fg-secondary);
  position: relative;
  transition: background-color 120ms var(--ease-standard),
    color 120ms var(--ease-standard);

  &:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }

  &.active {
    background: var(--accent-soft);
    color: var(--accent-base);

    .nav-icon {
      color: var(--accent-base);
    }
  }

  /* 选中左侧 2px 蓝条 (Raycast 风格) */
  &.active::before {
    content: '';
    position: absolute;
    left: -8px;
    top: 8px;
    bottom: 8px;
    width: 2px;
    background: var(--accent-base);
    border-radius: 0 2px 2px 0;
  }
}

.nav-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
  transition: color 120ms var(--ease-standard);
}

.nav-label {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

/* ========== 底部 (极简,只 user) ========== */
.nav-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0 14px;
  flex-shrink: 0;
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent-base);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: transform 120ms var(--ease-spring);

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover {
    transform: scale(1.08);
  }

  &:active {
    transform: scale(0.95);
  }
}
</style>