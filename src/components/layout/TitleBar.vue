<template>
  <div class="title-bar">
    <div class="title-bar-drag">
      <div class="app-title">
        <el-icon class="app-icon"><Setting /></el-icon>
        <span class="app-name">PiPiClaw</span>
      </div>
    </div>

    <div class="window-controls">
      <button
        class="control-btn theme-toggle"
        @click="handleToggleTheme"
        :title="isDark ? '切换到浅色' : '切换到深色'"
        :aria-label="isDark ? '切换到浅色' : '切换到深色'"
      >
        <el-icon v-if="isDark"><Sunny /></el-icon>
        <el-icon v-else><Moon /></el-icon>
      </button>

      <button
        class="control-btn minimize"
        @click="handleMinimize"
        title="最小化"
        aria-label="最小化"
      >
        <el-icon><Minus /></el-icon>
      </button>

      <button
        class="control-btn maximize"
        @click="handleMaximize"
        :title="isMaximized ? '还原' : '最大化'"
        :aria-label="isMaximized ? '还原' : '最大化'"
      >
        <!-- 还原:两个嵌套方块 (Windows 标准 restore-down 图标) -->
        <svg
          v-if="isMaximized"
          class="control-svg"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="5.5" y="5.5" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.2" fill="none" />
          <path d="M2.5 10.5V3.5C2.5 2.95 2.95 2.5 3.5 2.5H10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" />
        </svg>
        <el-icon v-else><FullScreen /></el-icon>
      </button>

      <button
        class="control-btn close"
        @click="handleClose"
        title="关闭"
        aria-label="关闭"
      >
        <el-icon><Close /></el-icon>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Minus, FullScreen, Close, Setting, Sunny, Moon } from '@element-plus/icons-vue';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();
const isMaximized = ref(false);

const isDark = computed(() => appStore.currentTheme === 'dark');

const handleToggleTheme = (): void => {
  appStore.toggleTheme();
};

const handleMinimize = async (): Promise<void> => {
  try {
    if (window.electronAPI?.window) {
      await window.electronAPI.window.minimize();
    }
  } catch (error) {
    console.error('最小化失败:', error);
  }
};

const handleMaximize = async (): Promise<void> => {
  try {
    if (window.electronAPI?.window) {
      await window.electronAPI.window.maximize();
    }
  } catch (error) {
    console.error('最大化失败:', error);
  }
};

const handleClose = async (): Promise<void> => {
  try {
    if (window.electronAPI?.window) {
      await window.electronAPI.window.close();
    }
  } catch (error) {
    console.error('关闭失败:', error);
  }
};

let unsubscribe: (() => void) | undefined;

onMounted(async () => {
  try {
    if (window.electronAPI?.window) {
      isMaximized.value = await window.electronAPI.window.isMaximized();
      unsubscribe = window.electronAPI.window.onMaximizeChange((maximized) => {
        isMaximized.value = maximized;
      });
    }
  } catch (error) {
    console.error('初始化最大化状态失败:', error);
  }
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: $title-bar-height;
  flex-shrink: 0;
  background: var(--bg-base);
  border-bottom: 1px solid var(--border-base);
  -webkit-app-region: drag;
  user-select: none;
}

.title-bar-drag {
  flex: 1;
  display: flex;
  align-items: center;
  height: 100%;
  padding-left: 12px;
}

.app-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-icon {
  font-size: 16px;
  color: var(--accent-base);
}

.app-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-primary);
}

.window-controls {
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: no-drag;
  border-left: 1px solid var(--border-base);
  margin-left: 8px;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--fg-secondary);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);

  .el-icon {
    font-size: 16px;
  }

  // 自定义 inline SVG(还原图标)尺寸
  .control-svg {
    width: 16px;
    height: 16px;
  }
}

.control-btn:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}

.control-btn:active {
  background: var(--bg-active);
}

// 关闭按钮:静止时就有 danger 软底,提示"危险操作"
.control-btn.close {
  color: var(--fg-secondary);

  &:hover {
    background: var(--danger);
    color: var(--fg-on-accent);
  }
}

.control-btn.theme-toggle {
  width: 40px;
  border-right: 1px solid var(--border-base);
  margin-right: 4px;

  .el-icon {
    font-size: 16px;
  }
}
</style>
