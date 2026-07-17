<template>
  <div class="d2-prime-demo">
    <h2>D2-Prime 旗舰 Demo</h2>
    <p class="d2-hint">输入自然语言 → AI 解析 → 自动选模板 → 沙盒脚手架 → 端口转发 → 预览</p>

    <el-card class="d2-controls">
      <div class="d2-row">
        <el-input v-model="prompt" placeholder="例如:做一个 Vite + React + TS 博客" />
      </div>
      <div class="d2-row">
        <el-checkbox v-model="useWebContainer">优先 WebContainer(前端类)</el-checkbox>
      </div>
      <div class="d2-row d2-actions">
        <el-button type="primary" @click="runDemo" :loading="isRunning" :disabled="!canRun">
          启动 D2-Prime
        </el-button>
      </div>
    </el-card>

    <el-card v-if="lastResult?.ok" class="d2-result">
      <h3>脚手架结果</h3>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="workspaceId">{{ lastResult.workspaceId }}</el-descriptions-item>
        <el-descriptions-item label="templateId">{{ lastResult.templateId }}</el-descriptions-item>
        <el-descriptions-item label="fileCount">{{ lastResult.fileCount }}</el-descriptions-item>
        <el-descriptions-item label="forwardUrl">{{ lastResult.forwardUrl }}</el-descriptions-item>
        <el-descriptions-item label="estimatedStartSeconds">{{ lastResult.estimatedStartSeconds }}s</el-descriptions-item>
        <el-descriptions-item label="durationMs">{{ lastResult.durationMs }}ms</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-if="lastResult?.ok && lastResult.forwardUrl" class="d2-preview">
      <h3>预览</h3>
      <iframe :src="lastResult.forwardUrl" class="d2-iframe" sandbox="allow-scripts allow-same-origin" />
      <p class="d2-preview-note">iframe 预览(W11 stub,实际由 PortForwarder 提供 HTTP,内部走 WebContainer 或 docker)</p>
    </el-card>

    <el-card v-if="lastResult && !lastResult.ok" class="d2-error">
      <h3>失败</h3>
      <p class="d2-error-text">{{ lastResult.error }}</p>
    </el-card>

    <el-card class="d2-flow">
      <h3>流程</h3>
      <ol class="d2-steps">
        <li>解析 prompt <code>{{ prompt || '(空)' }}</code></li>
        <li>SandboxBuilder 选模板 <code>{{ lastResult?.templateId ?? '(待运行)' }}</code></li>
        <li>SandboxLifecycle.touch(workspaceId)</li>
        <li>PortForwarder.forwardPort → {{ lastResult?.forwardUrl ?? '(待运行)' }}</li>
        <li>{{ useWebContainer ? 'WebContainerRunner boot+mount (前端零容器)' : 'docker stub (后端类)' }}</li>
        <li>iframe 预览</li>
      </ol>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const prompt = ref('做一个 Vite + React + TS 博客')
const useWebContainer = ref(true)
const isRunning = ref(false)
const lastResult = ref<{
  ok: boolean
  workspaceId?: string
  templateId?: string
  fileCount?: number
  forwardId?: string
  forwardUrl?: string
  estimatedStartSeconds?: number
  durationMs?: number
  error?: string
} | null>(null)

const canRun = computed(() => prompt.value.trim().length > 0)

async function runDemo() {
  isRunning.value = true
  try {
    const result = await (window as unknown as { electronAPI: { demo: { runD2Prime: (args: { prompt: string; useWebContainer?: boolean }) => Promise<{ success: boolean; data?: { ok: boolean; workspaceId?: string; templateId?: string; fileCount?: number; forwardId?: string; forwardUrl?: string; estimatedStartSeconds?: number; durationMs?: number; error?: string }; error?: string }> } } }).electronAPI.demo.runD2Prime({ prompt: prompt.value, useWebContainer: useWebContainer.value })
    if (result.success && result.data) {
      lastResult.value = result.data as typeof lastResult.value
    } else {
      lastResult.value = { ok: false, error: result.error ?? 'unknown' }
    }
  } finally {
    isRunning.value = false
  }
}
</script>

<style lang="scss" scoped>
.d2-prime-demo {
  padding: var(--content-padding);
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.d2-hint {
  color: var(--text-secondary, #666);
  font-size: var(--font-size-body, 14px);
  margin-bottom: var(--space-lg, 24px);
}

.d2-row {
  margin-bottom: var(--space-md, 16px);
}

.d2-actions {
  display: flex;
  gap: var(--space-sm, 8px);
}

.d2-result, .d2-preview, .d2-error, .d2-flow {
  margin-top: var(--space-lg, 24px);
}

.d2-iframe {
  width: 100%;
  height: 480px;
  border: 1px solid var(--border-color, #ddd);
  border-radius: var(--radius-sm, 4px);
}

.d2-preview-note {
  color: var(--text-secondary, #666);
  font-size: var(--font-size-caption-1, 11px);
  margin-top: var(--space-sm, 8px);
}

.d2-error-text {
  color: #c92a2a;
}

.d2-steps {
  padding-left: var(--space-lg, 24px);
  font-size: var(--font-size-body, 14px);
  line-height: 1.8;
}

code {
  background: var(--card-bg, #f5f5f5);
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
  font-family: var(--font-family-mono, monospace);
  font-size: var(--font-size-caption-1, 11px);
}
</style>