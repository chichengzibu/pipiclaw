/**
 * PiPiClaw - 前端API类型定义
 * 
 * 定义前端使用的类型
 */

// 路由元信息
export interface RouteMeta {
  title: string;
  icon?: string;
  requiresAuth?: boolean;
}

// 导航项
export interface NavItem {
  path: string;
  name: string;
  title: string;
  icon?: string;
  children?: NavItem[];
}

// 应用状态
export interface AppState {
  version: string;
  env: 'development' | 'production';
  platform: string;
  theme: 'light' | 'dark';
  language: string;
  initialized: boolean;
}

// IPC响应
export interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 全局声明
declare global {
  interface Window {
    electronAPI: {
      window: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
        onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void;
      };
      app: {
        getVersion: () => Promise<string>;
        getPlatform: () => string;
      };
    };
  }
}

export {};
