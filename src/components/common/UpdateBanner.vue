<!--
  UpdateBanner - 顶部非阻塞更新提示

  监听 autoUpdater 事件:
    - onUpdateAvailable  →  蓝色 info:有新版本可下载
    - onUpdateDownloaded →  绿色 success:已下载,点重启安装
    - onError            →  红色 error(静默 5s 自动消失)
-->
<template>
  <Transition name="banner-fade">
    <div
      v-if="visible"
      class="update-banner"
      :class="`update-banner--${type}`"
      role="status"
      aria-live="polite"
    >
      <el-icon class="update-banner-icon">
        <component :is="iconName" />
      </el-icon>
      <div class="update-banner-body">
        <div class="update-banner-title">{{ title }}</div>
        <div class="update-banner-desc">{{ desc }}</div>
      </div>
      <div class="update-banner-actions">
        <el-button
          v-if="type === 'info'"
          size="small"
          type="primary"
          :loading="downloading"
          @click="handleDownload"
        >
          立即下载
        </el-button>
        <el-button
          v-if="type === 'success'"
          size="small"
          type="primary"
          @click="handleInstall"
        >
          立即重启
        </el-button>
        <el-button
          v-if="type === 'error'"
          size="small"
          @click="dismiss"
        >
          知道了
        </el-button>
        <el-button
          v-if="type === 'info'"
          size="small"
          text
          @click="dismiss"
        >
          稍后
        </el-button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Download, CircleCheck, WarningFilled } from '@element-plus/icons-vue'

type BannerType = 'info' | 'success' | 'error' | null

const visible = ref(false)
const type = ref<BannerType>(null)
const version = ref('')
const downloading = ref(false)
const releaseNotes = ref<string | null>(null)

let dismissTimer: number | null = null

const iconName = computed(() => {
  if (type.value === 'success') return CircleCheck
  if (type.value === 'error') return WarningFilled
  return Download
})

const title = computed(() => {
  if (type.value === 'info') return `PiPiClaw v${version.value} 已可用`
  if (type.value === 'success') return `v${version.value} 已下载完成`
  if (type.value === 'error') return '更新检查失败'
  return ''
})

const desc = computed(() => {
  if (type.value === 'info') {
    return releaseNotes.value
      ? truncate(releaseNotes.value, 200)
      : '点击「立即下载」获取新功能与修复'
  }
  if (type.value === 'success') return '点击「立即重启」完成安装,所有未保存的内容会自动保留'
  if (type.value === 'error') return '网络异常,稍后再试,或到「设置 → 关于」手动检查'
  return ''
})

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function showBanner(t: BannerType, v: string, notes?: string | null): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  type.value = t
  version.value = v
  releaseNotes.value = notes ?? null
  visible.value = true
  if (t === 'error') {
    // error 5s 自动消失
    dismissTimer = window.setTimeout(() => {
      visible.value = false
    }, 5000)
  }
}

function dismiss(): void {
  visible.value = false
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
}

async function handleDownload(): Promise<void> {
  downloading.value = true
  try {
    const r = await (window as any).electronAPI?.autoUpdater?.download?.()
    if (r && !r.success) {
      showBanner('error', version.value)
    }
  } catch (e) {
    showBanner('error', version.value)
    console.warn('Update download failed', e)
  } finally {
    downloading.value = false
  }
}

function handleInstall(): void {
  ;(window as any).electronAPI?.autoUpdater?.install?.()
}

interface UpdateAvailableDetail {
  version: string
  releaseDate?: string
  releaseNotes?: unknown
}

interface UpdateDownloadedDetail {
  version: string
}

function onAvailable(_e: Event): void {
  const ce = _e as CustomEvent<UpdateAvailableDetail>
  const detail = ce.detail
  showBanner('info', detail?.version || '?', stringifyNotes(detail?.releaseNotes))
}

function onDownloaded(_e: Event): void {
  const ce = _e as CustomEvent<UpdateDownloadedDetail>
  showBanner('success', ce.detail?.version || '?')
}

function onError(_e: Event): void {
  const ce = _e as CustomEvent<{ message: string }>
  console.warn('[UpdateBanner] error', ce.detail?.message)
  showBanner('error', '')
}

function stringifyNotes(notes: unknown): string | null {
  if (!notes) return null
  if (typeof notes === 'string') return notes
  if (Array.isArray(notes)) {
    return notes
      .map((n) => (typeof n === 'string' ? n : (n as { note?: string })?.note || ''))
      .filter(Boolean)
      .join('\n\n')
  }
  return null
}

onMounted(() => {
  window.addEventListener('autoUpdater:onUpdateAvailable', onAvailable as EventListener)
  window.addEventListener('autoUpdater:onUpdateDownloaded', onDownloaded as EventListener)
  window.addEventListener('autoUpdater:onError', onError as EventListener)
})

onUnmounted(() => {
  window.removeEventListener('autoUpdater:onUpdateAvailable', onAvailable as EventListener)
  window.removeEventListener('autoUpdater:onUpdateDownloaded', onDownloaded as EventListener)
  window.removeEventListener('autoUpdater:onError', onError as EventListener)
  if (dismissTimer) clearTimeout(dismissTimer)
})
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.update-banner {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--border-base);
  font-size: 13px;
  flex-shrink: 0;
  background: var(--bg-elevated);
  z-index: var(--z-elevated, 10);

  &--info {
    background: var(--accent-soft);
    color: var(--fg-primary);
    border-bottom-color: var(--accent-base);
  }

  &--success {
    background: rgba(34, 197, 94, 0.1);
    color: var(--fg-primary);
    border-bottom-color: var(--success);
  }

  &--error {
    background: rgba(220, 38, 38, 0.08);
    color: var(--fg-primary);
    border-bottom-color: var(--danger);
  }
}

.update-banner-icon {
  font-size: 20px;
  flex-shrink: 0;

  .update-banner--info & { color: var(--accent-base); }
  .update-banner--success & { color: var(--success); }
  .update-banner--error & { color: var(--danger); }
}

.update-banner-body {
  flex: 1;
  min-width: 0;
}

.update-banner-title {
  font-weight: var(--font-weight-semibold);
  font-size: 14px;
  line-height: 1.4;
}

.update-banner-desc {
  font-size: 12px;
  color: var(--fg-secondary);
  line-height: 1.4;
  margin-top: 2px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 60px;
  overflow: hidden;
}

.update-banner-actions {
  display: flex;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.banner-fade-enter-active,
.banner-fade-leave-active {
  transition: transform var(--duration-base) var(--ease-spring),
    opacity var(--duration-base) var(--ease-standard);
}

.banner-fade-enter-from,
.banner-fade-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
</style>
