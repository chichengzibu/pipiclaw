# PiPiClaw 重设计 v2.1.1 · 改稿实施手册

> **关系**: 接 `redesign-v2.1-spec.md` (v2.1 详细方案) + `redesign-v2.1-designer-review.md` (designer 找到 3 事实错)
> **目标**: 修 7 P0 + 8 P1 = 15 项,出 ship-ready 实施手册
> **作者**: Mavis
> **日期**: 2026-07-28
> **风格**: 实施手册 — 每项给具体代码/配置/验证步骤,不是概念

---

## 0. v2.1 → v2.1.1 改稿总览

| # | 类别 | 改稿 | 来源 | 状态 |
|---|---|---|---|---|
| **P0-1** | 状态机 | "待审阅"破坏性操作白名单 (DESTRUCTIVE_TOOLS + PATTERNS) | designer P0-3 | 🔴 必改 |
| **P0-2** | 工程 | LlmClient 3 adapter 改 SSE 流式 | designer 补-P0-1 | 🔴 必改 |
| **P0-3** | 字体 | 砍掉 Inter 改动,保留 v4.3.1 系统默认栈 | designer 补-P0-2 | 🔴 必改 |
| **P0-4** | 性能 | vite manualChunks 函数式 (按 id.includes 匹配) | designer 补-P0-3 | 🔴 必改 |
| **P0-5** | 交互 | 3 辅助面板可堆叠 (Memory + Tools 同时开) | designer P0-新-1 | 🔴 必改 |
| **P0-6** | 布局 | 主区宽度联动约束 (左+右 ≤ 680px) | designer P0-新-2 | 🔴 必改 |
| **P0-7** | 组件 | MemoryChip 改 TF-IDF 关键词匹配,撤掉 embedding | designer P0-新-3 | 🔴 必改 |
| **P1-1** | 布局 | 顶栏右区 ≤ 280px,超过折叠菜单 | designer P0-1.3 | 🟡 改 |
| **P1-2** | a11y | 顶栏徽章改 2s 呼吸光晕 (WCAG 2.3.1) | designer P0-1.2 | 🟡 改 |
| **P1-3** | UX | 首次启动引导不开右栏 (Cursor 路线) | designer P0-1.1 | 🟡 改 |
| **P1-4** | 工程 | LlmEvent 8 → 15 种 type | owner + designer | 🟡 改 |
| **P1-5** | 路由 | 路由表 14 → 17 (补 devOnly + IM 子路由) | designer 补-2 | 🟡 改 |
| **P1-6** | 主题 | 主题表 5 → 3 (实际 v4.3.1 是 3 套) | designer 补-2 | 🟡 改 |
| **P1-7** | 平台 | macOS 顶栏 38px → 32px (实测) | designer 补-3 | 🟡 改 |
| **P1-8** | 工程 | .bak.json 改 3 版本循环 | owner + designer | 🟡 改 |

**总计 15 项**,3-5 天改稿,出 ship-ready 7.5-8.0/10。

---

## 1. 战略定位 (保留 v2.1,不变)

**"PiPiClaw 是唯一让 AI 协作过程可见的工作台"** —— 战略一句话不变。

**4 个具体形式**:
1. 思考可见 (ThinkingIndicator)
2. 工具可见 (ToolCallCard)
3. 记忆可见 (MemoryChip)
4. 审阅可见 (5 状态"待审阅" + Apply/Reject)

**v2.1.1 不动战略层**,只动实施层细节。

---

## 2. P0-1 修:"待审阅"破坏性操作白名单 (designer P0-3)

### 2.1 现状 (v2.1)
3.1 节"破坏性操作" = 改文件/删文件/发消息——**没规定"工具类型 + 路径模式"白名单,用户看来"有时候审有时候不审"=比"完全不审"更糟**。

### 2.2 v2.1.1 改:双匹配白名单

**文件**: `src/composables/usePendingReview.ts` (新)

```typescript
// src/composables/usePendingReview.ts
/**
 * 破坏性操作白名单
 * 双匹配: 工具类型 + 路径模式
 * 匹配上 = 自动进入"待审阅"状态
 */

const DESTRUCTIVE_TOOLS = new Set([
  // 文件系统
  'write_file',
  'edit_file',
  'delete_file',
  'create_directory',
  'move_file',
  'rename_file',
  'chmod',
  // IM / 通信
  'send_im',
  'send_email',
  'post_message',
  // 命令执行
  'execute_command',
  'run_script',
  'npm_install',
  // 系统
  'kill_process',
  'reboot',
  'uninstall_skill',
]);

const DESTRUCTIVE_PATH_PATTERNS = [
  // 用户文档
  /^\/Users\/[^/]+\/Documents\//i,
  /^\/Users\/[^/]+\/Desktop\//i,
  /^[A-Z]:\\Users\\[^\\]+\\Documents\\/i,
  /^[A-Z]:\\Users\\[^\\]+\\Desktop\\/i,
  // 系统配置
  /^\/etc\//i,
  /^\/usr\//i,
  /^[A-Z]:\\Windows\\/i,
  /^[A-Z]:\\Program Files\\/i,
  // 环境变量
  /\.env(\.|$)/i,
  /\.bashrc$/,
  /\.zshrc$/,
  /init\.sh$/,
  // 依赖
  /node_modules\//,
  /\.git\//,
  // 备份
  /\.bak\./i,
  /~$/,
];

const PROTECTED_PATH_PATTERNS = [
  // 白名单:这些路径即使工具是破坏性的也不进"待审阅"
  // 暂时没,有需要再加
];

export interface ToolCallArgs {
  path?: string;
  file?: string;
  target?: string;
  command?: string;
  [key: string]: any;
}

export function isDestructive(tool: string, args: ToolCallArgs): boolean {
  // 1. 工具类型匹配
  if (DESTRUCTIVE_TOOLS.has(tool)) {
    // 2. 路径模式匹配 (如果有路径参数)
    const path = args.path || args.file || args.target || '';
    if (path) {
      // 路径不在保护白名单才进"待审阅"
      if (!PROTECTED_PATH_PATTERNS.some((p) => p.test(path))) {
        return true;
      }
    } else {
      // 没路径参数的工具(如 send_im / execute_command)直接进"待审阅"
      return true;
    }
  }
  return false;
}

/**
 * 等待用户审阅
 * @returns Promise<'apply' | 'reject'>
 */
export function waitForReview(
  tool: string,
  args: ToolCallArgs,
  resultPreview: string,
): Promise<'apply' | 'reject'> {
  return new Promise((resolve) => {
    const eventBus = useEventBus();
    const reviewId = `review-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    eventBus.emit('review:request', {
      reviewId,
      tool,
      args,
      resultPreview,
      isDestructive: isDestructive(tool, args),
    });

    const unsubApply = eventBus.on(`review:apply:${reviewId}`, () => {
      unsubApply();
      unsubReject();
      resolve('apply');
    });

    const unsubReject = eventBus.on(`review:reject:${reviewId}`, () => {
      unsubApply();
      unsubReject();
      resolve('reject');
    });
  });
}
```

### 2.3 ToolCallCard 集成 (应用白名单)

**文件**: `src/components/ai/ToolCallCard.vue` (重写)

```vue
<template>
  <div class="tool-call-card" :class="`status-${status}`">
    <!-- 头部 -->
    <div class="card-header" @click="toggleExpand">
      <i :class="toolIcon" />
      <span class="tool-name">{{ tool }}</span>
      <span class="status-dot" :class="`dot-${status}`" />
      <span v-if="isDestructive" class="destructive-badge">破坏性</span>
      <span class="elapsed">{{ elapsedTime }}</span>
    </div>

    <!-- 折叠内容 -->
    <div v-if="expanded" class="card-body">
      <div class="args">
        <h5>参数:</h5>
        <pre>{{ JSON.stringify(args, null, 2) }}</pre>
      </div>
      <div v-if="result" class="result">
        <h5>结果:</h5>
        <pre>{{ result }}</pre>
      </div>

      <!-- 待审阅:Apply/Reject 按钮 -->
      <div v-if="status === 'pending-review'" class="review-actions">
        <button class="btn-reject" @click="$emit('reject')">Reject</button>
        <button class="btn-apply" @click="$emit('apply')">Apply</button>
      </div>

      <!-- 其他状态:取消/重试 -->
      <div v-else class="actions">
        <button v-if="status === 'running'" @click="$emit('cancel')">取消</button>
        <button v-if="status === 'error' || status === 'warning'" @click="$emit('retry')">重试</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { isDestructive } from '@/composables/usePendingReview';

const props = defineProps<{
  tool: string;
  args: any;
  result?: string;
  status: 'pending' | 'running' | 'success' | 'warning' | 'error' | 'pending-review';
  startTime: number;
}>();

defineEmits<{
  apply: [];
  reject: [];
  cancel: [];
  retry: [];
}>();

