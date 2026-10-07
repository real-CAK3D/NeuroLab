# NeuroLab

NeuroLab is a Docker-hosted, browser-based mission-control dashboard for a living clean-room facility simulation. The frontend shows the facility, the backend owns persistent state, the websocket service drives live simulation snapshots, the monitor observes system-like metrics in read-only placeholder mode, and the AI service provides template-only summaries for now.

## Services

- Frontend UI (single public entry point): `http://localhost:3005`
- Backend API: `http://127.0.0.1:3006` (proxied at `/api` by the frontend)
- WebSocket engine: `http://127.0.0.1:3007`
- AI service placeholder: `http://127.0.0.1:3008`
- Monitor daemon (read-only OS metrics): `http://127.0.0.1:3009`

Only port 3005 is exposed beyond the machine. The browser talks to it alone: the Vite server proxies
`/api` to the backend, so the same build works on localhost, the LAN, and Tailscale.

## Run

```powershell
docker compose up -d --build
```

Then open:

```text
http://localhost:3005
```

Or use the helper, which also starts Docker Desktop if needed, works around a broken Docker credential
helper, and publishes the Tailscale URL:

```powershell
.\scripts
eurolab-up.ps1            # add -NoTailscale or -TailscalePort 8444 as needed
```

The frontend is a production build served by `vite preview` (no dev server or HMR in the container).
A status strip at the top of the page shows service health, tick, staff/tasks/alerts and telemetry.

Or use the helper, which also starts Docker Desktop if needed, works around a broken Docker credential
helper, and publishes the Tailscale URL:

```powershell
.\scripts\neurolab-up.ps1            # add -NoTailscale or -TailscalePort 8444 as needed
```

The frontend is a production build served by `vite preview` (no dev server or HMR in the container).
A status strip at the top of the page shows service health, tick, staff/tasks/alerts and telemetry.

Containers use `restart: unless-stopped`, so the stack returns after a reboot once Docker Desktop starts.

## Remote access over Tailscale

```powershell
tailscale serve --bg --https=10000 http://127.0.0.1:3005
```

NeuroLab is then available on your tailnet at `https://<machine>.<tailnet>.ts.net:10000/`
(tailnet only, not public). Stop it with `tailscale serve --https=10000 off`. Extra allowed
host names can be set with `NEUROLAB_ALLOWED_HOSTS` (comma separated); `*.ts.net` is allowed by default.

## Operations features

- **History:** the backend samples host CPU/memory, tick, telemetry and service state every minute into SQLite
  (7 days kept). `GET /api/history?minutes=120` feeds the sparklines in the status strip.
- **Real alerts:** a telemetry device or NeuroLab service changing state (online to offline and back) raises a
  facility alert and event, so dark rooms and security call-outs track the real machines.
- **Boss debriefs / work orders:** once an hour (and on `POST /api/shift-report`) the boss files a numbered `WO-######`
  debrief to `reports/wo-log.md` inside the data volume and to the `reports` table. Narration uses Ollama
  (smallest installed model, or `NEUROLAB_REPORT_MODEL`); without Ollama it falls back to a template.
  The container reaches Ollama at `host.docker.internal:11434`, so run Ollama with `OLLAMA_HOST=0.0.0.0`.
- **Backups:** a daily `VACUUM INTO` copy of the database lands in `backups/` (7 kept).
- **Live socket:** the status strip subscribes to the simulation websocket through the frontend proxy
  (`/socket.io`) and falls back to polling.
- **Write token (optional):** set `NEUROLAB_WRITE_TOKEN` in `.env` to require `Authorization: Bearer <token>` on every
  non-GET `/api` call. Store it once in each browser: `localStorage.setItem("neurolab.token", "<token>")`.
- **Install as an app:** the page ships a web manifest and service worker, so phones and Chrome can install it.
- **Start at logon:** a scheduled task `NeuroLab Up` runs `scripts/neurolab-up.ps1 -NoBuild` one minute after logon.
- **CI:** `.github/workflows/verify.yml` typechecks the services and runs `npm run verify` for the frontend.

## Crop lifecycle (grow to sale)

The backend runs a persistent crop simulation 24/7 (`backend/src/services/lifecycle.ts`), driven by real device state:

