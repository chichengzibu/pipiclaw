<template>
  <div class="skill-market-page">
    <div class="page-header">
      <h1 class="page-title">技能市场</h1>
      <Breadcrumb />
    </div>
    
    <div class="market-content">
      <el-alert type="info" :closable="false" class="market-alert">
        一键执行现成的自动化任务模板，无需重复写指令，零门槛上手，也可以沉淀自己的专属技能
      </el-alert>
      <el-tabs v-model="activeTab" class="skill-tabs">
        <el-tab-pane label="我的技能" name="my">
          <div class="skill-grid">
            <div 
              v-for="skill in skillStore.mySkills" 
              :key="skill.id"
              class="skill-card"
            >
              <div class="skill-header">
                <div class="skill-name">{{ skill.name }}</div>
                <el-tag :type="skill.enabled ? 'success' : 'info'" size="small">
                  {{ skill.enabled ? '已启用' : '已禁用' }}
                </el-tag>
              </div>
              <div class="skill-desc">{{ skill.description }}</div>
              <div class="skill-meta">
                <span class="meta-item">
                  <el-icon><Document /></el-icon>
                  {{ skill.category }}
                </span>
                <span class="meta-item">
                  <el-icon><View /></el-icon>
                  {{ skill.usageCount }} 次
                </span>
                <span class="meta-item">
                  <el-icon><CircleCheck /></el-icon>
                  {{ skill.successRate }}%
                </span>
              </div>
              <div class="skill-actions">
                <el-button size="small" @click="executeSkill(skill)">
                  一键执行
                </el-button>
                <el-button size="small" text>
                  <el-icon><Edit /></el-icon>
                </el-button>
                <el-button size="small" text type="danger">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="推荐模板" name="preset">
          <div class="skill-grid">
            <div 
              v-for="skill in skillStore.presetSkills" 
              :key="skill.id"
              class="skill-card"
            >
              <div class="skill-header">
                <div class="skill-name">{{ skill.name }}</div>
              </div>
              <div class="skill-desc">{{ skill.description }}</div>
              <div class="skill-meta">
                <span class="meta-item">
                  <el-icon><Document /></el-icon>
                  {{ skill.category }}
                </span>
              </div>
              <div class="skill-actions">
                <el-button size="small" type="primary">
                  安装
                </el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
    
    <!-- 执行弹窗 -->
    <el-dialog v-model="showExecuteModal" title="执行技能" width="500px">
      <div v-if="selectedSkill" class="execute-content">
        <div class="execute-skill-name">{{ selectedSkill.name }}</div>
        <el-form :model="executeParams" label-width="100px">
          <el-form-item 
            v-for="param in selectedSkill.parameters" 
            :key="param.id"
            :label="param.name"
          >
            <el-input 
              v-if="param.type === 'string'" 
              v-model="executeParams[param.id]" 
              :placeholder="param.description"
            />
            <el-input-number 
              v-else-if="param.type === 'number'" 
              v-model="executeParams[param.id]" 
            />
            <el-switch 
              v-else-if="param.type === 'boolean'" 
              v-model="executeParams[param.id]" 
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="showExecuteModal = false">取消</el-button>
        <el-button type="primary" @click="handleExecute">执行</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Upload, Document, View, CircleCheck, Edit, Delete } from '@element-plus/icons-vue';
import Breadcrumb from '@/components/layout/Breadcrumb.vue';
import { useSkillStore, type Skill } from '@/stores/skill';

const skillStore = useSkillStore();

const activeTab = ref<'my' | 'preset'>('my');
const showExecuteModal = ref(false);
const selectedSkill = ref<Skill | null>(null);
const executeParams = reactive<Record<string, any>>({});

function executeSkill(skill: Skill): void {
  selectedSkill.value = skill;
  Object.keys(executeParams).forEach(key => delete executeParams[key]);
  skill.parameters.forEach(param => {
    executeParams[param.id] = param.defaultValue;
  });
  showExecuteModal.value = true;
}

function handleExecute(): void {
  ElMessage.success('技能执行中...');
  showExecuteModal.value = false;
}

onMounted(() => {
  // 初始化技能数据
  skillStore.setSkills([]);
});
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.skill-market-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: $content-padding;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.market-alert {
  margin-bottom: $content-padding;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.market-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.skill-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  
  :deep(.el-tabs__content) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
}

.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  padding: 8px 0;
}

.skill-card {
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.2s;
  
  &:hover {
    border-color: var(--el-color-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
}

.skill-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.skill-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.skill-desc {
  font-size: 13px;
  color: var(--text-color-secondary);
  line-height: 1.5;
}

.skill-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-color-secondary);
  
  .meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.skill-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}

.execute-content {
  .execute-skill-name {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color);
    margin-bottom: 20px;
  }
}
</style>