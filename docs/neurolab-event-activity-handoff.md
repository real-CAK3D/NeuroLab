# NeuroLab Event-Driven Activity Handoff

Saved: 2026-06-11T03:28:36Z

## Latest savepoint

- `daa8aa9` — Savepoint: event-driven activity loop

Recent savepoints:
- `22c2bb6` — Docs: update NeuroLab activity handoff
- `011eea4` — Savepoint: activity engine feed and snapshots
- `2961c39` — Docs: update NeuroLab staff handoff
- `6273808` — Savepoint: staff editor route preview and snapshots

## Completed this pass

1. Converted Activity Engine from derived-only to mutable local state.
   - Activity state is now loaded from/persisted to browser localStorage key:
     - `neurolab_gen2_activity_state_v1`
   - Initial fallback state seeds Packaging, Extraction, R&D, Sales, manager request counters, and boot feed entries.

2. Added route-arrival event detection.
   - Tracks each NPC's previous room with `previousNpcRoomsRef`.
   - On NPC movement, detects room changes and generates activity events only when a staff sprite enters meaningful rooms.
   - Meaningful rooms currently include:
     - `pack`
     - `extract`
     - `rd1`
     - `rd2`
     - `sales`
     - `ops`
     - `cultMgr`
     - `boss`

3. Added mutable inventory transitions.
   - Packaging arrival: adds packaging units.
   - Extraction arrival: consumes packaging and adds extraction batch.
   - R&D arrival: consumes extraction batch and adds R&D sample.
   - R&D Test arrival: consumes R&D sample and adds pass/fail result.
   - Sales arrival: consumes pass ticket and adds sales stock.
   - Manager arrival: clears one manager request.

4. Activity feed is now event-driven.
   - New feed entries are prepended when route arrivals happen.
   - Feed is capped at 30 entries.
   - Messages name the arriving staff member when possible.
   - R&D Test failures queue manager requests.

5. Activity Engine UI now explains the route-driven behavior.
   - Header includes phase and tick.
   - Subtitle says route arrivals mutate inventory and feed entries.

## Verification

Passed:

- `npm run verify`
  - `check:facility`: failures `[]`
  - `check:npc-boundaries`: failures `[]`
  - frontend TypeScript/Vite build succeeded
- `npm --prefix backend run check`
  - backend TypeScript check succeeded
- Docker redeploy completed:
  - `docker compose up -d --build neurolab-frontend`
  - compose rebuilt related images and restarted NeuroLab stack
- Runtime checks:
  - `docker compose ps` showed all services up
  - backend and websocket healthy after startup
  - backend `/health` returned `{"ok":true,"service":"neurolab-backend","database":"ready"}`
  - frontend local HTTP returned `200`
  - Garden curl to `http://100.122.30.95:3005/` returned `HTTP/1.1 200 OK`

Browser navigation from the browser tool timed out, but direct HTTP checks from NukeBox and the Garden both succeeded.

## Suggested next move

Add explicit Activity Lab controls and deeper intercom hooks:

1. Add an Activity drawer/tab so the feed can breathe beyond the left Operations deck.
2. Add manual test controls:
   - seed packaging
   - force extraction batch
   - force R&D pass/fail
   - clear manager requests
3. Emit visible Intercom-style notices from activity events:
   - failed R&D test -> manager request / boss brief
   - sales stock high -> sales ping
   - extraction batch ready -> R&D sample request
4. Consider backend persistence for event history after the event flow feels right.

## Safety

- Backend activity snapshot API from prior pass remains unchanged and available.
- This pass only changed frontend component/style files.
- Activity smoke-test backend rows had already been cleared in the prior pass.
