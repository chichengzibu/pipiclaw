<template>
  <div class="chat-page">
    <div class="chat-layout">
      <!-- 左侧会话列表 -->
      <div class="sidebar" :style="{ width: chatSidebarWidth + 'px' }">
        <div class="sidebar-header">
          <span class="sidebar-title">会话</span>
          <el-button
            type="primary"
            size="small"
            @click="handleNewChat"
            title="新建对话"
            aria-label="新建对话"
            class="new-chat-btn"
          >
            <el-icon><Plus /></el-icon>
            <span class="new-chat-text">新建</span>
          </el-button>
        </div>
        
        <!-- 会话搜索框 -->
        <div class="search-box">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索会话..."
            size="small"
            clearable
            @input="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>

        <!-- 批量操作栏 -->
        <div v-if="chatStore.selectedConversations.length > 0" class="batch-actions">
          <span class="selected-count">已选中 {{ chatStore.selectedConversations.length }} 项</span>
          <el-button size="small" type="danger" @click="handleBatchDelete">
            批量删除
          </el-button>
          <el-button size="small" @click="handleBatchArchive">
            批量归档
          </el-button>
          <el-button size="small" text @click="chatStore.clearConversationSelection">
            取消
          </el-button>
        </div>

        <el-scrollbar class="conversations-list">
          <!-- 搜索结果 -->
          <template v-if="searchKeyword && chatStore.searchResults.length > 0">
            <div class="conversation-group">
              <div class="group-label">搜索结果</div>
              <div
                v-for="conv in chatStore.searchResults"
                :key="conv.id"
                class="conversation-item"
                :class="{ active: conv.id === chatStore.currentConversationId }"
                @click="handleSelectConversation(conv.id)"
              >
                <el-checkbox
                  :model-value="chatStore.selectedConversations.includes(conv.id)"
                  @click.stop
                  @change="chatStore.toggleConversationSelection(conv.id)"
                />
                <span class="conversation-icon">🔍</span>
                <span class="conversation-title">{{ conv.title }}</span>
              </div>
            </div>
          </template>

          <!-- 置顶会话 -->
          <div v-if="chatStore.pinnedConversations.length > 0" class="conversation-group">
            <div class="group-label">置顶</div>
            <div
              v-for="conv in chatStore.pinnedConversations"
              :key="conv.id"
              class="conversation-item"
              :class="{ active: conv.id === chatStore.currentConversationId }"
              @click="handleSelectConversation(conv.id)"
            >
              <el-checkbox
                :model-value="chatStore.selectedConversations.includes(conv.id)"
                @click.stop
                @change="chatStore.toggleConversationSelection(conv.id)"
              />
              <span class="conversation-icon">📌</span>
              <span class="conversation-title">{{ conv.title }}</span>
              <el-dropdown trigger="click" @command="(cmd: string) => handleConversationAction(cmd, conv)">
                <el-icon class="more-icon"><MoreFilled /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="rename">重命名</el-dropdown-item>
                    <el-dropdown-item command="unpin">取消置顶</el-dropdown-item>
                    <el-dropdown-item command="archive">归档</el-dropdown-item>
                    <el-dropdown-item command="export">导出</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <!-- 最近会话 -->
          <div class="conversation-group">
            <div class="group-label">最近</div>
            <div
              v-for="conv in displayedConversations"
              :key="conv.id"
              class="conversation-item"
              :class="{ active: conv.id === chatStore.currentConversationId }"
              @click="handleSelectConversation(conv.id)"
            >
              <el-checkbox
                :model-value="chatStore.selectedConversations.includes(conv.id)"
                @click.stop
                @change="chatStore.toggleConversationSelection(conv.id)"
              />
              <span class="conversation-icon">💬</span>
              <span class="conversation-title">{{ conv.title }}</span>
              <el-dropdown trigger="click" @command="(cmd: string) => handleConversationAction(cmd, conv)">
                <el-icon class="more-icon"><MoreFilled /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="pin">置顶</el-dropdown-item>
                    <el-dropdown-item command="rename">重命名</el-dropdown-item>
                    <el-dropdown-item command="archive">归档</el-dropdown-item>
                    <el-dropdown-item command="export">导出</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <div v-if="displayedConversations.length === 0" class="empty-hint">
              暂无会话
            </div>
          </div>

          <!-- 归档会话 -->
          <div v-if="chatStore.archivedConversations.length > 0" class="conversation-group">
            <div class="group-label">已归档</div>
            <div
              v-for="conv in chatStore.archivedConversations"
              :key="conv.id"
              class="conversation-item archived"
              @click="handleSelectConversation(conv.id)"
            >
              <span class="conversation-icon">📦</span>
              <span class="conversation-title">{{ conv.title }}</span>
              <el-button size="small" text type="primary" @click.stop="handleUnarchive(conv.id)">
                恢复
              </el-button>
            </div>
          </div>
        </el-scrollbar>
        
        <div 
          class="chat-sidebar-resize-handle"
          @mousedown="startChatSidebarResize"
        ></div>
      </div>

      <!-- 右侧聊天区域 -->
      <div class="chat-main">
        <template v-if="chatStore.currentConversation">
          <div class="chat-header">
            <div class="chat-info">
              <span class="chat-title">{{ chatStore.currentConversation.title }}</span>
              <el-tag v-if="chatStore.currentConversation.modelId" size="small" type="info">
                {{ getModelName(chatStore.currentConversation.providerId, chatStore.currentConversation.modelId) }}
              </el-tag>
            </div>
          </div>

           <div class="messages-container" ref="messagesContainer">
             <!-- Hermes 记忆管理抽屉 — 已抽出到 src/components/chat/HermesMemoryDrawer.vue -->
             <HermesMemoryDrawer />

             <!-- Hermes记忆面板 -->
             <div v-if="hermesMemoryStore.showMemoryPanel" class="memory-panel">
               <div class="memory-panel-header">
                 <div class="memory-panel-title">
                   <span class="memory-panel-icon">🧠</span>
                   <span>Hermes 记忆注入</span>
                 </div>
                 <div class="memory-panel-actions">
                   <el-switch 
                     v-model="hermesMemoryStore.memoryEnabled" 
                     active-text="启用" 
                     inactive-text="禁用"
                     size="small"
                   />
                   <el-button size="small" text @click="hermesMemoryStore.toggleMemoryPanel">
                     <el-icon><Close /></el-icon>
                   </el-button>
                 </div>
               </div>
               <div class="memory-panel-content">
                 <div v-if="!hermesMemoryStore.memoryEnabled" class="memory-disabled-hint">
                   记忆功能已禁用，模型无法访问您的偏好和习惯
                 </div>
                 <div v-else-if="!hermesMemoryStore.hasMemory" class="memory-empty-hint">
                   暂无记忆内容，您可以在系统设置中添加核心记忆
                 </div>
                 <div v-else class="memory-content">
                   <div v-if="hermesMemoryStore.coreMemory" class="memory-section">
                     <div class="memory-section-title">📝 核心记忆</div>
                     <div class="memory-section-content">{{ hermesMemoryStore.coreMemory }}</div>
                   </div>
                   <div v-if="hermesMemoryStore.experienceMemory" class="memory-section">
                     <div class="memory-section-title">💡 经验记忆</div>
                     <div class="memory-section-content">{{ hermesMemoryStore.experienceMemory }}</div>
                   </div>
                   <div v-if="hermesMemoryStore.memories.length > 0" class="memory-section">
                     <div class="memory-section-title">💬 对话记忆 ({{ hermesMemoryStore.memories.length }})</div>
                     <div class="memory-list">
                       <div 
                         v-for="mem in hermesMemoryStore.memories.slice(-5).reverse()" 
                         :key="mem.id" 
                         class="memory-item"
                       >
                         <div class="memory-item-time">{{ new Date(mem.timestamp).toLocaleString('zh-CN') }}</div>
                         <div class="memory-item-content">{{ mem.content }}</div>
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
             </div>

             <!-- Phase 6: 任务执行状态显示 -->
             <div v-if="chatStore.executingTask" class="task-execution-status">
              <div class="task-status-header">
                <span class="task-status-icon">⚡</span>
                <span class="task-status-text">任务执行中...</span>
                <div class="task-status-spinner"></div>
              </div>
              <div v-if="chatStore.currentTaskResult?.steps?.length" class="task-steps-list">
                <div
                  v-for="step in chatStore.currentTaskResult.steps"
                  :key="step.order"
                  class="task-step-item"
                  :class="step.status"
                >
                  <span class="step-icon">
                    {{ step.status === 'success' ? '✅' : step.status === 'failed' ? '❌' : step.status === 'running' ? '🔄' : '⏳' }}
                  </span>
                  <span class="step-desc">{{ step.description }}</span>
                </div>
              </div>
            </div>

            <div class="messages-list" ref="messagesContainer" @scroll="handleScroll">
              <TransitionGroup name="message">
                <div
                  v-for="message in chatStore.currentConversation.messages"
                  :key="message.id"
                  class="message"
                  :class="[message.role, { streaming: message.status === 'streaming' }]"
                >
                  <div class="message-avatar" :class="message.role">
                    <span v-if="message.role === 'assistant'" class="pixel-avatar">
                      <div class="pixel-avatar-inner">
                        <span class="pixel-pip">🦐</span>
                      </div>
                    </span>
                    <span v-else class="user-avatar">👤</span>
                  </div>
                <div class="message-content">
                  <div class="message-text thinking-section" v-if="message.thinking">
                    <div class="thinking-header" @click="toggleThinking(message.id)">
                      <span class="thinking-icon">{{ expandedThinking[message.id] ? '▼' : '▶' }}</span>
                      <span>🤔 思考过程</span>
                      <div class="thinking-indicator">
                        <div v-if="message.status === 'streaming'" class="thinking-spinner"></div>
                        <span>{{ message.thinking.length }} 字</span>
                      </div>
                    </div>
                    <div class="thinking-content" v-show="expandedThinking[message.id]">
                      <pre class="thinking-pre">{{ message.thinking }}</pre>
                    </div>
                  </div>
                  <!-- 任务执行结果详情 -->
                  <TaskResultCard 
                    v-if="message.taskResult"
                    :success="message.taskResult.success"
                    :duration="message.taskResult.duration"
                    :summary="message.taskResult.summary"
                    :error="message.taskResult.error"
                    :steps="message.taskResult.steps || []"
                    :defaultExpanded="false"
                  />
                  <!-- 普通消息文本 -->
                  <div class="message-text" v-if="message.content && !message.taskResult">
                    <span v-html="renderMarkdown(message.content)"></span>
                    <span v-if="message.status === 'streaming'" class="typing-cursor">▋</span>
                  </div>
                  <div class="message-text loading" v-else-if="message.status === 'streaming'">
                    <span class="typing-cursor">▋</span>
                  </div>
                  <div class="message-text loading" v-else-if="message.status === 'sending'">
                    <span class="loading-dots">...</span>
                  </div>
                  <div class="message-error" v-if="message.error">
                    {{ message.error }}
                  </div>
                  <div class="message-actions" v-if="message.role === 'assistant' && message.content">
                    <el-tooltip :content="message.thinking ? '复制全部（含思考过程）' : '复制'">
                      <el-button size="small" text @click="handleCopy(message)">
                        <el-icon><CopyDocument /></el-icon>
                      </el-button>
                    </el-tooltip>
                    <el-tooltip content="重新生成">
                      <el-button size="small" text @click="handleRegenerate(message.id)" :disabled="chatStore.sending">
                        <el-icon><RefreshRight /></el-icon>
                      </el-button>
                    </el-tooltip>
                    <el-tooltip content="继续">
                      <el-button size="small" text @click="handleContinue" :disabled="chatStore.sending">
                        <el-icon><DArrowRight /></el-icon>
                      </el-button>
                    </el-tooltip>
                  </div>
                  <!-- 用户消息操作按钮 -->
                  <div class="message-actions" v-if="message.role === 'user' && message.content">
                    <el-tooltip content="复制">
                      <el-button size="small" text @click="handleCopy(message)">
                        <el-icon><CopyDocument /></el-icon>
                      </el-button>
                    </el-tooltip>
                    <!-- 暂时隐藏未完善的功能 -->
                  </div>
                  <div class="message-meta">
                    <span class="message-time">{{ formatTime(message.timestamp) }}</span>
                    <el-tag v-if="message.modelId" size="small" type="info" class="model-tag">
                      {{ getModelName(message.providerId, message.modelId) }}
                    </el-tag>
                    <!-- 消息状态标签 -->
                    <span v-if="message.role === 'assistant'" class="message-status-tag">
                      <el-icon v-if="message.status === 'streaming'" class="status-icon"><Loading /></el-icon>
                      <span v-if="message.status === 'streaming'"> 生成中</span>
                      <span v-else-if="message.status === 'stopped'" class="status-stopped">（已停止生成）</span>
                      <span v-else-if="message.status === 'error'" class="status-error">{{ message.error }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </TransitionGroup>
            </div>
          </div>

          <div class="input-area">
            <div class="model-selector">
              <el-select
                v-model="currentProviderId"
                placeholder="选择提供商"
                size="small"
                @change="handleProviderChange"
              >
                <el-option
                  v-for="provider in enabledProviders"
                  :key="provider.id"
                  :label="provider.name"
                  :value="provider.id"
                  :disabled="provider.models.length === 0"
                />
              </el-select>
              <el-select
                v-model="currentModelId"
                placeholder="选择模型"
                size="small"
                :disabled="!canSelectModel || currentModels.length === 0"
              >
                <el-option
                  v-if="currentModels.length === 0"
                  key="empty"
                  label="暂无可用模型"
                  :value="null"
                  disabled
                />
                <el-option
                  v-for="model in currentModels"
                  :key="model.id"
                  :label="model.name"
                  :value="model.id"
                />
              </el-select>
            </div>
            
            <!-- 文件/图片预览 -->
            <FilePreview 
              v-if="attachedFiles.length > 0" 
              :files="attachedFiles" 
              @remove="removeAttachedFile" 
              @clear="clearAllAttachedFiles" 
            />
            
            <!-- 引用消息预览 -->
            <div v-if="chatStore.quotedMessage" class="quoted-message-preview">
              <div class="quoted-header">
                <span class="quoted-label">引用: {{ chatStore.quotedMessage.role === 'user' ? '你' : 'AI' }}</span>
                <el-button size="small" text @click="chatStore.clearQuotedMessage">
                  <el-icon><Close /></el-icon>
                </el-button>
              </div>
              <div class="quoted-content">{{ chatStore.quotedMessage.content.substring(0, 100) }}{{ chatStore.quotedMessage.content.length > 100 ? '...' : '' }}</div>
            </div>

            <div 
              class="input-row" 
              @dragover.prevent="handleDragOver" 
              @drop.prevent="handleDrop"
              @paste="handlePaste"
            >
              <el-input
                v-model="inputMessage"
                type="textarea"
                :rows="2"
                placeholder="输入消息... (Shift+Enter 换行，Enter 发送)"
                @keydown.enter.exact.prevent="handleSend"
                @keydown.enter.shift.exact="handleShiftEnter"
              />
              <div class="input-actions">
                <el-button
                  v-if="chatStore.isGenerating"
                  type="danger"
                  @click="chatStore.stopGeneration"
                >
                  <el-icon><VideoPause /></el-icon>
                  停止
                </el-button>
                <el-button
                  v-else
                  type="primary"
                  :disabled="!inputMessage.trim() && attachedFiles.length === 0"
                  @click="handleSend"
                >
                  <el-icon><Promotion /></el-icon>
                  发送
                </el-button>
              </div>
            </div>
          </div>
        </template>

        <div class="empty-chat" v-else>
          <div class="empty-content">
            <div class="empty-greeting">
              <span class="empty-icon">👋</span>
              <h2 class="empty-title">{{ greetingText }}</h2>
              <p class="empty-desc">PiPiClaw 已经准备就绪。从下面挑一个开始,或者直接输入问题。</p>
            </div>

            <div class="empty-prompts-host" v-if="enabledProviders.length > 0">
              <!-- 已抽出到 src/components/chat/QuickPrompts.vue -->
              <QuickPrompts
                :enabled-providers-count="enabledProviders.length"
                @prompt-selected="handleQuickPrompt"
              />
            </div>

            <div class="empty-actions">
              <el-button type="primary" size="large" @click="handleNewChat" class="empty-new-chat">
                <el-icon><Plus /></el-icon>
                新建对话
              </el-button>
              <el-button size="large" @click="$router.push('/models')" v-if="enabledProviders.length === 0">
                <el-icon><Setting /></el-icon>
                去配置模型
              </el-button>
              <el-button size="large" @click="openCommandPalette">
                <el-icon><Search /></el-icon>
                命令面板
                <kbd>Ctrl K</kbd>
              </el-button>
            </div>

            <div class="empty-tip" v-if="enabledProviders.length === 0">
              <el-icon><WarningFilled /></el-icon>
              <span>还没有配置 LLM 模型 — 先到 <a @click="$router.push('/models')">模型管理</a> 添加 OpenAI / Anthropic / 智谱 / Ollama 等</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 设置对话框 -->
    <el-dialog v-model="showSettings" title="对话设置" width="500px" transition-name="fade-scale">
      <el-form label-width="100px">
        <el-form-item label="温度 (Temperature)">
          <el-slider
            v-model="localSettings.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            :format-tooltip="(val: number) => val.toFixed(1)"
          />
          <span class="setting-value">{{ localSettings.temperature.toFixed(1) }}</span>
        </el-form-item>
        <el-form-item label="最大长度 (Max Tokens)">
          <el-input-number
            v-model="localSettings.maxTokens"
            :min="100"
            :max="8192"
            :step="100"
          />
        </el-form-item>
        <el-form-item label="Top P">
          <el-slider
            v-model="localSettings.topP"
            :min="0"
            :max="1"
            :step="0.05"
            :format-tooltip="(val: number) => val.toFixed(2)"
          />
          <span class="setting-value">{{ localSettings.topP.toFixed(2) }}</span>
        </el-form-item>
        <el-form-item label="频率惩罚">
          <el-slider
            v-model="localSettings.frequencyPenalty"
            :min="-2"
            :max="2"
            :step="0.1"
            :format-tooltip="(val: number) => val.toFixed(1)"
          />
          <span class="setting-value">{{ localSettings.frequencyPenalty.toFixed(1) }}</span>
        </el-form-item>
        <el-form-item label="存在惩罚">
          <el-slider
            v-model="localSettings.presencePenalty"
            :min="-2"
            :max="2"
            :step="0.1"
            :format-tooltip="(val: number) => val.toFixed(1)"
          />
          <span class="setting-value">{{ localSettings.presencePenalty.toFixed(1) }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSettings = false">取消</el-button>
        <el-button type="primary" @click="handleSaveSettings">保存</el-button>
      </template>
     </el-dialog>

     <!-- 任务确认对话框 -->
     <el-dialog
       v-model="chatStore.showTaskConfirmDialog"
       title="确认执行任务"
       width="600px"
       :close-on-click-modal="false"
       :close-on-press-escape="false"
     >
       <div class="task-confirm-content">
         <div class="task-confirm-instruction">
           <div class="task-confirm-label">执行指令：</div>
           <div class="task-confirm-text">{{ chatStore.pendingTaskPlan?.instruction }}</div>
         </div>
         
         <div class="task-confirm-steps">
           <div class="task-confirm-label">执行计划：</div>
           <div class="task-steps-preview">
             <div
               v-for="(step, index) in chatStore.pendingTaskPlan?.steps"
               :key="index"
               class="task-step-preview"
             >
               <span class="step-number">{{ step.order }}</span>
               <span class="step-desc">{{ step.description }}</span>
             </div>
           </div>
         </div>

         <el-alert
           type="info"
           :closable="false"
           class="task-confirm-alert"
         >
           <template #title>
             确认后将执行上述操作，请确保您已授予相应的权限
           </template>
         </el-alert>
       </div>

       <template #footer>
         <div class="task-confirm-actions">
           <el-button @click="chatStore.cancelExecuteTask">
             取消
           </el-button>
           <el-button 
             type="primary" 
             @click="handleConfirmExecute"
             :loading="chatStore.executingTask"
           >
             确认执行
           </el-button>
         </div>
       </template>
     </el-dialog>

     <!-- Phase 2: 任务预览确认对话框 -->
     <el-dialog
       v-model="showPreviewDialog"
       title="确认执行任务"
       width="700px"
       :close-on-click-modal="false"
       :close-on-press-escape="false"
     >
       <div class="preview-content">
         <div class="preview-instruction">
           <div class="preview-label">执行指令：</div>
           <div class="preview-text">{{ previewData?.originalInstruction }}</div>
         </div>

         <div class="preview-steps">
           <div class="preview-label">执行计划：</div>
           <div class="preview-steps-list">
             <div
               v-for="(step, index) in previewData?.steps"
               :key="index"
               class="preview-step-item"
             >
               <span class="preview-step-order">{{ step.order }}</span>
               <span class="preview-step-desc">{{ step.description }}</span>
             </div>
           </div>
         </div>

         <div v-if="hasEditableContent" class="preview-content-edit">
           <div class="preview-label">生成内容：</div>
           <el-input
             v-model="editedContent"
             type="textarea"
             :rows="10"
             placeholder="AI生成的内容显示在此..."
           />
         </div>

         <el-alert
           type="info"
           :closable="false"
           class="preview-alert"
         >
           <template #title>
             请确认上述操作和内容，您可以编辑内容或取消执行
           </template>
         </el-alert>
       </div>

       <template #footer>
         <div class="preview-actions">
           <el-button @click="handlePreviewCancel">
             <el-icon><Close /></el-icon>
             取消
           </el-button>
           <el-button 
             type="primary" 
             @click="handlePreviewConfirm"
             :loading="chatStore.executingTask"
           >
             <el-icon><Promotion /></el-icon>
             确认执行
           </el-button>
         </div>
       </template>
     </el-dialog>
   </div>
 </template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch, nextTick, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, MoreFilled, Promotion, VideoPause, CopyDocument, RefreshRight, DArrowRight, Search, Close, Loading, Setting, WarningFilled } from '@element-plus/icons-vue';
// P1-6: marked + highlight.js 改动态导入,避免 vendor-text 988KB 进首屏
// (用户进入 Chat 页才会触发首条消息渲染,延迟加载 ≈0 感知)

import FilePreview from '@/components/chat/FilePreview.vue';
import TaskResultCard from '@/components/chat/TaskResultCard.vue';
import HermesMemoryDrawer from '@/components/chat/HermesMemoryDrawer.vue';
import QuickPrompts from '@/components/chat/QuickPrompts.vue';

import { useChatStore } from '@/stores/chat';
import { useModelsStore } from '@/stores/models';
import { useExecutionModeStore } from '@/stores/executionMode';
import { useModelRouterStore } from '@/stores/modelRouter';
import { useHermesMemoryStore } from '@/stores/hermesMemory';
import { useGatewayStore } from '@/stores/gateway';
import { usePermissionsStore } from '@/stores/permissions';

// P1-6: marked + highlight.js/core 首次渲染消息时再加载
// 用 lib/core (不带全语言注册),仅按需注册 10 种常用语言
// 避免 import 'highlight.js' 触发全 190+ 语言自动注册 (chunk ~947KB)
const COMMON_LANGS = [
  'javascript', 'typescript', 'python', 'java', 'go',
  'json', 'xml', 'sql', 'bash', 'css',
] as const;

let markedInstance: typeof import('marked')['marked'] | null = null;
let hljsInstance: typeof import('highlight.js').default | null = null;
let markdownReady: Promise<void> | null = null;
async function ensureMarkdownLoaded(): Promise<void> {
  if (markdownReady) return markdownReady;
  markdownReady = (async () => {
    // 关键: 'highlight.js/lib/core' 不自动注册任何语言,纯核心 (~50KB)
    const [{ marked }, hljsMod, ...langMods] = await Promise.all([
      import('marked'),
      import('highlight.js/lib/core'),
      ...COMMON_LANGS.map(lang => import(`highlight.js/lib/languages/${lang}`)),
    ]);
    hljsInstance = hljsMod.default;
    // 仅注册常用 10 种语言
    langMods.forEach((mod, i) => {
      const lang = COMMON_LANGS[i];
      hljsInstance!.registerLanguage(lang, mod.default);
    });
    marked.setOptions({ breaks: true, gfm: true });
    marked.use({
      renderer: {
        code(code: string, lang?: string): string {
          if (lang && hljsInstance!.getLanguage(lang)) {
            return `<pre><code class="hljs language-${lang}">${hljsInstance!.highlight(code, { language: lang }).value}</code></pre>`;
          }
          // 未知 / 未注册语言: 跳过高亮,escape HTML
          return `<pre><code class="hljs">${escapeHtml(code)}</code></pre>`;
        }
      }
    } as unknown as Parameters<typeof marked.use>[0]);
    markedInstance = marked;
  })();
  return markdownReady;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

// 提前开始加载,利用 idle 时间
void ensureMarkdownLoaded();

const chatStore = useChatStore();
const modelsStore = useModelsStore();
const executionModeStore = useExecutionModeStore();
const modelRouterStore = useModelRouterStore();
const hermesMemoryStore = useHermesMemoryStore();
const gatewayStore = useGatewayStore();
const permissionsStore = usePermissionsStore();
const route = useRoute();
const router = useRouter();

const inputMessage = ref('');
const chatSidebarWidth = ref(280);
const CHAT_SIDEBAR_MIN_WIDTH = 200;

// P5-UX: 快速提示词模板 — 已抽出到 src/components/chat/QuickPrompts.vue

const greetingText = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了 — 还有我能帮的吗?'
  if (hour < 12) return '早上好 ☀️'
  if (hour < 14) return '中午好,该吃饭啦'
  if (hour < 18) return '下午好,继续加油'
  if (hour < 22) return '晚上好,辛苦了一天'
  return '深夜了 — 别忘了休息'
})

