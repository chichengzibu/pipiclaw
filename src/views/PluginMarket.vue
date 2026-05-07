<template>
  <div class="plugin-market-page">
    <div class="page-header">
      <h1 class="page-title">插件市场</h1>
      <Breadcrumb />
    </div>
    
    <div class="market-content">
      <el-alert type="info" :closable="false" class="market-alert">
        扩展产品的核心能力，解锁更多自动化场景，比如浏览器控制、消息推送、第三方服务对接
      </el-alert>
      <el-tabs v-model="activeTab" class="plugin-tabs">
        <el-tab-pane label="官方插件" name="official">
          <div class="plugin-grid">
            <div 
              v-for="plugin in officialPlugins" 
              :key="plugin.id"
              class="plugin-card"
            >
              <div class="plugin-header">
                <div class="plugin-name">{{ plugin.name }}</div>
                <el-tag size="small">{{ plugin.version }}</el-tag>
              </div>
              <div class="plugin-desc">{{ plugin.description }}</div>
              <div class="plugin-meta">
                <span class="meta-item">
                  <el-icon><User /></el-icon>
                  {{ plugin.author }}
                </span>
                <span class="meta-item">
                  <el-icon><Download /></el-icon>
                  {{ plugin.downloads }}
                </span>
                <span class="meta-item">
                  <el-icon><Star /></el-icon>
                  {{ plugin.rating }}
                </span>
              </div>
              <div class="plugin-actions">
                <el-button size="small" type="primary">
                  安装
                </el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="我的插件" name="my">
          <div class="plugin-grid">
            <div 
              v-for="plugin in myPlugins" 
              :key="plugin.id"
              class="plugin-card"
            >
              <div class="plugin-header">
                <div class="plugin-name">{{ plugin.name }}</div>
                <el-tag :type="plugin.enabled ? 'success' : 'info'" size="small">
                  {{ plugin.enabled ? '已启用' : '已禁用' }}
                </el-tag>
              </div>
              <div class="plugin-desc">{{ plugin.description }}</div>
              <div class="plugin-actions">
                <el-button size="small" text @click="togglePlugin(plugin)">
                  {{ plugin.enabled ? '禁用' : '启用' }}
                </el-button>
                <el-button size="small" text type="danger">
                  卸载
                </el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { User, Download, Star } from '@element-plus/icons-vue';
import Breadcrumb from '@/components/layout/Breadcrumb.vue';

interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  downloads: number;
  rating: number;
  enabled?: boolean;
}

const activeTab = ref<'official' | 'my'>('official');

const officialPlugins: Plugin[] = [
  {
    id: 'browser-automation',
    name: '浏览器自动化',
    description: '对接 Playwright，实现网页操作自动化',
    version: '1.0.0',
    author: 'PiPiClaw Team',
    downloads: 1234,
    rating: 4.8
  },
  {
    id: 'wechat-notification',
    name: '微信消息推送',
    description: '任务执行完成后推送结果到微信',
    version: '1.0.0',
    author: 'PiPiClaw Team',
    downloads: 892,
    rating: 4.7
  },
  {
    id: 'batch-image-process',
    name: '批量图片处理',
    description: '图片压缩、格式转换、水印添加',
    version: '1.0.0',
    author: 'PiPiClaw Team',
    downloads: 654,
    rating: 4.9
  }
];

const myPlugins: Plugin[] = [];

function togglePlugin(plugin: Plugin): void {
  plugin.enabled = !plugin.enabled;
  ElMessage.success(plugin.enabled ? '插件已启用' : '插件已禁用');
}
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.plugin-market-page {
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

.market-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.plugin-tabs {
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

.plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  padding: 8px 0;
}

.plugin-card {
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

.plugin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.plugin-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.plugin-desc {
  font-size: 13px;
  color: var(--text-color-secondary);
  line-height: 1.5;
}

.plugin-meta {
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

.plugin-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}
</style>