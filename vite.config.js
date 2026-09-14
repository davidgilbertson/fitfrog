import {defineConfig} from 'vite';
import {cloudflare} from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [cloudflare()],
  // host: true exposes the dev server on the LAN so a phone can test the "another device" link.
  server: {port: 8098, strictPort: true, host: true},
});
