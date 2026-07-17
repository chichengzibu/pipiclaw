<template>
  <div class="d1-demo">
    <h2>D1 截屏问答 Demo</h2>
    <p class="d1-hint">
      按 <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> 触发截屏问答。
    </p>

    <div class="d1-actions">
      <el-button type="primary" @click="triggerScreenshot" :loading="isCapturing">
        手动触发截屏
      </el-button>
      <el-button @click="clearLog">清空记录</el-button>
    </div>

    <div class="d1-captured" v-if="lastCapture">
      <div class="d1-card">
        <h3>最近一次截图</h3>
        <p class="d1-meta">
          大小: {{ lastCapture.width }}x{{ lastCapture.height }} ({{ lastCapture.sizeBytes }} bytes)
          <br />
          时间: {{ lastCapture.formattedAt }}
        </p>
      </div>
    </div>

    <div class="d1-qa">
      <h3>问答日志</h3>
      <ul class="d1-log">
        <li
          v-for="(entry, i) in qaLog"
          :key="i"
          :class="`d1-log-item d1-${entry.kind}`"
        >
          <span class="d1-log-time">{{ entry.time }}</span>
          <span class="d1-log-content">{{ entry.content }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface CapturePayload {
  ts: number
  sizeBytes: number
  width: number
  height: number
  note?: string
}

interface LogEntry {
  time: string
  content: string
  kind: 'info' | 'answer' | 'error'
}

const lastCapture = ref<{ width: number; height: number; sizeBytes: number; formattedAt: string } | null>(null)
const isCapturing = ref(false)
const qaLog = ref<LogEntry[]>([])

function appendLog(content: string, kind: LogEntry['kind'] = 'info') {
  const now = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  qaLog.value.push({ time: now, content, kind })
  if (qaLog.value.length > 50) qaLog.value.shift()
}

async function triggerScreenshot() {
  if (!(window as unknown as { electronAPI?: unknown }).electronAPI) {
    appendLog('当前非 Electron 环境', 'error')
    return
  }
  isCapturing.value = true
  appendLog('发起截屏请求...', 'info')
  try {
    const result = await (window as unknown as { electronAPI: { demo: { runD1: (args: { question: string }) => Promise<{ success: boolean; data?: { ok: boolean; stub?: boolean; answer?: string }; error?: string }> } } }).electronAPI.demo.runD1({ question: '请描述当前屏幕内容' })
    if (result.success && result.data) {
      appendLog(`D1 真实调用成功: ${result.data.answer ?? JSON.stringify(result.data)}`, 'answer')
    } else {
      appendLog(`D1 失败: ${result.error ?? 'unknown'}`, 'error')
    }
  } finally {
    isCapturing.value = false
  }
}

function clearLog() {
  qaLog.value = []
  lastCapture.value = null
}

let cleanup: (() => void) | null = null

onMounted(() => {
  if (!(window as unknown as { electronAPI?: unknown }).electronAPI) return
  const handler = (_event: unknown, payload: CapturePayload) => {
    lastCapture.value = {
      width: payload.width,
      height: payload.height,
      sizeBytes: payload.sizeBytes,
      formattedAt: new Date(payload.ts).toLocaleString('zh-CN'),
    }
    appendLog(`捕获截图: ${payload.sizeBytes} bytes`, 'info')
    appendLog(`Agent 回复(W5 stub): ${payload.note ?? '...'}`, 'answer')
  }
  ;(window as unknown as { addEventListener?: (k: string, h: (e: Event) => void) => void })
    .addEventListener?.('d1-screenshot-captured', (e: Event) => {
      const ce = e as CustomEvent<CapturePayload>
      handler(null, ce.detail)
    })
  cleanup = () => {
    ;(window as unknown as { removeEventListener?: (k: string) => void })
      .removeEventListener?.('d1-screenshot-captured')
  }
})

onUnmounted(() => {
  cleanup?.()
})
</script>

<style lang="scss" scoped>
.d1-demo {
  padding: var(--content-padding, 24px);
  max-width: var(--content-max-width, 960px);
  margin: 0 auto;
}

.d1-hint {
  color: var(--text-secondary, #666);
  font-size: var(--font-size-body, 14px);
  margin-bottom: var(--space-lg, 24px);

  kbd {
    display: inline-block;
    padding: 2px 6px;
    margin: 0 2px;
    font-size: var(--font-size-caption-1, 11px);
    background: var(--card-bg, #fff);
    border: 1px solid var(--border-color, #ddd);
    border-radius: var(--radius-sm, 4px);
    font-family: var(--font-family-mono, monospace);
  }
}

.d1-actions {
  margin-bottom: var(--space-md, 16px);
}

.d1-card {
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #eee);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-md, 16px);
  margin-bottom: var(--space-lg, 24px);
}

.d1-meta {
  font-size: var(--font-size-caption-1, 11px);
  color: var(--text-secondary, #666);
  margin-top: var(--space-sm, 8px);
}

.d1-log {
  list-style: none;
  padding: var(--space-sm, 8px);
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
  background: var(--card-bg, #fafafa);
  border-radius: var(--radius-md, 8px);
}

.d1-log-item {
  padding: var(--space-xs, 4px) var(--space-sm, 8px);
  border-radius: var(--radius-sm, 4px);
  margin-bottom: var(--space-xs, 4px);
  font-size: var(--font-size-caption-1, 11px);
  display: flex;
  gap: var(--space-sm, 8px);
}

.d1-info {
  background: rgba(59, 130, 246, 0.08);
}

.d1-answer {
  background: rgba(16, 185, 129, 0.08);
  color: var(--text-primary, #111);
}

.d1-error {
  background: rgba(239, 68, 68, 0.08);
  color: #c92a2a;
}

.d1-log-time {
  font-family: var(--font-family-mono, monospace);
  color: var(--text-secondary, #888);
  font-size: var(--font-size-caption-2, 9px);
  min-width: 60px;
}

.d1-log-content {
  flex: 1;
}
</style>