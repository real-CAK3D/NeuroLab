# NeuroLab Activity Intercom Scenarios Handoff

Saved: 2026-06-11T10:00:00Z

## Latest savepoint

- `8535d65` — Savepoint: activity intercom scenarios and room badges

Recent commits:
- `8535d65` — Savepoint: activity intercom scenarios and room badges
- `c7d2eec` — Docs: update NeuroLab activity lab handoff
- `97a0394` — Savepoint: activity lab controls and intercom
- `f951a2c` — Docs: update NeuroLab event activity handoff
- `daa8aa9` — Savepoint: event-driven activity loop

## Completed this pass

1. Route-arrival events now update the Intercom.
   - The existing route-arrival activity events still mutate inventory/feed.
   - When a new route-arrival feed event is created, the bottom Intercom line updates with that event.
   - This makes staff movement visible outside the small Activity Engine feed.

2. Added Activity Lab scenario presets.
   - `NORMAL SHIFT`
     - stages packaging, extraction, and R&D sample inventory.
   - `R&D FAILURE STORM`
     - adds failed tests and queues manager requests.
   - `SALES PUSH`
     - adds pass tickets and sales stock.
   - `MANAGER SWEEP`
     - clears manager requests and reduces one failed-test pressure point.
   - Presets create `control` feed entries and update the same local `ActivityState` as route arrivals/manual controls.

3. Added activity-driven room badges.
   - Packaging:
     - shows package count or `LOW PKG` warning.
   - Extraction:
     - shows extraction batch count, `WAIT PKG`, or `EXT STACK`.
   - R&D intake:
     - shows sample count or `WAIT EXT`.
   - R&D Test:
     - shows pass count or manager-request warning.
   - Sales:
     - shows sales stock or `SALES FULL`.
   - Ops / Cult Manager / Boss:
     - show manager request count when requests are queued.

4. Styling updates.
   - Added scenario preset button styling.
   - Added room badge styling with ready/warn/busy tones.
   - Warning room badges blink using the existing Gen2 blink animation.

## Files changed

- `frontend/src/components/Gen2FacilityDashboard.tsx`
  - Added `ActivityScenario` type.
  - Added `ActivityRoomBadge` type.
  - Added `runActivityScenario()`.
  - Added `applyActivityScenario()`.
  - Added `activityBadgeForRoom()`.
  - Updated route-arrival effect to update `intercomNotice` when a new activity feed event appears.
  - Passed `activityState` into room rendering.
  - Added scenario buttons to `ActivityLabDrawer`.
  - Added room activity badges through `RoomFrame`.

- `frontend/src/styles.css`
  - Added `.activity-lab-section-title`.
  - Added `.activity-scenario-grid` styling.
  - Added `.activity-room-badge` with `tone-ready`, `tone-warn`, and `tone-busy` variants.

## Verification

Passed before commit:

```bash
npm run verify
```

Results:
- `check:facility` passed with `failures: []`
- `check:npc-boundaries` passed with `failures: []`
- frontend TypeScript/Vite build succeeded

Passed:

```bash
npm --prefix backend run check
```

Result:
- backend `tsc --noEmit` succeeded

Redeployed:

```bash
docker compose up -d --build neurolab-frontend
```

Post-deploy local checks on NukeBox:
- all five NeuroLab containers up
- backend `/health` returned ready
- frontend localhost returned `HTTP/1.1 200 OK`
- `/api/system/docker` returned read-only NukeBox telemetry with five running containers

## Notes

- Changes are frontend-only.
- Manual controls and scenarios are dashboard/lab-state controls only; they do not run device commands.
- Activity state still persists through localStorage key `neurolab_gen2_activity_state_v1` and can still be saved/restored through the existing backend Activity snapshot controls.
- Browser/remote Garden smoke checks can be flaky or guarded; NukeBox localhost checks were verified after deployment.

## Suggested next move

1. Add scenario outcome previews before applying a preset.
2. Add backend-persisted event history if the Activity feed should survive browser/device switches beyond localStorage/snapshots.
3. Add a compact Activity minimap legend explaining room badges.
4. Add thresholds to room context menus so right-clicking a room explains why a badge is warning/busy.
