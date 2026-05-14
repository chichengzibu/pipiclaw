/**
 * PiPiClaw - IPC服务器
 */

import { ipcMain, app, dialog } from 'electron';
import { LogManager } from './LogManager';
import { WindowManager } from './WindowManager';
import { ConfigStore } from './ConfigStore';
import { GatewayConfig } from '../gateway/GatewayConfig';
import { ModelManager } from '../models/ModelManager';
import { PermissionManager } from '../permissions/PermissionManager';
import { ChatManager } from '../chat/ChatManager';
import { TaskExecutor } from '../task/TaskExecutor';
import { TaskLog } from '../task/TaskLog';
import { ExecutionMode, EXECUTION_MODE_CONFIGS, RISK_LEVEL_MAP, HIGH_RISK_OPERATIONS } from '../task/TaskExecutionMode';
import { FileParser } from '../utils/FileParser';
import { ConversationExporter } from '../utils/ConversationExporter';
import { OpenClawGateway } from '../openclaw/OpenClawGateway';
import { OpenClawExecutor } from '../openclaw/OpenClawExecutor';
import { HermesMemory } from '../hermes/HermesMemory';
import { SkillLoader } from '../skill/SkillLoader';
import { SelfLearner } from '../learning/SelfLearner';
import type { Task, TaskStep, StepType, TaskStatus, StepStatus } from '../task/TaskTypes';
import type {
  OpenClawOperationRequest,
  OpenClawBatchRequest,
  OpenClawPermissionCheckRequest
} from '../types/openclaw';

export class IpcServer {
  private static instance: IpcServer;
  private log = LogManager.getInstance();
  private handlers: Map<string, Function> = new Map();

  private constructor() {}

  public static getInstance(): IpcServer {
    if (!IpcServer.instance) {
      IpcServer.instance = new IpcServer();
    }
    return IpcServer.instance;
  }

