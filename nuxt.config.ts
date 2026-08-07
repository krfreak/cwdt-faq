// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.scss', '~/assets/css/markdown.scss'],
  modules: ['@nuxt/content', '@nuxt/eslint', '@pinia/nuxt', '@nuxtjs/tailwindcss', '@vueuse/nuxt', 'nuxt-security'],
  security: {
    // nuxt-security enables a rate limiter by default (150 requests / 5 min). It keys on
    // the socket IP, which behind a reverse proxy is the proxy itself - so every visitor
    // shares one bucket and the whole site starts returning 429. Rate limiting belongs in
    // nginx here. To enable it in-app instead, set `ipHeader: 'x-forwarded-for'` and make
    // sure the proxy overwrites that header rather than passing a client-supplied one.
    rateLimiter: false,
    headers: {
      contentSecurityPolicy: {
        // These are nuxt-security's defaults plus 'wasm-unsafe-eval'. The whole array
        // replaces the default, so the defaults have to be repeated here.
        //
        // 'wasm-unsafe-eval' is required because Nuxt Content v3 runs SQLite as
        // WebAssembly in the browser for client-side navigation. Prefer it over
        // 'unsafe-eval', which would also re-enable eval() for ordinary JavaScript.
        'script-src': ["'self'", 'https:', "'unsafe-inline'", "'strict-dynamic'", "'nonce-{{nonce}}'", "'wasm-unsafe-eval'"],
        // Content v3 loads its SQLite worker from a same-origin URL. Without this,
        // worker-src falls back to script-src, where 'strict-dynamic' blocks it.
        'worker-src': ["'self'"],
      },
    },
  },
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
