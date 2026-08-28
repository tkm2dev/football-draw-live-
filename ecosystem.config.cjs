module.exports = {
  apps: [{
    name: 'football-draw-live-api',
    cwd: './apps/api',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    listen_timeout: 10000,
    kill_timeout: 10000,
    env: {NODE_ENV: 'production', PORT: 4000}
  }]
}
