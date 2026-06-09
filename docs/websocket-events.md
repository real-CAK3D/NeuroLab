# NeuroLab WebSocket Events

Base URL: `http://localhost:3007`

## HTTP Status

`GET /health`

Returns service status, current tick, and tick interval.

`GET /status`

Returns service status, connected client count, current tick, and tick interval.

## Server To Client

### `simulation:snapshot`

Sent on connection and after every simulation tick.

```ts
{
  tick: number;
  tickMs: number;
  rooms: Room[];
  employees: Employee[];
  events: ActivityEvent[];
}
```

### `event`

Sent whenever the WebSocket engine event bus receives a normalized event.

```ts
{
  type: string;
  message: string;
  entity_type?: string | null;
  entity_id?: number | null;
  payload?: Record<string, unknown>;
  created_at?: string;
}
```

Event types include:

- `INFRASTRUCTURE`
- `SIMULATION`
- `ALERT`
- `EMPLOYEE_UPDATED`
- `TASK_CREATED`
- `INTERCOM`
- `MANAGER_REPORT`
- `BOSS_BRIEFING`
- `AI_MESSAGE`
- `SYSTEM`

## Client To Server

### `command:intercom`

Compatibility command for direct socket intercom routing. The preferred MVP path is `POST /api/intercom` so the backend can validate and persist messages before they become events.

```ts
{
  target?: "all" | "department" | "employee";
  targetId?: number;
  message: string;
}
```

The server currently normalizes the command through its event bus and logs/persists it.
