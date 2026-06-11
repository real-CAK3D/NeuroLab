# NeuroLab Current Room, Sprite, and Device Map

Status: protected baseline
Created for: Phase 1C before telemetry wiring
Rule: do not move, rename, reassign, or redesign rooms/sprites/workers without CAK3D approval.

## Purpose

This document freezes the current retro PokÃ©mon-style facility layout as the reference point before live telemetry work begins.

Future changes should preserve CAK3D's current layout unless explicitly approved. Device wiring should attach to the existing map first, not invent new rooms.

## Current map source files

- `frontend/src/game/gen2FacilityData.ts` â€” tile map, rooms, hallways, props, NPCs/workers.
- `frontend/src/game/gen2OperationsData.ts` â€” operations/status flavor data.
- `frontend/src/components/Gen2FacilityDashboard.tsx` â€” main Gen2 dashboard UI.
- `frontend/src/components/PhaserFacility.tsx` â€” Phaser rendering wrapper.
- `frontend/src/utils/api.ts` â€” frontend API client.
- `backend/src/api/routes.ts` â€” backend API routes.

## Current map dimensions

- Tile size: 16 px
- Width: 108 tiles
- Height: 62 tiles

## Protected current rooms

| ID | Label | Kind | Tile rectangle |
|---|---|---|---|
| boss | BOSS OFFICE | boss | x=2 y=2 w=18 h=14 |
| clone | CLONE ROOM | clone | x=22 y=4 w=11 h=10 |
| mother | MOTHER ROOM | mother | x=33 y=4 w=15 h=10 |
| grow1 | GROW ROOM 1 | grow | x=22 y=16 w=13 h=9 |
| grow2 | GROW ROOM 2 | grow | x=35 y=16 w=13 h=9 |
| grow3 | GROW ROOM 3 | grow | x=51 y=16 w=13 h=9 |
| grow4 | GROW ROOM 4 | grow | x=64 y=16 w=13 h=9 |
| soil | DRY ROOM | soil | x=6 y=25 w=13 h=14 |
| potting | POTTING | potting | x=22 y=29 w=12 h=10 |
| cultMgr | CULTIVATION MGR | manager | x=34 y=29 w=14 h=10 |
| trim | PROCESS/TRIM | processing | x=51 y=2 w=18 h=12 |
| pack | PACKAGING | packaging | x=70 y=2 w=10 h=12 |
| extract | EXTRACTION | extraction | x=81 y=2 w=12 h=12 |
| security | SECURITY | security | x=95 y=1 w=11 h=15 |
| ops | OPS OFFICE | manager | x=83 y=18 w=13 h=7 |
| break | BREAK ROOM | break | x=52 y=27 w=21 h=12 |
| bath | BATHROOMS | bathroom | x=73 y=27 w=9 h=12 |
| screen | SCREENING ROOM | screening | x=85 y=27 w=14 h=12 |
| dock | LOADING | warehouse | x=82 y=42 w=23 h=6 |
| warehouse | WAREHOUSE | warehouse | x=82 y=48 w=23 h=12 |
| sales | SALES OFFICE | sales | x=2 y=42 w=26 h=15 |
| rd1 | R&D LAB | research | x=38 y=42 w=19 h=15 |
| rd2 | R&D TEST | research | x=57 y=42 w=22 h=15 |

## CAK3D correction / future rename note

- `ops` currently appears as `OPS OFFICE` in the map.
- CAK3D clarified this should conceptually be the **Processing Manager** area.
- Do not change it yet unless explicitly approved; record this as the intended future semantic correction.

## Protected current NPCs / workers

| ID | Role | Tile position |
|---|---|---|
| boss | boss | x=10 y=10 |
| bossSecretary | secretary | x=15 y=12 |
| cloneWorker | cultivation | x=29 y=10 |
| motherWorker | cultivation | x=42 y=10 |
| growWorker | cultivation | x=28 y=21 |
| grow2Worker | cultivation | x=41 y=21 |
| grow3Worker | cultivation | x=56 y=20 |
| grow4Worker | cultivation | x=69 y=20 |
| pottingWorker | cultivation | x=28 y=32 |
| soilWorker | cultivation | x=14 y=33 |
| cultManager | executive | x=44 y=35 |
| processor | processing | x=62 y=10 |
| packer | processing | x=75 y=10 |
| extractor | processing | x=86 y=9 |
| opsManager | executive | x=94 y=22 |
| security | security | x=100 y=12 |
| patrol | security | x=93 y=40 |
| logistics | logistics | x=93 y=54 |
| researcher | science | x=66 y=50 |
| rdSafety | science | x=54 y=53 |
| salesRep | executive | x=8 y=48 |
| salesAssistant | executive | x=18 y=49 |
| screenHr | executive | x=91 y=34 |
| maintenance | maintenance | x=77 y=36 |

