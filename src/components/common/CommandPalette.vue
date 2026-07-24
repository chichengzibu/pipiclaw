<!--
  Command Palette - 全局命令面板 (Cmd+K / Ctrl+K)

  能力:
    1. 模糊搜索所有路由(标题 / 路径 / 描述)
    2. 触发最近 5 个会话(Chat only)
    3. 触发技能 / 模板 / 模型(可扩展)
    4. 快速执行:跳转 / 创建 / 切换主题

  设计参考:Linear / Raycast / Cursor
-->
<template>
  <Teleport to="body">
    <Transition name="palette-fade">
      <div
        v-if="open"
        class="palette-backdrop"
        @click.self="close"
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
      >
        <div class="palette" @keydown.stop>
          <div class="palette-input-wrap">
            <el-icon class="palette-search-icon"><Search /></el-icon>
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="palette-input"
              :placeholder="placeholder"
              autocomplete="off"
              spellcheck="false"
              @keydown.down.prevent="moveSelection(1)"
              @keydown.up.prevent="moveSelection(-1)"
              @keydown.enter.prevent="commit"
              @keydown.esc="close"
            />
            <kbd v-if="!query" class="palette-hint">esc</kbd>
          </div>

          <div class="palette-results" ref="resultsRef">
            <div
              v-for="(group, gi) in groupedResults"
              :key="group.key"
              class="palette-group"
            >
              <div class="palette-group-label">{{ group.label }}</div>
              <button
                v-for="(item, ii) in group.items"
                :key="item.id"
                class="palette-item"
                :class="{
                  active: isActive(gi, ii),
                  'palette-item--recent': item.kind === 'recent',
                }"
                @click="commitItem(item)"
                @mouseenter="setActive(gi, ii)"
              >
                <el-icon v-if="item.icon" class="palette-item-icon">
                  <component :is="item.icon" />
                </el-icon>
                <span v-else-if="item.emoji" class="palette-item-emoji">{{ item.emoji }}</span>
                <div class="palette-item-body">
                  <div class="palette-item-title">{{ item.title }}</div>
                  <div v-if="item.subtitle" class="palette-item-subtitle">{{ item.subtitle }}</div>
                </div>
                <span v-if="item.badge" class="palette-item-badge">{{ item.badge }}</span>
                <kbd v-if="isActive(gi, ii)" class="palette-item-kbd">↵</kbd>
              </button>
            </div>

            <div v-if="groupedResults.length === 0" class="palette-empty">
              <span>没有匹配的命令</span>
              <p>试试搜索「对话」「模型」「技能」「主题」</p>
            </div>
          </div>

          <div class="palette-footer">
            <span><kbd>↑↓</kbd> 选择</span>
            <span><kbd>↵</kbd> 打开</span>
            <span><kbd>esc</kbd> 关闭</span>
            <span class="palette-footer-spacer" />
            <span class="palette-footer-tip">由 PiPiClaw 命令面板驱动</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'

interface CommandItem {
  id: string
  kind: 'nav' | 'action' | 'recent' | 'prompt'
  title: string
  subtitle?: string
  icon?: Component | string
  emoji?: string
  badge?: string
  keywords?: string[] // 模糊匹配扩展
  action: () => unknown | Promise<unknown>
  hidden?: boolean
}

const router = useRouter()
const appStore = useAppStore()

const open = ref(false)
const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const resultsRef = ref<HTMLDivElement | null>(null)
const activeGroupIdx = ref(0)
const activeItemIdx = ref(0)

const placeholder = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了 — 你想做什么?'
  if (hour < 12) return '早上好 — 试试搜索「翻译」'
  if (hour < 18) return '下午好 — 试试「总结」'
  return '晚上好 — 试试「写代码」'
})

// ====== 命令源 ======

