import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'login.html',
        dashboard: 'dashboard.html'
      }
    }
  }
});
