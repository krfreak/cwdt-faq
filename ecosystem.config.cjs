// PM2 deployment config.
//
// This file is `.cjs` rather than `.js` on purpose: package.json sets `"type": "module"`,
// and PM2 loads config files with `require()`, so the config must stay CommonJS.
// PM2 recognises `ecosystem.config.cjs` natively (>= 5.x).
module.exports = {
  apps: [
    {
      name: 'CWDT-FAQ',
      script: './.output/server/index.mjs',
      exec_mode: 'cluster',
      instances: 'max',
      env: {
        NODE_ENV: 'production',
        // Nitro reads HOST/PORT from the environment. PM2 has no `port` option,
        // so setting it here is what actually binds the server.
        HOST: '0.0.0.0',
        PORT: 3344,
      },
    },
  ],
};
