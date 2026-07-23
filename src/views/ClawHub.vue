<template>
  <div class="clawhub">
    <header class="page-header">
      <h1>🦅 ClawHub 技能市场</h1>
      <p class="subtitle">发布 / 审核 / 搜索 / 评分 — 社区驱动的技能生态</p>
    </header>

    <el-tabs v-model="activeTab" class="clawhub-tabs">
      <!-- Tab 1: 浏览市场(P1-05 搜索/发现) -->
      <el-tab-pane label="浏览市场" name="browse">
        <div class="filter-bar">
          <el-input v-model="searchQuery" placeholder="搜索技能名/描述/标签" clearable style="width: 300px" @keyup.enter="doSearch" />
          <el-select v-model="searchCategory" placeholder="分类" clearable style="width: 160px">
            <el-option label="开发" value="dev" />
            <el-option label="生产力" value="productivity" />
            <el-option label="数据" value="data" />
            <el-option label="AI" value="ai" />
          </el-select>
          <el-select v-model="sortBy" style="width: 140px">
            <el-option label="最新发布" value="recent" />
            <el-option label="下载最多" value="downloads" />
            <el-option label="评分最高" value="rating" />
          </el-select>
          <el-button @click="doSearch">搜索</el-button>
        </div>

        <div v-if="searchResults.length === 0" class="empty-state">
          <el-empty description="还没有技能,点击「发布技能」成为第一个" />
        </div>

        <div v-else class="skill-grid">
          <div v-for="s in searchResults" :key="s.id" class="skill-card">
            <div class="card-header">
              <h3>{{ s.name }}</h3>
              <el-tag size="small">{{ s.category }}</el-tag>
            </div>
            <p class="card-desc">{{ s.description }}</p>
            <div class="card-tags">
              <el-tag v-for="t in s.tags" :key="t" size="small" type="info">{{ t }}</el-tag>
            </div>
            <div class="card-meta">
              <span>👤 {{ s.authorName }}</span>
              <span>⭐ {{ s.ratingCount > 0 ? s.ratingSum / s.ratingCount : '—' }} ({{ s.ratingCount }})</span>
              <span>⬇ {{ s.downloadCount }}</span>
            </div>
            <div class="card-actions">
              <el-button size="small" @click="openRateDialog(s)">评分</el-button>
              <el-button size="small" type="primary" @click="handleDownload(s)">下载</el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Tab 2: 发布技能(P1-03) -->
      <el-tab-pane label="发布技能" name="publish">
        <el-card class="publish-card">
          <h3>发布你的技能</h3>
          <el-form :model="publishForm" label-width="120px">
            <el-form-item label="技能名" required>
              <el-input v-model="publishForm.name" placeholder="如:Git 提交助手" />
            </el-form-item>
            <el-form-item label="描述" required>
              <el-input v-model="publishForm.description" type="textarea" :rows="3" placeholder="技能做什么、解决什么问题" />
            </el-form-item>
            <el-form-item label="分类">
              <el-input v-model="publishForm.category" placeholder="如:dev / productivity" />
            </el-form-item>
            <el-form-item label="标签">
              <el-input v-model="publishForm.tagsText" placeholder="逗号分隔,如:git,code,commit" />
            </el-form-item>
            <el-form-item label="manifest 路径">
              <el-input v-model="publishForm.manifestPath" placeholder="userData/skills/your-skill/skill.md" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handlePublish" :loading="publishing">提交审核</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- Tab 3: 审核队列(P1-04) -->
      <el-tab-pane label="审核队列" name="review">
        <el-table :data="pendingList" stripe>
          <el-table-column label="技能" prop="name" />
          <el-table-column label="作者" prop="authorName" width="120" />
          <el-table-column label="描述" prop="description" show-overflow-tooltip />
          <el-table-column label="分类" prop="category" width="100" />
          <el-table-column label="提交时间" width="180">
            <template #default="{ row }">
              {{ new Date(row.publishedAt).toLocaleString() }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="240">
            <template #default="{ row }">
              <el-button size="small" type="success" @click="handleReview(row, true)">通过</el-button>
              <el-button size="small" type="danger" @click="openRejectDialog(row)">驳回</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 评分弹窗 -->
    <el-dialog v-model="rateDialogVisible" title="为技能评分" width="500px">
      <el-form v-if="ratingSkill" :model="rateForm" label-width="100px">
        <el-form-item label="技能名"><strong>{{ ratingSkill.name }}</strong></el-form-item>
        <el-form-item label="评分">
          <el-rate v-model="rateForm.score" :max="5" />
        </el-form-item>
        <el-form-item label="短评">
          <el-input v-model="rateForm.review" type="textarea" :rows="3" placeholder="说点什么" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleRate">提交</el-button>
      </template>
    </el-dialog>

    <!-- 驳回弹窗 -->
    <el-dialog v-model="rejectDialogVisible" title="驳回原因" width="500px">
      <el-input v-model="rejectReason" type="textarea" :rows="3" placeholder="为什么驳回" />
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="handleReview(rejectingSkill!, false)">确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const activeTab = ref('browse')
const searchQuery = ref('')
const searchCategory = ref('')
const sortBy = ref('recent')
const searchResults = ref<any[]>([])
const pendingList = ref<any[]>([])
const publishing = ref(false)
const publishForm = reactive({ name: '', description: '', category: '', tagsText: '', manifestPath: '' })
const rateDialogVisible = ref(false)
const rateForm = reactive({ score: 5, review: '' })
const ratingSkill = ref<any | null>(null)
const rejectDialogVisible = ref(false)
const rejectingSkill = ref<any | null>(null)
const rejectReason = ref('')

async function doSearch(): Promise<void> {
  try {
    const opts: any = { sortBy: sortBy.value }
    if (searchQuery.value) opts.query = searchQuery.value
    if (searchCategory.value) opts.category = searchCategory.value
    const r = await (window as any).electronAPI.channel.clawhubSearch(opts)
    searchResults.value = r?.success ? r.data : []
  } catch (e) {
    ElMessage.error('搜索失败:' + String(e))
  }
}

async function loadPending(): Promise<void> {
  try {
    const r = await (window as any).electronAPI.channel.clawhubListPending()
    pendingList.value = r?.success ? r.data : []
  } catch (e) {
    console.warn('loadPending failed', e)
  }
}

async function handlePublish(): Promise<void> {
  if (!publishForm.name || !publishForm.description) {
    ElMessage.warning('请填写技能名和描述')
    return
  }
  publishing.value = true
  try {
    const r = await (window as any).electronAPI.channel.clawhubPublish({
      name: publishForm.name,
      description: publishForm.description,
      category: publishForm.category || 'uncategorized',
      tags: publishForm.tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      manifestPath: publishForm.manifestPath || '/tmp/skill.md',
      authorId: 'current-user',
      authorName: 'You',
    })
    if (r?.success) {
      ElMessage.success('已提交,等待审核')
      Object.assign(publishForm, { name: '', description: '', category: '', tagsText: '', manifestPath: '' })
      await loadPending()
    } else {
      ElMessage.error(r?.error || '发布失败')
    }
  } catch (e) {
    ElMessage.error('发布失败:' + String(e))
  } finally {
    publishing.value = false
  }
}

async function handleReview(skill: any, approve: boolean): Promise<void> {
  try {
    const r = await (window as any).electronAPI.channel.clawhubReview({
      skillId: skill.id,
      approve,
      reviewerId: 'admin-current',
      reason: approve ? undefined : rejectReason.value,
    })
    if (r?.success) {
      ElMessage.success(approve ? '已通过' : '已驳回')
      rejectDialogVisible.value = false
      rejectReason.value = ''
      await loadPending()
      await doSearch()
    }
  } catch (e) {
    ElMessage.error('审核失败:' + String(e))
  }
}

function openRejectDialog(skill: any): void {
  rejectingSkill.value = skill
  rejectReason.value = ''
  rejectDialogVisible.value = true
}

function openRateDialog(skill: any): void {
  ratingSkill.value = skill
  Object.assign(rateForm, { score: 5, review: '' })
  rateDialogVisible.value = true
}

async function handleRate(): Promise<void> {
  if (!ratingSkill.value) return
  try {
    const r = await (window as any).electronAPI.channel.clawhubRate({
      skillId: ratingSkill.value.id,
      userId: 'current-user',
      userName: 'You',
      score: rateForm.score,
      review: rateForm.review,
    })
    if (r?.success) {
      ElMessage.success('已评分')
      rateDialogVisible.value = false
      await doSearch()
    }
  } catch (e) {
    ElMessage.error('评分失败:' + String(e))
  }
}

async function handleDownload(skill: any): Promise<void> {
  // 实际下载在 Stage 2(走 SkillLoader.importSkillFromUrl)
  // 这里只展示一个 toast
  ElMessage.success(`下载 ${skill.name}(Stage 2 实现)`)
}

onMounted(() => {
  doSearch()
  loadPending()
})
</script>

<style lang="scss" scoped>
.clawhub {
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
.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
.skill-card {
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #e4e7ed);
  border-radius: 8px;
  padding: 16px;
  transition: box-shadow 0.2s;
  &:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    h3 { margin: 0; font-size: 15px; }
  }
  .card-desc {
    color: var(--text-secondary, #666);
    font-size: 13px;
    margin-bottom: 8px;
  }
  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
  }
  .card-meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: var(--text-secondary, #999);
    margin-bottom: 8px;
  }
  .card-actions {
    display: flex;
    gap: 4px;
  }
}
.publish-card {
  max-width: 600px;
}
.empty-state {
  padding: 40px;
  text-align: center;
}
</style>
