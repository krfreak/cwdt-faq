module.exports = {
  apps: {
    name: 'CWDT-FAQ',
    port: '3344',
    exec_mode: 'cluster',
    instances: 'max',
    script: './.output/server/index.mjs',
  },
};
