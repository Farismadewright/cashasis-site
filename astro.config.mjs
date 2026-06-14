import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// IMPORTANT: change `site` to your final domain when you wire the custom domain.
// For the first Netlify deploy you can leave it as the Netlify URL Netlify gives you,
// then update it to https://cashasis.com once the domain is connected.
export default defineConfig({
  site: 'https://www.cashasis.com',
  integrations: [sitemap()],
  build: { format: 'directory' },
});
