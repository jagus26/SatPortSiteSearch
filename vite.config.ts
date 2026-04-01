/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    css: true,
    alias: {
      'react-map-gl/maplibre': path.resolve(__dirname, 'src/__mocks__/react-map-gl/maplibre.tsx'),
    },
  },
})
