// pm2 config; cwd is the release folder this file lives in.
const path = require('node:path');

module.exports = {
  apps: [{
    name: 'vlrstats',
    cwd: path.resolve(__dirname, '..'),
    script: 'dist/server.js',
    node_args: '--env-file=/srv/vlrstats/shared/.env --disable-warning=ExperimentalWarning',
    max_memory_restart: '300M',
    env: { NODE_ENV: 'production' },
  }],
};
