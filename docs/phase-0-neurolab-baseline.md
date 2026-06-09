# NeuroLab Phase 0 Baseline

## Purpose

NeuroLab is the NukeBox-hosted Device Telemetry Dashboard: a browser-based, retro Gen 2 / Pokémon-style facility map that visualizes device telemetry, room status, workers, events, and operations state.

This note is the Phase 0 guardrail before functional upgrades. It is intentionally conservative: preserve the current room layout, sprites, worker identities, and visual direction unless CAK3D explicitly approves a change.

## Current Project Location

- Project: `C:\Users\CAK3D\OneDrive\Documents\New project`
- Telemetry inbox read by the project: `C:\Users\CAK3D\OneDrive\Desktop\Networking\Inbox`
- Codex thread reference: `019e22df-987c-7440-a947-b76743978d91` (`Create retro Pokémon facility map`)

## Main Source Map

- `README.md` — run notes and overview
- `docker-compose.yml` — local multi-service stack
- `frontend/src/components/Gen2FacilityDashboard.tsx` — main Gen 2 dashboard UI
- `frontend/src/game/gen2FacilityData.ts` — facility rooms, props, sprites, tile map data
- `frontend/src/game/gen2OperationsData.ts` — worker roles, jobs, operations data
- `backend/src/api/routes.ts` — backend API routes, including telemetry/device data
- `websocket/` — live simulation engine
- `ai-service/` — AI summary placeholder/service
- `monitor-service/` — monitoring placeholder/service
- `docs/` — architecture, roadmap, API, floorplan, and planning notes

## Backup Created Before Edits

A timestamped backup was created before Phase 0 edits:

- `C:\Users\CAK3D\OneDrive\Documents\NeuroLab_Backups\NeuroLab-backup-20260608-203803`

The backup excludes dependency/runtime/security noise such as `.git`, `node_modules`, `.env`, logs, `dist`, `build`, `.vite`, `coverage`, and `npm-cache`.

## Safety Boundaries

- No room or sprite redesign without CAK3D details/approval.
- No secrets, SSH keys, Tailscale data, tokens, private IP maps, telemetry dumps, or local machine identity files in Git.
- Frontend stays read-only against real systems.
- Frontend does not receive SSH keys, Docker socket access, Home Assistant tokens, or provider credentials.
- Docker/write/control actions remain out of scope until an explicit authenticated control design exists.
- The eventual CAK3D_Creations VM deployment must not write into or interfere with Obsidian vault folders.

## Near-Term Phase 0 Trail

1. Keep the backup as rollback insurance.
2. Harden `.gitignore` for secrets, telemetry, runtime files, and machine-local data.
3. Inspect repo for accidentally trackable private files.
4. Verify Docker Desktop / Docker engine availability on NukeBox.
5. Run `docker compose up -d --build` once Docker is available.
6. Verify service health endpoints and frontend load.
7. Commit a clean baseline before feature work.

## Future Deployment Direction

Preferred long-term shape:

- Backend/telemetry runtime runs 24/7 on the CAK3D_Creations VM or another always-on Docker host.
- Frontend can later deploy to Vercel if it only consumes sanitized API/WebSocket state.
- Local/private telemetry is pushed or proxied safely; Vercel should not directly read OneDrive, SSH, Docker, Tailscale, or private tokens.
