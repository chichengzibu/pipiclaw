<template>
  <div class="skills-page">
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">技能管理</h1>
        <p class="page-desc">管理和配置自动化技能模板</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="handleDeduplicate" :loading="loadingDeduplicate">
          <el-icon><MagicStick /></el-icon>
          智能去重
        </el-button>
        <el-button @click="showImportDialog = true">
          <el-icon><Upload /></el-icon>
          导入技能
        </el-button>
      </div>
    </div>
    
    <!-- 技能过多提示 -->
    <el-alert
      v-if="skills.length > 20"
      title="技能较多，建议使用智能去重优化"
      type="warning"
      :closable="true"
      style="margin-bottom: var(--space-md);"
    />
    
    <!-- 技能提案横幅 -->
    <div v-if="pendingProposal" class="proposal-banner">
      <div class="banner-content">
        <div class="banner-icon">✨</div>
        <div class="banner-text">
          <div class="banner-title">发现新的技能模式！</div>
          <div class="banner-desc">我分析了你的操作，自动生成了技能"{{ pendingProposal.name }}"</div>
          <div v-if="pendingProposal.triggerCondition" class="banner-condition">
            触发条件：{{ pendingProposal.triggerCondition }}
          </div>
        </div>
        <div class="banner-actions">
          <el-button type="primary" size="small" @click="handleAcceptProposal">保存技能</el-button>
          <el-button size="small" text @click="handleDismissProposal">忽略</el-button>
          <el-button size="small" text @click="showProposalDetail = true">查看详情</el-button>
        </div>
      </div>
    </div>
    
    <!-- 重启提示 -->
    <el-alert
      v-if="showNeedsRestartNotice"
      title="新技能已保存，重启应用后生效"
      type="warning"
      :closable="true"
      @close="showNeedsRestartNotice = false"
      style="margin-bottom: var(--space-lg);"
    />
    
    <div class="skills-content">
      <div v-if="skills.length > 0" class="skills-grid">
        <SkillCard
          v-for="skill in skills"
          :key="skill.id"
          :skill="skill"
          @toggle="handleToggleSkill"
        />
      </div>
      
      <div v-else class="empty-state">
        <div class="empty-icon">📦</div>
        <h3 class="empty-title">暂无技能</h3>
        <p class="empty-desc">
          从 skills/ 目录导入技能，或创建新的技能模板
        </p>
        <el-button type="primary" @click="showImportDialog = true">
          导入技能
        </el-button>
      </div>
    </div>
    
    <div v-if="skills.length > 0" class="page-footer">
      <div class="stats-bar">
        <span class="stat-item">
          已加载 <strong>{{ skills.length }}</strong> 个技能
        </span>
        <span class="stat-item">
          <strong>{{ enabledCount }}</strong> 个已启用
        </span>
      </div>
    </div>
    
    <SkillImportDialog
      v-model="showImportDialog"
      @success="handleImportSuccess"
    />
    
    <!-- 技能提案详情对话框 -->
    <el-dialog
      v-model="showProposalDetail"
      title="技能提案详情"
      width="600px"
    >
      <div v-if="pendingProposal" class="proposal-detail">
        <div class="detail-section">
          <div class="detail-label">技能名称</div>
          <div class="detail-value">{{ pendingProposal.name }}</div>
        </div>
        
        <div class="detail-section">
          <div class="detail-label">描述</div>
          <div class="detail-value">{{ pendingProposal.description }}</div>
        </div>
        
        <div class="detail-section">
          <div class="detail-label">触发条件（语义）</div>
          <div class="detail-value">{{ pendingProposal.triggerCondition || '-' }}</div>
        </div>
        
        <div class="detail-section">
          <div class="detail-label">关键词</div>
          <div class="detail-value">
            <el-tag
              v-for="keyword in pendingProposal.keywords"
              :key="keyword"
              size="small"
              style="margin-right: var(--space-sm); margin-bottom: var(--space-sm);"
            >
              {{ keyword }}
            </el-tag>
          </div>
        </div>
        
        <div class="detail-section">
          <div class="detail-label">操作步骤</div>
          <div class="detail-value">
            <div v-for="(step, index) in pendingProposal.operationSteps" :key="index" class="step-item">
              {{ index + 1 }}. {{ step }}
            </div>
          </div>
        </div>
        
        <div class="detail-section">
          <div class="detail-label">完整技能文档</div>
          <div class="detail-value">
            <el-input
              v-model="pendingProposal.fullInstructions"
              type="textarea"
              :rows="12"
              readonly
            />
          </div>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="showProposalDetail = false">关闭</el-button>
        <el-button type="primary" @click="handleAcceptProposal">保存技能</el-button>
      </template>
    </el-dialog>
    
    <!-- 技能合并候选对话框 -->
    <el-dialog
      v-model="showMergeDialog"
      title="智能去重 - 发现可合并的技能"
      width="700px"
    >
      <div v-if="mergeCandidates.length > 0" class="merge-candidates">
        <div v-for="(candidate, index) in mergeCandidates" :key="index" class="candidate-item">
          <div class="candidate-info">
            <div class="candidate-skill">
              <div class="skill-label">技能1</div>
              <div class="skill-name">{{ candidate.skillName1 }}</div>
            </div>
            <div class="candidate-divider">
              <el-tag type="warning">{{ candidate.similarity }}% 相似</el-tag>
            </div>
            <div class="candidate-skill">
              <div class="skill-label">技能2</div>
              <div class="skill-name">{{ candidate.skillName2 }}</div>
            </div>
          </div>
          <el-button
            type="primary"
            size="small"
            @click="handleMerge(candidate)"
            :loading="mergingIndex === index"
          >
            合并
          </el-button>
        </div>
      </div>
      <div v-else class="no-candidates">
        <div class="no-candidates-icon">✅</div>
        <p>没有发现可合并的技能，所有技能都是唯一的！</p>
      </div>
      
      <template #footer>
        <el-button @click="showMergeDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Upload, MagicStick } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import SkillCard from '@/components/skills/SkillCard.vue';
