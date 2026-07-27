<template>
  <!-- 空状态快速提示词面板 (P5-UX) -->
  <div class="empty-prompts" v-if="enabledProvidersCount > 0">
    <button
      v-for="p in QUICK_PROMPTS"
      :key="p.id"
      class="empty-prompt-card"
      type="button"
      @click="emitPrompt(p)"
    >
      <span class="empty-prompt-emoji">{{ p.emoji }}</span>
      <div class="empty-prompt-body">
        <div class="empty-prompt-title">{{ p.title }}</div>
        <div class="empty-prompt-desc">{{ p.desc }}</div>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface QuickPrompt {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  prompt: string;
}

// 6 个内置 prompt 模板 (与 CommandPalette 同步,用户在命令面板也可调)
const QUICK_PROMPTS: QuickPrompt[] = [
  { id: 'p1', emoji: '📝', title: '帮我写一份日报', desc: '从今天的 IM / 任务 / 文件汇总', prompt: '请帮我生成今天的工作日报,要包含:\n1. 今日完成的关键任务\n2. 仍在进行的事项及当前进度\n3. 风险 / 阻塞 / 需要协助的事项\n4. 明日计划' },
  { id: 'p2', emoji: '🔍', title: '代码审查', desc: '粘贴 PR diff,自动 review', prompt: '请审查下面的代码改动,按 文件 → 改动 → 建议 三段输出,要标出风格 / 性能 / 安全 / 潜在 bug 四类问题:\n\n```diff\n\n```' },
  { id: 'p3', emoji: '🌐', title: '翻译一段文字', desc: '中英日韩法德西俄 8 语种', prompt: '请把下面这段文字翻译成英文(同时给我 2 个备选版本),保留原文中所有专有名词:\n\n' },
  { id: 'p4', emoji: '🐛', title: '帮我分析一个 bug', desc: '贴日志 / 报错 / 现象', prompt: '我遇到一个 bug,需要你帮我定位:\n\n【现象】\n\n【报错日志】\n\n【已尝试】\n\n请先复述我的问题确认理解,然后给出 3 个最可能的根因,按概率排序,每个根因给出验证方法。' },
  { id: 'p5', emoji: '💡', title: '头脑风暴', desc: '给个主题,列 10 个角度', prompt: '我想就「__主题__」做一次头脑风暴。请从 10 个不同角度帮我展开(技术 / 用户 / 商业 / 风险 / 趋势 / 反方 / 等等),每个角度 2-3 句话。' },
  { id: 'p6', emoji: '📅', title: '写周报', desc: '本周工作整理', prompt: '请基于本周我的工作生成结构化周报:\n1. 本周亮点(3 条以内)\n2. 主要进展(按项目 / 任务分类)\n3. 数据 / 指标变化\n4. 遇到的问题和解决方案\n5. 下周计划' },
];

const props = defineProps<{
  /** 是否启用了至少一个 provider — 控制整个面板是否显示 */
  enabledProvidersCount: number;
}>();

const enabledProvidersCount = computed(() => props.enabledProvidersCount);

const emit = defineEmits<{
  /** 用户点击 prompt 卡片,parent 处理实际对话创建 / 填入 */
  (e: 'prompt-selected', prompt: QuickPrompt): void;
}>();

function emitPrompt(p: QuickPrompt): void {
  emit('prompt-selected', p);
}
</script>

<style lang="scss" scoped>
.empty-prompts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 28px;
}

.empty-prompt-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
  font: inherit;
  color: inherit;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
}

.empty-prompt-emoji {
  font-size: 22px;
  line-height: 1.2;
  flex-shrink: 0;
}

.empty-prompt-body {
  flex: 1;
  min-width: 0;
}

.empty-prompt-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 2px;
}

.empty-prompt-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}
</style>