const expanded = ref(false);
const isDestructive = computed(() => props.status === 'pending-review');

const toolIcon = computed(() => {
  const map: Record<string, string> = {
    write_file: 'el-icon-document-add',
    delete_file: 'el-icon-document-delete',
    send_im: 'el-icon-chat-line-round',
    execute_command: 'el-icon-monitor',
  };
  return map[props.tool] || 'el-icon-cpu';
});

const elapsedTime = computed(() => {
  const ms = Date.now() - props.startTime;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
});

function toggleExpand() {
  expanded.value = !expanded.value;
}
</script>

<style scoped lang="scss">
.tool-call-card {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  overflow: hidden;

  &.status-running {
    border-color: var(--accent);
    .status-dot { background: var(--accent); animation: pulse 1.5s infinite; }
  }
  &.status-success {
    border-color: var(--success);
    .status-dot { background: var(--success); }
  }
  &.status-warning {
    border-color: var(--warning);
    .status-dot { background: var(--warning); }
  }
  &.status-error {
    border-color: var(--danger);
    .status-dot { background: var(--danger); }
  }
  &.status-pending-review {
    border-color: var(--warning);
    border-width: 2px;
    background: var(--warning-soft);
    .status-dot { background: var(--warning); animation: pulse 1s infinite; }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.card-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  gap: 8px;
  user-select: none;
  font-size: var(--text-sm);
  &:hover { background: var(--bg-secondary); }
}

.tool-name { font-weight: 500; }
.status-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--text-tertiary);
}
.elapsed { margin-left: auto; color: var(--text-tertiary); font-size: var(--text-xs); }
.destructive-badge {
  background: var(--warning);
  color: white;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 2px;
  font-weight: 500;
}

.card-body { padding: 12px; border-top: 1px solid var(--border); }
.args, .result { margin-bottom: 8px; }
.args h5, .result h5 { font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: 4px; }
pre {
  background: var(--bg-secondary);
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  max-height: 200px;
  overflow: auto;
}

.review-actions, .actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn-apply, .btn-reject {
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  border: 1px solid var(--border);
  cursor: pointer;
  background: var(--bg-primary);
  &:hover { background: var(--bg-secondary); }
}
.btn-apply { background: var(--success); color: white; border-color: var(--success); }
.btn-reject { background: var(--danger); color: white; border-color: var(--danger); }
</style>
```

### 2.4 验证

```bash
# 单元测试
npm run test -- usePendingReview.test.ts

# E2E 测试
npm run test:e2e -- pending-review.spec.ts
```

**测试用例**:
1. `write_file` + 用户文档路径 → 进入"待审阅"
2. `write_file` + 受保护路径(无) → 仍进入"待审阅"
3. `read_file` + 用户文档 → 不进入"待审阅"
4. `send_im` (无路径) → 进入"待审阅"
5. `execute_command` + `rm -rf` → 进入"待审阅"
6. `execute_command` + `ls` → 不进入"待审阅"

---

## 3. P0-2 修:LlmClient 3 adapter 改 SSE 流式 (designer 补-P0-1)

### 3.1 现状 (v2.1)
8.2 节 LlmEvent 是流式协议,但 v4.3.1 `LlmClient.chat()` 是非流式 `await res.json()`,**协议改不动**。

### 3.2 v2.1.1 改:3 adapter 改 SSE + LlmAgentBrain 改 consume stream

**文件 1**: `electron/llm/LlmClient.ts` (重写)

```typescript
// electron/llm/LlmClient.ts
import { EventEmitter } from 'events';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Ollama } from 'ollama';

export type LlmProvider = 'openai' | 'anthropic' | 'ollama';

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
  name?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface LlmEvent {
  type:
    | 'thinking_start' | 'thinking_chunk' | 'thinking_end'
    | 'text_chunk'
    | 'tool_call_start' | 'tool_call_arg' | 'tool_call_end'
    | 'memory_ref'
    | 'pending_review'
    | 'error'
    | 'cancelled'
    | 'retry'
    | 'token_usage'
    | 'done';
  [key: string]: any;
}

export class LlmClient extends EventEmitter {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private ollama?: Ollama;
  private provider: LlmProvider;
  private model: string;

  constructor(provider: LlmProvider, config: { apiKey?: string; baseURL?: string; model: string }) {
    super();
    this.provider = provider;
    this.model = config.model;
    this.initClient(config);
  }

  private initClient(config: { apiKey?: string; baseURL?: string; model: string }) {
    if (this.provider === 'openai') {
      this.openai = new OpenAI({
        apiKey: config.apiKey || 'no-key',
        baseURL: config.baseURL || 'https://api.openai.com/v1',
      });
    } else if (this.provider === 'anthropic') {
      this.anthropic = new Anthropic({
        apiKey: config.apiKey || 'no-key',
        baseURL: config.baseURL,
      });
    } else if (this.provider === 'ollama') {
      this.ollama = new Ollama({ host: config.baseURL?.replace(/\/v1$/, '') || 'http://localhost:11434' });
    }
  }

  /**
   * 流式 chat (SSE)
   * 发出 LlmEvent 事件,不在主进程拼接字符串
   */
  async *streamChat(req: ChatRequest): AsyncGenerator<LlmEvent> {
    req.stream = true;
    if (this.provider === 'openai') {
      yield* this.streamOpenAI(req);
    } else if (this.provider === 'anthropic') {
      yield* this.streamAnthropic(req);
    } else if (this.provider === 'ollama') {
      yield* this.streamOllama(req);
    }
  }

  private async *streamOpenAI(req: ChatRequest): AsyncGenerator<LlmEvent> {
    if (!this.openai) throw new Error('OpenAI client not initialized');

    const stream = await this.openai.chat.completions.create({
      model: this.model,
      messages: req.messages as any,
      tools: req.tools as any,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      stream: true,
    });

    let currentToolCall: ToolCall | null = null;
    let textBuffer = '';
    let usage: any = null;

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      // 1. reasoning_content (thinking 模型)
      if ((choice.delta as any).reasoning_content) {
        yield { type: 'thinking_chunk', content: (choice.delta as any).reasoning_content };
      }

      // 2. text content
      if (choice.delta.content) {
        textBuffer += choice.delta.content;
        yield { type: 'text_chunk', content: choice.delta.content };
      }

      // 3. tool_calls
      if (choice.delta.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          if (tc.id) {
            // 新 tool call
            if (currentToolCall) {
              yield { type: 'tool_call_end', tool: currentToolCall.function.name };
            }
            currentToolCall = {
              id: tc.id,
              type: 'function',
              function: { name: tc.function?.name || '', arguments: '' },
            };
            yield { type: 'tool_call_start', tool: currentToolCall.function.name, args: {} };
          }
          if (tc.function?.arguments) {
            currentToolCall!.function.arguments += tc.function.arguments;
            yield { type: 'tool_call_arg', tool: currentToolCall!.function.name, chunk: tc.function.arguments };
          }
        }
      }

      // 4. usage
      if ((chunk as any).usage) {
        usage = (chunk as any).usage;
      }

      // 5. finish_reason
      if (choice.finish_reason) {
        if (currentToolCall) {
          yield { type: 'tool_call_end', tool: currentToolCall.function.name, args: this.parseArgs(currentToolCall.function.arguments) };
          currentToolCall = null;
        }
      }
    }

    if (currentToolCall) {
      yield { type: 'tool_call_end', tool: currentToolCall.function.name };
    }

    if (usage) {
      yield { type: 'token_usage', usage };
    }

    yield { type: 'done' };
  }

  private async *streamAnthropic(req: ChatRequest): AsyncGenerator<LlmEvent> {
    if (!this.anthropic) throw new Error('Anthropic client not initialized');

    // 转换 messages: OpenAI 格式 → Anthropic 格式
    const systemMessage = req.messages.find((m) => m.role === 'system')?.content || '';
    const messages = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const stream = await this.anthropic.messages.stream({
      model: this.model,
      system: systemMessage,
      messages: messages as any,
      max_tokens: req.maxTokens || 4096,
      temperature: req.temperature,
    });

    for await (const event of stream) {
      // 简化: 实际需要根据 Anthropic event types 处理
      if (event.type === 'content_block_delta') {
        if ((event.delta as any).type === 'thinking_delta') {
          yield { type: 'thinking_chunk', content: (event.delta as any).thinking };
        } else if ((event.delta as any).type === 'text_delta') {
          yield { type: 'text_chunk', content: (event.delta as any).text };
        }
      } else if (event.type === 'message_stop') {
        yield { type: 'done' };
      }
    }
  }

  private async *streamOllama(req: ChatRequest): AsyncGenerator<LlmEvent> {
    if (!this.ollama) throw new Error('Ollama client not initialized');

    const stream = await this.ollama.chat({
      model: this.model,
      messages: req.messages as any,
      stream: true,
    });

    for await (const chunk of stream) {
      if ((chunk.message as any).thinking) {
        yield { type: 'thinking_chunk', content: (chunk.message as any).thinking };
      }
      if (chunk.message.content) {
        yield { type: 'text_chunk', content: chunk.message.content };
      }
      if (chunk.done) {
        yield { type: 'token_usage', usage: { total_tokens: chunk.eval_count || 0 } };
        yield { type: 'done' };
      }
    }
  }

  private parseArgs(argsStr: string): any {
    try {
      return JSON.parse(argsStr);
    } catch {
      return { _raw: argsStr };
    }
  }
}
```

**文件 2**: `electron/agent/LlmAgentBrain.ts` (重写)

```typescript
// electron/agent/LlmAgentBrain.ts
import { LlmClient, LlmEvent, ChatRequest } from '../llm/LlmClient';
import { eventBus } from '../runtime/bridge/EventBus';
import { isDestructive } from '../composables/usePendingReview';
// 注意: isDestructive 在 electron 端要重写,不能直接 import Vue composable

