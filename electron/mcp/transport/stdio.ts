/**
 * PiPiClaw - MCP stdio transport
 *
 * 职责:
 * 1. spawn 子进程 (Node 脚本或外部 binary, 不走 shell)
 * 2. 父进程写 JSON-RPC request (newline-delimited, 立刻 flush)
 * 3. 父进程读 JSON-RPC response (newline-delimited)
 * 4. 维护 id → pending callback 映射, 异步等待
 * 5. 处理子进程 stderr (debug log)
 * 6. 处理子进程 crash (crashed 状态上报)
 * 7. 序列化所有 write (避免 stdout 交错)
 *
 * 不做 (M1 范围外):
 * - SSE / HTTP transport
 * - 自动重连
 * - 背压控制
 */

import { ChildProcess, spawn } from 'node:child_process';
import { LogManager } from '../../core/LogManager';
import type {
  JsonRpcMessage,
  JsonRpcRequest,
  JsonRpcResponse,
  PendingRequest,
} from '../types';

const log = LogManager.getInstance();

export type StdioTransportState = 'spawning' | 'ready' | 'crashed' | 'stopped';

export interface StdioTransportOptions {
  /** 子进程 command (binary 路径或 node 之类) */
  command: string;
  /** 子进程 args (数组, 不走 shell 解析) */
  args: string[];
  /** 子进程 env (合并到 process.env) */
  env?: Record<string, string>;
  /** 启动超时 (ms), 默认 10000 */
  startupTimeoutMs?: number;
  /** 调用超时 (ms), 默认 30000 */
  callTimeoutMs?: number;
  /** server 名字, 用于日志 */
  serverName: string;
}

export class StdioTransport {
  private child: ChildProcess | null = null;
  private state: StdioTransportState = 'spawning';
  private pending = new Map<string | number, PendingRequest>();
  private nextId = 1;
  private readBuf = '';
  private writeQueue: Promise<void> = Promise.resolve();
  private startupResolve: ((ok: boolean, err?: Error) => void) | null = null;
  private opts: Required<StdioTransportOptions>;

  constructor(opts: StdioTransportOptions) {
    this.opts = {
      command: opts.command,
      args: opts.args,
      env: opts.env ?? {},
      startupTimeoutMs: opts.startupTimeoutMs ?? 10000,
      callTimeoutMs: opts.callTimeoutMs ?? 30000,
      serverName: opts.serverName,
    };
  }

