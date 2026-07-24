/**
 * PiPiClaw - 应用状态管理
 *
 * 主题系统(从 5 套彩色主题 → 2 套极简主题):
 *   - light (白) - Tare 风格
 *   - dark  (黑) - Cursor 风格
 *   - 跟随系统 prefers-color-scheme
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'system';

export const useAppStore = defineStore('app', () => {
  // ==================== 状态定义 ====================

  /** 应用版本 */
  const version = ref<string>('1.0.0');

  /** 应用环境 */
  const env = ref<'development' | 'production'>('development');

  /** 平台信息 */
  const platform = ref<string>('win32');

  /** 主题模式(用户设置) */
  const themeMode = ref<ThemeMode>('system');

  /** 当前实际主题(从 mode + system 解析得出) */
  const currentTheme = computed<'light' | 'dark'>(() => {
    if (themeMode.value === 'system') {
      return detectSystemTheme();
    }
    return themeMode.value;
  });

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

        // 读取用户保存的主题
        const savedThemeResult = await window.electronAPI.config.get('theme');
        if (savedThemeResult?.success && savedThemeResult.data) {
          const saved = savedThemeResult.data as string;
          if (saved === 'light' || saved === 'dark' || saved === 'system') {
            themeMode.value = saved;
          }
        }

        // 监听系统主题变化(仅当 mode = system 时生效)
        if (window.matchMedia) {
          const mq = window.matchMedia('(prefers-color-scheme: dark)');
          mq.addEventListener('change', () => {
            if (themeMode.value === 'system') {
              applyTheme();
            }
          });
        }
      }

      // 设置环境
      const mode = (import.meta as { env?: { MODE?: string } })?.env?.MODE;
      env.value = mode === 'production' ? 'production' : 'development';

      // 应用主题
      applyTheme();

      initialized.value = true;
      initStatus.value = '初始化完成';
    } catch (error) {
      console.error('应用初始化失败:', error);
      initStatus.value = '初始化失败';
    }
  }

  /**
   * 切换主题(light ↔ dark),如果当前是 system 则切到相反的实际值
   */
  function toggleTheme(): void {
    const next: ThemeMode = currentTheme.value === 'light' ? 'dark' : 'light';
    setTheme(next);
  }

  /**
   * 设置主题
   */
  function setTheme(mode: ThemeMode): void {
    themeMode.value = mode;
    applyTheme();

    // 持久化
    if (window.electronAPI) {
      window.electronAPI.config.set('theme', mode).catch((err) => {
        console.error('保存主题配置失败:', err);
      });
    }
  }

  /**
   * 应用主题到 documentElement(短动画过渡)
   */
  function applyTheme(): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    // 启用过渡(只在切换时短暂启用,避免首次加载闪烁)
    root.classList.add('theme-transition');

    // 设置 data-theme(空值 = 跟随系统)
    if (themeMode.value === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.dataset.theme = themeMode.value;
    }

    // Element Plus dark 模式同步
    root.classList.toggle('dark', currentTheme.value === 'dark');

    // 切换完后 300ms 移除过渡 class(避免影响后续 hover 动画)
    window.setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 320);
  }

  /**
   * 检测系统主题
   */
  function detectSystemTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined' || !window.matchMedia) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
    if (isFirstLaunch.value) {
      markFirstLaunchComplete();
    }
  }

  return {
    // 状态
    version,
    env,
    platform,
    themeMode,
    currentTheme,
    language,
    initialized,
    initStatus,
    isFirstLaunch,
    showGuide,

    // 方法
    initialize,
    toggleTheme,
    setTheme,
    applyTheme,
    setLanguage,
    markFirstLaunchComplete,
    openGuide,
    closeGuide,
  };
});
