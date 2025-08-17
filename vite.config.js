import { defineConfig } from 'vite';

export default defineConfig({
  root: '.', // Mengarahkan Vite untuk mencari di direktori root proyek
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        login: 'login.html',
        dashboard: 'dashboard.html'
      }
    }
  }
});
