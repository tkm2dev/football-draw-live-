# Football Draw Live — Tournament Control Center

ระบบจัดการแข่งขันฟุตบอลเฉลิมพระเกียรติ ครั้งที่ 13/2569 ตั้งแต่พิธีจับสลากแบบ Live ถึงรอบชิง

## Production draw phase

- Prisma/MySQL is the source of truth; no draw or match runtime state is kept in memory
- Serializable Prisma transactions plus MySQL row locks protect concurrent draw actions
- DrawSession, DrawEvent snapshots and AuditLog preserve every draw, lock, reset and match mutation
- 12 teams → four groups A–D → three teams per group
- Senior rule: three admin-selected teams always enter different groups, using stable team codes so names remain editable
- Team Management edits all 12 names and the three senior separation teams atomically with an AuditLog entry
- Team logos can be uploaded from Team Management as PNG, JPG or WebP (maximum 5 MB); file signatures are validated and every change is audited
- Extensible persisted rules: `SEPARATE_TEAMS`, `SEED_ACROSS_GROUPS`, `LOCK_TEAM_TO_GROUP`, `BLOCK_TEAM_FROM_GROUPS`
- Admin Control is available without an application key; restrict the admin URL at the network or Cloudflare layer when external users can reach the deployment
- Broadcast-style 16:9 Live Draw with a server-synchronised team wheel, team-by-team reveal, 0–12 progress, highlighted group, official result state, audit timeline and fullscreen mode
- Socket.IO rooms keep Admin, Live and public screens synchronized per division
- Match generation, scores, standings and knockout state are persisted in MySQL

## Stack

Vue 3, TypeScript, Pinia, Vue Router, Vite, Node.js, Express, Socket.IO, Prisma and MySQL 8.

## Local run

1. Install MySQL 8 and create an empty database.
2. `npm ci`
3. `cp apps/api/.env.example apps/api/.env` and set `DATABASE_URL`.
4. `npm run prisma:generate`
5. `npm run prisma:migrate`
6. `npm run prisma:seed`
7. Run `npm run dev:api` and `npm run dev:web` in separate terminals.

Web: `http://localhost:5173`

API: `http://localhost:4000`

## Quality checks

- `npm run check` — deterministic constraint tests, TypeScript and production bundles
- `npm audit` — dependency security audit
- `TEST_DATABASE_URL="mysql://.../football_draw_live_test" npm run test:integration` — destructive MySQL integration test against a dedicated test database only
- `npm run smoke:realtime` — guarded two-client realtime smoke test; see [DEPLOY.md](DEPLOY.md)

## Routes

- `/draw/admin` — Admin Draw Control
- `/live/draw?projector=1` — 16:9 Live Draw รวมผลทั้ง 2 รุ่น
- `/groups` — official groups
- `/matches` — match schedule and scores
- `/standings` — automatic group tables
- `/bracket` — QF → SF → Final
- `/public` — public tournament view

Production deployment and the public-hostname gate are documented in [DEPLOY.md](DEPLOY.md).
