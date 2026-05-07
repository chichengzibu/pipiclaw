<template>
  <div id="pipiclaw-app">
    <AppLayout />
    <FirstLaunchGuide v-model="appStore.showGuide" />
  </div>
</template>

<script setup lang="ts">
import AppLayout from '@/components/layout/AppLayout.vue';
import FirstLaunchGuide from '@/components/guide/FirstLaunchGuide.vue';
import { onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { useGatewayStore } from '@/stores/gateway';

const appStore = useAppStore();
const gatewayStore = useGatewayStore();

onMounted(() => {
  appStore.initialize();
  gatewayStore.initialize();
});
</script>

<style lang="scss">
@use "@/styles/variables.scss" as *;

html, body, #app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

#pipiclaw-app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--bg-color);
  color: var(--text-color);
  position: relative;
}

#pipiclaw-app::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  /* 暖科技风格渐变背景 - 微妙柔和氛围 */
  background: radial-gradient(circle at 15% 85%, rgba(245, 158, 11, 0.08) 0%, transparent 50%),
              radial-gradient(circle at 85% 15%, rgba(251, 191, 36, 0.06) 0%, transparent 50%),
              radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.04) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}

/* 全局通用过渡动画类 */
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
  transform: scale(1);
}

/* 更柔和的 fade-scale 动画 */
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fade-scale-enter-to,
.fade-scale-leave-from {
  opacity: 1;
  transform: scale(1);
}

/* 滑动过渡动画 */
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-to,
.slide-up-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
