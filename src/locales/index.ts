/**
 * PiPiClaw - i18n 国际化入口
 */

import { createI18n } from 'vue-i18n';
import zhCN from './zh-CN';
import enUS from './en-US';

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export const LOCALE_STORAGE_KEY = 'pipiclaw:locale';

function resolveInitialLocale(): SupportedLocale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
      return stored as SupportedLocale;
    }
  } catch {
    // localStorage may not be available in tests
  }
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language?.toLowerCase() ?? '';
    if (lang.startsWith('zh')) return 'zh-CN';
  }
  return 'zh-CN';
}

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: resolveInitialLocale(),
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
});

export function setLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

export default i18n;