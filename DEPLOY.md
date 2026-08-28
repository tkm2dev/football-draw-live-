# Production deployment

Target: Windows Server VPS + PM2 + MySQL 8 + Cloudflare Tunnel.

## Prerequisites
Node.js 20+, MySQL 8, Git, PM2 and cloudflared.

## Install
```powershell
git clone https://github.com/tkm2dev/football-draw-live-.git
cd football-draw-live-
npm install
Copy-Item apps/api/.env.example apps/api/.env
```
Set `DATABASE_URL`, `WEB_ORIGIN` and `PORT` in `apps/api/.env`. Never commit `.env`.

## Database
```powershell
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## Build
```powershell
npm run build
```

## Start
```powershell
pm2 start ecosystem.config.cjs
pm2 save
```

## Verify
Check `GET /api/health`, Admin Draw, Live Draw, Groups, Matches, Standings, Bracket and Public pages. Verify two browsers receive Socket.IO updates before exposing through Cloudflare Tunnel.

## Deployment gate
Do not point the public hostname to this service until migration, seed, build, health check, draw constraint test, match scoring test and realtime screen test all pass.
