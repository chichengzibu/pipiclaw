<template>
  <!-- Hermes 记忆管理抽屉 -->
  <el-drawer
    v-model="hermesMemoryStore.showMemoryDrawer"
    title="Hermes 记忆管理"
    :size="480"
    direction="rtl"
  >
    <div class="memory-drawer-content">
      <!-- 记忆开关 -->
      <div class="memory-section">
        <div class="section-title">功能开关</div>
        <div class="switch-container">
          <el-switch
            v-model="hermesMemoryStore.memoryEnabled"
            active-text="启用记忆注入"
            inactive-text="禁用记忆注入"
          />
        </div>
        <div class="help-text" v-if="hermesMemoryStore.memoryEnabled">
          开启后，核心记忆将在每次对话中自动注入到系统提示词中
        </div>
      </div>

      <!-- 核心记忆编辑 -->
      <div class="memory-section">
        <div class="section-title">核心记忆</div>
        <el-input
          v-model="hermesMemoryStore.editingCoreMemory"
          type="textarea"
          :rows="8"
          placeholder="输入您的核心记忆，例如：我的名字是李明，我喜欢编程，我在上海工作..."
          @input="handleCoreMemoryChange"
        />
        <div class="help-text">
          这里的内容将实时保存，所有对话都可以使用
        </div>
      </div>

      <!-- 本次对话注入预览 -->
      <div class="memory-section" v-if="hermesMemoryStore.memoryEnabled">
        <div class="section-title">本次对话注入预览</div>
        <div class="preview-box">
          <div v-if="!hermesMemoryStore.generateInjectedMemory()" class="empty-preview">
            暂无记忆内容
          </div>
          <div v-else class="memory-preview">
            {{ hermesMemoryStore.generateInjectedMemory() }}
          </div>
        </div>
      </div>

      <!-- 经验记忆（只读） -->
      <div class="memory-section" v-if="hermesMemoryStore.experienceMemory">
        <div class="section-title">经验记忆（只读）</div>
        <div class="readonly-box">
          {{ hermesMemoryStore.experienceMemory }}
        </div>
      </div>

      <!-- 对话记忆（只读） -->
      <div class="memory-section" v-if="hermesMemoryStore.memories.length > 0">
        <div class="section-title">对话记忆（只读）</div>
        <div class="memory-list-preview">
          <div
            v-for="mem in hermesMemoryStore.memories.slice(-5).reverse()"
            :key="mem.id"
            class="memory-item-preview"
          >
            <div class="memory-time">{{ new Date(mem.timestamp).toLocaleString() }}</div>
            <div class="memory-text">{{ mem.content }}</div>
          </div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { useHermesMemoryStore } from '@/stores/hermesMemory';

const hermesMemoryStore = useHermesMemoryStore();

// 核心记忆编辑防抖保存（500ms）
let memorySaveTimer: ReturnType<typeof setTimeout> | null = null;
function handleCoreMemoryChange(value: string): void {
  if (memorySaveTimer) clearTimeout(memorySaveTimer);
  memorySaveTimer = setTimeout(async () => {
    await hermesMemoryStore.updateCoreMemory(value);
  }, 500);
}
</script>

<style lang="scss" scoped>
.memory-drawer-content {
  padding: 0 4px;
}

.memory-section {
  margin-bottom: 24px;

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-regular);
    margin-bottom: 10px;
  }

  .switch-container {
    margin-bottom: 6px;
  }

  .help-text {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.5;
    margin-top: 6px;
  }

  .preview-box,
  .readonly-box {
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    padding: 12px;
    font-size: 13px;
    line-height: 1.6;
    max-height: 200px;
    overflow-y: auto;
    white-space: pre-wrap;
  }

  .empty-preview {
    color: var(--el-text-color-placeholder);
    text-align: center;
    padding: 12px 0;
  }

  .memory-list-preview {
    max-height: 240px;
    overflow-y: auto;

    .memory-item-preview {
      padding: 8px 10px;
      border-bottom: 1px solid var(--el-border-color-lighter);

      &:last-child {
        border-bottom: none;
      }

      .memory-time {
        font-size: 11px;
        color: var(--el-text-color-secondary);
        margin-bottom: 2px;
      }

      .memory-text {
        font-size: 12px;
        color: var(--el-text-color-regular);
      }
    }
  }
}
</style>