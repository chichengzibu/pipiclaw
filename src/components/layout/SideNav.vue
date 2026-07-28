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
    class="side-nav"
    :class="{ collapsed: !expanded, expanded: expanded }"
    @mouseenter="scheduleExpand"
    @mouseleave="scheduleCollapse"
  >
    <!-- 顶部品牌区 -->
    <div class="brand">
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
      <div v-if="expanded" class="brand-text">
        <div class="brand-name">PiPiClaw</div>
        <div class="brand-tag">v{{ appStore.version }}</div>
      </div>
    </div>

    <!-- 分组导航 -->
    <nav class="nav-groups">
      <div
        v-for="group in navGroups"
        :key="group.title"
        class="nav-group"
      >
        <div v-if="expanded" class="group-header">{{ group.title }}</div>
        <div class="group-items">
          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: isActive(item.path) }"
            :title="!expanded ? t(item.titleKey) : ''"
          >
            <el-icon class="nav-icon"><component :is="item.icon" /></el-icon>
            <span v-if="expanded" class="nav-label">
              {{ t(item.titleKey) }}
            </span>
            <span v-if="isActive(item.path) && expanded" class="active-dot"></span>
          </router-link>
        </div>
      </div>
    </nav>

    <!-- 底部用户区 -->
    <div class="nav-footer">
      <button
        v-if="expanded"
        class="footer-btn theme-btn"
        :title="`主题: ${themeIconLabel}`"
        @click="appStore.toggleTheme()"
      >
        <el-icon><component :is="themeIcon" /></el-icon>
      </button>

      <button
        class="footer-btn collapse-btn"
        :title="expanded ? '收起侧栏 (⌘\\)' : '固定展开'"
        @click="togglePin"
      >
        <el-icon>
          <component :is="expanded ? 'Expand' : 'Fold'" />
        </el-icon>
      </button>

      <div
        class="user-avatar"
        :title="appStore.version ? `PiPiClaw v${appStore.version}` : ''"
      >
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import {
  Moon,
  Sunny,
  Monitor,
} from '@element-plus/icons-vue'

const { t } = useI18n()
const route = useRoute()
const appStore = useAppStore()

interface NavItem {
  path: string
  titleKey: string
  icon: string
}
interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: '工作区',
    items: [
      { path: '/dashboard', titleKey: 'nav.dashboard', icon: 'HomeFilled' },
      { path: '/chat', titleKey: 'nav.chat', icon: 'ChatDotRound' },
      { path: '/tasks', titleKey: 'nav.tasks', icon: 'List' },
    ],
  },
  {
    title: '工具',
    items: [
      { path: '/skills', titleKey: 'nav.skills', icon: 'Box' },
      { path: '/clawhub', titleKey: 'nav.clawhub', icon: 'Goods' },
      { path: '/models', titleKey: 'nav.models', icon: 'Cpu' },
      { path: '/model-compare', titleKey: 'nav.modelCompare', icon: 'DataAnalysis' },
      { path: '/im-management', titleKey: 'nav.imManagement', icon: 'ChatLineRound' },
      { path: '/schedule', titleKey: 'nav.schedule', icon: 'Calendar' },
    ],
  },
  {
    title: '管理',
    items: [
      { path: '/permissions', titleKey: 'nav.permissions', icon: 'Lock' },
      { path: '/plugin-market', titleKey: 'nav.plugins', icon: 'Shop' },
      { path: '/remote-control', titleKey: 'nav.remoteControl', icon: 'Connection' },
      { path: '/settings', titleKey: 'nav.settings', icon: 'Setting' },
      { path: '/help', titleKey: 'nav.help', icon: 'QuestionFilled' },
    ],
  },
]

/** 展开/收起状态: hover 自动展开,pinned 强制展开 */
const expanded = ref(false)
const pinned = ref(false)
let hoverTimer: ReturnType<typeof setTimeout> | null = null
const HOVER_DELAY = 80

function scheduleExpand(): void {
  if (hoverTimer) clearTimeout(hoverTimer)
  if (pinned.value) return
  hoverTimer = setTimeout(() => {
    expanded.value = true
  }, HOVER_DELAY)
}

function scheduleCollapse(): void {
  if (hoverTimer) clearTimeout(hoverTimer)
  if (pinned.value) return
  hoverTimer = setTimeout(() => {
    expanded.value = false
  }, 200)
}

function togglePin(): void {
  pinned.value = !pinned.value
  expanded.value = pinned.value
  if (pinned.value) {
    localStorage.setItem('pipiclaw_sidebar_pinned', '1')
  } else {
    localStorage.setItem('pipiclaw_sidebar_pinned', '0')
  }
}

