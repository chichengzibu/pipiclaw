/**
 * PiPiClaw - 窗口管理器
 */

import { BrowserWindow, screen, app } from 'electron';
import { join } from 'path';
import { LogManager } from './LogManager';
import { ConfigStore } from './ConfigStore';

export class WindowManager {
  private static instance: WindowManager;
  private mainWindow: BrowserWindow | null = null;
  private log = LogManager.getInstance();
  private initialized = false;
  private configStore: ConfigStore;
  private edgeHideEnabled = false;
  private alwaysOnTop = false;
  private hideTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.configStore = ConfigStore.getInstance();
  }

  public static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager();
    }
    return WindowManager.instance;
  }

  public async createMainWindow(): Promise<BrowserWindow> {
    const isDev = !app.isPackaged;
    
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const defaultWidth = Math.min(1280, screenWidth * 0.8);
    const defaultHeight = Math.min(800, screenHeight * 0.8);

    this.log.info('创建主窗口', { isDev, defaultWidth, defaultHeight });

    this.mainWindow = new BrowserWindow({
      width: defaultWidth,
      height: defaultHeight,
      minWidth: 1280,
      minHeight: 720,
      show: false,
      frame: false,
      titleBarStyle: 'hidden',
      titleBarOverlay: false,
      backgroundColor: '#fefcf3',
      webPreferences: {
        preload: join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webSecurity: true
      },
      icon: join(__dirname, '../resources/icon.ico')
    });

    this.mainWindow.once('ready-to-show', () => {
      this.log.info('窗口准备就绪，显示窗口');
      this.initialized = true;
      this.mainWindow?.show();
    });

    this.mainWindow.on('maximize', () => {
      this.sendMaximizeChange(true);
    });

    this.mainWindow.on('unmaximize', () => {
      this.sendMaximizeChange(false);
    });

    this.mainWindow.on('focus', () => {
      this.log.debug('窗口获得焦点');
    });

    this.mainWindow.on('blur', () => {
      this.log.debug('窗口失去焦点');
    });

    this.mainWindow.on('closed', () => {
      this.log.info('主窗口已关闭');
      this.mainWindow = null;
      this.initialized = false;
    });

    if (isDev) {
      await this.mainWindow.loadURL('http://localhost:5173');
      this.log.info('加载开发服务器: http://localhost:5173');
    } else {
      await this.mainWindow.loadFile(join(__dirname, '../dist/index.html'));
      this.log.info('加载生产构建页面');
    }

    return this.mainWindow;
  }

  private sendMaximizeChange(isMaximized: boolean): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('window:onMaximizeChange', isMaximized);
    }
  }

  public minimize(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.minimize();
    }
  }

  public toggleMaximize(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow.maximize();
      }
    }
  }

  public close(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.close();
    }
  }

  public isMaximized(): boolean {
    return this.mainWindow?.isMaximized() ?? false;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  public setAlwaysOnTop(value: boolean): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.setAlwaysOnTop(value);
      this.alwaysOnTop = value;
      this.configStore.set('window.alwaysOnTop', value);
      this.log.info('[WindowManager] 设置窗口置顶:', value);
    }
  }

  public isAlwaysOnTop(): boolean {
    return this.alwaysOnTop;
  }

  public toggleAlwaysOnTop(): void {
    this.setAlwaysOnTop(!this.alwaysOnTop);
  }

  public setEdgeHideEnabled(value: boolean): void {
    this.edgeHideEnabled = value;
    this.configStore.set('window.edgeHideEnabled', value);
    this.log.info('[WindowManager] 设置贴边隐藏:', value);
  }

  public isEdgeHideEnabled(): boolean {
    return this.edgeHideEnabled;
  }

  public setupEdgeHide(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    const EDGE_THRESHOLD = 10;

    this.mainWindow.on('move', () => {
      if (!this.edgeHideEnabled) return;
      
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
      }

      this.hideTimer = setTimeout(() => {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

        const bounds = this.mainWindow.getBounds();
        const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
        const workArea = display.workArea;

        let shouldHide = false;
        let targetX = bounds.x;
        let targetY = bounds.y;

        if (bounds.x <= workArea.x + EDGE_THRESHOLD) {
          shouldHide = true;
          targetX = workArea.x - bounds.width + 5;
        } else if (bounds.x + bounds.width >= workArea.x + workArea.width - EDGE_THRESHOLD) {
          shouldHide = true;
          targetX = workArea.x + workArea.width - 5;
        }

        if (bounds.y <= workArea.y + EDGE_THRESHOLD) {
          shouldHide = true;
          targetY = workArea.y - bounds.height + 5;
        } else if (bounds.y + bounds.height >= workArea.y + workArea.height - EDGE_THRESHOLD) {
          shouldHide = true;
          targetY = workArea.y + workArea.height - 5;
        }

        if (shouldHide) {
          this.mainWindow.setPosition(targetX, targetY);
          this.mainWindow.hide();
          this.log.debug('[WindowManager] 窗口贴边隐藏');
        }
      }, 100);
    });
  }

  public destroy(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.destroy();
    }
    this.mainWindow = null;
    this.initialized = false;
    WindowManager.instance = null as any;
  }
}