## Current device-to-room telemetry mappings

The live backend currently reports these intended mappings from `/api/system/facility-devices`:

| Device ID | Display name | Current room ID | Current status |
|---|---|---|---|
| hp-laptop | HP Laptop | clone | waiting/stale |
| the-bak3ry | BAK3RY | grow1 | waiting/stale |
| hack-safe | Hack-Safe | grow2 | waiting/stale |
| oracle-vm | The Garden | grow4 | waiting/stale |

These mappings should be treated as existing behavior, not final design approval.

## Live service/API baseline

Current compose services:

- `neurolab-frontend` on port 3005
- `neurolab-backend` on port 3006
- `neurolab-websocket` on port 3007
- `neurolab-ai` on port 3008
- `neurolab-monitor` on port 3009

Backend routes currently used/discovered:

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

## Known Phase 1A gaps

- Device telemetry endpoint exists, but all devices are currently stale/waiting.
- Backend container sees `docker` as unavailable because Docker CLI/socket is not present inside the container.
- Ollama model endpoint currently returns 502 when Ollama is not reachable.
- Host telemetry is container-level Linux telemetry, not full Windows hardware telemetry.

## Guardrails for next work

1. Wire telemetry read-only first.
2. Do not edit room geometry as part of telemetry wiring.
3. Do not move NPCs/workers as part of telemetry wiring.
4. Keep private paths, tokens, IPs, SSH data, Tailscale data, and telemetry inbox contents ignored by Git.
5. Prefer environment/config-based local paths over hardcoding personal machine paths into committed source.
6. If a room/device mapping must change, ask CAK3D first.


## Approved mapping update - 2026-06-09

- CAK3D approved mapping `nukebox` / `NukeBox` to `mother` / `MOTHER ROOM`.
- This is a telemetry/device mapping only; no room geometry, sprite placement, or worker assignment changed.


## Approved room-layout phase - 2026-06-09

CAK3D approved continuing the room-improvement phase after Syncthing was repaired and the NeuroLab stack was back on track.

Phase applied:

- Expanded Gen 2 map width from `108` to `122` tiles.
- Shifted the existing facility map `+14` tiles on X to preserve the original layout while opening a new left-side bay.
- Added new left dry/VM room:
  - `vmCreations` / `CAK3D-CREATIONS` / `vm` / `x=6 y=25 w=13 h=14`.
- Reassigned the former dry room to The Garden VM room:
  - `soil` / `THE GARDEN` / `vm` / shifted to `x=20 y=25 w=13 h=14` at render time.
- Added a left hallway connector between the new `CAK3D-CREATIONS` room and the shifted Garden VM room.
- Updated telemetry mappings:
  - `oracle-vm` / `The Garden` -> `soil`.
  - `cak3d-creations` / `CAK3D-Creations` -> `vmCreations` as a reserved/no-feed slot until telemetry exists.
- Updated `grow4` to remain an awaiting-device grow room like `grow3`.

Guardrail note: this phase intentionally changes approved room geometry and device mappings, but does not intentionally rewrite staff identity/personality systems.


## Roadmap guardrails captured - 2026-06-09

CAK3D approved wiring Docker visibility for NukeBox first, while keeping these later phases in view:

- Docker should eventually include other monitored devices, not only NukeBox. For now, `/api/system/docker` should expose NukeBox Docker through read-only telemetry instead of raw control access.
- R&D AI/Ollama phase:
  - R&D room monitors act as model-source selectors.
  - Left R&D monitor = Local models on NukeBox.
  - Right R&D monitor = Cloud/remote Ollama models from monitored devices.
  - R&D Test monitors should become triggerable model interaction terminals after Local/Cloud source selection.
  - Prefer double-click/right-click actions for monitor interaction.
- Room behavior phase:
  - Stats display should become room-aware.
  - Rooms should react to thresholds such as offline/stale telemetry, CPU/memory pressure, Docker container down, Home Assistant warnings, or model availability changes.
