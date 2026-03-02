import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/LocationTrackingWeb/' : '/',
  manifest: {
    name: 'Location Tracking',
    short_name: 'LocTrac',
    description: 'A location tracking web application',
    icons: [
      {
        src: './public/images/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: './public/images/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: './public/images/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      },
    ],
  },
})
