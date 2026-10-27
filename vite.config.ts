import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 700, // Leaflet + Supabase live in their own lazily loaded chunk
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
