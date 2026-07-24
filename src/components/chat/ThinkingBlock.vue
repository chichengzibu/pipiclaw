<!--
  ThinkingBlock - thinking 模型可视化组件

  适用:
    - qwen3 / qwen3.5 (Ollama)
    - DeepSeek-R1
    - OpenAI o1 / o3
    - 任何带 reasoning 字段的模型

  行为:
    - 默认折叠(避免视觉噪声)
    - 1-click 展开
    - 内容使用 monospace + 浅色底
    - 跟正文共享 padding,左对齐

  类似 Claude 3.7 Sonnet 的 "Extended Thinking" UI。
-->
<template>
  <div v-if="reasoning" class="thinking-block" :class="{ 'is-expanded': expanded }">
    <button
      type="button"
      class="thinking-toggle"
      :aria-expanded="expanded"
      :aria-label="expanded ? '折叠思考过程' : '展开思考过程'"
      @click="toggle"
    >
      <span class="thinking-icon">
        <el-icon><Loading v-if="streaming" /><Cpu v-else /></el-icon>
      </span>
      <span class="thinking-label">
        {{ streaming ? '正在思考…' : expanded ? '思考过程' : '已思考' }}
      </span>
      <span class="thinking-meta" v-if="durationMs">
        · {{ formatDuration(durationMs) }}
      </span>
      <span class="thinking-meta" v-if="reasoningTokens">
        · {{ reasoningTokens }} tokens
      </span>
      <span class="thinking-chevron">
        <el-icon><ArrowDown v-if="!expanded" /><ArrowUp v-else /></el-icon>
      </span>
    </button>
    <Transition name="thinking-fade">
      <pre v-if="expanded" class="thinking-content" v-text="reasoning" />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Loading, Cpu, ArrowDown, ArrowUp } from '@element-plus/icons-vue'

interface Props {
  /** thinking 内容(qwen3 / o1 / deepseek-r1 暴露的 reasoning 字段) */
  reasoning: string
  /** 思考耗时(ms)— 用于展示"想了几秒" */
  durationMs?: number
  /** thinking 消耗的 token 数 */
  reasoningTokens?: number
  /** 是否还在 streaming(显示"正在思考") */
  streaming?: boolean
  /** 默认是否展开 */
  defaultExpanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  durationMs: 0,
  reasoningTokens: 0,
  streaming: false,
  defaultExpanded: false,
})

const expanded = ref(props.defaultExpanded)

function toggle(): void {
  expanded.value = !expanded.value
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.thinking-block {
  margin: 8px 0;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  overflow: hidden;
  font-family: var(--font-family-system);

  &.is-expanded {
    border-color: var(--accent-soft, var(--border-strong));
  }
}

.thinking-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--fg-secondary);
  font-size: 12px;
  font-family: inherit;
  transition: background-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);

  &:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
}

.thinking-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 14px;
  color: var(--accent-base);

  .is-expanded & {
    animation: thinking-pulse 2s var(--ease-standard) infinite;
  }
}

@keyframes thinking-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.thinking-label {
  font-weight: 500;
}

.thinking-meta {
  font-size: 11px;
  color: var(--fg-tertiary);
  font-variant-numeric: tabular-nums;
}

.thinking-chevron {
  margin-left: auto;
  font-size: 12px;
  opacity: 0.6;
}

.thinking-content {
  margin: 0;
  padding: 12px 16px;
  background: var(--bg-base);
  color: var(--fg-secondary);
  font-family: var(--font-family-mono);
  font-size: 12px;
  line-height: var(--line-height-relaxed, 1.7);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow-y: auto;
  border-top: 1px solid var(--border-base);
}

.thinking-fade-enter-active,
.thinking-fade-leave-active {
  transition: max-height var(--duration-base) var(--ease-standard),
    opacity var(--duration-base) var(--ease-standard);
  overflow: hidden;
}

.thinking-fade-enter-from,
.thinking-fade-leave-to {
  max-height: 0;
  opacity: 0;
}

.thinking-fade-enter-to,
.thinking-fade-leave-from {
  max-height: 400px;
  opacity: 1;
}
</style>