1. **Dark rooms are cleaned out and sterilized.** A grow room whose device has been offline for a while is cleared and sterilized, then sealed and left waiting.
2. **Startup:** when the device comes online, staff bring pots and soil, then take clones from the mother plants and plant them.
3. **Grow:** half grown after week 1, full grown after week 2, ripe and harvested in week 3. A room dark for 3 days loses its crop and is sterilized again; high CPU/memory or outages lower the batch quality.
4. **Harvest:** the room is cleaned, and the batch is hung in a dry room (THE GARDEN or CAK3D-CREATIONS, whichever is online) for **1 week**.
5. **Trim:** one batch at a time, **1 week** each. Then back to a dry room to **cure for 2 weeks**.
6. **Cured:** most batches go to packaging; some go to the extraction lab (2 days), and the extract is packaged too.
7. **Packaged,** then the loading bay (cataloged), then the warehouse. Sales sells from the warehouse stock.
8. **R&D sampling:** every facility day, samples are taken from growing rooms, drying/curing rooms and extraction.
9. **Mother plants live 6 weeks.** A room that harvests without a mother of its own keeps one plant back to replace a lost one. With no mothers left, a new one is started from a seed pack after 2 days.

Time runs at `NEUROLAB_TIME_SCALE` times real time (default **24**: one real hour is one facility day, so grow to warehouse takes about two real days; `1` is real time). Change it live with
`POST /api/lifecycle/scale {"scale": 24}`. `GET /api/lifecycle` returns room phases, batches, mothers, inventory, sales, samples and a log.
Preview it quickly with `npx tsx backend/scripts/simulate-lifecycle.ts 110` (fast-forwards 110 facility days on a scratch database).

## Talking to staff (AI)

Staff have stable, editable personalities and memories, and conversations are phrased by an Ollama model:

- **Personas** (`GET/PUT /api/npc/persona/:id`): hobbies, loves and hates, likes and dislikes, favorite color, music, artist, show and team, pet, family, home, commute, relationship, morning routine, fears, guilty pleasure, catchphrase, birthday, and a Maine flavor. They are generated once per worker, stored in SQLite, and can be edited.
- **Memories** (`GET/POST /api/npc/memories/:id`): promotions, transfers and new hires are noticed automatically from the roster the dashboard sends with each chat ("I remember when I got promoted"), coworkers remember too, and each conversation with the Inspector is remembered. The dashboard can file more events.
- **Calendar and weather:** holidays (federal, Maine's Patriots' Day, 4/20, Halloween and more), the season, birthdays, and real weather for **Lewiston, Maine** from Open-Meteo (override with `NEUROLAB_WEATHER_LAT/LON/PLACE`; time zone `NEUROLAB_TZ`, default America/New_York).
- **Chat** (`POST /api/npc/chat`) and **banter** (`POST /api/npc/banter`, short overheard exchanges for chat bubbles). The model is `NEUROLAB_NPC_MODEL`, else the smallest installed non-reasoning chat model (qwen3 and other reasoning models are slower and need thinking enabled; embedding models are skipped). Replies fall back to templates if Ollama is down.

## Space-Ghost integration

`GET /api/summary` returns a compact read-only rollup (service health + latency, simulation tick,
staff/task/alert counts, and device telemetry online/stale). Space-Ghost's Systems tab shows it as
the NeuroLab card (`spac3ghost/neurolab.py` in the Spac3-Gh0st repo).

## Health Checks

```text
http://localhost:3005/health        (backend, via the frontend proxy)
http://localhost:3005/api/summary   (all services at once)
```

The other services answer `/health` on 127.0.0.1:3007-3009.

## Development Checks

Run these from each service folder when working locally:

```powershell
npm run check
```

For the frontend:

```powershell
npm run build
```

## Documentation

- `docs/architecture.md`
- `docs/api.md`
- `docs/websocket-events.md`
- `docs/data-model.md`
- `docs/floorplan.md`
- `docs/roadmap.md`
- `docs/visual-life-atmosphere-blueprint.md`

## Current Safety Boundaries

- No local LLM/Ollama control yet.
- No Docker write/control actions yet.
- Frontend never accesses system resources directly.
- Monitor daemon is read-only (real `os`/`statfs` readings; no writes, no Docker socket).
- Docker socket is not exposed to the frontend.

## Credits

Scenery sprites are recoloured CC0 (Kenney) and CC-BY 4.0 (marceles) pixel art; see [CREDITS.md](CREDITS.md) for sources, licenses and the required attribution. Regenerate with `python frontend/scripts/build-tiles.py`.