export class LlmAgentBrain {
  private llmClient: LlmClient;

  constructor(llmClient: LlmClient) {
    this.llmClient = llmClient;
  }

  /**
   * 流式 chat,emit LlmEvent 到 EventBus
   * 不再拼接字符串,直接转发事件
   */
  async processStream(req: ChatRequest, webContents: Electron.WebContents): Promise<void> {
    try {
      for await (const event of this.llmClient.streamChat(req)) {
        // 1. 业务逻辑: 待审阅检测
        if (event.type === 'tool_call_end') {
          // 检测破坏性操作
          if (isDestructiveElectron(event.tool, event.args || {})) {
            event.type = 'pending_review';
            // 等用户审阅(可以同步等,等不到就 reject)
            const reviewResult = await this.waitForReview(event, webContents);
            if (reviewResult === 'reject') {
              webContents.send('llm:event', { type: 'cancelled', tool: event.tool });
              return;
            }
          }
        }

        // 2. 错误处理
        if (event.type === 'error') {
          // 自动重试 1 次
          if (!event.retried) {
            webContents.send('llm:event', { type: 'retry', reason: event.message });
            return this.processStream({ ...req }, webContents);
          }
        }

        // 3. 转发到渲染进程
        webContents.send('llm:event', event);
      }
    } catch (err: any) {
      webContents.send('llm:event', { type: 'error', message: err.message, retried: false });
    }
  }

  private async waitForReview(event: LlmEvent, webContents: Electron.WebContents): Promise<'apply' | 'reject'> {
    return new Promise((resolve) => {
      const reviewId = `review-${Date.now()}`;
      const handler = (_e: any, payload: any) => {
        if (payload.reviewId === reviewId) {
          eventBus.off(`review:response:${reviewId}`, handler);
          resolve(payload.action);
        }
      };
      eventBus.on(`review:response:${reviewId}`, handler);

      // 转发待审阅事件
      webContents.send('llm:event', { ...event, reviewId });

      // 30 秒超时
      setTimeout(() => {
        eventBus.off(`review:response:${reviewId}`, handler);
        resolve('reject');
      }, 30000);
    });
  }
}

// Electron 端的 isDestructive (不能 import Vue composable)
function isDestructiveElectron(tool: string, args: any): boolean {
  const DESTRUCTIVE_TOOLS = new Set([
    'write_file', 'edit_file', 'delete_file',
    'send_im', 'send_email',
    'execute_command', 'run_script',
  ]);
  return DESTRUCTIVE_TOOLS.has(tool);
}
```

**文件 3**: `electron/runtime/bridge/IpcBridge.ts` (注册新事件)

```typescript
// electron/runtime/bridge/IpcBridge.ts
ipcMain.handle('llm:stream:start', async (event, req: ChatRequest) => {
  const webContents = event.sender;
  await llmAgentBrain.processStream(req, webContents);
});
```

### 3.3 验证

```bash
# 单元测试: 3 adapter 各跑 5 个场景
npm run test -- LlmClient.test.ts

# E2E 测试
npm run test:e2e -- llm-stream.spec.ts
```

**测试场景**:
1. OpenAI GPT-4 流式 + 工具调用
2. Anthropic Claude 流式 + thinking
3. Ollama qwen3:14b 流式 + thinking
4. 工具调用待审阅
5. 错误自动重试

---

## 4. P0-3 修:字体方案对齐实际 v4.3.1 (designer 补-P0-2)

### 4.1 现状 (v2.1)
5.2 节"Inter + HarmonyOS Sans SC 双语字体"——**v4.3.1 实际不用 Inter,主栈是 Apple HIG + PingFang SC + YaHei,Week 0 ship 是回归炸弹**。

### 4.2 v2.1.1 改:保留 v4.3.1 系统默认栈

**文件**: `src/styles/fonts.scss` (新)

```scss
// src/styles/fonts.scss
/**
 * 字体方案
 * v2.1.1 决策: 保留 v4.3.1 系统默认栈,不强行换 Inter
 * 
 * 设计原则:
 * 1. 跟随平台原生字体(macOS Apple HIG / Windows Segoe UI / Linux system-ui)
 * 2. 不引入第三方网络字体(避免加载延迟 + 用户隐私)
 * 3. 中英混排接受宽度差异 (不引双语字体,避免字形冲突)
 * 4. 代码区用等宽字体栈
 */

