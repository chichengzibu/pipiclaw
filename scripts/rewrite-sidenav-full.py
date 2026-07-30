"""Rewrite SideNav.vue fully to match v4-mockup exactly (60px icon-only rail)"""
import re
from pathlib import Path

path = Path('src/components/layout/SideNav.vue')
text = path.read_text(encoding='utf-8')

# 1. 替换 template 段
template_start = text.index('<template>')
template_end = text.index('</template>') + len('</template>')

new_template = '''<template>
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
</template>'''

# 2. 替换 script setup 段
script_start = text.index('<script setup lang="ts">')
script_end = text.index('</script>') + len('</script>')

new_script = '''<script setup lang="ts">
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
</script>'''

# 3. 替换 style 段
style_start = text.index('<style lang="scss" scoped>')
style_end = text.index('</style>') + len('</style>')

new_style = '''<style lang="scss" scoped>
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
</style>'''

new_text = text[:template_start] + new_template + text[template_end:script_start] + new_script + text[script_end:style_start] + new_style + text[style_end:]
path.write_text(new_text, encoding='utf-8')
print(f'OK: SideNav.vue rewritten, {len(text) - len(new_text)} chars diff')
