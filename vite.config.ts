import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@ant-design/charts') || id.includes('node_modules\\@ant-design\\charts')) {
            return 'charts';
          }
          if (id.includes('node_modules/antd') || id.includes('node_modules\\antd') || id.includes('node_modules/@ant-design') || id.includes('node_modules\\@ant-design')) {
            return 'antd';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
    },
  },
});
