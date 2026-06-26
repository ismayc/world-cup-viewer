import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so the same build works both at the domain root (Netlify) and
  // under a sub-path (GitHub Pages: /world-cup-viewer/).
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        // Multi-page: the main app + the standalone R32 Outlook page.
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        outlook: fileURLToPath(new URL('./outlook.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
    coverage: {
      provider: 'v8',
      all: true, // count untested files too, so the badge isn't flattered
      include: ['src/**'],
      exclude: ['src/main.jsx', 'src/**/*.test.{js,jsx}'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
})
