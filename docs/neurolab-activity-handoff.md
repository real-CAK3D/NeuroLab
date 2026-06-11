# NeuroLab Activity Engine Handoff

Saved: 2026-06-11T03:03:36Z

## Latest savepoint

- `011eea4` — Savepoint: activity engine feed and snapshots

Recent savepoints:
- `2961c39` — Docs: update NeuroLab staff handoff
- `6273808` — Savepoint: staff editor route preview and snapshots
- `df13d4d` — Docs: update NeuroLab continuation handoff

## Completed this pass

1. Frontend activity engine panel
   - Added an `ACTIVITY ENGINE` card inside the left Operations deck.
   - Shows phase label driven by the existing production phase loop.
   - Shows inventory counters:
     - PKG / Packaging inventory
     - EXT / Extraction batches
     - R&D / R&D samples
     - PASS / passed test tickets
     - FAIL / failed tests
     - SALES / sales stock
   - Shows a live activity feed with packaging, extraction, R&D, test, and sales messages.
   - Counters are derived from production phase, incident phase, NPC room positions, and NPC cargo states.

2. Activity snapshot controls
   - Added `SAVE LOOP` and `UNDO LOOP` controls in the activity engine card.
   - Shows activity checkpoint status and undo count.

3. Backend activity-state API
   - Added `GET /api/activity-state`.
   - Added `POST /api/activity-state`.
   - Added `POST /api/activity-state/undo`.
   - Uses existing `settings` table:
     - `activity_state_current`
     - `activity_state_history`
   - Snapshot shape: `{ id, savedAt, note, state, validation }`.
   - Validates tick, inventory counters, and feed array.

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
  - all containers up
  - backend and websocket healthy
  - backend `/health` returned `{"ok":true,"service":"neurolab-backend","database":"ready"}`
  - frontend local HTTP returned `200`
  - activity API smoke test POST/undo returned failures `[]`

Smoke-test activity snapshots were cleared afterward, so `GET /api/activity-state` currently returns:

```json
{"current":null,"history":[]}
```

## Suggested next move

Make the activity engine less formulaic and more event-driven:

1. Add `ActivityEvent` generation from actual route arrivals:
   - detect when selected NPCs enter Packaging, Extraction, R&D, R&D Test, Sales
   - increment/decrement inventory based on room transitions
2. Persist activity state locally between reloads.
3. Add an Activity tab or larger feed panel if the Operations deck becomes cramped.
4. Connect activity events to Intercom:
   - failed R&D test -> manager request message
   - sales stock high -> boss brief
   - extraction batch ready -> R&D sample request
5. Optional backend next:
   - `POST /api/intercom` on meaningful activity events
   - activity event history table or settings-backed bounded history

## Safety

- Current activity state is derived/read-only in the UI except snapshots.
- Smoke-test backend settings were cleared after verification.
- Keep using git savepoints before turning derived counters into mutable inventory state.
