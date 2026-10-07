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
