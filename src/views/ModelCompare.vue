<template>
  <div class="model-compare">
    <header class="page-header">
      <h1>⚖️ 模型对比</h1>
      <p class="subtitle">P1-07 性价比对比 + P1-08 社区评分 — 帮你选最合适的 LLM</p>
    </header>

    <el-tabs v-model="activeTab" class="compare-tabs">
      <!-- Tab 1: 对比表(P1-07) -->
      <el-tab-pane label="性价比对比" name="compare">
        <div class="filter-bar">
          <el-input v-model="searchQuery" placeholder="搜索模型名/提供商" clearable style="width: 280px" />
          <el-select v-model="sortBy" style="width: 160px">
            <el-option label="按评分排序" value="rating" />
            <el-option label="按价格排序" value="price" />
            <el-option label="按延迟排序" value="latency" />
            <el-option label="按吞吐量排序" value="throughput" />
          </el-select>
        </div>

        <el-table :data="filteredModels" stripe @sort-change="handleSortChange">
          <el-table-column label="模型" prop="name" min-width="180" sortable />
          <el-table-column label="提供商" prop="provider" width="120" />
          <el-table-column label="价格($/M token)" prop="pricePerMTok" width="140" sortable>
            <template #default="{ row }">
              <span class="price">${{ row.pricePerMTok.toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="延迟(TTFT)" prop="latencyMs" width="120" sortable>
            <template #default="{ row }">
              {{ row.latencyMs }}ms
            </template>
          </el-table-column>
          <el-table-column label="吞吐量" prop="throughputTps" width="100" sortable>
            <template #default="{ row }">
              {{ row.throughputTps }} tok/s
            </template>
          </el-table-column>
          <el-table-column label="社区评分" prop="communityScore" width="120" sortable>
            <template #default="{ row }">
              <span v-if="row.communityScore > 0">
                <el-rate v-model="row.communityScore" disabled :max="5" show-score />
              </span>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="评分人数" prop="ratingCount" width="100" />
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button size="small" @click="openRateDialog(row)">评分</el-button>
            </template>
          </el-table-column>
        </el-table>

        <p class="legend">
          * 价格/延迟/吞吐量为自建基准测试数据 + 第三方 API(参考 OpenRouter)<br />
          社区评分由用户提交,见 <router-link to="/clawhub">ClawHub 技能市场</router-link> 了解同体系
        </p>
      </el-tab-pane>

      <!-- Tab 2: 使用量排行(P2-02) -->
      <el-tab-pane label="使用量排行" name="usage">
        <div class="usage-summary">
          <el-statistic title="总调用次数" :value="usageTotal.totalCalls" />
          <el-statistic title="总 token 数" :value="usageTotal.totalTokens" />
          <el-statistic title="总费用(USD)" :value="Number(usageTotal.totalCost.toFixed(4))" :precision="4" />
          <el-statistic title="涉及模型数" :value="usageTotal.modelCount" />
        </div>
        <div class="filter-bar">
          <el-select v-model="usageSortBy" style="width: 160px" @change="loadUsage">
            <el-option label="按 tokens 排" value="tokens" />
            <el-option label="按 cost 排" value="cost" />
            <el-option label="按调用次数排" value="calls" />
          </el-select>
          <el-button @click="loadUsage">刷新</el-button>
        </div>
        <el-table :data="usageTop" stripe>
          <el-table-column label="排名" width="80" type="index" />
          <el-table-column label="模型" prop="modelId" />
          <el-table-column label="提供商" prop="provider" width="120" />
          <el-table-column label="调用次数" prop="callCount" width="120" sortable />
          <el-table-column label="总 tokens" prop="tokens" width="120" sortable />
          <el-table-column label="总费用(USD)" prop="cost" width="140" sortable>
            <template #default="{ row }">
              <span class="price">${{ row.cost.toFixed(4) }}</span>
            </template>
          </el-table-column>
        </el-table>
        <p v-if="usageTop.length === 0" class="muted">还没有使用记录,跑几次 LLM 调用就会自动统计</p>
      </el-tab-pane>

      <!-- Tab 3: 我的评分历史(P1-08) -->
      <el-tab-pane label="评分历史" name="history">
        <el-table :data="myRatings" stripe>
          <el-table-column label="模型" prop="modelId" />
          <el-table-column label="提供商" prop="provider" width="120" />
          <el-table-column label="评分" width="120">
            <template #default="{ row }">
              <el-rate v-model="row.score" disabled :max="5" />
            </template>
          </el-table-column>
          <el-table-column label="短评" prop="review" show-overflow-tooltip />
          <el-table-column label="时间" width="180">
            <template #default="{ row }">
              {{ new Date(row.createdAt).toLocaleString() }}
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 评分弹窗 -->
    <el-dialog v-model="rateDialogVisible" title="为模型评分" width="500px">
      <el-form v-if="ratingModel" :model="rateForm" label-width="100px">
        <el-form-item label="模型"><strong>{{ ratingModel.name }}</strong></el-form-item>
        <el-form-item label="提供商">{{ ratingModel.provider }}</el-form-item>
        <el-form-item label="评分">
          <el-rate v-model="rateForm.score" :max="5" />
        </el-form-item>
        <el-form-item label="短评">
          <el-input v-model="rateForm.review" type="textarea" :rows="3" placeholder="说说你对这个模型的使用感受" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleRate">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const activeTab = ref('compare')
const searchQuery = ref('')
const sortBy = ref('rating')
const rateDialogVisible = ref(false)
const rateForm = reactive({ score: 5, review: '' })
const ratingModel = ref<any | null>(null)

// 模型基础数据(P1-07 默认基准)
// 实际生产中可接 OpenRouter API 或自建 benchmark
const MODELS = [
  { modelId: 'gpt-4o', provider: 'openai', name: 'GPT-4o', pricePerMTok: 5.00, latencyMs: 350, throughputTps: 80 },
  { modelId: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini', pricePerMTok: 0.15, latencyMs: 200, throughputTps: 120 },
  { modelId: 'o1-preview', provider: 'openai', name: 'o1 Preview', pricePerMTok: 15.00, latencyMs: 800, throughputTps: 50 },
  { modelId: 'claude-3-5-sonnet', provider: 'anthropic', name: 'Claude 3.5 Sonnet', pricePerMTok: 3.00, latencyMs: 400, throughputTps: 70 },
  { modelId: 'claude-3-haiku', provider: 'anthropic', name: 'Claude 3 Haiku', pricePerMTok: 0.25, latencyMs: 180, throughputTps: 130 },
  { modelId: 'glm-4-plus', provider: 'zhipu', name: 'GLM-4 Plus', pricePerMTok: 0.50, latencyMs: 280, throughputTps: 90 },
  { modelId: 'glm-4-flash', provider: 'zhipu', name: 'GLM-4 Flash', pricePerMTok: 0.0007, latencyMs: 150, throughputTps: 150 },
  { modelId: 'deepseek-v3', provider: 'deepseek', name: 'DeepSeek V3', pricePerMTok: 0.27, latencyMs: 320, throughputTps: 85 },
  { modelId: 'qwen-max', provider: 'alibaba', name: 'Qwen Max', pricePerMTok: 0.40, latencyMs: 250, throughputTps: 95 },
  { modelId: 'gemini-1.5-pro', provider: 'google', name: 'Gemini 1.5 Pro', pricePerMTok: 3.50, latencyMs: 380, throughputTps: 75 },
]

const myRatings = ref<any[]>([])
const stats = ref<any[]>([])
const usageTop = ref<any[]>([])
const usageTotal = ref({ totalCalls: 0, totalTokens: 0, totalCost: 0, modelCount: 0 })
const usageSortBy = ref<'tokens' | 'cost' | 'calls'>('tokens')

const filteredModels = computed(() => {
  // 合并基础数据 + 社区评分
  const merged = MODELS.map((m) => {
    const s = stats.value.find((s) => s.modelId === m.modelId && s.provider === m.provider)
    return {
      ...m,
      communityScore: s?.avgScore ?? 0,
      ratingCount: s?.ratingCount ?? 0,
    }
  })
  let result = merged
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(
      (m) => m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q) || m.modelId.includes(q),
    )
  }
  // 排序
  const sortByValue = sortBy.value
  result = [...result].sort((a, b) => {
    if (sortByValue === 'price') return a.pricePerMTok - b.pricePerMTok
    if (sortByValue === 'latency') return a.latencyMs - b.latencyMs
    if (sortByValue === 'throughput') return b.throughputTps - a.throughputTps
    if (sortByValue === 'rating') {
      if (b.ratingCount > 0 && a.ratingCount > 0) return b.communityScore - a.communityScore
      if (b.ratingCount > 0) return 1
      if (a.ratingCount > 0) return -1
      return 0
    }
    return 0
  })
  return result
})

function handleSortChange(): void {
  // 表格内置排序
}

function openRateDialog(model: any): void {
  ratingModel.value = model
  Object.assign(rateForm, { score: 5, review: '' })
  rateDialogVisible.value = true
}

async function handleRate(): Promise<void> {
  if (!ratingModel.value) return
  try {
    const r = await (window as any).electronAPI.channel.modelRate({
      modelId: ratingModel.value.modelId,
      provider: ratingModel.value.provider,
      userId: 'current-user',
      userName: 'You',
      score: rateForm.score,
      review: rateForm.review,
    })
    if (r?.success) {
      ElMessage.success('已评分')
      rateDialogVisible.value = false
      await loadStats()
      await loadMyRatings()
    } else {
      ElMessage.error(r?.error || '评分失败')
    }
  } catch (e) {
    ElMessage.error('评分失败:' + String(e))
  }
}

async function loadStats(): Promise<void> {
  try {
    const r = await (window as any).electronAPI.channel.modelGetStats()
    if (r?.success) stats.value = r.data || []
  } catch (e) {
    console.warn('loadStats failed', e)
  }
}

async function loadMyRatings(): Promise<void> {
  try {
    const r = await (window as any).electronAPI.channel.modelListRatings()
    if (r?.success) myRatings.value = r.data || []
  } catch (e) {
    console.warn('loadMyRatings failed', e)
  }
}

async function loadUsage(): Promise<void> {
  try {
    const [top, total] = await Promise.all([
      (window as any).electronAPI.channel.modelUsageTop({ n: 20, sortBy: usageSortBy.value }),
      (window as any).electronAPI.channel.modelUsageTotal(),
    ])
    if (top?.success) usageTop.value = top.data || []
    if (total?.success) usageTotal.value = total.data || { totalCalls: 0, totalTokens: 0, totalCost: 0, modelCount: 0 }
  } catch (e) {
    console.warn('loadUsage failed', e)
  }
}

onMounted(() => {
  loadStats()
  loadMyRatings()
  loadUsage()
})
</script>

<style lang="scss" scoped>
.model-compare {
  padding: var(--content-padding, 16px);
  max-width: 1200px;
  margin: 0 auto;
}
.page-header {
  margin-bottom: 16px;
}
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}
.price {
  font-family: 'Cascadia Code', monospace;
  font-weight: 500;
  color: #67c23a;
}
.muted {
  color: #c0c4cc;
}
.usage-summary {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  :deep(.el-statistic) {
    background: var(--card-bg, #f8f9fa);
    padding: 12px 16px;
    border-radius: 8px;
    flex: 1;
  }
}
.legend {
  margin-top: 16px;
  font-size: 12px;
  color: var(--text-secondary, #999);
}
</style>
