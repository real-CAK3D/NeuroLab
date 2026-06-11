# NeuroLab / Retro Pokémon Telemetry Dashboard — Next Session Handoff

Saved: 2026-06-11T02:02:13Z

## Current live state

- Live frontend: `http://100.122.30.95:3005/`
- Backend health: `http://100.122.30.95:3006/health`
- Windows/NukeBox project path: `C:\Users\CAK3D\OneDrive\Documents\New project`
- Garden scratch mirrors used recently:
  - `/tmp/neurolab-active`
  - `/tmp/neurolab-editor`
- CAK3D-Creations telemetry is online again.
  - Refresh script: `/home/ubuntu/.hermes/scripts/refresh_cak3d_creations_telemetry.py`
  - Cron job: `refresh-cak3d-creations-telemetry`
  - Job ID: `f64e78dfc0ae`
  - Schedule: every 10 minutes, quiet on success.

## Recently completed improvements

1. Grow Ops UI
   - Grow Ops now has `STAFF` and `FACILITY` tabs.
   - Close control moved above Staff / Facility tabs.
   - Onboarding/Screening desk right-click opens the room/facility editor.

2. Facility editor
   - Facility editor exists under Grow Ops -> Facility.
   - Supports room draft fields: label, kind, x/y, width/height, notes.
   - Drafts are browser-local only under `gen2-grow-ops-facility-drafts-v1`.
   - It does not yet apply changes to live map/source/backend state.

3. Layout
   - Maintenance room moved up about 6 tiles.
   - Maintenance door changed to top-facing to better align below Security hallway.
   - Maintenance props and maintenance worker start route were moved with it.

4. Pokémon-style decor
   - First CSS/prop-based decor pass added.
   - Used `nikouu/Pokemon-gen-2-style-tilemap` as MIT-licensed visual reference/inspiration only.
   - Added richer shelf/table/plant/lab/floor pixel dressing without importing copyrighted Pokémon assets.

5. Activity routes
   - Extraction tech: Packaging -> Extraction -> R&D with package/extract cargo.
   - Cultivation manager: checks grow coverage and visits bathroom for product test.
   - Processing manager: Packaging -> Sales product delivery.
   - R&D researcher: R&D Lab -> R&D Test -> Sales/manager request loop concept.
   - Staff profile/action text updated for these flows.

6. Build/deploy verification
   - `npm run build` passed.
   - Docker Compose redeploy passed.
   - Backend health returned ready.

## Audit findings / what is in place but not fully wired

1. Backend/frontend API plumbing exists but is underused
   - Backend routes found:
     - `GET /api/bootstrap`
     - `GET /api/employees/:id`
     - `GET /api/rooms/:id`
     - `GET /api/system/host`
     - `GET /api/system/docker`
     - `GET /api/system/facility-devices`
     - `POST /api/tasks`
     - `GET /api/intercom`
     - `POST /api/intercom`
     - `POST /api/ollama/chat`
     - `GET /api/ollama/models`
   - Main dashboard actively calls host/docker/models/facility-devices/Ollama chat.
   - `bootstrap`, `employees`, `rooms`, `tasks`, and `intercom` callers exist in frontend utils but are not visibly integrated into main dashboard gameplay yet.

2. Facility editor is UI-only/local-draft
   - Needs backend/source apply path, validation, undo, and persisted layout snapshots.

3. Staff editor tab exists conceptually but character editing is still hardcoded
   - Staff/routes/cargo/status are mostly in `gen2FacilityData.ts` and `gen2OperationsData.ts`.
   - Needs sprite/role/route/cargo/task editor.

4. Activity layer is mostly visual, not a full production state machine
   - Routes/cargo move visually.
   - There is not yet real inventory for flower/product/extract/tests/sales.

5. `frontend/scripts/check-npc-boundaries.mjs` exists but is untracked
   - Likely should be inspected and wired into package scripts / build validation.

6. AI/monitor services appear placeholder-ish from README
   - AI service and monitor daemon exist, but README calls them placeholder/template/read-only/mock-first.
   - Could become Professor/Gardiner summary and real telemetry monitoring services.

7. WebSocket service exists in Docker, but frontend live websocket usage still needs deeper verification.

8. `Gen2FacilityDashboard.tsx` is becoming a mega-component
   - It should be split soon before future edits become risky.

## Recommended next build order

### Phase 1 — Cleanup/checkpoint

- Re-run a clean source audit with a fixed script that excludes `node_modules` properly.
- Inspect `frontend/scripts/check-npc-boundaries.mjs`.
- Add validation scripts:
  - `npm run check:npc-boundaries`
  - `npm run check:facility`
  - `npm run verify`
- Run validation + build.
- Commit/checkpoint current working state.

### Phase 2 — Real Facility editor Apply/Undo

This is the keystone next feature.

Add:
- backend layout save/load API
- `Apply` button in Facility tab
- `Undo` / restore snapshot
- validation before apply:
  - no room overlap
  - doors connect to hallway/passable tiles
  - props inside rooms
  - NPC route points in bounds / passable
  - all referenced room/staff IDs exist
- export/import layout JSON

### Phase 3 — Real Staff editor

Add right-click Staff -> Edit Character:
- sprite selector
- role selector
- assigned room
- route node editor
- cargo behavior editor
- current action/personality/status text
- test-route playback
- save/load staff config

### Phase 4 — Activity engine

Turn the current visual route layer into real state:
- Packaging inventory
- Extraction oil batches
- R&D samples
- R&D Test pass/fail
- Sales ready inventory
- Manager request queue
- activity feed / intercom messages
- NPC status bubbles

Example flow:
1. Flower/product batch appears in Packaging.
2. Extraction tech takes product to Extraction.
3. Extraction creates oil/extract.
4. Extract goes to R&D.
5. R&D sends sample to R&D Test.
6. Good test -> Sales stock increases.
7. Bad test -> request more from Processing Manager.

### Phase 5 — Polish / game feel

- Expand right-click menus:
  - room: Edit Room, Add Prop, Assign Staff, View Status, Trigger Event
  - staff: Edit Character, Follow, Assign Task, View Route, Pause NPC
- Add prop palette / room themes:
  - office, lab, grow, processing, sales, security, utility, lounge
- Add Professor/Ganja/Gardiner overlay:
  - daily summary
  - event explainers
  - suggested next action
- Use WebSocket for live event/telemetry pushes if not already wired.
- Split component files:
  - `FacilityMap.tsx`
  - `RoomView.tsx`
  - `ContextMenu.tsx`
  - `GrowOpsPanel.tsx`
  - `StaffEditor.tsx`
  - `FacilityEditor.tsx`
  - `TelemetryPanel.tsx`
  - `ActivityFeed.tsx`
  - `IntercomPanel.tsx`

## Exact suggested next prompt

"Continue NeuroLab from the saved handoff. Start Phase 1: inspect and wire `frontend/scripts/check-npc-boundaries.mjs`, add facility validation scripts, run validation/build, then checkpoint. After that start Phase 2: real Facility editor Apply/Undo with backend-persisted layout snapshots."

## Safety notes

- Do not expose credentials or private key contents.
- Avoid directly importing copyrighted Pokémon assets. Use open/MIT-style references for inspiration or CSS-built pixel props.
- The live dashboard is on NukeBox; upload with SFTP and verify with `npm run build`, Docker Compose, and backend health.
- Facility editor map mutation should remain guarded by validation and undo snapshots.
