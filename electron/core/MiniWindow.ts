/**
 * PiPiClaw - 迷你悬浮窗管理器
 * 
 * 职责：
 * 1. 创建和管理迷你悬浮窗
 * 2. 处理悬浮窗交互
 */

import { BrowserWindow, screen, app } from 'electron';
import { join } from 'path';
import { LogManager } from './LogManager';

export class MiniWindow {
  private static instance: MiniWindow;
  private log = LogManager.getInstance();
  private miniWindow: BrowserWindow | null = null;
  private isVisible = false;

  private constructor() {}

  public static getInstance(): MiniWindow {
    if (!MiniWindow.instance) {
      MiniWindow.instance = new MiniWindow();
    }
    return MiniWindow.instance;
  }

  /**
   * 创建迷你悬浮窗
   */
  public create(): BrowserWindow {
    if (this.miniWindow && !this.miniWindow.isDestroyed()) {
      return this.miniWindow;
    }

    const isDev = !app.isPackaged;
    const display = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = display.workAreaSize;

    const windowWidth = 400;
    const windowHeight = 200;
    const margin = 20;

    this.miniWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: screenWidth - windowWidth - margin,
      y: screenHeight - windowHeight - margin,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: true,
      focusable: true,
      show: false,
      webPreferences: {
        preload: join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false
      }
    });

    this.miniWindow.on('blur', () => {
      if (this.isVisible) {
        this.hide();
      }
    });

    this.miniWindow.on('closed', () => {
      this.miniWindow = null;
      this.isVisible = false;
    });

    const url = isDev
      ? 'http://localhost:5173/#/mini'
      : join(__dirname, '../dist/index.html');

    if (isDev) {
      this.miniWindow.loadURL(url);
    } else {
      this.miniWindow.loadFile(url);
    }

    this.log.info('[MiniWindow] 迷你悬浮窗创建成功');
    return this.miniWindow;
  }

  /**
   * 显示悬浮窗
   */
  public show(): void {
    if (!this.miniWindow || this.miniWindow.isDestroyed()) {
      this.create();
    }

    if (this.miniWindow) {
      this.miniWindow.show();
      this.miniWindow.focus();
      this.isVisible = true;
      this.log.debug('[MiniWindow] 显示悬浮窗');
    }
  }

  /**
   * 隐藏悬浮窗
   */
  public hide(): void {
    if (this.miniWindow && !this.miniWindow.isDestroyed()) {
      this.miniWindow.hide();
      this.isVisible = false;
      this.log.debug('[MiniWindow] 隐藏悬浮窗');
    }
  }

  /**
   * 切换悬浮窗显示状态
   */
  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * 销毁悬浮窗
   */
  public destroy(): void {
    if (this.miniWindow && !this.miniWindow.isDestroyed()) {
      this.miniWindow.destroy();
    }
    this.miniWindow = null;
    this.isVisible = false;
    MiniWindow.instance = null as any;
    this.log.info('[MiniWindow] 迷你悬浮窗已销毁');
  }

  /**
   * 是否可见
   */
  public isWindowVisible(): boolean {
    return this.isVisible;
  }

  /**
   * 获取悬浮窗实例
   */
  public getWindow(): BrowserWindow | null {
    return this.miniWindow;
  }
}
