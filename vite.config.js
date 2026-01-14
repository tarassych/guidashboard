import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // In production, API is served from same host (empty string = relative URL)
    // In development, use localhost:3001
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001'
    ),
  },
})
