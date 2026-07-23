/**
 * PiPiClaw - Vue应用入口
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import * as ElementPlusIcons from '@element-plus/icons-vue';
import 'element-plus/dist/index.css';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
import enUs from 'element-plus/dist/locale/en.mjs';

import App from './App.vue';
import router from './router';
import i18n, { setLocale } from './locales';
import './styles/reset.scss';
import './styles/global.scss';

const app = createApp(App);

// 全局注册 Element Plus 图标（修复 SideNav 导航项不显示的问题）
// SideNav.vue 使用 <component :is="item.icon" /> 配合字符串名('HomeFilled' 等),
// 必须通过 app.component() 全局注册才能解析。
for (const [name, comp] of Object.entries(ElementPlusIcons)) {
  app.component(name, comp as never);
}

app.use(createPinia());
app.use(router);

// 根据当前 i18n locale 切换 Element Plus 语言
const elementPlusLocaleMap: Record<string, unknown> = {
  'zh-CN': zhCn,
  'en-US': enUs
};
app.use(ElementPlus, {
  locale: (elementPlusLocaleMap[i18n.global.locale.value as string] as never) ?? zhCn
});
app.use(i18n);

app.mount('#app');

// 暴露 setLocale 给浏览器调试或 electron preload（不导出 main 包）
(window as unknown as { __setLocale?: typeof setLocale }).__setLocale = setLocale;