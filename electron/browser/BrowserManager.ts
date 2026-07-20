/**
 * PiPiClaw - 浏览器自动化管理器
 * 
 * 职责：
 * 1. 管理 Playwright 浏览器实例
 * 2. 提供浏览器操作 API
 * 3. 记录操作日志
 */

import { LogManager } from '../core/LogManager';

// 动态导入 Playwright
let pw: any = null;

export interface BrowserOptions {
  headless?: boolean;
  slowMo?: number;
  userAgent?: string;
  viewport?: { width: number; height: number };
}

export interface BrowserSession {
  id: string;
  createdAt: number;
  lastActiveAt: number;
  browser: any;
  context: any;
  page: any;
}

export class BrowserManager {
  private static instance: BrowserManager;
  private log = LogManager.getInstance();
  private sessions: Map<string, BrowserSession> = new Map();
  private defaultOptions: BrowserOptions = {
    headless: false,
    slowMo: 50,
    viewport: { width: 1280, height: 720 }
  };

  private constructor() {
    this.log.info('[BrowserManager] 初始化中...');
    // 延迟初始化，不阻塞构造函数
    this.initPlaywright().catch(err => {
      this.log.warn('[BrowserManager] Playwright 初始化失败（可选功能）', err);
    });
  }

  private async initPlaywright() {
    try {
      // 延迟加载 Playwright，避免阻塞应用启动
      this.log.info('[BrowserManager] 正在加载 Playwright...');
      pw = await import('playwright');
      this.log.info('[BrowserManager] Playwright 加载成功');
    } catch (error) {
      this.log.error('[BrowserManager] Playwright 加载失败', error);
    }
  }

  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  /**
   * 创建新浏览器会话
   */
  public async createSession(options?: BrowserOptions): Promise<string> {
    if (!pw) {
      throw new Error('Playwright 未加载，请检查安装');
    }

    const sessionId = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const mergedOptions = { ...this.defaultOptions, ...options };

    try {
      this.log.info(`[BrowserManager] 创建会话: ${sessionId}`);

      const browser = await pw.chromium.launch(mergedOptions);
      const context = await browser.newContext();
      const page = await context.newPage();

      const session: BrowserSession = {
        id: sessionId,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        browser,
        context,
        page
      };

      this.sessions.set(sessionId, session);
      this.log.info(`[BrowserManager] 会话创建成功: ${sessionId}`);

      return sessionId;
    } catch (error) {
      this.log.error('[BrowserManager] 创建会话失败', error);
      throw error;
    }
  }

  /**
   * 获取会话
   */
  private getSession(sessionId: string): BrowserSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }
    session.lastActiveAt = Date.now();
    return session;
  }

  /**
   * 打开网址
   */
  public async navigate(sessionId: string, url: string): Promise<void> {
    const session = this.getSession(sessionId);
    this.log.info(`[BrowserManager] 打开网址: ${url}`);
    await session.page.goto(url, { waitUntil: 'networkidle' });
  }

  /**
   * 点击元素
   */
  public async click(sessionId: string, selector: string): Promise<void> {
    const session = this.getSession(sessionId);
    this.log.info(`[BrowserManager] 点击: ${selector}`);
    await session.page.click(selector);
  }

  /**
   * 输入文本
   */
  public async type(sessionId: string, selector: string, text: string): Promise<void> {
    const session = this.getSession(sessionId);
    this.log.info(`[BrowserManager] 输入文本: ${selector}`);
    await session.page.fill(selector, text);
  }

  /**
   * 获取文本
   */
  public async getText(sessionId: string, selector: string): Promise<string> {
    const session = this.getSession(sessionId);
    const text = await session.page.textContent(selector);
    return text || '';
  }

  /**
   * 等待元素
   */
  public async waitForSelector(sessionId: string, selector: string, timeout?: number): Promise<void> {
    const session = this.getSession(sessionId);
    await session.page.waitForSelector(selector, { timeout: timeout || 30000 });
  }

  /**
   * 截图
   */
  public async screenshot(sessionId: string, path?: string): Promise<Buffer> {
    const session = this.getSession(sessionId);
    const screenshot = await session.page.screenshot({ path, fullPage: true });
    return screenshot;
  }

  /**
   * 获取页面标题
   */
  public async getTitle(sessionId: string): Promise<string> {
    const session = this.getSession(sessionId);
    return await session.page.title();
  }

  /**
   * 获取页面 URL
   */
  public async getUrl(sessionId: string): Promise<string> {
    const session = this.getSession(sessionId);
    return session.page.url();
  }

  /**
   * 关闭会话
   */
  public async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.browser.close();
      } catch (error) {
        this.log.warn('[BrowserManager] 关闭浏览器失败', error);
      }
      this.sessions.delete(sessionId);
      this.log.info(`[BrowserManager] 会话已关闭: ${sessionId}`);
    }
  }

  /**
   * 关闭所有会话
   */
  public async closeAllSessions(): Promise<void> {
    for (const sessionId of this.sessions.keys()) {
      await this.closeSession(sessionId);
    }
  }

  /**
   * 获取活跃会话列表
   */
  public getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * 销毁管理器
   */
  public async destroy(): Promise<void> {
    await this.closeAllSessions();
    BrowserManager.instance = null as any;
  }
}
