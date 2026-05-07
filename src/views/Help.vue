<template>
  <div class="help-page">
    <div class="page-header">
      <h1 class="page-title">帮助中心</h1>
      <Breadcrumb />
    </div>
    
    <el-tabs v-model="activeTab" class="help-tabs">
      <!-- 常见问题 -->
      <el-tab-pane label="常见问题" name="faq">
        <div class="faq-section">
          <el-collapse v-model="activeFaq">
            <el-collapse-item title="如何添加模型？" name="1">
              <div class="faq-answer">
                <p>1. 进入「模型管理」页面</p>
                <p>2. 点击「添加模型提供商」按钮</p>
                <p>3. 选择提供商类型（如 Ollama、DeepSeek 等）</p>
                <p>4. 填写 API Key 和 Base URL</p>
                <p>5. 点击「测试连接」验证配置</p>
                <p>6. 验证通过后点击「保存」</p>
              </div>
            </el-collapse-item>
            
            <el-collapse-item title="如何设置权限？" name="2">
              <div class="faq-answer">
                <p>1. 进入「权限管理」页面</p>
                <p>2. 选择或创建一个权限集</p>
                <p>3. 为每个权限类别设置权限级别</p>
                <p>4. 可以设置允许/禁止的路径</p>
                <p>5. 保存后激活该权限集</p>
              </div>
            </el-collapse-item>
            
            <el-collapse-item title="如何使用自动化任务？" name="3">
              <div class="faq-answer">
                <p>1. 在对话中描述您的任务需求</p>
                <p>2. AI 会解析任务并生成执行计划</p>
                <p>3. 确认计划后点击「执行」</p>
                <p>4. 可以在「自动化任务」页面查看执行日志</p>
              </div>
            </el-collapse-item>
            
            <el-collapse-item title="如何使用全局快捷键？" name="4">
              <div class="faq-answer">
                <p>默认快捷键：<strong>Ctrl+Alt+P</strong> (Windows) / <strong>Cmd+Option+P</strong> (macOS)</p>
                <p>按此快捷键可以快速唤起/隐藏主窗口</p>
                <p>可以在「系统设置」中自定义快捷键</p>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
      </el-tab-pane>
      
      <!-- 使用教程 -->
      <el-tab-pane label="使用教程" name="tutorial">
        <div class="tutorial-section">
          <el-card class="tutorial-card">
            <div class="tutorial-step">
              <div class="step-number">1</div>
              <div class="step-content">
                <h3>配置模型</h3>
                <p>首次使用需要先配置模型提供商，支持 Ollama、DeepSeek、OpenAI 等多种模型</p>
              </div>
            </div>
          </el-card>
          
          <el-card class="tutorial-card">
            <div class="tutorial-step">
              <div class="step-number">2</div>
              <div class="step-content">
                <h3>设置权限</h3>
                <p>根据您的需求设置操作权限，确保安全使用自动化功能</p>
              </div>
            </div>
          </el-card>
          
          <el-card class="tutorial-card">
            <div class="tutorial-step">
              <div class="step-number">3</div>
              <div class="step-content">
                <h3>开始对话</h3>
                <p>进入「AI对话」页面，输入您的需求，AI 会帮您完成</p>
              </div>
            </div>
          </el-card>
        </div>
      </el-tab-pane>
      
      <!-- 功能说明 -->
      <el-tab-pane label="功能说明" name="features">
        <div class="features-section">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-card class="feature-card">
                <div class="feature-icon">💬</div>
                <h3>AI对话</h3>
                <p>与 AI 自然对话，支持多轮对话、上下文理解</p>
              </el-card>
            </el-col>
            <el-col :span="12">
              <el-card class="feature-card">
                <div class="feature-icon">⚡</div>
                <h3>自动化任务</h3>
                <p>让 AI 帮您执行文件操作、系统命令等自动化任务</p>
              </el-card>
            </el-col>
            <el-col :span="12">
              <el-card class="feature-card">
                <div class="feature-icon">🖼️</div>
                <h3>多模态输入</h3>
                <p>支持截图粘贴、文件拖拽上传，AI 可以理解图片和文档</p>
              </el-card>
            </el-col>
            <el-col :span="12">
              <el-card class="feature-card">
                <div class="feature-icon">⌨️</div>
                <h3>全局快捷键</h3>
                <p>随时随地快速唤起窗口，提升使用效率</p>
              </el-card>
            </el-col>
          </el-row>
          
          <el-alert type="info" :closable="false" style="margin-top: 24px;">
            <template #title>
              如有问题或建议，请前往「系统设置」→「反馈与帮助」提交反馈
            </template>
          </el-alert>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Breadcrumb from '@/components/layout/Breadcrumb.vue';

const activeTab = ref('faq');
const activeFaq = ref<string[]>([]);
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

/* Help页面根容器强制使用主题变量 */
.help-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: $content-padding;
  min-width: 1200px;
  background-color: var(--page-bg) !important;
  color: var(--text-primary) !important;
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
  color: var(--text-primary) !important;
  margin: 0;
}

/* 强制覆盖Help页面的所有卡片样式 */
.help-page :deep(.el-card) {
  background-color: var(--card-bg) !important;
  border-color: var(--border-color) !important;
  color: var(--text-primary) !important;
}

.help-page :deep(.el-card__header) {
  border-color: var(--border-color) !important;
  background-color: var(--card-bg) !important;
}

.help-page :deep(.el-card__body) {
  background-color: var(--card-bg) !important;
  color: var(--text-primary) !important;
}

.help-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  
  :deep(.el-tabs__nav) {
    display: flex;
    gap: 8px;
  }
  
  :deep(.el-tabs__item) {
    min-width: 100px;
    padding: 0 24px;
    font-size: 14px;
    line-height: 1.5;
  }
  
  :deep(.el-tabs__content) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 20px 0;
  }
}

/* FAQ */
.faq-section {
  max-width: 800px;
}

.faq-answer {
  p {
    margin: 8px 0;
    font-size: 14px;
    color: var(--text-color);
    line-height: 1.5;
  }
}

:deep(.el-collapse-item__header) {
  padding: 16px 20px;
  line-height: 1.5;
}

:deep(.el-collapse-item__content) {
  padding: 0 20px 16px;
}

:deep(.el-collapse) {
  border-top: 1px solid var(--border-color);
  
  .el-collapse-item {
    border-bottom: 1px solid var(--border-color);
  }
}

/* 教程 */
.tutorial-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 800px;
}

.tutorial-step {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.step-number {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--el-color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.step-content h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: var(--text-color);
}

.step-content p {
  margin: 0;
  font-size: 14px;
  color: var(--text-color-secondary);
}

/* 功能说明 */
.features-section {
  .feature-card {
    text-align: center;
    padding: 32px 20px;
  }
  
  .feature-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }
  
  h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
    color: var(--text-color);
  }
  
  p {
    margin: 0;
    font-size: 14px;
    color: var(--text-color-secondary);
  }
}
</style>