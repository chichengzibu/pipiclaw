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
#pipiclaw-app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-base);
  color: var(--fg-primary);
  position: relative;
}
</style>
