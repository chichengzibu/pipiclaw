/**
 * Vitest global setup for vue-i18n
 *
 * Register a default i18n plugin so that `useI18n()` works inside components
 * under test without requiring each test to install it manually.
 */
import { config } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import zhCN from '../../src/locales/zh-CN';
import enUS from '../../src/locales/en-US';

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'zh-CN',
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
});

config.global.plugins = config.global.plugins || [];
config.global.plugins.push(i18n);