/**
 * PiPiClaw - Vue应用入口
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
import enUs from 'element-plus/dist/locale/en.mjs';

import App from './App.vue';
import router from './router';
import i18n, { setLocale } from './locales';
import './styles/reset.scss';
import './styles/global.scss';

const app = createApp(App);

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