- Sprite behavior phase:
  - Sprite appearance, actions, stats, and routines should react to room/device thresholds.
  - Keep sprite route boundary checks active before and after geometry edits.
- SSH control phase:
  - Add device control through SSH later with narrow, auditable command allowlists.
  - Do not expose private keys or credentials in UI/API responses.
- Home Assistant / Maintenance phase:
  - Home Assistant lives on theBAK3RY and should map to a future Maintenance Room.
  - Intended room location: under Security Room on the short hallway nub that currently goes to no room.
  - Clicking the Maintenance Room should show Home Assistant device overview and allow safe controls.
  - The maintenance sprite should be assigned a proper room once that room exists.


## Interaction/telemetry next-pass notes - 2026-06-09

CAK3D requested these items for the next implementation passes:

- Sprite dialog/status UI:
  - Clicking a sprite may show its chat bubble.
  - The same sprite line should also appear in the lower-left room/status panel.
  - Place the mirrored dialog in the same lower-left box, to the right of the existing status section.
- Sprite visual cleanup:
  - Current modular color overlays are slightly misaligned against the base sprite and need pixel-perfect offsets.
  - Oakley should be restyled to match the same base sprite language as the other NPCs.
  - Codex session `019e22df-987c-7440-a947-b76743978d91` is the original retro facility/sprite session.
  - That session points to local reference repo `C:\Users\CAK3D\OneDrive\Desktop\CAK3D_Codex\Pixel_art_portfolio-master` and references `frontend/public/assets/portfolio-spritesheet.png` / `config/sprites.json` as current project sprite assets.
  - Its Kaboom source used a spritesheet with `sliceX: 39`, `sliceY: 31`, and player animation frames: down `936-939`, side `975-978`, up `1014-1017`.
  - Before adding new character variants, inspect that local repo and current spritesheet for alternate characters, genders, clothing, and color variants.
- CAK3D-Creations telemetry:
  - NukeBox telemetry inbox folder exists at `Networking/Inbox/cak3d-creations`.
  - Dashboard API maps it to `vmCreations` / `CAK3D-CREATIONS`.
  - Fresh Garden SSH snapshot verified online through `/api/system/facility-devices` on 2026-06-09: hostname `cak3d`, CPU `0`, memory `55.1`, status `nominal`, stale `false`.
- Room telemetry display:
  - Room lower-left box should show current telemetry for the mapped device.
  - Room stats should also expose the same telemetry fields in room detail panels.
  - Future room behavior should react to telemetry thresholds.
- Room systems roadmap:
  - Lights, irrigation, plant cycles, monitors, computers, and room details should become represented state/actions instead of static props only.
- Chain-of-command/action roadmap:
  - Sprites deliver room/device details to managers.
  - Managers deliver to secretary/boss.
  - Security delivers to boss and managers.
  - The chain should support reporting, escalation, and actions in later passes.
- Package/logistics roadmap:
  - Clicking a package in Loading should show the current logged stats.
  - Clicking a package in Warehouse should show past logs/history.

## Cultivation / production flow update — 2026-06-10

- Keep CAK3D's existing Gen2 layout/code as the source of truth; use the pixel-agents repo only as a scratch reference for isolated patterns.
- Clone placement rule: before a new clone is placed into a pot, the potting/soil sprite must stage soil in that pot.
- Clone trays should stay green/healthy; clones should not turn yellow. Yellow is reserved for grow-room plants and depleted mothers.
- Mother rule: when a clone is taken from the clone room, a new cutting comes from a mother. Each mother supplies 5 clones.
- Mother replacement rule: when a mother reaches its last clone, it turns yellow; after removal, the soil/potting sprite refreshes soil and a selected grow-room plant becomes the replacement mother.
- Grow-room rule: plants in grow rooms can turn yellow as stress/ready/harvest state.
- Harvest route: grow-room plants are harvested, moved to dry racks, then trim room, then packaging, then loading dock, then warehouse by their respective sprites.
- Maintenance room: added as a dedicated room beside Screening for repair tickets, device/sensor checks, spare parts, and future maintenance sprite actions.
- Route button behavior: selected sprite's ROUTE action should reveal route stops and highlight route waypoints on the map.
- Dialog placement correction: selected sprite bubble text belongs inside the WorkerBattlePanel between status and the MESSAGE/ROUTE/REPORT/CLOSE controls, not as a separate lower info-row box.
