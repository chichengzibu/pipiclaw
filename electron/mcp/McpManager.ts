/**
 * PiPiClaw - MCP Manager (主进程)
 *
 * 职责:
 * 1. 维护多个 MCP server 实例 (一个 server → 一个 transport)
 * 2. 启动/停止 server (委托给 StdioTransport)
 * 3. 缓存每个 server 的 tools (调用 tools/list 后存起来)
 * 4. 提供统一 invoke(serverName|toolName, args) 接口
 * 5. server 启动时根据配置选择 command (dev vs prod)
 *
 * 已知 M1 限制 (M2 再补):
 * - 不支持 SSE / HTTP transport
 * - 不支持自动重连
 * - 不支持 server → client request (sampling 等)
 * - 不支持 resources/* / prompts/*
 */

import path from 'node:path';
import { app } from 'electron';
import { LogManager } from '../core/LogManager';
import { StdioTransport } from './transport/stdio';
import type {
  McpInvokeResult,
  McpServerConfig,
  McpServerStatus,
  McpTool,
  McpToolCallParams,
  McpToolResult,
} from './types';

const log = LogManager.getInstance();

interface ServerInstance {
  config: McpServerConfig;
  transport: StdioTransport;
  tools: McpTool[];
  startedAt: number;
  lastError: string | null;
}

/**
 * 决定如何 spawn 一个 Node 子进程
 * - dev (没有 electron process): 用 'node' 走 PATH
 * - prod (electron 在跑): 用 process.execPath + ELECTRON_RUN_AS_NODE=1
 *   这样打包后不需要依赖系统装 node
 */
function pickNodeCommand(): { command: string; env: Record<string, string> } {
  if (process.versions.electron) {
    return {
      command: process.execPath,
      env: { ELECTRON_RUN_AS_NODE: '1' },
    };
  }
  return {
    command: 'node',
    env: {},
  };
}

/**
 * 解析 filesystem server 脚本路径
 * 优先: <__dirname>/bin/filesystem-server.mjs (prod)
 * 回退: <process.cwd()>/electron/mcp/bin/filesystem-server.mjs (dev 老路径)
 */
function resolveFilesystemServerScript(): string {
  // dist-electron/mcp/McpManager.js → dist-electron/mcp/bin/filesystem-server.mjs
  const primary = path.join(__dirname, 'bin', 'filesystem-server.mjs');
  const fs = require('node:fs') as typeof import('node:fs');
  if (fs.existsSync(primary)) return primary;
  // dev fallback: 项目根下 electron/mcp/bin/
  const fallback = path.join(process.cwd(), 'electron', 'mcp', 'bin', 'filesystem-server.mjs');
  if (fs.existsSync(fallback)) return fallback;
  // 找任何 dist-electron 下的同文件
  const cwd = process.cwd();
  for (const p of [
    path.join(cwd, 'dist-electron', 'mcp', 'bin', 'filesystem-server.mjs'),
    path.join(cwd, 'dist-electron', 'bin', 'filesystem-server.mjs'),
  ]) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    `Cannot locate filesystem-server.mjs (tried ${primary}, ${fallback}) — did you forget the vite copy plugin?`
  );
}

/**
 * filesystem server 专用: 把用户配置的 command/args 替换成我们的内部命令
 * (因为 .mjs 必须用 Node 跑, 不接受用户随便填 npx 之类的命令)
 *
 * 接受用户两种配置:
 *   1) 显式 command='pipiclaw-filesystem' (我们识别) → 用内置脚本
 *   2) command='node' / command 留空 → 同样用内置脚本
 *   3) 其他 command → 原样 spawn (留给 M2 接 npx -y @modelcontextprotocol/server-filesystem 之类)
 */
function buildFilesystemCommand(
  config: McpServerConfig,
  allowedPaths: string[]
): { command: string; args: string[]; env: Record<string, string> } {
  const { command, env: pickEnv } = pickNodeCommand();
  const scriptPath = resolveFilesystemServerScript();
  const allowedJson = JSON.stringify(allowedPaths);

  return {
    command,
    args: [scriptPath, allowedJson, ...(config.args ?? [])],
    env: { ...pickEnv, ...(config.env ?? {}) },
  };
}

export class McpManager {
  private static instance: McpManager;
  private servers = new Map<string, ServerInstance>();
  private log = LogManager.getInstance();

  private constructor() {}

  static getInstance(): McpManager {
    if (!McpManager.instance) {
      McpManager.instance = new McpManager();
    }
    return McpManager.instance;
  }

  // ========== Server 生命周期 ==========