import SkillImportDialog from '@/components/skills/SkillImportDialog.vue';

interface Skill {
  id: string;
  name: string;
  description: string;
  triggerKeywords: string[];
  enabled: boolean;
  usageCount: number;
  successRate: number;
}

interface SkillProposal {
  id: string;
  name: string;
  description: string;
  triggerCondition: string;
  keywords: string[];
  operationSteps: string[];
  fullInstructions: string;
  createdAt: number;
}

const skills = ref<Skill[]>([]);
const showImportDialog = ref(false);
const pendingProposal = ref<SkillProposal | null>(null);
const showProposalDetail = ref(false);
const showNeedsRestartNotice = ref(false);
const showMergeDialog = ref(false);
const mergeCandidates = ref<any[]>([]);
const loadingDeduplicate = ref(false);
const mergingIndex = ref<number | null>(null);

const enabledCount = computed(() => {
  return skills.value.filter(s => s.enabled).length;
});

const loadSkills = async () => {
  try {
    const result = await (window as any).electronAPI?.skills?.list();
    if (result?.success && result?.data) {
      skills.value = result.data;
    }
  } catch (error) {
    console.error('加载技能失败', error);
  }
};

const handleToggleSkill = async (skillId: string, enabled: boolean) => {
  const skill = skills.value.find(s => s.id === skillId);
  if (skill) {
    skill.enabled = enabled;
    try {
      await (window as any).electronAPI?.skills?.toggle(skillId, enabled);
    } catch (error) {
      console.error('更新技能状态失败', error);
    }
  }
};

const handleImportSuccess = (data?: any[]) => {
  if (data) {
    skills.value = data;
  } else {
    loadSkills();
  }
};

const handleNewProposal = (proposal: SkillProposal) => {
  pendingProposal.value = proposal;
};

const handleAcceptProposal = async () => {
  if (!pendingProposal.value) return;
  
  try {
    const result = await (window as any).electronAPI?.learning?.saveSkillProposal(pendingProposal.value);
    if (result?.success) {
      if (result?.data?.needsRestart) {
        showNeedsRestartNotice.value = true;
      }
      loadSkills();
      pendingProposal.value = null;
      showProposalDetail.value = false;
    }
  } catch (error) {
    console.error('接受技能提案失败', error);
  }
};

const handleDismissProposal = async () => {
  try {
    await (window as any).electronAPI?.learning?.clearPendingProposal();
    pendingProposal.value = null;
    showProposalDetail.value = false;
  } catch (error) {
    pendingProposal.value = null;
    showProposalDetail.value = false;
  }
};

