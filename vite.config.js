import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/khora.us/',
  test: {
    environment: 'node',
  },
});