async function handleQuickPrompt(p: { prompt: string }): Promise<void> {
  if (enabledProviders.value.length === 0) {
    ElMessage.warning('请先到「模型管理」配置 LLM')
    router.push('/models')
    return
  }
  // 先创建新对话,再填入 prompt
  const conv = await chatStore.createConversation({
    providerId: currentProviderId.value || undefined,
    modelId: currentModelId.value || undefined,
  })
  if (conv) {
    inputMessage.value = p.prompt
    ElMessage.success('已创建新对话,prompt 已填入')
    nextTick(() => {
      const el = document.querySelector('.chat-input textarea') as HTMLTextAreaElement | null
      el?.focus()
    })
  }
}

function openCommandPalette(): void {
  window.dispatchEvent(new CustomEvent('cmd:open-palette'))
}
const CHAT_SIDEBAR_MAX_WIDTH = 400;
let isChatSidebarResizing = false;

function startChatSidebarResize(_e: MouseEvent): void {
  isChatSidebarResizing = true;
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', handleChatSidebarResize);
  document.addEventListener('mouseup', stopChatSidebarResize);
}

function handleChatSidebarResize(e: MouseEvent): void {
  if (!isChatSidebarResizing) return;
  
  const newWidth = e.clientX;
  if (newWidth >= CHAT_SIDEBAR_MIN_WIDTH && newWidth <= CHAT_SIDEBAR_MAX_WIDTH) {
    chatSidebarWidth.value = newWidth;
  }
}

