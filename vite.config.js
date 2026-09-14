import {defineConfig} from 'vite';
import {cloudflare} from '@cloudflare/vite-plugin';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    cloudflare(),
    VitePWA({
      // A new deploy changes sw.js; the browser installs it and the page reloads onto the new version.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Fit Frog',
        short_name: 'Fit Frog',
        description: 'A simple exercise and daily notes tracker.',
        id: '/',
        start_url: '/',
        display: 'standalone',
        background_color: '#181d21',
        theme_color: '#181d21',
        icons: [
          {src: 'icon-192.png', sizes: '192x192', type: 'image/png'},
          {src: 'icon-512.png', sizes: '512x512', type: 'image/png'},
          {src: 'icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable'},
          {src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
        ],
      },
      workbox: {
        // Single sw.js file instead of sw.js + a hashed workbox-*.js it imports.
        inlineWorkboxRuntime: true,
        // Never answer /api/* from the precached index.html.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  // host: true exposes the dev server on the LAN so a phone can test the "another device" link.
  server: {port: 8098, strictPort: true, host: true},
});