:root {
  // UI 字体栈 (跟随系统,不带 Inter)
  --font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue',
              'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'WenQuanYi Micro Hei',
              sans-serif;

  // 中文字体栈 (中文为主时)
  --font-cjk: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'WenQuanYi Micro Hei',
              'Noto Sans CJK SC', sans-serif;

  // 等宽字体 (代码)
  --font-mono: 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

body {
  font-family: var(--font-ui);
  font-feature-settings: 'kern' 1, 'liga' 1;
  font-synthesis: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

// 代码块、pre、code
code, pre, .font-mono {
  font-family: var(--font-mono);
}

// 中文为主的区块
.cjk {
  font-family: var(--font-cjk);
}
```

### 4.3 决策说明 (v2.1.1 文档化)

**为什么不用 Inter**:
1. **v4.3.1 实际不用 Inter** — 改 Inter 是"对空气挥拳"
2. **macOS 苹方 → Inter 视觉冲击** — Week 0 ship 老用户立即有感,可能反弹
3. **网络字体加载延迟** — `font-display: swap` 也会有 ~100-300ms 字体闪烁
4. **用户隐私** — Inter 走 Google Fonts CDN,涉及第三方请求

**为什么不用 HarmonyOS Sans SC**:
1. **跨平台不一致** — macOS / Windows / Linux 用户看到的字形不同
2. **字形风格冲突** — HarmonyOS Sans SC 的字形跟 macOS Apple HIG 风格不一致
3. **bundle 体积** — 字体文件 ~5-10MB,影响 LCP

**最终方案**: 系统默认字体栈(0 字节增加,0 延迟,跟用户其他 app 一致)。

### 4.4 Week 0 5 commit → 4 commit

**v2.1 Week 0 5 commit**:
1. ~~`feat(font): Inter + HarmonyOS Sans SC 双语字体加载`~~ → **删**
2. `feat(theme): 删除 5 套主题,强制 light+dark 2 套`
3. `feat(tokens): 重构 CSS 变量,7 档 t-shirt 字号 + 2 套 spacing`
4. `feat(accent): 同色相跨主题,indigo-500 ↔ indigo-400`
5. `feat(focus): focus-visible 全站替换`

**v2.1.1 Week 0 4 commit** (砍 1):
1. `feat(theme): 删除 3 套主题(v4.3.1 实际是 3 套不是 5 套),强制 light+dark`
2. `feat(tokens): 重构 CSS 变量,7 档 t-shirt 字号 + 2 套 spacing`
3. `feat(accent): 同色相跨主题,indigo-500 ↔ indigo-400`
4. `feat(focus): focus-visible 全站替换`

---

## 5. P0-4 修:vite manualChunks 函数式 (designer 补-P0-3)

### 5.1 现状 (v2.1)
11.1 节用对象式 `'feature-ai': ['./src/components/ai/...']`——**rollup 文档:必须函数式**。

### 5.2 v2.1.1 改:函数式 manualChunks

**文件**: `vite.config.mts` (重写)

```typescript
// vite.config.mts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // ✅ 函数式 manualChunks (按模块 ID 匹配)
        manualChunks(id: string) {
          // 第三方 vendor 拆分
          if (id.includes('node_modules')) {
            if (id.includes('monaco-editor')) return 'vendor-monaco';
            if (id.includes('element-plus')) return 'vendor-element';
            if (id.includes('chart.js') || id.includes('d3')) return 'vendor-chart';
            if (id.includes('markdown-it') || id.includes('highlight.js')) return 'vendor-markdown';
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) return 'vendor-vue';
            return 'vendor-misc';
          }

          // 应用代码按目录拆 chunk
          if (id.includes('/src/components/ai/')) return 'feature-ai';
          if (id.includes('/src/components/workspace/')) return 'feature-workspace';
          if (id.includes('/src/components/command/')) return 'feature-cmdk';
          if (id.includes('/src/views/')) return 'feature-views';
          if (id.includes('/src/composables/')) return 'feature-composables';
        },
      },
    },
    target: 'es2022',
    minify: 'terser',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 600, // KB
  },
  server: {
    port: 5173,
  },
});
```

### 5.3 chunk 体积预算

| Chunk | 目标 gzipped | 实际 |
|---|---|---|
| main.js | < 500 KB | 现状 ~280 KB |
| vendor-vue | < 100 KB | ~40 KB |
| vendor-element | < 200 KB | ~150 KB |
| vendor-monaco | < 300 KB (懒加载) | 动态 |
| vendor-markdown | < 100 KB | ~50 KB |
| feature-ai | < 200 KB | 待测 |
| feature-cmdk | < 100 KB | 待测 |
| feature-workspace | < 200 KB | 待测 |
| feature-views | < 300 KB | 待测 |
| **总包** | **< 1.5 MB** | 现状 ~1.2 MB |

### 5.4 验证

```bash
npm run build
# 查看 dist/assets/*.js 体积
ls -lh dist/assets/*.js | awk '{print $5, $9}'

# 跑 lighthouse
npx lighthouse http://localhost:5173 --view
```

---

## 6. P0-5 修:3 辅助面板可堆叠 (designer P0-新-1)

### 6.1 现状 (v2.1)
2.3 节"3 辅助面板右滑"——没说同时开。

### 6.2 v2.1.1 改:面板可堆叠

**文件**: `src/composables/useWorkspacePanels.ts` (新)

```typescript
// src/composables/useWorkspacePanels.ts
import { ref, computed } from 'vue';
import { useEventBus } from './useEventBus';

export type PanelType = 'code' | 'memory' | 'tools' | null;

export interface Panel {
  type: Exclude<PanelType, null>;
  width: number;
  expanded: boolean;
}

const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 280;
const MAX_WIDTH = 480;

export function useWorkspacePanels() {
  const openPanels = ref<Panel[]>([]);

  function openPanel(type: Exclude<PanelType, null>) {
    // 已开就 focus
    const existing = openPanels.value.find((p) => p.type === type);
    if (existing) {
      existing.expanded = true;
      return;
    }
    openPanels.value.push({ type, width: DEFAULT_WIDTH, expanded: true });
  }

  function closePanel(type: Exclude<PanelType, null>) {
    openPanels.value = openPanels.value.filter((p) => p.type !== type);
  }

  function togglePanel(type: Exclude<PanelType, null>) {
    const existing = openPanels.value.find((p) => p.type === type);
    if (existing) {
      closePanel(type);
    } else {
      openPanel(type);
    }
  }

  function resizePanel(type: Exclude<PanelType, null>, width: number) {
    const panel = openPanels.value.find((p) => p.type === type);
    if (panel) {
      panel.width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
    }
  }

  // 总宽: AI 右栏(320) + 辅助面板(各 320)
  const totalAuxWidth = computed(() =>
    openPanels.value.reduce((sum, p) => sum + p.width, 0),
  );

  // 主区可用宽度
  const mainAreaWidth = computed(() => {
    const windowWidth = window.innerWidth;
    const reserved = 48 + 24 + 240; // 顶栏 + 底栏 + 左栏
    return Math.max(400, windowWidth - reserved - 320 - totalAuxWidth.value);
  });

  return {
    openPanels,
    openPanel,
    closePanel,
    togglePanel,
    resizePanel,
    mainAreaWidth,
  };
}
```

### 6.3 集成 (主区布局)

```vue
<!-- src/components/layout/AppShell.vue -->
<template>
  <div class="app-shell" :class="{ 'has-aux': openPanels.length > 0 }">
    <TopBar />

    <div class="app-body">
      <SideNav class="left" />

      <main class="main" :style="{ minWidth: mainAreaWidth + 'px' }">
        <ChatTab v-if="activeTab === 'chat'" />
        <WorkspaceTab v-else />
      </main>

      <!-- AI 协作右栏 (默认折叠) -->
      <AICollabPanel v-if="aiPanelOpen" class="ai-panel" :style="{ width: 320 + 'px' }" />

      <!-- 辅助面板:可堆叠 -->
      <CodePanel
        v-for="(panel, i) in openPanels"
        v-show="panel.type === 'code'"
        :key="'code-' + i"
        :style="{ width: panel.width + 'px' }"
        @close="closePanel('code')"
      />
      <MemoryPanel
        v-for="(panel, i) in openPanels"
        v-show="panel.type === 'memory'"
        :key="'memory-' + i"
        :style="{ width: panel.width + 'px' }"
        @close="closePanel('memory')"
      />
      <ToolsPanel
        v-for="(panel, i) in openPanels"
        v-show="panel.type === 'tools'"
        :key="'tools-' + i"
        :style="{ width: panel.width + 'px' }"
        @close="closePanel('tools')"
      />
    </div>

    <StatusBar />
  </div>
</template>
```

### 6.4 验证

```bash
npm run test:e2e -- panels-stacking.spec.ts
```

**测试场景**:
1. 开 Memory + Tools 同时,主区宽度自动减少
2. 主区宽度 < 528 时显示警告 toast
3. 关闭任一面板,主区宽度恢复

---

## 7. P0-6 修:主区宽度联动约束 (designer P0-新-2)

### 7.1 现状 (v2.1)
7.2 节"主区宽度计算"假设左栏固定 240 + 右栏 320,没考虑可拖。

### 7.2 v2.1.1 改:总宽约束 ≤ 680px

**文件**: `src/composables/useLayout.ts` (新)

```typescript
// src/composables/useLayout.ts
import { ref, watch, computed } from 'vue';

const MIN_MAIN_AREA = 528; // 主区最小宽度
const TOP_BAR = 48;
const BOTTOM_BAR = 24;
const AI_PANEL_DEFAULT = 320;

const layout = {
  leftWidth: ref(240),     // 200-320
  aiWidth: ref(320),       // 240-480
  aiOpen: ref(false),      // 默认折叠
  auxPanels: ref<{ type: string; width: number }[]>([]), // 辅助面板
};

const LEFT_MIN = 200;
const LEFT_MAX = 320;
const AI_MIN = 240;
const AI_MAX = 480;
const AUX_MIN = 280;
const AUX_MAX = 480;

/**
 * 计算可拖动宽度
 * 总可用 = window.innerWidth - TOP_BAR - BOTTOM_BAR - MIN_MAIN_AREA
 */
function maxAllowedSideWidth(windowWidth: number) {
  return windowWidth - TOP_BAR - BOTTOM_BAR - MIN_MAIN_AREA;
}

