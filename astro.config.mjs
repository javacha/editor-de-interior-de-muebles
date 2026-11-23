import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');
process.env.BLOB_READ_WRITE_TOKEN ??= env.BLOB_READ_WRITE_TOKEN;

export default defineConfig({
  integrations: [react()],
  output: 'server',
  adapter: vercel(),
});
