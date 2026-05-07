/**
 * PiPiClaw - 全局快捷键管理器
 * 
 * 职责：
 * 1. 管理全局快捷键注册/注销
 * 2. 支持快捷键自定义配置
 * 3. 与窗口管理器联动
 */

import { globalShortcut, BrowserWindow } from 'electron';
import { LogManager } from './LogManager';
import { ConfigStore } from './ConfigStore';

export interface ShortcutConfig {
  toggleWindow: string;
  newConversation: string;
  sendMessage: string;
}

export class GlobalShortcut {
  private static instance: GlobalShortcut;
  private log = LogManager.getInstance();
  private configStore: ConfigStore;
  private registeredShortcuts: string[] = [];

  private constructor() {
    this.configStore = ConfigStore.getInstance();
  }

  public static getInstance(): GlobalShortcut {
    if (!GlobalShortcut.instance) {
      GlobalShortcut.instance = new GlobalShortcut();
    }
    return GlobalShortcut.instance;
  }

  /**
   * 注册所有默认快捷键
   */
  public registerAll(): void {
    this.log.info('[GlobalShortcut] 注册全局快捷键...');

    const config = this.getShortcutConfig();

    this.registerToggleWindow(config.toggleWindow);
    this.registerNewConversation(config.newConversation);

    this.log.info('[GlobalShortcut] 全局快捷键注册完成');
  }

  /**
   * 注册切换窗口快捷键
   */
  private registerToggleWindow(accelerator: string): void {
    if (!accelerator) return;

    try {
      if (this.registeredShortcuts.includes(accelerator)) {
        globalShortcut.unregister(accelerator);
      }

      const success = globalShortcut.register(accelerator, () => {
        this.toggleMainWindow();
      });

      if (success) {
        this.registeredShortcuts.push(accelerator);
        this.log.info('[GlobalShortcut] 注册切换窗口快捷键:', accelerator);
      } else {
        this.log.warn('[GlobalShortcut] 注册切换窗口快捷键失败:', accelerator);
      }
    } catch (error) {
      this.log.error('[GlobalShortcut] 注册切换窗口快捷键异常:', error);
    }
  }

  /**
   * 注册新建会话快捷键
   */
  private registerNewConversation(accelerator: string): void {
    if (!accelerator) return;

    try {
      if (this.registeredShortcuts.includes(accelerator)) {
        globalShortcut.unregister(accelerator);
      }

      const success = globalShortcut.register(accelerator, () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) {
          win.webContents.send('shortcut:newConversation');
        }
      });

      if (success) {
        this.registeredShortcuts.push(accelerator);
        this.log.info('[GlobalShortcut] 注册新建会话快捷键:', accelerator);
      }
    } catch (error) {
      this.log.error('[GlobalShortcut] 注册新建会话快捷键异常:', error);
    }
  }

  /**
   * 切换主窗口显示/隐藏
   */
  public toggleMainWindow(): void {
    const { WindowManager } = require('./WindowManager');
    const windowManager = WindowManager.getInstance();
    const win = windowManager.getMainWindow();

    if (!win || win.isDestroyed()) return;

    if (win.isVisible()) {
      if (win.isMinimized()) {
        win.restore();
        win.focus();
      } else {
        win.hide();
        this.log.debug('[GlobalShortcut] 隐藏主窗口');
      }
    } else {
      win.show();
      win.focus();
      this.log.debug('[GlobalShortcut] 显示主窗口');
    }
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
   * 隐藏主窗口
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
   * 获取快捷键配置
   */
  public getShortcutConfig(): ShortcutConfig {
    return {
      toggleWindow: this.configStore.get('shortcuts.toggleWindow') || 'CommandOrControl+Alt+P',
      newConversation: this.configStore.get('shortcuts.newConversation') || 'CommandOrControl+Alt+N',
      sendMessage: this.configStore.get('shortcuts.sendMessage') || 'CommandOrControl+Enter'
    };
  }

  /**
   * 更新快捷键配置
   */
  public updateShortcut(key: keyof ShortcutConfig, accelerator: string): boolean {
    try {
      this.configStore.set(`shortcuts.${key}`, accelerator);
      
      const config = this.getShortcutConfig();
      
      if (key === 'toggleWindow') {
        this.unregisterAll();
        this.registerAll();
      } else if (key === 'newConversation') {
        const oldAccelerator = this.getShortcutConfig().newConversation;
        if (this.registeredShortcuts.includes(oldAccelerator)) {
          globalShortcut.unregister(oldAccelerator);
          this.registeredShortcuts = this.registeredShortcuts.filter(a => a !== oldAccelerator);
        }
        this.registerNewConversation(accelerator);
      }

      this.log.info('[GlobalShortcut] 更新快捷键:', key, accelerator);
      return true;
    } catch (error) {
      this.log.error('[GlobalShortcut] 更新快捷键失败:', error);
      return false;
    }
  }

  /**
   * 检查快捷键是否已注册
   */
  public isRegistered(accelerator: string): boolean {
    return globalShortcut.isRegistered(accelerator);
  }

  /**
   * 注销所有快捷键
   */
  public unregisterAll(): void {
    for (const accelerator of this.registeredShortcuts) {
      try {
        globalShortcut.unregister(accelerator);
      } catch (error) {
        this.log.error('[GlobalShortcut] 注销快捷键失败:', accelerator, error);
      }
    }
    this.registeredShortcuts = [];
    this.log.info('[GlobalShortcut] 已注销所有快捷键');
  }

  /**
   * 销毁实例
   */
  public destroy(): void {
    this.unregisterAll();
    GlobalShortcut.instance = null as any;
    this.log.info('[GlobalShortcut] 已销毁');
  }
}
