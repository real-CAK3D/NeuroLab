# NeuroLab Staff Editor Handoff

Saved: 2026-06-11T02:51:48Z

## Latest savepoint

- `6273808` — Savepoint: staff editor route preview and snapshots

Previous useful savepoints:
- `df13d4d` — Docs: update NeuroLab continuation handoff
- `bbea680` — Savepoint: improve facility snapshot tools
- `ff824ce` — Savepoint: facility editor validation and snapshots

## Completed this pass

1. Staff right-click workflow
   - NPC/staff context menu now includes `Edit character`.
   - It opens Grow Ops on the Staff tab focused on that staff member.
   - It also selects the staff sprite so route highlighting/worker panel context stays aligned.

2. Staff route/cargo preview
   - Grow Ops -> Staff now shows a `ROUTE / CARGO PREVIEW` card for the selected staff member.
   - Shows start tile, direction, cargo/carry state, and first route steps with room labels when available.
   - Added `TEST ROUTE VIEW` and `CLEAR ROUTE VIEW` buttons.

3. Backend staff snapshot API
   - Added `GET /api/staff-config`.
   - Added `POST /api/staff-config`.
   - Added `POST /api/staff-config/undo`.
   - Persists current/history through the existing `settings` table.
   - Validates keyed staff config for names, titles, roles, station room, and basic age range.

4. Staff snapshot UI
   - Grow Ops -> Staff now has a `STAFF SNAPSHOT` panel.
   - Added `APPLY STAFF SNAPSHOT` and `UNDO STAFF SNAPSHOT` controls.
   - Snapshot status and undo count are visible in the panel.

## Verification

Passed:

- `npm run verify`
  - `check:facility`: failures `[]`
  - `check:npc-boundaries`: failures `[]`
  - frontend TypeScript/Vite build succeeded
- `npm --prefix backend run check`
  - backend TypeScript check succeeded
- Docker redeploy completed:
  - `docker compose up -d --build neurolab-backend neurolab-frontend`
- Runtime checks:
  - `docker compose ps` showed all NeuroLab containers up, backend/websocket healthy
  - backend `/health` returned `{"ok":true,"service":"neurolab-backend","database":"ready"}`
  - frontend local HTTP returned `200`
  - staff config API smoke test POST/undo returned failures `[]`

Smoke-test staff snapshot rows were cleared afterward, so `GET /api/staff-config` currently returns:

```json
{"current":null,"history":[]}
```

## Suggested next move

Continue into the activity engine pass:

- Add lightweight production state counters:
  - Packaging inventory
  - Extraction batches
  - R&D samples
  - R&D Test pass/fail
  - Sales stock
- Hook visible NPC routes into simulated events:
  - package -> extraction
  - extract -> R&D
  - sample -> R&D Test
  - passed test -> sales inventory
- Surface changes in an Activity Feed panel and/or Intercom messages.

Keep the next pass safe by adding frontend-only state first, then backend persistence after the UI/flow feels right.
