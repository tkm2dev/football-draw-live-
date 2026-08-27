# Football Draw Live — Tournament Control Center

ระบบจัดการแข่งขันฟุตบอลเฉลิมพระเกียรติ ครั้งที่ 13/2569 ตั้งแต่จับสลาก Live จนถึงรอบชิง

## Modules
- Dashboard
- 2 divisions: รุ่นประชาชน 12 ทีม / รุ่นอาวุโส 40+ OPEN 12 ทีม
- Constraint-based Live Draw, Draw Lock, Audit Log
- 4 groups A-D, 3 teams/group
- Automatic round-robin generator: 12 group matches/division
- Match Center + score entry + field/kickoff data
- Automatic standings: P/W/D/L/GF/GA/GD/Pts
- Qualification: top 2/group
- Knockout: QF → SF → Final
- Public tournament portal
- 16:9 Live Draw output for projector / TV / OBS
- Socket.IO real-time updates
- Prisma/MySQL production schema baseline

## Special senior rule
เพื่อนเยาวชน / ปตท.บายพาส นครพนม / Safe House ต้องอยู่คนละสาย

## Stack
Vue 3 + TypeScript + Pinia + Vue Router + Vite / Node.js + Express + TypeScript + Socket.IO / Prisma + MySQL 8

## Run
1. `npm install`
2. `cp apps/api/.env.example apps/api/.env`
3. `npm run dev:api`
4. `npm run dev:web`

Web: http://localhost:5173  
API: http://localhost:4000

## Routes
- `/` dashboard
- `/draw/admin` draw control
- `/live/draw` fullscreen live draw
- `/groups` group result
- `/matches` match center / score entry
- `/standings` automatic standings
- `/bracket` knockout bracket
- `/public` public tournament portal

## Persistence note
`prisma/schema.prisma` contains the production model for Tournament, Division, Team, Group, GroupTeam, DrawRule, DrawSession, DrawEvent and Match. The current demo API intentionally keeps runtime draw/match state in memory so the UI can be tested without a database. Wiring the services to Prisma repositories is the remaining production persistence task.
