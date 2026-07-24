<!--
  PiPiClaw - Skeleton 加载占位组件

  用法:
    <Skeleton type="text" :lines="3" />
    <Skeleton type="card" />
    <Skeleton type="avatar" />
    <Skeleton type="table" :rows="5" />

  设计:
    - 纯 CSS 渐变动画(无 JS,几乎零开销)
    - 主题感知:自动跟随 light/dark
    - 减少 layout shift(用 contain-intrinsic-size)
-->
<template>
  <div :class="['skeleton', `skeleton--${type}`]" :aria-busy="true" aria-label="加载中">
    <template v-if="type === 'text'">
      <div
        v-for="i in lines"
        :key="i"
        class="skeleton-line"
        :style="{ width: lineWidth(i) }"
      />
    </template>

    <template v-else-if="type === 'card'">
      <div class="skeleton-card">
        <div class="skeleton-card-header">
          <div class="skeleton-circle skeleton-circle--md" />
          <div class="skeleton-lines">
            <div class="skeleton-line" style="width: 40%" />
            <div class="skeleton-line" style="width: 25%" />
          </div>
        </div>
        <div class="skeleton-card-body">
          <div class="skeleton-line" style="width: 100%" />
          <div class="skeleton-line" style="width: 90%" />
          <div class="skeleton-line" style="width: 70%" />
        </div>
      </div>
    </template>

    <template v-else-if="type === 'avatar'">
      <div class="skeleton-circle" :class="`skeleton-circle--${size}`" />
    </template>

    <template v-else-if="type === 'table'">
      <div v-for="i in rows" :key="i" class="skeleton-table-row">
        <div class="skeleton-line" style="width: 20%" />
        <div class="skeleton-line" style="width: 35%" />
        <div class="skeleton-line" style="width: 25%" />
        <div class="skeleton-line" style="width: 15%" />
      </div>
    </template>

    <template v-else>
      <div class="skeleton-rect" :style="{ width, height }" />
    </template>
  </div>
</template>

<script setup lang="ts">
interface Props {
  type?: 'text' | 'card' | 'avatar' | 'table' | 'rect'
  lines?: number
  rows?: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  width?: string
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  lines: 3,
  rows: 5,
  size: 'md',
  width: '100%',
  height: '100px',
})

function lineWidth(index: number): string {
  // 让最后一行短一点,看起来更自然
  if (index === props.lines) return '60%'
  if (index === props.lines - 1) return '85%'
  return '100%'
}
</script>

<style lang="scss" scoped>
.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  width: 100%;

  &--card,
  &--table {
    gap: var(--space-md);
  }
}

.skeleton-line {
  height: 12px;
  background: linear-gradient(
    90deg,
    var(--bg-elevated) 0%,
    var(--bg-hover) 50%,
    var(--bg-elevated) 100%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-sm);
  animation: skeleton-shimmer 1.4s var(--ease-standard) infinite;
}

.skeleton-circle {
  background: linear-gradient(
    90deg,
    var(--bg-elevated) 0%,
    var(--bg-hover) 50%,
    var(--bg-elevated) 100%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
  animation: skeleton-shimmer 1.4s var(--ease-standard) infinite;

  &--sm { width: 24px; height: 24px; }
  &--md { width: 36px; height: 36px; }
  &--lg { width: 48px; height: 48px; }
  &--xl { width: 72px; height: 72px; }
}

.skeleton-rect {
  background: linear-gradient(
    90deg,
    var(--bg-elevated) 0%,
    var(--bg-hover) 50%,
    var(--bg-elevated) 100%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-md);
  animation: skeleton-shimmer 1.4s var(--ease-standard) infinite;
}

.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-base);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
}

.skeleton-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.skeleton-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.skeleton-card-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.skeleton-table-row {
  display: grid;
  grid-template-columns: 1fr 2fr 1.5fr 1fr;
  gap: var(--space-md);
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--border-base);

  &:last-child {
    border-bottom: none;
  }
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-line,
  .skeleton-circle,
  .skeleton-rect {
    animation: none;
  }
}
</style>
