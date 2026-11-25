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

Deployment is handled with PM2 via `ecosystem.config.cjs`, which serves `.output/server/index.mjs`.
Run `pnpm pob:pack` before building (see below).

## PoB checker

`/pobcheck` checks a pasted Path of Building code entirely in the visitor's browser. The build is
calculated by Path of Building itself, so timeless jewels, cluster jewels, tattoos, catalysts,
Wickerman items and gem levels all count exactly as in the app. PoB's Lua runs on Lua 5.2 compiled
to WebAssembly, in a Web Worker:

- `pob-wasm/engine/` builds the WebAssembly engine (Lua 5.2 + lua-utf8 + zlib + a small C host).
  The result in `engine/dist/` is committed; rebuild it only when changing the engine
  (`sh pob-wasm/engine/build.sh`, needs Docker).
- `pob-wasm/boot.lua` makes PoB (written for LuaJIT) run on Lua 5.2 and loads it headless.
  `pob-wasm/extract.lua` pulls the numbers out of a build (CWDT thresholds, Skeleton duration,
  Heartbound and Forbidden Rite self-damage, ward, flasks...).
- `pob-wasm/pack.mjs` packs a Path of Building checkout into `public/pob/`: content-hashed files
  plus `manifest.json`. About 5 MB is downloaded on the first check; older passive trees and timeless
  jewel data are fetched only by builds that use them.
- `app/workers/pobcheck.worker.ts` runs the engine and `shared/utils/pobAnalysis.ts`, which turns
  PoB's numbers into the loop, timing, ward and flask margins shown on the page.
- Build links (pobb.in, poe.ninja, pastebin and the other sites PoB imports from, see
  `shared/utils/pobLinks.ts`) are downloaded by `server/api/pob-link.get.ts`, because most of those
  sites do not allow cross-origin requests from the browser. The route only fetches URLs built from
  the fixed templates in `pobLinks.ts` (the pasted link only supplies a validated build id), and
  caches results for 10 minutes. Rate-limit `/api/pob-link` in nginx like other endpoints.

The build mechanics, numbers and Path of Building details the checker relies on are collected in
[docs/cwdt-build-mechanics.md](docs/cwdt-build-mechanics.md). Update it when they change.

`public/pob/` is generated and not committed. Create it from a
[Path of Building Community](https://github.com/PathOfBuildingCommunity/PathOfBuilding) checkout,
and again whenever PoB is updated (e.g. at league start):

```bash
POB_PATH=/path/to/PathOfBuilding pnpm pob:pack
pnpm build
```

The web server should serve `manifest.json` with a short cache lifetime; every other file in
`public/pob/` has a content hash in its name and can be cached forever.

To run builds through the engine without a browser (handy after a PoB update), pass files that
contain PoB codes or build XML:

```bash
POB_PATH=/path/to/PathOfBuilding pnpm pob:check build1.txt build2.txt
```

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