function stopChatSidebarResize(): void {
  isChatSidebarResizing = false;
  document.body.style.userSelect = '';
  document.removeEventListener('mousemove', handleChatSidebarResize);
  document.removeEventListener('mouseup', stopChatSidebarResize);
  // 保存宽度到本地存储
  localStorage.setItem('chatSidebarWidth', chatSidebarWidth.value.toString());
}

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: 'image' | 'document';
  mimeType: string;
  url?: string;
  base64?: string;
  path?: string;
  content?: string;
}

const attachedFiles = ref<AttachedFile[]>([]);
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h',
  '.html', '.css', '.scss', '.vue', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg',
  '.log', '.csv', '.sql',
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico',
  '.pdf',
  '.xlsx', '.xls', '.docx', '.doc'
]);

const showSettings = ref(false);
const messagesContainer = ref<HTMLElement | null>(null);
const expandedThinking = reactive<Record<string, boolean>>({});
const isAtBottom = ref(true); // 用户是否在聊天底部


// Phase 2: 任务预览确认状态
const showPreviewDialog = ref(false);
const previewData = ref<any>(null);
const editedContent = ref('');
let previewResolve: ((result: { confirmed: boolean; editedContent?: string }) => void) | null = null;

const hasEditableContent = computed(() => {
  if (!previewData.value?.steps) return false;
  return previewData.value.steps.some((step: any) => step.contentFull);
});

