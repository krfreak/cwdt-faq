// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  css: ["@/assets/css/main.css"],
  devtools: { enabled: true },
  modules: ["@pinia/nuxt", "@nuxtjs/tailwindcss", "@nuxt/content"],
  content: {},
  runtimeConfig: {
    mongodbUri: process.env.MONGO_URL,
  },
  experimental: {
    watcher: "chokidar",
  },
});
