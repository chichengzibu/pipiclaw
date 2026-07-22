import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

/**
 * Vitest 配置
 *
 * 覆盖范围：
 * - tests/unit/**\/*.test.ts        (单元测试)
 * - tests/integration/**\/*.test.ts (集成测试)
 *
 * 暂不覆盖：
 * - tests/e2e/**\/*.spec.ts        (Playwright e2e，W12 才建)
 * - dist-electron/**                (构建产物)
 *
 * 环境：jsdom（Vue / DOM API 友好）
 */
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: false,
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'dist-electron/**',
      'tests/e2e/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: [
        'electron/**/*.ts',
        'src/**/*.ts',
        'src/**/*.vue'
      ],
      exclude: [
        'electron/types/**',
        'electron/**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '~': fileURLToPath(new URL('./', import.meta.url))
    }
  }
})
