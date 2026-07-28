import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    // P1-6: Element Plus 组件按需自动导入 — 替代全量 app.use(ElementPlus)
    // 期望效果: vendor-element-plus chunk 915KB → < 300KB
    Components({
      resolvers: [
        ElementPlusResolver({
          importStyle: 'css',
        }),
      ],
      dirs: ['src/components', 'src/views'],
      extensions: ['vue'],
      exclude: [/\.[jt]sx?$/, /\.vue$/, /\.vue\?vue/, /\.scss$/],
      dts: false,
    }),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', 'electron-log'],
              output: {
                preserveModules: false
              }
            },
            ssr: true
          },
          css: {
            preprocessorOptions: {
              scss: {
                api: 'modern-compiler',
                silenceDeprecations: ['legacy-js-api']
              }
            }
          }
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron'
          },
          css: {
            preprocessorOptions: {
              scss: {
                api: 'modern-compiler',
                silenceDeprecations: ['legacy-js-api']
              }
            }
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  optimizeDeps: {
    include: ['vue', 'vue-router', '@element-plus/icons-vue', 'pinia'],
    // element-plus 移除: 用 unplugin-vue-components 自动按需导入
    exclude: []
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // P1-6: 手动分 chunk
        // 重要: element-plus 已由 unplugin-vue-components 自动按需导入,
        // 让 rollup 自然分块到各路由 (而不是强制合并成 vendor-element-plus)
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('pinia') || id.includes('@vue') || id.includes('vue-router')) {
              return 'vendor-framework';
            }
            // marked / highlight.js / element-plus / 其余: 自然分块
            return undefined;
          }
          return undefined;
        },
        assetFileNames: (info) => {
          const ext = info.name?.split('.').pop();
          if (ext && ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        silenceDeprecations: ['legacy-js-api']
      }
    }
  }
});