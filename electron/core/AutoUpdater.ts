/**
 * PiPiClaw - Auto-updater
 *
 * 职责:
 *   1. 包装 electron-updater 的 autoUpdater,接收事件 -> webContents.send
 *   2. 注册 IPC handler (autoUpdater:check / download / install)
 *   3. 可选 5 秒后自动 check 一次 (PIPICLAW_SKIP_UPDATE_CHECK=1 可关闭)
 */

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { LogManager } from './LogManager';

export class AutoUpdater {
  private log = LogManager.getInstance();
  private mainWindow: BrowserWindow | null = null;

  initialize(window: BrowserWindow): void {
    this.mainWindow = window;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      const version = (info as { version?: string }).version ?? 'unknown';
      this.log.info(`[AutoUpdater] update available: ${version}`);
      if (!window.isDestroyed()) {
        window.webContents.send('autoUpdater:onUpdateAvailable', {
          version,
          releaseDate: (info as { releaseDate?: string }).releaseDate,
          releaseNotes: (info as { releaseNotes?: unknown }).releaseNotes,
        });
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      const version = (info as { version?: string }).version ?? 'unknown';
      this.log.info(`[AutoUpdater] update downloaded: ${version}`);
      if (!window.isDestroyed()) {
        window.webContents.send('autoUpdater:onUpdateDownloaded', {
          version,
        });
      }
      dialog
        .showMessageBox(window, {
          type: 'info',
          message: `新版本 ${version} 已下载,重启后生效`,
          buttons: ['立即重启', '稍后'],
          defaultId: 0,
        })
        .then((result) => {
          if (result.response === 0) {
            autoUpdater.quitAndInstall();
          }
        })
        .catch((e) => this.log.error('[AutoUpdater] dialog error', e));
    });

    autoUpdater.on('error', (err: Error) => {
      this.log.error('[AutoUpdater] error', err);
      if (!window.isDestroyed()) {
        window.webContents.send('autoUpdater:onError', { message: String(err) });
      }
    });

    this.registerIpcHandlers();

    if (!process.env.PIPICLAW_SKIP_UPDATE_CHECK) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch((e: Error) => {
          this.log.warn('[AutoUpdater] auto check failed', e);
        });
      }, 5000);
    }
  }

  /**
   * P1-T1.3 hotfix: register handlers early in main.ts before window opens.
   * 之前是放在 initialize() 里,只在 ready-to-show 之后跑,
   * 导致 Settings.vue 在 /settings 路由 mount 时 autoUpdater:getVersion
   * 还没注册,console 报 "No handler registered for 'autoUpdater:getVersion'"。
   * 现在 handler 在 main.ts 早期无条件注册,即使 initialize() 失败也安全。
   */
  registerIpcHandlers(): void {
    ipcMain.handle('autoUpdater:check', async () => {
      try {
        const result = await autoUpdater.checkForUpdates();
        const updateInfo = (result && (result as any).updateInfo) || null;
        return {
          success: true,
          data: { version: updateInfo?.version ?? null },
        };
      } catch (e) {
        this.log.error('[AutoUpdater] checkForUpdates failed', e);
        return { success: false, error: String(e) };
      }
    });

    ipcMain.handle('autoUpdater:download', async () => {
      try {
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (e) {
        this.log.error('[AutoUpdater] downloadUpdate failed', e);
        return { success: false, error: String(e) };
      }
    });

    ipcMain.handle('autoUpdater:install', () => {
      try {
        autoUpdater.quitAndInstall();
        return { success: true };
      } catch (e) {
        this.log.error('[AutoUpdater] quitAndInstall failed', e);
        return { success: false, error: String(e) };
      }
    });

    ipcMain.handle('autoUpdater:getVersion', () => {
      return { success: true, data: app.getVersion() };
    });
  }
}
