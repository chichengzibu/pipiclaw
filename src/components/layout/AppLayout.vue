<template>
  <div class="app-layout">
    <TitleBar />
    
    <div class="app-content">
      <SideNav />
      
      <main class="main-content">
        <router-view v-slot="{ Component, route }">
          <transition name="route-fade" mode="out-in">
            <component :is="Component" :key="route.fullPath" />
          </transition>
        </router-view>
      </main>
    </div>
    
    <div class="app-status-bar">
      <span class="status-item">PiPiClaw v{{ appStore.version }}</span>
      <span class="status-divider">|</span>
      <span class="status-item">
        <GatewayStatusBadge />
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/stores/app';
import TitleBar from './TitleBar.vue';
import SideNav from './SideNav.vue';
import GatewayStatusBadge from '@/components/common/GatewayStatusBadge.vue';

const appStore = useAppStore();
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.app-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--bg-color);
}

.app-content {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.main-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: $content-padding;
  background-color: var(--bg-color-secondary);
}

.app-status-bar {
  display: flex;
  align-items: center;
  height: 24px;
  padding: 0 12px;
  background-color: var(--bg-color);
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-color-secondary);
  flex-shrink: 0;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-divider {
  margin: 0 8px;
  color: var(--border-color);
}
</style>
