<template>
  <!-- 左侧会话列表面板 (P1-3b) -->
  <div class="sidebar" :style="{ width: chatSidebarWidth + 'px' }">
    <div class="sidebar-header">
      <span class="sidebar-title">会话</span>
      <el-button
        type="primary"
        size="small"
        title="新建对话"
        aria-label="新建对话"
        class="new-chat-btn"
        @click="emit('new-chat')"
      >
        <el-icon><Plus /></el-icon>
        <span class="new-chat-text">新建</span>
      </el-button>
    </div>

    <!-- 会话搜索框 -->
    <div class="search-box">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索会话..."
        size="small"
        clearable
        @input="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <!-- 批量操作栏 -->
    <div v-if="chatStore.selectedConversations.length > 0" class="batch-actions">
      <span class="selected-count">已选中 {{ chatStore.selectedConversations.length }} 项</span>
      <el-button size="small" type="danger" @click="emit('batch-delete')">
        批量删除
      </el-button>
      <el-button size="small" @click="emit('batch-archive')">
        批量归档
      </el-button>
      <el-button size="small" text @click="chatStore.clearConversationSelection">
        取消
      </el-button>
    </div>

    <el-scrollbar class="conversations-list">
      <!-- 搜索结果 -->
      <template v-if="searchKeyword && chatStore.searchResults.length > 0">
        <div class="conversation-group">
          <div class="group-label">搜索结果</div>
          <div
            v-for="conv in chatStore.searchResults"
            :key="conv.id"
            class="conversation-item"
            :class="{ active: conv.id === chatStore.currentConversationId }"
            @click="emit('select', conv.id)"
          >
            <el-checkbox
              :model-value="chatStore.selectedConversations.includes(conv.id)"
              @click.stop
              @change="chatStore.toggleConversationSelection(conv.id)"
            />
            <span class="conversation-icon">🔍</span>
            <span class="conversation-title">{{ conv.title }}</span>
          </div>
        </div>
      </template>

      <!-- 置顶会话 -->
      <div v-if="chatStore.pinnedConversations.length > 0" class="conversation-group">
        <div class="group-label">置顶</div>
        <div
          v-for="conv in chatStore.pinnedConversations"
          :key="conv.id"
          class="conversation-item"
          :class="{ active: conv.id === chatStore.currentConversationId }"
          @click="emit('select', conv.id)"
        >
          <el-checkbox
            :model-value="chatStore.selectedConversations.includes(conv.id)"
            @click.stop
            @change="chatStore.toggleConversationSelection(conv.id)"
          />
          <span class="conversation-icon">📌</span>
          <span class="conversation-title">{{ conv.title }}</span>
          <el-dropdown trigger="click" @command="(cmd: string) => emit('action', cmd, conv)">
            <el-icon class="more-icon"><MoreFilled /></el-icon>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="rename">重命名</el-dropdown-item>
                <el-dropdown-item command="unpin">取消置顶</el-dropdown-item>
                <el-dropdown-item command="archive">归档</el-dropdown-item>
                <el-dropdown-item command="export">导出</el-dropdown-item>
                <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <!-- 最近会话 -->
      <div class="conversation-group">
        <div class="group-label">最近</div>
        <div
          v-for="conv in displayedConversations"
          :key="conv.id"
          class="conversation-item"
          :class="{ active: conv.id === chatStore.currentConversationId }"
          @click="emit('select', conv.id)"
        >
          <el-checkbox
            :model-value="chatStore.selectedConversations.includes(conv.id)"
            @click.stop
            @change="chatStore.toggleConversationSelection(conv.id)"
          />
          <span class="conversation-icon">💬</span>
          <span class="conversation-title">{{ conv.title }}</span>
          <el-dropdown trigger="click" @command="(cmd: string) => emit('action', cmd, conv)">
            <el-icon class="more-icon"><MoreFilled /></el-icon>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="pin">置顶</el-dropdown-item>
                <el-dropdown-item command="rename">重命名</el-dropdown-item>
                <el-dropdown-item command="archive">归档</el-dropdown-item>
                <el-dropdown-item command="export">导出</el-dropdown-item>
                <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <div v-if="displayedConversations.length === 0" class="empty-hint">
          暂无会话
        </div>
      </div>

      <!-- 归档会话 -->
      <div v-if="chatStore.archivedConversations.length > 0" class="conversation-group">
        <div class="group-label">已归档</div>
        <div
          v-for="conv in chatStore.archivedConversations"
          :key="conv.id"
          class="conversation-item archived"
          @click="emit('select', conv.id)"
        >
          <span class="conversation-icon">📦</span>
          <span class="conversation-title">{{ conv.title }}</span>
          <el-button size="small" text type="primary" @click.stop="emit('unarchive', conv.id)">
            恢复
          </el-button>
        </div>
      </div>
    </el-scrollbar>

    <div
      class="chat-sidebar-resize-handle"
      @mousedown="emit('start-resize', $event)"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Plus, Search, MoreFilled } from '@element-plus/icons-vue';
import type { Conversation } from '@/stores/chat';
import { useChatStore } from '@/stores/chat';

defineProps<{
  /** 侧栏宽度 (px) — 由 parent 控制拖拽 */
  chatSidebarWidth: number;
}>();

const emit = defineEmits<{
  (e: 'new-chat'): void;
  (e: 'select', id: string): void;
  (e: 'action', cmd: string, conv: Conversation): void;
  (e: 'unarchive', id: string): void;
  (e: 'batch-delete'): void;
  (e: 'batch-archive'): void;
  (e: 'start-resize', evt: MouseEvent): void;
}>();

const chatStore = useChatStore();

const searchKeyword = ref('');
function handleSearch(): void {
  chatStore.setSearchKeyword(searchKeyword.value);
}

// 显示的最近会话: 排除置顶 + 归档 (置顶和归档各自独立分组)
const displayedConversations = computed(() => {
  if (searchKeyword.value && chatStore.searchResults.length > 0) return [];
  return chatStore.conversations.filter(c => !c.pinned && c.status !== 'archived');
});
</script>

<style lang="scss" scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border-right: 1px solid var(--border-base);
  min-width: 200px;
  max-width: 400px;
  position: relative;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-base);

  .sidebar-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--fg-primary);
  }
}

.search-box {
  padding: 8px 12px;
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-hover);
  border-bottom: 1px solid var(--border-base);

  .selected-count {
    font-size: 12px;
    color: var(--fg-secondary);
    margin-right: auto;
  }
}

.conversations-list {
  flex: 1;
  min-height: 0;
}

.conversation-group {
  margin-bottom: 12px;

  .group-label {
    padding: 8px 16px 4px;
    font-size: 11px;
    color: var(--fg-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-standard);
  position: relative;
  border-left: 2px solid transparent;

  &:hover {
    background: var(--bg-hover);
  }

  &.active {
    background: var(--accent-soft);
    color: var(--accent-fg);
    border-left-color: var(--accent-base);
  }

  &.archived {
    opacity: 0.6;
  }

  .conversation-icon {
    flex-shrink: 0;
    font-size: 16px;
    line-height: 1;
  }

  .conversation-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }

  .more-icon {
    flex-shrink: 0;
    opacity: 0.4;
    transition: opacity var(--duration-fast) var(--ease-standard);
  }

  &:hover .more-icon {
    opacity: 1;
  }
}

.empty-hint {
  padding: 24px;
  text-align: center;
  color: var(--fg-tertiary);
  font-size: 12px;
}

.chat-sidebar-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: ew-resize;
  background: transparent;
  transition: background var(--duration-fast) var(--ease-standard);

  &:hover {
    background: var(--accent-base);
  }
}
</style>