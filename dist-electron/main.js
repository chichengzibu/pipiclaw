"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const path = require("path");
const log$1 = require("electron-log");
const child_process = require("child_process");
const fs = require("fs");
const https = require("https");
const http = require("http");
const url = require("url");
const util = require("util");
const docx = require("docx");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
class LogManager {
  constructor() {
    this.initializeLogger();
  }
  static getInstance() {
    if (!LogManager.instance) {
      LogManager.instance = new LogManager();
    }
    return LogManager.instance;
  }
  initializeLogger() {
    if (process.platform === "win32") {
      try {
        child_process.execSync("chcp 65001", { stdio: "ignore" });
      } catch {
      }
    }
    const userDataPath = electron.app.getPath("userData");
    const logPath = path.join(userDataPath, "logs");
    log$1.transports.file.resolvePathFn = () => path.join(logPath, "pipiclaw.log");
    log$1.transports.file.maxSize = 5 * 1024 * 1024;
    log$1.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";
    log$1.transports.console.format = "[{h}:{i}:{s}] [{level}] {text}";
    if (process.platform === "win32") {
      log$1.transports.console.writeFn = (options) => {
        const msg = options.message;
        const time = msg.date;
        const pad = (n, len = 2) => String(n).padStart(len, "0");
        const formatted = `[${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}] [${msg.level}] ${msg.data.map(
          (a) => typeof a === "object" ? JSON.stringify(a) : String(a)
        ).join(" ")}`;
        process.stdout.write(formatted + "\n");
      };
    }
    if (!electron.app.isPackaged) {
      log$1.transports.file.level = "debug";
      log$1.transports.console.level = "debug";
    } else {
      log$1.transports.file.level = "info";
      log$1.transports.console.level = "info";
    }
  }
  debug(message, ...args) {
    log$1.debug(message, ...args);
  }
  info(message, ...args) {
    log$1.info(message, ...args);
  }
  warn(message, ...args) {
    log$1.warn(message, ...args);
  }
  error(message, ...args) {
    log$1.error(message, ...args);
  }
  getLogPath() {
    return path.join(electron.app.getPath("userData"), "logs");
  }
}
LogManager.getInstance();
class ConfigStore {
  // 私有构造函数（单例模式）
  constructor() {
    this.log = LogManager.getInstance();
    this.config = {};
    const userDataPath = electron.app.getPath("userData");
    this.configPath = path.join(userDataPath, "config.json");
    this.loadConfig();
  }
  /**
   * 获取单例实例
   */
  static getInstance() {
    if (!ConfigStore.instance) {
      ConfigStore.instance = new ConfigStore();
    }
    return ConfigStore.instance;
  }
  /**
   * 加载配置文件
   */
  loadConfig() {
    try {
      const dir = electron.app.getPath("userData");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, "utf-8");
        this.config = JSON.parse(data);
        this.log.info("配置加载成功", { path: this.configPath });
      } else {
        this.config = this.getDefaultConfig();
        this.saveConfig();
        this.log.info("使用默认配置", { path: this.configPath });
      }
    } catch (error) {
      this.log.error("配置加载失败，使用默认配置", error);
      this.config = this.getDefaultConfig();
    }
  }
  /**
   * 保存配置文件
   */
  saveConfig() {
    try {
      const data = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, data, "utf-8");
      this.log.debug("配置已保存", { path: this.configPath });
    } catch (error) {
      this.log.error("配置保存失败", error);
    }
  }
  /**
   * 获取默认配置
   */
  getDefaultConfig() {
    return {
      // 应用设置
      app: {
        theme: "dark",
        language: "zh-CN",
        startMinimized: false,
        autoLaunch: false
      },
      // 窗口设置
      window: {
        width: 1280,
        height: 800,
        x: void 0,
        y: void 0,
        isMaximized: false
      },
      // 网关设置（预留）
      gateway: {
        port: 18789,
        autoStart: true,
        logLevel: "info"
      },
      // 模型配置（预留）
      models: [],
      // 权限配置（预留）
      permissions: {
        enabled: true,
        template: "safe"
      },
      // 首次运行标记
      firstRun: true,
      // 版本信息
      version: electron.app.getVersion()
    };
  }
  /**
   * 获取配置项
   */
  get(key) {
    const keys = key.split(".");
    let value = this.config;
    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        return void 0;
      }
    }
    return value;
  }
  /**
   * 设置配置项
   */
  set(key, value) {
    const keys = key.split(".");
    let target = this.config;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in target) || typeof target[k] !== "object") {
        target[k] = {};
      }
      target = target[k];
    }
    target[keys[keys.length - 1]] = value;
    this.saveConfig();
  }
  /**
   * 获取所有配置
   */
  getAll() {
    return { ...this.config };
  }
  /**
   * 重置配置
   */
  reset() {
    this.config = this.getDefaultConfig();
    this.saveConfig();
    this.log.info("配置已重置");
  }
  /**
   * 销毁实例
   */
  destroy() {
    ConfigStore.instance = null;
  }
}
class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.log = LogManager.getInstance();
    this.initialized = false;
    this.edgeHideEnabled = false;
    this.alwaysOnTop = false;
    this.hideTimer = null;
    this.configStore = ConfigStore.getInstance();
  }
  static getInstance() {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager();
    }
    return WindowManager.instance;
  }
  async createMainWindow() {
    const isDev2 = !electron.app.isPackaged;
    const primaryDisplay = electron.screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const defaultWidth = Math.min(1280, screenWidth * 0.8);
    const defaultHeight = Math.min(800, screenHeight * 0.8);
    this.log.info("创建主窗口", { isDev: isDev2, defaultWidth, defaultHeight });
    this.mainWindow = new electron.BrowserWindow({
      width: defaultWidth,
      height: defaultHeight,
      minWidth: 1280,
      minHeight: 720,
      show: false,
      frame: false,
      titleBarStyle: "hidden",
      titleBarOverlay: false,
      backgroundColor: "#fefcf3",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webSecurity: true
      },
      icon: path.join(__dirname, "../resources/icon.ico")
    });
    this.mainWindow.once("ready-to-show", () => {
      var _a;
      this.log.info("窗口准备就绪，显示窗口");
      this.initialized = true;
      (_a = this.mainWindow) == null ? void 0 : _a.show();
    });
    this.mainWindow.on("maximize", () => {
      this.sendMaximizeChange(true);
    });
    this.mainWindow.on("unmaximize", () => {
      this.sendMaximizeChange(false);
    });
    this.mainWindow.on("focus", () => {
      this.log.debug("窗口获得焦点");
    });
    this.mainWindow.on("blur", () => {
      this.log.debug("窗口失去焦点");
    });
    this.mainWindow.on("closed", () => {
      this.log.info("主窗口已关闭");
      this.mainWindow = null;
      this.initialized = false;
    });
    if (isDev2) {
      await this.mainWindow.loadURL("http://localhost:5173");
      this.log.info("加载开发服务器: http://localhost:5173");
    } else {
      await this.mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
      this.log.info("加载生产构建页面");
    }
    return this.mainWindow;
  }
  sendMaximizeChange(isMaximized) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("window:onMaximizeChange", isMaximized);
    }
  }
  minimize() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.minimize();
    }
  }
  toggleMaximize() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow.maximize();
      }
    }
  }
  close() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.close();
    }
  }
  isMaximized() {
    var _a;
    return ((_a = this.mainWindow) == null ? void 0 : _a.isMaximized()) ?? false;
  }
  isInitialized() {
    return this.initialized;
  }
  getMainWindow() {
    return this.mainWindow;
  }
  setAlwaysOnTop(value) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.setAlwaysOnTop(value);
      this.alwaysOnTop = value;
      this.configStore.set("window.alwaysOnTop", value);
      this.log.info("[WindowManager] 设置窗口置顶:", value);
    }
  }
  isAlwaysOnTop() {
    return this.alwaysOnTop;
  }
  toggleAlwaysOnTop() {
    this.setAlwaysOnTop(!this.alwaysOnTop);
  }
  setEdgeHideEnabled(value) {
    this.edgeHideEnabled = value;
    this.configStore.set("window.edgeHideEnabled", value);
    this.log.info("[WindowManager] 设置贴边隐藏:", value);
  }
  isEdgeHideEnabled() {
    return this.edgeHideEnabled;
  }
  setupEdgeHide() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    const EDGE_THRESHOLD = 10;
    this.mainWindow.on("move", () => {
      if (!this.edgeHideEnabled) return;
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
      }
      this.hideTimer = setTimeout(() => {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
        const bounds = this.mainWindow.getBounds();
        const display = electron.screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
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
          this.log.debug("[WindowManager] 窗口贴边隐藏");
        }
      }, 100);
    });
  }
  destroy() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.destroy();
    }
    this.mainWindow = null;
    this.initialized = false;
    WindowManager.instance = null;
  }
}
const DEFAULT_GATEWAY_CONFIG = {
  autoStart: true,
  defaultPort: 18789,
  timeout: 6e4,
  logLevel: "info",
  customArgs: []
};
class GatewayConfig {
  constructor() {
    this.log = LogManager.getInstance();
    const userDataPath = electron.app.getPath("userData");
    this.configPath = path.join(userDataPath, "gateway-config.json");
    this.config = this.loadConfig();
    this.log.info("GatewayConfig 初始化完成");
  }
  static getInstance() {
    if (!GatewayConfig.instance) {
      GatewayConfig.instance = new GatewayConfig();
    }
    return GatewayConfig.instance;
  }
  loadConfig() {
    try {
      const dir = electron.app.getPath("userData");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, "utf-8");
        const parsed = JSON.parse(data);
        this.log.info("网关配置加载成功", { path: this.configPath });
        return { ...DEFAULT_GATEWAY_CONFIG, ...parsed };
      } else {
        this.config = { ...DEFAULT_GATEWAY_CONFIG };
        this.saveConfig();
        this.log.info("使用默认网关配置", { path: this.configPath });
        return this.config;
      }
    } catch (error) {
      this.log.error("网关配置加载失败，使用默认配置", error);
      return { ...DEFAULT_GATEWAY_CONFIG };
    }
  }
  saveConfig() {
    try {
      const data = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, data, "utf-8");
      this.log.debug("网关配置已保存", { path: this.configPath });
    } catch (error) {
      this.log.error("网关配置保存失败", error);
    }
  }
  getConfig() {
    return { ...this.config };
  }
  get(key) {
    return this.config[key];
  }
  set(key, value) {
    this.config[key] = value;
    this.saveConfig();
    this.log.info(`网关配置更新: ${key} = ${JSON.stringify(value)}`);
  }
  setAll(config) {
    this.config = { ...this.config, ...config };
    this.saveConfig();
    this.log.info("网关配置批量更新", config);
  }
  // ========== 移除对不存在文件的依赖 ==========
  isOpenClawExists() {
    this.log.debug("OpenClaw服务检查: 使用内置服务，无需外部文件");
    return true;
  }
  getOpenClawPath() {
    const isDev2 = !electron.app.isPackaged;
    const basePath = isDev2 ? electron.app.getAppPath() : process.resourcesPath || electron.app.getAppPath();
    const dummyPath = path.join(basePath, "openclaw", "openclaw.mjs");
    this.log.debug("OpenClaw路径(已过时，使用内置服务)", { path: dummyPath });
    return dummyPath;
  }
  // ========== 其他配置获取方法 ==========
  getNodePath() {
    return process.execPath;
  }
  getTimeout() {
    return this.config.timeout || 6e4;
  }
  getDefaultPort() {
    return this.config.defaultPort || 18789;
  }
  isAutoStart() {
    return this.config.autoStart !== false;
  }
  reset() {
    this.config = { ...DEFAULT_GATEWAY_CONFIG };
    this.saveConfig();
    this.log.info("网关配置已重置为默认值");
  }
  destroy() {
    GatewayConfig.instance = null;
  }
}
class ModelConfig {
  constructor() {
    this.log = LogManager.getInstance();
    this.providers = /* @__PURE__ */ new Map();
    const userDataPath = electron.app.getPath("userData");
    this.configPath = path.join(userDataPath, "models.json");
    this.loadConfig();
  }
  static getInstance() {
    if (!ModelConfig.instance) {
      ModelConfig.instance = new ModelConfig();
    }
    return ModelConfig.instance;
  }
  loadConfig() {
    try {
      const dir = electron.app.getPath("userData");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, "utf-8");
        const parsed = JSON.parse(data);
        this.providers.clear();
        for (const provider of parsed.providers || []) {
          this.providers.set(provider.id, provider);
        }
        this.log.info("模型配置加载成功", { count: this.providers.size });
      } else {
        this.initDefaultProviders();
        this.saveConfig();
        this.log.info("初始化默认模型配置");
      }
    } catch (error) {
      this.log.error("模型配置加载失败", error);
      this.initDefaultProviders();
    }
  }
  saveConfig() {
    try {
      const data = JSON.stringify({
        version: electron.app.getVersion(),
        providers: Array.from(this.providers.values())
      }, null, 2);
      fs.writeFileSync(this.configPath, data, "utf-8");
      this.log.debug("模型配置已保存");
    } catch (error) {
      this.log.error("模型配置保存失败", error);
    }
  }
  initDefaultProviders() {
    this.providers.clear();
    const openaiProvider = {
      id: "provider_openai_default",
      name: "OpenAI",
      type: "openai",
      enabled: false,
      baseUrl: "https://api.openai.com/v1",
      apiKey: "",
      models: [
        {
          id: "gpt-4o",
          name: "GPT-4o",
          provider: "provider_openai_default",
          capabilities: ["chat", "vision"],
          contextWindow: 128e3,
          description: "最新最强多模态模型"
        },
        {
          id: "gpt-4-turbo",
          name: "GPT-4 Turbo",
          provider: "provider_openai_default",
          capabilities: ["chat", "vision"],
          contextWindow: 128e3,
          description: "高速低成本GPT-4"
        },
        {
          id: "gpt-3.5-turbo",
          name: "GPT-3.5 Turbo",
          provider: "provider_openai_default",
          capabilities: ["chat"],
          contextWindow: 16385,
          description: "快速响应模型"
        }
      ],
      defaultModel: "gpt-4o",
      timeout: 6e4,
      maxRetries: 3,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const anthropicProvider = {
      id: "provider_anthropic_default",
      name: "Anthropic",
      type: "anthropic",
      enabled: false,
      baseUrl: "https://api.anthropic.com/v1",
      apiKey: "",
      models: [
        {
          id: "claude-sonnet-4-20250514",
          name: "Claude Sonnet 4",
          provider: "provider_anthropic_default",
          capabilities: ["chat", "vision"],
          contextWindow: 2e5,
          description: "平衡性能与成本"
        },
        {
          id: "claude-3-5-sonnet-20241022",
          name: "Claude 3.5 Sonnet",
          provider: "provider_anthropic_default",
          capabilities: ["chat", "vision"],
          contextWindow: 2e5,
          description: "快速精准"
        },
        {
          id: "claude-3-opus-20240229",
          name: "Claude 3 Opus",
          provider: "provider_anthropic_default",
          capabilities: ["chat", "vision"],
          contextWindow: 2e5,
          description: "最强推理能力"
        }
      ],
      defaultModel: "claude-sonnet-4-20250514",
      timeout: 6e4,
      maxRetries: 3,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const deepseekProvider = {
      id: "provider_deepseek_default",
      name: "DeepSeek",
      type: "deepseek",
      enabled: false,
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "",
      models: [
        {
          id: "deepseek-chat",
          name: "DeepSeek Chat",
          provider: "provider_deepseek_default",
          capabilities: ["chat"],
          contextWindow: 64e3,
          description: "通用对话模型"
        },
        {
          id: "deepseek-coder",
          name: "DeepSeek Coder",
          provider: "provider_deepseek_default",
          capabilities: ["completion"],
          contextWindow: 64e3,
          description: "代码专用模型"
        }
      ],
      defaultModel: "deepseek-chat",
      timeout: 6e4,
      maxRetries: 3,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const ollamaProvider = {
      id: "provider_ollama_default",
      name: "Ollama",
      type: "ollama",
      enabled: true,
      baseUrl: "http://localhost:11434",
      models: [
        {
          id: "llama3",
          name: "Llama 3",
          provider: "provider_ollama_default",
          capabilities: ["chat"],
          contextWindow: 8192,
          description: "Meta开源模型"
        },
        {
          id: "qwen2.5",
          name: "Qwen 2.5",
          provider: "provider_ollama_default",
          capabilities: ["chat"],
          contextWindow: 32768,
          description: "阿里通义千问"
        },
        {
          id: "codellama",
          name: "Code Llama",
          provider: "provider_ollama_default",
          capabilities: ["completion"],
          contextWindow: 16384,
          description: "代码专用模型"
        }
      ],
      defaultModel: "llama3",
      timeout: 3e4,
      maxRetries: 2,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.providers.set(openaiProvider.id, openaiProvider);
    this.providers.set(anthropicProvider.id, anthropicProvider);
    this.providers.set(deepseekProvider.id, deepseekProvider);
    this.providers.set(ollamaProvider.id, ollamaProvider);
  }
  getAllProviders() {
    return Array.from(this.providers.values());
  }
  getProvider(id) {
    return this.providers.get(id);
  }
  addProvider(config) {
    const id = `provider_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const provider = {
      ...config,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.providers.set(id, provider);
    this.saveConfig();
    return provider;
  }
  updateProvider(id, updates) {
    const provider = this.providers.get(id);
    if (!provider) {
      return null;
    }
    const updated = {
      ...provider,
      ...updates,
      id: provider.id,
      createdAt: provider.createdAt,
      updatedAt: Date.now()
    };
    this.providers.set(id, updated);
    this.saveConfig();
    return updated;
  }
  deleteProvider(id) {
    const deleted = this.providers.delete(id);
    if (deleted) {
      this.saveConfig();
    }
    return deleted;
  }
  getEnabledProviders() {
    return this.getAllProviders().filter((p) => p.enabled);
  }
  getProviderModels(providerId) {
    const provider = this.providers.get(providerId);
    return (provider == null ? void 0 : provider.models) || [];
  }
  setProviderEnabled(id, enabled) {
    const provider = this.providers.get(id);
    if (!provider) {
      return false;
    }
    provider.enabled = enabled;
    provider.updatedAt = Date.now();
    this.saveConfig();
    return true;
  }
  destroy() {
    ModelConfig.instance = null;
  }
}
class ModelManager {
  constructor() {
    this.log = LogManager.getInstance();
    this.config = ModelConfig.getInstance();
  }
  static getInstance() {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }
  getAllProviders() {
    return this.config.getAllProviders();
  }
  getProvider(id) {
    return this.config.getProvider(id);
  }
  getEnabledProviders() {
    return this.config.getEnabledProviders();
  }
  addProvider(data) {
    const provider = this.config.addProvider({
      name: data.name,
      type: data.type,
      enabled: data.enabled,
      baseUrl: data.baseUrl || "",
      apiKey: data.apiKey || "",
      organization: data.organization,
      deploymentName: data.deploymentName,
      apiVersion: data.apiVersion,
      models: data.models || [],
      defaultModel: data.defaultModel,
      timeout: data.timeout || 6e4,
      maxRetries: data.maxRetries || 3
    });
    this.log.info(`添加模型提供商: ${provider.name}`);
    return provider;
  }
  updateProvider(id, updates) {
    const updated = this.config.updateProvider(id, updates);
    if (updated) {
      this.log.info(`更新模型提供商: ${updated.name}`);
    }
    return updated;
  }
  deleteProvider(id) {
    const provider = this.config.getProvider(id);
    if (provider) {
      const deleted = this.config.deleteProvider(id);
      if (deleted) {
        this.log.info(`删除模型提供商: ${provider.name}`);
      }
      return deleted;
    }
    return false;
  }
  setProviderEnabled(id, enabled) {
    const result = this.config.setProviderEnabled(id, enabled);
    if (result) {
      this.log.info(`设置提供商 ${id} 启用状态: ${enabled}`);
    }
    return result;
  }
  async testProvider(providerId, modelId) {
    const provider = this.config.getProvider(providerId);
    if (!provider) {
      return { success: false, error: "Provider not found" };
    }
    if (!provider.enabled) {
      return { success: false, error: "Provider is disabled" };
    }
    const startTime = Date.now();
    try {
      const result = await this.makeTestRequest(provider, modelId);
      return {
        success: result.success,
        latency: Date.now() - startTime,
        response: result.response,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error.message || "Unknown error"
      };
    }
  }
  async makeTestRequest(provider, modelId) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: "Connection timeout" });
      }, provider.timeout || 3e4);
      let req;
      switch (provider.type) {
        case "ollama": {
          const url$1 = new url.URL("/api/tags", provider.baseUrl);
          const protocol = url$1.protocol === "https:" ? https : http;
          req = protocol.request(url$1, { method: "GET" }, (res) => {
            res.on("data", (chunk) => {
            });
            res.on("end", () => {
              clearTimeout(timeout);
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ success: true, response: "Ollama service is running" });
              } else {
                resolve({ success: false, error: `Service error: HTTP ${res.statusCode}` });
              }
            });
          });
          break;
        }
        case "openai":
        case "deepseek": {
          const url$1 = new url.URL("/v1/models", provider.baseUrl);
          const protocol = url$1.protocol === "https:" ? https : http;
          const headers = {
            "Authorization": `Bearer ${provider.apiKey || ""}`
          };
          req = protocol.request(url$1, { method: "GET", headers }, (res) => {
            let data = "";
            res.on("data", (chunk) => {
              data += chunk;
            });
            res.on("end", () => {
              var _a, _b;
              clearTimeout(timeout);
              if (res.statusCode === 200) {
                resolve({ success: true, response: "Connection successful" });
              } else if (res.statusCode === 401) {
                resolve({ success: false, error: "Invalid API key" });
              } else if (res.statusCode === 403) {
                resolve({ success: false, error: "Access forbidden" });
              } else {
                let errorMsg = `HTTP ${res.statusCode}`;
                try {
                  const parsed = JSON.parse(data);
                  if ((_a = parsed.error) == null ? void 0 : _a.message) errorMsg = parsed.error.message;
                  else if ((_b = parsed.error) == null ? void 0 : _b.type) errorMsg = `${parsed.error.type}: ${parsed.error.message || ""}`;
                } catch {
                }
                resolve({ success: false, error: errorMsg });
              }
            });
          });
          break;
        }
        case "anthropic": {
          const url$1 = new url.URL("/v1/messages", provider.baseUrl);
          const protocol = url$1.protocol === "https:" ? https : http;
          const headers = {
            "Content-Type": "application/json",
            "x-api-key": provider.apiKey || "",
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
          };
          const body = JSON.stringify({
            model: modelId || provider.defaultModel || "claude-3-5-sonnet-20241022",
            max_tokens: 10,
            messages: [{ role: "user", content: "Hi" }]
          });
          req = protocol.request(url$1, { method: "POST", headers }, (res) => {
            let data = "";
            res.on("data", (chunk) => {
              data += chunk;
            });
            res.on("end", () => {
              var _a;
              clearTimeout(timeout);
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ success: true, response: "Connection successful" });
              } else if (res.statusCode === 401) {
                resolve({ success: false, error: "Invalid API key" });
              } else if (res.statusCode === 403) {
                resolve({ success: false, error: "Access forbidden" });
              } else {
                let errorMsg = `HTTP ${res.statusCode}`;
                try {
                  const parsed = JSON.parse(data);
                  if ((_a = parsed.error) == null ? void 0 : _a.message) errorMsg = parsed.error.message;
                } catch {
                }
                resolve({ success: false, error: errorMsg });
              }
            });
          });
          req.write(body);
          break;
        }
        case "azure": {
          const deploymentName = provider.deploymentName || modelId || provider.defaultModel || "gpt-4";
          const url$1 = new url.URL(`/openai/deployments/${deploymentName}/chat/completions?api-version=${provider.apiVersion || "2024-02-01"}`, provider.baseUrl);
          const protocol = url$1.protocol === "https:" ? https : http;
          const headers = {
            "Content-Type": "application/json",
            "api-key": provider.apiKey || ""
          };
          const body = JSON.stringify({
            model: deploymentName,
            messages: [{ role: "user", content: "Hi" }],
            max_tokens: 10
          });
          req = protocol.request(url$1, { method: "POST", headers }, (res) => {
            let data = "";
            res.on("data", (chunk) => {
              data += chunk;
            });
            res.on("end", () => {
              var _a, _b;
              clearTimeout(timeout);
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ success: true, response: "Connection successful" });
              } else if (res.statusCode === 401) {
                resolve({ success: false, error: "Invalid API key" });
              } else if (res.statusCode === 404) {
                resolve({ success: false, error: "Deployment not found, please check deployment name" });
              } else {
                let errorMsg = `HTTP ${res.statusCode}`;
                try {
                  const parsed = JSON.parse(data);
                  if ((_a = parsed.error) == null ? void 0 : _a.message) errorMsg = parsed.error.message;
                  else if ((_b = parsed.error) == null ? void 0 : _b.code) errorMsg = `${parsed.error.code}: ${parsed.error.message || ""}`;
                } catch {
                }
                resolve({ success: false, error: errorMsg });
              }
            });
          });
          req.write(body);
          break;
        }
        case "custom": {
          const url$1 = new url.URL("/v1/models", provider.baseUrl);
          const protocol = url$1.protocol === "https:" ? https : http;
          const headers = {};
          if (provider.apiKey) {
            headers["Authorization"] = `Bearer ${provider.apiKey}`;
          }
          req = protocol.request(url$1, { method: "GET", headers }, (res) => {
            res.on("data", (chunk) => {
            });
            res.on("end", () => {
              clearTimeout(timeout);
              if (res.statusCode === 200) {
                resolve({ success: true, response: "Connection successful" });
              } else {
                resolve({ success: false, error: `HTTP ${res.statusCode}` });
              }
            });
          });
          break;
        }
        default:
          clearTimeout(timeout);
          resolve({ success: false, error: `Unsupported provider type: ${provider.type}` });
          return;
      }
      req.on("error", (error) => {
        clearTimeout(timeout);
        if (error.message.includes("ECONNREFUSED")) {
          resolve({ success: false, error: "Connection refused, please check if service is running" });
        } else if (error.message.includes("ENOTFOUND")) {
          resolve({ success: false, error: "Host not found, please check the base URL" });
        } else {
          resolve({ success: false, error: error.message });
        }
      });
      req.end();
    });
  }
  async syncOllamaModels(providerId) {
    const provider = this.config.getProvider(providerId);
    if (!provider || provider.type !== "ollama") {
      return [];
    }
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve([]);
      }, provider.timeout || 3e4);
      http.get(`${provider.baseUrl}/api/tags`, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          clearTimeout(timeout);
          try {
            const parsed = JSON.parse(data);
            const models = (parsed.models || []).map((m) => {
              var _a;
              return {
                id: m.name,
                name: m.name,
                provider: providerId,
                capabilities: ["chat"],
                contextWindow: m.size ? Math.round(m.size / 1024 / 1024 / 1024 * 10) * 1024 * 1024 * 1024 / 2 : void 0,
                description: ((_a = m.details) == null ? void 0 : _a.parameter_size) || ""
              };
            });
            this.config.updateProvider(providerId, { models });
            resolve(models);
          } catch {
            resolve([]);
          }
        });
      }).on("error", () => {
        clearTimeout(timeout);
        resolve([]);
      });
    });
  }
  destroy() {
    ModelManager.instance = null;
  }
}
const PERMISSION_CATEGORIES = {
  filesystem: {
    name: "文件系统",
    description: "读写文件和目录",
    icon: "📁"
  },
  network: {
    name: "网络",
    description: "发起网络请求和连接",
    icon: "🌐"
  },
  process: {
    name: "进程",
    description: "启动和管理进程",
    icon: "⚙️"
  },
  system: {
    name: "系统",
    description: "系统级别操作",
    icon: "🖥️"
  },
  clipboard: {
    name: "剪贴板",
    description: "读写剪贴板内容",
    icon: "📋"
  },
  shell: {
    name: "Shell",
    description: "执行shell命令",
    icon: "💻"
  },
  environment: {
    name: "环境变量",
    description: "读取和修改环境变量",
    icon: "🔧"
  }
};
const TEMPLATE_DEFAULTS = {
  safe: {
    description: "严格限制，仅允许基本操作",
    rules: [
      { category: "filesystem", name: "filesystem", level: "read", allowedPaths: ["$HOME/Documents"] },
      { category: "network", name: "network", level: "none" },
      { category: "process", name: "process", level: "none" },
      { category: "system", name: "system", level: "none" },
      { category: "clipboard", name: "clipboard", level: "read" },
      { category: "shell", name: "shell", level: "none" },
      { category: "environment", name: "environment", level: "read" }
    ]
  },
  standard: {
    description: "平衡模式，允许常见操作",
    rules: [
      { category: "filesystem", name: "filesystem", level: "all", allowedPaths: ["$HOME/**"] },
      { category: "network", name: "network", level: "read", allowedDomains: ["*.ai.*", "*.openai.com", "*.anthropic.com"] },
      { category: "process", name: "process", level: "execute" },
      { category: "system", name: "system", level: "all" },
      { category: "clipboard", name: "clipboard", level: "all" },
      { category: "shell", name: "shell", level: "all" },
      { category: "environment", name: "environment", level: "read" }
    ]
  },
  permissive: {
    description: "开放模式，允许几乎所有操作",
    rules: [
      { category: "filesystem", name: "filesystem", level: "all" },
      { category: "network", name: "network", level: "all" },
      { category: "process", name: "process", level: "all" },
      { category: "system", name: "system", level: "all" },
      { category: "clipboard", name: "clipboard", level: "all" },
      { category: "shell", name: "shell", level: "all" },
      { category: "environment", name: "environment", level: "all" }
    ]
  },
  custom: {
    description: "自定义权限配置",
    rules: []
  }
};
class PermissionConfig {
  constructor() {
    this.log = LogManager.getInstance();
    this.permissionSets = /* @__PURE__ */ new Map();
    this.activeSetId = null;
    const userDataPath = electron.app.getPath("userData");
    this.configPath = path.join(userDataPath, "permissions.json");
    this.loadConfig();
  }
  static getInstance() {
    if (!PermissionConfig.instance) {
      PermissionConfig.instance = new PermissionConfig();
    }
    return PermissionConfig.instance;
  }
  loadConfig() {
    try {
      const dir = electron.app.getPath("userData");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, "utf-8");
        const parsed = JSON.parse(data);
        this.permissionSets.clear();
        for (const set of parsed.permissionSets || []) {
          this.permissionSets.set(set.id, set);
        }
        this.activeSetId = parsed.activeSetId || null;
        this.log.info("权限配置加载成功", { count: this.permissionSets.size });
      } else {
        this.initDefaultPermissionSets();
        this.saveConfig();
        this.log.info("初始化默认权限配置");
      }
    } catch (error) {
      this.log.error("权限配置加载失败", error);
      this.initDefaultPermissionSets();
    }
  }
  saveConfig() {
    try {
      const data = JSON.stringify({
        version: electron.app.getVersion(),
        permissionSets: Array.from(this.permissionSets.values()),
        activeSetId: this.activeSetId
      }, null, 2);
      fs.writeFileSync(this.configPath, data, "utf-8");
      this.log.debug("权限配置已保存");
    } catch (error) {
      this.log.error("权限配置保存失败", error);
    }
  }
  initDefaultPermissionSets() {
    this.permissionSets.clear();
    const safeSet = this.createPermissionSetFromTemplate("safe");
    const standardSet = this.createPermissionSetFromTemplate("standard");
    const permissiveSet = this.createPermissionSetFromTemplate("permissive");
    this.permissionSets.set(safeSet.id, safeSet);
    this.permissionSets.set(standardSet.id, standardSet);
    this.permissionSets.set(permissiveSet.id, permissiveSet);
    this.activeSetId = permissiveSet.id;
    this.log.info("[PermissionConfig] 初始化默认权限，激活开放模式");
  }
  createPermissionSetFromTemplate(template) {
    const templateConfig = TEMPLATE_DEFAULTS[template];
    const rules = templateConfig.rules.map((partialRule, index) => {
      var _a;
      return {
        id: `rule_${template}_${index}`,
        category: partialRule.category,
        name: partialRule.name,
        description: ((_a = PERMISSION_CATEGORIES[partialRule.category]) == null ? void 0 : _a.description) || "",
        level: partialRule.level || "none",
        allowedPaths: partialRule.allowedPaths,
        deniedPaths: partialRule.deniedPaths,
        allowedDomains: partialRule.allowedDomains,
        deniedDomains: partialRule.deniedDomains
      };
    });
    const templateNames = {
      safe: "安全模式",
      standard: "标准模式",
      permissive: "开放模式",
      custom: "自定义"
    };
    return {
      id: `preset_${template}`,
      name: templateNames[template],
      template,
      description: templateConfig.description,
      rules,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
  getAllPermissionSets() {
    return Array.from(this.permissionSets.values());
  }
  getPermissionSet(id) {
    return this.permissionSets.get(id);
  }
  getActivePermissionSet() {
    if (!this.activeSetId) return void 0;
    return this.permissionSets.get(this.activeSetId);
  }
  getActiveSetId() {
    return this.activeSetId;
  }
  setActivePermissionSet(id) {
    if (!this.permissionSets.has(id)) {
      return false;
    }
    this.activeSetId = id;
    this.saveConfig();
    this.log.info(`激活权限集: ${id}`);
    return true;
  }
  createPermissionSet(data) {
    const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let rules = data.rules;
    if (!rules || rules.length === 0) {
      const templateConfig = TEMPLATE_DEFAULTS[data.template];
      rules = templateConfig.rules.map((partialRule, index) => {
        var _a;
        return {
          id: `rule_${id}_${index}`,
          category: partialRule.category,
          name: partialRule.name,
          description: ((_a = PERMISSION_CATEGORIES[partialRule.category]) == null ? void 0 : _a.description) || "",
          level: partialRule.level || "none",
          allowedPaths: partialRule.allowedPaths,
          deniedPaths: partialRule.deniedPaths,
          allowedDomains: partialRule.allowedDomains,
          deniedDomains: partialRule.deniedDomains
        };
      });
    }
    const permissionSet = {
      id,
      name: data.name,
      template: data.template,
      description: data.description,
      rules,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.permissionSets.set(id, permissionSet);
    this.saveConfig();
    this.log.info(`创建权限集: ${data.name}`);
    return permissionSet;
  }
  updatePermissionSet(id, updates) {
    const existing = this.permissionSets.get(id);
    if (!existing) {
      return null;
    }
    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now()
    };
    this.permissionSets.set(id, updated);
    this.saveConfig();
    this.log.info(`更新权限集: ${updated.name}`);
    return updated;
  }
  updatePermissionRule(setId, ruleId, updates) {
    const permissionSet = this.permissionSets.get(setId);
    if (!permissionSet) {
      return null;
    }
    const ruleIndex = permissionSet.rules.findIndex((r) => r.id === ruleId);
    if (ruleIndex === -1) {
      return null;
    }
    permissionSet.rules[ruleIndex] = {
      ...permissionSet.rules[ruleIndex],
      ...updates,
      id: ruleId,
      category: permissionSet.rules[ruleIndex].category,
      name: permissionSet.rules[ruleIndex].name,
      description: permissionSet.rules[ruleIndex].description
    };
    permissionSet.updatedAt = Date.now();
    this.saveConfig();
    return permissionSet.rules[ruleIndex];
  }
  deletePermissionSet(id) {
    if (id.startsWith("preset_")) {
      this.log.warn(`无法删除预设权限集: ${id}`);
      return false;
    }
    const deleted = this.permissionSets.delete(id);
    if (deleted) {
      if (this.activeSetId === id) {
        const remaining = this.getAllPermissionSets();
        this.activeSetId = remaining.length > 0 ? remaining[0].id : null;
      }
      this.saveConfig();
      this.log.info(`删除权限集: ${id}`);
    }
    return deleted;
  }
  duplicatePermissionSet(id, newName) {
    const existing = this.permissionSets.get(id);
    if (!existing) {
      return null;
    }
    const newId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const duplicated = {
      id: newId,
      name: newName,
      template: "custom",
      description: `${existing.name} (副本)`,
      rules: existing.rules.map((r) => ({
        ...r,
        id: `rule_${newId}_${r.category}`
      })),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.permissionSets.set(newId, duplicated);
    this.saveConfig();
    this.log.info(`复制权限集: ${existing.name} -> ${newName}`);
    return duplicated;
  }
  /**
   * 强制重置权限为开放模式（预防旧配置覆盖）
   * 检查并确保当前激活的权限模板为 permissive
   */
  forceResetToPermissive() {
    this.log.info("[PermissionConfig] ========== 强制重置权限为开放模式 ==========");
    this.initDefaultPermissionSets();
    const permissiveSet = this.permissionSets.get("preset_permissive");
    if (permissiveSet) {
      this.activeSetId = permissiveSet.id;
      this.saveConfig();
      this.log.info("[PermissionConfig] ✅ 已重置权限为开放模式", { activeSetId: this.activeSetId });
      return true;
    }
    this.log.error("[PermissionConfig] ❌ 重置权限失败：找不到 permissive 权限集");
    return false;
  }
  destroy() {
    PermissionConfig.instance = null;
  }
}
class PermissionManager {
  constructor() {
    this.log = LogManager.getInstance();
    this.config = PermissionConfig.getInstance();
  }
  static getInstance() {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }
  getAllPermissionSets() {
    return this.config.getAllPermissionSets();
  }
  getPermissionSet(id) {
    return this.config.getPermissionSet(id);
  }
  getActivePermissionSet() {
    return this.config.getActivePermissionSet();
  }
  getActiveSetId() {
    return this.config.getActiveSetId();
  }
  setActivePermissionSet(id) {
    return this.config.setActivePermissionSet(id);
  }
  createPermissionSet(data) {
    return this.config.createPermissionSet(data);
  }
  updatePermissionSet(id, updates) {
    return this.config.updatePermissionSet(id, updates);
  }
  updatePermissionRule(setId, ruleId, updates) {
    return this.config.updatePermissionRule(setId, ruleId, updates);
  }
  deletePermissionSet(id) {
    return this.config.deletePermissionSet(id);
  }
  duplicatePermissionSet(id, newName) {
    return this.config.duplicatePermissionSet(id, newName);
  }
  checkPermission(request, permissionSetId) {
    let activeSet;
    if (permissionSetId) {
      activeSet = this.config.getPermissionSet(permissionSetId);
    } else {
      activeSet = this.config.getActivePermissionSet();
    }
    if (!activeSet) {
      return {
        allowed: false,
        reason: permissionSetId ? "未找到指定的权限集" : "未找到激活的权限集",
        requiresConfirmation: false
      };
    }
    const rule = activeSet.rules.find((r) => r.category === request.category);
    if (!rule) {
      return {
        allowed: false,
        reason: `未找到 ${request.category} 权限规则`,
        requiresConfirmation: false
      };
    }
    if (rule.level === "none") {
      return {
        allowed: false,
        reason: `${request.category} 操作已被禁用`,
        requiresConfirmation: false
      };
    }
    if (rule.level === "all") {
      return {
        allowed: true,
        reason: "完全允许"
      };
    }
    const actionLevel = this.getActionLevel(request.action);
    if (actionLevel > this.getLevelValue(rule.level)) {
      return {
        allowed: false,
        reason: `需要 ${request.action} 权限，当前级别: ${rule.level}`,
        requiresConfirmation: true
      };
    }
    if (request.resource) {
      const resourceCheck = this.checkResourcePermission(rule, request.action, request.resource);
      if (!resourceCheck.allowed) {
        return resourceCheck;
      }
    }
    return {
      allowed: true,
      reason: "权限检查通过"
    };
  }
  getActionLevel(action) {
    const actionLevels = {
      read: 1,
      write: 2,
      execute: 3,
      delete: 2,
      create: 2,
      list: 1,
      search: 1
    };
    return actionLevels[action.toLowerCase()] || 1;
  }
  getLevelValue(level) {
    const values = {
      none: 0,
      read: 1,
      write: 2,
      execute: 3,
      all: 4
    };
    return values[level];
  }
  checkResourcePermission(rule, action, resource) {
    if (rule.deniedPaths && rule.deniedPaths.length > 0) {
      for (const pattern of rule.deniedPaths) {
        if (this.matchPathPattern(resource, pattern)) {
          return {
            allowed: false,
            reason: `路径 ${resource} 在黑名单中`,
            requiresConfirmation: true
          };
        }
      }
    }
    if (rule.allowedPaths && rule.allowedPaths.length > 0) {
      let allowed = false;
      for (const pattern of rule.allowedPaths) {
        if (this.matchPathPattern(resource, pattern)) {
          allowed = true;
          break;
        }
      }
      if (!allowed) {
        return {
          allowed: false,
          reason: `路径 ${resource} 不在白名单中`,
          requiresConfirmation: true
        };
      }
    }
    if (rule.deniedDomains && rule.deniedDomains.length > 0) {
      try {
        const domain = new URL(resource).hostname;
        for (const pattern of rule.deniedDomains) {
          if (this.matchDomainPattern(domain, pattern)) {
            return {
              allowed: false,
              reason: `域名 ${domain} 在黑名单中`,
              requiresConfirmation: true
            };
          }
        }
      } catch {
      }
    }
    if (rule.allowedDomains && rule.allowedDomains.length > 0) {
      let allowed = false;
      try {
        const domain = new URL(resource).hostname;
        for (const pattern of rule.allowedDomains) {
          if (this.matchDomainPattern(domain, pattern)) {
            allowed = true;
            break;
          }
        }
      } catch {
      }
      if (!allowed) {
        return {
          allowed: false,
          reason: `域名不在白名单中`,
          requiresConfirmation: true
        };
      }
    }
    return { allowed: true };
  }
  matchPathPattern(path2, pattern) {
    if (pattern === "**" || pattern === "*") {
      return true;
    }
    if (pattern.startsWith("$HOME")) {
      const home = process.env.HOME || process.env.USERPROFILE || "";
      pattern = pattern.replace("$HOME", home);
    }
    const regexPattern = pattern.replace(/\./g, "\\.").replace(/\*\*/g, ".*").replace(/\*/g, "[^/\\\\]*");
    try {
      return new RegExp(`^${regexPattern}`).test(path2);
    } catch {
      return false;
    }
  }
  matchDomainPattern(domain, pattern) {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(2);
      return domain.endsWith(suffix) || domain === suffix.slice(1);
    }
    return domain === pattern;
  }
  getPermissionSummary() {
    const activeSet = this.getActivePermissionSet();
    return {
      totalSets: this.getAllPermissionSets().length,
      activeSet: (activeSet == null ? void 0 : activeSet.name) || null,
      categories: (activeSet == null ? void 0 : activeSet.rules.map((r) => r.category)) || []
    };
  }
  destroy() {
    PermissionManager.instance = null;
  }
}
const DEFAULT_CHAT_SETTINGS = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0
};
class ChatConfig {
  constructor() {
    this.log = LogManager.getInstance();
    this.conversations = /* @__PURE__ */ new Map();
    this.settings = { ...DEFAULT_CHAT_SETTINGS };
    this.lastProviderId = null;
    this.lastModelId = null;
    const userDataPath = electron.app.getPath("userData");
    this.configPath = path.join(userDataPath, "chat.json");
    this.loadConfig();
  }
  static getInstance() {
    if (!ChatConfig.instance) {
      ChatConfig.instance = new ChatConfig();
    }
    return ChatConfig.instance;
  }
  loadConfig() {
    try {
      const dir = electron.app.getPath("userData");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.configPath)) {
        try {
          const data = fs.readFileSync(this.configPath, "utf-8");
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (jsonError) {
            this.log.warn("聊天配置 JSON 解析失败，尝试备份和恢复", jsonError);
            const backupPath = `${this.configPath}.backup.${Date.now()}`;
            try {
              fs.writeFileSync(backupPath, data, "utf-8");
              this.log.info("已备份损坏的聊天配置", { path: backupPath });
            } catch (backupError) {
              this.log.error("备份失败", backupError);
            }
            throw jsonError;
          }
          if (!Array.isArray(parsed.conversations)) {
            this.log.warn("配置文件中 conversations 格式错误，使用默认值");
            parsed.conversations = [];
          }
          if (!parsed.settings) {
            parsed.settings = { ...DEFAULT_CHAT_SETTINGS };
          }
          this.conversations.clear();
          for (const conv of parsed.conversations) {
            if (conv && typeof conv.id === "string") {
              const safeConv = {
                id: conv.id,
                title: conv.title || "新对话",
                messages: Array.isArray(conv.messages) ? conv.messages : [],
                providerId: conv.providerId || void 0,
                modelId: conv.modelId || void 0,
                permissionSetId: conv.permissionSetId || void 0,
                createdAt: conv.createdAt || Date.now(),
                updatedAt: conv.updatedAt || Date.now(),
                status: ["active", "archived"].includes(conv.status) ? conv.status : "active",
                pinned: !!conv.pinned
              };
              this.conversations.set(safeConv.id, safeConv);
            }
          }
          this.settings = { ...DEFAULT_CHAT_SETTINGS };
          if (parsed.settings) {
            for (const key of Object.keys(DEFAULT_CHAT_SETTINGS)) {
              if (typeof parsed.settings[key] !== "undefined") {
                this.settings[key] = parsed.settings[key];
              }
            }
          }
          this.lastProviderId = parsed.lastProviderId || null;
          this.lastModelId = parsed.lastModelId || null;
          this.log.info("聊天配置加载成功", { count: this.conversations.size });
        } catch (error) {
          this.log.error("读取聊天配置失败，重置为默认值", error);
          this.initDefault();
          this.saveConfig();
        }
      } else {
        this.initDefault();
        this.saveConfig();
        this.log.info("初始化默认聊天配置");
      }
    } catch (error) {
      this.log.error("聊天配置加载过程中发生错误", error);
      this.initDefault();
    }
  }
  initDefault() {
    this.conversations.clear();
    this.settings = { ...DEFAULT_CHAT_SETTINGS };
    this.lastProviderId = null;
    this.lastModelId = null;
  }
  saveConfig() {
    try {
      const data = JSON.stringify({
        version: electron.app.getVersion(),
        conversations: Array.from(this.conversations.values()),
        settings: this.settings,
        lastProviderId: this.lastProviderId,
        lastModelId: this.lastModelId
      }, null, 2);
      fs.writeFileSync(this.configPath, data, "utf-8");
      this.log.debug("聊天配置已保存");
    } catch (error) {
      this.log.error("聊天配置保存失败", error);
    }
  }
  getAllConversations() {
    return Array.from(this.conversations.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  getActiveConversations() {
    return this.getAllConversations().filter((c) => c.status === "active");
  }
  getConversation(id) {
    return this.conversations.get(id);
  }
  getMessage(conversationId, messageId) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return void 0;
    return conversation.messages.find((m) => m.id === messageId);
  }
  createConversation(data) {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const conversation = {
      id,
      title: (data == null ? void 0 : data.title) || `新对话 ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")}`,
      messages: (data == null ? void 0 : data.messages) || [],
      providerId: (data == null ? void 0 : data.providerId) || this.lastProviderId || void 0,
      modelId: (data == null ? void 0 : data.modelId) || this.lastModelId || void 0,
      permissionSetId: data == null ? void 0 : data.permissionSetId,
      createdAt: now,
      updatedAt: now,
      status: "active",
      pinned: false
    };
    this.conversations.set(id, conversation);
    this.saveConfig();
    return conversation;
  }
  updateConversation(id, updates) {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      return null;
    }
    const updated = {
      ...conversation,
      ...updates,
      id: conversation.id,
      createdAt: conversation.createdAt,
      updatedAt: Date.now()
    };
    this.conversations.set(id, updated);
    this.saveConfig();
    return updated;
  }
  addMessage(conversationId, message) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return null;
    }
    const fullMessage = {
      ...message,
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: message.timestamp || Date.now(),
      status: message.status || "sent"
    };
    conversation.messages.push(fullMessage);
    conversation.updatedAt = Date.now();
    if (conversation.messages.length === 1) {
      conversation.title = this.generateTitle(fullMessage.content);
    }
    this.saveConfig();
    return fullMessage;
  }
  updateMessage(conversationId, messageId, updates) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return null;
    }
    const msgIndex = conversation.messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) {
      return null;
    }
    conversation.messages[msgIndex] = {
      ...conversation.messages[msgIndex],
      ...updates
    };
    conversation.updatedAt = Date.now();
    this.saveConfig();
    return conversation.messages[msgIndex];
  }
  createStreamingMessage(conversationId, message) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return null;
    }
    const fullMessage = {
      ...message,
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      status: "streaming"
    };
    conversation.messages.push(fullMessage);
    conversation.updatedAt = Date.now();
    return fullMessage;
  }
  appendStreamingContent(conversationId, messageId, content, thinking) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;
    const msg = conversation.messages.find((m) => m.id === messageId);
    if (!msg) return;
    if (thinking !== void 0) {
      msg.thinking = thinking;
    }
    if (content !== void 0) {
      msg.content = content;
    }
    msg.timestamp = Date.now();
  }
  finalizeStreamingMessage(conversationId, messageId, status, error) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;
    const msg = conversation.messages.find((m) => m.id === messageId);
    if (!msg) return null;
    msg.status = status;
    msg.timestamp = Date.now();
    if (error) msg.error = error;
    conversation.updatedAt = Date.now();
    this.saveConfig();
    return msg;
  }
  deleteMessage(conversationId, messageId) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return false;
    }
    const msgIndex = conversation.messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) {
      return false;
    }
    conversation.messages.splice(msgIndex, 1);
    conversation.updatedAt = Date.now();
    this.saveConfig();
    return true;
  }
  deleteConversation(id) {
    const deleted = this.conversations.delete(id);
    if (deleted) {
      this.saveConfig();
    }
    return deleted;
  }
  archiveConversation(id) {
    return this.updateConversation(id, { status: "archived" });
  }
  pinConversation(id, pinned) {
    return this.updateConversation(id, { pinned });
  }
  generateTitle(content) {
    const firstLine = content.split("\n")[0].trim();
    if (firstLine.length <= 30) {
      return firstLine;
    }
    return firstLine.substring(0, 27) + "...";
  }
  getSettings() {
    return { ...this.settings };
  }
  updateSettings(updates) {
    this.settings = { ...this.settings, ...updates };
    this.saveConfig();
    return this.settings;
  }
  setLastProvider(providerId) {
    this.lastProviderId = providerId;
    this.saveConfig();
  }
  getLastProvider() {
    return this.lastProviderId;
  }
  setLastModel(modelId) {
    this.lastModelId = modelId;
    this.saveConfig();
  }
  getLastModel() {
    return this.lastModelId;
  }
  destroy() {
    ChatConfig.instance = null;
  }
}
class HermesMemory {
  constructor() {
    this.log = LogManager.getInstance();
    this.configStore = ConfigStore.getInstance();
    this.memories = [];
    this.memoryDir = path__namespace.join(electron.app.getPath("userData"), "hermes-memory");
    this.coreMemoryPath = path__namespace.join(this.memoryDir, "USER.md");
    this.experienceMemoryPath = path__namespace.join(this.memoryDir, "MEMORY.md");
    this.ensureMemoryDir();
    this.loadMemories();
  }
  static getInstance() {
    if (!HermesMemory.instance) {
      HermesMemory.instance = new HermesMemory();
    }
    return HermesMemory.instance;
  }
  ensureMemoryDir() {
    if (!fs__namespace.existsSync(this.memoryDir)) {
      fs__namespace.mkdirSync(this.memoryDir, { recursive: true });
    }
    if (!fs__namespace.existsSync(this.coreMemoryPath)) {
      fs__namespace.writeFileSync(this.coreMemoryPath, "# 用户核心记忆\n\n", "utf-8");
    }
    if (!fs__namespace.existsSync(this.experienceMemoryPath)) {
      fs__namespace.writeFileSync(this.experienceMemoryPath, "# 经验记忆\n\n", "utf-8");
    }
  }
  loadMemories() {
    try {
      const saved = this.configStore.get("hermes.memories");
      if (saved) {
        this.memories = saved;
      }
      this.log.info("[HermesMemory] 记忆加载成功", { count: this.memories.length });
    } catch (error) {
      this.log.error("[HermesMemory] 记忆加载失败", error);
    }
  }
  saveMemories() {
    try {
      this.configStore.set("hermes.memories", this.memories);
    } catch (error) {
      this.log.error("[HermesMemory] 记忆保存失败", error);
    }
  }
  /**
   * 获取核心记忆（USER.md）
   */
  getCoreMemory() {
    try {
      return fs__namespace.readFileSync(this.coreMemoryPath, "utf-8");
    } catch (error) {
      this.log.error("[HermesMemory] 读取核心记忆失败", error);
      return "";
    }
  }
  /**
   * 更新核心记忆
   */
  updateCoreMemory(content) {
    try {
      fs__namespace.writeFileSync(this.coreMemoryPath, content, "utf-8");
      this.log.info("[HermesMemory] 核心记忆已更新");
    } catch (error) {
      this.log.error("[HermesMemory] 更新核心记忆失败", error);
    }
  }
  /**
   * 获取经验记忆（MEMORY.md）
   */
  getExperienceMemory() {
    try {
      return fs__namespace.readFileSync(this.experienceMemoryPath, "utf-8");
    } catch (error) {
      this.log.error("[HermesMemory] 读取经验记忆失败", error);
      return "";
    }
  }
  /**
   * 添加经验记忆
   */
  addExperienceMemory(content, tags) {
    const item = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: "experience",
      content,
      timestamp: Date.now(),
      tags,
      importance: 50
    };
    this.memories.push(item);
    this.saveMemories();
    try {
      const entry = `## ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")}

${content}

`;
      fs__namespace.appendFileSync(this.experienceMemoryPath, entry, "utf-8");
    } catch (error) {
      this.log.error("[HermesMemory] 追加经验记忆失败", error);
    }
    this.log.info("[HermesMemory] 经验记忆已添加", item);
  }
  /**
   * 添加对话记忆
   */
  addConversationMemory(conversationId, content, importance = 30) {
    const item = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: "conversation",
      content,
      timestamp: Date.now(),
      tags: [conversationId],
      importance
    };
    this.memories.push(item);
    this.saveMemories();
    this.log.info("[HermesMemory] 对话记忆已添加", item);
  }
  /**
   * 检索相关记忆
   */
  retrieveRelevantMemories(query, limit = 5) {
    const relevant = [...this.memories].sort((a, b) => {
      const scoreA = (a.importance || 0) - (Date.now() - a.timestamp) / 864e5;
      const scoreB = (b.importance || 0) - (Date.now() - b.timestamp) / 864e5;
      return scoreB - scoreA;
    }).slice(0, limit);
    return relevant;
  }
  /**
   * 构建记忆提示词
   */
  buildMemoryPrompt(query) {
    const coreMemory = this.getCoreMemory();
    this.getExperienceMemory();
    const relevant = this.retrieveRelevantMemories(query);
    let prompt = "";
    if (coreMemory.trim()) {
      prompt += `## 用户核心记忆
${coreMemory}

`;
    }
    if (relevant.length > 0) {
      prompt += `## 相关历史记忆
`;
      relevant.forEach((item, idx) => {
        prompt += `${idx + 1}. ${item.content}
`;
      });
      prompt += "\n";
    }
    return prompt;
  }
  /**
   * 清空所有记忆
   */
  clearAllMemories() {
    this.memories = [];
    this.saveMemories();
    fs__namespace.writeFileSync(this.coreMemoryPath, "# 用户核心记忆\n\n", "utf-8");
    fs__namespace.writeFileSync(this.experienceMemoryPath, "# 经验记忆\n\n", "utf-8");
    this.log.info("[HermesMemory] 所有记忆已清空");
  }
  /**
   * 获取所有记忆
   */
  getAllMemories() {
    return [...this.memories];
  }
}
class OpenClawServer {
  constructor(config) {
    this.log = LogManager.getInstance();
    this.server = null;
    this.running = false;
    this.permissionManager = PermissionManager.getInstance();
    this.config = {
      port: 18789,
      host: "127.0.0.1",
      ...config
    };
    this.log.info("[OpenClawServer] 初始化网关服务");
  }
  // 延迟初始化 OpenClawGateway 的方法
  getExecutor() {
    if (!this.executor) {
      this.executor = OpenClawGateway.getInstance();
    }
    return this.executor;
  }
  static getInstance(config) {
    if (!OpenClawServer.instance) {
      OpenClawServer.instance = new OpenClawServer(config);
    }
    return OpenClawServer.instance;
  }
  /**
   * 启动网关服务
   */
  async start(port) {
    if (this.running) {
      this.log.warn("[OpenClawServer] 网关已在运行");
      return { port: this.config.port, success: true };
    }
    const actualPort = port || this.config.port;
    this.log.info("[OpenClawServer] 正在启动网关服务", { port: actualPort });
    try {
      const isPortAvailable = await this.checkPortAvailable(actualPort);
      if (!isPortAvailable) {
        this.log.warn("[OpenClawServer] 端口已被占用，尝试自动切换端口", { port: actualPort });
        const newPort = await this.findAvailablePort(actualPort + 1);
        this.config.port = newPort;
        this.log.info("[OpenClawServer] 切换到新端口", { port: newPort });
      }
      this.server = http.createServer(this.handleRequest.bind(this));
      await new Promise((resolve, reject) => {
        this.server.listen(this.config.port, this.config.host, () => {
          this.log.info("[OpenClawServer] 网关服务启动成功", {
            host: this.config.host,
            port: this.config.port
          });
          resolve();
        });
        this.server.on("error", (error) => {
          this.log.error("[OpenClawServer] 网关服务启动失败", error);
          reject(error);
        });
      });
      this.running = true;
      return { port: this.config.port, success: true };
    } catch (error) {
      const errorMsg = error.message || "启动失败";
      this.log.error("[OpenClawServer] 网关服务启动失败", error);
      let guidance = "请检查端口18789是否被占用";
      if (error.code === "EADDRINUSE") {
        guidance = "端口18789已被占用，请关闭占用该端口的程序或修改配置";
      } else if (error.code === "EACCES") {
        guidance = "权限不足，请使用管理员/root权限运行或修改端口";
      }
      return {
        port: this.config.port,
        success: false,
        error: errorMsg,
        guidance
      };
    }
  }
  /**
   * 停止网关服务
   */
  async stop() {
    if (!this.running || !this.server) {
      this.log.warn("[OpenClawServer] 网关未运行");
      return;
    }
    this.log.info("[OpenClawServer] 正在停止网关服务");
    return new Promise((resolve) => {
      this.server.close(() => {
        this.running = false;
        this.log.info("[OpenClawServer] 网关服务已停止");
        resolve();
      });
    });
  }
  /**
   * 重启网关服务
   */
  async restart(port) {
    this.log.info("[OpenClawServer] 正在重启网关服务");
    await this.stop();
    await new Promise((resolve) => setTimeout(resolve, 500));
    return await this.start(port);
  }
  /**
   * 检查服务是否正在运行
   */
  isRunning() {
    return this.running;
  }
  /**
   * 获取当前监听端口
   */
  getPort() {
    return this.config.port;
  }
  // ========== 私有方法 ==========
  /**
   * 处理HTTP请求
   */
  handleRequest(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }
    const parsedUrl = new url.URL(req.url || "", `http://${req.headers.host}`);
    const path2 = parsedUrl.pathname;
    this.log.debug("[OpenClawServer] 收到请求", { method: req.method, path: path2 });
    if (path2 === "/health" && req.method === "GET") {
      this.handleHealthCheck(res);
      return;
    }
    if (path2 === "/execute" && req.method === "POST") {
      this.handleExecute(req, res);
      return;
    }
    if (path2 === "/permission-check" && req.method === "POST") {
      this.handlePermissionCheck(req, res);
      return;
    }
    this.sendResponse(res, 404, {
      success: false,
      error: "接口不存在",
      errorCode: "NOT_FOUND",
      timestamp: Date.now()
    });
  }
  /**
   * 健康检查处理
   */
  handleHealthCheck(res) {
    const response = {
      success: true,
      data: {
        status: "ok",
        timestamp: Date.now(),
        version: "1.0.0"
      },
      timestamp: Date.now()
    };
    this.sendResponse(res, 200, response);
  }
  /**
   * 执行操作处理
   */
  async handleExecute(req, res) {
    try {
      const body = await this.parseRequestBody(req);
      const request = body;
      this.log.info("[OpenClawServer] 收到执行请求", {
        operation: request.operation,
        timestamp: request.timestamp
      });
      const permissionCheck = await this.checkOperationPermission(request);
      if (!permissionCheck.allowed) {
        this.sendResponse(res, 403, {
          success: false,
          error: permissionCheck.reason,
          errorCode: "PERMISSION_DENIED",
          guidance: permissionCheck.guidance,
          timestamp: Date.now()
        });
        return;
      }
      const result = await this.getExecutor().executeOperation({
        operationType: request.operation,
        params: request.params
      });
      const response = {
        success: result.success,
        data: result,
        error: result.error,
        errorCode: result.errorCode,
        guidance: result.guidance,
        timestamp: Date.now()
      };
      this.sendResponse(res, result.success ? 200 : 500, response);
    } catch (error) {
      this.log.error("[OpenClawServer] 执行请求失败", error);
      this.sendResponse(res, 500, {
        success: false,
        error: error.message || "执行失败",
        errorCode: "EXECUTION_ERROR",
        guidance: "请检查参数是否正确",
        timestamp: Date.now()
      });
    }
  }
  /**
   * 权限检查处理
   */
  async handlePermissionCheck(req, res) {
    try {
      const body = await this.parseRequestBody(req);
      const check = this.permissionManager.checkPermission({
        category: body.category,
        action: body.action,
        resource: body.resource
      });
      const guidance = check.allowed ? void 0 : `请在权限管理中启用「${body.category}」的「${body.action}」权限`;
      this.sendResponse(res, 200, {
        success: true,
        data: {
          allowed: check.allowed,
          reason: check.reason,
          guidance
        },
        timestamp: Date.now()
      });
    } catch (error) {
      this.log.error("[OpenClawServer] 权限检查失败", error);
      this.sendResponse(res, 500, {
        success: false,
        error: error.message || "检查失败",
        timestamp: Date.now()
      });
    }
  }
  /**
   * 检查操作权限
   */
  async checkOperationPermission(request) {
    var _a, _b;
    const operationToPermission = {
      "read_file": { category: "filesystem", action: "read" },
      "write_file": { category: "filesystem", action: "write" },
      "create_file": { category: "filesystem", action: "write" },
      "delete_file": { category: "filesystem", action: "delete" },
      "list_directory": { category: "filesystem", action: "list" },
      "create_directory": { category: "filesystem", action: "create" },
      "delete_directory": { category: "filesystem", action: "delete" },
      "run_command": { category: "shell", action: "execute" },
      "open_url": { category: "system", action: "read" },
      "clipboard_read": { category: "clipboard", action: "read" },
      "clipboard_write": { category: "clipboard", action: "write" }
    };
    const permissionConfig = operationToPermission[request.operation];
    if (!permissionConfig) {
      return { allowed: true };
    }
    const check = this.permissionManager.checkPermission({
      category: permissionConfig.category,
      action: permissionConfig.action,
      resource: ((_a = request.params) == null ? void 0 : _a.path) || ((_b = request.params) == null ? void 0 : _b.resource)
    });
    const guidance = check.allowed ? void 0 : `请在权限管理中启用「${permissionConfig.category}」的「${permissionConfig.action}」权限`;
    return {
      allowed: check.allowed,
      reason: check.reason,
      guidance
    };
  }
  /**
   * 解析请求体
   */
  parseRequestBody(req) {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
      req.on("error", reject);
    });
  }
  /**
   * 发送响应
   */
  sendResponse(res, statusCode, data) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.writeHead(statusCode);
    res.end(JSON.stringify(data));
  }
  /**
   * 检查端口是否可用
   */
  checkPortAvailable(port) {
    return new Promise((resolve) => {
      const server = http.createServer();
      server.listen(port, "127.0.0.1", () => {
        server.close(() => {
          resolve(true);
        });
      });
      server.on("error", () => {
        resolve(false);
      });
    });
  }
  /**
   * 查找可用端口
   */
  async findAvailablePort(startPort) {
    const maxPort = startPort + 100;
    for (let port = startPort; port <= maxPort; port++) {
      const available = await this.checkPortAvailable(port);
      if (available) {
        return port;
      }
    }
    throw new Error("没有找到可用端口");
  }
  /**
   * 销毁实例
   */
  async destroy() {
    await this.stop();
    OpenClawServer.instance = null;
  }
}
let pw = null;
class BrowserManager {
  constructor() {
    this.log = LogManager.getInstance();
    this.sessions = /* @__PURE__ */ new Map();
    this.defaultOptions = {
      headless: false,
      slowMo: 50,
      viewport: { width: 1280, height: 720 }
    };
    this.log.info("[BrowserManager] 初始化中...");
    this.initPlaywright().catch((err) => {
      this.log.warn("[BrowserManager] Playwright 初始化失败（可选功能）", err);
    });
  }
  async initPlaywright() {
    try {
      this.log.info("[BrowserManager] 正在加载 Playwright...");
      pw = await import("playwright");
      this.log.info("[BrowserManager] Playwright 加载成功");
    } catch (error) {
      this.log.error("[BrowserManager] Playwright 加载失败", error);
    }
  }
  static getInstance() {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }
  /**
   * 创建新浏览器会话
   */
  async createSession(options) {
    if (!pw) {
      throw new Error("Playwright 未加载，请检查安装");
    }
    const sessionId = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const mergedOptions = { ...this.defaultOptions, ...options };
    try {
      this.log.info(`[BrowserManager] 创建会话: ${sessionId}`);
      const browser = await pw.chromium.launch(mergedOptions);
      const context = await browser.newContext();
      const page = await context.newPage();
      const session = {
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
      this.log.error("[BrowserManager] 创建会话失败", error);
      throw error;
    }
  }
  /**
   * 获取会话
   */
  getSession(sessionId) {
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
  async navigate(sessionId, url2) {
    const session = this.getSession(sessionId);
    this.log.info(`[BrowserManager] 打开网址: ${url2}`);
    await session.page.goto(url2, { waitUntil: "networkidle" });
  }
  /**
   * 点击元素
   */
  async click(sessionId, selector) {
    const session = this.getSession(sessionId);
    this.log.info(`[BrowserManager] 点击: ${selector}`);
    await session.page.click(selector);
  }
  /**
   * 输入文本
   */
  async type(sessionId, selector, text) {
    const session = this.getSession(sessionId);
    this.log.info(`[BrowserManager] 输入文本: ${selector}`);
    await session.page.fill(selector, text);
  }
  /**
   * 获取文本
   */
  async getText(sessionId, selector) {
    const session = this.getSession(sessionId);
    const text = await session.page.textContent(selector);
    return text || "";
  }
  /**
   * 等待元素
   */
  async waitForSelector(sessionId, selector, timeout) {
    const session = this.getSession(sessionId);
    await session.page.waitForSelector(selector, { timeout: timeout || 3e4 });
  }
  /**
   * 截图
   */
  async screenshot(sessionId, path2) {
    const session = this.getSession(sessionId);
    const screenshot = await session.page.screenshot({ path: path2, fullPage: true });
    return screenshot;
  }
  /**
   * 获取页面标题
   */
  async getTitle(sessionId) {
    const session = this.getSession(sessionId);
    return await session.page.title();
  }
  /**
   * 获取页面 URL
   */
  async getUrl(sessionId) {
    const session = this.getSession(sessionId);
    return session.page.url();
  }
  /**
   * 关闭会话
   */
  async closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.browser.close();
      } catch (error) {
        this.log.warn("[BrowserManager] 关闭浏览器失败", error);
      }
      this.sessions.delete(sessionId);
      this.log.info(`[BrowserManager] 会话已关闭: ${sessionId}`);
    }
  }
  /**
   * 关闭所有会话
   */
  async closeAllSessions() {
    for (const sessionId of this.sessions.keys()) {
      await this.closeSession(sessionId);
    }
  }
  /**
   * 获取活跃会话列表
   */
  getActiveSessions() {
    return Array.from(this.sessions.keys());
  }
  /**
   * 销毁管理器
   */
  async destroy() {
    await this.closeAllSessions();
    BrowserManager.instance = null;
  }
}
const execAsync = util.promisify(child_process.exec);
const PERMISSION_MAP = {
  read_file: { category: "filesystem", action: "read" },
  write_file: { category: "filesystem", action: "write" },
  create_file: { category: "filesystem", action: "write" },
  delete_file: { category: "filesystem", action: "delete" },
  rename_file: { category: "filesystem", action: "write" },
  list_directory: { category: "filesystem", action: "list" },
  create_directory: { category: "filesystem", action: "create" },
  delete_directory: { category: "filesystem", action: "delete" },
  file_exists: { category: "filesystem", action: "read" },
  run_command: { category: "shell", action: "execute" },
  open_url: { category: "system", action: "read" },
  clipboard_read: { category: "clipboard", action: "read" },
  clipboard_write: { category: "clipboard", action: "write" },
  // 浏览器操作
  browser_open: { category: "system", action: "execute" },
  browser_click: { category: "system", action: "execute" },
  browser_type: { category: "system", action: "execute" },
  browser_navigate: { category: "system", action: "execute" },
  browser_screenshot: { category: "system", action: "read" },
  browser_get_text: { category: "system", action: "read" },
  browser_wait_for: { category: "system", action: "execute" }
};
class OpenClawGateway {
  constructor() {
    this.log = LogManager.getInstance();
    this.permissionManager = PermissionManager.getInstance();
    this.auditLogs = [];
    this.state = "stopped";
    this.port = 18789;
    this.pid = null;
    this.startTime = null;
    this.lastError = null;
    this.restartAttempts = 0;
    this.maxRestartAttempts = 3;
    this.healthCheckInterval = null;
    this.activeBrowserSessionId = null;
    this.log.info("[OpenClawGateway] 初始化中...");
    const gatewayConfig = GatewayConfig.getInstance();
    this.port = gatewayConfig.getDefaultPort();
    this.browserManager = BrowserManager.getInstance();
    this.log.info("[OpenClawGateway] 初始化完成");
  }
  // 延迟初始化 OpenClawServer 的方法
  getServer() {
    if (!this.server) {
      this.server = OpenClawServer.getInstance();
    }
    return this.server;
  }
  static getInstance() {
    if (!OpenClawGateway.instance) {
      OpenClawGateway.instance = new OpenClawGateway();
    }
    return OpenClawGateway.instance;
  }
  // ========== 网关生命周期管理 ==========
  /**
   * 启动网关
   */
  async start(options = {}) {
    if (this.state === "running" || this.state === "starting" && !options.isRetry) {
      return { success: true };
    }
    const gatewayConfig = GatewayConfig.getInstance();
    this.port = options.port || gatewayConfig.getDefaultPort();
    this.state = "starting";
    this.lastError = null;
    this.broadcastStatus();
    try {
      this.log.info(`[OpenClawGateway] 正在启动网关，端口: ${this.port}`);
      const result = await this.getServer().start(this.port);
      if (result.success) {
        this.state = "running";
        this.pid = process.pid;
        this.startTime = Date.now();
        this.restartAttempts = 0;
        this.startHealthCheck();
        this.broadcastStatus();
        this.log.info("[OpenClawGateway] 网关启动成功");
        return { success: true };
      } else {
        throw new Error(result.error || "启动失败");
      }
    } catch (error) {
      this.state = "failed";
      this.lastError = error.message;
      this.broadcastStatus();
      this.log.error("[OpenClawGateway] 网关启动失败", error);
      if (this.restartAttempts < this.maxRestartAttempts) {
        this.restartAttempts++;
        this.log.warn(`[OpenClawGateway] 启动失败，正在进行第 ${this.restartAttempts} 次重试...`);
        await new Promise((resolve) => setTimeout(resolve, 2e3));
        return this.start({ ...options, isRetry: true });
      }
      return { success: false, error: error.message };
    }
  }
  /**
   * 停止网关
   */
  async stop() {
    this.state = "stopping";
    this.broadcastStatus();
    this.stopHealthCheck();
    try {
      await this.getServer().stop();
      this.state = "stopped";
      this.pid = null;
      this.startTime = null;
      this.broadcastStatus();
      this.log.info("[OpenClawGateway] 网关已停止");
      return { success: true };
    } catch (error) {
      this.log.error("[OpenClawGateway] 停止网关失败", error);
      this.state = "stopped";
      this.broadcastStatus();
      return { success: false };
    }
  }
  /**
   * 重启网关
   */
  async restart() {
    this.log.info("[OpenClawGateway] 正在重启网关...");
    await this.stop();
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    return this.start();
  }
  /**
   * 一键修复网关
   */
  async repair() {
    this.log.info("[OpenClawGateway] 正在执行一键修复...");
    try {
      await this.stop();
      this.restartAttempts = 0;
      this.lastError = null;
      return await this.start();
    } catch (error) {
      this.log.error("[OpenClawGateway] 修复网关失败", error);
      return { success: false, error: error.message };
    }
  }
  /**
   * 获取网关状态
   */
  getStatus() {
    return {
      state: this.state,
      port: this.port,
      pid: this.pid,
      startTime: this.startTime,
      error: this.lastError,
      version: "1.0.0"
    };
  }
  /**
   * 健康检查
   */
  startHealthCheck() {
    this.stopHealthCheck();
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, 3e4);
  }
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
  async checkHealth() {
    if (this.state !== "running") return;
    if (!this.getServer().isRunning()) {
      this.log.warn("[OpenClawGateway] 检测到网关异常停止，正在尝试自动重启...");
      await this.restart();
    }
  }
  /**
   * 广播状态到前端
   */
  broadcastStatus() {
    const status = this.getStatus();
    const windows = electron.BrowserWindow.getAllWindows();
    windows.forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send("gateway:onStatusChange", { info: status });
      }
    });
  }
  /**
   * 预校验操作权限
   */
  checkPermission(request) {
    const { operationType, resource } = request;
    const permConfig = PERMISSION_MAP[operationType];
    this.log.info(`[OpenClawGateway] 权限校验: ${operationType}, 资源: ${resource || "N/A"}`);
    const result = this.permissionManager.checkPermission({
      category: permConfig.category,
      action: permConfig.action,
      resource
    });
    const guidance = result.allowed ? void 0 : `请在权限管理中启用「${permConfig.category}」的「${permConfig.action}」权限`;
    return {
      allowed: result.allowed,
      category: permConfig.category,
      action: permConfig.action,
      resource,
      reason: result.reason,
      guidance
    };
  }
  /**
   * 超时执行函数
   */
  async executeWithTimeout(promise, timeoutMs, timeoutMessage) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage, { cause: { guidance: "执行时间过长，可能是文件太大或系统响应慢，请稍后重试" } }));
      }, timeoutMs);
    });
    try {
      const result = await Promise.race([promise, timeoutPromise]);
      return result;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
  /**
   * 格式化错误消息，提供友好的用户提示
   */
  formatErrorMessage(error, operationType) {
    var _a, _b, _c, _d;
    let message = "操作执行失败";
    let guidance;
    let errorCode = "OPERATION_FAILED";
    if (error.code === "EACCES") {
      message = "权限不足：没有执行该操作的权限";
      guidance = "请在权限设置中启用相应的权限";
      errorCode = "PERMISSION_DENIED";
    } else if (error.code === "ENOENT") {
      message = "路径不存在：无法找到该文件或目录";
      guidance = "请检查路径是否正确";
      errorCode = "PATH_NOT_FOUND";
    } else if (error.code === "EEXIST") {
      message = "文件已存在";
      guidance = "请使用其他文件名或删除现有文件";
      errorCode = "FILE_EXISTS";
    } else if (error.code === "ENOSPC") {
      message = "磁盘空间不足";
      guidance = "请清理磁盘空间后重试";
      errorCode = "DISK_FULL";
    } else if (((_a = error.message) == null ? void 0 : _a.includes("timeout")) || ((_b = error.message) == null ? void 0 : _b.includes("超时"))) {
      message = error.message;
      guidance = ((_c = error.cause) == null ? void 0 : _c.guidance) || "执行超时，请稍后重试";
      errorCode = "TIMEOUT";
    } else if ((_d = error.cause) == null ? void 0 : _d.guidance) {
      message = error.message;
      guidance = error.cause.guidance;
      errorCode = "OPERATION_FAILED";
    } else {
      message = error.message || "操作执行失败";
    }
    return { message, guidance, errorCode };
  }
  /**
   * 执行单步操作
   */
  async executeOperation(request) {
    const { operationType, params, operationId } = request;
    const id = operationId || `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const TIMEOUT_MS = 3e4;
    this.log.info(`[OpenClawGateway] 开始执行操作: ${operationType}, ID: ${id}`);
    this.log.debug("[OpenClawGateway] 操作参数:", params);
    const permCheck = this.checkPermission({
      operationType,
      resource: (params == null ? void 0 : params.path) || (params == null ? void 0 : params.resource)
    });
    if (!permCheck.allowed) {
      const result = {
        success: false,
        operationType,
        operationId: id,
        status: "failed",
        error: `权限不足：${permCheck.reason}`,
        errorCode: "PERMISSION_DENIED",
        guidance: permCheck.guidance,
        duration: Date.now() - startTime,
        startTime,
        endTime: Date.now(),
        permissionCheck: permCheck
      };
      this.logAudit(result);
      this.log.error(`[OpenClawGateway] 权限被拒绝: ${operationType}`);
      return result;
    }
    try {
      let resultData;
      const operationPromise = (async () => {
        switch (operationType) {
          case "read_file":
            return await this.readFile(params);
          case "write_file":
          case "create_file":
            return await this.writeFile(params);
          case "delete_file":
            return await this.deleteFile(params);
          case "rename_file":
            return await this.renameFile(params);
          case "list_directory":
            return await this.listDirectory(params);
          case "create_directory":
            return await this.createDirectory(params);
          case "delete_directory":
            return await this.deleteDirectory(params);
          case "file_exists":
            return this.fileExists(params);
          case "run_command":
            return await this.runCommand(params);
          case "open_url":
            return await this.openUrl(params);
          case "clipboard_read":
            return this.readClipboard();
          case "clipboard_write":
            return this.writeClipboard(params);
          case "browser_open":
            return await this.openBrowser(params);
          case "browser_navigate":
            return await this.navigateBrowser(params);
          case "browser_click":
            return await this.clickBrowser(params);
          case "browser_type":
            return await this.typeBrowser(params);
          case "browser_get_text":
            return await this.getBrowserText(params);
          case "browser_wait_for":
            return await this.waitBrowserElement(params);
          case "browser_screenshot":
            return await this.takeScreenshot(params);
          default:
            throw new Error(`不支持的操作类型: ${operationType}`);
        }
      })();
      resultData = await this.executeWithTimeout(
        operationPromise,
        TIMEOUT_MS,
        `执行超时：${operationType}操作超过30秒未完成`
      );
      const result = {
        success: true,
        operationType,
        operationId: id,
        status: "success",
        result: resultData,
        duration: Date.now() - startTime,
        startTime,
        endTime: Date.now(),
        permissionCheck: permCheck
      };
      this.logAudit(result);
      this.log.info(`[OpenClawGateway] 操作执行成功: ${operationType}, 耗时: ${result.duration}ms`);
      return result;
    } catch (error) {
      const { message, guidance, errorCode } = this.formatErrorMessage(error, operationType);
      const result = {
        success: false,
        operationType,
        operationId: id,
        status: "failed",
        error: message,
        errorCode,
        guidance,
        duration: Date.now() - startTime,
        startTime,
        endTime: Date.now(),
        permissionCheck: permCheck
      };
      this.logAudit(result);
      this.log.error(`[OpenClawGateway] 操作执行失败: ${operationType}`, error);
      return result;
    }
  }
  /**
   * 记录审计日志
   */
  logAudit(result) {
    const entry = {
      id: result.operationId || `audit_${Date.now()}`,
      timestamp: Date.now(),
      operationType: result.operationType,
      params: {},
      // 简化记录
      result
    };
    this.auditLogs.push(entry);
    if (this.auditLogs.length > 1e3) {
      this.auditLogs = this.auditLogs.slice(-1e3);
    }
    this.log.debug("[OpenClawGateway] 审计日志已记录", entry);
  }
  /**
   * 获取审计日志
   */
  getAuditLogs(limit = 100) {
    return [...this.auditLogs].slice(-limit);
  }
  // ========== 文件系统操作 ==========
  async readFile(params) {
    const { path: filePath, encoding = "utf-8" } = params;
    const resolvedPath = this.resolvePath(filePath);
    this.log.debug("[OpenClawGateway] 读取文件:", resolvedPath);
    return fs__namespace.promises.readFile(resolvedPath, encoding);
  }
  async writeFile(params) {
    const { path: filePath, content = "", encoding = "utf-8" } = params;
    const resolvedPath = this.resolvePath(filePath);
    this.log.info("[OpenClawGateway] writeFile 开始执行");
    this.log.debug("[OpenClawGateway] writeFile 原始 filePath:", filePath);
    this.log.debug("[OpenClawGateway] writeFile 解析后 resolvedPath:", resolvedPath);
    this.log.debug("[OpenClawGateway] writeFile content:", content);
    this.log.debug("[OpenClawGateway] writeFile content 长度:", content.length);
    this.log.debug("[OpenClawGateway] writeFile 完整 params:", params);
    const pathCheck = await this.checkPathWritable(resolvedPath);
    if (!pathCheck.writable) {
      this.log.error("[OpenClawGateway] writeFile 路径不可写:", pathCheck);
      throw new Error(pathCheck.error, { cause: { guidance: pathCheck.guidance } });
    }
    const dir = path__namespace.dirname(resolvedPath);
    this.log.debug("[OpenClawGateway] writeFile 确保目录存在:", dir);
    await fs__namespace.promises.mkdir(dir, { recursive: true });
    const ext = path__namespace.extname(resolvedPath).toLowerCase();
    if (ext === ".docx") {
      try {
        this.log.debug("[OpenClawGateway] writeFile 尝试创建 DOCX 文件");
        await this.createDocxFile(resolvedPath, content);
        return { filePath: resolvedPath, wasFallback: false };
      } catch (docxError) {
        this.log.warn("[OpenClawGateway] DOCX创建失败，降级为TXT:", docxError);
        const txtPath = resolvedPath.replace(/\.docx$/i, ".txt");
        await fs__namespace.promises.writeFile(txtPath, content, encoding);
        throw new Error(`DOCX生成失败，已自动保存为TXT文件：${txtPath}。原因：${docxError.message}`, {
          cause: {
            guidance: "您可以使用其他文本编辑器打开TXT文件，或尝试再次生成DOCX文件"
          }
        });
      }
    } else {
      this.log.info("[OpenClawGateway] writeFile 执行 fs.promises.writeFile");
      this.log.debug("[OpenClawGateway] 写入内容:", content);
      await fs__namespace.promises.writeFile(resolvedPath, content, encoding);
      this.log.info("[OpenClawGateway] writeFile 写入成功!");
      return { filePath: resolvedPath, wasFallback: false };
    }
  }
  /**
   * 使用 docx 库创建 Word 文档
   */
  async createDocxFile(filePath, content) {
    const lines = content.split(/\r?\n/);
    const paragraphs = lines.map((line) => {
      if (!line.trim()) {
        return new docx.Paragraph("");
      }
      return new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: line,
            size: 24
            // 12pt
          })
        ]
      });
    });
    const doc = new docx.Document({
      sections: [{
        properties: {},
        children: paragraphs
      }]
    });
    const buffer = await docx.Packer.toBuffer(doc);
    await fs__namespace.promises.writeFile(filePath, buffer);
  }
  async deleteFile(params) {
    const { path: filePath } = params;
    const resolvedPath = this.resolvePath(filePath);
    this.log.debug("[OpenClawGateway] 删除文件:", resolvedPath);
    await fs__namespace.promises.unlink(resolvedPath);
  }
  async renameFile(params) {
    const { path: oldPath, newPath } = params;
    if (!newPath) throw new Error("缺少新路径参数");
    const resolvedOldPath = this.resolvePath(oldPath);
    const resolvedNewPath = this.resolvePath(newPath);
    const dir = path__namespace.dirname(resolvedNewPath);
    await fs__namespace.promises.mkdir(dir, { recursive: true });
    this.log.debug("[OpenClawGateway] 重命名文件:", resolvedOldPath, "→", resolvedNewPath);
    await fs__namespace.promises.rename(resolvedOldPath, resolvedNewPath);
  }
  async listDirectory(params) {
    const { path: dirPath } = params;
    const resolvedPath = this.resolvePath(dirPath);
    this.log.debug("[OpenClawGateway] 列出目录:", resolvedPath);
    return fs__namespace.promises.readdir(resolvedPath);
  }
  async createDirectory(params) {
    const { path: dirPath, recursive = true } = params;
    const resolvedPath = this.resolvePath(dirPath);
    this.log.debug("[OpenClawGateway] 创建目录:", resolvedPath);
    await fs__namespace.promises.mkdir(resolvedPath, { recursive });
  }
  async deleteDirectory(params) {
    const { path: dirPath, recursive = true } = params;
    const resolvedPath = this.resolvePath(dirPath);
    this.log.debug("[OpenClawGateway] 删除目录:", resolvedPath);
    await fs__namespace.promises.rm(resolvedPath, { recursive, force: true });
  }
  fileExists(params) {
    const { path: filePath } = params;
    const resolvedPath = this.resolvePath(filePath);
    return fs__namespace.existsSync(resolvedPath);
  }
  // ========== 系统操作 ==========
  async runCommand(params) {
    const { command, args = [], cwd, timeout = 3e4, shell: shell2 = true } = params;
    const baseCmd = command.split(" ")[0].toLowerCase();
    this.log.warn("[OpenClawGateway] 执行命令 (放宽限制):", baseCmd);
    const fullCommand = args.length > 0 ? `${command} ${args.join(" ")}` : command;
    this.log.debug("[OpenClawGateway] 执行命令:", fullCommand);
    const { stdout, stderr } = await execAsync(fullCommand, {
      cwd: cwd ? this.resolvePath(cwd) : void 0,
      timeout,
      shell: shell2
    });
    return { stdout, stderr };
  }
  async openUrl(params) {
    const { url: url2 } = params;
    if (!url2.startsWith("http://") && !url2.startsWith("https://")) {
      throw new Error("仅支持http/https协议的URL");
    }
    this.log.debug("[OpenClawGateway] 打开URL:", url2);
    await electron.shell.openExternal(url2);
  }
  readClipboard() {
    this.log.debug("[OpenClawGateway] 读取剪贴板");
    return electron.clipboard.readText();
  }
  writeClipboard(params) {
    const { text } = params;
    this.log.debug("[OpenClawGateway] 写入剪贴板");
    electron.clipboard.writeText(text);
  }
  // ========== 浏览器操作 ==========
  /**
   * 打开新浏览器会话
   */
  async openBrowser(params) {
    this.log.info("[OpenClawGateway] 打开浏览器");
    const sessionId = await this.browserManager.createSession();
    this.activeBrowserSessionId = sessionId;
    if (params.url) {
      await this.browserManager.navigate(sessionId, params.url);
    }
    return {
      sessionId,
      url: params.url || "about:blank"
    };
  }
  /**
   * 导航到网址
   */
  async navigateBrowser(params) {
    const sessionId = params.sessionId || this.activeBrowserSessionId;
    if (!sessionId) {
      throw new Error("没有活动的浏览器会话，请先调用 browser_open");
    }
    this.log.info("[OpenClawGateway] 导航到:", params.url);
    await this.browserManager.navigate(sessionId, params.url);
    const title = await this.browserManager.getTitle(sessionId);
    const url2 = await this.browserManager.getUrl(sessionId);
    return { title, url: url2 };
  }
  /**
   * 点击元素
   */
  async clickBrowser(params) {
    const sessionId = params.sessionId || this.activeBrowserSessionId;
    if (!sessionId) {
      throw new Error("没有活动的浏览器会话，请先调用 browser_open");
    }
    this.log.info("[OpenClawGateway] 点击元素:", params.selector);
    await this.browserManager.click(sessionId, params.selector);
  }
  /**
   * 输入文本
   */
  async typeBrowser(params) {
    const sessionId = params.sessionId || this.activeBrowserSessionId;
    if (!sessionId) {
      throw new Error("没有活动的浏览器会话，请先调用 browser_open");
    }
    this.log.info("[OpenClawGateway] 输入文本:", params.selector);
    await this.browserManager.type(sessionId, params.selector, params.text);
  }
  /**
   * 获取文本
   */
  async getBrowserText(params) {
    const sessionId = params.sessionId || this.activeBrowserSessionId;
    if (!sessionId) {
      throw new Error("没有活动的浏览器会话，请先调用 browser_open");
    }
    const text = await this.browserManager.getText(sessionId, params.selector);
    return { text };
  }
  /**
   * 等待元素
   */
  async waitBrowserElement(params) {
    const sessionId = params.sessionId || this.activeBrowserSessionId;
    if (!sessionId) {
      throw new Error("没有活动的浏览器会话，请先调用 browser_open");
    }
    this.log.info("[OpenClawGateway] 等待元素:", params.selector);
    await this.browserManager.waitForSelector(sessionId, params.selector, params.timeout);
  }
  /**
   * 截图
   */
  async takeScreenshot(params) {
    const sessionId = params.sessionId || this.activeBrowserSessionId;
    if (!sessionId) {
      throw new Error("没有活动的浏览器会话，请先调用 browser_open");
    }
    this.log.info("[OpenClawGateway] 截图");
    await this.browserManager.screenshot(sessionId, params.path);
    return {
      path: params.path,
      saved: !!params.path
    };
  }
  // ========== 工具方法 ==========
  /**
   * 检查路径是否可写
   */
  async checkPathWritable(filePath) {
    try {
      const dir = path__namespace.dirname(filePath);
      await fs__namespace.promises.mkdir(dir, { recursive: true });
      const testPath = path__namespace.join(dir, `.write_test_${Date.now()}`);
      await fs__namespace.promises.writeFile(testPath, "test");
      await fs__namespace.promises.unlink(testPath);
      return { writable: true };
    } catch (error) {
      if (error.code === "EACCES") {
        return {
          writable: false,
          error: "权限不足：没有写入该路径的权限",
          guidance: "请检查文件或文件夹的权限设置，或尝试使用其他路径"
        };
      } else if (error.code === "ENOENT") {
        return {
          writable: false,
          error: "路径不存在：无法找到该目录",
          guidance: "请确保路径正确，或使用其他路径"
        };
      } else {
        return {
          writable: false,
          error: `路径不可写：${error.message}`,
          guidance: "请检查路径是否正确，或尝试使用其他路径"
        };
      }
    }
  }
  /**
   * 解析路径，支持~和平台兼容，特别是桌面路径
   */
  resolvePath(inputPath) {
    let resolved = inputPath;
    if (resolved.startsWith("~")) {
      const home = process.env.HOME || process.env.USERPROFILE || "";
      resolved = path__namespace.join(home, resolved.slice(1));
    }
    const desktopPrefixes = ["桌面/", "Desktop/", "desktop/"];
    for (const prefix of desktopPrefixes) {
      if (resolved.startsWith(prefix)) {
        try {
          const desktopPath = electron.app.getPath("desktop");
          resolved = path__namespace.join(desktopPath, resolved.slice(prefix.length));
          break;
        } catch {
        }
      }
    }
    if (!path__namespace.isAbsolute(resolved)) {
      const docs = process.env.DOCUMENTS || process.env.USERPROFILE ? path__namespace.join(process.env.USERPROFILE, "Documents") : process.env.HOME ? path__namespace.join(process.env.HOME, "Documents") : process.cwd();
      resolved = path__namespace.join(docs, resolved);
    }
    resolved = path__namespace.normalize(resolved);
    this.log.debug("[OpenClawGateway] 路径解析:", inputPath, "→", resolved);
    return resolved;
  }
}
class TaskExecutor {
  constructor() {
    this.log = LogManager.getInstance();
    this.gateway = OpenClawGateway.getInstance();
    this.log.info("[TaskExecutor] 初始化");
  }
  static getInstance() {
    if (!TaskExecutor.instance) {
      TaskExecutor.instance = new TaskExecutor();
    }
    return TaskExecutor.instance;
  }
  /**
   * 执行完整任务
   */
  async executeTask(task) {
    const startTime = Date.now();
    this.log.info(`[TaskExecutor] 开始执行任务: ${task.instruction}`);
    const steps = task.steps;
    const results = [];
    let allSuccess = true;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step.description) {
        switch (step.type) {
          case "write_file":
            step.description = "写入文件";
            break;
          case "read_file":
            step.description = "读取文件";
            break;
          case "create_file":
            step.description = "创建文件";
            break;
          case "delete_file":
            step.description = "删除文件";
            break;
          case "list_directory":
            step.description = "列出目录";
            break;
          case "create_directory":
            step.description = "创建目录";
            break;
          case "delete_directory":
            step.description = "删除目录";
            break;
          case "rename_file":
            step.description = "重命名文件";
            break;
          default:
            step.description = "执行操作";
            break;
        }
      }
      this.log.info(`[TaskExecutor] 执行步骤 ${i + 1}/${steps.length}: ${step.description}`);
      try {
        const result = await this.executeStep(step);
        results.push({
          status: "success",
          result
        });
      } catch (error) {
        this.log.error(`[TaskExecutor] 步骤失败: ${error}`);
        allSuccess = false;
        results.push({
          status: "failed",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    const duration = Date.now() - startTime;
    const summary = allSuccess ? "任务执行完成" : "任务部分执行失败";
    this.log.info(`[TaskExecutor] 任务完成，耗时 ${duration}ms`);
    return {
      success: allSuccess,
      summary,
      result: { steps: results },
      duration
    };
  }
  /**
   * 执行单个步骤
   */
  async executeStep(step) {
    const params = step.params;
    this.log.debug("[TaskExecutor] 原始 step.params:", JSON.stringify(params));
    switch (step.type) {
      case "write_file": {
        this.log.debug("[TaskExecutor] write_file 准备执行");
        return await this.gateway.executeOperation({
          operationType: "write_file",
          params: {
            path: params.filePath || params.path,
            content: params.content
          }
        });
      }
      case "read_file": {
        this.log.debug("[TaskExecutor] read_file 准备执行");
        return await this.gateway.executeOperation({
          operationType: "read_file",
          params: {
            path: params.filePath || params.path
          }
        });
      }
      case "delete_file": {
        this.log.debug("[TaskExecutor] delete_file 准备执行");
        return await this.gateway.executeOperation({
          operationType: "delete_file",
          params: {
            path: params.filePath || params.path
          }
        });
      }
      case "list_directory": {
        this.log.debug("[TaskExecutor] list_directory 准备执行");
        return await this.gateway.executeOperation({
          operationType: "list_directory",
          params: {
            path: params.directoryPath || params.path
          }
        });
      }
      case "run_command": {
        this.log.debug("[TaskExecutor] run_command 准备执行");
        return await this.gateway.executeOperation({
          operationType: "run_command",
          params: {
            command: params.command,
            cwd: params.cwd
          }
        });
      }
      case "open_url": {
        this.log.debug("[TaskExecutor] open_url 准备执行");
        return await this.gateway.executeOperation({
          operationType: "open_url",
          params: {
            url: params.url
          }
        });
      }
      case "create_file": {
        this.log.debug("[TaskExecutor] create_file 准备执行");
        return await this.gateway.executeOperation({
          operationType: "create_file",
          params: {
            path: params.filePath || params.path,
            content: params.content
          }
        });
      }
      case "rename_file": {
        this.log.debug("[TaskExecutor] rename_file 准备执行");
        return await this.gateway.executeOperation({
          operationType: "rename_file",
          params: {
            path: params.filePath || params.path,
            newPath: params.newPath
          }
        });
      }
      case "create_directory": {
        this.log.debug("[TaskExecutor] create_directory 准备执行");
        return await this.gateway.executeOperation({
          operationType: "create_directory",
          params: {
            path: params.directoryPath || params.path
          }
        });
      }
      case "delete_directory": {
        this.log.debug("[TaskExecutor] delete_directory 准备执行");
        return await this.gateway.executeOperation({
          operationType: "delete_directory",
          params: {
            path: params.directoryPath || params.path
          }
        });
      }
      case "file_exists": {
        this.log.debug("[TaskExecutor] file_exists 准备执行");
        return await this.gateway.executeOperation({
          operationType: "file_exists",
          params: {
            path: params.filePath || params.path
          }
        });
      }
      case "clipboard_read": {
        this.log.debug("[TaskExecutor] clipboard_read 准备执行");
        return await this.gateway.executeOperation({
          operationType: "clipboard_read",
          params: {}
        });
      }
      case "clipboard_write": {
        this.log.debug("[TaskExecutor] clipboard_write 准备执行");
        return await this.gateway.executeOperation({
          operationType: "clipboard_write",
          params: {
            text: params.text
          }
        });
      }
      case "browser_open": {
        this.log.debug("[TaskExecutor] browser_open 准备执行");
        return await this.gateway.executeOperation({
          operationType: "browser_open",
          params: {
            url: params.url
          }
        });
      }
      case "browser_navigate": {
        this.log.debug("[TaskExecutor] browser_navigate 准备执行");
        return await this.gateway.executeOperation({
          operationType: "browser_navigate",
          params: {
            url: params.url,
            sessionId: params.sessionId
          }
        });
      }
      case "browser_click": {
        this.log.debug("[TaskExecutor] browser_click 准备执行");
        return await this.gateway.executeOperation({
          operationType: "browser_click",
          params: {
            selector: params.selector,
            sessionId: params.sessionId
          }
        });
      }
      case "browser_type": {
        this.log.debug("[TaskExecutor] browser_type 准备执行");
        return await this.gateway.executeOperation({
          operationType: "browser_type",
          params: {
            selector: params.selector,
            text: params.text,
            sessionId: params.sessionId
          }
        });
      }
      case "browser_get_text": {
        this.log.debug("[TaskExecutor] browser_get_text 准备执行");
        return await this.gateway.executeOperation({
          operationType: "browser_get_text",
          params: {
            selector: params.selector,
            sessionId: params.sessionId
          }
        });
      }
      case "browser_wait_for": {
        this.log.debug("[TaskExecutor] browser_wait_for 准备执行");
        return await this.gateway.executeOperation({
          operationType: "browser_wait_for",
          params: {
            selector: params.selector,
            timeout: params.timeout,
            sessionId: params.sessionId
          }
        });
      }
      case "browser_screenshot": {
        this.log.debug("[TaskExecutor] browser_screenshot 准备执行");
        return await this.gateway.executeOperation({
          operationType: "browser_screenshot",
          params: {
            path: params.path,
            sessionId: params.sessionId
          }
        });
      }
      default:
        throw new Error(`不支持的操作类型: ${step.type}`);
    }
  }
  /**
   * 获取可用工具（保留接口）
   */
  getAvailableTools() {
    return [
      { name: "write_file", description: "写入文件" },
      { name: "read_file", description: "读取文件" },
      { name: "delete_file", description: "删除文件" },
      { name: "list_directory", description: "列出目录" },
      { name: "run_command", description: "运行命令" },
      { name: "open_url", description: "打开URL" },
      { name: "create_file", description: "创建文件" },
      { name: "rename_file", description: "重命名文件" },
      { name: "create_directory", description: "创建目录" },
      { name: "delete_directory", description: "删除目录" },
      { name: "file_exists", description: "检查文件是否存在" },
      { name: "clipboard_read", description: "读取剪贴板" },
      { name: "clipboard_write", description: "写入剪贴板" },
      { name: "browser_open", description: "打开浏览器" },
      { name: "browser_navigate", description: "导航到URL" },
      { name: "browser_click", description: "点击元素" },
      { name: "browser_type", description: "输入文本" },
      { name: "browser_get_text", description: "获取文本" },
      { name: "browser_wait_for", description: "等待元素" },
      { name: "browser_screenshot", description: "截图" }
    ];
  }
  /**
   * 检查网关状态
   */
  isGatewayRunning() {
    const status = this.gateway.getStatus();
    return status.state === "running";
  }
}
class SelfLearner {
  constructor() {
    this.log = LogManager.getInstance();
    this.configStore = ConfigStore.getInstance();
    this.skillLoader = SkillLoader.getInstance();
    this.modelManager = ModelManager.getInstance();
    this.observations = [];
    this.pendingProposal = null;
    this.analysisInProgress = false;
    this.learningDir = path__namespace.join(electron.app.getPath("userData"), "hermes-learning");
    this.ensureLearningDir();
    this.loadObservations();
  }
  static getInstance() {
    if (!SelfLearner.instance) {
      SelfLearner.instance = new SelfLearner();
    }
    return SelfLearner.instance;
  }
  ensureLearningDir() {
    if (!fs__namespace.existsSync(this.learningDir)) {
      fs__namespace.mkdirSync(this.learningDir, { recursive: true });
      this.log.info("[SelfLearner] 创建学习数据目录", { path: this.learningDir });
    }
  }
  loadObservations() {
    try {
      const observationsPath = path__namespace.join(this.learningDir, "observations.json");
      if (fs__namespace.existsSync(observationsPath)) {
        const data = JSON.parse(fs__namespace.readFileSync(observationsPath, "utf-8"));
        this.observations = data;
        this.log.info("[SelfLearner] 加载观察记录成功", { count: this.observations.length });
      }
    } catch (error) {
      this.log.error("[SelfLearner] 加载观察记录失败", error);
    }
  }
  saveObservations() {
    try {
      const observationsPath = path__namespace.join(this.learningDir, "observations.json");
      fs__namespace.writeFileSync(observationsPath, JSON.stringify(this.observations, null, 2), "utf-8");
    } catch (error) {
      this.log.error("[SelfLearner] 保存观察记录失败", error);
    }
  }
  /**
   * 观察执行过程（简化版 - 只存入观察列表）
   */
  observeExecution(instruction, steps, result) {
    try {
      const normalizedInstruction = this.normalizeInstruction(instruction);
      const isDuplicate = this.observations.some(
        (obs) => this.normalizeInstruction(obs.instruction) === normalizedInstruction
      );
      if (isDuplicate) {
        this.log.info("[SelfLearner] 检测到重复指令，跳过观察", { instruction });
        return;
      }
      const observation = {
        id: `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        instruction,
        steps,
        timestamp: Date.now()
      };
      this.observations.push(observation);
      if (this.observations.length > 10) {
        this.observations.shift();
      }
      this.saveObservations();
      this.log.info("[SelfLearner] 观察到执行", {
        instruction,
        observationCount: this.observations.length
      });
      if (this.observations.length >= 3 && !this.analysisInProgress) {
        this.analyzeAndGenerateSkill();
      }
    } catch (error) {
      this.log.error("[SelfLearner] 观察执行失败", error);
    }
  }
  /**
   * 标准化指令（忽略大小写和标点符号，保留语义差异）
   */
  normalizeInstruction(instruction) {
    return instruction.toLowerCase().replace(/[.!,?;:'"()]/g, "").replace(/\s+/g, " ").trim();
  }
  /**
   * 分析观察数据并生成技能（大模型驱动）
   */
  async analyzeAndGenerateSkill() {
    if (this.analysisInProgress) {
      return;
    }
    this.analysisInProgress = true;
    try {
      this.log.info("[SelfLearner] 开始分析用户行为模式");
      const recentObservations = this.observations.slice(-3);
      const prompt = this.buildAnalysisPrompt(recentObservations);
      const analysisResult = await this.callModelForAnalysis(prompt);
      if (analysisResult) {
        const proposal = this.generateSkillProposalFromAnalysis(
          analysisResult,
          recentObservations[recentObservations.length - 1]
        );
        if (proposal) {
          const isDuplicate = await this.checkDuplicateSkill(proposal);
          if (isDuplicate) {
            this.log.info("[SelfLearner] 检测到重复技能，放弃提案", { name: proposal.name });
            return;
          }
          this.pendingProposal = proposal;
          this.log.info("[SelfLearner] 技能提案生成成功", {
            name: proposal.name,
            triggerCondition: proposal.triggerCondition
          });
          this.notifyFrontend(proposal);
        }
      }
    } catch (error) {
      this.log.error("[SelfLearner] 分析失败", error);
    } finally {
      this.analysisInProgress = false;
    }
  }
  /**
   * 构建分析提示词
   */
  buildAnalysisPrompt(observations) {
    let prompt = "你是专业的AI行为分析师。以下用户连续执行了3个操作：\n\n";
    observations.forEach((obs, index) => {
      prompt += `${index + 1}. ${obs.instruction}
`;
    });
    prompt += "\n请分析：这些操作的共同模式是什么？背后的用户意图是什么？\n";
    prompt += "提炼出一个通用的技能，以JSON格式返回，字段：\n";
    prompt += "- name: 技能名称（简洁描述）\n";
    prompt += "- description: 详细描述\n";
    prompt += "- triggerCondition: 语义描述的触发条件（什么情况下用户会想使用这个技能）\n";
    prompt += "- keywords: 关键词数组（3-5个）\n";
    prompt += "\n只返回JSON，不要包含markdown代码块标记。";
    return prompt;
  }
  /**
   * 调用大模型进行分析
   */
  async callModelForAnalysis(prompt) {
    var _a;
    try {
      const enabledProviders = this.modelManager.getEnabledProviders();
      if (enabledProviders.length === 0) {
        this.log.warn("[SelfLearner] 没有启用的模型提供商");
        return null;
      }
      const provider = enabledProviders[0];
      const modelId = provider.defaultModel || ((_a = provider.models[0]) == null ? void 0 : _a.id);
      if (!modelId) {
        this.log.warn("[SelfLearner] 没有可用的模型");
        return null;
      }
      this.log.info("[SelfLearner] 调用大模型分析行为模式", {
        provider: provider.name,
        model: modelId
      });
      const response = await this.makeChatCompletionRequest(provider, modelId, prompt);
      if (response) {
        const analysisResult = this.parseModelResponse(response);
        return analysisResult;
      }
    } catch (error) {
      this.log.error("[SelfLearner] 调用大模型失败", error);
    }
    return null;
  }
  /**
   * 发起聊天补全请求
   */
  async makeChatCompletionRequest(provider, modelId, prompt) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Request timeout"));
      }, provider.timeout || 6e4);
      let req;
      try {
        switch (provider.type) {
          case "openai":
          case "deepseek":
          case "custom": {
            const url$1 = new url.URL("/v1/chat/completions", provider.baseUrl);
            const protocol = url$1.protocol === "https:" ? https : http;
            const headers = {
              "Content-Type": "application/json"
            };
            if (provider.apiKey) {
              headers["Authorization"] = `Bearer ${provider.apiKey}`;
            }
            const body = JSON.stringify({
              model: modelId,
              messages: [{ role: "user", content: prompt }],
              temperature: 0.3,
              max_tokens: 500
            });
            req = protocol.request(url$1, { method: "POST", headers }, (res) => {
              let data = "";
              res.on("data", (chunk) => {
                data += chunk;
              });
              res.on("end", () => {
                var _a, _b, _c;
                clearTimeout(timeout);
                try {
                  const parsed = JSON.parse(data);
                  if ((_c = (_b = (_a = parsed.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content) {
                    resolve(parsed.choices[0].message.content);
                  } else {
                    resolve(null);
                  }
                } catch {
                  resolve(null);
                }
              });
            });
            req.write(body);
            break;
          }
          case "anthropic": {
            const url$1 = new url.URL("/v1/messages", provider.baseUrl);
            const protocol = url$1.protocol === "https:" ? https : http;
            const headers = {
              "Content-Type": "application/json",
              "x-api-key": provider.apiKey || "",
              "anthropic-version": "2023-06-01",
              "anthropic-dangerous-direct-browser-access": "true"
            };
            const body = JSON.stringify({
              model: modelId,
              max_tokens: 500,
              messages: [{ role: "user", content: prompt }],
              temperature: 0.3
            });
            req = protocol.request(url$1, { method: "POST", headers }, (res) => {
              let data = "";
              res.on("data", (chunk) => {
                data += chunk;
              });
              res.on("end", () => {
                var _a, _b;
                clearTimeout(timeout);
                try {
                  const parsed = JSON.parse(data);
                  if ((_b = (_a = parsed.content) == null ? void 0 : _a[0]) == null ? void 0 : _b.text) {
                    resolve(parsed.content[0].text);
                  } else {
                    resolve(null);
                  }
                } catch {
                  resolve(null);
                }
              });
            });
            req.write(body);
            break;
          }
          case "azure": {
            const deploymentName = provider.deploymentName || modelId;
            const url$1 = new url.URL(
              `/openai/deployments/${deploymentName}/chat/completions?api-version=${provider.apiVersion || "2024-02-01"}`,
              provider.baseUrl
            );
            const protocol = url$1.protocol === "https:" ? https : http;
            const headers = {
              "Content-Type": "application/json",
              "api-key": provider.apiKey || ""
            };
            const body = JSON.stringify({
              messages: [{ role: "user", content: prompt }],
              temperature: 0.3,
              max_tokens: 500
            });
            req = protocol.request(url$1, { method: "POST", headers }, (res) => {
              let data = "";
              res.on("data", (chunk) => {
                data += chunk;
              });
              res.on("end", () => {
                var _a, _b, _c;
                clearTimeout(timeout);
                try {
                  const parsed = JSON.parse(data);
                  if ((_c = (_b = (_a = parsed.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content) {
                    resolve(parsed.choices[0].message.content);
                  } else {
                    resolve(null);
                  }
                } catch {
                  resolve(null);
                }
              });
            });
            req.write(body);
            break;
          }
          case "ollama": {
            const url$1 = new url.URL("/api/chat", provider.baseUrl);
            const protocol = url$1.protocol === "https:" ? https : http;
            const headers = {
              "Content-Type": "application/json"
            };
            const body = JSON.stringify({
              model: modelId,
              messages: [{ role: "user", content: prompt }],
              stream: false,
              options: { temperature: 0.3, num_predict: 500 }
            });
            req = protocol.request(url$1, { method: "POST", headers }, (res) => {
              let data = "";
              res.on("data", (chunk) => {
                data += chunk;
              });
              res.on("end", () => {
                var _a;
                clearTimeout(timeout);
                try {
                  const parsed = JSON.parse(data);
                  if ((_a = parsed.message) == null ? void 0 : _a.content) {
                    resolve(parsed.message.content);
                  } else {
                    resolve(null);
                  }
                } catch {
                  resolve(null);
                }
              });
            });
            req.write(body);
            break;
          }
          default:
            clearTimeout(timeout);
            resolve(null);
            return;
        }
        req.on("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
        req.end();
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
  /**
   * 解析模型返回的响应
   */
  parseModelResponse(response) {
    try {
      let jsonStr = response.trim();
      if (jsonStr.startsWith("```json") || jsonStr.startsWith("```")) {
        const startIdx = jsonStr.indexOf("{");
        const endIdx = jsonStr.lastIndexOf("}");
        if (startIdx !== -1 && endIdx !== -1) {
          jsonStr = jsonStr.substring(startIdx, endIdx + 1);
        }
      }
      const parsed = JSON.parse(jsonStr);
      return {
        name: parsed.name || "自动学习技能",
        description: parsed.description || "",
        triggerCondition: parsed.triggerCondition || "",
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : []
      };
    } catch (error) {
      this.log.error("[SelfLearner] 解析模型响应失败", error);
      return null;
    }
  }
  /**
   * 从分析结果生成技能提案
   */
  generateSkillProposalFromAnalysis(analysisResult, lastObservation) {
    try {
      const skillId = `auto_${Date.now()}`;
      const operationSteps = this.extractOperationSteps(lastObservation.steps);
      const fullInstructions = this.generateFullSkillInstructions(
        analysisResult,
        lastObservation.instruction,
        operationSteps
      );
      const proposal = {
        id: skillId,
        name: analysisResult.name,
        description: analysisResult.description,
        triggerCondition: analysisResult.triggerCondition,
        keywords: analysisResult.keywords,
        operationSteps,
        fullInstructions,
        createdAt: Date.now()
      };
      return proposal;
    } catch (error) {
      this.log.error("[SelfLearner] 生成技能提案失败", error);
      return null;
    }
  }
  /**
   * 从执行步骤中提取描述
   */
  extractOperationSteps(steps) {
    return steps.map((step) => step.description || `执行 ${step.type}`);
  }
  /**
   * 生成完整的技能文档
   */
  generateFullSkillInstructions(analysisResult, example, steps) {
    let instructions = `# ${analysisResult.name}

`;
    instructions += `## 描述
${analysisResult.description}

`;
    instructions += `## 触发条件
${analysisResult.triggerCondition}

`;
    instructions += `## 关键词
`;
    analysisResult.keywords.forEach((keyword) => {
      instructions += `- ${keyword}
`;
    });
    instructions += "\n## 操作步骤\n";
    steps.forEach((step, index) => {
      instructions += `${index + 1}. ${step}
`;
    });
    instructions += `
## 示例
${example}
`;
    return instructions;
  }
  /**
   * 通知前端有新的技能提案
   */
  notifyFrontend(proposal) {
    try {
      const windows = electron.BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        if (!window.isDestroyed()) {
          window.webContents.send("skills:new-proposal", proposal);
        }
      });
      this.log.info("[SelfLearner] 已通知前端技能提案");
    } catch (error) {
      this.log.error("[SelfLearner] 通知前端失败", error);
    }
  }
  /**
   * 语义匹配检查（判断新指令是否触发已保存技能）
   */
  async checkSkillMatch(userInstruction, skillName, triggerCondition) {
    var _a;
    try {
      const enabledProviders = this.modelManager.getEnabledProviders();
      if (enabledProviders.length === 0) {
        return false;
      }
      const provider = enabledProviders[0];
      const modelId = provider.defaultModel || ((_a = provider.models[0]) == null ? void 0 : _a.id);
      if (!modelId) {
        return false;
      }
      const prompt = `当前用户指令：${userInstruction}

已保存技能"${skillName}"的触发条件：${triggerCondition}

请问：当前用户指令是否符合该技能的触发条件？只回答"是"或"否"。`;
      const response = await this.makeChatCompletionRequest(provider, modelId, prompt);
      if (response) {
        const normalized = response.toLowerCase().trim();
        return normalized.includes("是") || normalized.includes("yes");
      }
    } catch (error) {
      this.log.error("[SelfLearner] 语义匹配失败", error);
    }
    return false;
  }
  /**
   * 检查新提案是否与现有技能重复
   */
  async checkDuplicateSkill(proposal) {
    var _a;
    try {
      const enabledProviders = this.modelManager.getEnabledProviders();
      if (enabledProviders.length === 0) {
        this.log.warn("[SelfLearner] 没有启用的模型，无法进行去重检查");
        return false;
      }
      const provider = enabledProviders[0];
      const modelId = provider.defaultModel || ((_a = provider.models[0]) == null ? void 0 : _a.id);
      if (!modelId) {
        return false;
      }
      const skills = this.skillLoader.getAllSkills();
      for (const existingSkill of skills) {
        const prompt = `当前提案的技能触发条件：${proposal.triggerCondition}

已安装技能"${existingSkill.name}"的触发条件：${existingSkill.triggerCondition || "无"}。

请判断：这两个触发条件描述的是否是同一种用户意图？只回答"是"或"否"。`;
        const response = await this.makeChatCompletionRequest(provider, modelId, prompt);
        if (response) {
          const normalized = response.toLowerCase().trim();
          if (normalized.includes("是") || normalized.includes("yes")) {
            this.log.info("[SelfLearner] 发现重复技能", {
              existingSkillName: existingSkill.name,
              proposalName: proposal.name
            });
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      this.log.error("[SelfLearner] 去重检查失败", error);
      return false;
    }
  }
  /**
   * 从提案保存技能
   * @returns { success: boolean; needsRestart: boolean }
   */
  saveSkillFromProposal(proposal) {
    let needsRestart = false;
    try {
      const skillsDir = path__namespace.join(electron.app.getAppPath(), "..", "skills");
      let skillDir = path__namespace.join(skillsDir, proposal.id);
      let dirCounter = 0;
      while (fs__namespace.existsSync(skillDir)) {
        dirCounter++;
        const suffix = dirCounter === 1 ? Date.now().toString() : `${Date.now()}_${dirCounter}`;
        skillDir = path__namespace.join(skillsDir, `${proposal.id}_${suffix}`);
        this.log.info("[SelfLearner] 技能目录已存在，使用新目录", { skillDir });
      }
      fs__namespace.mkdirSync(skillDir, { recursive: true });
      const skillMdPath = path__namespace.join(skillDir, "skill.md");
      fs__namespace.writeFileSync(skillMdPath, proposal.fullInstructions, "utf-8");
      try {
        const skillLoader = SkillLoader.getInstance();
        skillLoader.reloadSkills();
        this.log.info("[SelfLearner] 技能热加载成功");
      } catch (error) {
        this.log.warn("[SelfLearner] 技能热加载失败，需要重启", error);
        needsRestart = true;
      }
      this.log.info("[SelfLearner] 技能保存成功", { skillId: proposal.id, skillDir, name: proposal.name, needsRestart });
      this.pendingProposal = null;
      return { success: true, needsRestart };
    } catch (error) {
      this.log.error("[SelfLearner] 保存技能失败", error);
      return { success: false, needsRestart: false };
    }
  }
  /**
   * 获取待处理的提案
   */
  getPendingProposal() {
    return this.pendingProposal;
  }
  /**
   * 清除待处理提案
   */
  clearPendingProposal() {
    this.pendingProposal = null;
  }
  /**
   * 比较两个技能的相似度（公共方法）
   */
  async checkSkillSimilarity(name1, description1, name2, description2) {
    var _a;
    try {
      const enabledProviders = this.modelManager.getEnabledProviders();
      if (enabledProviders.length === 0) {
        this.log.warn("[SelfLearner] 没有启用的模型，无法进行相似度检查");
        return 0;
      }
      const provider = enabledProviders[0];
      const modelId = provider.defaultModel || ((_a = provider.models[0]) == null ? void 0 : _a.id);
      if (!modelId) {
        return 0;
      }
      const prompt = `请判断以下两个技能是否描述了相同或非常相似的用户意图？
请只回答0-100之间的数字表示相似度，100表示完全相同，0表示完全不同。

技能1名称：${name1}
技能1描述：${description1}

技能2名称：${name2}
技能2描述：${description2}
`;
      const response = await this.makeChatCompletionRequest(provider, modelId, prompt);
      if (response) {
        const match = response.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      }
      return 0;
    } catch (error) {
      this.log.error("[SelfLearner] 相似度检查失败", error);
      return 0;
    }
  }
  /**
   * 获取学习统计
   */
  getStats() {
    return {
      observationCount: this.observations.length,
      analysisInProgress: this.analysisInProgress ? 1 : 0
    };
  }
  /**
   * 重置学习统计
   */
  resetStats() {
    this.observations = [];
    this.pendingProposal = null;
    this.saveObservations();
    this.log.info("[SelfLearner] 学习统计已重置");
  }
  /**
   * [兼容] 保持原来的checkPatternThreshold接口（始终返回false）
   */
  checkPatternThreshold(fingerprint) {
    return false;
  }
  /**
   * [兼容] 保持原来的generateSkillProposal接口
   */
  generateSkillProposal(fingerprint) {
    return this.pendingProposal;
  }
}
class SkillLoader {
  constructor() {
    this.log = LogManager.getInstance();
    this.skills = /* @__PURE__ */ new Map();
    this._selfLearner = null;
    this.configStore = ConfigStore.getInstance();
    this.modelManager = ModelManager.getInstance();
    this.skillsDir = path__namespace.join(electron.app.getPath("userData"), "skills");
    const projectSkillsDir = path__namespace.join(electron.app.getAppPath(), "..", "skills");
    if (fs__namespace.existsSync(projectSkillsDir) && !fs__namespace.existsSync(this.skillsDir)) {
      this.log.info("[SkillLoader] 发现项目技能目录，正在复制到用户数据目录", {
        source: projectSkillsDir,
        dest: this.skillsDir
      });
      this.copyDirectory(projectSkillsDir, this.skillsDir);
    }
    this.ensureSkillsDir();
    this.loadAllSkills();
  }
  // 延迟加载 SelfLearner
  get selfLearner() {
    if (!this._selfLearner) {
      this._selfLearner = SelfLearner.getInstance();
    }
    return this._selfLearner;
  }
  static getInstance() {
    if (!SkillLoader.instance) {
      SkillLoader.instance = new SkillLoader();
    }
    return SkillLoader.instance;
  }
  ensureSkillsDir() {
    if (!fs__namespace.existsSync(this.skillsDir)) {
      fs__namespace.mkdirSync(this.skillsDir, { recursive: true });
      this.log.info("[SkillLoader] 创建技能目录", { path: this.skillsDir });
    }
  }
  copyDirectory(source, dest) {
    if (!fs__namespace.existsSync(dest)) {
      fs__namespace.mkdirSync(dest, { recursive: true });
    }
    const entries = fs__namespace.readdirSync(source, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path__namespace.join(source, entry.name);
      const destPath = path__namespace.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs__namespace.copyFileSync(srcPath, destPath);
      }
    }
    this.log.info("[SkillLoader] 目录复制完成", { source, dest });
  }
  loadAllSkills() {
    this.log.info("[SkillLoader] 开始加载技能...", { path: this.skillsDir });
    try {
      const skillDirs = fs__namespace.readdirSync(this.skillsDir, { withFileTypes: true }).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
      this.log.info("[SkillLoader] 发现技能目录", { count: skillDirs.length });
      for (const skillDir of skillDirs) {
        this.loadSkill(skillDir);
      }
      this.log.info("[SkillLoader] 技能加载完成", { count: this.skills.size });
    } catch (error) {
      this.log.error("[SkillLoader] 加载技能失败", error);
    }
  }
  loadSkill(skillDir) {
    const skillPath = path__namespace.join(this.skillsDir, skillDir);
    const skillMdPath = path__namespace.join(skillPath, "skill.md");
    if (!fs__namespace.existsSync(skillMdPath)) {
      this.log.warn("[SkillLoader] 技能文件不存在", { skillDir, path: skillMdPath });
      return;
    }
    try {
      const content = fs__namespace.readFileSync(skillMdPath, "utf-8");
      const fileSize = Buffer.byteLength(content, "utf-8");
      const skill = this.parseSkillMd(skillDir, content);
      if (skill) {
        const skillStates = this.configStore.get("skills.states") || {};
        const savedState = skillStates[skill.id] || {};
        this.skills.set(skill.id, {
          ...skill,
          enabled: savedState.enabled !== false,
          // 默认启用
          usageCount: savedState.usageCount || 0,
          successRate: savedState.successRate || 100,
          fileSize
        });
        this.log.info("[SkillLoader] 加载技能成功", { id: skill.id, name: skill.name, fileSize });
      }
    } catch (error) {
      this.log.error("[SkillLoader] 解析技能失败", { skillDir, error });
    }
  }
  parseSkillMd(skillId, content) {
    try {
      const lines = content.split("\n");
      let name = skillId;
      let description = "";
      const triggerKeywords = [];
      const operationSteps = [];
      let currentSection = "";
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("# ")) {
          name = line.substring(2).trim();
        } else if (line.startsWith("## 描述")) {
          currentSection = "description";
        } else if (line.startsWith("## 触发关键词")) {
          currentSection = "keywords";
        } else if (line.startsWith("## 操作步骤")) {
          currentSection = "steps";
        } else if (line && !line.startsWith("##")) {
          if (currentSection === "description" && line) {
            description += (description ? "\n" : "") + line;
          } else if (currentSection === "keywords") {
            const keyword = line.replace(/^[-*]\s*/, "").trim();
            if (keyword) {
              triggerKeywords.push(keyword);
            }
          } else if (currentSection === "steps") {
            const step = line.replace(/^\d+\.\s*/, "").replace(/^[-*]\s*/, "").trim();
            if (step) {
              operationSteps.push(step);
            }
          }
        }
      }
      if (triggerKeywords.length === 0) {
        this.log.warn("[SkillLoader] 技能缺少触发关键词", { skillId });
      }
      const fullInstructions = this.generateFullInstructions(name, description, operationSteps);
      return {
        id: skillId,
        name,
        description: description || skillId,
        triggerKeywords,
        operationSteps,
        fullInstructions
      };
    } catch (error) {
      this.log.error("[SkillLoader] 解析 skill.md 失败", { skillId, error });
      return null;
    }
  }
  generateFullInstructions(name, description, steps) {
    let instructions = `## ${name}

`;
    if (description) {
      instructions += `${description}

`;
    }
    instructions += "### 操作步骤:\n";
    steps.forEach((step, index) => {
      instructions += `${index + 1}. ${step}
`;
    });
    return instructions;
  }
  /**
   * 查找匹配的技能
   */
  findMatchingSkill(userMessage) {
    const lowerMessage = userMessage.toLowerCase();
    for (const skill of this.skills.values()) {
      for (const keyword of skill.triggerKeywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          return skill;
        }
      }
    }
    return null;
  }
  /**
   * 获取所有技能的摘要清单
   */
  getAllSkillSummaries() {
    if (this.skills.size === 0) {
      return "暂无可使用的技能";
    }
    let summary = "## 可用技能列表\n\n";
    let index = 1;
    for (const skill of this.skills.values()) {
      summary += `${index}. **${skill.name}**
`;
      summary += `   - 描述: ${skill.description}
`;
      summary += `   - 触发关键词: ${skill.triggerKeywords.join(", ")}

`;
      index++;
    }
    return summary;
  }
  /**
   * 获取所有加载的技能
   */
  getAllSkills() {
    return Array.from(this.skills.values());
  }
  /**
   * 重新加载所有技能
   */
  reloadSkills() {
    this.skills.clear();
    this.loadAllSkills();
  }
  /**
   * 切换技能的启用状态
   */
  toggleSkill(skillId, enabled) {
    const skill = this.skills.get(skillId);
    if (!skill) {
      this.log.warn("[SkillLoader] 技能不存在", { skillId });
      return false;
    }
    skill.enabled = enabled;
    this.saveSkillStates();
    this.log.info("[SkillLoader] 技能状态已更新", { skillId, enabled });
    return true;
  }
  /**
   * 记录技能使用
   */
  recordSkillUsage(skillId, success) {
    const skill = this.skills.get(skillId);
    if (!skill) return;
    skill.usageCount += 1;
    if (skill.usageCount > 0) {
      const successCount = (skill.successRate * (skill.usageCount - 1) + (success ? 100 : 0)) / skill.usageCount;
      skill.successRate = Math.round(successCount);
    }
    this.saveSkillStates();
  }
  /**
   * 保存技能状态
   */
  saveSkillStates() {
    const skillStates = {};
    this.skills.forEach((skill, id) => {
      skillStates[id] = {
        enabled: skill.enabled,
        usageCount: skill.usageCount,
        successRate: skill.successRate
      };
    });
    this.configStore.set("skills.states", skillStates);
  }
  /**
   * 导入技能（从文件）
   */
  async importSkillFromFile(filePath) {
    try {
      if (!fs__namespace.existsSync(filePath)) {
        return { success: false, error: "文件不存在" };
      }
      const content = fs__namespace.readFileSync(filePath, "utf-8");
      const fileName = path__namespace.basename(filePath, path__namespace.extname(filePath));
      const skillId = `imported_${fileName}_${Date.now()}`;
      const skill = this.parseSkillMd(skillId, content);
      if (!skill) {
        return { success: false, error: "技能文件解析失败" };
      }
      const skillDir = path__namespace.join(this.skillsDir, skillId);
      if (!fs__namespace.existsSync(skillDir)) {
        fs__namespace.mkdirSync(skillDir, { recursive: true });
      }
      const skillMdPath = path__namespace.join(skillDir, "skill.md");
      fs__namespace.writeFileSync(skillMdPath, content, "utf-8");
      this.loadSkill(skillId);
      this.log.info("[SkillLoader] 技能导入成功", { skillId, name: skill.name });
      return { success: true, skillId };
    } catch (error) {
      this.log.error("[SkillLoader] 技能导入失败", error);
      return { success: false, error: error.message || "导入失败" };
    }
  }
  /**
   * 导入技能（从URL）
   */
  async importSkillFromUrl(url2) {
    try {
      this.log.info("[SkillLoader] 从URL导入技能", { url: url2 });
      const content = `# 导入的技能

## 描述
从 ${url2} 导入的技能

## 触发关键词
- 示例关键词

## 操作步骤
1. 示例步骤`;
      const skillId = `imported_${Date.now()}`;
      const skill = this.parseSkillMd(skillId, content);
      if (!skill) {
        return { success: false, error: "技能解析失败" };
      }
      const skillDir = path__namespace.join(this.skillsDir, skillId);
      fs__namespace.mkdirSync(skillDir, { recursive: true });
      const skillMdPath = path__namespace.join(skillDir, "skill.md");
      fs__namespace.writeFileSync(skillMdPath, content, "utf-8");
      this.loadSkill(skillId);
      return { success: true, skillId };
    } catch (error) {
      this.log.error("[SkillLoader] 从URL导入技能失败", error);
      return { success: false, error: error.message || "导入失败" };
    }
  }
  /**
   * 合并技能
   */
  mergeSkill(proposal, existingSkillId) {
    try {
      const existingSkill = this.skills.get(existingSkillId);
      if (!existingSkill) {
        this.log.warn("[SkillLoader] 技能不存在，无法合并", { existingSkillId });
        return false;
      }
      const existingSkillDir = path__namespace.join(this.skillsDir, existingSkillId);
      const existingSkillMdPath = path__namespace.join(existingSkillDir, "skill.md");
      const backupPath = `${existingSkillMdPath}.backup_${Date.now()}`;
      if (fs__namespace.existsSync(existingSkillMdPath)) {
        fs__namespace.copyFileSync(existingSkillMdPath, backupPath);
        this.log.info("[SkillLoader] 已备份原技能文件", { backupPath });
      }
      const mergedKeywords = [.../* @__PURE__ */ new Set([...existingSkill.triggerKeywords, ...proposal.keywords || []])];
      const mergedSteps = [.../* @__PURE__ */ new Set([...existingSkill.operationSteps, ...proposal.operationSteps || []])];
      let fullInstructions = `# ${proposal.name || existingSkill.name}

`;
      fullInstructions += `## 描述
${proposal.description || existingSkill.description}

`;
      fullInstructions += `## 触发条件
${proposal.triggerCondition || "无"}

`;
      fullInstructions += `## 触发关键词
`;
      mergedKeywords.forEach((keyword) => {
        fullInstructions += `- ${keyword}
`;
      });
      fullInstructions += `
## 操作步骤
`;
      mergedSteps.forEach((step, index) => {
        fullInstructions += `${index + 1}. ${step}
`;
      });
      fs__namespace.writeFileSync(existingSkillMdPath, fullInstructions, "utf-8");
      existingSkill.name = proposal.name || existingSkill.name;
      existingSkill.description = proposal.description || existingSkill.description;
      existingSkill.triggerKeywords = mergedKeywords;
      existingSkill.operationSteps = mergedSteps;
      existingSkill.fullInstructions = fullInstructions;
      existingSkill.fileSize = Buffer.byteLength(fullInstructions, "utf-8");
      this.log.info("[SkillLoader] 技能合并成功", { existingSkillId, backupPath });
      return true;
    } catch (error) {
      this.log.error("[SkillLoader] 技能合并失败", error);
      return false;
    }
  }
  /**
   * 获取优化的技能上下文
   */
  async getSkillContext(userMessage) {
    try {
      const enabledSkills = Array.from(this.skills.values()).filter((s) => s.enabled);
      if (enabledSkills.length === 0) {
        return "";
      }
      let skillsToInject = [];
      if (enabledSkills.length > 5) {
        this.log.info("[SkillLoader] 技能数量较多，进行语义筛选");
        for (const skill of enabledSkills) {
          const isMatch = await this.selfLearner.checkSkillMatch(
            userMessage,
            skill.name,
            skill.triggerCondition || "无"
          );
          skillsToInject.push({ skill, isFull: isMatch });
        }
        skillsToInject.sort((a, b) => (b.isFull ? 1 : 0) - (a.isFull ? 1 : 0));
        let fullCount = 0;
        skillsToInject = skillsToInject.map((item) => {
          if (item.isFull && fullCount < 3) {
            fullCount++;
            return item;
          }
          return { ...item, isFull: false };
        });
      } else {
        skillsToInject = enabledSkills.map((skill) => ({ skill, isFull: true }));
      }
      let finalContent = "";
      for (const { skill, isFull } of skillsToInject) {
        let contentToAdd = "";
        if (isFull) {
          contentToAdd = skill.fullInstructions + "\n";
        } else {
          contentToAdd = `## ${skill.name}
${skill.description}
`;
        }
        if (finalContent.length + contentToAdd.length > 3e3) {
          const remainingSpace = 3e3 - finalContent.length;
          if (remainingSpace > 100) {
            finalContent += `## ${skill.name}
${skill.description.substring(0, 80)}...
`;
          }
          break;
        }
        finalContent += contentToAdd;
      }
      if (finalContent.length > 0) {
        this.log.info("[SkillLoader] 注入技能上下文", {
          skillCount: skillsToInject.length,
          contentLength: finalContent.length
        });
      }
      return finalContent;
    } catch (error) {
      this.log.error("[SkillLoader] 获取技能上下文失败", error);
      return "";
    }
  }
}
class InstructionGenerator {
  constructor() {
    this.log = LogManager.getInstance();
    this.modelManager = ModelManager.getInstance();
    this.skillLoader = SkillLoader.getInstance();
    this.log.info("[InstructionGenerator] 初始化");
  }
  static getInstance() {
    if (!InstructionGenerator.instance) {
      InstructionGenerator.instance = new InstructionGenerator();
    }
    return InstructionGenerator.instance;
  }
  /**
   * 从用户指令生成操作步骤
   */
  async generateTaskSteps(userInstruction) {
    this.log.info(`[InstructionGenerator] 生成步骤: ${userInstruction}`);
    try {
      const providers = this.modelManager.getAllProviders().filter((p) => p.enabled);
      if (providers.length === 0) {
        this.log.error("[InstructionGenerator] 没有可用的模型");
        return null;
      }
      const provider = providers[0];
      const model = provider.models.find((m) => m.enabled) || provider.models[0];
      if (!model) {
        this.log.error("[InstructionGenerator] 没有可用的模型");
        return null;
      }
      this.log.info(`[InstructionGenerator] 使用模型: ${provider.name}/${model.name}`);
      let steps = await this.callModel(userInstruction, provider, model);
      if (steps && steps.length > 0) {
        steps = await this.validateAndFixSteps(steps, userInstruction, provider, model);
      }
      if (steps && steps.length > 0) {
        this.log.info(`[InstructionGenerator] 生成成功: ${steps.length} 个步骤`);
        this.log.info("[InstructionGenerator] 最终步骤:", JSON.stringify(steps, null, 2));
        return steps;
      }
      return null;
    } catch (error) {
      this.log.error("[InstructionGenerator] 生成步骤失败:", error);
      return null;
    }
  }
  /**
   * 【修改2：校验并修复步骤】
   */
  async validateAndFixSteps(steps, userInstruction, provider, model) {
    var _a;
    const fixedSteps = [...steps];
    for (let i = 0; i < fixedSteps.length; i++) {
      const step = fixedSteps[i];
      if (step.action === "write_file") {
        const hasContent = ((_a = step.params) == null ? void 0 : _a.content) && step.params.content.trim() !== "";
        if (!hasContent) {
          this.log.warn("[InstructionGenerator] write_file 缺少 content，尝试补充生成...");
          try {
            const content = await this.generateMissingContent(userInstruction, provider, model);
            if (content && content.trim() !== "") {
              step.params.content = content;
              this.log.info("[InstructionGenerator] 成功补充 content，长度:", content.length);
            } else {
              step.params.content = "（内容生成失败，请手动输入）";
            }
          } catch (error) {
            this.log.error("[InstructionGenerator] 补充 content 失败:", error);
            step.params.content = "（内容生成失败，请手动输入）";
          }
        }
      }
    }
    return fixedSteps;
  }
  /**
   * 补充生成缺失的内容
   */
  async generateMissingContent(userInstruction, provider, model) {
    const systemPrompt = "你是内容生成助手。根据用户的原始指令，请只返回文件应该包含的完整内容，不要任何解释，不要JSON格式，只返回纯文本内容。";
    const userPrompt = `用户原始指令："${userInstruction}"

请你只返回这份文件应该包含的完整文本内容。`;
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];
    return new Promise((resolve, reject) => {
      let baseUrl = provider.baseUrl;
      if (!baseUrl) {
        reject(new Error("缺少 baseUrl"));
        return;
      }
      baseUrl = baseUrl.replace(/\/$/, "");
      let url$1;
      let headers = { "Content-Type": "application/json" };
      if (provider.type === "openai" || provider.type === "deepseek" || provider.type === "custom" || provider.type === "ollama") {
        let endpoint = "/chat/completions";
        if (provider.type === "ollama") {
          endpoint = "/api/chat";
        }
        url$1 = new url.URL(baseUrl + endpoint);
        headers["Authorization"] = `Bearer ${provider.apiKey || ""}`;
      } else if (provider.type === "azure") {
        const deploymentName = provider.deploymentName || model.id;
        url$1 = new url.URL(`${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${provider.apiVersion || "2024-02-01"}`);
        headers["api-key"] = provider.apiKey || "";
      } else {
        reject(new Error(`不支持的提供商类型: ${provider.type}`));
        return;
      }
      const body = {
        model: model.id,
        messages,
        stream: false,
        temperature: 0.3,
        max_tokens: 3e3
      };
      const protocol = url$1.protocol === "https:" ? https : http;
      const req = protocol.request(
        {
          hostname: url$1.hostname,
          port: url$1.port || (url$1.protocol === "https:" ? 443 : 11434),
          path: url$1.pathname + url$1.search,
          method: "POST",
          headers
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => data += chunk);
          res.on("end", () => {
            var _a, _b, _c;
            try {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                const parsed = JSON.parse(data);
                let content = "";
                if (provider.type === "ollama" && parsed.message) {
                  content = parsed.message.content;
                } else if ((_c = (_b = (_a = parsed.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content) {
                  content = parsed.choices[0].message.content;
                }
                if (content && content.trim()) {
                  resolve(content.trim());
                } else {
                  resolve(null);
                }
              } else {
                resolve(null);
              }
            } catch (error) {
              resolve(null);
            }
          });
        }
      );
      req.on("error", () => resolve(null));
      req.write(JSON.stringify(body));
      req.end();
    });
  }
  /**
   * 调用大模型生成步骤
   */
  async callModel(userInstruction, provider, model) {
    const skillSummaries = this.skillLoader.getAllSkillSummaries();
    const matchedSkillContext = this.skillLoader.getSkillContext(userInstruction);
    let systemPrompt = `你是专业的桌面自动化助手。根据用户指令生成结构化操作步骤。

可用工具：
- write_file: 写入文件，参数: filePath, content
- read_file: 读取文件，参数: filePath
- delete_file: 删除文件，参数: filePath
- list_directory: 列出目录内容，参数: directoryPath
- run_command: 运行命令，参数: command, cwd (可选)
- open_url: 打开URL，参数: url
- create_file: 创建文件，参数: filePath, content
- rename_file: 重命名文件，参数: filePath, newPath
- create_directory: 创建目录，参数: directoryPath
- delete_directory: 删除目录，参数: directoryPath
- file_exists: 检查文件是否存在，参数: filePath
- clipboard_read: 读取剪贴板，参数: 无
- clipboard_write: 写入剪贴板，参数: text
- browser_open: 打开浏览器，参数: url (可选)
- browser_navigate: 导航到URL，参数: url, sessionId (可选)
- browser_click: 点击元素，参数: selector, sessionId (可选)
- browser_type: 输入文本，参数: selector, text, sessionId (可选)
- browser_get_text: 获取文本，参数: selector, sessionId (可选)
- browser_wait_for: 等待元素，参数: selector, timeout (可选), sessionId (可选)
- browser_screenshot: 截图，参数: path (可选), sessionId (可选)

【技能系统 - 优先使用】
${skillSummaries}

要求：
1. 首先检查用户消息是否匹配上述任何技能的触发关键词
2. 如果匹配到技能，严格按照该技能的操作步骤来生成结构化指令
3. 当操作需要文件内容时（如 write_file），必须在 params 中包含 content 字段并填入完整的文本内容
4. 对于任何要求写入内容的指令（如九九乘法表、文章、代码等），必须一次性在 content 中生成完整结果，不得留空或只写标题
5. 必须只返回纯 JSON 数组，不要任何解释、说明、markdown 等
6. 路径要使用用户实际描述的位置
7. 如果无法理解用户指令，返回空数组 []

重要：文件操作安全规则（必须严格遵守！）
规则1：执行任何文件操作时，如果用户没有明确指定文件扩展名，必须优先使用 list_directory 查看目标目录，匹配已有的文件名和扩展名，严禁在找不到文件时擅自创建新文件名。
规则2：遇到修改、编辑、更新、追加、改写、替换文件内容的需求，流程必须是：list_directory 确认文件 -> read_file 读取内容 -> write_file 写入修改。
规则3：写文件时，content 字段必须严格根据用户指令生成或修改的完整内容，绝对禁止在没有明确指令时清空文件内容。

文件修改流程规则 - 遇到修改，先读后写！
- 当用户要求修改、编辑、更新、追加、改写、替换文件内容时，必须按照以下两步流程：
  步骤1：先生成 read_file 指令读取该文件的当前内容
  步骤2：再生成 write_file 指令，根据用户要求修改后写入完整内容
- 这个规则对文件修改操作是强制的，必须遵守，不得直接生成 write_file 而跳过 read_file

示例：
用户指令："在桌面创建 test.txt，内容是九九乘法表"
返回：[{"action":"write_file","params":{"filePath":"桌面/test.txt","content":"【这里必须填入用户要求的完整文本内容，不得省略】"}}]`;
    if (matchedSkillContext) {
      systemPrompt += `

【检测到匹配的技能】
${matchedSkillContext}

请严格按照上述技能的操作步骤生成结构化指令。`;
      this.log.info("[InstructionGenerator] 注入匹配技能到提示词");
    }
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userInstruction }
    ];
    let result = await this.makeRequest(messages, provider, model);
    if (!result) {
      this.log.warn("[InstructionGenerator] 第一次调用失败，重试...");
      result = await this.makeRequest(messages, provider, model);
    }
    return result;
  }
  /**
   * 发送请求到模型
   */
  async makeRequest(messages, provider, model) {
    return new Promise((resolve, reject) => {
      let baseUrl = provider.baseUrl;
      if (!baseUrl) {
        reject(new Error("缺少 baseUrl"));
        return;
      }
      baseUrl = baseUrl.replace(/\/$/, "");
      let url$1;
      let headers = { "Content-Type": "application/json" };
      if (provider.type === "openai" || provider.type === "deepseek" || provider.type === "custom" || provider.type === "ollama") {
        let endpoint = "/chat/completions";
        if (provider.type === "ollama") {
          endpoint = "/api/chat";
        }
        url$1 = new url.URL(baseUrl + endpoint);
        headers["Authorization"] = `Bearer ${provider.apiKey || ""}`;
      } else if (provider.type === "azure") {
        const deploymentName = provider.deploymentName || model.id;
        url$1 = new url.URL(`${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${provider.apiVersion || "2024-02-01"}`);
        headers["api-key"] = provider.apiKey || "";
      } else {
        reject(new Error(`不支持的提供商类型: ${provider.type}`));
        return;
      }
      const body = {
        model: model.id,
        messages,
        stream: false,
        temperature: 0.1,
        max_tokens: 2e3
      };
      const protocol = url$1.protocol === "https:" ? https : http;
      const req = protocol.request(
        {
          hostname: url$1.hostname,
          port: url$1.port || (url$1.protocol === "https:" ? 443 : 11434),
          path: url$1.pathname + url$1.search,
          method: "POST",
          headers
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => data += chunk);
          res.on("end", () => {
            var _a, _b, _c;
            try {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                const parsed = JSON.parse(data);
                let content = "";
                if (provider.type === "ollama" && parsed.message) {
                  content = parsed.message.content;
                } else if ((_c = (_b = (_a = parsed.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content) {
                  content = parsed.choices[0].message.content;
                }
                if (!content) {
                  this.log.error("[InstructionGenerator] 模型返回内容为空");
                  resolve(null);
                  return;
                }
                this.log.info("[InstructionGenerator] 模型返回:", content);
                const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                try {
                  const steps = JSON.parse(cleanContent);
                  if (Array.isArray(steps)) {
                    resolve(steps);
                  } else {
                    this.log.error("[InstructionGenerator] 返回不是数组");
                    resolve(null);
                  }
                } catch (parseError) {
                  this.log.error("[InstructionGenerator] JSON 解析失败:", parseError);
                  resolve(null);
                }
              } else {
                this.log.error("[InstructionGenerator] 请求失败:", res.statusCode, data);
                resolve(null);
              }
            } catch (error) {
              this.log.error("[InstructionGenerator] 解析响应失败:", error);
              resolve(null);
            }
          });
        }
      );
      req.on("error", (error) => {
        this.log.error("[InstructionGenerator] 请求错误:", error);
        resolve(null);
      });
      req.write(JSON.stringify(body));
      req.end();
    });
  }
}
class ChatManager {
  constructor() {
    this.log = LogManager.getInstance();
    this.abortControllers = /* @__PURE__ */ new Map();
    this.log.info("[ChatManager] 初始化");
    try {
      try {
        this.config = ChatConfig.getInstance();
      } catch (e) {
        this.log.error("[ChatManager] ChatConfig 初始化失败", e);
        throw new Error("聊天配置初始化失败");
      }
      try {
        this.modelManager = ModelManager.getInstance();
      } catch (e) {
        this.log.warn("[ChatManager] ModelManager 初始化失败，部分功能不可用", e);
        this.modelManager = {
          getProvider: () => null,
          getAllProviders: () => []
        };
      }
      try {
        HermesMemory.getInstance();
      } catch (e) {
        this.log.warn("[ChatManager] HermesMemory 初始化失败，记忆功能不可用", e);
      }
      try {
        SelfLearner.getInstance();
      } catch (e) {
        this.log.warn("[ChatManager] SelfLearner 初始化失败，学习功能不可用", e);
      }
      this.log.info("[ChatManager] 初始化成功");
    } catch (error) {
      this.log.error("[ChatManager] 初始化失败", error);
      if (!this.config) {
        try {
          this.config = ChatConfig.getInstance();
        } catch (e) {
          this.log.error("[ChatManager] ChatConfig 再次初始化失败，应用将无法正常工作", e);
        }
      }
    }
  }
  static getInstance() {
    if (!ChatManager.instance) {
      ChatManager.instance = new ChatManager();
    }
    return ChatManager.instance;
  }
  // ============ 对话管理核心方法 ============
  getAllConversations() {
    return this.config.getAllConversations();
  }
  getActiveConversations() {
    return this.config.getAllConversations().filter((c) => c.status === "active");
  }
  getConversation(id) {
    return this.config.getConversation(id);
  }
  createConversation(data) {
    this.log.info("[ChatManager] 创建新对话");
    return this.config.createConversation(data);
  }
  updateConversation(id, updates) {
    return this.config.updateConversation(id, updates);
  }
  deleteConversation(id) {
    this.abortControllers.delete(id);
    return this.config.deleteConversation(id);
  }
  archiveConversation(id) {
    return this.config.archiveConversation(id);
  }
  pinConversation(id, pinned) {
    return this.config.pinConversation(id, pinned);
  }
  getSettings() {
    return this.config.getSettings();
  }
  updateSettings(settings) {
    return this.config.updateSettings(settings);
  }
  getMessage(conversationId, messageId) {
    return this.config.getMessage(conversationId, messageId);
  }
  addMessage(conversationId, message) {
    return this.config.addMessage(conversationId, message);
  }
  updateMessage(conversationId, messageId, updates) {
    return this.config.updateMessage(conversationId, messageId, updates);
  }
  stopGeneration(conversationId) {
    const controller = this.abortControllers.get(conversationId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(conversationId);
    }
  }
  // ============ 核心消息发送方法 ============
  async sendMessage(conversationId, content, providerId, modelId, settings) {
    var _a, _b;
    const traceId = `msg_${Date.now()}`;
    this.log.info(`[ChatManager] [${traceId}] 收到消息发送请求`);
    if (content.trim() === "是" || content.trim() === "确认" || content.trim() === "yes") {
      const selfLearner = SelfLearner.getInstance();
      const pendingProposal = selfLearner.getPendingProposal();
      if (pendingProposal) {
        this.log.info("[ChatManager] 用户确认保存技能", { name: pendingProposal.name });
        const userMessage2 = {
          id: `user_${Date.now()}`,
          role: "user",
          content,
          timestamp: Date.now(),
          status: "sent",
          providerId,
          modelId
        };
        this.config.addMessage(conversationId, userMessage2);
        this.broadcastMessage(conversationId, userMessage2);
        const saved = selfLearner.saveSkillFromProposal(pendingProposal);
        const replyMessage = {
          id: `assistant_${Date.now()}`,
          role: "assistant",
          content: saved ? `✅ 太棒了！我已经把这个操作保存为技能"${pendingProposal.name}"了。以后你可以直接用关键词触发它。` : "❌ 保存技能失败，请稍后重试。",
          timestamp: Date.now(),
          status: "sent",
          providerId,
          modelId
        };
        this.config.addMessage(conversationId, replyMessage);
        this.broadcastMessage(conversationId, replyMessage);
        this.broadcastConversationUpdate(conversationId);
        const windows = electron.BrowserWindow.getAllWindows();
        windows.forEach((w) => {
          if (!w.isDestroyed()) {
            w.webContents.send("skills:new-proposal", pendingProposal);
          }
        });
        return replyMessage;
      }
    }
    const userMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content,
      timestamp: Date.now(),
      status: "sent",
      providerId,
      modelId
    };
    this.config.addMessage(conversationId, userMessage);
    this.broadcastMessage(conversationId, userMessage);
    try {
      const instructionGenerator = InstructionGenerator.getInstance();
      const taskExecutor = TaskExecutor.getInstance();
      const steps = await instructionGenerator.generateTaskSteps(content);
      if (steps && steps.length > 0) {
        this.log.info(`[ChatManager] [${traceId}] 大模型生成了 ${steps.length} 个步骤，开始执行`);
        const placeholderId = `assistant_${Date.now()}`;
        const placeholder = {
          id: placeholderId,
          role: "assistant",
          content: "🔧 正在执行操作...",
          timestamp: Date.now(),
          status: "streaming",
          providerId,
          modelId
        };
        this.config.addMessage(conversationId, placeholder);
        this.broadcastMessage(conversationId, placeholder);
        const task = {
          id: `task_${Date.now()}`,
          conversationId,
          messageId: placeholderId,
          instruction: content,
          steps: steps.map((step, i) => ({
            id: `step_${i}`,
            order: i + 1,
            type: step.action,
            description: step.description || `执行 ${step.action}`,
            params: step.params,
            requiredPermission: "filesystem",
            requiredAction: "write",
            status: "pending"
          })),
          status: "pending",
          createdAt: Date.now()
        };
        const result = await taskExecutor.executeTask(task);
        let resultContent = result.success ? "✅ 任务执行成功\n\n" : "❌ 任务执行失败\n\n";
        const taskResultSteps = ((_a = result.result) == null ? void 0 : _a.steps) || [];
        const taskSteps = taskResultSteps.map((step, index) => {
          const originalStep = steps[index];
          const stepInfo = {
            order: index + 1,
            description: step.description || (originalStep == null ? void 0 : originalStep.description) || `步骤 ${index + 1}`,
            status: step.status || "success",
            duration: step.endTime && step.startTime ? step.endTime - step.startTime : 0,
            error: step.error || null,
            params: (originalStep == null ? void 0 : originalStep.params) || null
          };
          return stepInfo;
        });
        if ((_b = result.result) == null ? void 0 : _b.steps) {
          for (let i = 0; i < result.result.steps.length; i++) {
            const stepResult = result.result.steps[i];
            const originalStep = steps[i];
            const statusIcon = stepResult.status === "success" ? "✅" : "❌";
            resultContent += `${statusIcon} **步骤 ${i + 1}**：${originalStep.description || originalStep.action}
`;
            if (stepResult.description && stepResult.description !== originalStep.description) {
              resultContent += `   > ${stepResult.description}
`;
            }
            if (originalStep.params) {
              if (originalStep.params.filePath || originalStep.params.path) {
                resultContent += `   📁 路径：\`${originalStep.params.filePath || originalStep.params.path}\`
`;
              }
              if (originalStep.params.content) {
                const preview = originalStep.params.content.length > 100 ? originalStep.params.content.substring(0, 100) + "..." : originalStep.params.content;
                resultContent += `   📝 内容预览：\`${preview}\`
`;
              }
            }
            if (stepResult.result) {
              resultContent += `   ⏱️ 耗时：${stepResult.result.duration || "N/A"}ms
`;
            }
            if (stepResult.error) {
              resultContent += `   ❌ 错误：${stepResult.error}
`;
            }
            resultContent += "\n";
          }
        }
        if (result.error) {
          resultContent += `
❌ 任务错误：${result.error}`;
        }
        resultContent += `
⏱️ 总耗时：${result.duration}ms`;
        const finalMsg = {
          id: placeholderId,
          role: "assistant",
          content: resultContent,
          timestamp: Date.now(),
          status: "sent",
          providerId,
          modelId,
          taskResult: {
            success: result.success,
            status: result.success ? "completed" : "failed",
            steps: taskSteps,
            summary: result.summary,
            error: result.error,
            duration: result.duration
          }
        };
        this.config.updateMessage(conversationId, placeholderId, finalMsg);
        this.broadcastMessage(conversationId, finalMsg);
        this.broadcastConversationUpdate(conversationId);
        if (result.success) {
          const selfLearner = SelfLearner.getInstance();
          selfLearner.observeExecution(content, steps, result);
        }
        return finalMsg;
      }
    } catch (taskError) {
      this.log.error(`[ChatManager] [${traceId}] 任务执行失败，回退普通对话:`, taskError);
    }
    return this.handleNormalChat(conversationId, content, providerId, modelId, settings, traceId);
  }
  // ============ 普通对话流 ============
  async handleNormalChat(conversationId, content, providerId, modelId, settings, traceId) {
    const conversation = this.config.getConversation(conversationId);
    if (!conversation) throw new Error("会话不存在");
    const effectiveProviderId = providerId || conversation.providerId;
    const effectiveModelId = modelId || conversation.modelId;
    if (!effectiveProviderId || !effectiveModelId) {
      throw new Error("请先选择模型");
    }
    const provider = this.modelManager.getProvider(effectiveProviderId);
    if (!provider) throw new Error("模型提供商不存在");
    const assistantMessageId = `assistant_${Date.now()}`;
    const assistantPlaceholder = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      status: "streaming",
      providerId: effectiveProviderId,
      modelId: effectiveModelId
    };
    this.config.createStreamingMessage(conversationId, assistantPlaceholder);
    this.broadcastMessage(conversationId, assistantPlaceholder);
    try {
      const mergedSettings = { ...this.getSettings(), ...settings };
      const chatHistory = conversation.messages.filter((m) => m.id !== assistantMessageId && m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
      const hermes = HermesMemory.getInstance();
      const memoryPrompt = hermes.buildMemoryPrompt(content);
      let systemPrompt = "你是PiPiClaw智能助手，一个专业的AI自动化助手，内置OpenClaw本地执行引擎。";
      if (memoryPrompt.trim()) {
        systemPrompt += `

用户记忆:
${memoryPrompt}`;
      }
      const fullMessages = [
        { role: "system", content: systemPrompt },
        ...chatHistory,
        { role: "user", content }
      ];
      await this.streamModelResponse(
        conversationId,
        assistantMessageId,
        effectiveProviderId,
        effectiveModelId,
        fullMessages,
        mergedSettings
      );
      this.config.setLastProvider(effectiveProviderId);
      this.config.setLastModel(effectiveModelId);
      const finalMsg = this.config.getMessage(conversationId, assistantMessageId);
      if (finalMsg == null ? void 0 : finalMsg.content) {
        const shouldPrecipitate = /(文件|文件夹|目录|创建|写入|修改|删除|整理|习惯|偏好|喜欢)/.test(content) || /(文件|文件夹|目录|创建|写入|修改|删除|整理)/.test(finalMsg.content);
        if (shouldPrecipitate) {
          hermes.addConversationMemory(
            conversationId,
            `用户请求: ${content}
AI回复: ${finalMsg.content.substring(0, 500)}${finalMsg.content.length > 500 ? "..." : ""}`,
            50
          );
        }
      }
      return finalMsg || assistantPlaceholder;
    } catch (error) {
      this.config.finalizeStreamingMessage(conversationId, assistantMessageId, "error", error.message);
      const errorMsg = this.config.getMessage(conversationId, assistantMessageId);
      this.broadcastMessage(conversationId, errorMsg || {
        ...assistantPlaceholder,
        status: "error",
        error: error.message
      });
      this.broadcastConversationUpdate(conversationId);
      throw error;
    }
  }
  // ============ 流式响应处理 ============
  async streamModelResponse(conversationId, messageId, providerId, modelId, messages, settings) {
    const provider = this.modelManager.getProvider(providerId);
    if (!provider) throw new Error("模型提供商不存在");
    if (provider.type === "ollama") {
      return this.streamOllama(conversationId, messageId, provider, modelId, messages, settings);
    } else {
      return this.streamCloudProvider(conversationId, messageId, provider, modelId, messages, settings);
    }
  }
  isThinkingSupportedModel(modelId) {
    const lower = modelId.toLowerCase();
    return lower.includes("qwen") || lower.includes("deepseek");
  }
  async streamOllama(conversationId, messageId, provider, modelId, messages, settings) {
    return new Promise((resolve, reject) => {
      let baseUrl = provider.baseUrl || "http://localhost:11434";
      baseUrl = baseUrl.replace(/\/$/, "");
      const url$1 = new url.URL(`${baseUrl}/api/chat`);
      const ollamaMessages = messages.map((m) => ({ role: m.role, content: m.content }));
      const body = { model: modelId, messages: ollamaMessages, stream: true };
      if (this.isThinkingSupportedModel(modelId)) {
        body.options = { think: true };
      }
      const controller = new AbortController();
      this.abortControllers.set(conversationId, controller);
      const timeout = setTimeout(() => controller.abort(), 12e4);
      const protocol = url$1.protocol === "https:" ? https : http;
      const req = protocol.request(
        {
          hostname: url$1.hostname,
          port: url$1.port || (url$1.protocol === "https:" ? 443 : 11434),
          path: url$1.pathname,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal
        },
        (res) => {
          let buffer = "";
          let accumulatedContent = "";
          let accumulatedThinking = "";
          let lastContentUpdate = 0;
          let lastThinkingUpdate = 0;
          res.on("data", (chunk) => {
            var _a, _b;
            buffer += chunk.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const data = JSON.parse(line);
                if (this.isThinkingSupportedModel(modelId) && ((_a = data.message) == null ? void 0 : _a.think)) {
                  accumulatedThinking += data.message.think;
                  const now = Date.now();
                  if (now - lastThinkingUpdate > 100) {
                    lastThinkingUpdate = now;
                    this.config.appendStreamingContent(conversationId, messageId, accumulatedContent, accumulatedThinking);
                    const updated = this.config.getMessage(conversationId, messageId);
                    if (updated) this.broadcastMessage(conversationId, updated);
                  }
                }
                if ((_b = data.message) == null ? void 0 : _b.content) {
                  accumulatedContent += data.message.content;
                  const now = Date.now();
                  if (now - lastContentUpdate > 50) {
                    lastThinkingUpdate = now;
                    this.config.appendStreamingContent(conversationId, messageId, accumulatedContent, accumulatedThinking);
                    const updated = this.config.getMessage(conversationId, messageId);
                    if (updated) this.broadcastMessage(conversationId, updated);
                  }
                }
              } catch (e) {
              }
            }
          });
          res.on("end", () => {
            clearTimeout(timeout);
            this.abortControllers.delete(conversationId);
            this.config.appendStreamingContent(conversationId, messageId, accumulatedContent, accumulatedThinking);
            this.config.finalizeStreamingMessage(conversationId, messageId, "sent");
            this.broadcastConversationUpdate(conversationId);
            resolve();
          });
        }
      );
      req.on("error", (error) => {
        clearTimeout(timeout);
        this.abortControllers.delete(conversationId);
        if (error.name === "AbortError") {
          this.handleStreamError(conversationId, messageId, "用户停止了生成或请求超时");
          reject(new Error("用户停止了生成或请求超时"));
        } else {
          this.handleStreamError(conversationId, messageId, error.message);
          reject(error);
        }
      });
      req.write(JSON.stringify(body));
      req.end();
    });
  }
  async streamCloudProvider(conversationId, messageId, provider, modelId, messages, settings) {
    return new Promise((resolve, reject) => {
      let baseUrl = provider.baseUrl;
      if (!baseUrl) {
        reject(new Error("缺少baseUrl"));
        return;
      }
      baseUrl = baseUrl.replace(/\/$/, "");
      let url$1;
      let headers = { "Content-Type": "application/json" };
      if (provider.type === "openai" || provider.type === "deepseek" || provider.type === "custom") {
        url$1 = new url.URL(`${baseUrl}/chat/completions`);
        headers["Authorization"] = `Bearer ${provider.apiKey || ""}`;
      } else if (provider.type === "azure") {
        const deploymentName = provider.deploymentName || modelId;
        url$1 = new url.URL(`${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${provider.apiVersion || "2024-02-01"}`);
        headers["api-key"] = provider.apiKey || "";
      } else {
        reject(new Error(`不支持的提供商类型: ${provider.type}`));
        return;
      }
      const body = { model: modelId, messages, stream: true, temperature: settings.temperature, maxTokens: settings.maxTokens };
      if (settings.topP) body.topP = settings.topP;
      const controller = new AbortController();
      this.abortControllers.set(conversationId, controller);
      const timeout = setTimeout(() => controller.abort(), 6e4);
      const protocol = url$1.protocol === "https:" ? https : http;
      const req = protocol.request(
        { hostname: url$1.hostname, port: url$1.port || (url$1.protocol === "https:" ? 443 : 80), path: url$1.pathname + url$1.search, method: "POST", headers, signal: controller.signal },
        (res) => {
          let buffer = "";
          let accumulatedContent = "";
          let accumulatedThinking = "";
          res.on("data", (chunk) => {
            var _a, _b;
            buffer += chunk.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.trim() || !line.startsWith("data: ")) continue;
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") continue;
              try {
                const data = JSON.parse(dataStr);
                const delta = ((_b = (_a = data.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.delta) || {};
                if (provider.type === "deepseek" && delta.thinking) {
                  accumulatedThinking += delta.thinking;
                }
                if (delta.content) {
                  accumulatedContent += delta.content;
                  this.config.appendStreamingContent(conversationId, messageId, accumulatedContent, accumulatedThinking);
                  const updated = this.config.getMessage(conversationId, messageId);
                  if (updated) this.broadcastMessage(conversationId, updated);
                }
              } catch (e) {
              }
            }
          });
          res.on("end", () => {
            clearTimeout(timeout);
            this.abortControllers.delete(conversationId);
            this.config.appendStreamingContent(conversationId, messageId, accumulatedContent, accumulatedThinking);
            this.config.finalizeStreamingMessage(conversationId, messageId, "sent");
            this.broadcastConversationUpdate(conversationId);
            resolve();
          });
        }
      );
      req.on("error", (error) => {
        clearTimeout(timeout);
        this.abortControllers.delete(conversationId);
        if (error.name === "AbortError") {
          this.handleStreamError(conversationId, messageId, "用户停止了生成或请求超时");
          reject(new Error("用户停止了生成或请求超时"));
        } else {
          this.handleStreamError(conversationId, messageId, error.message);
          reject(error);
        }
      });
      req.write(JSON.stringify(body));
      req.end();
    });
  }
  handleStreamError(conversationId, messageId, error) {
    this.config.finalizeStreamingMessage(conversationId, messageId, "error", error);
    const errMsg = this.config.getMessage(conversationId, messageId);
    this.broadcastMessage(conversationId, errMsg || { id: messageId, role: "assistant", content: "", status: "error", error, timestamp: Date.now() });
    this.broadcastConversationUpdate(conversationId);
  }
  async continueGeneration(conversationId) {
    const conv = this.config.getConversation(conversationId);
    if (!conv) throw new Error("会话不存在");
    await this.sendMessage(conversationId, "请继续", conv.providerId, conv.modelId);
  }
  // ============ 事件广播方法 ============
  broadcastMessage(conversationId, message) {
    const windows = electron.BrowserWindow.getAllWindows();
    windows.forEach((w) => {
      if (!w.isDestroyed()) {
        w.webContents.send("chat:onMessage", { conversationId, message });
      }
    });
  }
  broadcastConversationUpdate(conversationId) {
    const conversation = this.config.getConversation(conversationId);
    const windows = electron.BrowserWindow.getAllWindows();
    windows.forEach((w) => {
      if (!w.isDestroyed() && conversation) {
        w.webContents.send("chat:onConversationUpdate", { conversation });
      }
    });
  }
  destroy() {
    this.abortControllers.forEach((c) => c.abort());
    this.abortControllers.clear();
    ChatManager.instance = null;
  }
}
var ExecutionMode = /* @__PURE__ */ ((ExecutionMode2) => {
  ExecutionMode2["SAFE"] = "safe";
  ExecutionMode2["PLAN"] = "plan";
  ExecutionMode2["CRAFT"] = "craft";
  return ExecutionMode2;
})(ExecutionMode || {});
const RISK_LEVEL_MAP = {
  // 文件系统 - 低风险
  read_file: "low",
  list_directory: "low",
  file_exists: "low",
  // 文件系统 - 中风险
  write_file: "medium",
  create_file: "medium",
  create_directory: "medium",
  // 文件系统 - 高风险
  delete_file: "high",
  delete_dir: "high",
  copy_file: "high",
  move_file: "high",
  // Shell - 高风险
  run_command: "high",
  // 系统 - 中风险
  open_url: "medium",
  clipboard_read: "low",
  clipboard_write: "low"
  /* LOW */
};
const HIGH_RISK_OPERATIONS = [
  "delete_file",
  "delete_dir",
  "run_command",
  "copy_file",
  "move_file"
];
class TaskLog {
  constructor() {
    this.log = LogManager.getInstance();
    this.logs = /* @__PURE__ */ new Map();
    this.currentTaskId = null;
    const userDataPath = electron.app.getPath("userData");
    this.logsDir = path.join(userDataPath, "task-logs");
    this.logsFile = path.join(this.logsDir, "task-logs.json");
    this.ensureLogsDir();
    this.loadLogs();
    this.cleanupLogs();
  }
  /**
   * 清理过期日志
   * 规则：
   * 1. 最多保留 1000 条结构化日志
   * 2. 删除 30 天前的物理日志文件
   */
  cleanupLogs() {
    try {
      if (this.logs.size > 1e3) {
        const entries = Array.from(this.logs.values()).sort((a, b) => b.createdAt - a.createdAt);
        const keptEntries = entries.slice(0, 1e3);
        this.logs.clear();
        for (const entry of keptEntries) {
          this.logs.set(entry.id, entry);
        }
        this.saveLogs();
        this.log.info("[TaskLog] 已清理冗余日志条目，保留 1000 条");
      }
      const files = fs__namespace.readdirSync(this.logsDir);
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1e3;
      for (const file of files) {
        if (file.endsWith(".log")) {
          const filePath = path.join(this.logsDir, file);
          const stats = fs__namespace.statSync(filePath);
          if (stats.mtimeMs < thirtyDaysAgo) {
            fs__namespace.unlinkSync(filePath);
            this.log.info("[TaskLog] 已删除过期日志文件:", file);
          }
        }
      }
    } catch (error) {
      this.log.error("[TaskLog] 清理日志失败:", error);
    }
  }
  static getInstance() {
    if (!TaskLog.instance) {
      TaskLog.instance = new TaskLog();
    }
    return TaskLog.instance;
  }
  ensureLogsDir() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
      this.log.info("[TaskLog] 创建日志目录:", this.logsDir);
    }
  }
  loadLogs() {
    try {
      if (fs.existsSync(this.logsFile)) {
        const data = fs.readFileSync(this.logsFile, "utf-8");
        const entries = JSON.parse(data);
        this.logs.clear();
        for (const entry of entries) {
          this.logs.set(entry.id, entry);
        }
        this.log.info("[TaskLog] 加载日志:", this.logs.size, "条");
      }
    } catch (error) {
      this.log.error("[TaskLog] 加载日志失败:", error);
    }
  }
  saveLogs() {
    try {
      const entries = Array.from(this.logs.values());
      const data = JSON.stringify(entries, null, 2);
      fs.writeFileSync(this.logsFile, data, "utf-8");
      this.log.debug("[TaskLog] 保存日志:", entries.length, "条");
    } catch (error) {
      this.log.error("[TaskLog] 保存日志失败:", error);
    }
  }
  startTask(task) {
    const entry = {
      id: task.id,
      conversationId: task.conversationId,
      instruction: task.instruction,
      mode: task.mode,
      status: "running",
      steps: task.steps,
      summary: "",
      createdAt: Date.now(),
      startTime: Date.now(),
      retryCount: 0
    };
    this.logs.set(entry.id, entry);
    this.currentTaskId = entry.id;
    this.saveLogs();
    this.log.info("[TaskLog] 开始任务:", entry.id);
    this.appendToFile(`[${(/* @__PURE__ */ new Date()).toISOString()}] 开始执行任务: ${entry.instruction}
`);
    return entry.id;
  }
  updateStep(taskId, stepOrder, updates) {
    const entry = this.logs.get(taskId);
    if (!entry) return;
    const step = entry.steps.find((s) => s.order === stepOrder);
    if (step) {
      Object.assign(step, updates);
      this.saveLogs();
      const statusStr = updates.status === "success" ? "成功" : updates.status === "failed" ? "失败" : updates.status === "blocked" ? "被拦截" : "进行中";
      this.appendToFile(`[${(/* @__PURE__ */ new Date()).toISOString()}] 步骤${stepOrder} ${step.description}: ${statusStr}
`);
    }
  }
  completeTask(taskId, result) {
    const entry = this.logs.get(taskId);
    if (!entry) return;
    entry.status = result.success ? "success" : "failed";
    entry.summary = result.summary;
    entry.error = result.error;
    entry.endTime = Date.now();
    entry.duration = result.duration || (entry.startTime ? entry.endTime - entry.startTime : 0);
    this.saveLogs();
    this.currentTaskId = null;
    const statusStr = result.success ? "成功" : "失败";
    this.log.info(`[TaskLog] 任务完成: ${taskId}, 状态: ${statusStr}, 耗时: ${entry.duration}ms`);
    this.appendToFile(`[${(/* @__PURE__ */ new Date()).toISOString()}] 任务${statusStr}, ${result.summary}

`);
    this.cleanupLogs();
  }
  cancelTask(taskId, reason) {
    const entry = this.logs.get(taskId);
    if (!entry) return;
    entry.status = "cancelled";
    entry.error = reason || "用户取消";
    entry.endTime = Date.now();
    entry.duration = entry.startTime ? entry.endTime - entry.startTime : 0;
    this.saveLogs();
    this.currentTaskId = null;
    this.log.info("[TaskLog] 任务取消:", taskId, reason);
    this.appendToFile(`[${(/* @__PURE__ */ new Date()).toISOString()}] 任务取消: ${reason || "用户取消"}

`);
    this.cleanupLogs();
  }
  getLog(taskId) {
    return this.logs.get(taskId) || null;
  }
  queryLogs(query) {
    let results = Array.from(this.logs.values());
    if (query.status) {
      results = results.filter((r) => r.status === query.status);
    }
    if (query.mode) {
      results = results.filter((r) => r.mode === query.mode);
    }
    if (query.startDate) {
      results = results.filter((r) => r.createdAt >= query.startDate);
    }
    if (query.endDate) {
      results = results.filter((r) => r.createdAt <= query.endDate);
    }
    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      results = results.filter(
        (r) => {
          var _a;
          return r.instruction.toLowerCase().includes(keyword) || r.summary.toLowerCase().includes(keyword) || ((_a = r.error) == null ? void 0 : _a.toLowerCase().includes(keyword));
        }
      );
    }
    results.sort((a, b) => b.createdAt - a.createdAt);
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    return results.slice(offset, offset + limit);
  }
  deleteLog(taskId) {
    const deleted = this.logs.delete(taskId);
    if (deleted) {
      this.saveLogs();
      this.log.info("[TaskLog] 删除日志:", taskId);
    }
    return deleted;
  }
  deleteLogs(taskIds) {
    let deletedCount = 0;
    for (const id of taskIds) {
      if (this.logs.delete(id)) {
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      this.saveLogs();
      this.log.info("[TaskLog] 批量删除日志:", deletedCount, "条");
    }
    return deletedCount;
  }
  exportLog(taskId, options) {
    const entry = this.logs.get(taskId);
    if (!entry) return "";
    if (options.format === "json") {
      return JSON.stringify(entry, null, 2);
    }
    let text = `=== 任务执行日志 ===
`;
    text += `ID: ${entry.id}
`;
    text += `指令: ${entry.instruction}
`;
    text += `模式: ${entry.mode}
`;
    text += `状态: ${entry.status}
`;
    text += `创建时间: ${new Date(entry.createdAt).toLocaleString("zh-CN")}
`;
    if (entry.startTime) text += `开始时间: ${new Date(entry.startTime).toLocaleString("zh-CN")}
`;
    if (entry.endTime) text += `结束时间: ${new Date(entry.endTime).toLocaleString("zh-CN")}
`;
    if (entry.duration) text += `执行耗时: ${entry.duration}ms
`;
    text += `摘要: ${entry.summary}
`;
    if (entry.error) text += `错误: ${entry.error}
`;
    if (options.includeSteps !== false) {
      text += `
=== 执行步骤 ===
`;
      for (const step of entry.steps) {
        text += `[${step.order}] ${step.description}
`;
        text += `  操作: ${step.operation}
`;
        text += `  状态: ${step.status}
`;
        if (step.permissionCheck) {
          text += `  权限检查: ${step.permissionCheck.allowed ? "通过" : "拒绝"} (${step.permissionCheck.category}/${step.permissionCheck.action})
`;
          if (step.permissionCheck.reason) text += `  原因: ${step.permissionCheck.reason}
`;
        }
        if (step.result) text += `  结果: ${step.result}
`;
        if (step.error) text += `  错误: ${step.error}
`;
        text += `
`;
      }
    }
    return text;
  }
  exportLogs(taskIds, options) {
    let content = "";
    for (const taskId of taskIds) {
      content += this.exportLog(taskId, options);
      content += "\n" + "=".repeat(50) + "\n\n";
    }
    return content;
  }
  getStatistics() {
    const entries = Array.from(this.logs.values());
    return {
      total: entries.length,
      success: entries.filter(
        (e) => e.status === "success"
        /* SUCCESS */
      ).length,
      failed: entries.filter(
        (e) => e.status === "failed"
        /* FAILED */
      ).length,
      cancelled: entries.filter(
        (e) => e.status === "cancelled"
        /* CANCELLED */
      ).length,
      byMode: {
        [ExecutionMode.SAFE]: entries.filter((e) => e.mode === ExecutionMode.SAFE).length,
        [ExecutionMode.PLAN]: entries.filter((e) => e.mode === ExecutionMode.PLAN).length,
        [ExecutionMode.CRAFT]: entries.filter((e) => e.mode === ExecutionMode.CRAFT).length
      }
    };
  }
  appendToFile(message) {
    try {
      const logFile = path.join(this.logsDir, `task-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.log`);
      fs.appendFileSync(logFile, message, "utf-8");
    } catch (error) {
      this.log.error("[TaskLog] 写入日志文件失败:", error);
    }
  }
  destroy() {
    TaskLog.instance = null;
    this.log.info("[TaskLog] 已销毁");
  }
}
const ALLOWED_EXTENSIONS = /* @__PURE__ */ new Set([
  ".txt",
  ".md",
  ".json",
  ".js",
  ".ts",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".html",
  ".css",
  ".scss",
  ".vue",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".cfg",
  ".log",
  ".csv",
  ".sql",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".webp",
  ".ico",
  ".pdf",
  ".xlsx",
  ".xls",
  ".docx",
  ".doc",
  ".pptx",
  ".ppt"
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MIME_TYPES = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".json": "application/json",
  ".js": "text/javascript",
  ".ts": "text/typescript",
  ".py": "text/python",
  ".html": "text/html",
  ".css": "text/css",
  ".vue": "text/vue",
  ".xml": "text/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".csv": "text/csv",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword"
};
class FileParser {
  constructor() {
    this.log = LogManager.getInstance();
    this.permissionManager = PermissionManager.getInstance();
  }
  static getInstance() {
    if (!FileParser.instance) {
      FileParser.instance = new FileParser();
    }
    return FileParser.instance;
  }
  /**
   * 解析文件
   */
  async parseFile(filePath) {
    try {
      const normalizedPath = this.normalizePath(filePath);
      if (!fs__namespace.existsSync(normalizedPath)) {
        return {
          success: false,
          error: "文件不存在",
          guidance: "请检查文件路径是否正确"
        };
      }
      const stats = fs__namespace.statSync(normalizedPath);
      if (stats.isDirectory()) {
        return {
          success: false,
          error: "不支持读取目录"
        };
      }
      if (stats.size > MAX_FILE_SIZE) {
        return {
          success: false,
          error: `文件大小超过限制（${MAX_FILE_SIZE / 1024 / 1024}MB）`
        };
      }
      const permCheck = this.checkPermission(normalizedPath);
      if (!permCheck.allowed) {
        return {
          success: false,
          error: `无对应文件的读取权限: ${permCheck.reason}`,
          guidance: permCheck.guidance
        };
      }
      const ext = path__namespace.extname(normalizedPath).toLowerCase();
      const name = path__namespace.basename(normalizedPath);
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return {
          success: false,
          error: `不支持的文件格式: ${ext}`
        };
      }
      const isImage = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"].includes(ext);
      const isText = [".txt", ".md", ".json", ".js", ".ts", ".py", ".html", ".css", ".vue", ".xml", ".yaml", ".yml", ".csv", ".log"].includes(ext);
      let content;
      let base64;
      if (isImage) {
        const buffer = fs__namespace.readFileSync(normalizedPath);
        base64 = buffer.toString("base64");
      } else if (isText) {
        content = fs__namespace.readFileSync(normalizedPath, "utf-8");
      }
      const file = {
        name,
        path: normalizedPath,
        size: stats.size,
        type: ext.replace(".", ""),
        mimeType: MIME_TYPES[ext] || "application/octet-stream",
        content,
        base64
      };
      this.log.info("[FileParser] 文件解析成功:", normalizedPath);
      return { success: true, file };
    } catch (error) {
      this.log.error("[FileParser] 文件解析失败:", error);
      return {
        success: false,
        error: error.message || "文件解析失败"
      };
    }
  }
  /**
   * 批量解析文件
   */
  async parseFiles(filePaths) {
    const results = [];
    for (const filePath of filePaths) {
      const result = await this.parseFile(filePath);
      results.push(result);
    }
    return results;
  }
  /**
   * 从剪贴板读取图片
   */
  readImageFromClipboard() {
    try {
      const image = electron.clipboard.readImage();
      if (image.isEmpty()) {
        return { success: false, error: "剪贴板中没有图片" };
      }
      const buffer = image.toPNG();
      const base64 = buffer.toString("base64");
      this.log.info("[FileParser] 从剪贴板读取图片成功");
      return { success: true, base64 };
    } catch (error) {
      this.log.error("[FileParser] 从剪贴板读取图片失败:", error);
      return { success: false, error: error.message };
    }
  }
  /**
   * 获取文件信息
   */
  getFileInfo(filePath) {
    try {
      const normalizedPath = this.normalizePath(filePath);
      if (!fs__namespace.existsSync(normalizedPath)) {
        return { success: false, error: "文件不存在" };
      }
      const stats = fs__namespace.statSync(normalizedPath);
      const ext = path__namespace.extname(normalizedPath).toLowerCase();
      const name = path__namespace.basename(normalizedPath);
      return {
        success: true,
        info: {
          name,
          path: normalizedPath,
          size: stats.size,
          type: ext.replace(".", ""),
          mimeType: MIME_TYPES[ext] || "application/octet-stream"
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  /**
   * 检查文件权限
   */
  checkPermission(filePath) {
    const result = this.permissionManager.checkPermission({
      category: "filesystem",
      action: "read",
      resource: filePath
    });
    if (!result.allowed) {
      return {
        allowed: false,
        reason: result.reason || "权限不足",
        guidance: "请在权限管理中启用「文件系统」的「读取」权限"
      };
    }
    return { allowed: true };
  }
  /**
   * 规范化路径
   */
  normalizePath(p) {
    if (!p) return p;
    if (p.startsWith("~")) {
      p = p.replace("~", process.env.HOME || process.env.USERPROFILE || "");
    }
    p = p.replace(/\\/g, "/");
    if (!path__namespace.isAbsolute(p)) {
      p = path__namespace.resolve(process.cwd(), p);
    }
    return p;
  }
  /**
   * 获取支持的文件扩展名
   */
  getAllowedExtensions() {
    return Array.from(ALLOWED_EXTENSIONS);
  }
  /**
   * 获取最大文件大小
   */
  getMaxFileSize() {
    return MAX_FILE_SIZE;
  }
}
class ConversationExporter {
  constructor() {
    this.log = LogManager.getInstance();
    this.permissionManager = PermissionManager.getInstance();
  }
  static getInstance() {
    if (!ConversationExporter.instance) {
      ConversationExporter.instance = new ConversationExporter();
    }
    return ConversationExporter.instance;
  }
  /**
   * 导出对话
   */
  async exportConversation(conversation, options) {
    try {
      let outputPath = options.outputPath;
      if (!outputPath) {
        const downloadsPath = electron.app.getPath("downloads");
        const timestamp = (/* @__PURE__ */ new Date()).getTime();
        const safeTitle = conversation.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_").substring(0, 20);
        switch (options.format) {
          case "markdown":
            outputPath = path__namespace.join(downloadsPath, `${safeTitle}_${timestamp}.md`);
            break;
          case "pdf":
            outputPath = path__namespace.join(downloadsPath, `${safeTitle}_${timestamp}.pdf`);
            break;
          case "word":
            outputPath = path__namespace.join(downloadsPath, `${safeTitle}_${timestamp}.docx`);
            break;
        }
      }
      const dir = path__namespace.dirname(outputPath);
      const permCheck = this.permissionManager.checkPermission({
        category: "filesystem",
        action: "write",
        resource: dir
      });
      if (!permCheck.allowed) {
        return {
          success: false,
          error: `无写入权限: ${permCheck.reason}`,
          guidance: "请在权限管理中启用「文件系统」的「写入」权限"
        };
      }
      let content;
      switch (options.format) {
        case "markdown":
          content = this.generateMarkdown(conversation);
          fs__namespace.writeFileSync(outputPath, content, "utf-8");
          break;
        case "pdf":
          content = this.generateMarkdown(conversation);
          await this.generatePdf(content, outputPath);
          break;
        case "word":
          content = this.generateMarkdown(conversation);
          await this.generateWord(content, outputPath);
          break;
      }
      this.log.info("[ConversationExporter] 导出成功:", outputPath);
      return { success: true, filePath: outputPath };
    } catch (error) {
      this.log.error("[ConversationExporter] 导出失败:", error);
      return {
        success: false,
        error: error.message || "导出失败"
      };
    }
  }
  /**
   * 生成Markdown内容
   */
  generateMarkdown(conversation) {
    const lines = [];
    lines.push(`# ${conversation.title}`);
    lines.push("");
    lines.push(`**创建时间:** ${new Date(conversation.createdAt).toLocaleString("zh-CN")}`);
    lines.push(`**模型:** ${conversation.modelId || "未指定"}`);
    lines.push("");
    lines.push("---");
    lines.push("");
    for (const message of conversation.messages) {
      const roleIcon = message.role === "user" ? "👤" : "🤖";
      const roleName = message.role === "user" ? "用户" : "AI";
      const time = new Date(message.timestamp).toLocaleString("zh-CN");
      lines.push(`### ${roleIcon} ${roleName} - ${time}`);
      lines.push("");
      if (message.thinking) {
        lines.push("**思考过程:**");
        lines.push("```");
        lines.push(message.thinking);
        lines.push("```");
        lines.push("");
      }
      const content = message.content || "(无内容)";
      lines.push(content);
      lines.push("");
      lines.push("---");
      lines.push("");
    }
    lines.push("");
    lines.push(`*导出时间: ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")}*`);
    return lines.join("\n");
  }
  /**
   * 生成PDF（简化版，实际项目可能需要用puppeteer或jspdf）
   */
  async generatePdf(markdownContent, outputPath) {
    const html = this.markdownToHtml(markdownContent);
    fs__namespace.writeFileSync(outputPath.replace(".pdf", ".html"), html, "utf-8");
    this.log.warn("[ConversationExporter] PDF导出需要额外的PDF库，当前保存为HTML");
  }
  /**
   * 生成Word（简化版，实际项目可能需要用docx库）
   */
  async generateWord(markdownContent, outputPath) {
    const html = this.markdownToHtml(markdownContent);
    const docContent = this.htmlToWord(html, outputPath.replace(".docx", ".html"));
    fs__namespace.writeFileSync(outputPath.replace(".docx", ".html"), docContent, "utf-8");
    this.log.warn("[ConversationExporter] Word导出需要额外的库，当前保存为HTML");
  }
  /**
   * Markdown转HTML
   */
  markdownToHtml(markdown) {
    let html = markdown.replace(/^### (.*)$/gm, "<h3>$1</h3>").replace(/^## (.*)$/gm, "<h2>$1</h2>").replace(/^# (.*)$/gm, "<h1>$1</h1>").replace(/\*\*(.*)\*\*/g, "<strong>$1</strong>").replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>").replace(/---/g, "<hr>").replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>");
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>对话导出</title>
  <style>
    body { font-family: 'Microsoft YaHei', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1, h2, h3 { color: #333; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
    code { font-family: 'Consolas', monospace; }
    hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
    .meta { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <p>${html}</p>
</body>
</html>`;
  }
  /**
   * HTML转Word格式
   */
  htmlToWord(html, title) {
    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
    </w:WordDocument>
  </xml>
  <![endif]-->
</head>
<body>
  ${html}
</body>
</html>`;
  }
}
class OpenClawExecutor {
  constructor() {
    this.log = LogManager.getInstance();
    this.gateway = OpenClawGateway.getInstance();
    this.maxRetries = 3;
    this.log.info("[OpenClawExecutor] 初始化中...");
    this.log.info("[OpenClawExecutor] 初始化完成");
  }
  static getInstance() {
    if (!OpenClawExecutor.instance) {
      OpenClawExecutor.instance = new OpenClawExecutor();
    }
    return OpenClawExecutor.instance;
  }
  /**
   * 设置最大重试次数
   */
  setMaxRetries(retries) {
    this.maxRetries = Math.max(0, Math.min(10, retries));
    this.log.info(`[OpenClawExecutor] 最大重试次数设置为: ${this.maxRetries}`);
  }
  /**
   * 执行单个操作（带重试）
   */
  async executeWithRetry(request, retries = this.maxRetries) {
    const operationId = request.operationId || `op_${Date.now()}`;
    let lastError = null;
    this.log.info(`[OpenClawExecutor] 开始执行操作: ${request.operationType}, ID: ${operationId}, 重试次数: ${retries}`);
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        this.log.debug(`[OpenClawExecutor] 尝试执行第 ${attempt + 1}/${retries + 1} 次`);
        const result = await this.gateway.executeOperation({
          ...request,
          operationId
        });
        if (result.success) {
          this.log.info(`[OpenClawExecutor] 操作执行成功: ${request.operationType}`);
          return result;
        } else {
          lastError = new Error(result.error || "操作失败");
          this.log.warn(`[OpenClawExecutor] 操作执行失败 (尝试 ${attempt + 1}/${retries + 1}): ${result.error}`);
        }
      } catch (error) {
        lastError = error;
        this.log.warn(`[OpenClawExecutor] 操作异常 (尝试 ${attempt + 1}/${retries + 1}):`, error);
      }
      if (attempt < retries) {
        const waitTime = Math.min(1e3 * Math.pow(2, attempt), 5e3);
        this.log.debug(`[OpenClawExecutor] 等待 ${waitTime}ms 后重试...`);
        await this.sleep(waitTime);
      }
    }
    const finalResult = {
      success: false,
      operationType: request.operationType,
      operationId,
      status: "failed",
      error: (lastError == null ? void 0 : lastError.message) || "操作执行失败，已耗尽重试次数",
      errorCode: "MAX_RETRIES_EXCEEDED"
    };
    this.log.error(`[OpenClawExecutor] 操作最终失败: ${request.operationType}`, lastError);
    return finalResult;
  }
  /**
   * 批量执行操作
   */
  async executeBatch(request) {
    const { operations, failFast = false, parallel = false } = request;
    const startTime = Date.now();
    const results = [];
    this.log.info(`[OpenClawExecutor] 开始批量执行: ${operations.length} 个操作, failFast: ${failFast}, parallel: ${parallel}`);
    try {
      if (parallel) {
        this.log.debug("[OpenClawExecutor] 使用并行执行模式");
        const promises = operations.map(
          (op, index) => this.executeWithRetry({ ...op, operationId: op.operationId || `batch_op_${index}` })
        );
        results.push(...await Promise.all(promises));
      } else {
        this.log.debug("[OpenClawExecutor] 使用串行执行模式");
        for (let i = 0; i < operations.length; i++) {
          const op = operations[i];
          const result = await this.executeWithRetry({
            ...op,
            operationId: op.operationId || `batch_op_${i}`
          });
          results.push(result);
          if (failFast && !result.success) {
            this.log.warn(`[OpenClawExecutor] 快速失败: 第 ${i + 1} 个操作失败，停止后续执行`);
            break;
          }
        }
      }
      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.filter((r) => !r.success).length;
      const allSuccess = failedCount === 0;
      const summary = allSuccess ? `所有 ${operations.length} 个操作执行成功` : `${successCount} 个操作成功, ${failedCount} 个操作失败`;
      const batchResult = {
        success: allSuccess,
        total: operations.length,
        completed: successCount,
        failed: failedCount,
        results,
        summary,
        duration: Date.now() - startTime
      };
      this.log.info(`[OpenClawExecutor] 批量执行完成: ${summary}, 耗时: ${batchResult.duration}ms`);
      return batchResult;
    } catch (error) {
      this.log.error("[OpenClawExecutor] 批量执行异常:", error);
      return {
        success: false,
        total: operations.length,
        completed: results.filter((r) => r.success).length,
        failed: operations.length - results.filter((r) => r.success).length,
        results,
        summary: `批量执行异常: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }
  /**
   * 获取审计日志
   */
  getAuditLogs(limit = 100) {
    return this.gateway.getAuditLogs(limit);
  }
  /**
   * 工具方法：延时
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
class IpcServer {
  constructor() {
    this.log = LogManager.getInstance();
    this.handlers = /* @__PURE__ */ new Map();
  }
  static getInstance() {
    if (!IpcServer.instance) {
      IpcServer.instance = new IpcServer();
    }
    return IpcServer.instance;
  }
  registerHandlers() {
    this.log.info("注册IPC处理器");
    for (const channel of Object.keys(electron.ipcMain.eventNames())) {
      try {
        electron.ipcMain.removeHandler(channel);
      } catch (e) {
      }
    }
    electron.ipcMain.handle("dialog:openFile", async (_, options) => {
      try {
        const result = await electron.dialog.showOpenDialog(options);
        return result;
      } catch (error) {
        this.log.error("dialog:openFile 失败", error);
        return { canceled: true, filePaths: [] };
      }
    });
    electron.ipcMain.handle("window:minimize", async () => {
      try {
        const windowManager2 = WindowManager.getInstance();
        windowManager2.minimize();
        return { success: true };
      } catch (error) {
        this.log.error("window:minimize 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("window:maximize", async () => {
      try {
        const windowManager2 = WindowManager.getInstance();
        windowManager2.toggleMaximize();
        return { success: true };
      } catch (error) {
        this.log.error("window:maximize 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("window:close", async () => {
      try {
        const windowManager2 = WindowManager.getInstance();
        windowManager2.close();
        return { success: true };
      } catch (error) {
        this.log.error("window:close 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("window:isMaximized", async () => {
      try {
        const windowManager2 = WindowManager.getInstance();
        const isMaximized = windowManager2.isMaximized();
        return { success: true, data: isMaximized };
      } catch (error) {
        this.log.error("window:isMaximized 失败", error);
        return { success: true, data: false };
      }
    });
    electron.ipcMain.handle("window:setAlwaysOnTop", (_, value) => {
      try {
        const windowManager2 = WindowManager.getInstance();
        windowManager2.setAlwaysOnTop(value);
        return { success: true };
      } catch (error) {
        this.log.error("window:setAlwaysOnTop 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("window:isAlwaysOnTop", () => {
      try {
        const windowManager2 = WindowManager.getInstance();
        return { success: true, data: windowManager2.isAlwaysOnTop() };
      } catch (error) {
        this.log.error("window:isAlwaysOnTop 失败", error);
        return { success: true, data: false };
      }
    });
    electron.ipcMain.handle("window:setEdgeHide", (_, value) => {
      try {
        const windowManager2 = WindowManager.getInstance();
        windowManager2.setEdgeHideEnabled(value);
        if (value) {
          windowManager2.setupEdgeHide();
        }
        return { success: true };
      } catch (error) {
        this.log.error("window:setEdgeHide 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("window:isEdgeHide", () => {
      try {
        const windowManager2 = WindowManager.getInstance();
        return { success: true, data: windowManager2.isEdgeHideEnabled() };
      } catch (error) {
        this.log.error("window:isEdgeHide 失败", error);
        return { success: true, data: false };
      }
    });
    electron.ipcMain.handle("window:showMini", () => {
      try {
        const { MiniWindow: MiniWindow2 } = require("../core/MiniWindow");
        MiniWindow2.getInstance().show();
        return { success: true };
      } catch (error) {
        this.log.error("window:showMini 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("window:hideToTray", () => {
      try {
        const { TrayManager: TrayManager2 } = require("../core/TrayManager");
        TrayManager2.getInstance().hideMainWindow();
        return { success: true };
      } catch (error) {
        this.log.error("window:hideToTray 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("shortcut:get", () => {
      try {
        const { GlobalShortcut: GlobalShortcut2 } = require("../core/GlobalShortcut");
        const config = GlobalShortcut2.getInstance().getShortcutConfig();
        return { success: true, data: config };
      } catch (error) {
        this.log.error("shortcut:get 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("shortcut:set", (_, key, accelerator) => {
      try {
        const { GlobalShortcut: GlobalShortcut2 } = require("../core/GlobalShortcut");
        const result = GlobalShortcut2.getInstance().updateShortcut(key, accelerator);
        return { success: result };
      } catch (error) {
        this.log.error("shortcut:set 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("gateway:start", async (_, options) => {
      try {
        const gateway2 = OpenClawGateway.getInstance();
        const result = await gateway2.start(options || {});
        return { success: result.success, error: result.error, data: gateway2.getStatus() };
      } catch (error) {
        this.log.error("gateway:start 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("gateway:stop", async () => {
      try {
        const gateway2 = OpenClawGateway.getInstance();
        const result = await gateway2.stop();
        return { success: result.success };
      } catch (error) {
        this.log.error("gateway:stop 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("gateway:restart", async () => {
      try {
        const gateway2 = OpenClawGateway.getInstance();
        const result = await gateway2.restart();
        return { success: result.success, error: result.error, data: gateway2.getStatus() };
      } catch (error) {
        this.log.error("gateway:restart 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("gateway:status", async () => {
      try {
        const gateway2 = OpenClawGateway.getInstance();
        return { success: true, data: gateway2.getStatus() };
      } catch (error) {
        this.log.error("gateway:status 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("gateway:repair", async () => {
      try {
        const gateway2 = OpenClawGateway.getInstance();
        const result = await gateway2.repair();
        return { success: result.success, error: result.error };
      } catch (error) {
        this.log.error("gateway:repair 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("gateway:logs", async () => {
      try {
        const gateway2 = OpenClawGateway.getInstance();
        return { success: true, data: gateway2.getAuditLogs() };
      } catch (error) {
        this.log.error("gateway:logs 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("gateway:config:get", async () => {
      try {
        const gatewayConfig = GatewayConfig.getInstance();
        return { success: true, data: gatewayConfig.getConfig() };
      } catch (error) {
        this.log.error("gateway:config:get 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("gateway:config:set", async (_, config) => {
      try {
        const gatewayConfig = GatewayConfig.getInstance();
        gatewayConfig.setAll(config);
        return { success: true };
      } catch (error) {
        this.log.error("gateway:config:set 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("hermes:getMemories", async () => {
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
        this.log.error("hermes:getMemories 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("hermes:saveCoreMemory", async (_, content) => {
      try {
        const hermesMemory = HermesMemory.getInstance();
        hermesMemory.updateCoreMemory(content);
        return { success: true };
      } catch (error) {
        this.log.error("hermes:saveCoreMemory 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("skills:list", async () => {
      try {
        const skillLoader = SkillLoader.getInstance();
        const skills = skillLoader.getAllSkills();
        return { success: true, data: skills };
      } catch (error) {
        this.log.error("skills:list 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("skills:toggle", async (_, skillId, enabled) => {
      try {
        const skillLoader = SkillLoader.getInstance();
        const success = skillLoader.toggleSkill(skillId, enabled);
        return { success };
      } catch (error) {
        this.log.error("skills:toggle 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("skills:reload", async () => {
      try {
        const skillLoader = SkillLoader.getInstance();
        skillLoader.reloadSkills();
        const skills = skillLoader.getAllSkills();
        return { success: true, data: skills };
      } catch (error) {
        this.log.error("skills:reload 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("skills:importFile", async (_, filePath) => {
      try {
        const skillLoader = SkillLoader.getInstance();
        const result = await skillLoader.importSkillFromFile(filePath);
        const skills = skillLoader.getAllSkills();
        return { success: result.success, error: result.error, skillId: result.skillId, data: skills };
      } catch (error) {
        this.log.error("skills:importFile 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("skills:importUrl", async (_, url2) => {
      try {
        const skillLoader = SkillLoader.getInstance();
        const result = await skillLoader.importSkillFromUrl(url2);
        const skills = skillLoader.getAllSkills();
        return { success: result.success, error: result.error, skillId: result.skillId, data: skills };
      } catch (error) {
        this.log.error("skills:importUrl 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("app:version", async () => {
      try {
        return { success: true, data: electron.app.getVersion() };
      } catch (error) {
        this.log.error("app:version 失败", error);
        return { success: true, data: "1.0.0" };
      }
    });
    electron.ipcMain.handle("config:get", (_, key) => {
      try {
        const configStore = ConfigStore.getInstance();
        return { success: true, data: configStore.get(key) };
      } catch (error) {
        this.log.error("config:get 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("config:set", (_, key, value) => {
      try {
        const configStore = ConfigStore.getInstance();
        configStore.set(key, value);
        return { success: true };
      } catch (error) {
        this.log.error("config:set 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("config:getAll", () => {
      try {
        const configStore = ConfigStore.getInstance();
        return { success: true, data: configStore.getAll() };
      } catch (error) {
        this.log.error("config:getAll 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("models:list", () => {
      try {
        const modelManager = ModelManager.getInstance();
        const providers = modelManager.getAllProviders();
        return { success: true, data: providers };
      } catch (error) {
        this.log.error("models:list 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("models:get", (_, id) => {
      try {
        const modelManager = ModelManager.getInstance();
        const provider = modelManager.getProvider(id);
        return { success: true, data: provider };
      } catch (error) {
        this.log.error("models:get 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("models:add", (_, data) => {
      try {
        const modelManager = ModelManager.getInstance();
        const provider = modelManager.addProvider(data);
        return { success: true, data: provider };
      } catch (error) {
        this.log.error("models:add 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("models:update", (_, id, updates) => {
      try {
        const modelManager = ModelManager.getInstance();
        const provider = modelManager.updateProvider(id, updates);
        return { success: true, data: provider };
      } catch (error) {
        this.log.error("models:update 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("models:delete", (_, id) => {
      try {
        const modelManager = ModelManager.getInstance();
        const deleted = modelManager.deleteProvider(id);
        return { success: true, data: deleted };
      } catch (error) {
        this.log.error("models:delete 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("models:toggle", (_, id, enabled) => {
      try {
        const modelManager = ModelManager.getInstance();
        const result = modelManager.setProviderEnabled(id, enabled);
        return { success: true, data: result };
      } catch (error) {
        this.log.error("models:toggle 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("models:test", async (_, providerId, modelId) => {
      try {
        const modelManager = ModelManager.getInstance();
        const result = await modelManager.testProvider(providerId, modelId);
        return { success: true, data: result };
      } catch (error) {
        this.log.error("models:test 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("models:syncOllama", async (_, providerId) => {
      try {
        const modelManager = ModelManager.getInstance();
        const models = await modelManager.syncOllamaModels(providerId);
        return { success: true, data: models };
      } catch (error) {
        this.log.error("models:syncOllama 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("permissions:list", () => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const sets = permissionManager.getAllPermissionSets();
        return { success: true, data: sets };
      } catch (error) {
        this.log.error("permissions:list 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("permissions:get", (_, id) => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const set = permissionManager.getPermissionSet(id);
        return { success: true, data: set };
      } catch (error) {
        this.log.error("permissions:get 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("permissions:active", () => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const active = permissionManager.getActivePermissionSet();
        return { success: true, data: active };
      } catch (error) {
        this.log.error("permissions:active 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("permissions:setActive", (_, id) => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const result = permissionManager.setActivePermissionSet(id);
        return { success: true, data: result };
      } catch (error) {
        this.log.error("permissions:setActive 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("permissions:create", (_, data) => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const set = permissionManager.createPermissionSet(data);
        return { success: true, data: set };
      } catch (error) {
        this.log.error("permissions:create 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("permissions:update", (_, id, updates) => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const set = permissionManager.updatePermissionSet(id, updates);
        return { success: true, data: set };
      } catch (error) {
        this.log.error("permissions:update 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("permissions:updateRule", (_, setId, ruleId, updates) => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const rule = permissionManager.updatePermissionRule(setId, ruleId, updates);
        return { success: true, data: rule };
      } catch (error) {
        this.log.error("permissions:updateRule 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("permissions:delete", (_, id) => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const result = permissionManager.deletePermissionSet(id);
        return { success: true, data: result };
      } catch (error) {
        this.log.error("permissions:delete 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("permissions:duplicate", (_, id, newName) => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const set = permissionManager.duplicatePermissionSet(id, newName);
        return { success: true, data: set };
      } catch (error) {
        this.log.error("permissions:duplicate 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("permissions:check", (_, request) => {
      try {
        const permissionManager = PermissionManager.getInstance();
        const result = permissionManager.checkPermission(request);
        return { success: true, data: result };
      } catch (error) {
        this.log.error("permissions:check 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("chat:conversations", () => {
      try {
        const chatManager = ChatManager.getInstance();
        const conversations = chatManager.getAllConversations();
        return { success: true, data: conversations };
      } catch (error) {
        this.log.error("chat:conversations 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("chat:conversation:get", (_, id) => {
      try {
        const chatManager = ChatManager.getInstance();
        const conversation = chatManager.getConversation(id);
        return { success: true, data: conversation };
      } catch (error) {
        this.log.error("chat:conversation:get 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("chat:conversation:create", (_, data) => {
      try {
        const chatManager = ChatManager.getInstance();
        const conversation = chatManager.createConversation(data);
        return { success: true, data: conversation };
      } catch (error) {
        this.log.error("chat:conversation:create 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("chat:conversation:update", (_, id, updates) => {
      try {
        const chatManager = ChatManager.getInstance();
        const conversation = chatManager.updateConversation(id, updates);
        return { success: true, data: conversation };
      } catch (error) {
        this.log.error("chat:conversation:update 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("chat:conversation:delete", (_, id) => {
      try {
        const chatManager = ChatManager.getInstance();
        const result = chatManager.deleteConversation(id);
        return { success: true, data: result };
      } catch (error) {
        this.log.error("chat:conversation:delete 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("chat:conversation:archive", (_, id) => {
      try {
        const chatManager = ChatManager.getInstance();
        const conversation = chatManager.archiveConversation(id);
        return { success: true, data: conversation };
      } catch (error) {
        this.log.error("chat:conversation:archive 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("chat:conversation:pin", (_, id, pinned) => {
      try {
        const chatManager = ChatManager.getInstance();
        const conversation = chatManager.pinConversation(id, pinned);
        return { success: true, data: conversation };
      } catch (error) {
        this.log.error("chat:conversation:pin 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("chat:message:send", async (_, conversationId, content, providerId, modelId) => {
      try {
        const chatManager = ChatManager.getInstance();
        const message = await chatManager.sendMessage(conversationId, content, providerId, modelId);
        return { success: true, data: message };
      } catch (error) {
        this.log.error("chat:message:send 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("chat:message:stop", (_, conversationId) => {
      try {
        const chatManager = ChatManager.getInstance();
        chatManager.stopGeneration(conversationId);
        return { success: true };
      } catch (error) {
        this.log.error("chat:message:stop 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("chat:message:continue", async (_, conversationId) => {
      try {
        const chatManager = ChatManager.getInstance();
        await chatManager.continueGeneration(conversationId);
        return { success: true };
      } catch (error) {
        this.log.error("chat:message:continue 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("chat:lastModel:get", () => {
      var _a, _b;
      try {
        const chatManager = ChatManager.getInstance();
        const config = chatManager.config;
        return {
          success: true,
          data: {
            providerId: ((_a = config.getLastProvider) == null ? void 0 : _a.call(config)) || null,
            modelId: ((_b = config.getLastModel) == null ? void 0 : _b.call(config)) || null
          }
        };
      } catch (error) {
        this.log.error("chat:lastModel:get 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("chat:settings:get", () => {
      try {
        const chatManager = ChatManager.getInstance();
        const settings = chatManager.getSettings();
        return { success: true, data: settings };
      } catch (error) {
        this.log.error("chat:settings:get 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("chat:settings:update", (_, settings) => {
      try {
        const chatManager = ChatManager.getInstance();
        const result = chatManager.updateSettings(settings);
        return { success: true, data: result };
      } catch (error) {
        this.log.error("chat:settings:update 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("task:execute", async (_, task) => {
      try {
        this.log.info("[IpcServer] 收到任务执行请求");
        const safeTask = JSON.parse(JSON.stringify(task));
        this.log.info("[IpcServer] 安全序列化完成");
        const taskExecutor = TaskExecutor.getInstance();
        const result = await taskExecutor.executeTask(safeTask);
        const safeResult = JSON.parse(JSON.stringify(result));
        return { success: true, data: safeResult };
      } catch (error) {
        this.log.error("task:execute 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("task:executeTool", async (_, request) => {
      try {
        const taskExecutor = TaskExecutor.getInstance();
        const result = await taskExecutor.executeToolCall(request);
        return { success: true, data: result };
      } catch (error) {
        this.log.error("task:executeTool 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("task:toolsGet", () => {
      try {
        const taskExecutor = TaskExecutor.getInstance();
        const tools = taskExecutor.getAvailableTools();
        return { success: true, data: tools };
      } catch (error) {
        this.log.error("task:toolsGet 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("task:gatewayCheck", () => {
      try {
        const taskExecutor = TaskExecutor.getInstance();
        const isRunning = taskExecutor.isGatewayRunning();
        return { success: true, data: isRunning };
      } catch (error) {
        this.log.error("task:gatewayCheck 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("task:trace", (_, data) => {
      try {
        this.log.info("[IpcServer] 任务追踪事件", data);
        return { success: true };
      } catch (error) {
        this.log.error("task:trace 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("task:confirm-preview", async (_, taskId, confirmed, editedContent) => {
      try {
        this.log.info("[IpcServer] 收到用户确认", { taskId, confirmed, hasEditedContent: !!editedContent });
        const chatManager = ChatManager.getInstance();
        const result = await chatManager.handleUserConfirmation(taskId, confirmed, editedContent);
        return { success: true, data: result };
      } catch (error) {
        this.log.error("task:confirm-preview 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("execution:mode:get", () => {
      try {
        const configStore = ConfigStore.getInstance();
        const mode = configStore.get("execution.mode") || "craft";
        return { success: true, data: mode };
      } catch (error) {
        this.log.error("execution:mode:get 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("execution:mode:set", (_, mode) => {
      try {
        const configStore = ConfigStore.getInstance();
        configStore.set("execution.mode", mode);
        this.log.info("设置执行模式:", mode);
        return { success: true };
      } catch (error) {
        this.log.error("execution:mode:set 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("execution:mode:check", (_, operation, params) => {
      try {
        const configStore = ConfigStore.getInstance();
        const mode = configStore.get("execution.mode") || "craft";
        const permissionManager = PermissionManager.getInstance();
        if (mode === "safe") {
          return {
            success: true,
            data: {
              allowed: false,
              checkLevel: "blocked",
              reason: "当前为安全模式，禁止执行操作",
              guidance: "请切换到「计划模式」或「全量模式」后再试"
            }
          };
        }
        const riskLevel = RISK_LEVEL_MAP[operation] || "medium";
        const isHighRisk = HIGH_RISK_OPERATIONS.includes(operation);
        if (isHighRisk && mode === "craft") {
          return {
            success: true,
            data: {
              allowed: true,
              checkLevel: "requires_confirmation",
              reason: "高危操作需要二次确认",
              guidance: "请在弹窗中确认是否继续执行"
            }
          };
        }
        const permMap = {
          read_file: { category: "filesystem", action: "read" },
          write_file: { category: "filesystem", action: "write" },
          create_file: { category: "filesystem", action: "write" },
          delete_file: { category: "filesystem", action: "delete" },
          list_directory: { category: "filesystem", action: "list" },
          create_directory: { category: "filesystem", action: "create" },
          file_exists: { category: "filesystem", action: "read" },
          run_command: { category: "shell", action: "execute" },
          open_url: { category: "system", action: "read" },
          clipboard_read: { category: "clipboard", action: "read" },
          clipboard_write: { category: "clipboard", action: "write" }
        };
        const config = permMap[operation];
        if (!config) {
          return {
            success: true,
            data: {
              allowed: true,
              checkLevel: "passed"
            }
          };
        }
        const result = permissionManager.checkPermission({
          category: config.category,
          action: config.action
        });
        return {
          success: true,
          data: {
            allowed: result.allowed,
            checkLevel: result.allowed ? "passed" : "blocked",
            reason: result.allowed ? void 0 : result.reason,
            guidance: result.allowed ? void 0 : `请在权限设置中启用「${config.category}」的「${config.action}」权限`
          }
        };
      } catch (error) {
        this.log.error("execution:mode:check 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("execution:mode:cancel", () => {
      return { success: true };
    });
    electron.ipcMain.handle("task:log:get", (_, taskId) => {
      try {
        const taskLog = TaskLog.getInstance();
        const entry = taskLog.getLog(taskId);
        return { success: true, data: entry };
      } catch (error) {
        this.log.error("task:log:get 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("task:log:query", (_, query) => {
      try {
        const taskLog = TaskLog.getInstance();
        const entries = taskLog.queryLogs(query);
        return { success: true, data: entries };
      } catch (error) {
        this.log.error("task:log:query 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("task:log:delete", (_, taskId) => {
      try {
        const taskLog = TaskLog.getInstance();
        const deleted = taskLog.deleteLog(taskId);
        return { success: true, data: deleted };
      } catch (error) {
        this.log.error("task:log:delete 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("task:log:deleteBatch", (_, taskIds) => {
      try {
        const taskLog = TaskLog.getInstance();
        const count = taskLog.deleteLogs(taskIds);
        return { success: true, data: count };
      } catch (error) {
        this.log.error("task:log:deleteBatch 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("task:log:export", (_, taskId, format) => {
      try {
        const taskLog = TaskLog.getInstance();
        const content = taskLog.exportLog(taskId, { format, includeSteps: true });
        return { success: true, data: content };
      } catch (error) {
        this.log.error("task:log:export 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("task:log:stats", () => {
      try {
        const taskLog = TaskLog.getInstance();
        const stats = taskLog.getStatistics();
        return { success: true, data: stats };
      } catch (error) {
        this.log.error("task:log:stats 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("task:log:retry", async (_, taskId) => {
      try {
        const taskLog = TaskLog.getInstance();
        const entry = taskLog.getLog(taskId);
        if (!entry) {
          return { success: false, error: "任务不存在" };
        }
        const taskExecutor = TaskExecutor.getInstance();
        const task = {
          id: `retry_${taskId}_${Date.now()}`,
          conversationId: entry.conversationId,
          messageId: "",
          instruction: entry.instruction,
          steps: entry.steps.map((s) => ({
            id: `step_${s.order}`,
            order: s.order,
            type: s.operation || "filesystem",
            description: s.description,
            params: s.params,
            status: "pending"
          })),
          status: "pending",
          createdAt: Date.now()
        };
        const result = await taskExecutor.executeTask(task);
        return { success: true, data: result };
      } catch (error) {
        this.log.error("task:log:retry 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("task:log:cancel", (_, taskId) => {
      try {
        const taskLog = TaskLog.getInstance();
        taskLog.cancelTask(taskId, "用户取消");
        return { success: true };
      } catch (error) {
        this.log.error("task:log:cancel 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("file:parse", async (_, filePath) => {
      try {
        const fileParser = FileParser.getInstance();
        const result = await fileParser.parseFile(filePath);
        return { success: result.success, data: result.file, error: result.error, guidance: result.guidance };
      } catch (error) {
        this.log.error("file:parse 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("file:parseBatch", async (_, filePaths) => {
      try {
        const fileParser = FileParser.getInstance();
        const results = await fileParser.parseFiles(filePaths);
        return { success: true, data: results };
      } catch (error) {
        this.log.error("file:parseBatch 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("file:readClipboardImage", () => {
      try {
        const fileParser = FileParser.getInstance();
        const result = fileParser.readImageFromClipboard();
        return { success: result.success, data: { base64: result.base64 }, error: result.error };
      } catch (error) {
        this.log.error("file:readClipboardImage 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("file:getInfo", (_, filePath) => {
      try {
        const fileParser = FileParser.getInstance();
        const result = fileParser.getFileInfo(filePath);
        return { success: result.success, data: result.info, error: result.error };
      } catch (error) {
        this.log.error("file:getInfo 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("file:getAllowedExtensions", () => {
      try {
        const fileParser = FileParser.getInstance();
        const extensions = fileParser.getAllowedExtensions();
        return { success: true, data: extensions };
      } catch (error) {
        this.log.error("file:getAllowedExtensions 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("conversation:export", async (_, conversation, format, outputPath) => {
      try {
        const exporter = ConversationExporter.getInstance();
        const result = await exporter.exportConversation(conversation, {
          format,
          outputPath: outputPath || ""
        });
        return { success: result.success, data: { filePath: result.filePath }, error: result.error, guidance: result.guidance };
      } catch (error) {
        this.log.error("conversation:export 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("openclaw:execute", async (_, request) => {
      try {
        this.log.info("[IpcServer] openclaw:execute 被调用", request);
        const gateway2 = OpenClawGateway.getInstance();
        const result = await gateway2.executeOperation(request);
        return { success: result.success, data: result };
      } catch (error) {
        this.log.error("openclaw:execute 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("openclaw:batch-execute", async (_, request) => {
      try {
        this.log.info("[IpcServer] openclaw:batch-execute 被调用");
        const executor = OpenClawExecutor.getInstance();
        const result = await executor.executeBatch(request);
        return { success: result.success, data: result };
      } catch (error) {
        this.log.error("openclaw:batch-execute 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("openclaw:check-permission", async (_, request) => {
      try {
        this.log.info("[IpcServer] openclaw:check-permission 被调用", request);
        const gateway2 = OpenClawGateway.getInstance();
        const result = gateway2.checkPermission(request);
        return { success: true, data: result };
      } catch (error) {
        this.log.error("openclaw:check-permission 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("openclaw:get-audit-logs", async (_, limit) => {
      try {
        const gateway2 = OpenClawGateway.getInstance();
        const logs = gateway2.getAuditLogs(limit);
        return { success: true, data: logs };
      } catch (error) {
        this.log.error("openclaw:get-audit-logs 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("openclaw:health-check", async () => {
      try {
        this.log.info("[IpcServer] openclaw:health-check 被调用");
        const taskExecutor = TaskExecutor.getInstance();
        const isRunning = taskExecutor.isGatewayRunning();
        const gateway2 = OpenClawGateway.getInstance();
        const gatewayStatus = gateway2.getStatus();
        const healthy = isRunning && gatewayStatus.state === "running";
        const result = {
          healthy,
          status: healthy ? "running" : gatewayStatus.state,
          version: "1.0.0",
          timestamp: Date.now(),
          error: healthy ? void 0 : gatewayStatus.error
        };
        this.log.info("[IpcServer] 健康检查结果", result);
        return { success: true, data: result };
      } catch (error) {
        this.log.error("openclaw:health-check 失败", error);
        return {
          success: false,
          error: String(error),
          data: {
            healthy: false,
            status: "failed",
            timestamp: Date.now(),
            error: String(error)
          }
        };
      }
    });
    electron.ipcMain.handle("mcp:list", () => {
      try {
        const configStore = ConfigStore.getInstance();
        const mcpServers = configStore.get("mcp.servers") || [];
        return { success: true, data: mcpServers };
      } catch (error) {
        this.log.error("mcp:list 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("mcp:add", (_, data) => {
      try {
        const configStore = ConfigStore.getInstance();
        const mcpServers = configStore.get("mcp.servers") || [];
        const existingServer = mcpServers.find((server) => server.name === data.name);
        if (existingServer) {
          return { success: false, error: "MCP Server 名称已存在" };
        }
        const newServer = {
          ...data,
          id: `mcp_${Date.now()}`
        };
        mcpServers.push(newServer);
        configStore.set("mcp.servers", mcpServers);
        this.log.info("MCP Server 添加成功", { name: data.name });
        return { success: true, data: newServer };
      } catch (error) {
        this.log.error("mcp:add 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("mcp:update", (_, data) => {
      try {
        const configStore = ConfigStore.getInstance();
        let mcpServers = configStore.get("mcp.servers") || [];
        const index = mcpServers.findIndex((server) => server.name === data.name);
        if (index === -1) {
          return { success: false, error: "MCP Server 不存在" };
        }
        mcpServers[index] = { ...mcpServers[index], ...data };
        configStore.set("mcp.servers", mcpServers);
        this.log.info("MCP Server 更新成功", { name: data.name });
        return { success: true, data: mcpServers[index] };
      } catch (error) {
        this.log.error("mcp:update 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("mcp:remove", (_, name) => {
      try {
        const configStore = ConfigStore.getInstance();
        let mcpServers = configStore.get("mcp.servers") || [];
        const index = mcpServers.findIndex((server) => server.name === name);
        if (index === -1) {
          return { success: false, error: "MCP Server 不存在" };
        }
        mcpServers.splice(index, 1);
        configStore.set("mcp.servers", mcpServers);
        this.log.info("MCP Server 删除成功", { name });
        return { success: true };
      } catch (error) {
        this.log.error("mcp:remove 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("mcp:toggle", (_, name, enabled) => {
      try {
        const configStore = ConfigStore.getInstance();
        let mcpServers = configStore.get("mcp.servers") || [];
        const index = mcpServers.findIndex((server) => server.name === name);
        if (index === -1) {
          return { success: false, error: "MCP Server 不存在" };
        }
        mcpServers[index].enabled = enabled;
        configStore.set("mcp.servers", mcpServers);
        this.log.info("MCP Server 状态更新成功", { name, enabled });
        return { success: true };
      } catch (error) {
        this.log.error("mcp:toggle 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("mcp:test", async (_, name) => {
      try {
        const configStore = ConfigStore.getInstance();
        const mcpServers = configStore.get("mcp.servers") || [];
        const server = mcpServers.find((s) => s.name === name);
        if (!server) {
          return { success: false, error: "MCP Server 不存在" };
        }
        this.log.info("测试 MCP Server 连接", { name });
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        return { success: true };
      } catch (error) {
        this.log.error("mcp:test 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("permissions:reset", async () => {
      try {
        this.log.info("[IpcServer] permissions:reset 被调用，强制重置为开放模式");
        const { PermissionConfig: PermissionConfig2 } = require("../permissions/PermissionConfig");
        const permissionConfig = PermissionConfig2.getInstance();
        const success = permissionConfig.forceResetToPermissive();
        if (success) {
          this.log.info("[IpcServer] 权限重置成功");
          return { success: true };
        } else {
          this.log.error("[IpcServer] 权限重置失败");
          return { success: false, error: "权限重置失败" };
        }
      } catch (error) {
        this.log.error("permissions:reset 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("learning:get-stats", () => {
      try {
        const selfLearner = SelfLearner.getInstance();
        const stats = selfLearner.getStats();
        return { success: true, data: stats };
      } catch (error) {
        this.log.error("learning:get-stats 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("learning:reset", () => {
      try {
        const selfLearner = SelfLearner.getInstance();
        selfLearner.resetStats();
        this.log.info("学习统计已重置");
        return { success: true };
      } catch (error) {
        this.log.error("learning:reset 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("learning:save-skill-proposal", (_, proposal) => {
      try {
        const selfLearner = SelfLearner.getInstance();
        const result = selfLearner.saveSkillFromProposal(proposal);
        return { success: result.success, data: result };
      } catch (error) {
        this.log.error("learning:save-skill-proposal 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("learning:get-pending-proposal", () => {
      try {
        const selfLearner = SelfLearner.getInstance();
        const proposal = selfLearner.getPendingProposal();
        return { success: true, data: proposal };
      } catch (error) {
        this.log.error("learning:get-pending-proposal 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("learning:clear-pending-proposal", () => {
      try {
        const selfLearner = SelfLearner.getInstance();
        selfLearner.clearPendingProposal();
        return { success: true };
      } catch (error) {
        this.log.error("learning:clear-pending-proposal 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("skills:merge-candidates", async () => {
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
        const candidates = [];
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
                this.log.warn("技能相似度模型比较失败，使用关键词相似度", modelError);
                const keywords1 = new Set(skill1.triggerKeywords.map((k) => k.toLowerCase()));
                const keywords2 = new Set(skill2.triggerKeywords.map((k) => k.toLowerCase()));
                const intersection = [...keywords1].filter((x) => keywords2.has(x));
                const union = [.../* @__PURE__ */ new Set([...keywords1, ...keywords2])];
                similarity = union.length > 0 ? Math.round(intersection.length / union.length * 100) : 0;
              }
            } else {
              const keywords1 = new Set(skill1.triggerKeywords.map((k) => k.toLowerCase()));
              const keywords2 = new Set(skill2.triggerKeywords.map((k) => k.toLowerCase()));
              const intersection = [...keywords1].filter((x) => keywords2.has(x));
              const union = [.../* @__PURE__ */ new Set([...keywords1, ...keywords2])];
              similarity = union.length > 0 ? Math.round(intersection.length / union.length * 100) : 0;
            }
            const threshold = hasModel ? 60 : 40;
            if (similarity >= threshold) {
              candidates.push({
                skillId1: skill1.id,
                skillName1: skill1.name,
                skillId2: skill2.id,
                skillName2: skill2.name,
                similarity
              });
            }
          }
        }
        candidates.sort((a, b) => b.similarity - a.similarity);
        this.log.info("技能合并候选检查完成", { candidateCount: candidates.length });
        return { success: true, data: candidates };
      } catch (error) {
        this.log.error("skills:merge-candidates 失败", error);
        return { success: false, error: String(error) };
      }
    });
    electron.ipcMain.handle("skills:perform-merge", (_, skillId1, skillId2) => {
      try {
        const skillLoader = SkillLoader.getInstance();
        const skills = skillLoader.getAllSkills();
        const skill1 = skills.find((s) => s.id === skillId1);
        const skill2 = skills.find((s) => s.id === skillId2);
        if (!skill1 || !skill2) {
          return { success: false, error: "技能不存在" };
        }
        const mergedKeywords = [.../* @__PURE__ */ new Set([...skill1.triggerKeywords, ...skill2.triggerKeywords])];
        const mergedSteps = [.../* @__PURE__ */ new Set([...skill1.operationSteps, ...skill2.operationSteps])];
        const mergeProposal = {
          name: skill1.name,
          description: `${skill1.description} ${skill2.description}`,
          triggerCondition: skill1.triggerCondition || skill2.triggerCondition,
          keywords: mergedKeywords,
          operationSteps: mergedSteps
        };
        const success = skillLoader.mergeSkill(mergeProposal, skillId1);
        if (success) {
          return { success: true, data: { mergedTo: skillId1 } };
        }
        return { success: false, error: "合并失败" };
      } catch (error) {
        this.log.error("skills:perform-merge 失败", error);
        return { success: false, error: String(error) };
      }
    });
    this.log.info("IPC处理器注册完成");
  }
  register(channel, handler) {
    this.handlers.set(channel, handler);
    electron.ipcMain.handle(channel, handler);
    this.log.debug(`注册IPC处理器: ${channel}`);
  }
  unregister(channel) {
    this.handlers.delete(channel);
    electron.ipcMain.removeHandler(channel);
    this.log.debug(`移除IPC处理器: ${channel}`);
  }
  destroy() {
    this.handlers.clear();
    for (const channel of Object.keys(electron.ipcMain.eventNames())) {
      electron.ipcMain.removeHandler(channel);
    }
    IpcServer.instance = null;
    this.log.info("IPC服务器已销毁");
  }
}
class GlobalShortcut {
  constructor() {
    this.log = LogManager.getInstance();
    this.registeredShortcuts = [];
    this.configStore = ConfigStore.getInstance();
  }
  static getInstance() {
    if (!GlobalShortcut.instance) {
      GlobalShortcut.instance = new GlobalShortcut();
    }
    return GlobalShortcut.instance;
  }
  /**
   * 注册所有默认快捷键
   */
  registerAll() {
    this.log.info("[GlobalShortcut] 注册全局快捷键...");
    const config = this.getShortcutConfig();
    this.registerToggleWindow(config.toggleWindow);
    this.registerNewConversation(config.newConversation);
    this.log.info("[GlobalShortcut] 全局快捷键注册完成");
  }
  /**
   * 注册切换窗口快捷键
   */
  registerToggleWindow(accelerator) {
    if (!accelerator) return;
    try {
      if (this.registeredShortcuts.includes(accelerator)) {
        electron.globalShortcut.unregister(accelerator);
      }
      const success = electron.globalShortcut.register(accelerator, () => {
        this.toggleMainWindow();
      });
      if (success) {
        this.registeredShortcuts.push(accelerator);
        this.log.info("[GlobalShortcut] 注册切换窗口快捷键:", accelerator);
      } else {
        this.log.warn("[GlobalShortcut] 注册切换窗口快捷键失败:", accelerator);
      }
    } catch (error) {
      this.log.error("[GlobalShortcut] 注册切换窗口快捷键异常:", error);
    }
  }
  /**
   * 注册新建会话快捷键
   */
  registerNewConversation(accelerator) {
    if (!accelerator) return;
    try {
      if (this.registeredShortcuts.includes(accelerator)) {
        electron.globalShortcut.unregister(accelerator);
      }
      const success = electron.globalShortcut.register(accelerator, () => {
        const win = electron.BrowserWindow.getFocusedWindow();
        if (win) {
          win.webContents.send("shortcut:newConversation");
        }
      });
      if (success) {
        this.registeredShortcuts.push(accelerator);
        this.log.info("[GlobalShortcut] 注册新建会话快捷键:", accelerator);
      }
    } catch (error) {
      this.log.error("[GlobalShortcut] 注册新建会话快捷键异常:", error);
    }
  }
  /**
   * 切换主窗口显示/隐藏
   */
  toggleMainWindow() {
    const { WindowManager: WindowManager2 } = require("./WindowManager");
    const windowManager2 = WindowManager2.getInstance();
    const win = windowManager2.getMainWindow();
    if (!win || win.isDestroyed()) return;
    if (win.isVisible()) {
      if (win.isMinimized()) {
        win.restore();
        win.focus();
      } else {
        win.hide();
        this.log.debug("[GlobalShortcut] 隐藏主窗口");
      }
    } else {
      win.show();
      win.focus();
      this.log.debug("[GlobalShortcut] 显示主窗口");
    }
  }
  /**
   * 显示主窗口
   */
  showMainWindow() {
    const { WindowManager: WindowManager2 } = require("./WindowManager");
    const windowManager2 = WindowManager2.getInstance();
    const win = windowManager2.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
    }
  }
  /**
   * 隐藏主窗口
   */
  hideMainWindow() {
    const { WindowManager: WindowManager2 } = require("./WindowManager");
    const windowManager2 = WindowManager2.getInstance();
    const win = windowManager2.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.hide();
    }
  }
  /**
   * 获取快捷键配置
   */
  getShortcutConfig() {
    return {
      toggleWindow: this.configStore.get("shortcuts.toggleWindow") || "CommandOrControl+Alt+P",
      newConversation: this.configStore.get("shortcuts.newConversation") || "CommandOrControl+Alt+N",
      sendMessage: this.configStore.get("shortcuts.sendMessage") || "CommandOrControl+Enter"
    };
  }
  /**
   * 更新快捷键配置
   */
  updateShortcut(key, accelerator) {
    try {
      this.configStore.set(`shortcuts.${key}`, accelerator);
      const config = this.getShortcutConfig();
      if (key === "toggleWindow") {
        this.unregisterAll();
        this.registerAll();
      } else if (key === "newConversation") {
        const oldAccelerator = this.getShortcutConfig().newConversation;
        if (this.registeredShortcuts.includes(oldAccelerator)) {
          electron.globalShortcut.unregister(oldAccelerator);
          this.registeredShortcuts = this.registeredShortcuts.filter((a) => a !== oldAccelerator);
        }
        this.registerNewConversation(accelerator);
      }
      this.log.info("[GlobalShortcut] 更新快捷键:", key, accelerator);
      return true;
    } catch (error) {
      this.log.error("[GlobalShortcut] 更新快捷键失败:", error);
      return false;
    }
  }
  /**
   * 检查快捷键是否已注册
   */
  isRegistered(accelerator) {
    return electron.globalShortcut.isRegistered(accelerator);
  }
  /**
   * 注销所有快捷键
   */
  unregisterAll() {
    for (const accelerator of this.registeredShortcuts) {
      try {
        electron.globalShortcut.unregister(accelerator);
      } catch (error) {
        this.log.error("[GlobalShortcut] 注销快捷键失败:", accelerator, error);
      }
    }
    this.registeredShortcuts = [];
    this.log.info("[GlobalShortcut] 已注销所有快捷键");
  }
  /**
   * 销毁实例
   */
  destroy() {
    this.unregisterAll();
    GlobalShortcut.instance = null;
    this.log.info("[GlobalShortcut] 已销毁");
  }
}
class TrayManager {
  constructor() {
    this.log = LogManager.getInstance();
    this.tray = null;
    this.isQuitting = false;
  }
  static getInstance() {
    if (!TrayManager.instance) {
      TrayManager.instance = new TrayManager();
    }
    return TrayManager.instance;
  }
  /**
   * 创建系统托盘
   */
  create() {
    if (this.tray) return;
    try {
      const iconPath = this.getIconPath();
      let icon;
      try {
        icon = electron.nativeImage.createFromPath(iconPath);
        if (icon.isEmpty()) {
          icon = this.createDefaultIcon();
        }
      } catch {
        icon = this.createDefaultIcon();
      }
      this.tray = new electron.Tray(icon);
      this.tray.setToolTip("PiPiClaw - 桌面AI助手");
      this.updateContextMenu();
      this.tray.on("click", () => {
        this.toggleMainWindow();
      });
      this.tray.on("double-click", () => {
        this.showMainWindow();
      });
      this.log.info("[TrayManager] 系统托盘创建成功");
    } catch (error) {
      this.log.error("[TrayManager] 创建系统托盘失败:", error);
    }
  }
  /**
   * 获取图标路径
   */
  getIconPath() {
    const isDev2 = !electron.app.isPackaged;
    if (isDev2) {
      return path.join(__dirname, "../../resources/icon.png");
    }
    return path.join(process.resourcesPath, "icon.png");
  }
  /**
   * 创建默认图标
   */
  createDefaultIcon() {
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
    return electron.nativeImage.createFromBuffer(canvas, { width: size, height: size });
  }
  /**
   * 更新托盘菜单
   */
  updateContextMenu() {
    if (!this.tray) return;
    const contextMenu = electron.Menu.buildFromTemplate([
      {
        label: "显示主窗口",
        click: () => this.showMainWindow()
      },
      {
        label: "新建会话",
        click: () => {
          this.showMainWindow();
          const win = electron.BrowserWindow.getFocusedWindow();
          if (win) {
            win.webContents.send("shortcut:newConversation");
          }
        }
      },
      { type: "separator" },
      {
        label: "设置",
        click: () => {
          this.showMainWindow();
          const win = electron.BrowserWindow.getFocusedWindow();
          if (win) {
            win.webContents.send("navigate", "/settings");
          }
        }
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          this.isQuitting = true;
          electron.app.quit();
        }
      }
    ]);
    this.tray.setContextMenu(contextMenu);
  }
  /**
   * 显示主窗口
   */
  showMainWindow() {
    const { WindowManager: WindowManager2 } = require("./WindowManager");
    const windowManager2 = WindowManager2.getInstance();
    const win = windowManager2.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
    }
  }
  /**
   * 隐藏主窗口到托盘
   */
  hideMainWindow() {
    const { WindowManager: WindowManager2 } = require("./WindowManager");
    const windowManager2 = WindowManager2.getInstance();
    const win = windowManager2.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.hide();
    }
  }
  /**
   * 切换主窗口
   */
  toggleMainWindow() {
    const { WindowManager: WindowManager2 } = require("./WindowManager");
    const windowManager2 = WindowManager2.getInstance();
    const win = windowManager2.getMainWindow();
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
  handleWindowClose() {
    if (!this.isQuitting) {
      this.hideMainWindow();
      return false;
    }
    return true;
  }
  /**
   * 设置退出标志
   */
  setQuitting(value) {
    this.isQuitting = value;
  }
  /**
   * 是否正在退出
   */
  isQuittingApp() {
    return this.isQuitting;
  }
  /**
   * 销毁托盘
   */
  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      this.log.info("[TrayManager] 系统托盘已销毁");
    }
    TrayManager.instance = null;
  }
}
class MiniWindow {
  constructor() {
    this.log = LogManager.getInstance();
    this.miniWindow = null;
    this.isVisible = false;
  }
  static getInstance() {
    if (!MiniWindow.instance) {
      MiniWindow.instance = new MiniWindow();
    }
    return MiniWindow.instance;
  }
  /**
   * 创建迷你悬浮窗
   */
  create() {
    if (this.miniWindow && !this.miniWindow.isDestroyed()) {
      return this.miniWindow;
    }
    const isDev2 = !electron.app.isPackaged;
    const display = electron.screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = display.workAreaSize;
    const windowWidth = 400;
    const windowHeight = 200;
    const margin = 20;
    this.miniWindow = new electron.BrowserWindow({
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
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false
      }
    });
    this.miniWindow.on("blur", () => {
      if (this.isVisible) {
        this.hide();
      }
    });
    this.miniWindow.on("closed", () => {
      this.miniWindow = null;
      this.isVisible = false;
    });
    const url2 = isDev2 ? "http://localhost:5173/#/mini" : path.join(__dirname, "../dist/index.html");
    if (isDev2) {
      this.miniWindow.loadURL(url2);
    } else {
      this.miniWindow.loadFile(url2);
    }
    this.log.info("[MiniWindow] 迷你悬浮窗创建成功");
    return this.miniWindow;
  }
  /**
   * 显示悬浮窗
   */
  show() {
    if (!this.miniWindow || this.miniWindow.isDestroyed()) {
      this.create();
    }
    if (this.miniWindow) {
      this.miniWindow.show();
      this.miniWindow.focus();
      this.isVisible = true;
      this.log.debug("[MiniWindow] 显示悬浮窗");
    }
  }
  /**
   * 隐藏悬浮窗
   */
  hide() {
    if (this.miniWindow && !this.miniWindow.isDestroyed()) {
      this.miniWindow.hide();
      this.isVisible = false;
      this.log.debug("[MiniWindow] 隐藏悬浮窗");
    }
  }
  /**
   * 切换悬浮窗显示状态
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
  /**
   * 销毁悬浮窗
   */
  destroy() {
    if (this.miniWindow && !this.miniWindow.isDestroyed()) {
      this.miniWindow.destroy();
    }
    this.miniWindow = null;
    this.isVisible = false;
    MiniWindow.instance = null;
    this.log.info("[MiniWindow] 迷你悬浮窗已销毁");
  }
  /**
   * 是否可见
   */
  isWindowVisible() {
    return this.isVisible;
  }
  /**
   * 获取悬浮窗实例
   */
  getWindow() {
    return this.miniWindow;
  }
}
const log = LogManager.getInstance();
let windowManager;
let ipcServer;
let gateway;
let globalShortcut;
let trayManager;
const isDev = !electron.app.isPackaged;
electron.ipcMain.on("open-devtools", () => {
  const windowManager2 = WindowManager.getInstance();
  const win = windowManager2.getMainWindow();
  if (win) {
    log.info("用户请求打开 DevTools");
    win.webContents.openDevTools();
  }
});
electron.app.whenReady().then(async () => {
  var _a;
  log.info("========== PiPiClaw 应用启动 ==========", { version: electron.app.getVersion(), isDev });
  try {
    setupAppMenu();
    ipcServer = IpcServer.getInstance();
    ipcServer.registerHandlers();
    windowManager = WindowManager.getInstance();
    await windowManager.createMainWindow();
    globalShortcut = GlobalShortcut.getInstance();
    globalShortcut.registerAll();
    trayManager = TrayManager.getInstance();
    trayManager.create();
    const permissionConfig = PermissionConfig.getInstance();
    permissionConfig.forceResetToPermissive();
    const configStore = ConfigStore.getInstance();
    const alwaysOnTop = configStore.get("window.alwaysOnTop") || false;
    if (alwaysOnTop) {
      windowManager.setAlwaysOnTop(true);
    }
    const edgeHideEnabled = configStore.get("window.edgeHideEnabled") || false;
    if (edgeHideEnabled) {
      windowManager.setEdgeHideEnabled(true);
      windowManager.setupEdgeHide();
    }
    gateway = OpenClawGateway.getInstance();
    log.info("正在自动启动OpenClaw网关服务...");
    const gatewayResult = await gateway.start();
    if (gatewayResult.success) {
      log.info("========== OpenClaw网关启动成功 ==========");
    } else {
      log.error("OpenClaw网关启动失败", { error: gatewayResult.error });
    }
    if (isDev) {
      (_a = windowManager.getMainWindow()) == null ? void 0 : _a.webContents.openDevTools();
    }
    log.info("========== PiPiClaw应用启动完成 ==========");
  } catch (error) {
    log.error("应用启动失败", error);
    electron.app.quit();
  }
});
electron.app.on("window-all-closed", () => {
  log.info("所有窗口已关闭");
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    windowManager = WindowManager.getInstance();
    windowManager.createMainWindow();
  }
});
electron.app.on("before-quit", async () => {
  log.info("应用即将退出");
  trayManager == null ? void 0 : trayManager.setQuitting(true);
  if (gateway) {
    try {
      log.info("正在停止OpenClaw网关...");
      await gateway.stop();
      log.info("网关已停止");
    } catch (error) {
      log.error("停止网关时出错", error);
    }
  }
  globalShortcut == null ? void 0 : globalShortcut.destroy();
  trayManager == null ? void 0 : trayManager.destroy();
  MiniWindow.getInstance().destroy();
  if (ipcServer) {
    ipcServer.destroy();
  }
  if (windowManager) {
    windowManager.destroy();
  }
});
process.on("uncaughtException", (error) => {
  log.error("未捕获的异常", error);
  if (!isDev) {
    const { dialog } = require("electron");
    dialog.showErrorBox("应用错误", `发生未知错误: ${error.message}`);
  }
});
process.on("unhandledRejection", (reason) => {
  log.error("未处理的Promise拒绝", reason);
});
function setupAppMenu() {
  const emptyMenu = electron.Menu.buildFromTemplate([]);
  electron.Menu.setApplicationMenu(emptyMenu);
  if (process.platform !== "darwin") {
    electron.Menu.setApplicationMenu(null);
  }
  log.debug("应用菜单已配置为隐藏");
}
electron.app.on("web-contents-created", (_, contents) => {
  contents.setWindowOpenHandler(({ url: url2 }) => {
    electron.shell.openExternal(url2);
    return { action: "deny" };
  });
});
