/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    benchmark: { include: ['src/**/*.bench.ts'] },
    coverage: { include: ['src/engine/**', 'src/export/**', 'src/io/**'] },
  },
})
