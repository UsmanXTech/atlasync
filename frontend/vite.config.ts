import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Forge Custom UI requires relative asset paths, so base is './'.
// Build output goes to the Forge static resource directory.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../forge-app/static/atlasync',
    emptyOutDir: true,
  },
});