  public registerHandlers(): void {
    this.log.info('注册IPC处理器');

    // 先移除所有已有的处理器，避免重复注册导致的问题
    for (const channel of Object.keys(ipcMain.eventNames())) {
      try {
        ipcMain.removeHandler(channel);
      } catch (e) {
        // 忽略错误，继续注册
      }
    }

    // ========== 文件选择器 ==========
    
    ipcMain.handle('dialog:openFile', async (_, options: any) => {
      try {
        const result = await dialog.showOpenDialog(options);
        return result;
      } catch (error) {
        this.log.error('dialog:openFile 失败', error);
        return { canceled: true, filePaths: [] };
      }
    });

    // ========== 窗口管理 ==========
    
    ipcMain.handle('window:minimize', async () => {
      try {
        const windowManager = WindowManager.getInstance();
        windowManager.minimize();
        return { success: true };
      } catch (error) {
        this.log.error('window:minimize 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('window:maximize', async () => {
      try {
        const windowManager = WindowManager.getInstance();
        windowManager.toggleMaximize();
        return { success: true };
      } catch (error) {
        this.log.error('window:maximize 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('window:close', async () => {
      try {
        const windowManager = WindowManager.getInstance();
        windowManager.close();
        return { success: true };
      } catch (error) {
        this.log.error('window:close 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('window:isMaximized', async () => {
      try {
        const windowManager = WindowManager.getInstance();
        const isMaximized = windowManager.isMaximized();
        return { success: true, data: isMaximized };
      } catch (error) {
        this.log.error('window:isMaximized 失败', error);
        return { success: true, data: false };
      }
    });

    ipcMain.handle('window:setAlwaysOnTop', (_, value: boolean) => {
      try {
        const windowManager = WindowManager.getInstance();
        windowManager.setAlwaysOnTop(value);
        return { success: true };
      } catch (error) {
        this.log.error('window:setAlwaysOnTop 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('window:isAlwaysOnTop', () => {
      try {
        const windowManager = WindowManager.getInstance();
        return { success: true, data: windowManager.isAlwaysOnTop() };
      } catch (error) {
        this.log.error('window:isAlwaysOnTop 失败', error);
        return { success: true, data: false };
      }
    });

    ipcMain.handle('window:setEdgeHide', (_, value: boolean) => {
      try {
        const windowManager = WindowManager.getInstance();
        windowManager.setEdgeHideEnabled(value);
        if (value) {
          windowManager.setupEdgeHide();
        }
        return { success: true };
      } catch (error) {
        this.log.error('window:setEdgeHide 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('window:isEdgeHide', () => {
      try {
        const windowManager = WindowManager.getInstance();
        return { success: true, data: windowManager.isEdgeHideEnabled() };
      } catch (error) {
        this.log.error('window:isEdgeHide 失败', error);
        return { success: true, data: false };
      }
    });

    ipcMain.handle('window:showMini', () => {
      try {
        const { MiniWindow } = require('../core/MiniWindow');
        MiniWindow.getInstance().show();
        return { success: true };
      } catch (error) {
        this.log.error('window:showMini 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('window:hideToTray', () => {
      try {
        const { TrayManager } = require('../core/TrayManager');
        TrayManager.getInstance().hideMainWindow();
        return { success: true };
      } catch (error) {
        this.log.error('window:hideToTray 失败', error);
        return { success: false, error: String(error) };
      }
    });



    // ========== 网关管理 ==========
    
    ipcMain.handle('gateway:start', async (_, options?: any) => {
      try {
        const gateway = OpenClawGateway.getInstance();
        const result = await gateway.start(options || {});
        return { success: result.success, error: result.error, data: gateway.getStatus() };
      } catch (error) {
        this.log.error('gateway:start 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('gateway:stop', async () => {
      try {
        const gateway = OpenClawGateway.getInstance();
        const result = await gateway.stop();
        return { success: result.success };
      } catch (error) {
        this.log.error('gateway:stop 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('gateway:restart', async () => {
      try {
        const gateway = OpenClawGateway.getInstance();
        const result = await gateway.restart();
        return { success: result.success, error: result.error, data: gateway.getStatus() };
      } catch (error) {
        this.log.error('gateway:restart 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('gateway:status', async () => {
      try {
        const gateway = OpenClawGateway.getInstance();
        return { success: true, data: gateway.getStatus() };
      } catch (error) {
        this.log.error('gateway:status 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('gateway:repair', async () => {
      try {
        const gateway = OpenClawGateway.getInstance();
        const result = await gateway.repair();
        return { success: result.success, error: result.error };
      } catch (error) {
        this.log.error('gateway:repair 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('gateway:logs', async () => {
      try {
        const gateway = OpenClawGateway.getInstance();
        return { success: true, data: gateway.getAuditLogs() };
      } catch (error) {
        this.log.error('gateway:logs 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('gateway:config:get', async () => {
      try {
        const gatewayConfig = GatewayConfig.getInstance();
        return { success: true, data: gatewayConfig.getConfig() };
      } catch (error) {
        this.log.error('gateway:config:get 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('gateway:config:set', async (_, config: any) => {
      try {
        const gatewayConfig = GatewayConfig.getInstance();
        gatewayConfig.setAll(config);
        return { success: true };
      } catch (error) {
        this.log.error('gateway:config:set 失败', error);
        return { success: false, error: String(error) };
      }
    });

    // ========== Hermes 记忆管理 ==========
    ipcMain.handle('hermes:getMemories', async () => {
      try {
        const hermesMemory = HermesMemory.getInstance();
        return {
          success: true,
          data: {
            coreMemory: hermesMemory.getCoreMemory(),
            experienceMemory: hermesMemory.getExperienceMemory(),
            memories: hermesMemory.getAllMemories()
          }
        };
      } catch (error) {
        this.log.error('hermes:getMemories 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('hermes:saveCoreMemory', async (_, content: string) => {
      try {
        const hermesMemory = HermesMemory.getInstance();
        hermesMemory.updateCoreMemory(content);
        return { success: true };
      } catch (error) {
        this.log.error('hermes:saveCoreMemory 失败', error);
        return { success: false, error: String(error) };
      }
    });

    // ========== 技能管理 ==========
    ipcMain.handle('skills:list', async () => {
      try {
        const skillLoader = SkillLoader.getInstance();
        const skills = skillLoader.getAllSkills();
        return { success: true, data: skills };
      } catch (error) {
        this.log.error('skills:list 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('skills:toggle', async (_, skillId: string, enabled: boolean) => {
      try {
        const skillLoader = SkillLoader.getInstance();
        const success = skillLoader.toggleSkill(skillId, enabled);
        return { success };
      } catch (error) {
        this.log.error('skills:toggle 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('skills:reload', async () => {
      try {
        const skillLoader = SkillLoader.getInstance();
        skillLoader.reloadSkills();
        const skills = skillLoader.getAllSkills();
        return { success: true, data: skills };
      } catch (error) {
        this.log.error('skills:reload 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('skills:importFile', async (_, filePath: string) => {
      try {
        const skillLoader = SkillLoader.getInstance();
        const result = await skillLoader.importSkillFromFile(filePath);
        // 导入成功后返回最新的技能列表
        const skills = skillLoader.getAllSkills();
        return { success: result.success, error: result.error, skillId: result.skillId, data: skills };
      } catch (error) {
        this.log.error('skills:importFile 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('skills:importUrl', async (_, url: string) => {
      try {
        const skillLoader = SkillLoader.getInstance();
        const result = await skillLoader.importSkillFromUrl(url);
        // 导入成功后返回最新的技能列表
        const skills = skillLoader.getAllSkills();
        return { success: result.success, error: result.error, skillId: result.skillId, data: skills };
      } catch (error) {
        this.log.error('skills:importUrl 失败', error);
        return { success: false, error: String(error) };
      }
    });

    // ========== 应用信息 ==========
    
    ipcMain.handle('app:version', async () => {
      try {
        return { success: true, data: app.getVersion() };
      } catch (error) {
        this.log.error('app:version 失败', error);
        return { success: true, data: '1.0.0' };
      }
    });

    // ========== 配置管理 ==========
    
    ipcMain.handle('config:get', (_, key: string) => {
      try {
        const configStore = ConfigStore.getInstance();
        return { success: true, data: configStore.get(key) };
      } catch (error) {
        this.log.error('config:get 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('config:set', (_, key: string, value: any) => {
      try {
        const configStore = ConfigStore.getInstance();
        configStore.set(key, value);
        return { success: true };
      } catch (error) {
        this.log.error('config:set 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('config:getAll', () => {
      try {
        const configStore = ConfigStore.getInstance();
        return { success: true, data: configStore.getAll() };
      } catch (error) {
        this.log.error('config:getAll 失败', error);
        return { success: false, error: String(error) };
      }
    });

    // ========== 模型管理 ==========

    ipcMain.handle('models:list', () => {
      try {
        const modelManager = ModelManager.getInstance();
        const providers = modelManager.getAllProviders();
        return { success: true, data: providers };
      } catch (error) {
        this.log.error('models:list 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('models:get', (_, id: string) => {
      try {
        const modelManager = ModelManager.getInstance();
        const provider = modelManager.getProvider(id);
        return { success: true, data: provider };
      } catch (error) {
        this.log.error('models:get 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('models:add', (_, data: any) => {
      try {
        const modelManager = ModelManager.getInstance();
        const provider = modelManager.addProvider(data);
        return { success: true, data: provider };
      } catch (error) {
        this.log.error('models:add 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('models:update', (_, id: string, updates: any) => {
      try {
        const modelManager = ModelManager.getInstance();
        const provider = modelManager.updateProvider(id, updates);
        return { success: true, data: provider };
      } catch (error) {
        this.log.error('models:update 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('models:delete', (_, id: string) => {
      try {
        const modelManager = ModelManager.getInstance();
        const deleted = modelManager.deleteProvider(id);
        return { success: true, data: deleted };
      } catch (error) {
        this.log.error('models:delete 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('models:toggle', (_, id: string, enabled: boolean) => {
      try {
        const modelManager = ModelManager.getInstance();
        const result = modelManager.setProviderEnabled(id, enabled);
        return { success: true, data: result };
      } catch (error) {
        this.log.error('models:toggle 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('models:test', async (_, providerId: string, modelId?: string) => {
      try {
        const modelManager = ModelManager.getInstance();
        const result = await modelManager.testProvider(providerId, modelId);
        return { success: true, data: result };
      } catch (error) {
        this.log.error('models:test 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('models:syncOllama', async (_, providerId: string) => {
      try {
        const modelManager = ModelManager.getInstance();
        const models = await modelManager.syncOllamaModels(providerId);
        return { success: true, data: models };
      } catch (error) {
        this.log.error('models:syncOllama 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('models:fetch', async (_, providerId: string) => {
      try {
        const modelManager = ModelManager.getInstance();
        const result = await modelManager.fetchModels(providerId);
        return result;
      } catch (error) {
        this.log.error('models:fetch 失败', error);
        return { success: false, models: [], error: String(error) };
      }
    });

    ipcMain.handle('models:getTemplates', () => {
      try {
        this.log.info('models:getTemplates 被调用');
        const modelManager = ModelManager.getInstance();
        const templates = modelManager.getTemplates();
        this.log.info('models:getTemplates 返回', { count: templates.length });
        return { success: true, data: templates };
      } catch (error) {
        this.log.error('models:getTemplates 失败', error);
        return { success: false, error: String(error) };
      }
    });

    // ========== 权限管理 ==========

    ipcMain.handle('permissions:list', () => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const sets = permissionManager.getAllPermissionSets();
        return { success: true, data: sets };
      } catch (error) {
        this.log.error('permissions:list 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('permissions:get', (_, id: string) => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const set = permissionManager.getPermissionSet(id);
        return { success: true, data: set };
      } catch (error) {
        this.log.error('permissions:get 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('permissions:active', () => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const active = permissionManager.getActivePermissionSet();
        return { success: true, data: active };
      } catch (error) {
        this.log.error('permissions:active 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('permissions:setActive', (_, id: string) => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const result = permissionManager.setActivePermissionSet(id);
        return { success: true, data: result };
      } catch (error) {
        this.log.error('permissions:setActive 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('permissions:create', (_, data: any) => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const set = permissionManager.createPermissionSet(data);
        return { success: true, data: set };
      } catch (error) {
        this.log.error('permissions:create 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('permissions:update', (_, id: string, updates: any) => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const set = permissionManager.updatePermissionSet(id, updates);
        return { success: true, data: set };
      } catch (error) {
        this.log.error('permissions:update 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('permissions:updateRule', (_, setId: string, ruleId: string, updates: any) => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const rule = permissionManager.updatePermissionRule(setId, ruleId, updates);
        return { success: true, data: rule };
      } catch (error) {
        this.log.error('permissions:updateRule 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('permissions:delete', (_, id: string) => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const result = permissionManager.deletePermissionSet(id);
        return { success: true, data: result };
      } catch (error) {
        this.log.error('permissions:delete 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('permissions:duplicate', (_, id: string, newName: string) => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const set = permissionManager.duplicatePermissionSet(id, newName);
        return { success: true, data: set };
      } catch (error) {
        this.log.error('permissions:duplicate 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('permissions:check', (_, request: any) => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const result = permissionManager.checkPermission(request);
        return { success: true, data: result };
      } catch (error) {
        this.log.error('permissions:check 失败', error);
        return { success: false, error: String(error) };
      }
    });

    // ========== 聊天管理 ==========

    ipcMain.handle('chat:conversations', () => {
      try {
        const chatManager = ChatManager.getInstance();
        const conversations = chatManager.getAllConversations();
        return { success: true, data: conversations };
      } catch (error) {
        this.log.error('chat:conversations 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('chat:conversation:get', (_, id: string) => {
      try {
        const chatManager = ChatManager.getInstance();
        const conversation = chatManager.getConversation(id);
        return { success: true, data: conversation };
      } catch (error) {
        this.log.error('chat:conversation:get 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('chat:conversation:create', (_, data?: any) => {
      try {
        const chatManager = ChatManager.getInstance();
        const conversation = chatManager.createConversation(data);
        return { success: true, data: conversation };
      } catch (error) {
        this.log.error('chat:conversation:create 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('chat:conversation:update', (_, id: string, updates: any) => {
      try {
        const chatManager = ChatManager.getInstance();
        const conversation = chatManager.updateConversation(id, updates);
        return { success: true, data: conversation };
      } catch (error) {
        this.log.error('chat:conversation:update 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('chat:conversation:delete', (_, id: string) => {
      try {
        const chatManager = ChatManager.getInstance();
        const result = chatManager.deleteConversation(id);
        return { success: true, data: result };
      } catch (error) {
        this.log.error('chat:conversation:delete 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('chat:conversation:archive', (_, id: string) => {
      try {
        const chatManager = ChatManager.getInstance();
        const conversation = chatManager.archiveConversation(id);
        return { success: true, data: conversation };
      } catch (error) {
        this.log.error('chat:conversation:archive 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('chat:conversation:pin', (_, id: string, pinned: boolean) => {
      try {
        const chatManager = ChatManager.getInstance();
        const conversation = chatManager.pinConversation(id, pinned);
        return { success: true, data: conversation };
      } catch (error) {
        this.log.error('chat:conversation:pin 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('chat:message:send', async (_, conversationId: string, content: string, providerId?: string, modelId?: string) => {
      try {
        const chatManager = ChatManager.getInstance();
        const message = await chatManager.sendMessage(conversationId, content, providerId, modelId);
        return { success: true, data: message };
      } catch (error) {
        this.log.error('chat:message:send 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('chat:message:stop', (_, conversationId: string) => {
      try {
        const chatManager = ChatManager.getInstance();
        chatManager.stopGeneration(conversationId);
        return { success: true };
      } catch (error) {
        this.log.error('chat:message:stop 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('chat:message:continue', async (_, conversationId: string) => {
      try {
        const chatManager = ChatManager.getInstance();
        await chatManager.continueGeneration(conversationId);
        return { success: true };
      } catch (error) {
        this.log.error('chat:message:continue 失败', error);
        return { success: false, error: String(error) };
      }
    });

    // 获取最后使用的模型（用于新建会话时继承）
    ipcMain.handle('chat:lastModel:get', () => {
      try {
        const chatManager = ChatManager.getInstance();
        const config = (chatManager as any).config;
        return {
          success: true,
          data: {
            providerId: config.getLastProvider?.() || null,
            modelId: config.getLastModel?.() || null
          }
        };
      } catch (error) {
        this.log.error('chat:lastModel:get 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('chat:settings:get', () => {
      try {
        const chatManager = ChatManager.getInstance();
        const settings = chatManager.getSettings();
        return { success: true, data: settings };
      } catch (error) {
        this.log.error('chat:settings:get 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('chat:settings:update', (_, settings: any) => {
      try {
        const chatManager = ChatManager.getInstance();
        const result = chatManager.updateSettings(settings);
        return { success: true, data: result };
      } catch (error) {
        this.log.error('chat:settings:update 失败', error);
        return { success: false, error: String(error) };
      }
    });

    // ========== 任务执行 ==========

    ipcMain.handle('task:execute', async (_, task: any) => {
      try {
        this.log.info('[IpcServer] 收到任务执行请求');
        
        // 安全反序列化，确保没有问题
        const safeTask = JSON.parse(JSON.stringify(task));
        this.log.info('[IpcServer] 安全序列化完成');
        
        const taskExecutor = TaskExecutor.getInstance();
        const result = await taskExecutor.executeTask(safeTask);
        
        // 安全序列化返回结果
        const safeResult = JSON.parse(JSON.stringify(result));
        
        return { success: true, data: safeResult };
      } catch (error) {
        this.log.error('task:execute 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('task:executeTool', async (_, request: any) => {
      try {
        const taskExecutor = TaskExecutor.getInstance();
        const result = await taskExecutor.executeToolCall(request);
        return { success: true, data: result };
      } catch (error) {
        this.log.error('task:executeTool 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('task:toolsGet', () => {
      try {
        const taskExecutor = TaskExecutor.getInstance();
        const tools = taskExecutor.getAvailableTools();
        return { success: true, data: tools };
      } catch (error) {
        this.log.error('task:toolsGet 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('task:gatewayCheck', () => {
      try {
        const taskExecutor = TaskExecutor.getInstance();
        const isRunning = taskExecutor.isGatewayRunning();
        return { success: true, data: isRunning };
      } catch (error) {
        this.log.error('task:gatewayCheck 失败', error);
        return { success: false, error: String(error) };
      }
    });

    // ========== Phase 2: 任务预览与确认 ==========

    ipcMain.handle('task:trace', (_, data: any) => {
      try {
        this.log.info('[IpcServer] 任务追踪事件', data);
        return { success: true };
      } catch (error) {
        this.log.error('task:trace 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('task:confirm-preview', async (_, taskId: string, confirmed: boolean, editedContent?: string) => {
      try {
        this.log.info('[IpcServer] 收到用户确认', { taskId, confirmed, hasEditedContent: !!editedContent });
        const chatManager = ChatManager.getInstance();
        const result = await (chatManager as any).handleUserConfirmation(taskId, confirmed, editedContent);
        return { success: true, data: result };
      } catch (error) {
        this.log.error('task:confirm-preview 失败', error);
        return { success: false, error: String(error) };
      }
    });

    // ========== 执行模式 ==========

    ipcMain.handle('execution:mode:get', () => {
      try {
        const configStore = ConfigStore.getInstance();
        const mode = configStore.get('execution.mode') || 'craft';
        return { success: true, data: mode };
      } catch (error) {
        this.log.error('execution:mode:get 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('execution:mode:set', (_, mode: string) => {
      try {
        const configStore = ConfigStore.getInstance();
        configStore.set('execution.mode', mode);
        this.log.info('设置执行模式:', mode);
        return { success: true };
      } catch (error) {
        this.log.error('execution:mode:set 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('execution:mode:check', (_, operation: string, params: any) => {
      try {
        const configStore = ConfigStore.getInstance();
        const mode = configStore.get('execution.mode') || 'craft';
        const permissionManager = PermissionManager.getInstance();

        if (mode === 'safe') {
          return {
            success: true,
            data: {
              allowed: false,
              checkLevel: 'blocked',
              reason: '当前为安全模式，禁止执行操作',
              guidance: '请切换到「计划模式」或「全量模式」后再试'
            }
          };
        }

        const riskLevel = RISK_LEVEL_MAP[operation] || 'medium';
        const isHighRisk = HIGH_RISK_OPERATIONS.includes(operation);

        if (isHighRisk && mode === 'craft') {
          return {
            success: true,
            data: {
              allowed: true,
              checkLevel: 'requires_confirmation',
              reason: '高危操作需要二次确认',
              guidance: '请在弹窗中确认是否继续执行'
            }
          };
        }

        const permMap: Record<string, { category: string; action: string }> = {
          read_file: { category: 'filesystem', action: 'read' },
          write_file: { category: 'filesystem', action: 'write' },
          create_file: { category: 'filesystem', action: 'write' },
          delete_file: { category: 'filesystem', action: 'delete' },
          list_directory: { category: 'filesystem', action: 'list' },
          create_directory: { category: 'filesystem', action: 'create' },
          file_exists: { category: 'filesystem', action: 'read' },
          run_command: { category: 'shell', action: 'execute' },
          open_url: { category: 'system', action: 'read' },
          clipboard_read: { category: 'clipboard', action: 'read' },
          clipboard_write: { category: 'clipboard', action: 'write' }
        };

        const config = permMap[operation];
        if (!config) {
          return {
            success: true,
            data: {
              allowed: true,
              checkLevel: 'passed'
            }
          };
        }

        const result = permissionManager.checkPermission({
          category: config.category as any,
          action: config.action
        });

        return {
          success: true,
          data: {
            allowed: result.allowed,
            checkLevel: result.allowed ? 'passed' : 'blocked',
            reason: result.allowed ? undefined : result.reason,
            guidance: result.allowed ? undefined : `请在权限设置中启用「${config.category}」的「${config.action}」权限`
          }
        };
      } catch (error) {
        this.log.error('execution:mode:check 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('execution:mode:cancel', () => {
      return { success: true };
    });

    // ========== 任务日志 ==========

    ipcMain.handle('task:log:get', (_, taskId: string) => {
      try {
        const taskLog = TaskLog.getInstance();
        const entry = taskLog.getLog(taskId);
        return { success: true, data: entry };
      } catch (error) {
        this.log.error('task:log:get 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('task:log:query', (_, query: any) => {
      try {
        const taskLog = TaskLog.getInstance();
        const entries = taskLog.queryLogs(query);
        return { success: true, data: entries };
      } catch (error) {
        this.log.error('task:log:query 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('task:log:delete', (_, taskId: string) => {
      try {
        const taskLog = TaskLog.getInstance();
        const deleted = taskLog.deleteLog(taskId);
        return { success: true, data: deleted };
      } catch (error) {
        this.log.error('task:log:delete 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('task:log:deleteBatch', (_, taskIds: string[]) => {
      try {
        const taskLog = TaskLog.getInstance();
        const count = taskLog.deleteLogs(taskIds);
        return { success: true, data: count };
      } catch (error) {
        this.log.error('task:log:deleteBatch 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('task:log:export', (_, taskId: string, format: 'json' | 'txt') => {
      try {
        const taskLog = TaskLog.getInstance();
        const content = taskLog.exportLog(taskId, { format, includeSteps: true });
        return { success: true, data: content };
      } catch (error) {
        this.log.error('task:log:export 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('task:log:stats', () => {
      try {
        const taskLog = TaskLog.getInstance();
        const stats = taskLog.getStatistics();
        return { success: true, data: stats };
      } catch (error) {
        this.log.error('task:log:stats 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('task:log:retry', async (_, taskId: string) => {
      try {
        const taskLog = TaskLog.getInstance();
        const entry = taskLog.getLog(taskId);
        if (!entry) {
          return { success: false, error: '任务不存在' };
        }

        const taskExecutor = TaskExecutor.getInstance();
        const task = {
          id: `retry_${taskId}_${Date.now()}`,
          conversationId: entry.conversationId,
          messageId: '',
          instruction: entry.instruction,
          steps: entry.steps.map((s): TaskStep => ({
            id: `step_${s.order}`,
            order: s.order,
            type: (s.operation || 'filesystem') as StepType,
            description: s.description,
            params: s.params,
            status: 'pending' as StepStatus
          })),
          status: 'pending' as TaskStatus,
          createdAt: Date.now()
        };

        const result = await taskExecutor.executeTask(task);
        return { success: true, data: result };
      } catch (error) {
        this.log.error('task:log:retry 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('task:log:cancel', (_, taskId: string) => {
      try {
        const taskLog = TaskLog.getInstance();
        taskLog.cancelTask(taskId, '用户取消');
        return { success: true };
      } catch (error) {
        this.log.error('task:log:cancel 失败', error);
        return { success: false, error: String(error) };
      }
    });

    // ========== 文件操作 ==========

    ipcMain.handle('file:parse', async (_, filePath: string) => {
      try {
        const fileParser = FileParser.getInstance();
        const result = await fileParser.parseFile(filePath);
        return { success: result.success, data: result.file, error: result.error, guidance: result.guidance };
      } catch (error) {
        this.log.error('file:parse 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('file:parseBatch', async (_, filePaths: string[]) => {
      try {
        const fileParser = FileParser.getInstance();
        const results = await fileParser.parseFiles(filePaths);
        return { success: true, data: results };
      } catch (error) {
        this.log.error('file:parseBatch 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('file:readClipboardImage', () => {
      try {
        const fileParser = FileParser.getInstance();
        const result = fileParser.readImageFromClipboard();
        return { success: result.success, data: { base64: result.base64 }, error: result.error };
      } catch (error) {
        this.log.error('file:readClipboardImage 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('file:getInfo', (_, filePath: string) => {
      try {
        const fileParser = FileParser.getInstance();
        const result = fileParser.getFileInfo(filePath);
        return { success: result.success, data: result.info, error: result.error };
      } catch (error) {
        this.log.error('file:getInfo 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('file:getAllowedExtensions', () => {
      try {
        const fileParser = FileParser.getInstance();
        const extensions = fileParser.getAllowedExtensions();
        return { success: true, data: extensions };
      } catch (error) {
        this.log.error('file:getAllowedExtensions 失败', error);
        return { success: false, error: String(error) };
      }
    });

    // ========== 对话导出 ==========

    ipcMain.handle('conversation:export', async (_, conversation: any, format: 'markdown' | 'pdf' | 'word', outputPath?: string) => {
      try {
        const exporter = ConversationExporter.getInstance();
        const result = await exporter.exportConversation(conversation, {
          format,
          outputPath: outputPath || ''
        });
        return { success: result.success, data: { filePath: result.filePath }, error: result.error, guidance: result.guidance };
      } catch (error) {
        this.log.error('conversation:export 失败', error);
        return { success: false, error: String(error) };
      }
    });

    // ========== OpenClaw 核心执行引擎 ==========

    ipcMain.handle('openclaw:execute', async (_, request: OpenClawOperationRequest) => {
      try {
        this.log.info('[IpcServer] openclaw:execute 被调用', request);
        const gateway = OpenClawGateway.getInstance();
        const result = await gateway.executeOperation(request);
        return { success: result.success, data: result };
      } catch (error) {
        this.log.error('openclaw:execute 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('openclaw:batch-execute', async (_, request: OpenClawBatchRequest) => {
      try {
        this.log.info('[IpcServer] openclaw:batch-execute 被调用');
        const executor = OpenClawExecutor.getInstance();
        const result = await executor.executeBatch(request);
        return { success: result.success, data: result };
      } catch (error) {
        this.log.error('openclaw:batch-execute 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('openclaw:check-permission', async (_, request: OpenClawPermissionCheckRequest) => {
      try {
        this.log.info('[IpcServer] openclaw:check-permission 被调用', request);
        const gateway = OpenClawGateway.getInstance();
        const result = gateway.checkPermission(request);
        return { success: true, data: result };
      } catch (error) {
        this.log.error('openclaw:check-permission 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('openclaw:get-audit-logs', async (_, limit?: number) => {
      try {
        const gateway = OpenClawGateway.getInstance();
        const logs = gateway.getAuditLogs(limit);
        return { success: true, data: logs };
      } catch (error) {
        this.log.error('openclaw:get-audit-logs 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('openclaw:health-check', async () => {
      try {
        this.log.info('[IpcServer] openclaw:health-check 被调用');
        const taskExecutor = TaskExecutor.getInstance();
        const isRunning = taskExecutor.isGatewayRunning();
        
        // 检查网关状态
        const gateway = OpenClawGateway.getInstance();
        const gatewayStatus = gateway.getStatus();
        
        const healthy = isRunning && gatewayStatus.state === 'running';
        const result = {
          healthy,
          status: healthy ? 'running' : gatewayStatus.state,
          version: '1.0.0',
          timestamp: Date.now(),
          error: healthy ? undefined : gatewayStatus.error
        };
        
        this.log.info('[IpcServer] 健康检查结果', result);
        return { success: true, data: result };
      } catch (error) {
        this.log.error('openclaw:health-check 失败', error);
        return { 
          success: false, 
          error: String(error),
          data: {
            healthy: false,
            status: 'failed',
            timestamp: Date.now(),
            error: String(error)
          }
        };
      }
    });

    // ========== MCP 配置管理 ==========
    
    ipcMain.handle('mcp:list', () => {
      try {
        const configStore = ConfigStore.getInstance();
        const mcpServers = configStore.get('mcp.servers') || [];
        return { success: true, data: mcpServers };
      } catch (error) {
        this.log.error('mcp:list 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('mcp:add', (_, data: any) => {
      try {
        const configStore = ConfigStore.getInstance();
        const mcpServers = configStore.get('mcp.servers') || [];
        
        // 检查名称是否已存在
        const existingServer = mcpServers.find((server: any) => server.name === data.name);
        if (existingServer) {
          return { success: false, error: 'MCP Server 名称已存在' };
        }

        // 添加新服务器
        const newServer = {
          ...data,
          id: `mcp_${Date.now()}`
        };
        mcpServers.push(newServer);
        configStore.set('mcp.servers', mcpServers);
        
        this.log.info('MCP Server 添加成功', { name: data.name });
        return { success: true, data: newServer };
      } catch (error) {
        this.log.error('mcp:add 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('mcp:update', (_, data: any) => {
      try {
        const configStore = ConfigStore.getInstance();
        let mcpServers = configStore.get('mcp.servers') || [];
        
        // 查找并更新服务器
        const index = mcpServers.findIndex((server: any) => server.name === data.name);
        if (index === -1) {
          return { success: false, error: 'MCP Server 不存在' };
        }

        mcpServers[index] = { ...mcpServers[index], ...data };
        configStore.set('mcp.servers', mcpServers);
        
        this.log.info('MCP Server 更新成功', { name: data.name });
        return { success: true, data: mcpServers[index] };
      } catch (error) {
        this.log.error('mcp:update 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('mcp:remove', (_, name: string) => {
      try {
        const configStore = ConfigStore.getInstance();
        let mcpServers = configStore.get('mcp.servers') || [];
        
        // 查找并删除服务器
        const index = mcpServers.findIndex((server: any) => server.name === name);
        if (index === -1) {
          return { success: false, error: 'MCP Server 不存在' };
        }

        mcpServers.splice(index, 1);
        configStore.set('mcp.servers', mcpServers);
        
        this.log.info('MCP Server 删除成功', { name });
        return { success: true };
      } catch (error) {
        this.log.error('mcp:remove 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('mcp:toggle', (_, name: string, enabled: boolean) => {
      try {
        const configStore = ConfigStore.getInstance();
        let mcpServers = configStore.get('mcp.servers') || [];
        
        // 查找并更新服务器
        const index = mcpServers.findIndex((server: any) => server.name === name);
        if (index === -1) {
          return { success: false, error: 'MCP Server 不存在' };
        }

        mcpServers[index].enabled = enabled;
        configStore.set('mcp.servers', mcpServers);
        
        this.log.info('MCP Server 状态更新成功', { name, enabled });
        return { success: true };
      } catch (error) {
        this.log.error('mcp:toggle 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('mcp:test', async (_, name: string) => {
      try {
        const configStore = ConfigStore.getInstance();
        const mcpServers = configStore.get('mcp.servers') || [];
        
        // 查找服务器
        const server = mcpServers.find((s: any) => s.name === name);
        if (!server) {
          return { success: false, error: 'MCP Server 不存在' };
        }

        // 测试连接 - 这里是模拟，实际项目中应该调用真正的 MCP 客户端
        this.log.info('测试 MCP Server 连接', { name });
        
        // 模拟连接测试
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 假设连接成功
        return { success: true };
      } catch (error) {
        this.log.error('mcp:test 失败', error);
        return { success: false, error: String(error) };
      }
    });

    // ========== 权限重置 ==========
    ipcMain.handle('permissions:reset', async () => {
      try {
        this.log.info('[IpcServer] permissions:reset 被调用，强制重置为开放模式');
        const { PermissionConfig } = require('../permissions/PermissionConfig');
        const permissionConfig = PermissionConfig.getInstance();
        const success = permissionConfig.forceResetToPermissive();
        
        if (success) {
          this.log.info('[IpcServer] 权限重置成功');
          return { success: true };
        } else {
          this.log.error('[IpcServer] 权限重置失败');
          return { success: false, error: '权限重置失败' };
        }
      } catch (error) {
        this.log.error('permissions:reset 失败', error);
        return { success: false, error: String(error) };
      }
    });

    // ========== Hermes 学习统计 ==========
    
    ipcMain.handle('learning:get-stats', () => {
      try {
        const selfLearner = SelfLearner.getInstance();
        const stats = selfLearner.getStats();
        return { success: true, data: stats };
      } catch (error) {
        this.log.error('learning:get-stats 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('learning:reset', () => {
      try {
        const selfLearner = SelfLearner.getInstance();
        selfLearner.resetStats();
        this.log.info('学习统计已重置');
        return { success: true };
      } catch (error) {
        this.log.error('learning:reset 失败', error);
        return { success: false, error: String(error) };
      }
    });

    // ========== 技能提案管理 ==========
    
    ipcMain.handle('learning:save-skill-proposal', (_, proposal: any) => {
      try {
        const selfLearner = SelfLearner.getInstance();
        const result = selfLearner.saveSkillFromProposal(proposal);
        return { success: result.success, data: result };
      } catch (error) {
        this.log.error('learning:save-skill-proposal 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('learning:get-pending-proposal', () => {
      try {
        const selfLearner = SelfLearner.getInstance();
        const proposal = selfLearner.getPendingProposal();
        return { success: true, data: proposal };
      } catch (error) {
        this.log.error('learning:get-pending-proposal 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('learning:clear-pending-proposal', () => {
      try {
        const selfLearner = SelfLearner.getInstance();
        selfLearner.clearPendingProposal();
        return { success: true };
      } catch (error) {
        this.log.error('learning:clear-pending-proposal 失败', error);
        return { success: false, error: String(error) };
      }
    });

    // ========== 技能去重合并 ==========
    
    ipcMain.handle('skills:merge-candidates', async () => {
      try {
        const selfLearner = SelfLearner.getInstance();
        const skillLoader = SkillLoader.getInstance();
        const modelManager = ModelManager.getInstance();
        
        const skills = skillLoader.getAllSkills();
        
        if (skills.length < 2) {
          return { success: true, data: [] };
        }

        const enabledProviders = modelManager.getEnabledProviders();
        const hasModel = enabledProviders.length > 0 && (enabledProviders[0].defaultModel || enabledProviders[0].models.length > 0);

        const candidates: Array<{ skillId1: string; skillName1: string; skillId2: string; skillName2: string; similarity: number }> = [];

        // 两两比较，找出相似的技能对
        for (let i = 0; i < skills.length; i++) {
          for (let j = i + 1; j < skills.length; j++) {
            const skill1 = skills[i];
            const skill2 = skills[j];
            
            let similarity = 0;
            if (hasModel) {
              try {
                similarity = await selfLearner.checkSkillSimilarity(
                  skill1.name,
                  skill1.description,
                  skill2.name,
                  skill2.description
                );
              } catch (modelError) {
                this.log.warn('技能相似度模型比较失败，使用关键词相似度', modelError);
                // 降级方案：简单的关键词相似度
                const keywords1 = new Set(skill1.triggerKeywords.map(k => k.toLowerCase()));
                const keywords2 = new Set(skill2.triggerKeywords.map(k => k.toLowerCase()));
                const intersection = [...keywords1].filter(x => keywords2.has(x));
                const union = [...new Set([...keywords1, ...keywords2])];
                similarity = union.length > 0 ? Math.round((intersection.length / union.length) * 100) : 0;
              }
            } else {
              // 没有模型可用，使用关键词相似度
              const keywords1 = new Set(skill1.triggerKeywords.map(k => k.toLowerCase()));
              const keywords2 = new Set(skill2.triggerKeywords.map(k => k.toLowerCase()));
              const intersection = [...keywords1].filter(x => keywords2.has(x));
              const union = [...new Set([...keywords1, ...keywords2])];
              similarity = union.length > 0 ? Math.round((intersection.length / union.length) * 100) : 0;
            }

            const threshold = hasModel ? 60 : 40; // 没有模型时用较低的阈值
            if (similarity >= threshold) {
              candidates.push({
                skillId1: skill1.id,
                skillName1: skill1.name,
                skillId2: skill2.id,
                skillName2: skill2.name,
                similarity: similarity
              });
            }
          }
        }

        // 按相似度排序，返回最高的
        candidates.sort((a, b) => b.similarity - a.similarity);
        
        this.log.info('技能合并候选检查完成', { candidateCount: candidates.length });
        
        return { success: true, data: candidates };
      } catch (error) {
        this.log.error('skills:merge-candidates 失败', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('skills:perform-merge', (_, skillId1: string, skillId2: string) => {
      try {
        const skillLoader = SkillLoader.getInstance();
        const skills = skillLoader.getAllSkills();
        
        const skill1 = skills.find(s => s.id === skillId1);
        const skill2 = skills.find(s => s.id === skillId2);
        
        if (!skill1 || !skill2) {
          return { success: false, error: '技能不存在' };
        }

        // 合并到第一个技能
        const mergedKeywords = [...new Set([...skill1.triggerKeywords, ...skill2.triggerKeywords])];
        const mergedSteps = [...new Set([...skill1.operationSteps, ...skill2.operationSteps])];
        
        // 构建合并提案
        const mergeProposal = {
          name: skill1.name,
          description: `${skill1.description} ${skill2.description}`,
          triggerCondition: (skill1 as any).triggerCondition || (skill2 as any).triggerCondition,
          keywords: mergedKeywords,
          operationSteps: mergedSteps
        };

        const success = skillLoader.mergeSkill(mergeProposal, skillId1);
        
        if (success) {
          // 可以删除第二个技能，或者保留备份
          return { success: true, data: { mergedTo: skillId1 } };
        }
        
        return { success: false, error: '合并失败' };
      } catch (error) {
        this.log.error('skills:perform-merge 失败', error);
        return { success: false, error: String(error) };
      }
    });

    this.log.info('IPC处理器注册完成');
  }

  public register(channel: string, handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any): void {
    this.handlers.set(channel, handler);
    ipcMain.handle(channel, handler);
    this.log.debug(`注册IPC处理器: ${channel}`);
  }

  public unregister(channel: string): void {
    this.handlers.delete(channel);
    ipcMain.removeHandler(channel);
    this.log.debug(`移除IPC处理器: ${channel}`);
  }

  public destroy(): void {
    this.handlers.clear();
    // 移除所有注册的处理器
    for (const channel of Object.keys(ipcMain.eventNames())) {
      ipcMain.removeHandler(channel);
    }
    IpcServer.instance = null as any;
    this.log.info('IPC服务器已销毁');
  }
}
