<template>
  <el-breadcrumb separator="/" class="breadcrumb">
    <el-breadcrumb-item :to="{ path: '/' }">
      <el-icon><HomeFilled /></el-icon>
      <span>首页</span>
    </el-breadcrumb-item>
    <el-breadcrumb-item v-if="currentTitle">
      {{ currentTitle }}
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { HomeFilled } from '@element-plus/icons-vue';

const route = useRoute();

const currentTitle = computed(() => {
  return route.meta.title as string || '';
});
</script>

<style lang="scss" scoped>
.breadcrumb {
  font-size: 13px;
}
</style>
