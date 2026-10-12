import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 2000,
  },
  // Allow tunnel hosts (localhost.run etc.) so Jabir can preview live.
  preview: {
    allowedHosts: true,
  },
})
