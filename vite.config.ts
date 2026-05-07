import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve, dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export default defineConfig({
  plugins: [
    vue(),
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
    include: ['vue', 'vue-router', 'element-plus', '@element-plus/icons-vue', 'pinia'],
    exclude: []
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        assetFileNames: (info) => {
          const ext = info.name.split('.').pop();
          if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext!)) {
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
