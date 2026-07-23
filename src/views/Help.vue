<template>
  <div class="help-page">
    <div class="page-header">
      <h1 class="page-title">{{ t('help.title') }}</h1>
    </div>

    <div class="help-content">
      <el-row :gutter="20">
        <!-- 快速入门 -->
        <el-col :span="24">
          <el-card class="help-card">
            <template #header>
              <div class="card-header">
                <el-icon><Star /></el-icon>
                <span>{{ t('help.tutorial') }}</span>
              </div>
            </template>
            <el-steps :active="3" finish-status="success" direction="vertical">
              <el-step>
                <template #title>
                  <span class="step-title">{{ t('help.step1Title') }}</span>
                </template>
                <template #description>
                  <p>{{ t('help.step1Desc') }}</p>
                </template>
              </el-step>
              <el-step>
                <template #title>
                  <span class="step-title">{{ t('help.step2Title') }}</span>
                </template>
                <template #description>
                  <p>{{ t('help.step2Desc') }}</p>
                </template>
              </el-step>
              <el-step>
                <template #title>
                  <span class="step-title">{{ t('help.step3Title') }}</span>
                </template>
                <template #description>
                  <p>{{ t('help.step3Desc') }}</p>
                </template>
              </el-step>
            </el-steps>
          </el-card>
        </el-col>

        <!-- 常见问题 -->
        <el-col :span="12">
          <el-card class="help-card">
            <template #header>
              <div class="card-header">
                <el-icon><QuestionFilled /></el-icon>
                <span>{{ t('help.faq') }}</span>
              </div>
            </template>
            <el-collapse>
              <el-collapse-item :title="t('help.addModel')" name="1">
                <pre class="steps">{{ t('help.addModelSteps') }}</pre>
              </el-collapse-item>
              <el-collapse-item :title="t('help.setPermission')" name="2">
                <pre class="steps">{{ t('help.setPermissionSteps') }}</pre>
              </el-collapse-item>
              <el-collapse-item :title="t('help.useTask')" name="3">
                <pre class="steps">{{ t('help.useTaskSteps') }}</pre>
              </el-collapse-item>
              <el-collapse-item :title="t('help.useShortcut')" name="4">
                <p v-html="t('help.shortcutDefault')"></p>
                <p>{{ t('help.shortcutDescription') }}</p>
                <p>{{ t('help.shortcutCustomize') }}</p>
              </el-collapse-item>
            </el-collapse>
          </el-card>
        </el-col>

        <!-- 功能介绍 -->
        <el-col :span="12">
          <el-card class="help-card">
            <template #header>
              <div class="card-header">
                <el-icon><InfoFilled /></el-icon>
                <span>{{ t('help.features') }}</span>
              </div>
            </template>
            <div class="feature-list">
              <div class="feature-item">
                <div class="feature-title">{{ t('help.featureChatTitle') }}</div>
                <div class="feature-desc">{{ t('help.featureChatDesc') }}</div>
              </div>
              <div class="feature-item">
                <div class="feature-title">{{ t('help.featureTaskTitle') }}</div>
                <div class="feature-desc">{{ t('help.featureTaskDesc') }}</div>
              </div>
              <div class="feature-item">
                <div class="feature-title">{{ t('help.featureMultimodalTitle') }}</div>
                <div class="feature-desc">{{ t('help.featureMultimodalDesc') }}</div>
              </div>
              <div class="feature-item">
                <div class="feature-title">{{ t('help.featureShortcutTitle') }}</div>
                <div class="feature-desc">{{ t('help.featureShortcutDesc') }}</div>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="24">
          <el-alert :title="t('help.feedbackHint')" type="success" :closable="false" show-icon />
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Star, QuestionFilled, InfoFilled } from '@element-plus/icons-vue';

const { t } = useI18n();
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.help-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-header {
  margin-bottom: var(--content-padding);
}

.page-title {
  font-size: var(--font-size-title-1);
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
  margin: 0;
}

.help-content {
  flex: 1;
  overflow-y: auto;
}

.help-card {
  margin-bottom: var(--content-padding);
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-weight: var(--font-weight-semibold);
}

.steps {
  font-family: inherit;
  font-size: var(--font-size-body);
  line-height: var(--line-height-loose);
  color: var(--text-color-secondary);
  white-space: pre-wrap;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.feature-item {
  padding: var(--space-sm);
  border-radius: var(--radius-sm);
  background: var(--el-fill-color-light);
}

.feature-title {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-body);
  color: var(--text-color);
  margin-bottom: var(--space-xs);
}

.feature-desc {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-secondary);
  line-height: var(--line-height-normal);
}

.step-title {
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-body);
}
</style>