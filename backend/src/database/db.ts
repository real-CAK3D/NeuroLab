import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { appConfig, departmentSeeds, employeeDefaultsConfig, employeePresetSeeds, employeeSeeds, roomSeeds, taskSeeds } from "../../../shared/index";

const databasePath = process.env.DATABASE_PATH || "/data/neurolab.sqlite";
const visualLayoutVersion = "reference-floorplan-v1";
mkdirSync(dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma("journal_mode = WAL");

export function initDatabase() {
  createTables();
  migrateTables();
  seedDatabase();
  syncVisualLayout();
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, status TEXT NOT NULL, workload INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, department_id INTEGER NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, cleanliness INTEGER NOT NULL DEFAULT 100, system_mapping TEXT NOT NULL, current_issues TEXT NOT NULL DEFAULT '[]', recent_reports TEXT NOT NULL DEFAULT '[]');
    CREATE TABLE IF NOT EXISTS employee_presets (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL UNIQUE, base_state TEXT NOT NULL, default_department TEXT NOT NULL, iq INTEGER NOT NULL DEFAULT 100, work_ethic INTEGER NOT NULL DEFAULT 70, stress_tolerance INTEGER NOT NULL DEFAULT 70, social_tendency INTEGER NOT NULL DEFAULT 50, humor_level INTEGER NOT NULL DEFAULT 40, personality_archetype TEXT NOT NULL DEFAULT 'balanced');
    CREATE TABLE IF NOT EXISTS employees (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT NOT NULL, department_id INTEGER NOT NULL, assigned_room_id INTEGER NOT NULL, current_room_id INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'IDLE', age INTEGER NOT NULL, sex TEXT NOT NULL, mood TEXT NOT NULL, hunger INTEGER NOT NULL DEFAULT 25, fatigue INTEGER NOT NULL DEFAULT 20, stamina INTEGER NOT NULL DEFAULT 80, iq INTEGER NOT NULL, stress INTEGER NOT NULL DEFAULT 25, productivity INTEGER NOT NULL DEFAULT 70, work_ethic INTEGER NOT NULL DEFAULT 70, stress_tolerance INTEGER NOT NULL DEFAULT 70, social_tendency INTEGER NOT NULL DEFAULT 50, humor_level INTEGER NOT NULL DEFAULT 40, personality_archetype TEXT NOT NULL DEFAULT 'balanced', x REAL NOT NULL DEFAULT 0, y REAL NOT NULL DEFAULT 0, unread_messages INTEGER NOT NULL DEFAULT 0, current_task_id INTEGER, schedule TEXT NOT NULL DEFAULT '[]', priority_list TEXT NOT NULL DEFAULT '[]', relationships TEXT NOT NULL DEFAULT '{}', report_history TEXT NOT NULL DEFAULT '[]');
    CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL DEFAULT 'NORMAL', status TEXT NOT NULL DEFAULT 'QUEUED', progress INTEGER NOT NULL DEFAULT 0, source TEXT, department_id INTEGER, room_id INTEGER, assigned_employee_id INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, due_at TEXT, completed_at TEXT, notes TEXT);
    CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'SYSTEM', title TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, message TEXT NOT NULL, entity_type TEXT, entity_id INTEGER, payload TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, report_type TEXT NOT NULL DEFAULT 'TASK_UPDATE', department_id INTEGER, room_id INTEGER, source_employee_id INTEGER, recipient_role TEXT, severity TEXT NOT NULL DEFAULT 'INFO', title TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER, body TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS intercom_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, sender TEXT NOT NULL, target_type TEXT NOT NULL, target_id INTEGER, message TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'NORMAL', requires_acknowledgement INTEGER NOT NULL DEFAULT 0, acknowledged_by TEXT NOT NULL DEFAULT '[]', generated_tasks TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS system_metrics (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS employee_relationships (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL, related_employee_id INTEGER NOT NULL, affinity INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS animations (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE, sprite TEXT NOT NULL, frames TEXT NOT NULL DEFAULT '[]', frame_rate INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS emotes (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE, label TEXT NOT NULL, icon TEXT NOT NULL);
  `);
}

function migrateTables() {
  for (const [table, column, definition] of [
    ["employees", "work_ethic", "INTEGER NOT NULL DEFAULT 70"],
    ["employees", "stress_tolerance", "INTEGER NOT NULL DEFAULT 70"],
    ["employees", "social_tendency", "INTEGER NOT NULL DEFAULT 50"],
    ["employees", "humor_level", "INTEGER NOT NULL DEFAULT 40"],
    ["employees", "personality_archetype", "TEXT NOT NULL DEFAULT 'balanced'"],
    ["employees", "schedule", "TEXT NOT NULL DEFAULT '[]'"],
    ["employees", "priority_list", "TEXT NOT NULL DEFAULT '[]'"],
    ["employees", "relationships", "TEXT NOT NULL DEFAULT '{}'"],
    ["employees", "report_history", "TEXT NOT NULL DEFAULT '[]'"],
    ["tasks", "progress", "INTEGER NOT NULL DEFAULT 0"],
    ["tasks", "source", "TEXT"],
    ["tasks", "room_id", "INTEGER"],
    ["tasks", "due_at", "TEXT"],
    ["tasks", "completed_at", "TEXT"],
    ["tasks", "notes", "TEXT"],
    ["alerts", "category", "TEXT NOT NULL DEFAULT 'SYSTEM'"],
    ["events", "payload", "TEXT NOT NULL DEFAULT '{}'"],
    ["reports", "report_type", "TEXT NOT NULL DEFAULT 'TASK_UPDATE'"],
    ["reports", "source_employee_id", "INTEGER"],
    ["reports", "recipient_role", "TEXT"],
    ["reports", "severity", "TEXT NOT NULL DEFAULT 'INFO'"],
    ["employee_presets", "iq", "INTEGER NOT NULL DEFAULT 100"],
    ["employee_presets", "work_ethic", "INTEGER NOT NULL DEFAULT 70"],
    ["employee_presets", "stress_tolerance", "INTEGER NOT NULL DEFAULT 70"],
    ["employee_presets", "social_tendency", "INTEGER NOT NULL DEFAULT 50"],
    ["employee_presets", "humor_level", "INTEGER NOT NULL DEFAULT 40"],
    ["employee_presets", "personality_archetype", "TEXT NOT NULL DEFAULT 'balanced'"],
  ] as const) addColumn(table, column, definition);
}

function addColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function seedDatabase() {
  const count = (db.prepare("SELECT COUNT(*) AS count FROM departments").get() as { count: number }).count;
  if (count > 0) return;

  db.transaction(() => {
    for (const department of departmentSeeds) db.prepare("INSERT INTO departments (name, status, workload) VALUES (?, ?, ?)").run(department.name, department.status, department.workload);
    const departments = mapByName("departments");
    for (const room of roomSeeds) db.prepare("INSERT INTO rooms (name, department_id, x, y, width, height, cleanliness, system_mapping) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(room.name, departments.get(room.department)?.id, room.x, room.y, room.width, room.height, room.cleanliness, room.systemMapping);
    const rooms = mapByName("rooms");

    for (const preset of employeePresetSeeds) {
      db.prepare("INSERT OR IGNORE INTO employee_presets (role, base_state, default_department, iq, work_ethic, stress_tolerance, social_tendency, humor_level, personality_archetype) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(preset.role, preset.baseState, preset.defaultDepartment, preset.iq, preset.workEthic, preset.stressTolerance, preset.socialTendency, preset.humorLevel, preset.personalityArchetype);
    }
    const presets = mapByRole("employee_presets");

    for (const employee of employeeSeeds) {
      const room = rooms.get(employee.assignedRoom);
      const preset = presets.get(employee.role);
      db.prepare("INSERT INTO employees (name, role, department_id, assigned_room_id, current_room_id, state, age, sex, mood, hunger, fatigue, stamina, iq, stress, productivity, work_ethic, stress_tolerance, social_tendency, humor_level, personality_archetype, x, y, unread_messages) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
        employee.name, employee.role, departments.get(employee.department)?.id, room?.id, room?.id, preset?.base_state ?? "IDLE", employee.age, employee.sex, employee.mood,
        randomRange(employeeDefaultsConfig.hunger), randomRange(employeeDefaultsConfig.fatigue), randomRange(employeeDefaultsConfig.stamina), employee.iq,
        randomRange(employeeDefaultsConfig.stress), randomRange(employeeDefaultsConfig.productivity), preset?.work_ethic ?? 70, preset?.stress_tolerance ?? 70,
        preset?.social_tendency ?? 50, preset?.humor_level ?? 40, preset?.personality_archetype ?? "balanced",
        (room?.x ?? 0) + (room?.width ?? 0) / 2, (room?.y ?? 0) + (room?.height ?? 0) / 2, randomInt(0, 4),
      );
    }

    for (const task of taskSeeds) db.prepare("INSERT INTO tasks (title, description, priority, status, progress, source, department_id) VALUES (?, ?, ?, ?, 0, ?, ?)").run(task.title, task.description, task.priority, task.status, task.source, departments.get(task.department)?.id);
    db.prepare("INSERT INTO events (type, message, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?)").run("SYSTEM", "NeuroLab seed data loaded automatically.", "system", null, JSON.stringify({ source: "seed" }));
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("simulation_tick_ms", String(process.env.SIMULATION_TICK_MS || appConfig.simulation.simulationTickMs));
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("runtime_config", JSON.stringify(appConfig));
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("admin_token_placeholder", process.env.ADMIN_TOKEN || "dev-admin-token");
  })();
}

function syncVisualLayout() {
  const current = db.prepare("SELECT value FROM settings WHERE key = ?").get("visual_layout_version") as { value: string } | undefined;
  if (current?.value === visualLayoutVersion) return;

  db.transaction(() => {
    const departments = mapByName("departments");
    for (const room of roomSeeds) {
      db.prepare(`
        UPDATE rooms
        SET department_id = ?, x = ?, y = ?, width = ?, height = ?, cleanliness = ?, system_mapping = ?
        WHERE name = ?
      `).run(departments.get(room.department)?.id, room.x, room.y, room.width, room.height, room.cleanliness, room.systemMapping, room.name);
    }
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("visual_layout_version", visualLayoutVersion);
  })();
}

function mapByName(table: string) {
  const rows = db.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, any> & { id: number; name: string }>;
  return new Map(rows.map((row) => [row.name, row]));
}

function mapByRole(table: string) {
  const rows = db.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, any> & { role: string }>;
  return new Map(rows.map((row) => [row.role, row]));
}

function randomRange(range: { min: number; max: number }) {
  return randomInt(range.min, range.max);
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
