import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// BASE_PATH: GitHub Pages 등 하위 경로 배포용 (예: /hwp-viewer/)
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
})