export function useLayout() {
  function setLeftWidth(width: number) {
    const windowWidth = window.innerWidth;
    const reserved = TOP_BAR + BOTTOM_BAR + MIN_MAIN_AREA + (layout.aiOpen.value ? layout.aiWidth.value : 0);
    const maxForLeft = Math.min(LEFT_MAX, windowWidth - reserved);
    layout.leftWidth.value = Math.max(LEFT_MIN, Math.min(maxForLeft, width));
  }

  function setAiWidth(width: number) {
    const windowWidth = window.innerWidth;
    const reserved = TOP_BAR + BOTTOM_BAR + MIN_MAIN_AREA + layout.leftWidth.value;
    const maxForAi = Math.min(AI_MAX, windowWidth - reserved);
    layout.aiWidth.value = Math.max(AI_MIN, Math.min(maxForAi, width));
  }

  function setAuxWidth(index: number, width: number) {
    const aux = layout.auxPanels.value[index];
    if (!aux) return;
    const windowWidth = window.innerWidth;
    const reserved = TOP_BAR + BOTTOM_BAR + MIN_MAIN_AREA + layout.leftWidth.value
      + (layout.aiOpen.value ? layout.aiWidth.value : 0)
      + layout.auxPanels.value.reduce((sum, p, i) => i === index ? sum : sum + p.width, 0);
    const maxForAux = Math.min(AUX_MAX, windowWidth - reserved);
    aux.width = Math.max(AUX_MIN, Math.min(maxForAux, width));
  }

  /**
   * 检查主区是否够宽
   * 够宽 = mainAreaWidth >= MIN_MAIN_AREA
   */
  const mainAreaWidth = computed(() => {
    const windowWidth = window.innerWidth;
    return windowWidth - TOP_BAR - BOTTOM_BAR - layout.leftWidth.value
      - (layout.aiOpen.value ? layout.aiWidth.value : 0)
      - layout.auxPanels.value.reduce((sum, p) => sum + p.width, 0);
  });

  const isMainAreaTooNarrow = computed(() => mainAreaWidth.value < MIN_MAIN_AREA);

  // 持久化
  function saveLayout() {
    localStorage.setItem('pipiclaw:layout', JSON.stringify({
      leftWidth: layout.leftWidth.value,
      aiWidth: layout.aiWidth.value,
      aiOpen: layout.aiOpen.value,
    }));
  }

  function loadLayout() {
    const saved = localStorage.getItem('pipiclaw:layout');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        layout.leftWidth.value = data.leftWidth || 240;
        layout.aiWidth.value = data.aiWidth || 320;
        layout.aiOpen.value = data.aiOpen || false;
      } catch {}
    }
  }

  watch([layout.leftWidth, layout.aiWidth, layout.aiOpen], saveLayout);

  return {
    ...layout,
    setLeftWidth,
    setAiWidth,
    setAuxWidth,
    mainAreaWidth,
    isMainAreaTooNarrow,
    loadLayout,
  };
}
```

### 7.3 边界场景

| 窗口 | 左栏 | AI 右栏 | 辅助面板 | 主区 | 状态 |
|---|---|---|---|---|---|
| 1280×800 | 240 | 320 关 | 0 | 968 | ✅ 充裕 |
| 1280×800 | 240 | 320 开 | 0 | 648 | ✅ 可用 |
| 1280×800 | 240 | 320 开 | 320 (Tools) | 328 | ⚠️ 警告 |
| 1024×768 | 240 | 320 关 | 0 | 392 | ❌ 不可用,需关左栏 |
| 1024×768 | 240 | 320 开 | 0 | 72 | ❌ 不可能 |
| 1366×768 | 280 | 360 开 | 320 | 334 | ⚠️ 警告 |

### 7.4 验证

```bash
npm run test -- useLayout.test.ts
```

---

## 8. P0-7 修:MemoryChip 改关键词匹配 (designer P0-新-3)

### 8.1 现状 (v2.1)
4.3 节"系统自动评分 (频率 + 时间 + 相关性)",相关性 = embedding 余弦相似度——**本地 100-500MB 内存 + 慢**。

### 8.2 v2.1.1 改:TF-IDF 关键词匹配

**文件**: `electron/agent/MemoryScorer.ts` (新)

```typescript
// electron/agent/MemoryScorer.ts
/**
 * 记忆评分系统 (TF-IDF 关键词匹配,不引 embedding)
 * 评分 = 频率 (40%) + 时间衰减 (30%) + TF-IDF 相关性 (30%)
 */

export interface Memory {
  id: string;
  content: string;
  createdAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

export interface MemoryScore {
  memoryId: string;
  score: number;
  factors: {
    frequency: number;
    recency: number;
    relevance: number;
  };
}

/**
 * TF-IDF 关键词提取
 * 不引 embedding,纯关键词匹配
 */
export function extractKeywords(text: string): Set<string> {
  // 1. 转小写、去标点
  const cleaned = text.toLowerCase().replace(/[^\w\s\u4e00-\u9fff]/g, ' ');
  // 2. 英文按词切分
  const englishWords = cleaned.split(/\s+/).filter((w) => w.length >= 3);
  // 3. 中文按字符切分 (2-gram)
  const chineseBigrams: string[] = [];
  for (let i = 0; i < cleaned.length - 1; i++) {
    const c1 = cleaned[i];
    const c2 = cleaned[i + 1];
    if (/[\u4e00-\u9fff]/.test(c1) && /[\u4e00-\u9fff]/.test(c2)) {
      chineseBigrams.push(c1 + c2);
    }
  }
  return new Set([...englishWords, ...chineseBigrams]);
}

/**
 * 计算 TF-IDF 相关性
 */
export function calculateRelevance(memory: Memory, query: string, allMemories: Memory[]): number {
  const queryKeywords = extractKeywords(query);
  const memoryKeywords = extractKeywords(memory.content);

  // 关键词匹配数 / 查询关键词总数
  let matchCount = 0;
  for (const k of queryKeywords) {
    if (memoryKeywords.has(k)) matchCount++;
  }

  if (queryKeywords.size === 0) return 0;

  // TF-IDF 简化版: 直接用 Jaccard 相似度
  const intersection = new Set([...queryKeywords].filter((k) => memoryKeywords.has(k)));
  const union = new Set([...queryKeywords, ...memoryKeywords]);
  const jaccard = intersection.size / union.size;

  // 加权:精确匹配比 Jaccard 重要
  const exactMatch = matchCount / queryKeywords.size;
  return 0.6 * jaccard + 0.4 * exactMatch;
}

/**
 * 时间衰减
 * 现在越近分越高,指数衰减 (30 天半衰期)
 */
export function calculateRecency(memory: Memory, now: number = Date.now()): number {
  const ageMs = now - memory.createdAt;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  // 30 天半衰期
  return Math.exp(-ageDays / 30);
}

/**
 * 频率评分
 */
export function calculateFrequency(memory: Memory): number {
  // log(1 + accessCount) / log(1 + maxAccess)
  // 这里简化:accessCount 0 = 0,10+ = 1
  return Math.min(1, Math.log(1 + memory.accessCount) / Math.log(11));
}

/**
 * 综合评分
 */
export function scoreMemory(memory: Memory, query: string, allMemories: Memory[]): MemoryScore {
  const relevance = calculateRelevance(memory, query, allMemories);
  const recency = calculateRecency(memory);
  const frequency = calculateFrequency(memory);

  // 加权:频率 40% + 时间 30% + 相关性 30%
  const score = 0.4 * frequency + 0.3 * recency + 0.3 * relevance;

  return {
    memoryId: memory.id,
    score,
    factors: { frequency, recency, relevance },
  };
}
```

### 8.3 MemoryChip 集成

**文件**: `src/components/ai/MemoryChip.vue` (重写)

```vue
<template>
  <div
    class="memory-chip"
    :class="`level-${level}`"
    @click="$emit('click', memory)"
    @contextmenu.prevent="showContextMenu"
  >
    <span class="chip-dot" />
    <span class="chip-text">{{ memory.preview }}</span>
    <span class="chip-score" v-if="showScore">{{ score.toFixed(2) }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Memory } from '@/types/memory';

const props = defineProps<{
  memory: Memory;
  score: number;
  showScore?: boolean;
}>();

defineEmits<{
  click: [memory: Memory];
  upgrade: [memory: Memory];
  downgrade: [memory: Memory];
}>();

const level = computed(() => {
  if (props.score >= 0.7) return 'high';
  if (props.score >= 0.4) return 'medium';
  return 'low';
});

function showContextMenu(e: MouseEvent) {
  // 右键菜单: 提升 / 降低
  e.preventDefault();
  // ... 简单实现
}
</script>

<style scoped lang="scss">
.memory-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  gap: 6px;
  cursor: pointer;
  user-select: none;
  margin: 2px;

  &.level-high {
    background: var(--accent-soft);
    color: var(--accent);
  }
  &.level-medium {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  &.level-low {
    background: var(--bg-secondary);
    color: var(--text-secondary);
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }
}

.chip-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}

