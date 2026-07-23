<template>
  <div class="im-accounts">
    <h2>{{ t('nav.imAccounts') }}</h2>
    <p class="im-hint">{{ t('imAccounts.hint') }}</p>

    <el-tabs v-model="activeTab" class="im-tabs">
      <el-tab-pane :label="t('imAccounts.feishu')" name="feishu">
        <el-form :model="feishu" label-width="120px">
          <el-form-item :label="t('imAccounts.appId')">
            <el-input v-model="feishu.appId" placeholder="cli_xxx" />
          </el-form-item>
          <el-form-item :label="t('imAccounts.appSecret')">
            <el-input v-model="feishu.appSecret" type="password" placeholder="xxx" />
          </el-form-item>
          <el-form-item>
            <el-switch v-model="feishu.enabled" :active-text="t('common.enable')" :inactive-text="t('common.disable')" />
            <el-button @click="testConnection('im-feishu', feishu)" :loading="testing['im-feishu']">
              {{ t('imAccounts.testConnection') }}
            </el-button>
          </el-form-item>
          <el-form-item v-if="testResults['im-feishu']">
            <el-alert :type="testResults['im-feishu'].ok ? 'success' : 'error'" :title="testResults['im-feishu'].message" :closable="false" />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane :label="t('imAccounts.dingtalk')" name="dingtalk">
        <el-form :model="dingtalk" label-width="120px">
          <el-form-item :label="t('imAccounts.appKey')">
            <el-input v-model="dingtalk.appKey" placeholder="xxx" />
          </el-form-item>
          <el-form-item :label="t('imAccounts.appSecret')">
            <el-input v-model="dingtalk.appSecret" type="password" />
          </el-form-item>
          <el-form-item :label="t('imAccounts.webhook')">
            <el-input v-model="dingtalk.webhookUrl" placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxx" />
          </el-form-item>
          <el-form-item>
            <el-switch v-model="dingtalk.enabled" :active-text="t('common.enable')" :inactive-text="t('common.disable')" />
            <el-button @click="testConnection('im-dingtalk', dingtalk)" :loading="testing['im-dingtalk']">
              {{ t('imAccounts.testConnection') }}
            </el-button>
          </el-form-item>
          <el-form-item v-if="testResults['im-dingtalk']">
            <el-alert :type="testResults['im-dingtalk'].ok ? 'success' : 'error'" :title="testResults['im-dingtalk'].message" :closable="false" />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane :label="t('imAccounts.wechatwork')" name="wechatwork">
        <el-form :model="wechatwork" label-width="120px">
          <el-form-item :label="t('imAccounts.corpId')">
            <el-input v-model="wechatwork.corpId" placeholder="wwxxx" />
          </el-form-item>
          <el-form-item :label="t('imAccounts.corpSecret')">
            <el-input v-model="wechatwork.corpSecret" type="password" />
          </el-form-item>
          <el-form-item :label="t('imAccounts.agentId')">
            <el-input v-model="wechatwork.agentId" placeholder="1000002" />
          </el-form-item>
          <el-form-item>
            <el-switch v-model="wechatwork.enabled" :active-text="t('common.enable')" :inactive-text="t('common.disable')" />
            <el-button @click="testConnection('im-wechat-work', wechatwork)" :loading="testing['im-wechat-work']">
              {{ t('imAccounts.testConnection') }}
            </el-button>
          </el-form-item>
          <el-form-item v-if="testResults['im-wechat-work']">
            <el-alert :type="testResults['im-wechat-work'].ok ? 'success' : 'error'" :title="testResults['im-wechat-work'].message" :closable="false" />
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>

    <div class="im-actions">
      <el-button type="primary" @click="saveAll" :loading="isSaving">{{ t('imAccounts.saveAll') }}</el-button>
    </div>

    <el-card class="im-flow">
      <h3>{{ t('imAccounts.usageFlow') }}</h3>
      <ol class="im-steps">
        <li v-html="t('imAccounts.step1')"></li>
        <li>{{ t('imAccounts.step2') }}</li>
        <li v-html="t('imAccounts.step3')"></li>
        <li v-html="t('imAccounts.step4')"></li>
        <li>{{ t('imAccounts.step5') }}</li>
        <li>{{ t('imAccounts.step6') }}</li>
      </ol>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const activeTab = ref('feishu');

