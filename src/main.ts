/**
 * PiPiClaw - Vue应用入口
 *
 * P1-6: Element Plus 组件改由 unplugin-vue-components 自动按需导入,
 * 不再走 app.use(ElementPlus) 全量注册,vendor-element-plus chunk 期望 915KB → <300KB
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
// P0-UI 修复: 显式导入 element-plus 全量 CSS
// 背景: unplugin-vue-components + ElementPlusResolver 的 importStyle: 'css' 只对
// 实际模板里出现的 <el-xxx> 组件 import 对应 CSS,但 el-icon / el-empty / el-image /
// el-avatar / el-skeleton 等展示型组件(以及 ElementPlusIcons 渲染的 <i class="el-icon">)
// 走的是另一条路径,导致 width: 1em / height: 1em 丢失,SVG 渲染成 0×0 或 100%×100%。
// 解法: main.ts 显式 import 'element-plus/dist/index.css',用 ElementPlus 自带的
// 主题变量 + 我们 tokens.css 的覆盖 + global.scss 的兜底,三层保险。
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import * as ElementPlusIcons from '@element-plus/icons-vue';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
import enUs from 'element-plus/dist/locale/en.mjs';

import App from './App.vue';
import router from './router';
import i18n, { setLocale } from './locales';
import './styles/reset.scss';
import './styles/global.scss';

const app = createApp(App);

// B2-Bugfix: 全量注册 Element Plus 修复 dev 模式下 unplugin-vue-components 不解析
// src/views/*.vue 里 <el-*> 组件的问题 (renderer 抛 "Cannot read row of undefined")
app.use(ElementPlus, { locale: zhCn });

// 全局注册 Element Plus 图标
// SideNav.vue 使用 <component :is="item.icon" /> 配合字符串名('HomeFilled' 等),
// 必须通过 app.component() 全局注册才能解析。
for (const [name, comp] of Object.entries(ElementPlusIcons)) {
  app.component(name, comp as never);
}

app.use(createPinia());
app.use(router);

// Locale 切换辅助 (Element Plus 组件按需导入后, locale 仍由组件内部用 ElConfigProvider 注入或保留全局 i18n)
const elementPlusLocaleMap: Record<string, unknown> = {
  'zh-CN': zhCn,
  'en-US': enUs
};
// 导出给 ElConfigProvider 使用 (Chat.vue 等视图按需引入)
export const elementPlusLocale = (() => {
  const cur = i18n.global.locale.value as string;
  return (elementPlusLocaleMap[cur] as never) ?? zhCn;
})();

app.use(i18n);
app.mount('#app');

// 暴露 setLocale 给浏览器调试或 electron preload（不导出 main 包）
(window as unknown as { __setLocale?: typeof setLocale }).__setLocale = setLocale;