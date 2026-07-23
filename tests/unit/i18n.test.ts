import { describe, it, expect } from 'vitest';
import { createI18n } from 'vue-i18n';
import zhCN from '../../src/locales/zh-CN';
import enUS from '../../src/locales/en-US';

function flattenKeys(obj: any, prefix = ''): string[] {
  if (obj === null || obj === undefined) return [];
  if (typeof obj !== 'object') return [];
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') return [path];
    if (value && typeof value === 'object') return flattenKeys(value, path);
    return [];
  });
}

function lookup(obj: any, path: string): unknown {
  return path.split('.').reduce<any>((acc, segment) => acc?.[segment], obj);
}

describe('i18n locale parity', () => {
  it('zh-CN and en-US have identical key paths', () => {
    const zhKeys = new Set(flattenKeys(zhCN));
    const enKeys = new Set(flattenKeys(enUS));

    const missingInEn = [...zhKeys].filter((k) => !enKeys.has(k));
    const missingInZh = [...enKeys].filter((k) => !zhKeys.has(k));

    expect(missingInEn, `Missing in en-US: ${missingInEn.join(', ')}`).toEqual([]);
    expect(missingInZh, `Missing in zh-CN: ${missingInZh.join(', ')}`).toEqual([]);
  });

  it('no empty string values in either locale', () => {
    for (const [name, locale] of [
      ['zh-CN', zhCN],
      ['en-US', enUS]
    ] as const) {
      const flat = flattenKeys(locale);
      for (const key of flat) {
        const val = lookup(locale, key);
        expect(val, `${name}.${key} should not be empty`).toBeTruthy();
        expect(typeof val, `${name}.${key} should be a string`).toBe('string');
        expect((val as string).trim().length, `${name}.${key} should have non-whitespace content`).toBeGreaterThan(0);
      }
    }
  });

  it('vue-i18n composes both locales and switches correctly', () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'zh-CN',
      fallbackLocale: 'en-US',
      messages: {
        'zh-CN': zhCN,
        'en-US': enUS
      }
    });

    expect(i18n.global.t('common.save')).toBe('保存');
    expect(i18n.global.t('common.save')).not.toBe('Save');

    i18n.global.locale.value = 'en-US';
    expect(i18n.global.t('common.save')).toBe('Save');

    expect(i18n.global.t('nav.settings')).toBe('Settings');

    const interpolated = i18n.global.t('chat.selectedCount', { count: 5 });
    expect(interpolated).toContain('5');
  });

  it('interpolation tokens are present on both sides', () => {
    const zhKeys = new Set(flattenKeys(zhCN));
    const enKeys = new Set(flattenKeys(enUS));
    const tokenRegex = /\{(\w+)\}/g;

    const sampleWithTokens = ['chat.selectedCount', 'models.modelsCount', 'models.providerCount', 'models.latencyMs'];

    for (const key of sampleWithTokens) {
      expect(zhKeys.has(key), `zh-CN missing ${key}`).toBe(true);
      expect(enKeys.has(key), `en-US missing ${key}`).toBe(true);

      const zhVal = lookup(zhCN, key) as string;
      const enVal = lookup(enUS, key) as string;

      const zhTokens = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = tokenRegex.exec(zhVal))) {
        zhTokens.add(m[1]);
      }
      const enTokens = new Set<string>();
      while ((m = tokenRegex.exec(enVal))) {
        enTokens.add(m[1]);
      }

      expect([...zhTokens].sort()).toEqual([...enTokens].sort());
    }
  });

  it('contains the required namespaces', () => {
    const required = ['common', 'nav', 'settings', 'chat', 'skills', 'schedule', 'permissions', 'models', 'tasks', 'about'];
    for (const ns of required) {
      expect((zhCN as any)[ns], `zh-CN missing namespace "${ns}"`).toBeDefined();
      expect((enUS as any)[ns], `en-US missing namespace "${ns}"`).toBeDefined();
    }
  });
});