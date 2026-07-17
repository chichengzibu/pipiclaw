<template>
  <div class="im-accounts">
    <h2>IM 账号配置</h2>
    <p class="im-hint">配置飞书 / 钉钉 / 企微 凭证,启用真实双向消息收发</p>

    <el-tabs v-model="activeTab" class="im-tabs">
      <el-tab-pane label="飞书" name="feishu">
        <el-form :model="feishu" label-width="120px">
          <el-form-item label="App ID">
            <el-input v-model="feishu.appId" placeholder="cli_xxx" />
          </el-form-item>
          <el-form-item label="App Secret">
            <el-input v-model="feishu.appSecret" type="password" placeholder="xxx" />
          </el-form-item>
          <el-form-item>
            <el-switch v-model="feishu.enabled" active-text="启用" inactive-text="禁用" />
            <el-button @click="testConnection('im-feishu', feishu)" :loading="testing['im-feishu']">
              测试连接
            </el-button>
          </el-form-item>
          <el-form-item v-if="testResults['im-feishu']">
            <el-alert :type="testResults['im-feishu'].ok ? 'success' : 'error'" :title="testResults['im-feishu'].message" :closable="false" />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="钉钉" name="dingtalk">
        <el-form :model="dingtalk" label-width="120px">
          <el-form-item label="App Key">
            <el-input v-model="dingtalk.appKey" placeholder="xxx" />
          </el-form-item>
          <el-form-item label="App Secret">
            <el-input v-model="dingtalk.appSecret" type="password" />
          </el-form-item>
          <el-form-item label="Robot Webhook">
            <el-input v-model="dingtalk.webhookUrl" placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxx" />
          </el-form-item>
          <el-form-item>
            <el-switch v-model="dingtalk.enabled" active-text="启用" inactive-text="禁用" />
            <el-button @click="testConnection('im-dingtalk', dingtalk)" :loading="testing['im-dingtalk']">
              测试连接
            </el-button>
          </el-form-item>
          <el-form-item v-if="testResults['im-dingtalk']">
            <el-alert :type="testResults['im-dingtalk'].ok ? 'success' : 'error'" :title="testResults['im-dingtalk'].message" :closable="false" />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="企微" name="wechatwork">
        <el-form :model="wechatwork" label-width="120px">
          <el-form-item label="Corp ID">
            <el-input v-model="wechatwork.corpId" placeholder="wwxxx" />
          </el-form-item>
          <el-form-item label="Corp Secret">
            <el-input v-model="wechatwork.corpSecret" type="password" />
          </el-form-item>
          <el-form-item label="Agent ID">
            <el-input v-model="wechatwork.agentId" placeholder="1000002" />
          </el-form-item>
          <el-form-item>
            <el-switch v-model="wechatwork.enabled" active-text="启用" inactive-text="禁用" />
            <el-button @click="testConnection('im-wechat-work', wechatwork)" :loading="testing['im-wechat-work']">
              测试连接
            </el-button>
          </el-form-item>
          <el-form-item v-if="testResults['im-wechat-work']">
            <el-alert :type="testResults['im-wechat-work'].ok ? 'success' : 'error'" :title="testResults['im-wechat-work'].message" :closable="false" />
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>

    <div class="im-actions">
      <el-button type="primary" @click="saveAll" :loading="isSaving">保存所有</el-button>
    </div>

    <el-card class="im-flow">
      <h3>使用流程</h3>
      <ol class="im-steps">
        <li>在 [飞书开放平台](https://open.feishu.cn/) / [钉钉开放平台](https://open-dev.dingtalk.com/) / [企微后台](https://work.weixin.qq.com/wework_admin/) 创建企业自建应用</li>
        <li>拿 appId/appSecret + 配置 IP 白名单</li>
        <li>安装 ngrok(<code>npm install -g ngrok</code>),启动 <code>ngrok http 5173</code></li>
        <li>把 ngrok URL 填到 IM 平台"消息接收 URL" / "事件订阅 URL"</li>
        <li>本页面填入凭证 + 测试连接 → 保存</li>
        <li>用真实 IM 账号发消息 → PiPiClaw 自动回复</li>
      </ol>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'

const activeTab = ref('feishu')

const feishu = reactive({ appId: '', appSecret: '', enabled: false })
const dingtalk = reactive({ appKey: '', appSecret: '', webhookUrl: '', enabled: false })
const wechatwork = reactive({ corpId: '', corpSecret: '', agentId: '', enabled: false })

const testing = reactive<Record<string, boolean>>({})
const testResults = reactive<Record<string, { ok: boolean; message: string } | null>>({})
const isSaving = ref(false)

async function loadConfigs() {
  try {
    const result = await (window as any).electronAPI.channelConfig.get()
    const configs: Record<string, any> = {}
    if (result && result.success && Array.isArray(result.data)) {
      for (const c of result.data) {
        configs[c.channelKind] = c
      }
    }
    if (configs['im-feishu']) {
      feishu.appId = configs['im-feishu'].appId ?? ''
      feishu.appSecret = configs['im-feishu'].appSecret ?? ''
      feishu.enabled = configs['im-feishu'].enabled ?? false
    }
    if (configs['im-dingtalk']) {
      dingtalk.appKey = configs['im-dingtalk'].appKey ?? ''
      dingtalk.appSecret = configs['im-dingtalk'].appSecret ?? ''
      dingtalk.webhookUrl = configs['im-dingtalk'].webhookUrl ?? ''
      dingtalk.enabled = configs['im-dingtalk'].enabled ?? false
    }
    if (configs['im-wechat-work']) {
      wechatwork.corpId = configs['im-wechat-work'].corpId ?? ''
      wechatwork.corpSecret = configs['im-wechat-work'].corpSecret ?? ''
      wechatwork.agentId = configs['im-wechat-work'].agentId ?? ''
      wechatwork.enabled = configs['im-wechat-work'].enabled ?? false
    }
  } catch (e) {
    console.warn('loadConfigs failed', e)
  }
}

async function testConnection(platform: string, config: any) {
  testing[platform] = true
  testResults[platform] = null
  try {
    const result = await (window as any).electronAPI.channelConfig.test({ platform, config })
    testResults[platform] = { ok: !!result.success, message: result.message ?? '' }
  } catch (e) {
    testResults[platform] = { ok: false, message: String(e) }
  } finally {
    testing[platform] = false
  }
}

async function saveAll() {
  isSaving.value = true
  try {
    await Promise.all([
      (window as any).electronAPI.channelConfig.save({ platform: 'im-feishu', config: feishu }),
      (window as any).electronAPI.channelConfig.save({ platform: 'im-dingtalk', config: dingtalk }),
      (window as any).electronAPI.channelConfig.save({ platform: 'im-wechat-work', config: wechatwork }),
    ])
    alert('已保存')
  } catch (e) {
    alert('保存失败: ' + e)
  } finally {
    isSaving.value = false
  }
}

onMounted(loadConfigs)
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