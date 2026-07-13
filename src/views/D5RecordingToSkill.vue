<template>
  <div class="d5-demo">
    <h2>D5 录屏转技能</h2>

    <el-card class="d5-controls">
      <div class="d5-row">
        <el-input
          v-model="triggerPhrase"
          placeholder='触发短语(例如:批量重命名)'
        ></el-input>
      </div>
      <div class="d5-row">
        <el-input
          v-model="description"
          type="textarea"
          :rows="3"
          placeholder="描述你的操作步骤(可选)"
        ></el-input>
      </div>
      <div class="d5-row d5-actions">
        <el-button
          type="danger"
          :disabled="isRecording"
          @click="startRecording"
          :loading="isStarting"
        >
          开始录制
        </el-button>
        <el-button
          :disabled="!isRecording"
          @click="stopAndGenerate"
          :loading="isGenerating"
        >
          结束 & 生成 Skill
        </el-button>
      </div>
    </el-card>

    <el-card v-if="lastResult" class="d5-result">
      <h3>生成结果</h3>
      <p v-if="lastResult.ok">
        <strong>Skill 名称:</strong> <code>{{ lastResult.skillName }}</code><br />
        <strong>帧数:</strong> {{ lastResult.frameCount }}<br />
        <strong>时长:</strong> {{ lastResult.durationMs }}ms
      </p>
      <p v-else class="d5-error">
        <strong>失败:</strong> {{ lastResult.error }}
      </p>
    </el-card>

    <div v-if="frames.length > 0" class="d5-frames">
      <h3>帧预览(共 {{ frames.length }} 帧)</h3>
      <div class="d5-frames-grid">
        <img
          v-for="(f, i) in frames"
          :key="i"
          :src="f.dataUrl"
          :alt="`frame-${i}`"
          class="d5-frame"
        />
      </div>
    </div>

    <div class="d5-log" v-if="logEntries.length > 0">
      <h3>日志</h3>
      <ul>
        <li
          v-for="(e, i) in logEntries"
          :key="i"
          :class="`d5-log-item d5-log-${e.kind}`"
        >
          <span class="d5-log-time">{{ e.time }}</span>
          <span class="d5-log-content">{{ e.content }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface D5Frame {
  dataUrl: string
  ts: number
}

interface D5Result {
  ok: boolean
  skillName?: string
  frameCount?: number
  durationMs?: number
  error?: string
}

interface LogEntry {
  time: string
  content: string
  kind: 'info' | 'error'
}

const triggerPhrase = ref('')
const description = ref('')
const isRecording = ref(false)
const isStarting = ref(false)
const isGenerating = ref(false)
const frames = ref<D5Frame[]>([])
const lastResult = ref<D5Result | null>(null)
const logEntries = ref<LogEntry[]>([])

function appendLog(content: string, kind: 'info' | 'error' = 'info'): void {
  const now = new Date().toLocaleTimeString('zh-CN')
  logEntries.value.push({ time: now, content, kind })
}

async function startRecording(): Promise<void> {
  if (!window.electronAPI) {
    appendLog('当前非 Electron 环境,无法录制', 'error')
    return
  }
  isStarting.value = true
  try {
    frames.value = []
    lastResult.value = null
    appendLog('开始录制(W6 stub:本端模拟 1fps 采样,实际帧捕获在 main 进程的 ScreenVision)', 'info')
    isRecording.value = true
  } finally {
    isStarting.value = false
  }
}

async function stopAndGenerate(): Promise<void> {
  isGenerating.value = true
  try {
    appendLog('录制结束,生成 skill...', 'info')
    isRecording.value = false
    lastResult.value = {
      ok: false,
      error: 'W6 stub: 真实生成路径走 main 进程的 runD5(),W7 接 IPC 后此处显示结果',
    }
  } finally {
    isGenerating.value = false
  }
}
</script>

<style lang="scss" scoped>
.d5-demo {
  padding: var(--content-padding);
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.d5-row {
  margin-bottom: var(--space-md, 16px);
}

.d5-actions {
  display: flex;
  gap: var(--space-sm, 8px);
}

.d5-result {
  margin-top: var(--space-lg, 24px);
}

.d5-error {
  color: #c92a2a;
}

.d5-frames {
  margin-top: var(--space-lg, 24px);
}

.d5-frames-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-sm, 8px);
}

.d5-frame {
  width: 100%;
  height: auto;
  border-radius: var(--radius-sm, 4px);
}

.d5-log {
  margin-top: var(--space-lg, 24px);
}

.d5-log-item {
  list-style: none;
  padding: 4px 0;
  font-size: 13px;
}

.d5-log-time {
  margin-right: 8px;
  color: #888;
}

.d5-log-error {
  color: #c92a2a;
}
</style>