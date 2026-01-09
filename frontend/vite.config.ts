import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // Загружаем .env файлы по режиму (только VITE_* переменные)
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  
  const apiHost = env.VITE_API_HOST || 'http://localhost';
  const apiPort = env.VITE_API_PORT || 3000;

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 5273,
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
    define: {
      // Доступны в коде через import.meta.env
      __VITE_API_HOST__: JSON.stringify(apiHost),
      __VITE_API_PORT__: JSON.stringify(apiPort),
    },
  };
});
