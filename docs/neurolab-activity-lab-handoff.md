# NeuroLab Activity Lab Controls Handoff

Saved: 2026-06-11T09:37:29Z

## Latest savepoint

- `97a0394` — Savepoint: activity lab controls and intercom

Recent commits:
- `97a0394` — Savepoint: activity lab controls and intercom
- `f951a2c` — Docs: update NeuroLab event activity handoff
- `daa8aa9` — Savepoint: event-driven activity loop
- `22c2bb6` — Docs: update NeuroLab activity handoff
- `011eea4` — Savepoint: activity engine feed and snapshots

## Preflight / telemetry check

Before continuing, service and telemetry health were checked.

NeuroLab runtime on NukeBox:
- `neurolab-backend` up/healthy on port `3006`
- `neurolab-frontend` up on port `3005`
- `neurolab-websocket` up/healthy on port `3007`
- `neurolab-ai` up on port `3008`
- `neurolab-monitor` up on port `3009`

Backend health returned:

```json
{"ok":true,"service":"neurolab-backend","database":"ready"}
```

Frontend HTTP checks returned `HTTP/1.1 200 OK` from both NukeBox localhost and Garden/Tailscale URL.

Docker telemetry endpoint verified:
- `GET /api/system/docker`
- returned `available: true`
- `source: telemetry:nukebox`
- `sourceDevice: nukebox`
- `running: 5`
- `total: 5`
- `stopped: 0`
- `sourcePath: /networking/Outbox/nukebox/docker/docker_stats.json`
- note: backend container still falls back to read-only NukeBox telemetry because Docker CLI is not mounted in backend (`spawn docker ENOENT`). This is expected from the read-only telemetry design.

Garden Discord/control services also checked:
- `oracle-control-bot.service` active/running
- `hermes-gateway.service` active/running
- `pull_post_device_telemetry.py --all --no-post` successfully pulled/cache-refreshed all configured device telemetry with no errors.

## Completed this pass

1. Added an Activity Lab drawer.
   - New `OPEN ACTIVITY LAB` button in the Activity Engine card.
   - Drawer is an overlay inside the Gen2 viewport.
   - Shows phase/tick, larger inventory counters, larger event feed, and save/undo controls.

2. Added manual lab controls.
   - `SEED PACKAGING`
     - adds +5 packaging units.
   - `FORCE EXTRACTION BATCH`
     - consumes one packaging unit if available and adds one extraction batch.
   - `FORCE R&D PASS`
     - consumes one R&D sample if available and adds one pass ticket.
   - `FORCE R&D FAIL`
     - consumes one R&D sample if available, adds one failed test, and queues one manager request.
   - `CLEAR MANAGER REQUESTS`
     - clears the manager request counter.

3. Added Intercom-style activity notices.
   - Bottom message stack now includes an `activity-intercom` message line.
   - Manual Activity Lab controls update the intercom text immediately.
   - Manual controls also prepend feed entries with `kind: control`.

4. Kept persistence behavior intact.
   - Manual controls mutate the same frontend `activityState` object.
   - Existing localStorage persistence remains active through `neurolab_gen2_activity_state_v1`.
   - Existing backend snapshot controls (`SAVE LOOP`, `UNDO LOOP`) remain wired through the previous Activity snapshot API.

## Files changed

- `frontend/src/components/Gen2FacilityDashboard.tsx`
  - Added `ActivityControl` type.
  - Added `activityLabOpen` and `intercomNotice` state.
  - Added `runActivityControl()`.
  - Added `applyManualActivityControl()` helper.
  - Added `ActivityLabDrawer` component.
  - Added `OPEN ACTIVITY LAB` action in `OperationsDeck`.
  - Added `control` activity event kind.

- `frontend/src/styles.css`
  - Added Activity Lab drawer styling.
  - Added intercom styling.
  - Added larger inventory/feed/control-grid styling.
  - Added `.activity-feed-control` color hook.

## Verification

Passed:

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

Compose rebuilt/recreated the NeuroLab stack because of dependencies. Final runtime check after health warmup:
- all five containers up
- backend and websocket healthy
- backend `/health` ready
- frontend local HTTP `200`
- Garden/Tailscale frontend HTTP `200`
- `/api/system/docker` telemetry returned five running containers from read-only NukeBox telemetry

Browser navigation via browser tool timed out, but direct HTTP checks from both NukeBox and Garden succeeded.

## Suggested next move

Good next phase options:

1. Make route-arrival events also trigger intercom notices, not just manual controls.
2. Add Activity Lab presets/scenarios:
   - normal production shift
   - R&D failure storm
   - sales push
   - manager sweep
3. Add backend-persisted event history if the feed should survive browser/device changes beyond localStorage snapshots.
4. Add visual room status badges driven by inventory/manager queue thresholds.

## Safety

- No secrets were added.
- Changes are frontend-only.
- Backend activity snapshot API remains unchanged.
- Manual controls are local/dashboard state controls, not real device control commands.
