import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/roomtab-192.png', 'icons/roomtab-512.png'],
      manifest: {
        name: 'RoomTab — Hostel Canteen Ledger',
        short_name: 'RoomTab',
        description: 'Keep hostel canteen expenses and balances clear.',
        theme_color: '#f6f1e5',
        background_color: '#f6f1e5',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/roomtab-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/roomtab-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ]
});
