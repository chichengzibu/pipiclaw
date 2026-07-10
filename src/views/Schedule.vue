<template>
  <div class="schedule-page">
    <div class="page-header">
      <h1 class="page-title">定时任务</h1>
      <Breadcrumb />
      <div class="header-actions">
        <el-button @click="importFromSkillMarket">
          <el-icon><MagicStick /></el-icon>
          从技能市场导入
        </el-button>
        <el-button type="primary" @click="scheduleStore.openCreateDialog">
          <el-icon><Plus /></el-icon>
          新建任务
        </el-button>
      </div>
    </div>
    
    <el-alert type="info" :closable="false" class="schedule-alert">
      设置按周期自动执行的自动化任务，实现无人值守的重复操作，比如每日报表生成、定时文件备份
    </el-alert>
    
    <el-card class="tasks-card">
      <el-table :data="scheduleStore.tasks" style="width: 100%">
        <el-table-column prop="name" label="任务名称" min-width="200" />
        <el-table-column prop="instruction" label="任务描述" min-width="300" show-overflow-tooltip />
        <el-table-column label="执行周期" min-width="150">
          <template #default="{ row }">
            <el-tag size="small">{{ getScheduleTypeText(row.scheduleType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
              {{ row.enabled ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text @click="toggleTask(row)">
              {{ row.enabled ? '禁用' : '启用' }}
            </el-button>
            <el-button size="small" text @click="scheduleStore.openEditDialog(row)">
              编辑
            </el-button>
            <el-button size="small" text type="danger" @click="deleteTask(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <!-- 执行历史 -->
    <el-card class="history-card">
      <template #header>
        <span>执行历史</span>
      </template>
      <el-table :data="scheduleStore.history" style="width: 100%">
        <el-table-column prop="taskName" label="任务名称" min-width="180" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : row.status === 'failed' ? 'danger' : 'info'" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="执行时间" width="180">
          <template #default="{ row }">
            {{ row.startTime ? formatTime(row.startTime) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="耗时" width="100">
          <template #default="{ row }">
            {{ row.duration ? `${row.duration}ms` : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button v-if="row.status === 'failed'" size="small" text>
              重试
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <!-- 新建/编辑任务弹窗 -->
    <el-dialog 
      v-model="scheduleStore.showCreateDialog" 
      :title="scheduleStore.editingTask ? '编辑任务' : '新建任务'" 
      width="600px"
    >
      <el-form :model="formData" label-width="100px">
        <el-form-item label="任务名称">
          <el-input v-model="formData.name" placeholder="请输入任务名称" />
        </el-form-item>
        <el-form-item label="任务描述">
          <el-input 
            v-model="formData.description" 
            type="textarea" 
            :rows="3"
            placeholder="请输入任务描述" 
          />
        </el-form-item>
        <el-form-item label="执行指令">
          <el-input 
            v-model="formData.instruction" 
            type="textarea" 
            :rows="4"
            placeholder="请输入要执行的指令" 
          />
        </el-form-item>
        <el-form-item label="执行周期">
          <el-radio-group v-model="formData.scheduleType">
            <el-radio label="once">单次</el-radio>
            <el-radio label="daily">每天</el-radio>
            <el-radio label="weekly">每周</el-radio>
            <el-radio label="monthly">每月</el-radio>
            <el-radio label="cron">Cron</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Cron表达式" v-if="formData.scheduleType === 'cron'">
          <CronPicker v-model="formData.scheduleValue" />
        </el-form-item>
        <el-form-item label="重试次数">
          <el-input-number v-model="formData.maxRetries" :min="0" :max="10" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scheduleStore.closeDialog">取消</el-button>
        <el-button type="primary" @click="saveTask">
          {{ scheduleStore.editingTask ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, MagicStick } from '@element-plus/icons-vue';
import Breadcrumb from '@/components/layout/Breadcrumb.vue';
import CronPicker from '@/components/schedule/CronPicker.vue';
import { useScheduleStore, type ScheduleTask } from '@/stores/schedule';

const scheduleStore = useScheduleStore();

const formData = reactive({
  name: '',
  description: '',
  instruction: '',
  scheduleType: 'daily' as const,
  scheduleValue: '',
  maxRetries: 3
});

function resetForm(): void {
  Object.assign(formData, {
    name: '',
    description: '',
    instruction: '',
    scheduleType: 'daily' as const,
    scheduleValue: '',
    maxRetries: 3
  });
}

function getScheduleTypeText(type: string): string {
  const map: Record<string, string> = {
    once: '单次',
    daily: '每天',
    weekly: '每周',
    monthly: '每月',
    cron: 'Cron'
  };
  return map[type] || type;
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    pending: '待执行',
    running: '执行中',
    success: '成功',
    failed: '失败'
  };
  return map[status] || status;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}

async function toggleTask(task: ScheduleTask): Promise<void> {
  ElMessage.success(task.enabled ? '任务已禁用' : '任务已启用');
}

async function deleteTask(task: ScheduleTask): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定要删除任务「${task.name}」吗？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    });
    ElMessage.success('任务已删除');
  } catch {}
}

function importFromSkillMarket(): void {
  ElMessage.info('从技能市场导入功能开发中...');
}

function saveTask(): void {
  if (!formData.name || !formData.instruction) {
    ElMessage.warning('请填写任务名称和执行指令');
    return;
  }
  ElMessage.success(scheduleStore.editingTask ? '任务已更新' : '任务已创建');
  scheduleStore.closeDialog();
  resetForm();
}

onMounted(() => {
  // 模拟初始化数据
  scheduleStore.setTasks([
    {
      id: '1',
      name: '每日报告生成',
      description: '每天早上9点生成昨日工作报告',
      instruction: '请生成昨日的工作报告',
      scheduleType: 'daily',
      scheduleValue: '0 9 * * *',
      enabled: true,
      maxRetries: 3,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ]);
  scheduleStore.setHistory([]);
});

watch(() => scheduleStore.editingTask, (task) => {
  if (task) {
    Object.assign(formData, {
      name: task.name,
      description: task.description || '',
      instruction: task.instruction,
      scheduleType: task.scheduleType,
      scheduleValue: task.scheduleValue,
      maxRetries: task.maxRetries
    });
  } else {
    resetForm();
  }
}, { immediate: true });
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.schedule-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--content-padding);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  gap: var(--space-md);
}

.schedule-alert {
  flex-shrink: 0;
}

.page-title {
  font-size: var(--font-size-title-1);
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
  margin: 0;
}

.tasks-card,
.history-card {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  :deep(.el-card__body) {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
}
</style>