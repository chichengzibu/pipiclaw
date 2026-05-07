<template>
  <el-dialog
    v-model="visible"
    title="导入新技能"
    width="560px"
    :close-on-click-modal="false"
    @closed="handleClosed"
  >
    <el-tabs v-model="activeTab">
      <el-tab-pane label="从本地导入" name="file">
        <div class="upload-area">
          <!-- 简单的点击触发文件选择 -->
          <div class="upload-drop-zone" @click="openFileDialog">
            <el-icon class="upload-icon"><Upload /></el-icon>
            <div class="upload-text">
              点击选择文件
            </div>
            <div class="upload-tip">
              只支持 .md (Markdown) 格式的技能文件
            </div>
          </div>
          
          <div v-if="selectedFilePath" class="selected-file">
            <el-icon><Document /></el-icon>
            <span class="file-name">{{ selectedFilePath.split(/[\/\\]/).pop() }}</span>
            <el-button size="small" text @click="clearFile">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
        </div>
      </el-tab-pane>
      
      <el-tab-pane label="从 ClawHub 导入" name="url">
        <div class="url-area">
          <el-input
            v-model="skillUrl"
            placeholder="输入技能的名称或 URL"
            clearable
            size="large"
          >
            <template #prefix>
              <el-icon><Link /></el-icon>
            </template>
          </el-input>
          
          <div class="url-hint">
            <el-icon><InfoFilled /></el-icon>
            <span>从 ClawHub 社区导入分享的技能模板</span>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
    
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="importing"
          :disabled="!canImport"
          @click="handleImport"
        >
          导入
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Upload, Document, Close, Link, InfoFilled } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits(['update:modelValue', 'success']);

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const activeTab = ref('file');
const selectedFilePath = ref<string | null>(null);
const skillUrl = ref('');
const importing = ref(false);

const canImport = computed(() => {
  if (activeTab.value === 'file') {
    return selectedFilePath.value !== null;
  } else {
    return skillUrl.value.trim().length > 0;
  }
});

const openFileDialog = async () => {
  const dialogResult = await (window as any).electronAPI?.dialog?.openFile({
    filters: [{ name: 'Markdown', extensions: ['md'] }],
    properties: ['openFile']
  });
  
  if (dialogResult && !dialogResult.canceled && dialogResult.filePaths && dialogResult.filePaths.length > 0) {
    selectedFilePath.value = dialogResult.filePaths[0];
  }
};

const clearFile = () => {
  selectedFilePath.value = null;
};

const handleImport = async () => {
  if (!canImport.value) return;

  importing.value = true;
  
  try {
    let result: any;
    
    if (activeTab.value === 'file') {
      // 从文件导入
      if (selectedFilePath.value) {
        result = await (window as any).electronAPI?.skills?.importFile(selectedFilePath.value);
      } else {
        ElMessage.warning('请选择一个文件');
        return;
      }
    } else if (activeTab.value === 'url' && skillUrl.value) {
      // 从URL导入
      result = await (window as any).electronAPI?.skills?.importUrl(skillUrl.value);
    }
    
    if (result?.success) {
      ElMessage.success('技能导入成功');
      visible.value = false;
      
      // 如果返回了技能列表，通过 emit 传递
      if (result?.data) {
        emit('success', result.data);
      } else {
        emit('success');
      }
    } else {
      ElMessage.error(result?.error || '导入失败，请重试');
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '导入失败，请重试');
  } finally {
    importing.value = false;
  }
};

const handleClosed = () => {
  selectedFilePath.value = null;
  skillUrl.value = '';
  activeTab.value = 'file';
};
</script>

<style lang="scss" scoped>
.upload-area {
  padding: 8px 0;
}

.upload-drop-zone {
  border: 2px dashed var(--el-border-color-darker);
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    border-color: var(--el-color-primary);
    background-color: var(--el-fill-color-light);
  }
}

.upload-icon {
  font-size: 48px;
  color: var(--el-color-primary);
  margin-bottom: 16px;
}

.upload-text {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.upload-tip {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.selected-file {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.file-name {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.url-area {
  padding: 8px 0;
}

.url-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}

.url-hint .el-icon {
  color: var(--el-color-primary);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