const handleDeduplicate = async () => {
  loadingDeduplicate.value = true;
  try {
    const result = await (window as any).electronAPI?.skills?.mergeCandidates();
    if (result?.success) {
      mergeCandidates.value = result.data || [];
      showMergeDialog.value = true;
      if (mergeCandidates.value.length === 0) {
        ElMessage.success('没有发现可合并的技能');
      }
    } else {
      ElMessage.error(result?.error || '获取合并候选失败');
    }
  } catch (error) {
    ElMessage.error('获取合并候选失败');
  } finally {
    loadingDeduplicate.value = false;
  }
};

const handleMerge = async (candidate: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要合并技能"${candidate.skillName1}"和"${candidate.skillName2}"吗？`,
      '合并确认',
      {
        confirmButtonText: '确定合并',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
    
    mergingIndex.value = mergeCandidates.value.indexOf(candidate);
    
    const result = await (window as any).electronAPI?.skills?.performMerge(
      candidate.skillId1,
      candidate.skillId2
    );
    
    if (result?.success) {
      ElMessage.success('技能合并成功！');
      mergeCandidates.value = mergeCandidates.value.filter(c => c !== candidate);
      loadSkills();
    } else {
      ElMessage.error(result?.error || '合并失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('合并失败');
    }
  } finally {
    mergingIndex.value = null;
  }
};

onMounted(() => {
  loadSkills();
  
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;
    if (ipcRenderer) {
      ipcRenderer.on('skills:new-proposal', (_event: any, proposal: SkillProposal) => {
        handleNewProposal(proposal);
      });
    }
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;
    if (ipcRenderer) {
      ipcRenderer.removeAllListeners('skills:new-proposal');
    }
  }
});
</script>

<style lang="scss" scoped>
.skills-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  box-sizing: border-box;
  overflow: hidden;
  background: var(--bg-secondary);
  color: var(--fg-primary);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.page-title {
  font-size: var(--font-size-display);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary) !important;
  margin: 0;
}

.page-desc {
  font-size: var(--font-size-body);
  color: var(--text-secondary);
  margin: 0;
}

.proposal-banner {
  background: linear-gradient(135deg, var(--el-color-primary-light-9) 0%, var(--el-color-primary-light-8) 100%);
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: var(--radius-lg);
  padding: var(--space-md) var(--space-lg);
  flex-shrink: 0;
}

.banner-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
}

.banner-icon {
  font-size: var(--space-xl);
  flex-shrink: 0;
}

.banner-text {
  flex: 1;
  min-width: 0;
}

.banner-title {
  font-size: var(--font-size-title-2);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-xs);
}

.banner-desc {
  font-size: var(--font-size-body);
  color: var(--text-secondary);
  margin-bottom: var(--space-sm);
}

.banner-condition {
  font-size: var(--font-size-callout);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  display: inline-block;
}

.banner-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  align-items: flex-end;
}

.skills-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: var(--space-lg);
}

.empty-state {
  text-align: center;
  padding: var(--space-3xl) var(--space-lg);
}

.empty-icon {
  font-size: var(--space-3xl);
  margin-bottom: var(--space-md);
}

.empty-title {
  font-size: var(--font-size-title-1);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-sm) 0;
}

.empty-desc {
  font-size: var(--font-size-body);
  color: var(--text-secondary);
  margin: 0 0 var(--space-lg) 0;
}

.page-footer {
  flex-shrink: 0;
  padding-top: var(--space-md);
  border-top: 1px solid var(--border-color);
}

.stats-bar {
  display: flex;
  gap: var(--space-lg);
}

.stat-item {
  font-size: var(--font-size-body);
  color: var(--text-secondary);
}

.stat-item strong {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
}

.proposal-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.detail-label {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.detail-value {
  font-size: var(--font-size-body);
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.step-item {
  padding: var(--space-sm) var(--space-sm);
  background: var(--el-fill-color-light);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-sm);
}

.merge-candidates {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.candidate-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md);
  background: var(--el-fill-color-lighter);
  border-radius: var(--radius-lg);
  border: 1px solid var(--el-border-color);
}

.candidate-info {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  flex: 1;
}

.candidate-skill {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.skill-label {
  font-size: var(--font-size-caption-1);
  color: var(--text-secondary);
}

.skill-name {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.candidate-divider {
  display: flex;
  align-items: center;
  justify-content: center;
}

.no-candidates {
  text-align: center;
  padding: var(--space-2xl) var(--space-lg);
}

.no-candidates-icon {
  font-size: var(--space-3xl);
  margin-bottom: var(--space-md);
}
</style>
