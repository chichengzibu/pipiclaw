/**
 * PiPiClaw - OpenClaw 网关服务入口
 * 
 * 核心能力：
 * 1. 基于Node.js http模块创建HTTP服务，监听18789端口
 * 2. 对接已有的OpenClawExecutor执行器
 * 3. 集成权限校验中间件
 * 4. 健康检查接口
 * 5. 完整的启动/停止/重启方法
 * 6. 全链路日志记录
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { OpenClawGateway } from './OpenClawGateway';
import { PermissionManager } from '../permissions/PermissionManager';
import { LogManager } from '../core/LogManager';

// ========== 类型定义 ==========

export interface ServerConfig {
  port: number;
  host: string;
  /**
   * CORS 允许的 origin 列表。
   * 默认拒绝跨域,只允许 127.0.0.1/localhost 同源。
   * 生产环境如需第三方接入,白名单需显式配置。
   */
  corsAllowedOrigins?: string[];
}

export interface ApiRequest {
  operation: string;
  params: any;
  timestamp: number;
}

export interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  errorCode?: string;
  guidance?: string;
  timestamp: number;
}

// ========== OpenClawServer 类 ==========

export class OpenClawServer {
  private static instance: OpenClawServer;
  private log = LogManager.getInstance();
  private server: ReturnType<typeof createServer> | null = null;
  private executor!: OpenClawGateway;
  private permissionManager: PermissionManager;
  private config: ServerConfig;
  private running = false;

  private constructor(config?: Partial<ServerConfig>) {
    this.permissionManager = PermissionManager.getInstance();
    this.config = {
      port: 18789,
      host: '127.0.0.1',
      // 默认只允许 127.0.0.1 + localhost 同源(无协议端口变体),
      // 避免浏览器/同机进程对 18789 端口发起跨域请求
      corsAllowedOrigins: [
        'http://127.0.0.1',
        'http://127.0.0.1:5173',
        'http://localhost',
        'http://localhost:5173',
        'app://pipiclaw',           // Electron 自定义协议
        'file://',                   // 本地文件 (renderer 走 file:// 的兜底)
      ],
      ...config
    };
    this.log.info('[OpenClawServer] 初始化网关服务');
  }

  // 延迟初始化 OpenClawGateway 的方法
  private getExecutor(): OpenClawGateway {
    if (!this.executor) {
      this.executor = OpenClawGateway.getInstance();
    }
    return this.executor;
  }

  public static getInstance(config?: Partial<ServerConfig>): OpenClawServer {
    if (!OpenClawServer.instance) {
      OpenClawServer.instance = new OpenClawServer(config);
    }
    return OpenClawServer.instance;
  }

  /**
   * 启动网关服务
   */
  public async start(port?: number): Promise<{ port: number; success: boolean; error?: string }> {
    if (this.running) {
      this.log.warn('[OpenClawServer] 网关已在运行');
      return { port: this.config.port, success: true };
    }

    const actualPort = port || this.config.port;
    this.log.info('[OpenClawServer] 正在启动网关服务', { port: actualPort });

    try {
      // 检查端口是否被占用
      const isPortAvailable = await this.checkPortAvailable(actualPort);
      if (!isPortAvailable) {
        this.log.warn('[OpenClawServer] 端口已被占用，尝试自动切换端口', { port: actualPort });
        const newPort = await this.findAvailablePort(actualPort + 1);
        this.config.port = newPort;
        this.log.info('[OpenClawServer] 切换到新端口', { port: newPort });
      }

      // 创建HTTP服务器
      this.server = createServer(this.handleRequest.bind(this));

      // 启动监听
      await new Promise<void>((resolve, reject) => {
        this.server!.listen(this.config.port, this.config.host, () => {
          this.log.info('[OpenClawServer] 网关服务启动成功', { 
            host: this.config.host, 
            port: this.config.port 
          });
          resolve();
        });

        this.server!.on('error', (error) => {
          this.log.error('[OpenClawServer] 网关服务启动失败', error);
          reject(error);
        });
      });

      this.running = true;
      return { port: this.config.port, success: true };

    } catch (error: any) {
      const errorMsg = error.message || '启动失败';
      this.log.error('[OpenClawServer] 网关服务启动失败', error);

      return {
        port: this.config.port,
        success: false,
        error: errorMsg
      } as any;
    }
  }

