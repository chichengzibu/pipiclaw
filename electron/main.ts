/**
 * PiPiClaw - Electron主进程入口（修复版）
 * 
 * 核心改进：
 * 1. 简化网关启动逻辑，移除对不存在文件的依赖
 * 2. 使用内置的OpenClawServer直接启动HTTP服务
 * 3. 更好的错误处理和日志记录
 */

import { app, BrowserWindow, Menu, shell, ipcMain } from 'electron';
import { WindowManager } from './core/WindowManager';
import { IpcServer } from './core/IpcServer';
import { LogManager } from './core/LogManager';
import { GlobalShortcut } from './core/GlobalShortcut';
import { TrayManager } from './core/TrayManager';
import { MiniWindow } from './core/MiniWindow';
import { ConfigStore } from './core/ConfigStore';
import { OpenClawGateway } from './openclaw/OpenClawGateway';
import { PermissionConfig } from './permissions/PermissionConfig';
import { AutoUpdater } from './core/AutoUpdater';

// ============ W7.0.1 boot wiring: 串接 W3+ 子系统 ============
import { CapabilityRegistry } from './contracts/CapabilityRegistry';
import { HermesAdapter } from './hermes/HermesAdapter';
import { AgentBrainImpl, asAgentBrain } from './agent/AgentBrain';
import { ChatManager } from './chat/ChatManager';
import { IpcBridge } from './runtime/bridge/IpcBridge';
import { registerD1ScreenshotShortcut } from './core/GlobalShortcut';
import { ensureD1SkillRegistered } from './skill/builtin/D1ScreenshotQA';
import { registerD5RecordingToSkill } from './skill/builtin/D5RecordingToSkill';
// 静态 import 让 vite-plugin-electron SSR build 把 LlmAgentBrain inline 进 bundle,
// 避免运行时 require() 找不到 dist-electron/agent/LlmAgentBrain.js 的路径问题.
// 若 LlmClient 不可用,getInstance()/构造函数会抛错,因此包在 try 中。
import { LlmAgentBrain } from './agent/LlmAgentBrain';

const log = LogManager.getInstance();

let windowManager: WindowManager;
let ipcServer: IpcServer;
let gateway: OpenClawGateway;
let globalShortcut: GlobalShortcut;
let trayManager: TrayManager;
const isDev = !app.isPackaged;

// 注册打开 DevTools 的 IPC 处理器
ipcMain.on('open-devtools', () => {
  const windowManager = WindowManager.getInstance();
  const win = windowManager.getMainWindow();
  if (win) {
    log.info('用户请求打开 DevTools');
    win.webContents.openDevTools();
  }
});

