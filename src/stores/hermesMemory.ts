/**
 * PiPiClaw - Hermes 记忆状态管理
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface MemoryItem {
  id: string;
  type: 'core' | 'experience' | 'conversation';
  content: string;
  timestamp: number;
  tags?: string[];
  importance?: number;
}

export const useHermesMemoryStore = defineStore('hermesMemory', () => {
  const coreMemory = ref('');
  const experienceMemory = ref('');
  const memories = ref<MemoryItem[]>([]);
  const showMemoryDialog = ref(false);
  const showMemoryPanel = ref(false);
  const showMemoryDrawer = ref(false); // 新增：记忆管理抽屉
  const memoryEnabled = ref(true);
  const currentInjectedMemory = ref('');
  const currentConversationMemory = ref(''); // 新增：本次对话注入的记忆
  const editingCoreMemory = ref(''); // 新增：编辑中的核心记忆

  const hasMemory = computed(() => {
    return coreMemory.value.trim().length > 0 || 
           experienceMemory.value.trim().length > 0 || 
           memories.value.length > 0;
  });

  const buttonText = computed(() => {
    return memoryEnabled.value ? '记忆 已启用' : '记忆 未启用';
  });

  function setCoreMemory(content: string): void {
    coreMemory.value = content;
  }

  function setExperienceMemory(content: string): void {
    experienceMemory.value = content;
  }

  function setMemories(newMemories: MemoryItem[]): void {
    memories.value = newMemories;
  }

  function openMemoryDialog(): void {
    showMemoryDialog.value = true;
  }

  function closeMemoryDialog(): void {
    showMemoryDialog.value = false;
  }

  function toggleMemoryPanel(): void {
    showMemoryPanel.value = !showMemoryPanel.value;
  }

  // 新增：记忆抽屉相关方法
  function openMemoryDrawer(): void {
    editingCoreMemory.value = coreMemory.value;
    showMemoryDrawer.value = true;
  }

  function closeMemoryDrawer(): void {
    showMemoryDrawer.value = false;
  }

  function toggleMemoryDrawer(): void {
    if (showMemoryDrawer.value) {
      closeMemoryDrawer();
    } else {
      openMemoryDrawer();
    }
  }

  function toggleMemoryEnabled(): void {
    memoryEnabled.value = !memoryEnabled.value;
  }

  function setCurrentInjectedMemory(content: string): void {
    currentInjectedMemory.value = content;
  }

  function setCurrentConversationMemory(content: string): void {
    currentConversationMemory.value = content;
  }

  // 生成本次对话注入的记忆内容
  function generateInjectedMemory(): string {
    if (!memoryEnabled.value) return '';
    
    let memoryContent = '';
    
    if (coreMemory.value.trim()) {
      memoryContent += '【核心记忆】\n' + coreMemory.value + '\n\n';
    }
    
    if (experienceMemory.value.trim()) {
      memoryContent += '【经验记忆】\n' + experienceMemory.value + '\n\n';
    }
    
    if (memories.value.length > 0) {
      memoryContent += '【对话记忆】\n';
      memories.value.slice(-5).forEach(mem => {
        memoryContent += `${new Date(mem.timestamp).toLocaleString()}: ${mem.content}\n`;
      });
    }
    
    return memoryContent.trim();
  }

  async function fetchMemories(): Promise<void> {
    try {
      const result = await (window as any).electronAPI?.hermes?.getMemories();
      if (result?.success) {
        coreMemory.value = result.data.coreMemory || '';
        experienceMemory.value = result.data.experienceMemory || '';
        memories.value = result.data.memories || [];
        editingCoreMemory.value = result.data.coreMemory || '';
      }
    } catch (err) {
      console.error('[HermesMemory] 获取记忆失败:', err);
    }
  }

  async function saveCoreMemory(content: string): Promise<void> {
    try {
      const result = await (window as any).electronAPI?.hermes?.saveCoreMemory(content);
      if (result?.success) {
        coreMemory.value = content;
        editingCoreMemory.value = content;
      }
    } catch (err) {
      console.error('[HermesMemory] 保存核心记忆失败:', err);
    }
  }

  // 新增：实时保存编辑中的核心记忆
  async function updateCoreMemory(content: string): Promise<void> {
    editingCoreMemory.value = content;
    await saveCoreMemory(content);
  }

  return {
    coreMemory,
    experienceMemory,
    memories,
    showMemoryDialog,
    showMemoryPanel,
    showMemoryDrawer,
    memoryEnabled,
    currentInjectedMemory,
    currentConversationMemory,
    editingCoreMemory,
    hasMemory,
    buttonText,
    setCoreMemory,
    setExperienceMemory,
    setMemories,
    openMemoryDialog,
    closeMemoryDialog,
    toggleMemoryPanel,
    toggleMemoryDrawer,
    openMemoryDrawer,
    closeMemoryDrawer,
    toggleMemoryEnabled,
    setCurrentInjectedMemory,
    setCurrentConversationMemory,
    generateInjectedMemory,
    fetchMemories,
    saveCoreMemory,
    updateCoreMemory
  };
});