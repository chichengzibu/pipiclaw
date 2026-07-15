<template>
  <div class="a5-demo">
    <h2>A5 Computer Use v1 最小 Demo</h2>
    <p class="a5-hint">看屏幕 → Agent 思考 → 执行(默认沙箱模式,只记录不真执行)</p>

    <el-card class="a5-controls">
      <div class="a5-row">
        <el-input v-model="instruction" placeholder="自然语言指令(例如:打开浏览器)" />
      </div>
      <div class="a5-row">
        <span>最大步数: </span>
        <el-input-number v-model="maxSteps" :min="1" :max="20" :step="1" />
      </div>
      <div class="a5-row">
        <el-switch v-model="autoExecute" active-text="自动执行(危险)" inactive-text="沙箱(只记录)" />
      </div>
      <div class="a5-row a5-actions">
        <el-button type="primary" @click="runDemo" :loading="isRunning" :disabled="!canRun">
          启动 Computer Use
        </el-button>
      </div>
    </el-card>

    <el-card v-if="lastFrame" class="a5-frame">
      <h3>当前屏幕</h3>
      <img :src="lastFrame.dataUrl" :alt="`frame-${lastFrame.width}x${lastFrame.height}`" class="a5-img" />
      <p class="a5-meta">尺寸: {{ lastFrame.width }}x{{ lastFrame.height }} | 大小: {{ lastFrame.byteSize }} bytes</p>
    </el-card>

    <el-card v-if="lastResult" class="a5-result">
      <h3>执行结果</h3>
      <p v-if="lastResult.ok">
        <strong>步数:</strong> {{ lastResult.result?.steps?.length }}<br>
        <strong>是否到 maxSteps 上限:</strong> {{ lastResult.result?.hitMaxSteps ? '是' : '否' }}<br>
        <strong>总时长:</strong> {{ lastResult.result?.totalDurationMs }}ms
      </p>
      <p v-else class="a5-error">
        <strong>失败:</strong> {{ lastResult.error }}
      </p>
    </el-card>

    <el-card v-if="steps.length > 0" class="a5-steps">
      <h3>步骤详情</h3>
      <ul class="a5-step-list">
        <li v-for="(s, i) in steps" :key="i" class="a5-step">
          <strong>Step {{ s.stepIndex + 1 }}:</strong>
          <span class="a5-step-decision">decision: {{ s.decision.action }}</span>
          <span class="a5-step-result" :class="{ 'a5-step-ok': s.actionResult.ok, 'a5-step-fail': !s.actionResult.ok }">
            result: {{ s.actionResult.executed ? 'executed' : 'recorded' }} ({{ s.actionResult.durationMs }}ms)
          </span>
          <div class="a5-step-understanding">understanding: {{ s.understanding.slice(0, 200) }}</div>
        </li>
      </ul>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const instruction = ref('打开浏览器')
const maxSteps = ref(5)
const autoExecute = ref(false)
const isRunning = ref(false)
const lastFrame = ref<{ dataUrl: string; width: number; height: number; byteSize: number } | null>(null)
const lastResult = ref<{ ok: boolean; result?: { steps: Array<{ stepIndex: number; understanding: string; decision: { action: string; payload: unknown }; actionResult: { ok: boolean; executed: boolean; durationMs: number; note?: string; error?: string } }>; hitMaxSteps: boolean; totalDurationMs: number }; error?: string } | null>(null)
const steps = ref<Array<{ stepIndex: number; understanding: string; decision: { action: string; payload: unknown }; actionResult: { ok: boolean; executed: boolean; durationMs: number; note?: string; error?: string } }>>([])

const canRun = computed(() => instruction.value.trim().length > 0)

async function runDemo() {
  isRunning.value = true
  try {
    await new Promise(r => setTimeout(r, 200))
    lastFrame.value = {
      dataUrl: 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#f0f0f0"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="24">[W8 stub screenshot]</text></svg>`),
      width: 800,
      height: 600,
      byteSize: 0,
    }

    const stubSteps = []
    for (let i = 0; i < maxSteps.value; i++) {
      stubSteps.push({
        stepIndex: i,
        understanding: `Step ${i + 1}: 屏幕内容(W8 stub)`,
        decision: { action: i === maxSteps.value - 1 ? 'reply' : 'screenshot', payload: {} },
        actionResult: {
          ok: true,
          executed: autoExecute.value,
          durationMs: 50 + i * 10,
          note: autoExecute.value ? 'executed' : 'W8 沙箱模式:仅记录',
        },
      })
    }

    steps.value = stubSteps
    lastResult.value = {
      ok: true,
      result: {
        steps: stubSteps,
        hitMaxSteps: stubSteps.length >= maxSteps.value,
        totalDurationMs: stubSteps.reduce((s, x) => s + x.actionResult.durationMs, 0),
      },
    }
  } finally {
    isRunning.value = false
  }
}
</script>

<style lang="scss" scoped>
.a5-demo {
  padding: var(--content-padding);
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.a5-hint {
  color: var(--text-secondary, #666);
  font-size: var(--font-size-body, 14px);
  margin-bottom: var(--space-lg, 24px);
}

.a5-row {
  margin-bottom: var(--space-md, 16px);
  display: flex;
  align-items: center;
  gap: var(--space-sm, 8px);
}

.a5-actions {
  display: flex;
  gap: var(--space-sm, 8px);
}

.a5-frame, .a5-result, .a5-steps {
  margin-top: var(--space-lg, 24px);
}

.a5-img {
  max-width: 100%;
  border: 1px solid var(--border-color, #ddd);
  border-radius: var(--radius-sm, 4px);
}

.a5-meta {
  font-size: var(--font-size-caption-1, 11px);
  color: var(--text-secondary, #666);
  margin-top: var(--space-sm, 8px);
}

.a5-error {
  color: #c92a2a;
}

.a5-step-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.a5-step {
  padding: var(--space-sm, 8px) var(--space-md, 16px);
  border-left: 3px solid var(--accent-color, #007aff);
  background: var(--card-bg, #fafafa);
  border-radius: var(--radius-sm, 4px);
  margin-bottom: var(--space-sm, 8px);
  font-size: var(--font-size-caption-1, 11px);
  line-height: 1.6;
}

.a5-step-decision {
  margin-left: var(--space-sm, 8px);
  color: var(--text-secondary, #888);
  font-family: var(--font-family-mono, monospace);
}

.a5-step-result {
  margin-left: var(--space-sm, 8px);
  font-weight: 600;
}

.a5-step-ok {
  color: #16a34a;
}

.a5-step-fail {
  color: #c92a2a;
}

.a5-step-understanding {
  margin-top: var(--space-xs, 4px);
  color: var(--text-primary, #333);
  font-size: var(--font-size-caption-2, 9px);
}
</style>