const recentConversations = computed<CommandItem[]>(() => {
  try {
    const all = JSON.parse(localStorage.getItem('pipiclaw_recent_commands') || '[]') as Array<{
      id: string
      title: string
      ts: number
    }>
    return all
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 5)
      .map((r) => ({
        id: `recent-${r.id}`,
        kind: 'recent',
        title: r.title,
        subtitle: '继续对话',
        emoji: '💬',
        action: () => router.push({ path: '/chat', query: { c: r.id } }),
      }))
  } catch {
    return []
  }
})

const navigationCommands = computed<CommandItem[]>(() => {
  const items: CommandItem[] = [
    {
      id: 'nav-dashboard', kind: 'nav', title: '工作台', subtitle: '回到首页', emoji: '🏠',
      keywords: ['home', '首页', '工作台', '概览'],
      action: () => router.push('/dashboard'),
    },
    {
      id: 'nav-chat', kind: 'nav', title: 'AI 对话', subtitle: '开启新对话或继续历史', emoji: '💬',
      keywords: ['chat', '对话', '聊天', 'ai'],
      action: () => router.push('/chat'),
    },
    {
      id: 'nav-chat-new', kind: 'nav', title: '新建对话', subtitle: '开一个新会话', emoji: '✨',
      keywords: ['new', '新', '创建'],
      action: () => router.push('/chat').then(() => window.dispatchEvent(new CustomEvent('cmd:new-chat'))),
    },
    {
      id: 'nav-skills', kind: 'nav', title: '技能管理', subtitle: '已安装的技能', emoji: '🧩',
      keywords: ['skills', '技能'],
      action: () => router.push('/skills'),
    },
    {
      id: 'nav-clawhub', kind: 'nav', title: 'ClawHub 技能市场', subtitle: '浏览 / 发布 / 审核技能', emoji: '🛒',
      keywords: ['clawhub', 'market', '市场', '模板'],
      action: () => router.push('/clawhub'),
    },
    {
      id: 'nav-models', kind: 'nav', title: '模型管理', subtitle: '配置 LLM 提供商', emoji: '🤖',
      keywords: ['models', '模型', 'llm'],
      action: () => router.push('/models'),
    },
    {
      id: 'nav-model-compare', kind: 'nav', title: '模型对比', subtitle: '性价比 + 社区评分', emoji: '⚖️',
      keywords: ['compare', '对比', '价格'],
      action: () => router.push('/model-compare'),
    },
    {
      id: 'nav-im', kind: 'nav', title: 'IM 管理', subtitle: '11 个 IM 平台配置', emoji: '📨',
      keywords: ['im', 'feishu', 'telegram', 'discord', '钉钉', '飞书'],
      action: () => router.push('/im-management'),
    },
    {
      id: 'nav-tasks', kind: 'nav', title: '自动化任务', subtitle: '查看运行中的任务', emoji: '⚡',
      keywords: ['tasks', '任务'],
      action: () => router.push('/tasks'),
    },
    {
      id: 'nav-schedule', kind: 'nav', title: '定时任务', subtitle: 'Cron 计划', emoji: '⏰',
      keywords: ['schedule', 'cron', '定时', '计划'],
      action: () => router.push('/schedule'),
    },
    {
      id: 'nav-permissions', kind: 'nav', title: '权限管理', subtitle: '用户 / 群组权限', emoji: '🔒',
      keywords: ['permission', '权限', 'rbac'],
      action: () => router.push('/permissions'),
    },
    {
      id: 'nav-settings', kind: 'nav', title: '系统设置', subtitle: '主题 / 快捷键 / 自动更新', emoji: '⚙️',
      keywords: ['settings', '设置', 'preferences', '偏好'],
      action: () => router.push('/settings'),
    },
  ]
  return items
})

