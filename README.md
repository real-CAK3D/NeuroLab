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

Containers use `restart: unless-stopped`, so the stack returns after a reboot once Docker Desktop starts.

## Remote access over Tailscale

```powershell
tailscale serve --bg --https=10000 http://127.0.0.1:3005
```

NeuroLab is then available on your tailnet at `https://<machine>.<tailnet>.ts.net:10000/`
(tailnet only, not public). Stop it with `tailscale serve --https=10000 off`. Extra allowed
host names can be set with `NEUROLAB_ALLOWED_HOSTS` (comma separated); `*.ts.net` is allowed by default.

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