const feishu = reactive({ appId: '', appSecret: '', enabled: false });
const dingtalk = reactive({ appKey: '', appSecret: '', webhookUrl: '', enabled: false });
const wechatwork = reactive({ corpId: '', corpSecret: '', agentId: '', enabled: false });

const testing = reactive<Record<string, boolean>>({});
const testResults = reactive<Record<string, { ok: boolean; message: string } | null>>({});
const isSaving = ref(false);

async function loadConfigs(): Promise<void> {
  try {
    const result = await (window as any).electronAPI.channelConfig.get();
    const configs: any[] = result && result.success && Array.isArray(result.data) ? result.data : [];
    const feishuConfig = configs.find((c: any) => c.channelKind === 'im-feishu');
    if (feishuConfig) {
      feishu.appId = feishuConfig.appId ?? '';
      feishu.appSecret = feishuConfig.appSecret ?? '';
      feishu.enabled = feishuConfig.enabled ?? false;
    }
    const dingtalkConfig = configs.find((c: any) => c.channelKind === 'im-dingtalk');
    if (dingtalkConfig) {
      dingtalk.appKey = dingtalkConfig.appKey ?? '';
      dingtalk.appSecret = dingtalkConfig.appSecret ?? '';
      dingtalk.webhookUrl = dingtalkConfig.webhookUrl ?? '';
      dingtalk.enabled = dingtalkConfig.enabled ?? false;
    }
    const wechatConfig = configs.find((c: any) => c.channelKind === 'im-wechat-work');
    if (wechatConfig) {
      wechatwork.corpId = wechatConfig.corpId ?? '';
      wechatwork.corpSecret = wechatConfig.corpSecret ?? '';
      wechatwork.agentId = wechatConfig.agentId ?? '';
      wechatwork.enabled = wechatConfig.enabled ?? false;
    }
  } catch (e) {
    console.warn('loadConfigs failed', e);
  }
}

async function testConnection(platform: string, config: any): Promise<void> {
  testing[platform] = true;
  testResults[platform] = null;
  try {
    const result = await (window as any).electronAPI.channelConfig.test({ platform, config });
    testResults[platform] = { ok: !!result.success, message: result.message ?? '' };
  } catch (e) {
    testResults[platform] = { ok: false, message: String(e) };
  } finally {
    testing[platform] = false;
  }
}

async function saveAll(): Promise<void> {
  isSaving.value = true;
  try {
    await Promise.all([
      (window as any).electronAPI.channelConfig.save({ platform: 'im-feishu', config: feishu }),
      (window as any).electronAPI.channelConfig.save({ platform: 'im-dingtalk', config: dingtalk }),
      (window as any).electronAPI.channelConfig.save({ platform: 'im-wechat-work', config: wechatwork }),
    ]);
    ElMessage.success(t('imAccounts.saved'));
  } catch (e) {
    ElMessage.error(t('imAccounts.saveFailed', { error: String(e) }));
  } finally {
    isSaving.value = false;
  }
}

onMounted(loadConfigs);
</script>

<style lang="scss" scoped>
.im-accounts {
  padding: var(--content-padding);
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.im-hint {
  color: var(--text-secondary, #666);
  font-size: var(--font-size-body, 14px);
  margin-bottom: var(--space-lg, 24px);
}

.im-tabs {
  margin-bottom: var(--space-lg, 24px);
}

.im-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-lg, 24px);
}

.im-flow {
  margin-top: var(--space-lg, 24px);
}

.im-steps {
  padding-left: var(--space-lg, 24px);
  font-size: var(--font-size-body, 14px);
  line-height: 1.8;
}

code {
  background: var(--card-bg, #f5f5f5);
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
  font-family: var(--font-family-mono, monospace);
  font-size: var(--font-size-caption-1, 11px);
}
</style>