  /**
   * 停止网关服务
   */
  public async stop(): Promise<void> {
    if (!this.running || !this.server) {
      this.log.warn('[OpenClawServer] 网关未运行');
      return;
    }

    this.log.info('[OpenClawServer] 正在停止网关服务');

    return new Promise<void>((resolve) => {
      this.server!.close(() => {
        this.running = false;
        this.log.info('[OpenClawServer] 网关服务已停止');
        resolve();
      });
    });
  }

  /**
   * 重启网关服务
   */
  public async restart(port?: number): Promise<{ port: number; success: boolean; error?: string }> {
    this.log.info('[OpenClawServer] 正在重启网关服务');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 500));
    return await this.start(port);
  }

  /**
   * 检查服务是否正在运行
   */
  public isRunning(): boolean {
    return this.running;
  }

  /**
   * 获取当前监听端口
   */
  public getPort(): number {
    return this.config.port;
  }

  // ========== 私有方法 ==========

  /**
   * 检查 origin 是否在白名单内。
   * 支持精确匹配 + 前缀匹配(file://, app://)。
   */
  private isOriginAllowed(origin: string, allowList: string[]): boolean {
    if (!origin) return false;
    if (allowList.length === 0) return false;
    for (const allowed of allowList) {
      if (allowed === origin) return true;
      // 前缀匹配 (file://*, app://*)
      if (allowed.endsWith('://') && origin.startsWith(allowed)) return true;
    }
    return false;
  }

  /**
   * 处理HTTP请求
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // CORS: 默认拒绝跨域,只允许白名单内的 origin。
    // 显式 echo 请求 origin(浏览器才会接受),非白名单 origin 不设该头 → 浏览器拦截。
    const requestOrigin = (req.headers['origin'] as string | undefined) ?? '';
    const allowList = this.config.corsAllowedOrigins ?? [];
    const isOriginAllowed = this.isOriginAllowed(requestOrigin, allowList);

    if (isOriginAllowed && requestOrigin) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-OpenClaw-Token');
      res.setHeader('Access-Control-Max-Age', '600');
    } else if (requestOrigin) {
      // 跨域请求带 Origin 但不在白名单:明确拒绝
      this.log.warn('[OpenClawServer] CORS 拒绝未知 origin', { origin: requestOrigin, path: req.url });
      this.sendResponse(res, 403, {
        success: false,
        error: `CORS: origin '${requestOrigin}' 不在白名单`,
        errorCode: 'CORS_DENIED',
        timestamp: Date.now()
      });
      return;
    }

    // 处理OPTIONS预检请求(只对白名单 origin 放行)
    if (req.method === 'OPTIONS') {
      res.writeHead(isOriginAllowed ? 200 : 403);
      res.end();
      return;
    }

    // 解析URL
    const parsedUrl = new URL(req.url || '', `http://${req.headers.host}`);
    const path = parsedUrl.pathname;

    this.log.debug('[OpenClawServer] 收到请求', { method: req.method, path });

    // 健康检查接口
    if (path === '/health' && req.method === 'GET') {
      this.handleHealthCheck(res);
      return;
    }

    // 执行操作接口
    if (path === '/execute' && req.method === 'POST') {
      this.handleExecute(req, res);
      return;
    }

    // 权限检查接口
    if (path === '/permission-check' && req.method === 'POST') {
      this.handlePermissionCheck(req, res);
      return;
    }

    // 404处理
    this.sendResponse(res, 404, {
      success: false,
      error: '接口不存在',
      errorCode: 'NOT_FOUND',
      timestamp: Date.now()
    });
  }

  /**
   * 健康检查处理
   */
  private handleHealthCheck(res: ServerResponse): void {
    const response: ApiResponse = {
      success: true,
      data: {
        status: 'ok',
        timestamp: Date.now(),
        version: '1.0.0'
      },
      timestamp: Date.now()
    };

    this.sendResponse(res, 200, response);
  }

  /**
   * 执行操作处理
   */
  private async handleExecute(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      const request: ApiRequest = body;

      this.log.info('[OpenClawServer] 收到执行请求', { 
        operation: request.operation,
        timestamp: request.timestamp
      });

      // 权限校验
      const permissionCheck = await this.checkOperationPermission(request);
      if (!permissionCheck.allowed) {
        this.sendResponse(res, 403, {
          success: false,
          error: permissionCheck.reason,
          errorCode: 'PERMISSION_DENIED',
          guidance: permissionCheck.guidance,
          timestamp: Date.now()
        });
        return;
      }

      // 执行操作
      const result = await this.getExecutor().executeOperation({
        operationType: request.operation as any,
        params: request.params
      });

      const response: ApiResponse = {
        success: result.success,
        data: result,
        error: result.error,
        errorCode: result.errorCode,
        guidance: (result as any).guidance,
        timestamp: Date.now()
      };

      this.sendResponse(res, result.success ? 200 : 500, response);

    } catch (error: any) {
      this.log.error('[OpenClawServer] 执行请求失败', error);
      this.sendResponse(res, 500, {
        success: false,
        error: error.message || '执行失败',
        errorCode: 'EXECUTION_ERROR',
        guidance: '请检查参数是否正确',
        timestamp: Date.now()
      });
    }
  }

  /**
   * 权限检查处理
   */
  private async handlePermissionCheck(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      const check = this.permissionManager.checkPermission({
        category: body.category,
        action: body.action,
        resource: body.resource
      });

      const guidance = check.allowed ? undefined : `请在权限管理中启用「${body.category}」的「${body.action}」权限`;

      this.sendResponse(res, 200, {
        success: true,
        data: {
          allowed: check.allowed,
          reason: check.reason,
          guidance
        },
        timestamp: Date.now()
      });

    } catch (error: any) {
      this.log.error('[OpenClawServer] 权限检查失败', error);
      this.sendResponse(res, 500, {
        success: false,
        error: error.message || '检查失败',
        timestamp: Date.now()
      });
    }
  }

  /**
   * 检查操作权限
   */
  private async checkOperationPermission(request: ApiRequest): Promise<{
    allowed: boolean;
    reason?: string;
    guidance?: string;
  }> {
    // 简化的权限映射
    const operationToPermission: Record<string, { category: string; action: string }> = {
      'read_file': { category: 'filesystem', action: 'read' },
      'write_file': { category: 'filesystem', action: 'write' },
      'create_file': { category: 'filesystem', action: 'write' },
      'delete_file': { category: 'filesystem', action: 'delete' },
      'list_directory': { category: 'filesystem', action: 'list' },
      'create_directory': { category: 'filesystem', action: 'create' },
      'delete_directory': { category: 'filesystem', action: 'delete' },
      'run_command': { category: 'shell', action: 'execute' },
      'open_url': { category: 'system', action: 'read' },
      'clipboard_read': { category: 'clipboard', action: 'read' },
      'clipboard_write': { category: 'clipboard', action: 'write' }
    };

    const permissionConfig = operationToPermission[request.operation];
    if (!permissionConfig) {
      return { allowed: true }; // 未知操作，默认允许（实际项目中应该拒绝）
    }

    const check = this.permissionManager.checkPermission({
      category: permissionConfig.category as any,
      action: permissionConfig.action,
      resource: request.params?.path || request.params?.resource
    });

    const guidance = check.allowed ? undefined : `请在权限管理中启用「${permissionConfig.category}」的「${permissionConfig.action}」权限`;

    return {
      allowed: check.allowed,
      reason: check.reason,
      guidance
    };
  }

  /**
   * 解析请求体
   */
  private parseRequestBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';

      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });

      req.on('error', reject);
    });
  }

  /**
   * 发送响应
   */
  private sendResponse(res: ServerResponse, statusCode: number, data: ApiResponse): void {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHead(statusCode);
    res.end(JSON.stringify(data));
  }

  /**
   * 检查端口是否可用
   */
  private checkPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();
      server.listen(port, '127.0.0.1', () => {
        server.close(() => {
          resolve(true);
        });
      });

      server.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * 查找可用端口
   */
  private async findAvailablePort(startPort: number): Promise<number> {
    const maxPort = startPort + 100;
    for (let port = startPort; port <= maxPort; port++) {
      const available = await this.checkPortAvailable(port);
      if (available) {
        return port;
      }
    }
    throw new Error('没有找到可用端口');
  }

  /**
   * 销毁实例
   */
  public async destroy(): Promise<void> {
    await this.stop();
    OpenClawServer.instance = null as any;
  }
}
