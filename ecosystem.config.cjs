module.exports = {
  apps: [{
    name: 'football-draw-live-api',
    cwd: './apps/api',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: { NODE_ENV: 'production', PORT: 4000 }
  }]
}
