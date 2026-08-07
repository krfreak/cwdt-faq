// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.scss', '~/assets/css/markdown.scss'],
  modules: ['@nuxt/content', '@nuxt/eslint', '@pinia/nuxt', '@nuxtjs/tailwindcss', '@vueuse/nuxt'],
  content: {
    // Was `content.markdown.anchorLinks` under Content v2.
    renderer: {
      anchorLinks: false,
    },
  },
  runtimeConfig: {
    quiet: false,
  },
});