function handlePreviewCancel() {
  showPreviewDialog.value = false;
  if (previewResolve) {
    previewResolve({ confirmed: false });
    previewResolve = null;
  }
}

async function handlePreviewConfirm() {
  showPreviewDialog.value = false;
  if (previewResolve) {
    previewResolve({ confirmed: true, editedContent: hasEditableContent.value ? editedContent.value : undefined });
    previewResolve = null;
  }
}

// 监听预览事件
function listenForPreviewEvents() {
  if (typeof window.electronAPI?.task?.onPreview !== 'function') return;

  const unsubscribe = window.electronAPI.task.onPreview((data: any) => {
    previewData.value = data;
    showPreviewDialog.value = true;

    if (hasEditableContent.value && data.steps.length > 0) {
      const firstStep = data.steps[0];
      editedContent.value = firstStep.contentFull || firstStep.contentPreview || '';
    }

    return new Promise((resolve) => {
      previewResolve = resolve;
    });
  });

  return unsubscribe;
}

const localSettings = reactive({
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0
});

const enabledProviders = computed(() => {
  const result = modelsStore.enabledProviders;
  console.log('[Chat] enabledProviders:', result.map(p => ({
    id: p.id,
    name: p.name,
    type: p.type,
    enabled: p.enabled,
    models: p.models
  })));
  return result;
});

/**
 * 当前选择的 Provider ID
 * 直接绑定到当前会话的 providerId，如果没有则使用全局最后使用的
 */
const currentProviderId = computed({
  get: () => chatStore.currentConversation?.providerId || chatStore.lastProviderId,
  set: (val: string | null) => {
    if (val && chatStore.currentConversationId) {
      console.log('[Chat] 切换供应商: provider=' + val);
      chatStore.setCurrentModel(val, '');
    } else if (val) {
      chatStore.lastProviderId = val;
    }
  }
});

const currentModelId = computed({
  get: () => chatStore.currentConversation?.modelId || chatStore.lastModelId,
  set: (val: string | null) => {
    if (val && chatStore.currentProviderId && chatStore.currentConversationId) {
      console.log('[Chat] 切换模型: provider=' + chatStore.currentProviderId + ', model=' + val);
      chatStore.setCurrentModel(chatStore.currentProviderId, val);
    } else if (val && chatStore.currentProviderId) {
      chatStore.lastModelId = val;
    }
  }
});

/**
 * 当前 Provider 下的模型列表
 */
const currentModels = computed(() => {
  if (!currentProviderId.value) return [];
  const provider = modelsStore.getProviderById(currentProviderId.value);
  return provider?.models || [];
});

/**
 * 是否可以选择模型
 */
const canSelectModel = computed(() => !!currentProviderId.value);

// 检查当前选择的模型是否在可用模型列表中
watch([currentProviderId, currentModels], () => {
  if (currentProviderId.value && currentModelId.value) {
    const modelExists = currentModels.value.some(m => m.id === currentModelId.value);
    if (!modelExists) {
      // 当前选择的模型不在可用列表中，需要重置
      console.log('[Chat] 当前选择的模型不再可用，重置选择');
      if (currentModels.value.length > 0) {
        const provider = modelsStore.getProviderById(currentProviderId.value);
        if (provider?.defaultModel && currentModels.value.some(m => m.id === provider.defaultModel)) {
          currentModelId.value = provider.defaultModel;
        } else {
          currentModelId.value = currentModels.value[0].id;
        }
      } else {
        currentModelId.value = null;
      }
      ElMessage.warning('当前选择的模型不再可用，已自动重置');
    }
  }
});

const recentConversations = computed(() =>
  chatStore.conversations
    .filter(c => c.status === 'active' && !c.pinned)
    .slice(0, 20)
);

const displayedConversations = computed(() => {
  if (searchKeyword.value && chatStore.searchResults.length > 0) {
    return [];
  }
  return recentConversations.value;
});

const searchKeyword = ref('');

function handleSearch(): void {
  chatStore.setSearchKeyword(searchKeyword.value);
}

/**
 * 当前选择的权限集ID
 */
// (currentPermissionSetId unused: was 用于 v-model 绑定,模板未使用)

/**
 * 获取权限集图标
 */
// (getSetIcon unused: 模板未使用)

/**
 * 处理权限集变更
 */
// (handlePermissionSetChange unused: 模板未使用)

onMounted(async () => {
  chatStore.initialize();
  await modelsStore.fetchProviders();
  await executionModeStore.fetchMode();
  await hermesMemoryStore.fetchMemories();
  await permissionsStore.fetchPermissionSets();

  if (chatStore.settings) {
    Object.assign(localSettings, chatStore.settings);
  }

  // 如果当前会话有模型配置，确保选择器显示正确
  const currentConv = chatStore.currentConversation;
  if (currentConv?.providerId) {
    console.log('[Chat] 初始化模型选择:', currentConv.providerId, currentConv.modelId);
  }
  
  // Phase 2: 启动预览事件监听
  listenForPreviewEvents();
  
  // 处理从首页跳转过来的示例指令
  if (route.query.prompt) {
    inputMessage.value = route.query.prompt as string;
  }
  
  // 从本地存储恢复聊天侧边栏宽度
  const savedChatSidebarWidth = localStorage.getItem('chatSidebarWidth');
  if (savedChatSidebarWidth) {
    const parsedWidth = parseInt(savedChatSidebarWidth);
    if (parsedWidth >= CHAT_SIDEBAR_MIN_WIDTH && parsedWidth <= CHAT_SIDEBAR_MAX_WIDTH) {
      chatSidebarWidth.value = parsedWidth;
    }
  }

  // 监听命令面板事件 (Cmd+K 联动)
  window.addEventListener('cmd:new-chat', handleNewChat)
  window.addEventListener('cmd:fill-chat', handleFillChat as EventListener)

  // 初始加载完成后，滚动到底部（即时）
  nextTick(() => {
    scrollToBottom(true, true);
  });
});

