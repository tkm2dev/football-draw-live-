# Project Plan

## Phase 1 — MVP (สร้างแล้วใน scaffold นี้)
- Tournament shell
- 2 divisions / 12 teams each
- Admin draw control
- Live draw screen
- Constraint-based draw engine
- Senior 40 separation rule
- Group A-D display
- Auto round-robin match generator
- Prisma schema baseline

## Phase 2
- Persist everything to MySQL/Prisma
- Team logo upload
- Login/RBAC admin/operator/viewer
- Draw audit log + lock + signed result snapshot
- Full-screen presentation mode + sounds/animations
- OBS-friendly `/live/draw`

## Phase 3
- Match scheduling by date/time/field
- Score entry
- Auto standings (P/W/D/L/GF/GA/GD/Pts)
- Tie-break configuration
- Live match center

## Phase 4
- Knockout generator: QF/SF/Final
- Configurable qualification rules
- Public tournament page
- Poster/result image export
- PDF/Excel reports

## Phase 2 completed in this package
- Enhanced Admin Draw Control Center UI
- Draw status/progress indicator
- One-click draw-all for rehearsal/testing
- Draw Lock / Unlock
- Audit event log
- Improved 16:9 Live Screen presentation
- Live progress indicator and official result state

## Next implementation
1. Persist tournament/divisions/teams/draw sessions/events in Prisma + MySQL
2. Team logo upload and media storage
3. Match result entry and live score
4. Automatic standings + tie-break rules
5. Knockout bracket generator
6. Public tournament portal + image export
