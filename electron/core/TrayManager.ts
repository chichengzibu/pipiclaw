/**
 * PiPiClaw - 系统托盘管理器
 * 
 * 职责：
 * 1. 创建和管理系统托盘图标
 * 2. 处理托盘菜单
 * 3. 窗口关闭时最小化到托盘
 */

import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import { join } from 'path';
import { LogManager } from './LogManager';

export class TrayManager {
  private static instance: TrayManager;
  private log = LogManager.getInstance();
  private tray: Tray | null = null;
  private isQuitting = false;

  private constructor() {}

  public static getInstance(): TrayManager {
    if (!TrayManager.instance) {
      TrayManager.instance = new TrayManager();
    }
    return TrayManager.instance;
  }

  /**
   * 创建系统托盘
   */
  public create(): void {
    if (this.tray) return;

    try {
      const iconPath = this.getIconPath();
      let icon: Electron.NativeImage;

      try {
        icon = nativeImage.createFromPath(iconPath);
        if (icon.isEmpty()) {
          icon = this.createDefaultIcon();
        }
      } catch {
        icon = this.createDefaultIcon();
      }

      this.tray = new Tray(icon);
      this.tray.setToolTip('PiPiClaw - 桌面AI助手');
      
      this.updateContextMenu();
      
      this.tray.on('click', () => {
        this.toggleMainWindow();
      });

      this.tray.on('double-click', () => {
        this.showMainWindow();
      });

      this.log.info('[TrayManager] 系统托盘创建成功');
    } catch (error) {
      this.log.error('[TrayManager] 创建系统托盘失败:', error);
    }
  }

  /**
   * 获取图标路径
   */
  private getIconPath(): string {
    const isDev = !app.isPackaged;
    if (isDev) {
      return join(__dirname, '../../resources/icon.png');
    }
    return join(process.resourcesPath, 'icon.png');
  }

  /**
   * 创建默认图标
   */
  private createDefaultIcon(): Electron.NativeImage {
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4);
    
    for (let i = 0; i < size * size; i++) {
      const x = i % size;
      const y = Math.floor(i / size);
      const idx = i * 4;
      
      const centerX = size / 2;
      const centerY = size / 2;
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      
      if (distance < size / 2 - 1) {
        canvas[idx] = 102;
        canvas[idx + 1] = 126;
        canvas[idx + 2] = 234;
        canvas[idx + 3] = 255;
      } else {
        canvas[idx] = 0;
        canvas[idx + 1] = 0;
        canvas[idx + 2] = 0;
        canvas[idx + 3] = 0;
      }
    }

    return nativeImage.createFromBuffer(canvas, { width: size, height: size });
  }

  /**
   * 更新托盘菜单
   */
  public updateContextMenu(): void {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => this.showMainWindow()
      },
      {
        label: '新建会话',
        click: () => {
          this.showMainWindow();
          const win = BrowserWindow.getFocusedWindow();
          if (win) {
            win.webContents.send('shortcut:newConversation');
          }
        }
      },
      { type: 'separator' },
      {
        label: '设置',
        click: () => {
          this.showMainWindow();
          const win = BrowserWindow.getFocusedWindow();
          if (win) {
            win.webContents.send('navigate', '/settings');
          }
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          this.isQuitting = true;
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  /**
   * 显示主窗口
   */
  public showMainWindow(): void {
    const { WindowManager } = require('./WindowManager');
    const windowManager = WindowManager.getInstance();
    const win = windowManager.getMainWindow();

    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
    }
  }

  /**
   * 隐藏主窗口到托盘
   */
  public hideMainWindow(): void {
    const { WindowManager } = require('./WindowManager');
    const windowManager = WindowManager.getInstance();
    const win = windowManager.getMainWindow();

    if (win && !win.isDestroyed()) {
      win.hide();
    }
  }

  /**
   * 切换主窗口
   */
  public toggleMainWindow(): void {
    const { WindowManager } = require('./WindowManager');
    const windowManager = WindowManager.getInstance();
    const win = windowManager.getMainWindow();

    if (!win || win.isDestroyed()) return;

    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  }

  /**
   * 处理窗口关闭事件
   */
  public handleWindowClose(): boolean {
    if (!this.isQuitting) {
      this.hideMainWindow();
      return false;
    }
    return true;
  }

  /**
   * 设置退出标志
   */
  public setQuitting(value: boolean): void {
    this.isQuitting = value;
  }

  /**
   * 是否正在退出
   */
  public isQuittingApp(): boolean {
    return this.isQuitting;
  }

  /**
   * 销毁托盘
   */
  public destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      this.log.info('[TrayManager] 系统托盘已销毁');
    }
    TrayManager.instance = null as any;
  }
}