  /**
   * 启动子进程 + 等待 initialize 完成
   * - 走 child_process.spawn (不用 shell)
   * - env 用 process.env + opts.env (PATH 保留, 防止找不到 node)
   * - cwd 强制 = 主进程 cwd (即 PiPiClaw 安装根), 防止子进程意外读 ~/.pipiclaw
   */
  async start(): Promise<void> {
    if (this.child) {
      throw new Error(`[stdio:${this.opts.serverName}] already started`);
    }
    this.state = 'spawning';

    log.info(
      `[stdio:${this.opts.serverName}] spawning: ${this.opts.command} ${this.opts.args.join(' ')}`
    );

    try {
      this.child = spawn(this.opts.command, this.opts.args, {
        // 关键: 不走 shell, args 数组按字面量传
        shell: false,
        // 合并 env, 但保留 PATH 防止找不到 node
        env: { ...process.env, ...this.opts.env },
        // 强制 cwd = 主进程 cwd (PiPiClaw 安装根)
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (e) {
      this.state = 'crashed';
      const err = e instanceof Error ? e : new Error(String(e));
      log.error(`[stdio:${this.opts.serverName}] spawn failed: ${err.message}`);
      throw err;
    }

    // 监听 stderr (debug log, 不影响主协议)
    this.child.stderr?.setEncoding('utf-8');
    this.child.stderr?.on('data', (chunk: string) => {
      const lines = chunk.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        log.debug(`[stdio:${this.opts.serverName}][stderr] ${line}`);
      }
    });

    // 监听 stdout (newline-delimited JSON-RPC)
    this.child.stdout?.setEncoding('utf-8');
    this.child.stdout?.on('data', (chunk: string) => {
      this.handleStdout(chunk);
    });

    // 监听 exit
    this.child.on('exit', (code, signal) => {
      this.handleExit(code, signal);
    });

    this.child.on('error', (err) => {
      log.error(`[stdio:${this.opts.serverName}] child error event: ${err.message}`);
    });

    // 等 initialize 完成
    await this.waitInitialize();
  }

  /**
   * 发 initialize (按 MCP 规范: 客户端 → 服务端第一个 method)
   * 任何 initialize 失败 → start() reject
   */
  private async waitInitialize(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.startupResolve = null;
        reject(
          new Error(
            `[stdio:${this.opts.serverName}] initialize timeout (${this.opts.startupTimeoutMs}ms)`
          )
        );
        this.kill();
      }, this.opts.startupTimeoutMs);

      this.startupResolve = (ok, err) => {
        clearTimeout(timer);
        this.startupResolve = null;
        if (ok) resolve();
        else reject(err ?? new Error('initialize failed'));
      };

      this.request('initialize', {
        protocolVersion: '2025-06-18',
        clientInfo: { name: 'pipiclaw', version: '4.5.0' },
        capabilities: {},
      })
        .then((resp) => {
          if ('error' in resp) {
            const errMsg = (resp.error as { message?: string }).message ?? 'unknown error';
            this.startupResolve?.(false, new Error(`initialize error: ${errMsg}`));
            return;
          }
          this.state = 'ready';
          this.startupResolve?.(true);
        })
        .catch((err) => {
          this.startupResolve?.(false, err);
        });
    });
  }

  /**
   * 写一行 JSON 到子进程 stdin
   * 串行化: 用 writeQueue 保证多条消息不会交错
   */
  private writeLine(line: string): Promise<void> {
    this.writeQueue = this.writeQueue.then(
      () =>
        new Promise<void>((resolve, reject) => {
          if (!this.child?.stdin || this.child.stdin.destroyed) {
            reject(new Error(`[stdio:${this.opts.serverName}] stdin closed`));
            return;
          }
          const ok = this.child.stdin.write(line + '\n', 'utf-8', (err) => {
            if (err) {
              log.error(
                `[stdio:${this.opts.serverName}] stdin write error: ${err.message}`
              );
              reject(err);
              return;
            }
            resolve();
          });
          if (!ok) {
            // 背压: 等 drain 再让下一条
            this.child.stdin?.once('drain', () => {
              // 由 callback resolve, 此处不重做
            });
          }
        })
    );
    return this.writeQueue;
  }

  /**
   * 发 JSON-RPC request, 等待 response
   * 内部: 分配 id, 写一行, 等 pending map resolve
   */
  async request<T = unknown>(method: string, params?: unknown): Promise<JsonRpcResponse> {
    if (this.state !== 'ready') {
      throw new Error(
        `[stdio:${this.opts.serverName}] request called when state=${this.state} (method=${method})`
      );
    }
    const id = this.nextId++;
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params: (params as Record<string, unknown>) ?? {},
    };

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `[stdio:${this.opts.serverName}] request timeout: method=${method}, id=${id}`
          )
        );
      }, this.opts.callTimeoutMs);

      this.pending.set(id, {
        resolve: (resp) => {
          clearTimeout(timer);
          resolve(resp);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        timer,
        method,
      });

      this.writeLine(JSON.stringify(req)).catch((err) => {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * 处理子进程 stdout 的一坨数据
   * - 按 \n 切, 完整行 parse JSON
   * - 不完整行 (最后一个没换行) 留 buf
   */
  private handleStdout(chunk: string): void {
    this.readBuf += chunk;
    let idx: number;
    while ((idx = this.readBuf.indexOf('\n')) >= 0) {
      const line = this.readBuf.slice(0, idx).trim();
      this.readBuf = this.readBuf.slice(idx + 1);
      if (!line) continue;
      let msg: JsonRpcMessage;
      try {
        msg = JSON.parse(line);
      } catch (e) {
        log.warn(
          `[stdio:${this.opts.serverName}] malformed JSON: ${line.slice(0, 200)}`
        );
        continue;
      }
      this.dispatchMessage(msg);
    }
  }

  /**
   * 派发一条 JSON-RPC 消息
   * - response (有 id) → 找到 pending callback resolve
   * - notification (无 id) → 当前不处理, 只 log
   * - request (有 id + method) → 服务端主动发请求? 我们当前不实现 server→client request
   */
  private dispatchMessage(msg: JsonRpcMessage): void {
    if ('method' in msg) {
      // 通知或服务端主动请求
      log.debug(
        `[stdio:${this.opts.serverName}] received ${'id' in msg ? 'request' : 'notification'}: ${(msg as { method: string }).method}`
      );
      return;
    }
    // response
    const resp = msg as JsonRpcResponse;
    const id = resp.id;
    if (id === null || id === undefined) {
      log.warn(`[stdio:${this.opts.serverName}] response with null id, ignored`);
      return;
    }
    const pending = this.pending.get(id);
    if (!pending) {
      log.warn(
        `[stdio:${this.opts.serverName}] no pending for id=${id}, likely already timed out`
      );
      return;
    }
    this.pending.delete(id);
    pending.resolve(resp);
  }

  /**
   * 子进程退出
   * - 还在 pending 的全部 reject
   */
  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    const wasReady = this.state === 'ready';
    log.warn(
      `[stdio:${this.opts.serverName}] child exited: code=${code}, signal=${signal}, wasReady=${wasReady}`
    );
    this.state = code === 0 || signal === 'SIGTERM' || signal === 'SIGINT' ? 'stopped' : 'crashed';
    this.child = null;

    // reject 所有 pending
    for (const [id, p] of this.pending.entries()) {
      clearTimeout(p.timer);
      p.reject(new Error(`[stdio:${this.opts.serverName}] child exited during request id=${id}`));
    }
    this.pending.clear();

    if (this.startupResolve) {
      this.startupResolve(false, new Error(`child exited before initialize`));
    }
  }

  /**
   * 强制 kill 子进程
   * - 先 SIGTERM, 1s 后还活着就 SIGKILL (Windows 上等价于 taskkill /F)
   */
  async stop(): Promise<void> {
    if (this.state === 'stopped' || !this.child) {
      this.state = 'stopped';
      return;
    }
    this.state = 'stopped';
    const child = this.child;
    try {
      child.kill('SIGTERM');
    } catch (e) {
      log.warn(`[stdio:${this.opts.serverName}] kill SIGTERM failed: ${(e as Error).message}`);
    }
    // 等 1s, 还活着就强杀
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        try {
          if (child.exitCode === null && !child.killed) {
            child.kill('SIGKILL');
          }
        } catch {
          // ignore
        }
        resolve();
      }, 1000);
      child.once('exit', () => {
        clearTimeout(t);
        resolve();
      });
    });
  }

  getState(): StdioTransportState {
    return this.state;
  }

  isReady(): boolean {
    return this.state === 'ready';
  }
}