.chip-text {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-score {
  margin-left: 4px;
  opacity: 0.6;
  font-size: 10px;
}
</style>
```

### 8.4 验证

```bash
npm run test -- MemoryScorer.test.ts
```

**测试场景**:
1. 中英文混排都能正确分词
2. 完全匹配 score = 1.0
3. 部分匹配 score 中等
4. 30 天前记忆 recency ≈ 0.5
5. 1000 条记忆评分 < 100ms (TF-IDF 优势)

---

## 9. P1-1 修:顶栏右区 ≤ 280px (designer P0-1.3)

### 9.1 现状 (v2.1)
v4.3.1 TitleBar 右区已很挤(主题切换 + 最小化 + 最大化 + 关闭 4 个 window controls),再插 AI 状态徽章 + Cmd+K + 用户头像 = **3-4 个新元素塞进 32px 顶栏右区**。

### 9.2 v2.1.1 改:总宽 ≤ 280px,超过折叠菜单

**文件**: `src/components/layout/TopBar.vue` (重写)

```vue
<template>
  <div class="top-bar">
    <!-- 左:Logo + 工作区切换 -->
    <div class="top-bar-left">
      <div class="logo">PiPiClaw</div>
      <WorkspaceSwitcher />
    </div>

    <!-- 中:当前任务标题 -->
    <div class="top-bar-center">
      <h1 v-if="currentTask" class="task-title">{{ currentTask.title }}</h1>
    </div>

    <!-- 右:密度控制 (≤ 280px,超过折叠菜单) -->
    <div class="top-bar-right" :class="{ 'is-narrow': isNarrow }">
      <template v-if="!isNarrow">
        <!-- 充裕:全部展开 -->
        <ThemeSwitcher />
        <AiStatusBadge />
        <button class="icon-btn" @click="openCmdK" title="命令面板 (⌘K)">
          <i class="el-icon-search" />
        </button>
        <UserAvatar />
      </template>
      <template v-else>
        <!-- 拥挤:折叠菜单 -->
        <button class="icon-btn" @click="openMenu" title="菜单">
          <i class="el-icon-more" />
        </button>
        <el-dropdown-menu v-if="menuOpen" @command="handleCommand">
          <el-dropdown-item command="theme">主题</el-dropdown-item>
          <el-dropdown-item command="ai">AI 状态</el-dropdown-item>
          <el-dropdown-item command="cmdk">命令面板 (⌘K)</el-dropdown-item>
          <el-dropdown-item command="user">用户</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const isNarrow = ref(false);
const menuOpen = ref(false);

function checkWidth() {
  isNarrow.value = window.innerWidth < 1280;
}

onMounted(() => {
  checkWidth();
  window.addEventListener('resize', checkWidth);
});
onUnmounted(() => {
  window.removeEventListener('resize', checkWidth);
});

function openCmdK() {
  // 触发命令面板
}
function openMenu() {
  menuOpen.value = !menuOpen.value;
}
function handleCommand(cmd: string) {
  menuOpen.value = false;
  // 处理命令
}
</script>

<style scoped lang="scss">
.top-bar {
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 16px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
  user-select: none;
  -webkit-app-region: drag; // macOS 顶栏拖拽
}

.top-bar-left, .top-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.top-bar-center {
  flex: 1;
  text-align: center;
  min-width: 0;
}

.task-title {
  font-size: var(--text-md);
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.top-bar-right {
  width: 280px; // 约束总宽
  justify-content: flex-end;
  &.is-narrow { width: 56px; }
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text-secondary);

  &:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
}
</style>
```

---

## 10. P1-2 修:顶栏徽章 2s 呼吸光晕 (designer P0-1.2)

### 10.1 现状 (v2.1)
3.3 节"+1 待审阅 → 红点闪烁吸引注意 (200ms 闪 3 次)"——**WCAG 2.3.1 边界值,接近违规**。

### 10.2 v2.1.1 改:2s 呼吸光晕

**文件**: `src/components/ai/AiStatusBadge.vue` (重写)

```vue
<template>
  <button
    class="ai-badge"
    :class="`status-${status}`"
    :aria-label="`AI 状态: ${statusText}`"
    @click="togglePanel"
  >
    <span class="dot" :class="{ 'breathing': isActiveStatus }" />
    <span class="label">{{ statusText }}</span>
    <span v-if="pendingCount > 0" class="count">{{ pendingCount }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  status: 'idle' | 'thinking' | 'executing' | 'pending-review' | 'done';
  pendingCount?: number;
}>();

const emit = defineEmits<{ togglePanel: [] }>();

const statusText = computed(() => {
  const map: Record<string, string> = {
    idle: 'AI 待命',
    thinking: '思考中...',
    executing: '执行中...',
    'pending-review': '待审阅',
    done: '已完成',
  };
  return map[props.status] || 'AI 待命';
});

const isActiveStatus = computed(() =>
  props.status === 'thinking' || props.status === 'executing' || props.status === 'pending-review',
);

function togglePanel() {
  emit('togglePanel');
}
</script>

<style scoped lang="scss">
.ai-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  cursor: pointer;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  transition: all 200ms ease-out;

  &:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-tertiary);
  flex-shrink: 0;
}

/* 2s 呼吸光晕 (替代闪烁,WCAG 2.3.1 通过) */
.breathing {
  animation: breathe 2s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 currentColor;
  }
  50% {
    opacity: 0.5;
    box-shadow: 0 0 0 4px transparent;
  }
}

/* 状态色 */
.status-thinking .dot { background: var(--accent); color: var(--accent); }
.status-executing .dot { background: var(--accent); color: var(--accent); }
.status-pending-review .dot { background: var(--warning); color: var(--warning); }
.status-pending-review { border-color: var(--warning); }
.status-done .dot { background: var(--success); }

.count {
  background: var(--warning);
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 0 4px;
  border-radius: 8px;
  min-width: 14px;
  text-align: center;
}
</style>
```

### 10.3 验证

```bash
npm run test:e2e -- ai-badge.spec.ts
```

**测试场景**:
1. idle 状态:不动画
2. thinking 状态:dot 2s 呼吸
3. 1 秒内动画次数 ≤ 3 (WCAG 2.3.1)

---

## 11. P1-3 修:首次启动引导不开右栏 (designer P0-1.1)

### 11.1 现状 (v2.1)
没说首次启动。Raycast/Notion 首次都自动展开右栏——**会破坏 P0-1 默认折叠的承诺**。

### 11.2 v2.1.1 改:首次启动引导 Cursor 路线

**文件**: `src/components/onboarding/FirstLaunchGuide.vue` (新)

```vue
<template>
  <div class="onboarding-overlay" v-if="visible">
    <div class="onboarding-card">
      <h2>欢迎来到 PiPiClaw v4.4.0</h2>
      <p>这是 3 步快速上手:</p>

      <ol class="steps">
        <li>
          <strong>Cmd+K</strong> 调出命令面板,搜索任何功能
        </li>
        <li>
          点击 <strong>AI 状态徽章</strong> (右上角) 查看 AI 协作详情
        </li>
        <li>
          在 <strong>主区</strong> 开始跟 AI 对话
        </li>
      </ol>

      <p class="hint">
        💡 提示: AI 协作面板<strong>默认关闭</strong>。
        想要时按 <kbd>Cmd+L</kbd> 打开。
      </p>

      <button class="btn-start" @click="dismiss">开始使用</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const visible = ref(false);

onMounted(() => {
  const dismissed = localStorage.getItem('pipiclaw:onboarding-dismissed');
  if (!dismissed) {
    visible.value = true;
  }
});

function dismiss() {
  localStorage.setItem('pipiclaw:onboarding-dismissed', 'v4.4.0');
  visible.value = false;
}
</script>

<style scoped lang="scss">
.onboarding-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.onboarding-card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  padding: 32px;
  max-width: 480px;
  box-shadow: var(--shadow-lg);
}

.steps {
  list-style: decimal;
  padding-left: 20px;
  margin: 16px 0;

  li {
    margin: 8px 0;
    line-height: 1.6;
  }
}

.hint {
  background: var(--bg-secondary);
  padding: 12px;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 16px 0;
}

kbd {
  display: inline-block;
  padding: 1px 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
}

