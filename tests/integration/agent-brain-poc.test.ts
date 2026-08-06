/**
 * PiPiClaw - LlmAgentBrain v0.1 端到端 PoC (M1 v0.1)
 *
 * 验证 LlmAgentBrain.run() + LlmClient.streamChat() + 5 工具 端到端集成
 *
 * 策略:
 *   - mock LlmClient.streamChat (因为 vitest 跑没 llm-config, 无法调真 Ollama)
 *   - mock 返 2 轮 stream: 第 1 轮 tool_call(Glob) → 跑工具 → 第 2 轮 final content
 *   - 验证 final_answer + tool_call/tool_result 事件 + 工具执行结果
 *
 * 跟单测区别: 单测测 5 工具独立行为, 本 spec 测 LlmAgentBrain loop 编排 + 5 工具集成
 *
 * 真链路 (Ollama 11434) 端到端留给 scripts/agent-tool-call-poc.mjs (在 dist-electron 跑)
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { app } from 'electron'
import * as fsSync from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

// 真实测试根目录, 避免污染项目目录
const TEST_ROOT = fsSync.mkdtempSync(path.join(os.tmpdir(), 'agent-brain-poc-'))
const SANDBOX_DIR = path.join(TEST_ROOT, 'sandbox')
const WORKSPACE_DIR = path.join(TEST_ROOT, 'workspace')
fsSync.mkdirSync(SANDBOX_DIR, { recursive: true })
fsSync.mkdirSync(WORKSPACE_DIR, { recursive: true })
// 准备测试文件 (5 工具真调用能跑通)
fsSync.writeFileSync(path.join(SANDBOX_DIR, 'hello.txt'), 'PiPiClaw is great\n', 'utf-8')
fsSync.writeFileSync(path.join(SANDBOX_DIR, 'app.ts'), 'export const version = "1.0"\n', 'utf-8')
fsSync.writeFileSync(path.join(SANDBOX_DIR, 'readme.md'), '# Notes\nversion 1.0 draft\n', 'utf-8')

beforeAll(() => {
  vi.spyOn(app, 'getPath').mockImplementation((k: string) => {
    if (k === 'userData') return TEST_ROOT
    return TEST_ROOT
  })
})

afterAll(async () => {
  await fs.rm(TEST_ROOT, { recursive: true, force: true })
})

import { LlmAgentBrain, LlmAgentBrainEvents, type LlmAgentEvent } from '../../electron/agent/LlmAgentBrain'
import { LlmClient } from '../../electron/llm/LlmClient'
import type { LlmStreamChunk, LlmToolCall } from '../../electron/llm/types'

describe('LlmAgentBrain v0.1 端到端 (mock LLM)', () => {
  it('run → mock LLM 返 Glob tool_call → 调 Glob tool → mock LLM 返 final', async () => {
    // 1) mock LlmClient.streamChat: 第 1 轮 tool_call(Glob), 第 2 轮 final
    let callCount = 0
    const mockStream = async function* (this: LlmClient, _req: any, _signal?: AbortSignal) {
      callCount++
      if (callCount === 1) {
        const tc: LlmToolCall = {
          id: 'call_glob_1',
          type: 'function',
          function: {
            name: 'Glob',
            arguments: JSON.stringify({ pattern: '**/*.txt' }),
          },
        }
        yield { type: 'tool_call', toolCall: tc, provider: 'openai-compatible', model: 'qwen3.5:9b' } as LlmStreamChunk
        yield { type: 'done', provider: 'openai-compatible', model: 'qwen3.5:9b' } as LlmStreamChunk
      } else {
        const text = '在 sandbox 找到 1 个 .txt 文件: hello.txt (内容: "PiPiClaw is great")'
        yield { type: 'content', delta: text, accumulated: text, provider: 'openai-compatible', model: 'qwen3.5:9b' } as LlmStreamChunk
        yield { type: 'done', provider: 'openai-compatible', model: 'qwen3.5:9b' } as LlmStreamChunk
      }
    }
    const origStream = LlmClient.prototype.streamChat
    // @ts-ignore 替换方法
    LlmClient.prototype.streamChat = mockStream

    const events: LlmAgentEvent[] = []
    const unsub = LlmAgentBrainEvents.subscribe((e) => events.push(e))

    try {
      const brain = LlmAgentBrain.getInstance()
      const result = await brain.run('列出 sandbox 下的所有 .txt 文件', {
        provider: 'openai-compatible',
        model: 'qwen3.5:9b',
        tools: ['Glob'],
        maxIterations: 3,
      })

      // 验证
      expect(result.iterations).toBe(2)  // 1 tool_call iter + 1 final iter
      expect(result.toolCalls).toHaveLength(1)
      expect(result.toolCalls[0].name).toBe('Glob')
      expect(result.toolCalls[0].ok).toBe(true)
      expect(result.content).toContain('hello.txt')

      // 事件验证
      expect(events.some(e => e.type === 'run_start')).toBe(true)
      const toolCallEvents = events.filter(e => e.type === 'tool_call')
      expect(toolCallEvents).toHaveLength(1)
      expect((toolCallEvents[0] as any).name).toBe('Glob')
      expect((toolCallEvents[0] as any).args).toEqual({ pattern: '**/*.txt' })

      const toolResultEvents = events.filter(e => e.type === 'tool_result')
      expect(toolResultEvents).toHaveLength(1)
      expect((toolResultEvents[0] as any).name).toBe('Glob')
      expect((toolResultEvents[0] as any).ok).toBe(true)
      expect((toolResultEvents[0] as any).result).toContain('hello.txt')

      const finalEvents = events.filter(e => e.type === 'final_answer')
      expect(finalEvents).toHaveLength(1)
      expect((finalEvents[0] as any).content).toContain('hello.txt')
    } finally {
      // @ts-ignore 还原
      LlmClient.prototype.streamChat = origStream
      unsub()
    }
  }, 30000)

  it('run → mock LLM 返 Read tool_call → 调 Read tool → 返文件内容', async () => {
    let callCount = 0
    const mockStream = async function* (this: LlmClient) {
      callCount++
      if (callCount === 1) {
        const tc: LlmToolCall = {
          id: 'call_read_1',
          type: 'function',
          function: { name: 'Read', arguments: JSON.stringify({ file_path: 'hello.txt' }) },
        }
        yield { type: 'tool_call', toolCall: tc, provider: 'openai-compatible', model: 'qwen3.5:9b' } as LlmStreamChunk
        yield { type: 'done', provider: 'openai-compatible', model: 'qwen3.5:9b' } as LlmStreamChunk
      } else {
        const text = 'hello.txt 内容: "PiPiClaw is great"'
        yield { type: 'content', delta: text, accumulated: text, provider: 'openai-compatible', model: 'qwen3.5:9b' } as LlmStreamChunk
        yield { type: 'done', provider: 'openai-compatible', model: 'qwen3.5:9b' } as LlmStreamChunk
      }
    }
    const origStream = LlmClient.prototype.streamChat
    // @ts-ignore
    LlmClient.prototype.streamChat = mockStream

    try {
      const brain = LlmAgentBrain.getInstance()
      const result = await brain.run('读 hello.txt 内容', {
        provider: 'openai-compatible',
        model: 'qwen3.5:9b',
        tools: ['Read'],
        maxIterations: 3,
      })

      expect(result.iterations).toBe(2)
      expect(result.toolCalls[0].name).toBe('Read')
      expect(result.toolCalls[0].ok).toBe(true)
      expect(result.content).toContain('PiPiClaw is great')
    } finally {
      // @ts-ignore
      LlmClient.prototype.streamChat = origStream
    }
  }, 30000)

  it('run → mock LLM 返 Edit tool_call → 调 Edit tool → 验证文件已改', async () => {
    // 先备份
    const file = path.join(SANDBOX_DIR, 'edit-target.txt')
    fsSync.writeFileSync(file, 'name=old\nname=other\n', 'utf-8')

    let callCount = 0
    const mockStream = async function* (this: LlmClient) {
      callCount++
      if (callCount === 1) {
        const tc: LlmToolCall = {
          id: 'call_edit_1',
          type: 'function',
          function: {
            name: 'Edit',
            arguments: JSON.stringify({
              file_path: 'edit-target.txt',
              old_string: 'name=other',
              new_string: 'name=new',
            }),
          },
        }
        yield { type: 'tool_call', toolCall: tc, provider: 'openai-compatible', model: 'qwen3.5:9b' } as LlmStreamChunk
        yield { type: 'done', provider: 'openai-compatible', model: 'qwen3.5:9b' } as LlmStreamChunk
      } else {
        const text = '已修改 edit-target.txt, name=other 改为 name=new'
        yield { type: 'content', delta: text, accumulated: text, provider: 'openai-compatible', model: 'qwen3.5:9b' } as LlmStreamChunk
        yield { type: 'done', provider: 'openai-compatible', model: 'qwen3.5:9b' } as LlmStreamChunk
      }
    }
    const origStream = LlmClient.prototype.streamChat
    // @ts-ignore
    LlmClient.prototype.streamChat = mockStream

    try {
      const brain = LlmAgentBrain.getInstance()
      const result = await brain.run('把 edit-target.txt 里的 name=other 改为 name=new', {
        provider: 'openai-compatible',
        model: 'qwen3.5:9b',
        tools: ['Edit'],
        maxIterations: 3,
      })

      expect(result.iterations).toBe(2)
      expect(result.toolCalls[0].name).toBe('Edit')
      expect(result.toolCalls[0].ok).toBe(true)

      // 验证文件真改了
      const content = fsSync.readFileSync(file, 'utf-8')
      expect(content).toBe('name=old\nname=new\n')
    } finally {
      // @ts-ignore
      LlmClient.prototype.streamChat = origStream
      // 还原
      fsSync.writeFileSync(file, 'name=old\nname=other\n', 'utf-8')
    }
  }, 30000)

  it('run → mock LLM 立即 final → 0 tool calls, 1 iter', async () => {
    const mockStream = async function* (this: LlmClient) {
      const text = '你好, 我是 PiPiClaw 代码助手.'
      yield { type: 'content', delta: text, accumulated: text, provider: 'openai-compatible', model: 'qwen3.5:9b' } as LlmStreamChunk
      yield { type: 'done', provider: 'openai-compatible', model: 'qwen3.5:9b' } as LlmStreamChunk
    }
    const origStream = LlmClient.prototype.streamChat
    // @ts-ignore
    LlmClient.prototype.streamChat = mockStream

    try {
      const brain = LlmAgentBrain.getInstance()
      const result = await brain.run('简单打招呼', {
        provider: 'openai-compatible',
        model: 'qwen3.5:9b',
        maxIterations: 3,
      })

      expect(result.iterations).toBe(1)
      expect(result.toolCalls).toHaveLength(0)
      expect(result.content).toContain('PiPiClaw')
    } finally {
      // @ts-ignore
      LlmClient.prototype.streamChat = origStream
    }
  }, 30000)

  it('run → maxIterations=2 强制结束 (mock 一直 tool_call)', async () => {
    let callCount = 0
    const mockStream = async function* (this: LlmClient) {
      callCount++
      // 每轮都返 tool_call, 不 final
      const tc: LlmToolCall = {
        id: `call_loop_${callCount}`,
        type: 'function',
        function: { name: 'Glob', arguments: JSON.stringify({ pattern: '*.txt' }) },
      }
      yield { type: 'tool_call', toolCall: tc, provider: 'openai-compatible', model: 'qwen3.5:9b' } as LlmStreamChunk
      yield { type: 'done', provider: 'openai-compatible', model: 'qwen3.5:9b' } as LlmStreamChunk
    }
    const origStream = LlmClient.prototype.streamChat
    // @ts-ignore
    LlmClient.prototype.streamChat = mockStream

    const events: LlmAgentEvent[] = []
    const unsub = LlmAgentBrainEvents.subscribe((e) => events.push(e))

    try {
      const brain = LlmAgentBrain.getInstance()
      const result = await brain.run('一直找文件', {
        provider: 'openai-compatible',
        model: 'qwen3.5:9b',
        maxIterations: 2,
      })

      expect(result.iterations).toBe(2)
      expect(result.toolCalls).toHaveLength(2)
      expect(events.some(e => e.type === 'run_error' && (e as any).error.includes('超过 max iterations'))).toBe(true)
    } finally {
      // @ts-ignore
      LlmClient.prototype.streamChat = origStream
      unsub()
    }
  }, 30000)
})

describe('LlmAgentBrain v0.1 工具列表 (5 工具)', () => {
  it('listTools 返 5 工具 metadata (Read/Edit/Bash/Glob/Grep)', () => {
    const brain = LlmAgentBrain.getInstance()
    const tools = brain.listTools()
    expect(tools).toHaveLength(5)
    const names = tools.map(t => t.name).sort()
    expect(names).toEqual(['Bash', 'Edit', 'Glob', 'Grep', 'Read'])
    // 验证每个有 description + parameters
    for (const t of tools) {
      expect(t.description).toBeTruthy()
      expect(t.parameters).toBeTruthy()
      expect(typeof t.requiresPermission).toBe('boolean')
    }
  })
})