function handleFillChat(e: CustomEvent<{ text: string }>): void {
  const text = e.detail?.text || ''
  inputMessage.value = text
  nextTick(() => {
    const el = document.querySelector('.chat-input textarea') as HTMLTextAreaElement | null
    el?.focus()
  })
}

onUnmounted(() => {
  document.removeEventListener('mousemove', handleChatSidebarResize);
  document.removeEventListener('mouseup', stopChatSidebarResize);
  window.removeEventListener('cmd:new-chat', handleNewChat);
  window.removeEventListener('cmd:fill-chat', handleFillChat as EventListener);
});

// 监听对话切换
watch(() => chatStore.currentConversationId, () => {
  // 切换对话时即时滚动到底部
  nextTick(() => {
    scrollToBottom(true, true);
  });
});

/**
 * 检测用户是否在聊天底部（50px 阈值）
 */
function checkIsAtBottom(): boolean {
  if (!messagesContainer.value) return true;
  const container = messagesContainer.value;
  const threshold = 50; // 距离底部 50px 以内认为是在底部
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
}

/**
 * 滚动到底部（智能判断）
 */
function scrollToBottom(force = false, instant = false): void {
  nextTick(() => {
    if (!messagesContainer.value) return;
    
    const container = messagesContainer.value;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    
    // 智能判断：如果用户向上滚动超过 50px，且不是强制滚动，则不滚动
    if (!force && distanceFromBottom > 50) {
      return;
    }
    
    container.scrollTo({
      top: container.scrollHeight,
      behavior: instant ? 'instant' : 'smooth'
    });
    isAtBottom.value = true;
  });
}

/**
 * 处理滚动事件，更新isAtBottom状态
 */
function handleScroll(): void {
  isAtBottom.value = checkIsAtBottom();
}

// 监听消息数量变化
watch(() => chatStore.currentConversation?.messages.length, () => {
  // 消息数量变化时，滚动到底部（只有在用户原本在底部时才滚动）
  scrollToBottom(false);
});

// 监听每条消息的内容变化（针对流式输出）
watch(() => {
  const conv = chatStore.currentConversation;
  if (!conv || conv.messages.length === 0) return null;
  // 只检查最后一条助手消息的长度变化
  const lastMsg = conv.messages[conv.messages.length - 1];
  if (lastMsg.role === 'assistant') {
    return lastMsg.content?.length || 0;
  }
  return null;
}, (newLength, oldLength) => {
  // 只有在内容增加且用户在底部时才滚动
  if (newLength && oldLength && newLength > oldLength && isAtBottom.value) {
    // 节流：只有内容增长一定长度才滚动
    if (newLength - oldLength > 5) {
      scrollToBottom(false);
    }
  }
}, { deep: true });

function getModelName(providerId?: string, modelId?: string): string {
  if (!providerId || !modelId) return '未知模型';
  const provider = modelsStore.getProviderById(providerId);
  if (!provider) return modelId;
  const model = provider.models.find(m => m.id === modelId);
  return model?.name || modelId;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function renderMarkdown(content: string): string {
  // 异步加载时 fallback: 简单转义,不让用户看到空白
  if (!markedInstance) {
    // 异步触发加载,本次返回转义后纯文本
    void ensureMarkdownLoaded();
    return content.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  }
  return markedInstance.parse(content) as string;
}

async function handleCopy(message: any): Promise<void> {
  try {
    let text = '';
    
    // 如果有思考过程，添加到复制内容中
    if (message.thinking) {
      text += '【思考过程】\n' + message.thinking + '\n\n';
    }
    
    // 添加正文
    text += message.content;
    
    await navigator.clipboard.writeText(text);
    ElMessage.success('已复制');
  } catch {
    ElMessage.error('复制失败');
  }
}

async function handleRegenerate(messageId: string): Promise<void> {
  const conv = chatStore.currentConversation;
  if (!conv) return;

  // 执行前校验并启动网关
  await gatewayStore.ensureRunning();

  const msgIndex = conv.messages.findIndex(m => m.id === messageId);
  if (msgIndex > 0) {
    const userMsg = conv.messages[msgIndex - 1];
    if (userMsg.role === 'user') {
      await chatStore.sendMessage(userMsg.content, userMsg.providerId!, userMsg.modelId!);
    }
  }
}

async function handleContinue(): Promise<void> {
  // 执行前校验并启动网关
  await gatewayStore.ensureRunning();
  await chatStore.continueGeneration();
}

async function toggleThinking(messageId: string): Promise<void> {
  expandedThinking[messageId] = !expandedThinking[messageId];
}

/**
 * 监听当前会话变化
 * 当切换到新会话时，确保全局最后使用的模型被更新
 */
watch(() => chatStore.currentConversationId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    const conv = chatStore.currentConversation;
    if (conv?.providerId && conv?.modelId) {
      // 同步到全局
      chatStore.lastProviderId = conv.providerId;
      chatStore.lastModelId = conv.modelId;
      console.log('[Chat] 切换会话，同步全局模型:', conv.providerId, conv.modelId);
    }
    // 切换会话时，强制滚动到底部
    scrollToBottom(true);
  }
});

watch(() => chatStore.currentConversation?.messages, (messages) => {
  messages?.forEach(msg => {
    if (msg.thinking && expandedThinking[msg.id] === undefined) {
      expandedThinking[msg.id] = true;
    }
  });
}, { immediate: true, deep: true });

async function handleNewChat(): Promise<void> {
  // 新建对话时，会自动继承上一个对话的模型（在 store 中处理）
  const conv = await chatStore.createConversation({
    providerId: currentProviderId.value || undefined,
    modelId: currentModelId.value || undefined
  });
  if (conv) {
    ElMessage.success('新对话已创建');
  }
}

function handleSelectConversation(id: string): void {
  // 切换会话时，模型选择器会自动通过 computed 属性更新
  // 不需要手动同步
  chatStore.selectConversation(id);
}

async function handleConversationAction(command: string, conv: any): Promise<void> {
  switch (command) {
    case 'pin':
      await chatStore.pinConversation(conv.id, true);
      ElMessage.success('已置顶');
      break;
    case 'unpin':
      await chatStore.pinConversation(conv.id, false);
      ElMessage.success('已取消置顶');
      break;
    case 'rename':
      const { value } = await ElMessageBox.prompt('输入新名称', '重命名', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: conv.title
      });
      if (value) {
        await chatStore.updateConversation(conv.id, { title: value });
        ElMessage.success('已重命名');
      }
      break;
    case 'archive':
      await chatStore.archiveConversation(conv.id);
      ElMessage.success('已归档');
      break;
    case 'export':
      await handleExportSingle(conv, 'markdown');
      break;
    case 'delete':
      try {
        await ElMessageBox.confirm('确定要删除这个会话吗？', '删除确认', {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning'
        });
        await chatStore.deleteConversation(conv.id);
        ElMessage.success('已删除');
      } catch {}
      break;
  }
}

async function handleExportSingle(conv: any, format: string): Promise<void> {
  try {
    const result = await window.electronAPI?.conversation?.export(conv, format as any);
    if (result?.success) {
      ElMessage.success(`已导出到: ${result.data?.filePath}`);
    } else {
      ElMessage.error(result?.error || '导出失败');
    }
  } catch (err: any) {
    ElMessage.error(err.message || '导出失败');
  }
}