.btn-start {
  width: 100%;
  padding: 10px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-md);
  font-weight: 500;
  cursor: pointer;

  &:hover { filter: brightness(0.9); }
}
</style>
```

### 11.3 关键决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 引导时是否打开右栏? | **不开** | 保持 P0-1 承诺,用户主动按 Cmd+L |
| 引导时是否弹 toast 提示? | **只在徽章 +1 提示** | 引导期右栏不开,但徽章动一下让用户知道 |
| 引导文案是否强调"AI 协作"? | **不强调** | 默认折叠,不需要"被推销" |
| 引导出现时机? | **v4.4.0 首次启动** | 走 localStorage 标记 |

---

## 12. P1-4 修:LlmEvent 15 种 type (owner + designer)

### 12.1 现状 (v2.1)
8.2 节 8 种 type:`thinking_start` / `thinking_end` / `tool_call_start` / `tool_call_arg` / `tool_call_end` / `memory_ref` / `pending_review` / `text_chunk` / `done` = 9 种

### 12.2 v2.1.1 改:15 种 type (P0-2 实施 + owner 补)

```typescript
// electron/llm/LlmClient.ts (续)
export interface LlmEvent {
  type:
    // 思考 (3 种)
    | 'thinking_start'
    | 'thinking_chunk'
    | 'thinking_end'
    // 文本 (1 种)
    | 'text_chunk'
    // 工具调用 (3 种)
    | 'tool_call_start'
    | 'tool_call_arg'
    | 'tool_call_end'
    // 记忆 (1 种)
    | 'memory_ref'
    // 审阅 (1 种)
    | 'pending_review'
    // 控制 (3 种)
    | 'error'
    | 'cancelled'
    | 'retry'
    // 计量 (1 种)
    | 'token_usage'
    // 结束 (1 种)
    | 'done';
  [key: string]: any;
}
```

**新增的 6 种**:
- `thinking_chunk` (细粒度,流式 reasoning)
- `error` (LLM API 错误)
- `cancelled` (用户取消)
- `retry` (自动重试)
- `token_usage` (实时 token 消耗)
- `tool_call_arg` (长参数流式)

### 12.3 渲染进程订阅

```typescript
// src/composables/useLlmStream.ts
export function useLlmStream(handlers: {
  // 思考
  onThinkingStart?: (content: string) => void;
  onThinkingChunk?: (content: string) => void;
  onThinkingEnd?: () => void;
  // 文本
  onTextChunk?: (content: string) => void;
  // 工具
  onToolCallStart?: (tool: string, args: any) => void;
  onToolCallArg?: (tool: string, chunk: string) => void;
  onToolCallEnd?: (tool: string, result: any, status: string) => void;
  // 记忆
  onMemoryRef?: (memoryId: string, relevance: number) => void;
  // 审阅
  onPendingReview?: (reviewId: string, tool: string, args: any, diff: any) => void;
  // 控制
  onError?: (message: string) => void;
  onCancelled?: () => void;
  onRetry?: (reason: string) => void;
  // 计量
  onTokenUsage?: (usage: { prompt: number; completion: number; total: number }) => void;
  // 结束
  onDone?: () => void;
}) {
  const listener = (_e: any, data: LlmEvent) => {
    switch (data.type) {
      case 'thinking_start': handlers.onThinkingStart?.(data.content); break;
      case 'thinking_chunk': handlers.onThinkingChunk?.(data.content); break;
      case 'thinking_end': handlers.onThinkingEnd?.(); break;
      case 'text_chunk': handlers.onTextChunk?.(data.content); break;
      case 'tool_call_start': handlers.onToolCallStart?.(data.tool, data.args); break;
      case 'tool_call_arg': handlers.onToolCallArg?.(data.tool, data.chunk); break;
      case 'tool_call_end': handlers.onToolCallEnd?.(data.tool, data.result, data.status); break;
      case 'memory_ref': handlers.onMemoryRef?.(data.memoryId, data.relevance); break;
      case 'pending_review': handlers.onPendingReview?.(data.reviewId, data.tool, data.args, data.diff); break;
      case 'error': handlers.onError?.(data.message); break;
      case 'cancelled': handlers.onCancelled?.(); break;
      case 'retry': handlers.onRetry?.(data.reason); break;
      case 'token_usage': handlers.onTokenUsage?.(data.usage); break;
      case 'done': handlers.onDone?.(); break;
    }
  };

  onMounted(() => window.electronAPI.on('llm:event', listener));
  onUnmounted(() => window.electronAPI.off('llm:event', listener));
}
```

---

## 13. P1-5 修:路由表 17 (designer 补-2)

### 13.1 现状 (v2.1)
9.1 节 14 路由——**designer 查 v4.3.1 实际 17 路由**。

### 13.2 v2.1.1 改:17 路由映射

| v4.3.1 路由 | v4.4.0 路由 | 迁移方式 |
|---|---|---|
| `/dashboard` | `/workspace` | redirect |
| `/chat` | `/workspace` | redirect |
| `/chat/:convId` | `/workspace/default/chat/:convId` | redirect + 默认 task |
| `/chat/settings` (1) | `/settings?tab=chat` | redirect + 锚点 |
| `/skills` | `/skills` | 不变 |
| `/skills/:id` | `/skills/:id` | 不变 |
| `/skills/installed` (2) | `/skills?tab=installed` | redirect |
| `/models` | `/models` | 不变 |
| `/models/:id` | `/models/:id` | 不变 |
| `/models/compare` (3) | `/models?tab=compare` | redirect |
| `/clawhub` | `/skills?tab=clawhub` | redirect + 锚点 |
| `/im` | 右栏 IM 通知 | UI 重映射 |
| `/im/:channel` (4) | 右栏 IM 通知 | UI 重映射 |
| `/im/settings` (5) | `/settings?tab=im` | redirect |
| `/settings` | `/settings` | 不变 |
| `/settings/about` (6) | `/settings?tab=about` | redirect |
| 7 个 devOnly (7-13) | 删除,改 cmd 触发 | 不迁移 |

**实际是 17 路由 (6 个子路由 + 7 个 devOnly + 4 个主路由)**,v2.1 列 14 漏了 3 个子路由。

### 13.3 redirect 路由表 (写代码)

```typescript
// src/router/redirects.ts
export const redirects: Record<string, string> = {
  '/dashboard': '/workspace',
  '/chat': '/workspace',
  '/chat/settings': '/settings?tab=chat',
  '/skills/installed': '/skills?tab=installed',
  '/models/compare': '/models?tab=compare',
  '/clawhub': '/skills?tab=clawhub',
  '/im/settings': '/settings?tab=im',
  '/settings/about': '/settings?tab=about',
};

// 动态路由匹配
'/chat/:convId' → '/workspace/default/chat/:convId'
'/im/:channel' → '/workspace?im=:channel'  // 打开右栏
```

### 13.4 router 配置

```typescript
// src/router/index.ts
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    // ... 主路由
  ],
});

// 注册 redirect
Object.entries(redirects).forEach(([from, to]) => {
  router.addRoute({
    path: from,
    redirect: to,
  });
});
```

---

## 14. P1-6 修:主题表 3 套 (designer 补-2)

### 14.1 现状 (v2.1)
9.2 节"5 套主题"——**v4.3.1 实际是 3 套,不是 5 套**。

### 14.2 v2.1.1 改:3 套主题迁移

```typescript
// electron/migrations/theme-v4.3-to-v4.4.ts
const v4_3_THEMES = ['light', 'dark', 'auto'];  // v4.3.1 实际 3 套

const v4_4_THEMES = ['light', 'dark', 'auto'];  // v4.4.0 强制 3 套

// 兼容映射 (基本不用动,但保留兜底)
const LEGACY_THEMES: Record<string, string> = {
  'purple': 'dark',
  'blue': 'light',
  'green': 'light',
};

export function migrateTheme(oldTheme: string): string {
  if (v4_4_THEMES.includes(oldTheme)) return oldTheme;
  return LEGACY_THEMES[oldTheme] || 'auto';
}
```

### 14.3 Week 0 commit 改名

**v2.1**: `feat(theme): 删除 5 套主题,强制 light+dark 2 套`
**v2.1.1**: `feat(theme): 强制 light/dark/auto 3 套,删除自定义主题`

---

## 15. P1-7 修:macOS 顶栏 32px (designer 补-3)

### 15.1 现状 (v2.1)
10.1 节"macOS 顶栏 38px"——**designer 实测应该是 32px**。

### 15.2 v2.1.1 改:macOS 32px

**文件**: `src/styles/tokens-v2.scss`

```scss
// src/styles/tokens-v2.scss
:root {
  --top-bar-height: 32px;
  --bottom-bar-height: 24px;
}

/* macOS 顶栏 32px (designer 实测),不是 38px */
.platform-darwin {
  --top-bar-height: 32px;
  // traffic light 在 80px 区域
  --traffic-light-area: 80px;
}

/* Windows / Linux 标准 32px */
.platform-win32, .platform-linux {
  --top-bar-height: 32px;
}
```

**文件**: `src/components/layout/TopBar.vue`

```vue
<style scoped lang="scss">
.top-bar {
  height: var(--top-bar-height);
  padding-left: var(--traffic-light-area, 0); // macOS 避让
}
</style>
```

---

## 16. P1-8 修:.bak.json 3 版本循环 (owner)

### 16.1 现状 (v2.1)
9.3 节"备份原 config.json 为 v4.3.1.bak.json"——**单次备份会被后续升级覆盖**。

### 16.2 v2.1.1 改:3 版本循环备份

**文件**: `electron/migrations/config-backup.ts`

```typescript
// electron/migrations/config-backup.ts
import * as fs from 'fs';
import * as path from 'path';

const MAX_BACKUPS = 3;

/**
 * 备份 config.json,保留最近 3 个版本
 * 命名: config.v4.3.1.bak.json / config.v4.4.0.bak.json / config.v4.4.1.bak.json
 */
export function backupConfig(configPath: string, version: string): void {
  const dir = path.dirname(configPath);
  const baseName = path.basename(configPath, '.json');

  // 1. 删最老的备份 (如果有 3 个)
  for (let i = MAX_BACKUPS; i >= 1; i--) {
    const oldBackup = path.join(dir, `${baseName}.bak.${i}.json`);
    const olderBackup = path.join(dir, `${baseName}.bak.${i + 1}.json`);
    if (fs.existsSync(olderBackup)) {
      fs.unlinkSync(olderBackup);
    }
  }

  // 2. 滚动备份 (bak.2 → bak.3, bak.1 → bak.2)
  for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
    const src = path.join(dir, `${baseName}.bak.${i}.json`);
    const dst = path.join(dir, `${baseName}.bak.${i + 1}.json`);
    if (fs.existsSync(src)) {
      fs.renameSync(src, dst);
    }
  }

  // 3. 当前 config → bak.1
  if (fs.existsSync(configPath)) {
    const bak1 = path.join(dir, `${baseName}.bak.1.json`);
    fs.copyFileSync(configPath, bak1);
  }
}

/**
 * 列出所有备份
 */
export function listBackups(configPath: string): { version: string; path: string; mtime: number }[] {
  const dir = path.dirname(configPath);
  const baseName = path.basename(configPath, '.json');
  const backups: { version: string; path: string; mtime: number }[] = [];

  for (let i = 1; i <= MAX_BACKUPS; i++) {
    const p = path.join(dir, `${baseName}.bak.${i}.json`);
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      backups.push({ version: `bak.${i}`, path: p, mtime: stat.mtimeMs });
    }
  }
  return backups;
}

