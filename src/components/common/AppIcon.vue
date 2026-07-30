<template>
  <el-icon :size="size" :color="color" class="app-icon" :class="{ 'is-stroke': stroke }">
    <component :is="icon" />
  </el-icon>
</template>

<script setup lang="ts">
/**
 * AppIcon - 统一 SVG 图标组件
 *
 * 替代全 app 的 emoji 使用, 走 Element Plus icons (lucide-style 几何 SVG)
 * icons 在 main.ts 已全局注册, 这里只需传 PascalCase 名字
 *
 * 用法:
 *   <AppIcon icon="Setting" />
 *   <AppIcon icon="Sunny" :size="18" />
 *   <AppIcon icon="MagicStick" color="var(--accent-base)" />
 *
 * 可用 icon (常用):
 *   Setting, Sunny, Moon, InfoFilled, MagicStick, Memo, Connection,
 *   Monitor, Camera, Document, Search, Lightning, ChatDotRound, House,
 *   Box, Link, Tools, User, Plus, Refresh, Edit, Delete, View, Star
 */

withDefaults(defineProps<{
  /** Element Plus icon 名 (PascalCase) */
  icon: string;
  /** 像素尺寸, 默认 16 */
  size?: number | string;
  /** 颜色, 留空继承 currentColor */
  color?: string;
  /** 启用 stroke-only 风格 (lucide 风格) */
  stroke?: boolean;
}>(), {
  size: 16,
  color: '',
  stroke: false
});
</script>

<style lang="scss" scoped>
.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  vertical-align: middle;
  line-height: 1;
}

.app-icon.is-stroke :deep(svg) {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
