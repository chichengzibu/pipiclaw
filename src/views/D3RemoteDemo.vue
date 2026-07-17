<template>
  <div class="d3-demo">
    <h2>D3 一句话远程 Demo (Channel + Agent + Connector)</h2>
    <p class="d3-hint">模拟飞书发消息 → Agent 解析 → Calendar 查询 → 飞书回复</p>

    <el-card class="d3-controls">
      <div class="d3-row">
        <el-input v-model="userMessage" placeholder="输入用户消息,例如:帮我查今天日程"></el-input>
      </div>
      <div class="d3-row">
        <el-input v-model="userId" placeholder="飞书 userId"></el-input>
      </div>
      <div class="d3-row d3-actions">
        <el-button type="primary" @click="runDemo" :loading="isRunning" :disabled="!canRun">
          模拟飞书消息
        </el-button>
      </div>
    </el-card>

    <el-card v-if="lastResult" class="d3-result">
      <h3>运行结果</h3>
      <p v-if="lastResult.ok">
        <strong>Agent 回复:</strong>
        <pre class="d3-reply">{{ lastResult.reply }}</pre>
      </p>
      <p v-else class="d3-error">
        <strong>失败:</strong> {{ lastResult.error }}
      </p>
    </el-card>

    <el-card class="d3-flow">
      <h3>流程</h3>
      <ol class="d3-steps">
        <li>飞书发送消息 <code>{{ userMessage || '(空)' }}</code></li>
        <li>ChannelRouter 路由到 D3 skill</li>
        <li>AgentBrain 解析意图(W7 stub)</li>
        <li>CalendarConnector.list_today(W7 stub data)</li>
        <li>ChannelRouter.send → 飞书回复 <code>{{ lastResult?.reply?.split('\n')[0] ?? '(待运行)' }}</code></li>
      </ol>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const userMessage = ref('帮我查今天日程')
const userId = ref('ou_test_user_001')
const isRunning = ref(false)
const lastResult = ref<{ ok: boolean; reply?: string; error?: string } | null>(null)

const canRun = computed(() => userMessage.value.trim().length > 0)

async function runDemo() {
  isRunning.value = true
  try {
    const result = await (window as unknown as { electronAPI: { demo: { runD3: (args: { userMessage: string; userId: string; channelId: string }) => Promise<{ success: boolean; data?: { ok: boolean; reply?: string; error?: string }; error?: string }> } } }).electronAPI.demo.runD3({ userMessage: userMessage.value, userId: userId.value, channelId: 'd3-demo' })
    if (result.success && result.data) {
      lastResult.value = result.data
    } else {
      lastResult.value = { ok: false, error: result.error ?? 'unknown' }
    }
  } finally {
    isRunning.value = false
  }
}
</script>

<style lang="scss" scoped>
.d3-demo {
  padding: var(--content-padding);
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.d3-hint {
  color: var(--text-secondary, #666);
  font-size: var(--font-size-body, 14px);
  margin-bottom: var(--space-lg, 24px);
}

.d3-row {
  margin-bottom: var(--space-md, 16px);
}

.d3-actions {
  display: flex;
  gap: var(--space-sm, 8px);
}

.d3-result, .d3-flow {
  margin-top: var(--space-lg, 24px);
}

.d3-reply {
  background: var(--card-bg, #fafafa);
  border-radius: var(--radius-sm, 4px);
  padding: var(--space-sm, 8px);
  font-size: var(--font-size-caption-1, 11px);
  white-space: pre-wrap;
  font-family: var(--font-family-mono, monospace);
}

.d3-error {
  color: #c92a2a;
}

.d3-steps {
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