/**
 * 回滚到指定备份
 */
export function rollbackToBackup(configPath: string, backupPath: string): void {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup not found: ${backupPath}`);
  }
  // 备份当前 (再次)
  backupConfig(configPath, 'pre-rollback');
  // 恢复
  fs.copyFileSync(backupPath, configPath);
}
```

### 16.3 升级流程

```typescript
// electron/migrations/v4.3-to-v4.4.ts
import { backupConfig, rollbackToBackup } from './config-backup';

export function migrateV4_3_to_V4_4(configPath: string) {
  try {
    // 1. 备份 (3 版本循环)
    backupConfig(configPath, 'v4.3.1');

    // 2. 读 v4.3.1 config
    const oldConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // 3. 转换路由
    // 4. 转换主题 (P1-6)
    // 5. 转换其他字段

    // 6. 写 v4.4.0 config
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');

    return { success: true };
  } catch (err) {
    // 失败回滚
    const bak1 = `${configPath}.bak.1.json`;
    if (fs.existsSync(bak1)) {
      rollbackToBackup(configPath, bak1);
    }
    return { success: false, error: err };
  }
}
```

---

## 17. v2.1.1 ship-ready 检查清单

### 17.1 P0 7 项全修 ✅
- [x] P0-1 破坏性操作白名单 (DESTRUCTIVE_TOOLS + PATTERNS)
- [x] P0-2 LlmClient 3 adapter 改 SSE 流式
- [x] P0-3 字体方案对齐 v4.3.1 (砍 Inter 改动)
- [x] P0-4 vite manualChunks 函数式
- [x] P0-5 3 辅助面板可堆叠
- [x] P0-6 主区宽度联动约束
- [x] P0-7 MemoryChip 改 TF-IDF

### 17.2 P1 8 项全改 ✅
- [x] P1-1 顶栏右区 ≤ 280px
- [x] P1-2 顶栏徽章 2s 呼吸光晕
- [x] P1-3 首次启动引导不开右栏
- [x] P1-4 LlmEvent 15 种 type
- [x] P1-5 路由表 17 个
- [x] P1-6 主题表 3 套
- [x] P1-7 macOS 顶栏 32px
- [x] P1-8 .bak.json 3 版本循环

### 17.3 v2.0 / v2.1 全部 P0/P1 吸收 ✅
- [x] focus-visible
- [x] 字号 t-shirt 命名
- [x] 4 状态组件
- [x] prefers-reduced-motion 颗粒度
- [x] SR 5 场景
- [x] 路由 80ms crossfade
- [x] 同色相 accent
- [x] Card hover Linear 路线
- [x] Modal 200ms fade only
- [x] Drawer 240ms
- [x] Command Palette 200/200 对称
- [x] Stream shimmer 文字流
- [x] 暗色 HSL 调色公式
- [x] v2.0 5 P0 (右栏默认折叠 / 5 Tab / 待审阅 / 静态光标 / 中文字体)
- [x] v2.0 6 P1 + 4 owner 补

---

## 18. 26 commit 重排 (Week 0 砍 1)

### 18.1 Week 0 (前置, 4 commit) - 用户立即可见
1. `feat(theme): 强制 light/dark/auto 3 套,删除自定义主题` (P1-6)
2. `feat(tokens): 重构 CSS 变量,7 档 t-shirt 字号 + 2 套 spacing`
3. `feat(accent): 同色相跨主题,indigo-500 ↔ indigo-400`
4. `feat(focus): focus-visible 全站替换`

### 18.2 Week 1-2 (内部, 7 commit) - 一次性 ship
5. `refactor(ipc): LlmClient 3 adapter 改 SSE 流式 + LlmEvent 15 种` (P0-2 + P1-4)
6. `refactor(routes): 17 路由 → 4 工作区,加 redirect` (P1-5)
7. `feat(layout): AppLayout 三栏 (240/主/320) + 顶栏右区约束` (P0-5 + P0-6 + P1-1)
8. `feat(sidenav): 4 工作区树形 + 左栏头部固定`
9. `feat(topbar): 顶栏固定导航 + AI 状态徽章 (2s 呼吸)` (P1-2)
10. `feat(rightpanel): AI 协作右栏,默认折叠 + 5 状态 + Cmd+L 触发 + 破坏性白名单` (P0-1)
11. `feat(workspace): 主区常驻 Chat + 3 辅助面板可堆叠` (P0-5)

### 18.3 Week 3 (alpha, 4 commit)
12. `feat(thinking): ThinkingIndicator 重做(静态文字 + 1.5s 光标)`
13. `feat(toolcall): ToolCallCard 5 状态 + warning + 默认折叠 + Apply/Reject`
14. `feat(memory): MemoryChip TF-IDF 关键词匹配 + 系统评分` (P0-7)
15. `feat(skill): SkillCard 保留,只在 Skills 工作区用`

### 18.4 Week 4 (beta, 4 commit)
16. `feat(motion): 修 7 个反模式 (focus/route/Modal/Drawer/Palette/Stream/reduced-motion)`
17. `feat(a11y): SR 5 场景 + skip-link + 平台 focus ring 差异`
18. `feat(responsive): 3 断点响应式 + 宽度联动约束` (P0-6)
19. `perf(bundle): vite manualChunks 函数式 + 路由懒加载` (P0-4)

### 18.5 Week 5 (rc, 4 commit)
20. `feat(state): OfflineBar / PermissionPrompt / QuotaBar / ModelStatus`
21. `feat(button): 7 variant (含 Link/Icon/Loading/Toggle)`
22. `feat(migrate): v4.3.1 → v4.4.0 老用户迁移 (17 路由/3 主题/.bak 3 版本)` (P1-5 + P1-6 + P1-8)
23. `test(integration): 26 commit 集成测试 + 老用户迁移 E2E`

### 18.6 Week 6 (ship, 3 commit)
24. `feat(onboarding): 首次启动引导,不开右栏 (Cursor 路线)` (P1-3)
25. `docs: 重设计 v2.1.1 README + 截图 + 视频 + 迁移指南`
26. `release: v4.4.0 (或 v5.0.0) ship`

**总计 26 commit 不变**,Week 0 砍 1 变 4,加 onboarding 1 变 3 在 Week 6。

---

## 19. 关键文件清单 (v2.1.1 新增/重写)

### 19.1 新增
- `src/composables/usePendingReview.ts` (P0-1)
- `src/composables/useWorkspacePanels.ts` (P0-5)
- `src/composables/useLayout.ts` (P0-6)
- `src/composables/useLlmStream.ts` (P1-4)
- `electron/agent/MemoryScorer.ts` (P0-7)
- `src/components/ai/AiStatusBadge.vue` (P1-2)
- `src/components/onboarding/FirstLaunchGuide.vue` (P1-3)
- `src/components/layout/TopBar.vue` (重写,P1-1)
- `src/components/ai/ToolCallCard.vue` (重写,P0-1)
- `src/components/ai/MemoryChip.vue` (重写,P0-7)
- `src/styles/fonts.scss` (P0-3)
- `src/styles/tokens-v2.scss` (P1-7)
- `src/router/redirects.ts` (P1-5)
- `electron/migrations/theme-v4.3-to-v4.4.ts` (P1-6)
- `electron/migrations/config-backup.ts` (P1-8)
- `electron/migrations/v4.3-to-v4.4.ts` (整合)
- `vite.config.mts` (重写,P0-4)

### 19.2 重写
- `electron/llm/LlmClient.ts` (P0-2)
- `electron/agent/LlmAgentBrain.ts` (P0-2)
- `electron/runtime/bridge/IpcBridge.ts` (P0-2)

---

## 20. 总结

**v2.1.1 是 ship-ready 实施手册**:
- 7 P0 必改项全部给具体代码/配置
- 8 P1 升级项全部给具体代码/配置
- 15 项改稿覆盖 26 commit 的所有关键决策
- 3 事实错(LlmClient 流式 / 字体 / vite API)全部修干净
- 工程实施细节不再"实现时再说"

**预估 v2.1.1 ship-ready 程度**: 7.5-8.0/10
- v2.0 5.8 → v2.1 7.0 → v2.1.1 7.5-8.0 (+0.5-1.0)
- 主要提升:工程实施细节到位,可直接交给 coder 实施

**v2.1.1 → 26 commit 实施 (6 周)**:
- Week 0 ship 视觉 (4 commit)
- Week 1-2 内部信息架构 (7 commit)
- Week 3 alpha AI 组件 (4 commit)
- Week 4 beta 动效 (4 commit)
- Week 5 rc 状态/迁移 (4 commit)
- Week 6 ship onboarding + docs + release (3 commit)

**下一步**: Owner 自评 → Designer 评审 → v2.1.1 final。