/** 主题图标跟随 mode 切换 */
const themeIcon = computed(() => {
  if (appStore.themeMode === 'dark') return Moon
  if (appStore.themeMode === 'light') return Sunny
  return Monitor
})
const themeIconLabel = computed(() => {
  if (appStore.themeMode === 'dark') return '深色'
  if (appStore.themeMode === 'light') return '浅色'
  return '跟随系统'
})

const isActive = (path: string): boolean =>
  route.path === path || route.path.startsWith(path + '/')

/** Cmd+\ 切换 pinned */
function onKeydown(e: KeyboardEvent): void {
  const isMod = e.metaKey || e.ctrlKey
  if (isMod && e.key === '\\') {
    e.preventDefault()
    togglePin()
  }
}

onMounted(() => {
  // 恢复 pinned 状态
  const saved = localStorage.getItem('pipiclaw_sidebar_pinned')
  if (saved === '1') {
    pinned.value = true
    expanded.value = true
  }
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (hoverTimer) clearTimeout(hoverTimer)
})
</script>

<style lang="scss" scoped>
.side-nav {
  --nav-width: 64px;
  --nav-width-expanded: 240px;
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

/* ========== 品牌区 ========== */
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 12px;
  height: 56px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-subtle);
}

.brand-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-base);
  border-radius: var(--radius-md);
  background: var(--accent-soft);

  svg {
    width: 22px;
    height: 22px;
  }
}

.brand-text {
  overflow: hidden;
  white-space: nowrap;
}

.brand-name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--fg-primary);
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.brand-tag {
  font-size: var(--font-size-xs);
  color: var(--fg-tertiary);
  line-height: 1.4;
  margin-top: 1px;
}

/* ========== 导航分组 ========== */
.nav-groups {
  flex: 1;
  padding: 12px 8px;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 16px;

  &::-webkit-scrollbar {
    width: 4px;
  }
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.group-header {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--fg-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 4px 12px 6px;
  white-space: nowrap;
  overflow: hidden;
}

.group-items {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

/* ========== 导航项 ========== */
.nav-item {
  text-decoration: none;
  color: var(--fg-secondary);
  border-radius: var(--radius-md);
  transition: background-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);

  &:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }

  &:active {
    background: var(--bg-active);
  }

  &.active {
    color: var(--accent-base);
    background: var(--accent-soft);

    .nav-icon {
      color: var(--accent-base);
    }
  }
}

.nav-item-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  height: 36px;
  position: relative;
  overflow: hidden;
}

.nav-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 20px;
  transition: transform var(--duration-fast) var(--ease-spring),
    color var(--duration-fast) var(--ease-standard);

  .nav-item:hover & {
    transform: scale(1.08);
  }
}

.nav-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.01em;
  flex: 1;
}

/* Active dot indicator (Apple Mail style) */
.active-dot {
  position: absolute;
  right: 8px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent-base);
}

/* ========== 底部 ========== */
.nav-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px;
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
  justify-content: center;
}

.footer-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--fg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-spring);
  flex-shrink: 0;
  font-size: 16px;

  &:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }

  &:active {
    transform: scale(0.92);
  }
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent-base);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: auto;
  cursor: pointer;
  transition: transform var(--duration-fast) var(--ease-spring);

  svg {
    width: 22px;
    height: 22px;
  }

  &:hover {
    transform: scale(1.08);
  }

  &:active {
    transform: scale(0.95);
  }
}

/* ========== 过渡动画 ========== */

/* 品牌文字 fade */
.brand-fade-enter-active,
.brand-fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-spring);
}

.brand-fade-enter-from,
.brand-fade-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

/* 分组标题 fade */
.section-fade-enter-active,
.section-fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-standard);
}

.section-fade-enter-from,
.section-fade-leave-to {
  opacity: 0;
}

/* 标签 fade (with slight slide) */
.label-fade-enter-active,
.label-fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-spring);
}

.label-fade-enter-from,
.label-fade-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}

/* ========== Tooltip 定制 (Apple dark style) ========== */
:deep(.el-tooltip__popper) {
  font-size: var(--font-size-xs) !important;
  font-weight: var(--font-weight-medium) !important;
  letter-spacing: -0.01em !important;
  border-radius: var(--radius-sm) !important;
  padding: 4px 8px !important;
}

:deep(.el-tooltip__popper.is-dark) {
  background: rgba(0, 0, 0, 0.85) !important;
  color: #fff !important;
  backdrop-filter: blur(8px);
}
</style>