  /**
   * 启动一个 server
   * - 创建 StdioTransport
   * - spawn + initialize
   * - 调 tools/list 缓存工具列表
   *
   * filesystem server 特殊处理: 用我们的内置脚本
   * 其它 server: 直接用 config.command / args
   */
  async startServer(config: McpServerConfig): Promise<McpServerStatus> {
    if (this.servers.has(config.name)) {
      const existing = this.servers.get(config.name)!;
      if (existing.transport.isReady()) {
        log.info(`[McpManager] server already running: ${config.name}`);
        return this.toStatus(config.name, existing);
      }
      // not ready → 先 stop
      await this.stopServer(config.name);
    }

    let transport: StdioTransport;

    // filesystem server 走内置脚本
    if (this.isFilesystemServer(config)) {
      const userData = app?.getPath?.('userData') ?? process.cwd();
      const fs = require('node:fs') as typeof import('node:fs');
      const sandbox = path.join(userData, 'sandbox');
      try { fs.mkdirSync(sandbox, { recursive: true }); } catch { /* ignore */ }

      const allowed = config.allowedPaths ?? [sandbox, process.cwd()];
      const { command, args, env } = buildFilesystemCommand(config, allowed);

      log.info(
        `[McpManager] starting filesystem server "${config.name}" → ${command} ${args.join(' ')}`
      );
      transport = new StdioTransport({
        command,
        args,
        env,
        serverName: config.name,
        startupTimeoutMs: config.startupTimeoutMs ?? 10000,
        callTimeoutMs: config.callTimeoutMs ?? 30000,
      });
    } else {
      log.info(
        `[McpManager] starting custom server "${config.name}" → ${config.command} ${(config.args ?? []).join(' ')}`
      );
      transport = new StdioTransport({
        command: config.command,
        args: config.args ?? [],
        env: config.env ?? {},
        serverName: config.name,
        startupTimeoutMs: config.startupTimeoutMs ?? 10000,
        callTimeoutMs: config.callTimeoutMs ?? 30000,
      });
    }

    const instance: ServerInstance = {
      config,
      transport,
      tools: [],
      startedAt: Date.now(),
      lastError: null,
    };
    this.servers.set(config.name, instance);

    try {
      await transport.start();
      // initialize OK → 取 tools/list
      const listResp = await transport.request<{ tools: McpTool[] }>('tools/list', {});
      if ('error' in listResp) {
        throw new Error(`tools/list error: ${(listResp.error as { message: string }).message}`);
      }
      instance.tools = listResp.result?.tools ?? [];
      log.info(
        `[McpManager] server "${config.name}" ready, ${instance.tools.length} tools: ${instance.tools.map((t) => t.name).join(', ')}`
      );
      return this.toStatus(config.name, instance);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      instance.lastError = err.message;
      log.error(`[McpManager] server "${config.name}" start failed: ${err.message}`);
      // 清理 transport
      try {
        await transport.stop();
      } catch {
        /* ignore */
      }
      this.servers.delete(config.name);
      return {
        name: config.name,
        state: 'crashed',
        pid: null,
        startedAt: null,
        lastError: err.message,
        toolCount: 0,
      };
    }
  }

  async stopServer(name: string): Promise<void> {
    const inst = this.servers.get(name);
    if (!inst) return;
    log.info(`[McpManager] stopping server: ${name}`);
    try {
      await inst.transport.stop();
    } catch (e) {
      log.warn(`[McpManager] stop "${name}" error: ${(e as Error).message}`);
    }
    this.servers.delete(name);
  }

  async stopAll(): Promise<void> {
    const names = [...this.servers.keys()];
    await Promise.all(names.map((n) => this.stopServer(n)));
  }

  // ========== 工具查询 + 调用 ==========

  /**
   * 列出所有 server 的所有 tools (聚合)
   * - 加 server 前缀: '<server>:<tool>'
   * - 供 UI 展示 & agent 注入
   */
  async listAllTools(): Promise<Array<McpTool & { server: string }>> {
    const all: Array<McpTool & { server: string }> = [];
    for (const [serverName, inst] of this.servers.entries()) {
      for (const tool of inst.tools) {
        all.push({ ...tool, server: serverName });
      }
    }
    return all;
  }

  /**
   * 列出所有 server 的 tools (按 server 分组, 不加前缀)
   */
  listServerTools(): Record<string, McpTool[]> {
    const out: Record<string, McpTool[]> = {};
    for (const [serverName, inst] of this.servers.entries()) {
      out[serverName] = [...inst.tools];
    }
    return out;
  }

