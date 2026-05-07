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
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

// 路由守卫：每次路由切换时更新页面标题
router.beforeEach((to, _, next) => {
  const title = to.meta.title as string;
  if (title) {
    document.title = `${title} - PiPiClaw`;
  }
  next();
});

export default router;
