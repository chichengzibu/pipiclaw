/**
 * PiPiClaw - Vue Router路由配置
 * 
 * 职责：
 * 1. 定义应用路由
 * 2. 配置路由守卫
 * 3. 管理路由元信息
 */

import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: {
      title: '首页',
      icon: 'HomeFilled'
    }
  },
  {
    path: '/chat',
    name: 'Chat',
    component: () => import('@/views/Chat.vue'),
    meta: {
      title: '对话',
      icon: 'ChatDotRound'
    }
  },
  {
    path: '/skills',
    name: 'Skills',
    component: () => import('@/views/SkillsView.vue'),
    meta: {
      title: '技能管理',
      icon: 'Box'
    }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue'),
    meta: {
      title: '设置',
      icon: 'Setting'
    }
  },
  {
    path: '/help',
    name: 'Help',
    component: () => import('@/views/Help.vue'),
    meta: { title: '帮助', icon: 'QuestionFilled' }
  },
  {
    path: '/models',
    name: 'Models',
    component: () => import('@/views/Models.vue'),
    meta: { title: '模型', icon: 'Cpu' }
  },
  {
    path: '/permissions',
    name: 'Permissions',
    component: () => import('@/views/Permissions.vue'),
    meta: { title: '权限', icon: 'Lock' }
  },
  {
    path: '/plugin-market',
    name: 'PluginMarket',
    component: () => import('@/views/PluginMarket.vue'),
    meta: { title: '插件市场', icon: 'Shop' }
  },
  {
    path: '/remote-control',
    name: 'RemoteControl',
    component: () => import('@/views/RemoteControl.vue'),
    meta: { title: '远程控制', icon: 'Connection' }
  },
  {
    path: '/schedule',
    name: 'Schedule',
    component: () => import('@/views/Schedule.vue'),
    meta: { title: '计划任务', icon: 'Calendar' }
  },
  {
    path: '/skill-market',
    name: 'SkillMarket',
    component: () => import('@/views/SkillMarket.vue'),
    meta: { title: '技能市场', icon: 'Goods' }
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: () => import('@/views/Tasks.vue'),
    meta: { title: '任务', icon: 'List' }
  },
  {
    path: '/d1-demo',
    name: 'D1ScreenshotDemo',
    component: () => import('@/views/D1ScreenshotDemo.vue'),
    meta: { title: 'D1 截屏', icon: 'Camera', devOnly: true }
  },
  {
    path: '/d5-demo',
    name: 'D5RecordingToSkill',
    component: () => import('@/views/D5RecordingToSkill.vue'),
    meta: { title: 'D5 录屏', icon: 'VideoCamera', devOnly: true }
  },
  {
    path: '/d3-demo',
    name: 'D3RemoteDemo',
    component: () => import('@/views/D3RemoteDemo.vue'),
    meta: { title: 'D3 远程', icon: 'Promotion', devOnly: true }
  },
  {
    path: '/a5-demo',
    name: 'A5ComputerUseDemo',
    component: () => import('@/views/A5ComputerUseDemo.vue'),
    meta: { devOnly: true },
  },
  {
    path: '/d2-prime-demo',
    name: 'D2PrimeDemo',
    component: () => import('@/views/D2PrimeDemo.vue'),
    meta: { devOnly: true },
  },
  {
    path: '/settings/im-accounts',
    name: 'ImAccounts',
    component: () => import('@/views/ImAccounts.vue'),
  },
  {
    path: '/im-management',
    name: 'ImManagement',
    component: () => import('@/views/ImManagement.vue'),
    meta: { title: 'IM 管理', icon: 'ChatDotRound' },
  },
  {
    path: '/clawhub',
    name: 'ClawHub',
    component: () => import('@/views/ClawHub.vue'),
    meta: { title: 'ClawHub 技能市场', icon: 'Goods' },
  },
  {
    path: '/model-compare',
    name: 'ModelCompare',
    component: () => import('@/views/ModelCompare.vue'),
    meta: { title: '模型对比', icon: 'DataAnalysis' },
  },
  {
    path: '/settings/llm-config',
    name: 'LlmConfig',
    component: () => import('@/views/LlmConfig.vue'),
    meta: { title: 'LLM 配置', icon: 'MagicStick' }
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

// devOnly 路由:生产构建不导出 + 导航守卫拦截
const isDev = (import.meta as { env?: { DEV?: boolean } })?.env?.DEV
if (!isDev) {
  // 生产模式:把 devOnly 路由重定向到首页,避免用户通过 URL 访问
  router.beforeEach((to, _from, next) => {
    if (to.meta?.devOnly) {
      next('/dashboard')
    } else {
      next()
    }
  })
}

// 路由守卫：每次路由切换时更新页面标题
router.beforeEach((to, _, next) => {
  const title = to.meta.title as string;
  if (title) {
    document.title = `${title} - PiPiClaw`;
  }
  next();
});

export default router;