const actionCommands = computed<CommandItem[]>(() => {
  const isDark = appStore.currentTheme === 'dark'
  return [
    {
      id: 'action-toggle-theme', kind: 'action', title: isDark ? '切换到浅色主题' : '切换到深色主题',
      subtitle: '主题切换', emoji: isDark ? '☀️' : '🌙',
      action: () => appStore.toggleTheme(),
    },
    {
      id: 'action-reload', kind: 'action', title: '重新加载窗口', subtitle: 'Ctrl+Shift+R', emoji: '🔄',
      action: () => window.location.reload(),
    },
    {
      id: 'action-devtools', kind: 'action', title: '打开开发者工具', subtitle: '调试用', emoji: '🛠️',
      action: () => (window as any).electronAPI?.window?.openDevTools?.(),
    },
    {
      id: 'action-clear-cache', kind: 'action', title: '清空本地缓存', subtitle: '不影响云端', emoji: '🧹',
      action: async () => {
        localStorage.clear()
        sessionStorage.clear()
        // 通知用户
        window.dispatchEvent(new CustomEvent('cmd:toast', { detail: { type: 'success', text: '本地缓存已清空' } }))
      },
    },
  ]
})

const promptTemplates = computed<CommandItem[]>(() => [
  {
    id: 'prompt-translate', kind: 'prompt', title: '翻译一段文字', subtitle: '中英日韩法德西俄 8 语种', emoji: '🌐',
    action: () => router.push('/chat').then(() => fillInput('请帮我把下面这段文字翻译成英文:\n\n')),
  },
  {
    id: 'prompt-code-review', kind: 'prompt', title: '代码审查', subtitle: '粘贴 PR diff,自动 review', emoji: '🔍',
    action: () => router.push('/chat').then(() => fillInput('请审查以下代码改动,给出风格 / 性能 / 安全建议:\n\n```diff\n\n```')),
  },
  {
    id: 'prompt-daily', kind: 'prompt', title: '生成今日工作日报', subtitle: '从 IM / 任务自动汇总', emoji: '📅',
    action: () => router.push('/chat').then(() => fillInput('帮我生成今天的工作日报,要包含: 完成任务、进行中、风险/阻塞')),
  },
  {
    id: 'prompt-bug', kind: 'prompt', title: '分析一个 bug', subtitle: '贴日志 / 报错信息', emoji: '🐛',
    action: () => router.push('/chat').then(() => fillInput('我遇到一个 bug,错误信息如下,请帮我分析:\n\n')),
  },
  {
    id: 'prompt-idea', kind: 'prompt', title: '头脑风暴', subtitle: '给一个主题,列 10 个角度', emoji: '💡',
    action: () => router.push('/chat').then(() => fillInput('我想头脑风暴一个想法。主题是:\n\n请从 10 个不同角度帮我展开。')),
  },
])

const allCommands = computed<CommandItem[]>(() => [
  ...promptTemplates.value,
  ...actionCommands.value,
  ...navigationCommands.value,
  ...recentConversations.value,
])

// ====== 过滤 & 排序 ======

function fuzzyMatch(needle: string, haystack: string): number {
  if (!needle) return 1
  const n = needle.toLowerCase()
  const h = haystack.toLowerCase()
  if (h.includes(n)) return 2 // 强匹配
  // 字符顺序匹配
  let i = 0
  for (const ch of h) {
    if (ch === n[i]) i++
    if (i === n.length) return 1
  }
  return 0
}

function scoreItem(item: CommandItem, q: string): number {
  if (!q) return 1
  const fields = [item.title, item.subtitle || '', ...(item.keywords || [])]
  let best = 0
  for (const f of fields) best = Math.max(best, fuzzyMatch(q, f))
  // recent / prompt 优先级高
  if (item.kind === 'recent') best += 0.5
  if (item.kind === 'prompt') best += 0.3
  return best
}

