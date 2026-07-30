<template>
  <div class="skill-card" :class="{ disabled: !skill.enabled }">
    <div class="skill-icon" :style="{ backgroundColor: iconColor }">
      <el-icon class="icon-emoji" :size="28" color="#fff"><Box /></el-icon>
    </div>
    
    <div class="skill-content">
      <div class="skill-header">
        <h3 class="skill-name">{{ skill.name }}</h3>
        <el-switch
          v-model="isEnabled"
          size="small"
          @change="handleToggle"
        />
      </div>
      
      <p class="skill-description">{{ skill.description }}</p>
      
      <div class="skill-keywords">
        <el-tag
          v-for="keyword in skill.triggerKeywords"
          :key="keyword"
          size="small"
          type="info"
        >
          {{ keyword }}
        </el-tag>
      </div>
      
      <div class="skill-stats">
        <span class="stat-item">
          <el-icon><View /></el-icon>
          {{ skill.usageCount }} 次使用
        </span>
        <span class="stat-item">
          <el-icon><CircleCheck /></el-icon>
          {{ skill.successRate }}% 成功率
        </span>
        <span class="stat-item" v-if="skill.fileSize !== undefined">
          <el-icon><Document /></el-icon>
          {{ formatFileSize(skill.fileSize) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { View, CircleCheck, Document, Box } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

interface SkillProps {
  skill: {
    id: string;
    name: string;
    description: string;
    triggerKeywords: string[];
    enabled: boolean;
    usageCount: number;
    successRate: number;
    fileSize?: number;
  };
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const props = defineProps<SkillProps>();
const emit = defineEmits(['toggle']);

const isEnabled = ref(props.skill.enabled);

const iconColors = [
  '#F59E0B', // 暖橙色
  '#3B82F6', // 蓝色
  '#10B981', // 绿色
  '#8B5CF6', // 紫色
  '#EC4899'  // 粉色
];

const iconColor = computed(() => {
  // 根据技能ID选择颜色
  const index = props.skill.id.length % iconColors.length;
  return iconColors[index];
});

const handleToggle = (value: boolean) => {
  isEnabled.value = value;
  emit('toggle', props.skill.id, value);
  ElMessage.success(value ? '技能已启用' : '技能已禁用');
};
</script>

<style lang="scss" scoped>
.skill-card {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);

  &:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  &.disabled {
    opacity: 0.5;
    filter: grayscale(0.5);
  }
}

.skill-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-emoji {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.skill-content {
  flex: 1;
  min-width: 0;
}

.skill-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.skill-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.skill-description {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 12px 0;
  line-height: 1.6;
}

.skill-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.skill-stats {
  display: flex;
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}

.stat-item .el-icon {
  font-size: 14px;
}
</style>