async function handleBatchDelete(): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${chatStore.selectedConversations.length} 个会话吗？`, '批量删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    });
    await chatStore.batchDeleteConversations(chatStore.selectedConversations);
    ElMessage.success('批量删除完成');
  } catch {}
}

async function handleBatchArchive(): Promise<void> {
  for (const id of chatStore.selectedConversations) {
    await chatStore.archiveConversation(id);
  }
  chatStore.clearConversationSelection();
  ElMessage.success('批量归档完成');
}

async function handleUnarchive(id: string): Promise<void> {
  await chatStore.unarchiveConversation(id);
  ElMessage.success('已恢复');
}

// ========== 多模态输入处理 ==========
function handleDragOver(e: DragEvent): void {
  e.dataTransfer!.dropEffect = 'copy';
}

async function handleDrop(e: DragEvent): Promise<void> {
  const files = Array.from(e.dataTransfer?.files || []);
  await processFiles(files);
}

async function handlePaste(e: ClipboardEvent): Promise<void> {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        await processFiles([file]);
      }
    }
  }
}

async function processFiles(files: File[]): Promise<void> {
  for (const file of files) {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase() || '';
    
    // 校验格式
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      ElMessage.warning(`不支持的文件格式: ${ext}`);
      continue;
    }
    
    // 校验大小
    if (file.size > MAX_FILE_SIZE) {
      ElMessage.warning(`文件大小超过限制 (${MAX_FILE_SIZE / 1024 / 1024}MB)`);
      continue;
    }

    const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(ext);
    
    // 读取文件内容
    const fileData = await readFileAsData(file, isImage);
    
    attachedFiles.value.push({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: isImage ? 'image' : 'document',
      mimeType: file.type,
      ...fileData
    });
  }
}

function readFileAsData(file: File, isImage: boolean): Promise<{ url?: string; base64?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (isImage) {
        const base64 = result.split(',')[1];
        resolve({ base64, url: result });
      } else {
        resolve({});
      }
    };
    if (isImage) {
      reader.readAsDataURL(file);
    } else {
      resolve({});
    }
  });
}

function removeAttachedFile(index: number): void {
  attachedFiles.value.splice(index, 1);
}

function clearAllAttachedFiles(): void {
  attachedFiles.value = [];
}

function handleProviderChange(): void {
  // 切换 Provider 时自动清空 Model 选择
  currentModelId.value = null;

  // 获取当前 provider
  if (!currentProviderId.value) return;
  const provider = modelsStore.getProviderById(currentProviderId.value);
  
  // 如果该 provider 有模型并且有默认模型，则自动选择
  if (provider?.models && provider.models.length > 0) {
    if (provider.defaultModel && provider.models.some(m => m.id === provider.defaultModel)) {
      currentModelId.value = provider.defaultModel;
    } else {
      // 没有有效的默认模型，选择第一个模型
      currentModelId.value = provider.models[0].id;
    }
  } else if (provider?.models.length === 0) {
    // 如果该 provider 没有模型，给出提示
    ElMessage.warning(`${provider.name} 暂无可用模型，请先配置模型`);
  }
}

async function handleConfirmExecute(): Promise<void> {
  console.log('[Chat] 用户点击确认执行任务');
  // 执行前校验并启动网关
  await gatewayStore.ensureRunning();
  await chatStore.confirmExecuteTask();
}

async function handleSend(): Promise<void> {
  const content = inputMessage.value.trim();
  if ((!content && attachedFiles.value.length === 0) || chatStore.sending) return;

  console.log('[Chat.vue] ========== handleSend 被调用 ==========');
  console.log('[Chat.vue] 消息内容:', content);
  
  // 不再强制启动网关，本地执行不需要

  // 记忆注入：如果记忆功能启用，生成记忆内容并记录
  let injectedMemory = '';
  if (hermesMemoryStore.memoryEnabled) {
    injectedMemory = hermesMemoryStore.generateInjectedMemory();
    hermesMemoryStore.setCurrentConversationMemory(injectedMemory);
    console.log('[Chat] 记忆已注入:', injectedMemory ? injectedMemory.substring(0, 100) + '...' : '无记忆内容');
  }

  inputMessage.value = '';
  
  // 构建包含附件的消息
  let fullContent = content;
  
  // 处理文档附件 - 简单拼接内容（实际项目中需更复杂处理）
  for (const file of attachedFiles.value) {
    if (file.type === 'document' && file.content) {
      fullContent += `\n\n---\n【附件：${file.name}】\n${file.content}`;
    }
  }
  
  // Auto 模式：智能选择模型
  let providerId = currentProviderId.value;
  let modelId = currentModelId.value;
  
  if (modelRouterStore.isAutoMode) {
    const selectedModel = modelRouterStore.getModelForMessage(fullContent, attachedFiles.value.length > 0);
    if (selectedModel) {
      providerId = selectedModel.providerId;
      modelId = selectedModel.modelId;
    } else {
      // 无可用模型时给出提示
      ElMessage.warning('未找到可用的模型，请先在模型管理中配置并连接测试模型');
      inputMessage.value = content;
      return;
    }
  }
  
  // 发送消息
  await chatStore.sendMessage(fullContent || '请查看附件', providerId ?? '', modelId ?? undefined);
  
  // 强制滚动到底部（发送新消息后）
  scrollToBottom(true);
  
  // 清空附件
  clearAllAttachedFiles();
}

function handleShiftEnter(): void {}

// (handleTestDetection unused: 测试入口未使用,功能可通过 dev tools 调用)
// (handleOpenDevTools unused: 调试用,模板未绑定)
// (handleStop unused: 模板未引用,功能可通过其他方式触发)

async function handleSaveSettings(): Promise<void> {
  await chatStore.updateSettings(localSettings);
  showSettings.value = false;
  ElMessage.success('设置已保存');
}

// (handleCoreMemoryChange + memorySaveTimer 已抽出到 HermesMemoryDrawer.vue)
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

.chat-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat-layout {
  display: flex;
  height: 100%;
  gap: var(--content-padding);
}

.sidebar {
  flex-shrink: 0;
  background: var(--el-bg-color);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md);
  border-bottom: 1px solid var(--el-border-color-light);
  gap: 8px;
}

.new-chat-btn {
  display: flex;
  align-items: center;
  gap: 4px;
}

.new-chat-btn .new-chat-text {
  font-size: 12px;
  margin-left: 2px;
}

.sidebar-title {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-body);
  color: var(--text-color);
}

.conversations-list {
  flex: 1;
  padding: var(--space-sm);
}

.conversation-group {
  margin-bottom: var(--space-md);
}

.group-label {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-secondary);
  padding: var(--space-xs) var(--space-sm);
  text-transform: uppercase;
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
  margin-bottom: var(--space-xs);

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.active {
    background: var(--el-color-primary-light-9);
    border: 1px solid var(--el-color-primary-light-5);
  }
}

.conversation-icon {
  font-size: var(--icon-size-md);
  flex-shrink: 0;
}

.conversation-title {
  flex: 1;
  font-size: var(--font-size-callout);
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-icon {
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-standard);
}

.conversation-item:hover .more-icon {
  opacity: 1;
}

.empty-hint {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-placeholder);
  padding: var(--space-sm);
  text-align: center;
}

.chat-main {
  flex: 1;
  background: linear-gradient(180deg, var(--el-bg-color) 0%, var(--el-bg-color-page) 100%);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  box-shadow: var(--shadow-sm);
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-lg);
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
}

.chat-info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.chat-title {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-body);
  color: var(--text-color);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
  scroll-behavior: smooth;
  /* 自定义滚动条 */
  &::-webkit-scrollbar {
    width: var(--space-sm);
  }

  &::-webkit-scrollbar-track {
    background: var(--el-fill-color-lighter);
    border-radius: var(--radius-sm);
  }

  &::-webkit-scrollbar-thumb {
    background: var(--el-color-primary-light-5);
    border-radius: var(--radius-sm);
    transition: background var(--duration-fast) var(--ease-standard);

    &:hover {
      background: var(--el-color-primary-light-4);
    }
  }
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.message {
  display: flex;
  gap: var(--space-sm);
  max-width: 85%;
}

.message.user {
  flex-direction: row-reverse;
  margin-left: auto;
}

/* 消息入场动画 */
.message-enter-from {
  opacity: 0;
  transform: translateY(var(--space-lg));
}

.message-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: all var(--duration-base) var(--ease-standard);
}

.message-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.message-leave-active {
  opacity: 0;
  transform: translateY(calc(-1 * var(--space-lg)));
  transition: all var(--duration-base) var(--ease-standard);
}

.message.streaming .message-content {
  position: relative;
}

.message-avatar {
  width: var(--space-2xl);
  height: var(--space-2xl);
  border-radius: var(--radius-pill);
  background: var(--el-fill-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-title-2);
  flex-shrink: 0;
  overflow: hidden;
  position: relative;

  &.user {
    background: var(--el-color-primary-light-8);
  }

  &.assistant {
    background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-dark-2) 100%);
  }
}

.pixel-avatar {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%);
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: 
      radial-gradient(circle at 30% 40%, rgba(255, 150, 0, 0.3) 2px, transparent 2px),
      radial-gradient(circle at 70% 30%, rgba(255, 200, 0, 0.25) 1px, transparent 1px),
      radial-gradient(circle at 50% 60%, rgba(255, 180, 0, 0.2) 2px, transparent 2px);
    background-size: 8px 8px, 6px 6px, 10px 10px;
    animation: pixelSparkle 3s ease-in-out infinite;
  }
}

.pixel-avatar-inner {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  transform: scale(1);
  animation: pixelBob 2s ease-in-out infinite;
}

.pixel-pip {
  font-size: var(--font-size-title-1);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

.user-avatar {
  font-size: var(--font-size-title-2);
}

@keyframes pixelSparkle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes pixelBob {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-2px) scale(1.05); }
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.message-content {
  flex: 1;
  min-width: 0;
}

.thinking-section {
  margin-bottom: var(--space-sm);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(251, 191, 36, 0.10) 100%);
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  cursor: pointer;
  font-size: var(--font-size-callout);
  color: var(--el-color-primary);
  font-weight: var(--font-weight-medium);
  transition: background var(--duration-fast) var(--ease-standard);

  &:hover {
    background: rgba(245, 158, 11, 0.08);
  }
}

.thinking-icon {
  font-size: var(--icon-size-md);
  transition: transform var(--duration-fast) var(--ease-standard);
}

.thinking-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-placeholder);
  margin-left: auto;
}

.thinking-spinner {
  width: var(--space-sm);
  height: var(--space-sm);
  border: 2px solid var(--el-color-primary-light-5);
  border-top-color: var(--el-color-primary);
  border-radius: var(--radius-pill);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.thinking-content {
  padding: 0 var(--space-md) var(--space-md);
  border-top: 1px solid var(--el-border-color-lighter);
}

.thinking-pre {
  margin: var(--space-sm) 0 0;
  font-size: var(--font-size-caption-1);
  line-height: var(--line-height-relaxed);
  color: var(--el-text-color-secondary);
  white-space: pre-wrap;
  font-family: var(--font-family-mono);
  background: var(--el-fill-color-light);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
}

.message-text {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-xl);
  background: var(--el-fill-color-light);
  font-size: var(--font-size-body);
  line-height: var(--line-height-relaxed);
  color: var(--el-text-color-primary) !important;
  word-break: break-word;
  word-wrap: break-word;
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--duration-fast) var(--ease-standard);
  /* 防止流式输出抖动的关键样式 */
  min-height: 2.5em;
  white-space: pre-wrap;
  overflow-wrap: break-word;

  &:hover {
    box-shadow: var(--shadow-md);
  }

  .message.user & {
    background: linear-gradient(135deg, var(--el-color-primary-light-9) 0%, var(--el-color-primary-light-8) 100%);
    border-bottom-right-radius: var(--radius-sm);
  }

  .message.assistant & {
    background: var(--el-fill-color-lighter);
    border-bottom-left-radius: var(--radius-sm);
  }

  :deep(pre) {
    background: var(--el-fill-color);
    padding: var(--space-sm);
    border-radius: var(--radius-md);
    overflow-x: auto;
    margin: var(--space-sm) 0;
  }

  :deep(code) {
    font-family: var(--font-family-mono);
    font-size: var(--font-size-callout);
  }

  :deep(pre code) {
    background: transparent;
    padding: 0;
  }

  :deep(p) {
    margin: 0 0 var(--space-sm);

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(ul), :deep(ol) {
    margin: var(--space-sm) 0;
    padding-left: var(--space-lg);
  }

  :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin: var(--space-sm) 0;
  }

  :deep(th), :deep(td) {
    border: 1px solid var(--el-border-color);
    padding: var(--space-sm);
    text-align: left;
  }

  :deep(blockquote) {
    margin: var(--space-sm) 0;
    padding-left: var(--space-sm);
    border-left: var(--space-xs) solid var(--el-color-primary-light-5);
    color: var(--el-text-color-secondary) !important;
  }

  .message.user & {
    background: linear-gradient(135deg, var(--el-color-primary-light-9) 0%, var(--el-color-primary-light-8) 100%);
    color: var(--el-text-color-primary) !important;
    border-bottom-right-radius: var(--radius-sm);
  }

  .message.assistant & {
    background: var(--el-fill-color-light);
    border-bottom-left-radius: var(--radius-sm);
  }
}

.message-text.loading {
  color: var(--el-text-color-secondary);
}

.loading-dots {
  animation: pulse 1.5s infinite;
}

.typing-cursor {
  display: inline-block;
  width: 2px;
  height: 1.2em;
  background-color: var(--el-color-primary);
  margin-left: 2px;
  border-radius: 1px;
  animation: breathe 1.2s ease-in-out infinite;
  vertical-align: -3px;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.3);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes breathe {
  0%, 100% { opacity: 0.2; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1); }
}

.message-error {
  color: var(--el-color-danger);
  font-size: var(--font-size-callout);
  margin-top: var(--space-xs);
}

.message-meta {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-secondary);
  margin-top: var(--space-xs);
  display: flex;
  align-items: center;
  gap: var(--space-sm);

  .message.user & {
    flex-direction: row-reverse;
  }
}

.model-tag {
  font-size: var(--font-size-caption-2);
}

.message-actions {
  display: flex;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-standard);

  .message:hover & {
    opacity: 1;
  }
}

.message-time {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-secondary);
}

.message-status-tag {
  font-size: var(--font-size-caption-1);
  display: flex;
  align-items: center;
  gap: var(--space-xs);

  .status-icon {
    animation: spin 1s linear infinite;
  }

  .status-stopped {
    color: var(--el-text-color-secondary);
    font-style: italic;
  }

  .status-error {
    color: var(--el-color-danger);
  }
}

.input-area {
  padding: var(--space-md) var(--space-lg);
  border-top: 1px solid var(--el-border-color-lighter);
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
}

.model-selector {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);

  .el-select {
    flex: 1;
  }
}

.input-row {
  display: flex;
  gap: var(--space-sm);
  align-items: flex-end;
  background: var(--el-fill-color-lighter);
  border-radius: var(--radius-xl);
  padding: var(--space-xs);
  border: 1px solid var(--el-border-color-lighter);
  transition: border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard);

  &:focus-within {
    border-color: var(--el-color-primary-light-5);
    box-shadow: 0 0 0 var(--space-xs) rgba(102, 126, 234, 0.1);
  }

  .el-textarea {
    .el-textarea__inner {
      border: none;
      box-shadow: none;
      background: transparent;
      resize: none;
      font-size: var(--font-size-body);
      line-height: var(--line-height-relaxed);
      padding: var(--space-sm) var(--space-sm);
    }
  }
}

.input-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-xs);
}

.mode-selector-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 0 var(--space-sm);
}

.mode-icon {
  font-size: var(--icon-size-md);
}

.mode-name {
  font-size: var(--font-size-callout);
}

:deep(.mode-active) {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.mode-item-icon {
  font-size: var(--icon-size-md);
  margin-right: var(--space-xs);
}

.mode-item-name {
  font-size: var(--font-size-callout);
}

.input-row {
  display: flex;
  gap: var(--space-sm);
  align-items: flex-end;

  .el-textarea {
    flex: 1;
  }
}

.input-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.empty-chat {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl);
}

.empty-content {
  width: 100%;
  max-width: 720px;
  text-align: center;
  padding: var(--space-2xl);
}

.empty-greeting {
  margin-bottom: var(--space-2xl);
}

.empty-icon {
  font-size: 56px;
  display: block;
  margin-bottom: var(--space-md);
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.1));
}

.empty-title {
  font-size: var(--font-size-display, 28px);
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
  margin: 0 0 var(--space-sm);
  letter-spacing: -0.02em;
}

.empty-desc {
  font-size: var(--font-size-body);
  color: var(--el-text-color-secondary);
  margin: 0;
  line-height: var(--line-height-relaxed);
}

.empty-prompts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.empty-prompt-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: var(--fg-primary);
  transition: background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);

  &:hover {
    background: var(--bg-hover);
    border-color: var(--accent-base);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
}

.empty-prompt-emoji {
  font-size: 24px;
  flex-shrink: 0;
  line-height: 1;
}

.empty-prompt-body {
  flex: 1;
  min-width: 0;
}

.empty-prompt-title {
  font-size: 14px;
  font-weight: var(--font-weight-medium);
  color: var(--fg-primary);
  margin-bottom: 2px;
}

.empty-prompt-desc {
  font-size: 12px;
  color: var(--fg-tertiary);
  line-height: var(--line-height-normal);
}

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  justify-content: center;
  margin-bottom: var(--space-md);

  kbd {
    font-family: var(--font-family-mono);
    font-size: 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-base);
    border-radius: 3px;
    padding: 1px 4px;
    margin-left: 4px;
    color: var(--fg-tertiary);
  }
}

.empty-tip {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--warning, #d97706);
  border-radius: var(--radius-md);
  font-size: 12px;
  color: var(--fg-secondary);
  text-align: left;
  margin-top: var(--space-md);

  a {
    color: var(--accent-base);
    cursor: pointer;
    text-decoration: underline;
  }

  .el-icon {
    color: var(--warning, #d97706);
    font-size: 16px;
  }
}

/* Phase 6: 任务执行状态样式 */
.task-execution-status {
  background: linear-gradient(135deg, var(--gradient-start)15 0%, var(--gradient-end)15 100%);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
}

.task-status-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-body);
  color: var(--el-color-primary);
  font-weight: var(--font-weight-medium);
}

.task-status-icon {
  font-size: var(--font-size-title-2);
}

.task-status-spinner {
  width: var(--space-md);
  height: var(--space-md);
  border: 2px solid var(--el-color-primary-light-5);
  border-top-color: var(--el-color-primary);
  border-radius: var(--radius-pill);
  animation: spin 1s linear infinite;
  margin-left: auto;
}

.task-steps-list {
  margin-top: var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.task-step-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-sm);
  background: var(--el-bg-color);
  border-radius: var(--radius-md);
  font-size: var(--font-size-callout);
}

.task-step-item.success .step-desc {
  color: var(--el-color-success);
}

.task-step-item.failed .step-desc {
  color: var(--el-color-danger);
}

.task-step-item.running {
  background: var(--el-color-primary-light-9);
}

/* 调试信息样式 */
.debug-info {
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-md);
  padding: var(--space-sm);
  margin-top: var(--space-sm);
}

.debug-title {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-callout);
  color: var(--el-color-primary);
  margin-bottom: var(--space-sm);
}

.debug-content {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-caption-1);
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
  color: var(--el-text-color-regular);
  background: var(--el-bg-color);
  padding: var(--space-sm);
  border-radius: var(--radius-sm);
}

.step-icon {
  font-size: var(--icon-size-md);
}

.step-desc {
  color: var(--text-color);
}

/* Phase 6: 任务结果详情样式 */
.task-result-detail {
  margin-top: var(--space-sm);
  background: var(--el-fill-color-light);
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
}

.task-result-detail .el-tag {
  margin-left: var(--space-sm);
}

.task-result-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-medium);
  padding: var(--space-sm) var(--space-md);
  background: var(--el-bg-color-page);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-standard);
}

.task-result-header:hover {
  background: var(--el-fill-color-lighter);
}

.result-icon {
  font-size: var(--icon-size-md);
}

.result-title {
  color: var(--text-color);
  flex: 1;
}

.result-duration {
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-caption-1);
}

.toggle-icon {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-secondary);
  transition: transform var(--duration-fast) var(--ease-standard);
}

.result-summary {
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-callout);
  color: var(--el-text-color-secondary);
  border-top: 1px solid var(--el-border-color-light);
}

.result-steps {
  padding: 0 var(--space-md) var(--space-sm);
  border-top: 1px solid var(--el-border-color-light);
}

.result-steps-title {
  font-size: var(--font-size-callout);
  font-weight: var(--font-weight-semibold);
  color: var(--el-text-color-primary);
  padding: var(--space-sm) 0 var(--space-sm);
}

.result-step-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-sm);
  background: var(--el-bg-color);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-callout);
  margin-bottom: var(--space-sm);
}

.result-step-item:last-child {
  margin-bottom: 0;
}

.step-index {
  width: var(--space-lg);
  height: var(--space-lg);
  border-radius: var(--radius-pill);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-caption-1);
  font-weight: var(--font-weight-semibold);
  flex-shrink: 0;
}

.step-status {
  font-size: var(--font-size-body);
}

.step-description {
  flex: 1;
  color: var(--text-color);
}

.setting-value {
  min-width: 50px;
  text-align: right;
  margin-left: var(--space-sm);
  color: var(--el-text-color-secondary);
}

/* Hermes记忆面板样式 */
.memory-panel {
  background: linear-gradient(135deg, var(--gradient-start)10 0%, var(--gradient-end)10 100%);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-md);
  overflow: hidden;
}

.memory-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  background: linear-gradient(135deg, var(--gradient-start)15 0%, var(--gradient-end)15 100%);
  border-bottom: 1px solid var(--el-color-primary-light-7);
}

.memory-panel-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  color: var(--el-color-primary);
}

.memory-panel-icon {
  font-size: var(--font-size-title-2);
}

.memory-panel-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.memory-panel-content {
  padding: var(--space-md);
  max-height: 300px;
  overflow-y: auto;
}

.memory-disabled-hint,
.memory-empty-hint {
  text-align: center;
  padding: var(--space-lg);
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-callout);
}

.memory-section {
  margin-bottom: var(--space-md);

  &:last-child {
    margin-bottom: 0;
  }
}

.memory-section-title {
  font-size: var(--font-size-callout);
  font-weight: var(--font-weight-semibold);
  color: var(--el-text-color-primary);
  margin-bottom: var(--space-sm);
}

.memory-section-content {
  background: var(--el-bg-color);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  font-size: var(--font-size-callout);
  color: var(--el-text-color-secondary);
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
  word-break: break-word;
}

.memory-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.memory-item {
  background: var(--el-bg-color);
  padding: var(--space-sm) var(--space-sm);
  border-radius: var(--radius-md);
}

.memory-item-time {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-placeholder);
  margin-bottom: var(--space-xs);
}

.memory-item-content {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-secondary);
  line-height: var(--line-height-normal);
}

/* 任务确认对话框样式 */
.task-confirm-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.task-confirm-label {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  color: var(--el-text-color-primary);
  margin-bottom: var(--space-sm);
}

.task-confirm-instruction {
  background: var(--el-bg-color-page);
  padding: var(--space-md);
  border-radius: var(--radius-md);
}

.task-confirm-text {
  font-size: var(--font-size-body);
  color: var(--el-text-color-regular);
  line-height: var(--line-height-relaxed);
  word-break: break-word;
}

.task-confirm-steps {
  background: var(--el-bg-color-page);
  padding: var(--space-md);
  border-radius: var(--radius-md);
}

/* 记忆管理抽屉样式 */
.memory-drawer-content {
  padding: var(--space-lg);
}

.memory-section {
  margin-bottom: var(--space-lg);

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  color: var(--el-text-color-primary);
  margin-bottom: var(--space-sm);
}

.switch-container {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.help-text {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-secondary);
  margin-top: var(--space-sm);
}

.preview-box,
.readonly-box {
  background: var(--el-fill-color-light);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  font-size: var(--font-size-callout);
  color: var(--el-text-color-secondary);
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-preview {
  color: var(--el-text-color-placeholder);
  text-align: center;
}

.memory-list-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.memory-item-preview {
  background: var(--el-bg-color);
  padding: var(--space-sm) var(--space-sm);
  border-radius: var(--radius-md);
}

.memory-time {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-placeholder);
  margin-bottom: var(--space-xs);
}

.memory-text {
  font-size: var(--font-size-caption-1);
  color: var(--el-text-color-secondary);
  line-height: var(--line-height-normal);
}

.task-steps-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.task-step-preview {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-sm);
  background: var(--el-bg-color);
  border-radius: var(--radius-sm);
  border: 1px solid var(--el-border-color-light);
}

.step-number {
  width: var(--space-lg);
  height: var(--space-lg);
  border-radius: var(--radius-pill);
  background: var(--el-color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-callout);
  font-weight: var(--font-weight-semibold);
  flex-shrink: 0;
}

.step-desc {
  flex: 1;
  font-size: var(--font-size-body);
  color: var(--el-text-color-regular);
  line-height: var(--line-height-normal);
}

.task-confirm-alert {
  margin-top: var(--space-sm);
}

.task-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}

/* Phase 2: 预览对话框样式 */
.preview-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.preview-instruction,
.preview-steps {
  background: var(--el-bg-color-page);
  padding: var(--space-md);
  border-radius: var(--radius-md);
}

.preview-label {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-body);
  color: var(--el-text-color-primary);
  margin-bottom: var(--space-sm);
}

.preview-text {
  font-size: var(--font-size-body);
  color: var(--el-text-color-regular);
  line-height: var(--line-height-relaxed);
  word-break: break-word;
}

.preview-steps-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.preview-step-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-sm);
  background: var(--el-bg-color);
  border-radius: var(--radius-sm);
  border: 1px solid var(--el-border-color-light);
}

.preview-step-order {
  width: var(--space-lg);
  height: var(--space-lg);
  border-radius: var(--radius-pill);
  background: var(--el-color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-callout);
  font-weight: var(--font-weight-semibold);
  flex-shrink: 0;
}

.preview-step-desc {
  flex: 1;
  font-size: var(--font-size-body);
  color: var(--el-text-color-regular);
  line-height: var(--line-height-relaxed);
}

.preview-content-edit {
  background: var(--el-bg-color-page);
  padding: var(--space-md);
  border-radius: var(--radius-md);
}

.preview-alert {
  margin-top: var(--space-sm);
}

.preview-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}

.chat-sidebar-resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: var(--space-xs);
  cursor: col-resize;
  background-color: transparent;
  transition: background-color var(--duration-fast) var(--ease-standard);
  z-index: 10;
}

.chat-sidebar-resize-handle:hover {
  background-color: var(--el-color-primary-light-5);
}
</style>