const filteredCommands = computed<CommandItem[]>(() => {
  const q = query.value.trim()
  if (!q) {
    // 默认:prompts 优先,其余按原始顺序
    return [
      ...promptTemplates.value,
      ...actionCommands.value,
      ...navigationCommands.value.slice(0, 6),
      ...recentConversations.value,
    ]
  }
  return allCommands.value
    .map((it) => ({ it, score: scoreItem(it, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map((x) => x.it)
})

const groupedResults = computed(() => {
  const groups: Record<string, { key: string; label: string; items: CommandItem[] }> = {
    recent: { key: 'recent', label: '最近对话', items: [] },
    prompt: { key: 'prompt', label: '💡 提示词模板', items: [] },
    action: { key: 'action', label: '⚡ 动作', items: [] },
    nav: { key: 'nav', label: '📍 页面', items: [] },
  }
  for (const it of filteredCommands.value) {
    groups[it.kind].items.push(it)
  }
  return Object.values(groups).filter((g) => g.items.length > 0)
})

// ====== 选中态 ======

function isActive(gi: number, ii: number): boolean {
  return activeGroupIdx.value === gi && activeItemIdx.value === ii
}

function setActive(gi: number, ii: number): void {
  activeGroupIdx.value = gi
  activeItemIdx.value = ii
}

function flatIndex(gi: number, ii: number): number {
  let n = 0
  for (let i = 0; i < gi; i++) n += groupedResults.value[i].items.length
  return n + ii
}

function moveSelection(delta: number): void {
  const total = groupedResults.value.reduce((sum, g) => sum + g.items.length, 0)
  if (total === 0) return
  const cur = flatIndex(activeGroupIdx.value, activeItemIdx.value)
  const next = (cur + delta + total) % total
  let n = next
  for (let gi = 0; gi < groupedResults.value.length; gi++) {
    if (n < groupedResults.value[gi].items.length) {
      activeGroupIdx.value = gi
      activeItemIdx.value = n
      // 滚到可见
      nextTick(() => {
        const el = resultsRef.value?.querySelector('.palette-item.active') as HTMLElement | null
        el?.scrollIntoView({ block: 'nearest' })
      })
      return
    }
    n -= groupedResults.value[gi].items.length
  }
}

function commit(): void {
  const grp = groupedResults.value[activeGroupIdx.value]
  const item = grp?.items?.[activeItemIdx.value]
  if (item) commitItem(item)
}

async function commitItem(item: CommandItem): Promise<void> {
  // 记录最近使用
  if (item.kind === 'nav' || item.kind === 'prompt') {
    try {
      const history = JSON.parse(localStorage.getItem('pipiclaw_recent_commands') || '[]') as Array<{
        id: string
        title: string
        ts: number
      }>
      const filtered = history.filter((h) => h.id !== item.id)
      filtered.unshift({ id: item.id, title: item.title, ts: Date.now() })
      localStorage.setItem('pipiclaw_recent_commands', JSON.stringify(filtered.slice(0, 20)))
    } catch {
      // ignore
    }
  }
  await item.action()
  close()
}

function fillInput(text: string): void {
  // 等 Chat.vue 加载完成,触发 input 事件
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('cmd:fill-chat', { detail: { text } }))
  }, 200)
}

// ====== 打开/关闭 ======

function openPalette(): void {
  open.value = true
  query.value = ''
  activeGroupIdx.value = 0
  activeItemIdx.value = 0
  nextTick(() => {
    inputRef.value?.focus()
  })
}

function close(): void {
  open.value = false
}

function onKeyDown(e: KeyboardEvent): void {
  // Cmd+K (mac) or Ctrl+K (其他)
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (open.value) close()
    else openPalette()
    return
  }
  // `/` 快捷键(仅非输入框)
  if (e.key === '/' && !open.value) {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !(e.target as HTMLElement)?.isContentEditable) {
      e.preventDefault()
      openPalette()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  // 暴露全局方法,其他组件可调用
  ;(window as any).__openCommandPalette = openPalette
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})

// 暴露 openPalette 方法给外部触发
defineExpose({ openPalette, close })

