# NeuroLab API Routes

Base URL: `http://localhost:3006`

## Health

`GET /health`

Returns backend status and database readiness.

## Bootstrap

`GET /api/bootstrap`

Returns initial dashboard data:

- departments
- rooms
- employees
- tasks
- alerts
- events
- settings

## Employee Detail

`GET /api/employees/:id`

Returns employee fields plus:

- upcomingTasks
- recentFinishedTasks
- messages
- warnings

## Room Detail

`GET /api/rooms/:id`

Returns room fields plus:

- assignedStaff
- activeEvents
- current_issues
- recent_reports
- taskQueue

## Create Task

`POST /api/tasks`

Payload is validated by the shared `createTaskSchema`.

```json
{
  "title": "Check grow room cleanliness",
  "description": "Optional details",
  "priority": "NORMAL",
  "departmentId": 2,
  "roomId": 8,
  "assignedEmployeeId": 4,
  "dueAt": "2026-05-13T18:00:00.000Z",
  "notes": "Optional notes"
}
```

Response is the created task record.

## Intercom History

`GET /api/intercom`

Returns the most recent Boss Console intercom messages, including acknowledgement metadata and any generated tasks.

## Send Intercom Message

`POST /api/intercom`

Payload is validated by the shared `createIntercomMessageSchema`.

```json
{
  "targetType": "DEPARTMENT",
  "targetId": 2,
  "message": "Cultivation, check your room status.",
  "priority": "NORMAL"
}
```

Response is the saved intercom message. Simple action words such as `check`, `inspect`, `clean`, `docker`, `alert`, `summarize`, or `report` can generate basic queued tasks.
