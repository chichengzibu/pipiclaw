<template>
  <div class="remote-control-page">
    <div class="page-header">
      <h1 class="page-title">远程控制</h1>
      <Breadcrumb />
    </div>
    
    <div class="control-content">
      <el-card class="control-card">
        <template #header>
          <span>微信</span>
        </template>
        <el-form label-width="120px">
          <el-form-item label="启用">
            <el-switch v-model="config.wechat.enabled" />
          </el-form-item>
          <el-form-item label="Webhook URL" v-if="config.wechat.enabled">
            <el-input v-model="config.wechat.webhookUrl" placeholder="请输入 Webhook URL" />
          </el-form-item>
          <el-form-item label="密钥" v-if="config.wechat.enabled">
            <el-input v-model="config.wechat.secret" type="password" placeholder="请输入密钥" />
          </el-form-item>
          <el-form-item v-if="config.wechat.enabled">
            <el-button type="primary" size="small" @click="testConnection('wechat')">测试连接</el-button>
          </el-form-item>
        </el-form>
        <el-collapse class="tutorial-collapse">
          <el-collapse-item title="配置教程">
            <div class="tutorial-content">
              <p>1. 登录企业微信管理后台</p>
              <p>2. 进入「应用管理」→「自建应用」，点击「创建应用」</p>
              <p>3. 填写应用名称「PiPiClaw机器人」，上传应用头像</p>
              <p>4. 点击「获取企业ID」，记录企业ID</p>
              <p>5. 点击「应用管理」→「PiPiClaw机器人」→「接收消息」，点击「设置接收消息」</p>
              <p>6. 获取「Webhook URL」和「密钥」，填入下方</p>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-card>
      
      <el-card class="control-card">
        <template #header>
          <span>飞书</span>
        </template>
        <el-form label-width="120px">
          <el-form-item label="启用">
            <el-switch v-model="config.feishu.enabled" />
          </el-form-item>
          <el-form-item label="Webhook URL" v-if="config.feishu.enabled">
            <el-input v-model="config.feishu.webhookUrl" placeholder="请输入 Webhook URL" />
          </el-form-item>
          <el-form-item label="密钥" v-if="config.feishu.enabled">
            <el-input v-model="config.feishu.secret" type="password" placeholder="请输入密钥" />
          </el-form-item>
          <el-form-item v-if="config.feishu.enabled">
            <el-button type="primary" size="small" @click="testConnection('feishu')">测试连接</el-button>
          </el-form-item>
        </el-form>
        <el-collapse class="tutorial-collapse">
          <el-collapse-item title="配置教程">
            <div class="tutorial-content">
              <p>1. 登录飞书开放平台，创建自定义机器人</p>
              <p>2. 点击「添加机器人」，填写机器人名称「PiPiClaw」</p>
              <p>3. 复制「Webhook地址」和「签名校验」的密钥</p>
              <p>4. 将获取到的信息填入下方</p>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-card>
      
      <el-card class="control-card">
        <template #header>
          <span>Telegram</span>
        </template>
        <el-form label-width="120px">
          <el-form-item label="启用">
            <el-switch v-model="config.telegram.enabled" />
          </el-form-item>
          <el-form-item label="Bot Token" v-if="config.telegram.enabled">
            <el-input v-model="config.telegram.botToken" placeholder="请输入 Bot Token" />
          </el-form-item>
          <el-form-item label="Chat ID" v-if="config.telegram.enabled">
            <el-input v-model="config.telegram.chatId" placeholder="请输入 Chat ID" />
          </el-form-item>
          <el-form-item v-if="config.telegram.enabled">
            <el-button type="primary" size="small" @click="testConnection('telegram')">测试连接</el-button>
          </el-form-item>
        </el-form>
        <el-collapse class="tutorial-collapse">
          <el-collapse-item title="配置教程">
            <div class="tutorial-content">
              <p>1. 打开 Telegram，搜索「@BotFather」</p>
              <p>2. 发送「/newbot」，按提示创建机器人，获取「Bot Token」</p>
              <p>3. 搜索「@userinfobot」，发送任意消息，获取「Chat ID」</p>
              <p>4. 将获取到的信息填入下方</p>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-card>
      
      <div class="action-bar">
        <el-button type="primary" @click="saveConfig">保存配置</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import Breadcrumb from '@/components/layout/Breadcrumb.vue';

interface RemoteControlConfig {
  wechat: {
    enabled: boolean;
    webhookUrl?: string;
    secret?: string;
  };
  feishu: {
    enabled: boolean;
    webhookUrl?: string;
    secret?: string;
  };
  telegram: {
    enabled: boolean;
    botToken?: string;
    chatId?: string;
  };
}

const config = reactive<RemoteControlConfig>({
  wechat: { enabled: false },
  feishu: { enabled: false },
  telegram: { enabled: false }
});

function saveConfig(): void {
  ElMessage.success('配置已保存');
}

function testConnection(platform: keyof RemoteControlConfig): void {
  ElMessage.success(`${platform} 连接成功`);
}
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.remote-control-page {
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

.page-title {
  font-size: var(--font-size-title-1);
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
  margin: 0;
}

.control-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--content-padding);
}

.control-card {
  flex-shrink: 0;
}

.tutorial-collapse {
  margin-top: var(--space-md);
}

.tutorial-content {
  p {
    margin: var(--space-sm) 0;
    font-size: var(--font-size-body);
    color: var(--text-color);
  }
}

.action-bar {
  display: flex;
  gap: var(--space-md);
  flex-shrink: 0;
}
</style>