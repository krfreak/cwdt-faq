# CWDT FAQ

FAQ, crafting guides and tools for the CWDT build, built with [Nuxt 4](https://nuxt.com/docs) and [Nuxt Content](https://content.nuxt.com).

This project uses [pnpm](https://pnpm.io).

## Setup

```bash
pnpm install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
pnpm dev
```

## Production

Build the application for production:

```bash
pnpm build
```

Locally preview the production build:

```bash
pnpm preview
```

Deployment is handled with PM2 via `ecosystem.config.js`, which serves `.output/server/index.mjs`.

## Linting

```bash
pnpm lint      # check
pnpm lint:fix  # autofix
```

## A note on `@nuxtjs/mdc`

`@nuxtjs/mdc` is listed as a direct dependency even though `@nuxt/content` already pulls it
in. Don't remove it. Under pnpm's strict isolation it would not be linked at the project
root, and Vite could then not resolve the `@nuxtjs/mdc > …` entries that the module adds to
`optimizeDeps.include`, producing a `NUXT_B7002` warning on every dev start and skipping
pre-bundling of the markdown pipeline. Keeping it as a direct dependency makes it resolvable
at the root; pnpm still dedupes it to the single copy `@nuxt/content` uses.

## Content

Markdown lives in `content/`, organised into the `faq`, `crafts` and `pobs` collections
defined in `content.config.ts`. Adding a `.md` file to one of those directories is enough
for it to show up in the app.
