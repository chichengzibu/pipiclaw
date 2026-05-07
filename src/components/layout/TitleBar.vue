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
        class="control-btn minimize" 
        @click="handleMinimize"
        title="最小化"
      >
        <el-icon><Minus /></el-icon>
      </button>
      
      <button 
        class="control-btn maximize" 
        @click="handleMaximize"
        :title="isMaximized ? '还原' : '最大化'"
      >
        <el-icon v-if="isMaximized"><CopyDocument /></el-icon>
        <el-icon v-else><FullScreen /></el-icon>
      </button>
      
      <button 
        class="control-btn close" 
        @click="handleClose"
        title="关闭"
      >
        <el-icon><Close /></el-icon>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Minus, FullScreen, Close, CopyDocument, Setting } from '@element-plus/icons-vue';

const isMaximized = ref(false);

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
  background-color: var(--bg-color);
  border-bottom: 1px solid var(--border-color);
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
  color: var(--el-color-primary) !important;
}

.app-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color) !important;
}

.window-controls {
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: no-drag;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-color) !important;
  cursor: pointer;
  transition: background-color 0.15s;

  .el-icon {
    color: var(--text-color) !important;
  }
}

.control-btn:hover {
  background-color: var(--hover-bg-color);
  
  .el-icon {
    color: var(--text-color) !important;
  }
}

.control-btn:active {
  background-color: var(--active-bg-color);
}

.control-btn.close:hover {
  background-color: var(--el-color-danger);
  
  .el-icon {
    color: white !important;
  }
}

.control-btn .el-icon {
  font-size: 14px;
  color: var(--text-color) !important;
}
</style>
