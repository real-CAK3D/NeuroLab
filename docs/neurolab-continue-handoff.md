# NeuroLab Continue Handoff

Saved: 2026-06-11T02:42:07Z

## Savepoints created

- `ff824ce` — Savepoint: facility editor validation and snapshots
- `bbea680` — Savepoint: improve facility snapshot tools

## Current live state

- Frontend: `http://100.122.30.95:3005/`
- Backend health: `http://100.122.30.95:3006/health`
- Facility layout API: `http://100.122.30.95:3006/api/facility-layout`
- Project path: `C:\Users\CAK3D\OneDrive\Documents\New project`

## Completed this continuation

1. Created a git savepoint for the prior completed work.
2. Added Facility editor improvement pass:
   - Export JSON button.
   - Import draft JSON buffer.
   - Snapshot history panel.
   - Load historical snapshot into local drafts.
   - Validation status panel showing backend failures/warnings.
   - Better wrapping action bar for the expanded controls.
3. Verified:
   - `npm run verify` passed.
   - `npm --prefix backend run check` passed.
   - `docker compose up -d --build neurolab-frontend` completed.
   - `docker compose ps` showed containers running.
   - backend `/health` returned ready.
   - frontend local HTTP returned 200.
   - facility layout API returned current snapshot state.
4. Created a second git savepoint after the improvement pass.

## Validation notes

`npm run verify` passed with no failures.
Known warnings remain layout-review warnings, not blockers:

- Some doors do not directly overlap hallway tiles.
- Two large blocking props are flagged for route awareness.

NPC boundary check passed with 24 NPCs and 3494 walkable tiles.

## Suggested next move

Continue into the Staff editor pass:

- Right-click staff -> Edit Character.
- Add sprite/role/station/route/cargo editor fields in Grow Ops -> Staff.
- Add route preview/test playback.
- Save staff config through backend snapshots similar to Facility layout.

After that, move into the activity engine:

- Inventory counters for Packaging, Extraction, R&D, R&D Test, Sales.
- NPC route events that create product/extract/sample/sales state changes.
- Activity feed/intercom messages.

## Safety

- The Facility editor still does not mutate source map files. Apply currently persists backend snapshots and browser drafts only.
- Keep using git savepoints before larger refactors or source-map mutation.