// 监听外部"打开"事件
const onExternalOpen = (): void => openPalette()
onMounted(() => window.addEventListener('cmd:open-palette', onExternalOpen))
onUnmounted(() => window.removeEventListener('cmd:open-palette', onExternalOpen))

// active 自动滚到可见
watch([activeGroupIdx, activeItemIdx], () => {
  nextTick(() => {
    const el = resultsRef.value?.querySelector('.palette-item.active') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  })
})
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.palette-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 1000);
  background: var(--el-overlay-color, rgba(0, 0, 0, 0.5));
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
}

.palette {
  width: 640px;
  max-width: 92vw;
  max-height: 70vh;
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: var(--font-family-system);
}

.palette-input-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--border-base);
  background: var(--bg-elevated);
}

.palette-search-icon {
  font-size: 18px;
  color: var(--fg-tertiary);
  flex-shrink: 0;
}

.palette-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--fg-primary);
  font-size: 15px;
  font-family: inherit;
  &::placeholder {
    color: var(--fg-tertiary);
  }
}

.palette-hint {
  font-family: var(--font-family-mono);
  font-size: 11px;
  color: var(--fg-tertiary);
  background: var(--bg-base);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
}

.palette-results {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-sm) 0;
  min-height: 200px;
}

.palette-group {
  display: flex;
  flex-direction: column;
}

.palette-group-label {
  padding: var(--space-sm) var(--space-lg) var(--space-xs);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-tertiary);
}

.palette-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-lg);
  background: transparent;
  border: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  color: var(--fg-primary);
  font-size: 14px;
  transition: background-color var(--duration-fast) var(--ease-standard);

  &.active {
    background: var(--accent-soft);
  }

  &--recent {
    .palette-item-emoji {
      filter: grayscale(0.3);
    }
  }
}

.palette-item-icon {
  font-size: 16px;
  color: var(--fg-secondary);
  flex-shrink: 0;
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.palette-item-emoji {
  font-size: 18px;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.palette-item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.palette-item-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--fg-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.palette-item-subtitle {
  font-size: 12px;
  color: var(--fg-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.palette-item-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent-base);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.palette-item-kbd {
  font-family: var(--font-family-mono);
  font-size: 11px;
  color: var(--fg-tertiary);
  background: var(--bg-base);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-sm);
  padding: 1px 5px;
  flex-shrink: 0;
}

.palette-empty {
  padding: var(--space-2xl) var(--space-lg);
  text-align: center;
  color: var(--fg-tertiary);
  font-size: 13px;

  p {
    margin: var(--space-sm) 0 0;
    font-size: 12px;
    opacity: 0.7;
  }
}

.palette-footer {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-lg);
  border-top: 1px solid var(--border-base);
  background: var(--bg-elevated);
  font-size: 11px;
  color: var(--fg-tertiary);

  kbd {
    font-family: var(--font-family-mono);
    font-size: 10px;
    background: var(--bg-base);
    border: 1px solid var(--border-base);
    border-radius: var(--radius-sm);
    padding: 1px 4px;
    margin-right: 4px;
  }
}

.palette-footer-spacer {
  flex: 1;
}

.palette-footer-tip {
  opacity: 0.5;
  font-size: 10px;
}

.palette-fade-enter-active,
.palette-fade-leave-active {
  transition: opacity var(--duration-base) var(--ease-standard);
}

.palette-fade-enter-active .palette,
.palette-fade-leave-active .palette {
  transition: transform var(--duration-base) var(--ease-spring),
    opacity var(--duration-base) var(--ease-standard);
}

.palette-fade-enter-from,
.palette-fade-leave-to {
  opacity: 0;
}

.palette-fade-enter-from .palette,
.palette-fade-leave-to .palette {
  opacity: 0;
  transform: scale(0.96) translateY(-8px);
}

@media (max-width: 640px) {
  .palette-backdrop {
    padding-top: 4vh;
  }
  .palette {
    max-height: 90vh;
  }
}
</style>