  /**
   * 调用一个 tool
   * - 第一个参数支持两种格式:
   *   (a) { server, toolName, args }    明确指定
   *   (b) '<server>:<toolName>' + args  简写
   *   (c) '<toolName>'                  自动从所有 server 找 (M1: 重复名 → 报错)
   */
  async invoke(
    target: { server: string; toolName: string; args: Record<string, unknown> }
  ): Promise<McpInvokeResult> {
    const { server, toolName, args } = target;
    const inst = this.servers.get(server);
    if (!inst) {
      return {
        success: false,
        error: `MCP server not running: ${server}`,
        errorCode: -32000,
        durationMs: 0,
      };
    }
    if (!inst.transport.isReady()) {
      return {
        success: false,
        error: `MCP server "${server}" not ready (state=${inst.transport.getState()})`,
        errorCode: -32000,
        durationMs: 0,
      };
    }
    const toolDef = inst.tools.find((t) => t.name === toolName);
    if (!toolDef) {
      return {
        success: false,
        error: `MCP server "${server}" has no tool "${toolName}"`,
        errorCode: -32601,
        durationMs: 0,
      };
    }
    const start = Date.now();
    try {
      // 基础 input 校验 (用 inputSchema 的 required 字段)
      const required = toolDef.inputSchema.required ?? [];
      for (const k of required) {
        if (!(k in (args ?? {}))) {
          return {
            success: false,
            error: `Missing required argument: ${k}`,
            errorCode: -32602,
            durationMs: Date.now() - start,
          };
        }
      }
      const params: McpToolCallParams = { name: toolName, arguments: args ?? {} };
      const resp = await inst.transport.request<McpToolResult>('tools/call', params);
      if ('error' in resp) {
        return {
          success: false,
          error: (resp.error as { message: string }).message,
          errorCode: (resp.error as { code: number }).code,
          durationMs: Date.now() - start,
        };
      }
      return {
        success: true,
        result: resp.result as McpToolResult,
        durationMs: Date.now() - start,
      };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      log.error(`[McpManager] invoke ${server}:${toolName} failed: ${err.message}`);
      return {
        success: false,
        error: err.message,
        errorCode: -32603,
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * 简写 invoke: 第一个参数是 'server:tool' 或 'tool'
   * - 'tool' 形式: 自动从所有 server 找, 重复 → 抛错
   */
  async invokeByName(
    qualifiedName: string,
    args: Record<string, unknown> = {}
  ): Promise<McpInvokeResult> {
    if (qualifiedName.includes(':')) {
      const [server, toolName] = qualifiedName.split(':', 2);
      return this.invoke({ server, toolName, args });
    }
    // 找唯一匹配
    let found: { server: string } | null = null;
    let dup = 0;
    for (const [serverName, inst] of this.servers.entries()) {
      if (inst.tools.some((t) => t.name === qualifiedName)) {
        if (found) dup++;
        else found = { server: serverName };
      }
    }
    if (!found) {
      return {
        success: false,
        error: `MCP tool not found: ${qualifiedName}`,
        errorCode: -32601,
        durationMs: 0,
      };
    }
    if (dup > 0) {
      return {
        success: false,
        error: `MCP tool name ambiguous: ${qualifiedName} (use '<server>:<tool>' to disambiguate)`,
        errorCode: -32000,
        durationMs: 0,
      };
    }
    return this.invoke({ server: found.server, toolName: qualifiedName, args });
  }

  // ========== 状态查询 ==========

  getStatus(name: string): McpServerStatus | null {
    const inst = this.servers.get(name);
    if (!inst) return null;
    return this.toStatus(name, inst);
  }

  listServers(): McpServerStatus[] {
    return [...this.servers.entries()].map(([name, inst]) => this.toStatus(name, inst));
  }

  // ========== 内部 ==========

  private toStatus(name: string, inst: ServerInstance): McpServerStatus {
    const state = inst.transport.getState();
    return {
      name,
      state: state === 'ready' ? 'ready' : state === 'spawning' ? 'starting' : state === 'stopped' ? 'stopped' : 'crashed',
      pid: null, // 我们没有暴露 child.pid, 简化
      startedAt: inst.startedAt,
      lastError: inst.lastError,
      toolCount: inst.tools.length,
    };
  }

  /**
   * 识别 "filesystem server"
   * - 显式: command 包含 'filesystem' 或 name === 'filesystem' 或 name 以 'filesystem' 开头
   * - 默认: name === 'pipiclaw-filesystem' (我们写死的内部 server)
   */
  private isFilesystemServer(config: McpServerConfig): boolean {
    const lc = (s: string) => s.toLowerCase();
    if (lc(config.name).includes('filesystem')) return true;
    if (lc(config.command || '').includes('filesystem')) return true;
    return false;
  }
}
