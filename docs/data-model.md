# Data Model

SQLite tables:

- `employees`
- `employee_presets`
- `departments`
- `rooms`
- `tasks`
- `alerts`
- `events`
- `reports`
- `messages`
- `intercom_messages`
- `system_metrics`
- `employee_relationships`
- `settings`
- `animations`
- `emotes`

Seed data lives in `shared/seed/seedData.ts`.

Shared Zod schemas and inferred TypeScript types live in `shared/schemas/domain.ts`.

Central runtime settings live in `shared/config/runtime.ts`.
