# NeuroLab Architecture

NeuroLab is a modular simulation platform with a visual facility layer over persistent operational state.

## Service Boundaries

- Frontend UI `3005`: React panels and Phaser rendering. It never owns simulation truth.
- Backend API `3006`: REST API, SQLite persistence, seed loading, migrations, and task/state CRUD.
- WebSocket Engine `3007`: Socket.IO live updates and tick-based simulation.
- AI Service `3008`: Template-based summaries and reports. No Ollama/local LLM yet.
- Monitor Daemon `3009`: Mock/read-only infrastructure stats for MVP.

## State Ownership

SQLite is the source of truth for departments, rooms, employees, tasks, alerts, reports, messages, events, settings, animations, and emotes.

The frontend receives snapshots and interpolates visuals. Phaser positions are render state only; employee position, room assignment, task progress, mood, fatigue, and alerts are persisted by services.

## Event Bus

Each service has an internal event bus. Infrastructure events, simulation events, alerts, employee updates, task events, and AI messages are normalized through the event bus before logging, persistence, or broadcast.

The current MVP uses in-process event buses per service. A future Redis/NATS-style bus can replace the internal adapter without changing event payloads.

## Timing

- Render tick: browser FPS through Phaser.
- Simulation tick: default `3000ms`.
- Infrastructure polling interval: default `10000ms`.
- AI/report generation interval: default `30000ms`.

## Plugin Direction

Rooms, departments, employees, monitors, AI behaviors, animation presets, and integrations should be added as modules that contribute records/config and event handlers. The shared schemas define the stable contract.

