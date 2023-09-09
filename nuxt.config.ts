// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ["@pinia/nuxt"],
  runtimeConfig: {
    mongodbUri: process.env.MONGO_URL,
  },
  nitro: {
    plugins: ["~/server/plugins/mongodb.ts"],
  },
});
