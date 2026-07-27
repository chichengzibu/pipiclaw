<template>
  <el-dialog 
    v-model="visible" 
    title="欢迎使用 PiPiClaw" 
    width="600px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    class="first-launch-guide"
  >
    <div class="guide-content">
      <el-steps :active="currentStep" finish-status="success" align-center>
        <el-step title="欢迎" />
        <el-step title="模型配置" />
        <el-step title="权限设置" />
        <el-step title="完成" />
      </el-steps>

      <div class="step-content">
        <!-- 步骤1: 欢迎 -->
        <div v-if="currentStep === 0" class="step-welcome">
          <div class="welcome-icon">🤖</div>
          <h2>欢迎使用 PiPiClaw</h2>
          <p class="welcome-desc">
            您的桌面AI自动化助手<br />
            支持对话、任务执行、文档处理等多种能力
          </p>
        </div>

        <!-- 步骤2: 模型配置 -->
        <div v-if="currentStep === 1" class="step-models">
          <h3>快速配置模型</h3>
          <p class="step-tip">选择您常用的模型提供商，我们提供常用配置的一键添加功能。</p>
          
          <div class="model-options">
            <el-card class="model-option" shadow="hover" @click="handleSelectModel('ollama')">
              <div class="model-icon">🦙</div>
              <div class="model-name">Ollama</div>
              <div class="model-desc">本地运行，完全免费</div>
            </el-card>
            
            <el-card class="model-option" shadow="hover" @click="handleSelectModel('deepseek')">
              <div class="model-icon">🔍</div>
              <div class="model-name">DeepSeek</div>
              <div class="model-desc">国产优秀大模型</div>
            </el-card>
            
            <el-card class="model-option" shadow="hover" @click="handleSelectModel('custom')">
              <div class="model-icon">⚙️</div>
              <div class="model-name">自定义配置</div>
              <div class="model-desc">手动添加任何模型</div>
            </el-card>
          </div>
        </div>

        <!-- 步骤3: 权限设置 -->
        <div v-if="currentStep === 2" class="step-permissions">
          <h3>配置操作权限</h3>
          <p class="step-tip">选择您的常用权限模板，也可以后续在「权限管理」中详细配置。</p>
          
          <div class="permission-options">
            <el-radio-group v-model="selectedPermission" direction="vertical">
              <el-radio value="safe">
                <div class="permission-option">
                  <div class="permission-name">🔒 安全模式</div>
                  <div class="permission-desc">仅查看，无任何操作权限</div>
                </div>
              </el-radio>
              
              <el-radio value="standard">
                <div class="permission-option">
                  <div class="permission-name">🛠️ 标准模式</div>
                  <div class="permission-desc">文件读取、系统查询等基础权限</div>
                </div>
              </el-radio>
              
              <el-radio value="permissive">
                <div class="permission-option">
                  <div class="permission-name">🚀 全量模式</div>
                  <div class="permission-desc">完整权限，可执行所有操作</div>
                </div>
              </el-radio>
            </el-radio-group>
          </div>
        </div>

        <!-- 步骤4: 完成 -->
        <div v-if="currentStep === 3" class="step-finish">
          <div class="finish-icon">🎉</div>
          <h2>配置完成！</h2>
          <p class="finish-desc">
            您已完成基础配置<br />
            现在可以开始使用 PiPiClaw 了！
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="guide-footer">
        <el-button v-if="currentStep > 0" @click="prevStep">上一步</el-button>
        <el-button v-if="currentStep < 3 && currentStep !== 1" type="primary" @click="nextStepWithTracking">
          {{ currentStep === 2 ? '完成配置' : '下一步' }}
        </el-button>
        <el-button v-if="currentStep === 3" type="primary" @click="handleFinish">
          开始使用
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAppStore } from '@/stores/app';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const appStore = useAppStore();
const router = useRouter();

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const currentStep = ref(0);
const selectedPermission = ref('standard');

function prevStep(): void {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
}

function nextStep(): void {
  if (currentStep.value < 3) {
    currentStep.value++;
  }
}

function handleSelectModel(type: string): void {
  ElMessage.info(`已选择 ${type === 'ollama' ? 'Ollama' : type === 'deepseek' ? 'DeepSeek' : '自定义'}，请在模型管理中完成详细配置`);
  nextStep();
}

async function handleFinish(): Promise<void> {
  try {
    appStore.markFirstLaunchComplete();
    // P2-T4.1: 跟踪完成率 (本地存储, 用于产品分析)
    trackCompletion();
    visible.value = false;
    await router.push('/chat');
    ElMessage.success('欢迎使用 PiPiClaw！');
  } catch (error) {
    console.error('路由跳转失败:', error);
    ElMessage.error('跳转失败，请手动访问对话页面');
  }
}

/** P2-T4.1: 步骤级埋点 + 完成率 */
function nextStepWithTracking(): void {
  trackStep(`step_${currentStep.value}_completed`)
  nextStep()
}

function trackStep(stepName: string): void {
  try {
    const key = 'pipiclaw_onboarding_events'
    const raw = localStorage.getItem(key)
    const events: Array<{ step: string; ts: number }> = raw ? JSON.parse(raw) : []
    events.push({ step: stepName, ts: Date.now() })
    // 最多保留最近 100 条
    if (events.length > 100) events.shift()
    localStorage.setItem(key, JSON.stringify(events))
  } catch {
    // localStorage 不可用 (e.g. SSR / sandbox), 静默忽略
  }
}

function trackCompletion(): void {
  trackStep('onboarding_completed')
}
</script>

<style lang="scss" scoped>
.first-launch-guide {
  :deep(.el-dialog__header) {
    text-align: center;
  }
}

.guide-content {
  padding: 20px 0;
}

.step-content {
  padding: 30px 20px;
  min-height: 280px;
}

/* 欢迎页 */
.step-welcome {
  text-align: center;
}

.welcome-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.welcome-desc {
  color: var(--text-color-secondary);
  font-size: 14px;
  line-height: 1.8;
}

/* 步骤标题 */
h3 {
  margin-top: 0;
  margin-bottom: 12px;
  color: var(--text-color);
}

.step-tip {
  color: var(--text-color-secondary);
  font-size: 13px;
  margin-bottom: 24px;
}

/* 模型选项 */
.model-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.model-option {
  cursor: pointer;
  text-align: center;
  padding: 20px 10px;
  
  &:hover {
    border-color: var(--el-color-primary);
  }
}

.model-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.model-name {
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-color);
}

.model-desc {
  font-size: 12px;
  color: var(--text-color-secondary);
}

/* 权限选项 */
.permission-options {
  :deep(.el-radio-group) {
    width: 100%;
  }
  
  :deep(.el-radio) {
    width: 100%;
    margin: 0 0 12px 0;
    padding: 16px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    
    &:hover {
      border-color: var(--el-color-primary);
    }
  }
}

.permission-option {
  margin-left: 8px;
}

.permission-name {
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--text-color);
}

.permission-desc {
  font-size: 12px;
  color: var(--text-color-secondary);
}

/* 完成页 */
.step-finish {
  text-align: center;
}

.finish-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.finish-desc {
  color: var(--text-color-secondary);
  font-size: 14px;
  line-height: 1.8;
}

.guide-footer {
  display: flex;
  justify-content: space-between;
}
</style>