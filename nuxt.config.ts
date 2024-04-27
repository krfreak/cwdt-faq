// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  css: ['@/assets/css/main.scss', '@/assets/css/markdown.scss'],
  devtools: { enabled: true },
  modules: ['@nuxtjs/eslint-module', '@pinia/nuxt', '@nuxtjs/tailwindcss', '@nuxt/content'],
  content: {
    markdown: {
      anchorLinks: false,
    },
    documentDriven: true,
  },
  runtimeConfig: {
    quiet: false,
  },
  experimental: {
    watcher: 'chokidar',
  },
  pages: true,
});
