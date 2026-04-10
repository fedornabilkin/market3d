import {fileURLToPath, URL} from 'node:url'
import {defineConfig, loadEnv} from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({mode}) => {

  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiHost = env.VITE_API_HOST || 'localhost';
  const apiPort = env.VITE_API_PORT || 3000;

  return {
    plugins: [
      vue(),
    ],
    build: {
        minify: 'terser',
        terserOptions: {
            compress: {
              drop_console: true,
              drop_debugger: true,
            },
          },
        rollupOptions: {
          // https://rollupjs.org/configuration-options/
          output: {
            manualChunks: {
              core: [
                'vue',
                'vue-i18n',
                'vue-router',
              ],
              tree:
                [
                  'three',
                  'three-csg-ts',
                ],
              network:
                [
                  // 'yandex-metrika-vue3',
                ],
              utils:
                [
                  'jszip',
                  'vue-qrcode-reader',
                  'vcards-js',
                  'qrcode',
                  'path-that-svg',
                  'deepmerge',
                  'deep-object-diff',
                ],
              ui:
                [
                  // 'bulma',
                  // 'sass-embedded',
                ],
              icons:
                [
                  // '@fortawesome/fontawesome-free',
                ],
            },
          },
        },
    },
    server: {
      watch: {
        usePolling: true
      },
      host: true,
      strictPort: true,
      port: 5174,
      proxy: {
        '/api': {
          target: `http://${apiHost}:${apiPort}`,
          changeOrigin: true,
        },
        '/uploads': {
          target: `http://${apiHost}:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          // additionalData: `@import "./src/assets/scss/main.scss";`
        }
      }
    }
  }
})