app.whenReady().then(async () => {
  log.info('========== PiPiClaw 应用启动 ==========', { version: app.getVersion(), isDev });

  try {
    // 1. 设置应用菜单
    setupAppMenu();

    // 2. 初始化IPC服务器
    ipcServer = IpcServer.getInstance();
    ipcServer.registerHandlers();

    // P1-T1.3 hotfix: 早期注册 autoUpdater IPC handler
    // 之前是放在 initialize() 里,只在 ready-to-show 之后跑,
    // 导致 Settings.vue 在 /settings 路由 mount 时 autoUpdater:getVersion
    // 还没注册。Settings.vue 调用 -> No handler registered -> console error
    new AutoUpdater().registerIpcHandlers()

    // 3. 创建主窗口
    windowManager = WindowManager.getInstance();
    await windowManager.createMainWindow();

    // 4. 初始化全局快捷键
    globalShortcut = GlobalShortcut.getInstance();
    globalShortcut.registerAll();

    // 5. 初始化托盘
    trayManager = TrayManager.getInstance();
    trayManager.create();

    // 6. 权限初始化
    // - 默认尊重用户已选择的权限模板 (activeSetId 不为空时)
    // - 强制重置需要显式设 PIPICLAW_DEV=1 或 PIPICLAW_RESET_PERMISSIONS=1
    // - 首次启动 (activeSetId 为空) 才会自动激活 permissive 默认值
    // 见 PermissionConfig.forceResetToPermissive
    const permissionConfig = PermissionConfig.getInstance();
    permissionConfig.forceResetToPermissive();
    
    // 7. 加载配置
    const configStore = ConfigStore.getInstance();
    const alwaysOnTop = configStore.get('window.alwaysOnTop') || false;
    if (alwaysOnTop) {
      windowManager.setAlwaysOnTop(true);
    }
    
    const edgeHideEnabled = configStore.get('window.edgeHideEnabled') || false;
    if (edgeHideEnabled) {
      windowManager.setEdgeHideEnabled(true);
      windowManager.setupEdgeHide();
    }

    // 8. 初始化网关
    gateway = OpenClawGateway.getInstance();

    // 9. 启动网关服务
    log.info('正在自动启动OpenClaw网关服务...');
    const gatewayResult = await gateway.start();
    
    if (gatewayResult.success) {
      log.info('========== OpenClaw网关启动成功 ==========');
    } else {
      log.error('OpenClaw网关启动失败', { error: gatewayResult.error });
    }

    // 10. 开发模式下打开DevTools
    if (isDev) {
      windowManager.getMainWindow()?.webContents.openDevTools();
    }

    // 11. 自动更新检查 — 在窗口 ready-to-show 之后启动
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow) {
      mainWindow.once('ready-to-show', () => {
        try {
          new AutoUpdater().initialize(mainWindow);
          log.info('[main] AutoUpdater 初始化完成');
        } catch (e) {
          log.error('[main] AutoUpdater 初始化失败(非致命)', e);
        }
      });
    }

    // ============ W7.0.1 W3+ 子系统 wire ============
    try {
      // 1. IpcBridge: 注册 'runtime:ipc-bridge' channel
      IpcBridge.getInstance().registerHandler();

      // 2. HermesAdapter warmup(记忆检索桥接)
      HermesAdapter.getInstance();

      // 3. CapabilityRegistry: 标记初始化完成(W3.2 骨架)
      CapabilityRegistry.getInstance().markInitialized();

      // 4. AgentBrain → ChatManager 接入
      ChatManager.getInstance().registerAgent(asAgentBrain(AgentBrainImpl.getInstance()));

      // 4.bis W14: 优先用 LlmAgentBrain (基于 LlmClient)。当 LLM provider 未配置时,
      //         LlmAgentBrain.think() 会 fallback 到 stub reply,不影响既有 ChatManager 流。
      // 修复: 从 require('./agent/LlmAgentBrain') 改为静态 import,
      //       这样 vite-plugin-electron 在 SSR build 时会 inline LlmAgentBrain,
      //       避免运行时 dist-electron/agent/LlmAgentBrain.js 找不到的 require 失败。
      //       LlmAgentBrain 实现 contracts/types 的 AgentBrain interface,
      //       而非 AgentBrainImpl 类,通过 as unknown as cast 兼容 asAgentBrain 类型签名。
      try {
        ChatManager.getInstance().registerAgent(asAgentBrain(LlmAgentBrain.getInstance() as unknown as AgentBrainImpl))
        log.info('[main] LlmAgentBrain registered')
      } catch (e) {
        log.warn('[main] LlmAgentBrain 注册失败,继续使用 AgentBrainImpl', e)
      }

      // 5. D1 截屏问答 skill 注册 + 全局快捷键
      registerD1ScreenshotShortcut();
      ensureD1SkillRegistered();

      // 6. D5 录屏转技能 skill 注册
      registerD5RecordingToSkill();

      log.info('[main] W3+ 子系统 wire 完成');
    } catch (e) {
      log.error('[main] W7.0.1 W3+ wire 失败(非致命)', e);
    }

    log.info('========== PiPiClaw应用启动完成 ==========');
  } catch (error) {
    log.error('应用启动失败', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  log.info('所有窗口已关闭');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    windowManager = WindowManager.getInstance();
    windowManager.createMainWindow();
  }
});

app.on('before-quit', async () => {
  log.info('应用即将退出');
  
  trayManager?.setQuitting(true);

  if (gateway) {
    try {
      log.info('正在停止OpenClaw网关...');
      await gateway.stop();
      log.info('网关已停止');
    } catch (error) {
      log.error('停止网关时出错', error);
    }
  }

  globalShortcut?.destroy();
  trayManager?.destroy();
  MiniWindow.getInstance().destroy();
  
  if (ipcServer) {
    ipcServer.destroy();
  }

  if (windowManager) {
    windowManager.destroy();
  }
});

process.on('uncaughtException', (error) => {
  log.error('未捕获的异常', error);
  if (!isDev) {
    const { dialog } = require('electron');
    dialog.showErrorBox('应用错误', `发生未知错误: ${error.message}`);
  }
});

process.on('unhandledRejection', (reason) => {
  log.error('未处理的Promise拒绝', reason);
});

function setupAppMenu(): void {
  const emptyMenu = Menu.buildFromTemplate([]);
  Menu.setApplicationMenu(emptyMenu);
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  }
  log.debug('应用菜单已配置为隐藏');
}

app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});
