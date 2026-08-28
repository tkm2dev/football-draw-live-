# Production deployment — Windows VPS

The API serves the built Vue app, so PM2 exposes one private origin on port `3140`. MySQL at `10.10.30.96` is the source of truth for draw sessions, assignments, audit events, match schedules and scores. The approved public hostname is `football.siteams.com`, but its Cloudflare route remains disabled until the smoke-test gate passes.

## Required values

Obtain these before deployment. Do not invent or commit them:

- MySQL admin access, or an existing database name/user/password
- A random `ADMIN_API_KEY` of at least 32 characters
- The allowed web origin for `WEB_ORIGIN`
- The Cloudflare Tunnel name and public hostname (only after the deployment gate passes)

Prerequisites: Node.js 20+, MySQL 8, Git, PM2 and cloudflared.

## 1. Install or update

```powershell
# Fresh install
Set-Location C:\apps
git clone https://github.com/tkm2dev/football-draw-live-.git
Set-Location C:\apps\football-draw-live-

# Existing install
Set-Location C:\apps\football-draw-live-
git fetch origin
git checkout main
git pull --ff-only origin main

npm ci
Copy-Item apps/api/.env.example apps/api/.env -ErrorAction SilentlyContinue
```

Edit `apps/api/.env` and replace every placeholder:

```dotenv
NODE_ENV="production"
PORT=3140
DATABASE_URL="mysql://football_draw_app:URL_ENCODED_PASSWORD@10.10.30.96:3306/football_draw_live"
WEB_ORIGIN="https://football.siteams.com"
ADMIN_API_KEY="A_RANDOM_SECRET_WITH_AT_LEAST_32_CHARACTERS"
```

The MySQL password in `DATABASE_URL` must be URL encoded. Keep this file off Git.

## 2. Create database on `.96`

Run with an authorized MySQL account, replacing the placeholders first:

```sql
CREATE DATABASE football_draw_live CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE football_draw_live_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'football_draw_app'@'10.10.30.88' IDENTIFIED BY 'STRONG_DATABASE_PASSWORD';
GRANT ALL PRIVILEGES ON football_draw_live.* TO 'football_draw_app'@'10.10.30.88';
GRANT ALL PRIVILEGES ON football_draw_live_test.* TO 'football_draw_app'@'10.10.30.88';
FLUSH PRIVILEGES;
```

## 3. Verify code and database integration

```powershell
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run check
npm audit

$env:TEST_DATABASE_URL="mysql://football_draw_app:URL_ENCODED_PASSWORD@10.10.30.96:3306/football_draw_live_test"
npm run test:integration
Remove-Item Env:TEST_DATABASE_URL
```

`test:integration` resets only the database named by `TEST_DATABASE_URL`. Never point it at the production database.

## 4. Start with PM2

```powershell
pm2 delete football-draw-live-api 2>$null
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
pm2 logs football-draw-live-api --lines 100
```

Verify from the VPS before configuring a public route:

```powershell
Invoke-RestMethod http://127.0.0.1:3140/api/health
Invoke-WebRequest http://127.0.0.1:3140/draw/admin -UseBasicParsing
Invoke-WebRequest "http://127.0.0.1:3140/live/draw?division=SENIOR40&projector=1" -UseBasicParsing
```

The health response must show `ok: true`, `database: ready` and `adminSecurity: ready`.

## 5. Two-screen realtime smoke test

This test deliberately resets the selected division, draws one team, confirms two Socket.IO clients received the same persisted update, then resets the smoke data. Run it only before official draw data exists:

```powershell
$env:BASE_URL="http://127.0.0.1:3140"
$env:DIVISION="SENIOR40"
$env:ADMIN_API_KEY="THE_SAME_ADMIN_API_KEY_FROM_APPS_API_ENV"
$env:ALLOW_DRAW_SMOKE_RESET="YES_I_UNDERSTAND"
npm run smoke:realtime
Remove-Item Env:BASE_URL,Env:DIVISION,Env:ADMIN_API_KEY,Env:ALLOW_DRAW_SMOKE_RESET
```

Also open Admin Draw and Live Draw in two separate browsers/projector outputs and confirm the reveal, progress `0–12`, group highlight, lock state and audit timeline update together.

## 6. Cloudflare gate

Do not create or enable the public hostname route until all previous steps pass. After they pass, use the existing approved tunnel and hostname:

```powershell
cloudflared tunnel ingress validate
cloudflared tunnel run TUNNEL_NAME
```

The `football.siteams.com` tunnel ingress service should target `http://127.0.0.1:3140`. Re-run the health check through the approved HTTPS hostname, then save/start cloudflared using the server's existing service policy.

## Rollback

```powershell
Set-Location C:\apps\football-draw-live-
git log --oneline -5
git checkout PREVIOUS_KNOWN_GOOD_COMMIT
npm ci
npm run prisma:generate
npm run build
pm2 restart football-draw-live-api --update-env
```

Database migrations are forward-only. Take a MySQL backup before deploying later schema changes.
