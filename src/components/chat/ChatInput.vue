<template>
  <!-- 消息输入区 (P1-3c) -->
  <div class="input-area">
    <div class="model-selector">
      <el-select
        v-model="currentProviderId"
        placeholder="选择提供商"
        size="small"
        @change="emit('provider-change', currentProviderId)"
      >
        <el-option
          v-for="provider in enabledProviders"
          :key="provider.id"
          :label="provider.name"
          :value="provider.id"
          :disabled="provider.models.length === 0"
        />
      </el-select>
      <el-select
        v-model="currentModelId"
        placeholder="选择模型"
        size="small"
        :disabled="!canSelectModel || currentModels.length === 0"
      >
        <el-option
          v-if="currentModels.length === 0"
          key="empty"
          label="暂无可用模型"
          :value="null"
          disabled
        />
        <el-option
          v-for="model in currentModels"
          :key="model.id"
          :label="model.name"
          :value="model.id"
        />
      </el-select>
    </div>

    <!-- 文件/图片预览 -->
    <FilePreview
      v-if="attachedFiles.length > 0"
      :files="attachedFiles"
      @remove="(idx: number) => emit('remove-attached', idx)"
      @clear="emit('clear-attached')"
    />

    <!-- 引用消息预览 -->
    <div v-if="quotedMessage" class="quoted-message-preview">
      <div class="quoted-header">
        <span class="quoted-label">引用: {{ quotedMessage.role === 'user' ? '你' : 'AI' }}</span>
        <el-button size="small" text @click="emit('clear-quoted')">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
      <div class="quoted-content">
        {{ quotedMessage.content.substring(0, 100) }}{{ quotedMessage.content.length > 100 ? '...' : '' }}
      </div>
    </div>

    <div
      class="input-row"
      @dragover.prevent="emit('drag-over', $event)"
      @drop.prevent="emit('drop', $event)"
      @paste="emit('paste', $event)"
    >
      <el-input
        v-model="inputMessageLocal"
        type="textarea"
        :rows="2"
        placeholder="输入消息... (Shift+Enter 换行，Enter 发送)"
        @keydown.enter.exact.prevent="handleSendClick"
        @keydown.enter.shift.exact="emit('shift-enter')"
      />
      <div class="input-actions">
        <el-button
          v-if="isGenerating"
          type="danger"
          size="default"
          class="send-btn"
          @click="emit('stop-generation')"
        >
          <el-icon><VideoPause /></el-icon>
          停止
        </el-button>
        <el-button
          v-else
          type="primary"
          size="default"
          class="send-btn"
          :disabled="!inputMessageLocal.trim() && attachedFiles.length === 0"
          @click="handleSendClick"
        >
          <el-icon><Promotion /></el-icon>
          发送
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Promotion, VideoPause, Close } from '@element-plus/icons-vue';
import FilePreview from './FilePreview.vue';
import type { ChatMessage } from '@/stores/chat';
import type { ProviderConfig, ModelInfo } from '@/stores/models';

interface AttachedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  type: 'image' | 'document';
  url?: string;
  base64?: string;
  path?: string;
  content?: string;
}

const props = defineProps<{
  /** 当前 provider (v-model) */
  modelValueProvider: string | null;
  /** 当前 model (v-model) */
  modelValueModel: string | null;
  /** 输入框文字 (v-model) */
  modelValueInput: string;
  /** 已启用 provider 列表 */
  enabledProviders: ProviderConfig[];
  /** 当前 provider 可用模型 */
  currentModels: ModelInfo[];
  /** 是否能选模型 (默认 model 推断等) */
  canSelectModel: boolean;
  /** 附件文件列表 */
  attachedFiles: AttachedFile[];
  /** 是否正在生成 (控制"发送" vs "停止") */
  isGenerating: boolean;
  /** 引用消息 (显示引用预览条) */
  quotedMessage: ChatMessage | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValueProvider', v: string | null): void;
  (e: 'update:modelValueModel', v: string | null): void;
  (e: 'update:modelValueInput', v: string): void;
  (e: 'provider-change', v: string | null): void;
  (e: 'send', content: string): void;
  (e: 'shift-enter'): void;
  (e: 'stop-generation'): void;
  (e: 'drag-over', evt: DragEvent): void;
  (e: 'drop', evt: DragEvent): void;
  (e: 'paste', evt: ClipboardEvent): void;
  (e: 'remove-attached', idx: number): void;
  (e: 'clear-attached'): void;
  (e: 'clear-quoted'): void;
}>();

// v-model 适配
const currentProviderId = computed({
  get: () => props.modelValueProvider,
  set: v => emit('update:modelValueProvider', v),
});
const currentModelId = computed({
  get: () => props.modelValueModel,
  set: v => emit('update:modelValueModel', v),
});
const inputMessageLocal = computed({
  get: () => props.modelValueInput,
  set: v => emit('update:modelValueInput', v),
});

function handleSendClick(): void {
  emit('send', inputMessageLocal.value);
}
</script>

<style lang="scss" scoped>
.input-area {
  border-top: 1px solid var(--border-base);
  padding: var(--space-3) var(--space-3);
  background: var(--bg-elevated);
}

.model-selector {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.quoted-message-preview {
  margin-bottom: 8px;
  padding: 8px 12px;
  background: var(--bg-hover);
  border-left: 3px solid var(--accent-base);
  border-radius: 4px;

  .quoted-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;

    .quoted-label {
      font-size: 11px;
      color: var(--fg-secondary);
      font-weight: 500;
    }
  }

  .quoted-content {
    font-size: 12px;
    color: var(--fg-secondary);
    line-height: 1.5;
  }
}

.input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.input-actions {
  display: flex;
  align-items: flex-end;
  flex-shrink: 0;

  .send-btn {
    height: auto;
    min-height: 60px;
  }
}
</style>