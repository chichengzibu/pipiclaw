<template>
  <div class="file-preview-container">
    <div 
      v-for="(file, index) in files" 
      :key="index" 
      class="file-preview-item"
    >
      <div v-if="file.type === 'image'" class="image-preview">
        <img :src="file.url || `data:${file.mimeType};base64,${file.base64}`" :alt="file.name" />
      </div>
      <div v-else class="file-icon">
        <el-icon><Document /></el-icon>
      </div>
      <div class="file-info">
        <div class="file-name" :title="file.name">{{ file.name }}</div>
        <div class="file-size">{{ formatFileSize(file.size) }}</div>
      </div>
      <el-button 
        size="small" 
        text 
        class="delete-btn"
        @click="removeFile(index)"
      >
        <el-icon><Close /></el-icon>
      </el-button>
    </div>
    <el-button v-if="files.length > 0" size="small" text @click="clearAll">
      清空全部
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { Document, Close } from '@element-plus/icons-vue';

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: 'image' | 'document';
  mimeType: string;
  url?: string;
  base64?: string;
  path?: string;
  content?: string;
}

defineProps<{
  files: FileItem[];
}>();

const emit = defineEmits<{
  (e: 'remove', index: number): void;
  (e: 'clear'): void;
}>();

function removeFile(index: number): void {
  emit('remove', index);
}

function clearAll(): void {
  emit('clear');
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
</script>

<style lang="scss" scoped>
.file-preview-container {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px;
  background-color: var(--bg-color-secondary);
  border-radius: 8px;
  margin-bottom: 12px;
  align-items: center;
}

.file-preview-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  position: relative;
}

.image-preview {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.file-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 200px;
}

.file-name {
  font-size: 13px;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  font-size: 12px;
  color: var(--text-color-secondary);
}

.delete-btn {
  margin-left: 4px;
  color: var(--el-color-danger);
}
</style>