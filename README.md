# NeuroLab

NeuroLab is a Docker-hosted, browser-based mission-control dashboard for a living clean-room facility simulation. The frontend shows the facility, the backend owns persistent state, the websocket service drives live simulation snapshots, the monitor observes system-like metrics in read-only placeholder mode, and the AI service provides template-only summaries for now.

## Services

- Frontend UI: `http://localhost:3005`
- Backend API: `http://localhost:3006`
- WebSocket engine: `http://localhost:3007`
- AI service placeholder: `http://localhost:3008`
- Monitor daemon placeholder: `http://localhost:3009`

## Run

```powershell
docker compose up -d --build
```

Then open:

```text
http://localhost:3005
```

## Health Checks

```text
http://localhost:3006/health
http://localhost:3007/health
http://localhost:3008/health
http://localhost:3009/health
```

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
- Monitor daemon is read-only/mock-first.
- Docker socket is not exposed to the frontend.
