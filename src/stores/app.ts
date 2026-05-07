/**
 * PiPiClaw - 应用状态管理
 * 
 * 职责：
 * 1. 管理应用全局状态
 * 2. 提供主题切换系统
 * 3. 提供应用初始化逻辑
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppStore = defineStore('app', () => {
  // ==================== 状态定义 ====================
  
  /** 应用版本 */
  const version = ref<string>('1.0.0');
  
  /** 应用环境 */
  const env = ref<'development' | 'production'>('development');
  
  /** 平台信息 */
  const platform = ref<string>('win32');
  
  /** 当前主题 */
  const currentTheme = ref<string>('warm-tech');
  
  /** 所有可用主题列表 */
  const availableThemes = ref([
    { key: 'warm-tech', name: '暖科技风格' },
    { key: 'ocean-blue', name: '深海蓝调' },
    { key: 'forest-green', name: '森林绿叶' },
    { key: 'elegant-purple', name: '优雅紫色' },
    { key: 'sakura-pink', name: '樱花粉樱' }
  ]);
  
  /** 语言 - 固定简体中文 */
  const language = ref<string>('zh-CN');
  
  /** 是否初始化完成 */
  const initialized = ref<boolean>(false);
  
  /** 初始化状态描述 */
  const initStatus = ref<string>('');
  
  /** 是否首次启动 */
  const isFirstLaunch = ref<boolean>(true);
  
  /** 是否显示新手引导 */
  const showGuide = ref<boolean>(false);

  // ==================== 动作方法 ====================
  
  /**
   * 初始化应用
   */
  async function initialize(): Promise<void> {
    initStatus.value = '正在初始化...';
    
    try {
      // 获取应用版本
      if (window.electronAPI) {
        const versionResult = await window.electronAPI.app.getVersion();
        if (versionResult?.data) {
          version.value = versionResult.data;
        }
        
        // 获取平台信息
        platform.value = window.electronAPI.app.getPlatform();
        
        // 检查是否首次启动
        const firstRunResult = await window.electronAPI.config.get('firstRun');
        if (firstRunResult?.success && firstRunResult.data === true) {
          isFirstLaunch.value = true;
          showGuide.value = true;
        } else {
          isFirstLaunch.value = false;
          showGuide.value = false;
        }
        
        // 尝试读取用户保存的主题
        const savedThemeResult = await window.electronAPI.config.get('theme');
        if (savedThemeResult?.success && savedThemeResult.data) {
          currentTheme.value = savedThemeResult.data;
        }
      }
      
      // 设置环境
      env.value = import.meta.env.MODE as 'development' | 'production';
      
      // 初始化主题
      initTheme();
      
      initialized.value = true;
      initStatus.value = '初始化完成';
    } catch (error) {
      console.error('应用初始化失败:', error);
      initStatus.value = '初始化失败';
    }
  }

  /**
   * 初始化主题
   */
  function initTheme(): void {
    // 先移除所有主题类
    const themeClasses = [
      'theme-warm-tech',
      'theme-ocean-blue', 
      'theme-forest-green',
      'theme-elegant-purple',
      'theme-sakura-pink'
    ];
    
    themeClasses.forEach(className => {
      document.documentElement.classList.remove(className);
    });
    
    // 添加当前主题类
    const themeClass = `theme-${currentTheme.value}`;
    if (themeClasses.includes(themeClass)) {
      document.documentElement.classList.add(themeClass);
    } else {
      // 默认回退到暖科技
      document.documentElement.classList.add('theme-warm-tech');
    }
  }

  /**
   * 设置主题
   */
  function setTheme(themeKey: string): void {
    currentTheme.value = themeKey;
    initTheme();
    
    // 保存到配置
    if (window.electronAPI) {
      window.electronAPI.config.set('theme', themeKey).catch(err => {
        console.error('保存主题配置失败:', err);
      });
    }
  }

  /**
   * 设置语言
   */
  function setLanguage(lang: string): void {
    language.value = lang;
  }
  
  /**
   * 标记首次启动已完成
   */
  async function markFirstLaunchComplete(): Promise<void> {
    isFirstLaunch.value = false;
    showGuide.value = false;
    
    // 更新后端配置
    if (window.electronAPI) {
      try {
        await window.electronAPI.config.set('firstRun', false);
      } catch (error) {
        console.error('更新首次启动配置失败:', error);
      }
    }
  }
  
  /**
   * 打开新手引导
   */
  function openGuide(): void {
    showGuide.value = true;
  }
  
  /**
   * 关闭新手引导
   */
  function closeGuide(): void {
    showGuide.value = false;
    // 如果是首次启动，自动标记完成
    if (isFirstLaunch.value) {
      markFirstLaunchComplete();
    }
  }

  return {
    // 状态
    version,
    env,
    platform,
    currentTheme,
    availableThemes,
    language,
    initialized,
    initStatus,
    isFirstLaunch,
    showGuide,
    
    // 方法
    initialize,
    setTheme,
    setLanguage,
    markFirstLaunchComplete,
    openGuide,
    closeGuide
  };
});
