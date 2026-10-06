import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { appConfig, createIntercomMessageSchema, createTaskSchema } from "../../../shared/index";
import { db } from "../database/db";
import { employeesQuery, reportsQuery, roomsQuery, tasksQuery } from "../database/queries";
import { eventBus } from "../events/bus";

const execFileAsync = promisify(execFile);

// Several dashboards may poll /api/summary; probe the services at most once per interval.
const SUMMARY_TTL_MS = 3000;
let summaryCache: { at: number; value: unknown } | undefined;

export function apiRouter(): Router {
  const router = createRouter();

  router.get("/bootstrap", (_req: Request, res: Response) => {
    res.json({
      departments: db.prepare("SELECT * FROM departments ORDER BY id").all(),
      rooms: roomsQuery().all(),
      employees: employeesQuery().all(),
      tasks: tasksQuery().all(),
      alerts: db.prepare("SELECT * FROM alerts ORDER BY id DESC LIMIT 20").all(),
      events: db.prepare("SELECT * FROM events ORDER BY id DESC LIMIT 40").all().reverse(),
      reports: reportsQuery().all().slice(0, 20),
      settings: db.prepare("SELECT * FROM settings").all(),
    });
  });

  router.get("/employees/:id", (req: Request, res: Response) => {
    const employee = employeesQuery("employees.id = ?").get(req.params.id) as Record<string, unknown> | undefined;
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    const upcomingTasks = tasksQuery("tasks.assigned_employee_id = ? AND tasks.status NOT IN ('COMPLETED', 'CANCELLED')").all(req.params.id);
    const recentFinishedTasks = tasksQuery("tasks.assigned_employee_id = ? AND tasks.status = 'COMPLETED'").all(req.params.id);
    const messages = db.prepare("SELECT * FROM messages WHERE employee_id = ? ORDER BY id DESC LIMIT 5").all(req.params.id);
    res.json({ ...employee, upcomingTasks, recentFinishedTasks, messages, warnings: employeeWarnings(employee) });
  });

  router.get("/rooms/:id", (req: Request, res: Response) => {
    const room = roomsQuery("rooms.id = ?").get(req.params.id) as Record<string, any> | undefined;
    if (!room) return res.status(404).json({ error: "Room not found" });
    const assignedStaff = employeesQuery("employees.assigned_room_id = ?").all(req.params.id);
    const taskQueue = tasksQuery("tasks.department_id = ? AND tasks.status NOT IN ('COMPLETED', 'CANCELLED')").all(room.department_id);
    const activeEvents = db.prepare("SELECT * FROM events WHERE entity_type = 'room' AND entity_id = ? ORDER BY id DESC LIMIT 6").all(req.params.id);
    res.json({
      ...room,
      current_issues: safeJson(room.current_issues, []),
      recent_reports: safeJson(room.recent_reports, []),
      assignedStaff,
      activeEvents,
      taskQueue,
    });
  });

  router.get("/facility-layout", (_req: Request, res: Response) => {
    res.json(readFacilityLayoutState());
  });

  router.post("/facility-layout", (req: Request, res: Response) => {
    const validation = validateFacilityLayoutSnapshot(req.body);
    if (validation.failures.length) return res.status(400).json({ error: "Invalid facility layout snapshot", failures: validation.failures });

    const current = readFacilityLayoutState();
    const snapshot = {
      id: `layout-${Date.now()}`,
      savedAt: new Date().toISOString(),
      note: typeof req.body?.note === "string" ? req.body.note.slice(0, 160) : "Facility editor apply",
      rooms: req.body.rooms,
      drafts: req.body.drafts ?? {},
      validation,
    };
    const history = [current.current, ...current.history].filter(Boolean).slice(0, 12);
    writeSetting("facility_layout_current", snapshot);
    writeSetting("facility_layout_history", history);
    eventBus.publish({
      type: "FACILITY_LAYOUT",
      message: `Facility layout snapshot saved: ${snapshot.note}`,
      entity_type: "facility-layout",
      entity_id: null,
      payload: snapshot,
    });
    res.status(201).json({ current: snapshot, history });
  });

  router.post("/facility-layout/undo", (_req: Request, res: Response) => {
    const state = readFacilityLayoutState();
    const [previous, ...remaining] = state.history as Array<Record<string, any>>;
    if (!previous) return res.status(409).json({ error: "No facility layout snapshot is available to restore" });
    writeSetting("facility_layout_current", previous);
    writeSetting("facility_layout_history", remaining);
    eventBus.publish({
      type: "FACILITY_LAYOUT",
      message: `Facility layout snapshot restored: ${previous.note ?? previous.id}`,
      entity_type: "facility-layout",
      entity_id: null,
      payload: previous,
    });
    res.json({ current: previous, history: remaining });
  });

  router.get("/staff-config", (_req: Request, res: Response) => {
    res.json(readStaffConfigState());
  });

  router.post("/staff-config", (req: Request, res: Response) => {
    const validation = validateStaffConfigSnapshot(req.body);
    if (validation.failures.length) return res.status(400).json({ error: "Invalid staff config snapshot", failures: validation.failures });

    const current = readStaffConfigState();
    const snapshot = {
      id: `staff-${Date.now()}`,
      savedAt: new Date().toISOString(),
      note: typeof req.body?.note === "string" ? req.body.note.slice(0, 160) : "Staff editor apply",
      staff: req.body.staff,
      validation,
    };
    const history = [current.current, ...current.history].filter(Boolean).slice(0, 12);
    writeSetting("staff_config_current", snapshot);
    writeSetting("staff_config_history", history);
    eventBus.publish({
      type: "STAFF_CONFIG",
      message: `Staff config snapshot saved: ${snapshot.note}`,
      entity_type: "staff-config",
      entity_id: null,
      payload: snapshot,
    });
    res.status(201).json({ current: snapshot, history });
  });

  router.post("/staff-config/undo", (_req: Request, res: Response) => {
    const state = readStaffConfigState();
    const [previous, ...remaining] = state.history as Array<Record<string, any>>;
    if (!previous) return res.status(409).json({ error: "No staff config snapshot is available to restore" });
    writeSetting("staff_config_current", previous);
    writeSetting("staff_config_history", remaining);
    eventBus.publish({
      type: "STAFF_CONFIG",
      message: `Staff config snapshot restored: ${previous.note ?? previous.id}`,
      entity_type: "staff-config",
      entity_id: null,
      payload: previous,
    });
    res.json({ current: previous, history: remaining });
  });

  router.get("/activity-state", (_req: Request, res: Response) => {
    res.json(readActivityState());
  });

  router.post("/activity-state", (req: Request, res: Response) => {
    const validation = validateActivityStateSnapshot(req.body);
    if (validation.failures.length) return res.status(400).json({ error: "Invalid activity state snapshot", failures: validation.failures });

    const current = readActivityState();
    const snapshot = {
      id: `activity-${Date.now()}`,
      savedAt: new Date().toISOString(),
      note: typeof req.body?.note === "string" ? req.body.note.slice(0, 160) : "Activity engine checkpoint",
      state: req.body.state,
      validation,
    };
    const history = [current.current, ...current.history].filter(Boolean).slice(0, 12);
    writeSetting("activity_state_current", snapshot);
    writeSetting("activity_state_history", history);
    eventBus.publish({
      type: "ACTIVITY_STATE",
      message: `Activity state checkpoint saved: ${snapshot.note}`,
      entity_type: "activity-state",
      entity_id: null,
      payload: snapshot,
    });
    res.status(201).json({ current: snapshot, history });
  });

  router.post("/activity-state/undo", (_req: Request, res: Response) => {
    const state = readActivityState();
    const [previous, ...remaining] = state.history as Array<Record<string, any>>;
    if (!previous) return res.status(409).json({ error: "No activity state snapshot is available to restore" });
    writeSetting("activity_state_current", previous);
    writeSetting("activity_state_history", remaining);
    eventBus.publish({
      type: "ACTIVITY_STATE",
      message: `Activity state checkpoint restored: ${previous.note ?? previous.id}`,
      entity_type: "activity-state",
      entity_id: null,
      payload: previous,
    });
    res.json({ current: previous, history: remaining });
  });

  router.get("/system/host", async (_req: Request, res: Response) => {
    const cpu = await sampleCpuUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const load = os.loadavg();
    res.json({
      hostname: os.hostname(),
      platform: os.platform(),
      uptimeSeconds: Math.round(os.uptime()),
      cpu,
      memory: {
        totalBytes: totalMemory,
        freeBytes: freeMemory,
        usedBytes: usedMemory,
        usedPercent: Math.round((usedMemory / totalMemory) * 100),
      },
      loadAverage: load,
      sensors: {
        temperatureC: null,
        fanRpm: null,
        note: "Windows temperature and fan telemetry needs a hardware sensor provider.",
      },
      sampledAt: new Date().toISOString(),
    });
  });

  router.get("/system/docker", async (_req: Request, res: Response) => {
    res.json(await getDockerStats());
  });

  router.get("/system/facility-devices", async (_req: Request, res: Response) => {
    res.json({
      inbox: telemetryInboxPath(),
      sampledAt: new Date().toISOString(),
      devices: await readFacilityDevices(),
    });
  });

  // Compact, read-only rollup used by external dashboards (e.g. Space-Ghost's Systems tab).
  router.get("/summary", async (_req: Request, res: Response) => {
    if (summaryCache && Date.now() - summaryCache.at < SUMMARY_TTL_MS) return res.json(summaryCache.value);
    const [services, devices, cpu] = await Promise.all([probeServices(), readFacilityDevices(), sampleCpuUsage()]);
    const count = (sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { n: number }).n;
    const total = os.totalmem();
    const lastEvent = db.prepare("SELECT type, message, created_at FROM events ORDER BY id DESC LIMIT 1").get() as { type: string; message: string; created_at: string } | undefined;
    const lastAlert = db.prepare("SELECT level, title, created_at FROM alerts ORDER BY id DESC LIMIT 1").get() as { level: string; title: string; created_at: string } | undefined;
    const online = devices.filter((device) => device.online).length;
    const servicesDown = services.filter((service) => !service.ok).length;
    const payload = {
      ok: servicesDown === 0,
      service: "neurolab",
      sampledAt: new Date().toISOString(),
      tick: services.find((service) => service.id === "websocket")?.tick ?? null,
      facility: {
        employees: count("SELECT COUNT(*) AS n FROM employees"),
        rooms: count("SELECT COUNT(*) AS n FROM rooms"),
        departments: count("SELECT COUNT(*) AS n FROM departments"),
        tasks: {
          open: count("SELECT COUNT(*) AS n FROM tasks WHERE status NOT IN ('COMPLETED', 'CANCELLED')"),
          queued: count("SELECT COUNT(*) AS n FROM tasks WHERE status = 'QUEUED'"),
          completed: count("SELECT COUNT(*) AS n FROM tasks WHERE status = 'COMPLETED'"),
        },
        alerts: {
          total: count("SELECT COUNT(*) AS n FROM alerts"),
          critical: count("SELECT COUNT(*) AS n FROM alerts WHERE UPPER(level) = 'CRITICAL'"),
          last: lastAlert ?? null,
        },
        lastEvent: lastEvent ?? null,
      },
      services,
      host: {
        hostname: os.hostname(),
        cpuPercent: cpu.usedPercent,
        memoryPercent: Math.round(((total - os.freemem()) / total) * 100),
        uptimeSeconds: Math.round(os.uptime()),
      },
      telemetry: {
        online,
        total: devices.length,
        stale: devices.filter((device) => device.stale).length,
        devices: devices.map((device) => ({
          id: device.id,
          name: device.displayName,
          online: device.online,
          temperatureC: device.temperatureC,
          cpuPercent: device.cpuPercent,
          memoryPercent: device.memoryPercent,
        })),
      },
    };
    summaryCache = { at: Date.now(), value: payload };
    res.json(payload);
  });

  router.post("/tasks", (req: Request, res: Response) => {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid task", issues: parsed.error.issues });
    const task = parsed.data;
    const department = task.departmentId
      ? db.prepare("SELECT id FROM departments WHERE id = ?").get(task.departmentId) as { id: number } | undefined
      : undefined;

    const result = db.prepare(`
      INSERT INTO tasks (title, description, priority, status, progress, source, department_id, room_id, assigned_employee_id, due_at, notes)
      VALUES (?, ?, ?, 'QUEUED', 0, 'boss-console', ?, ?, ?, ?, ?)
    `).run(
      task.title,
      task.description,
      task.priority,
      department?.id ?? null,
      task.roomId ?? null,
      task.assignedEmployeeId ?? null,
      task.dueAt ?? null,
      task.notes ?? null,
    );

    const created = tasksQuery("tasks.id = ?").get(result.lastInsertRowid);
    eventBus.publish({
      type: "TASK_CREATED",
      message: `New task queued: ${task.title}`,
      entity_type: "task",
      entity_id: Number(result.lastInsertRowid),
      payload: { task: created },
    });
    res.status(201).json(created);
  });

  router.get("/intercom", (_req: Request, res: Response) => {
    res.json(intercomHistory());
  });

  router.post("/intercom", (req: Request, res: Response) => {
    const parsed = createIntercomMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid intercom message", issues: parsed.error.issues });
    const input = parsed.data;
    const sender = input.sender ?? appConfig.intercom.defaultSender;
    const requiresAck = input.requiresAcknowledgement ?? ["HIGH", "EMERGENCY"].includes(input.priority);

    const generatedTasks = createIntercomTasks(input.message, input.targetType, input.targetId);
    const result = db.prepare(`
      INSERT INTO intercom_messages (sender, target_type, target_id, message, priority, requires_acknowledgement, generated_tasks)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sender, input.targetType, input.targetId ?? null, input.message, input.priority, requiresAck ? 1 : 0, JSON.stringify(generatedTasks));

    const message = db.prepare("SELECT * FROM intercom_messages WHERE id = ?").get(result.lastInsertRowid) as Record<string, any>;
    eventBus.publish({
      type: "INTERCOM",
      message: `${sender} sent ${input.priority.toLowerCase()} intercom: ${input.message}`,
      entity_type: "intercom",
      entity_id: Number(result.lastInsertRowid),
      payload: normalizeIntercomMessage(message),
    });

    res.status(201).json(normalizeIntercomMessage(message));
  });

  router.post("/ollama/chat", async (req: Request, res: Response) => {
    const model = typeof req.body?.model === "string" ? req.body.model.trim() : "";
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!model || !message) return res.status(400).json({ error: "Model and message are required" });

    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    try {
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [{ role: "user", content: message }],
        }),
      });
      if (!response.ok) return res.status(response.status).json({ error: `Ollama request failed: ${response.status}` });
      const data = await response.json() as { message?: { content?: string }; response?: string; model?: string };
      res.json({ model: data.model ?? model, response: data.message?.content ?? data.response ?? "" });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown Ollama error";
      res.status(502).json({ error: "Unable to reach Ollama", detail });
    }
  });

  router.get("/ollama/models", async (_req: Request, res: Response) => {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`);
      if (!response.ok) return res.json({ available: false, models: [], error: `Ollama request failed: ${response.status}` });
      const data = await response.json() as { models?: Array<Record<string, unknown>> };
      res.json({
        available: true,
        models: (data.models ?? []).map((model) => ({
          name: String(model.name ?? model.model ?? "unknown"),
          model: String(model.model ?? model.name ?? "unknown"),
          size: Number(model.size ?? 0),
          modifiedAt: String(model.modified_at ?? ""),
          details: model.details ?? {},
        })),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown Ollama error";
      res.json({ available: false, models: [], error: detail });
    }
  });

  return router;
}

function intercomHistory() {
  const rows = db.prepare("SELECT * FROM intercom_messages ORDER BY id DESC LIMIT ?").all(appConfig.intercom.maxHistory) as Array<Record<string, any>>;
  return rows.map(normalizeIntercomMessage);
}

function normalizeIntercomMessage(row: Record<string, any>) {
  return {
    id: row.id,
    sender: row.sender,
    targetType: row.target_type,
    targetId: row.target_id,
    message: row.message,
    priority: row.priority,
    timestamp: row.created_at,
    requiresAcknowledgement: Boolean(row.requires_acknowledgement),
    acknowledgedBy: safeJson(row.acknowledged_by, []),
    generatedTasks: safeJson(row.generated_tasks, []),
  };
}

function createIntercomTasks(message: string, targetType: string, targetId?: number) {
  const lower = message.toLowerCase();
  const tasks: Array<Record<string, unknown>> = [];
  const source = appConfig.intercom.generatedTaskSource;

  if (lower.includes("check") || lower.includes("inspect")) tasks.push(queueGeneratedTask("Intercom inspection request", targetType, targetId, source));
  if (lower.includes("clean") || lower.includes("storage")) tasks.push(queueGeneratedTask("Intercom cleanup request", targetType, targetId, source));
  if (lower.includes("docker") || lower.includes("alert")) tasks.push(queueGeneratedTask("Intercom alert review", "DEPARTMENT", targetId, source));
  if (lower.includes("summarize") || lower.includes("report")) tasks.push(queueGeneratedTask("Intercom report request", targetType, targetId, source));

  return tasks;
}

function queueGeneratedTask(title: string, targetType: string, targetId: number | undefined, source: string) {
  const departmentId = targetType === "DEPARTMENT" || targetType === "MANAGER" ? targetId ?? null : null;
  const result = db.prepare(`
    INSERT INTO tasks (title, description, priority, status, progress, source, department_id)
    VALUES (?, ?, 'NORMAL', 'QUEUED', 0, ?, ?)
  `).run(title, "Generated from Boss Console intercom message.", source, departmentId);
  return tasksQuery("tasks.id = ?").get(result.lastInsertRowid) as Record<string, unknown>;
}

function cpuSnapshot() {
  const cpus = os.cpus();
  const totals = cpus.map((cpu) => {
    const idle = cpu.times.idle;
    const total = Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
    return { idle, total, model: cpu.model, speedMHz: cpu.speed };
  });
  return {
    cores: cpus.length,
    model: cpus[0]?.model ?? "unknown",
    speedMHz: Math.round(cpus.reduce((sum, cpu) => sum + cpu.speed, 0) / Math.max(1, cpus.length)),
    idle: totals.reduce((sum, item) => sum + item.idle, 0),
    total: totals.reduce((sum, item) => sum + item.total, 0),
  };
}

async function sampleCpuUsage() {
  const start = cpuSnapshot();
  await new Promise((resolve) => setTimeout(resolve, 250));
  const end = cpuSnapshot();
  const idleDelta = end.idle - start.idle;
  const totalDelta = end.total - start.total;
  const usedPercent = totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 100) : 0;
  return {
    model: end.model,
    cores: end.cores,
    speedMHz: end.speedMHz,
    usedPercent,
  };
}

async function getDockerStats() {
  try {
    const version = await execFileAsync("docker", ["version", "--format", "{{json .}}"], { timeout: 8000 });
    const ps = await execFileAsync("docker", ["ps", "--format", "{{json .}}"], { timeout: 8000 });
    const stats = await execFileAsync("docker", ["stats", "--no-stream", "--format", "{{json .}}"], { timeout: 12000 });
    const statLines = stats.stdout
      .split(/\r?\n/)
      .map((line) => parseDockerLine(line))
      .filter((line): line is Record<string, unknown> => !!line);
    const containers = ps.stdout
      .split(/\r?\n/)
      .map((line) => parseDockerLine(line))
      .filter((line): line is Record<string, unknown> => !!line)
      .map((container) => {
        const stat = statLines.find((item) => String(item.Container ?? item.ID ?? "") === String(container.ID ?? "")) ?? {};
        return {
          id: String(container.ID ?? ""),
          name: String(container.Names ?? ""),
          image: String(container.Image ?? ""),
          status: String(container.Status ?? ""),
          ports: String(container.Ports ?? ""),
          cpuPercent: String(stat.CPUPerc ?? "0%"),
          memoryUsage: String(stat.MemUsage ?? "0B / 0B"),
          memoryPercent: String(stat.MemPerc ?? "0%"),
          networkIo: String(stat.NetIO ?? "0B / 0B"),
          blockIo: String(stat.BlockIO ?? "0B / 0B"),
        };
      });
    return {
      available: true,
      version: parseDockerLine(version.stdout) ?? {},
      running: containers.length,
      containers,
      sampledAt: new Date().toISOString(),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Docker unavailable";
    return readTelemetryDockerStats(detail);
  }
}

async function readTelemetryDockerStats(cliError: string) {
  const filePath = process.env.DOCKER_TELEMETRY_PATH || path.join(process.env.TELEMETRY_NUKEBOX_PATH || "/networking/Outbox/nukebox", "docker", "docker_stats.json");
  try {
    const telemetry = await readJsonFile(filePath);
    const status = telemetry.features?.container_status ?? {};
    const resourceUsage = telemetry.features?.container_resource_usage ?? {};
    const statusContainers: Array<Record<string, unknown>> = Array.isArray(status.containers) ? status.containers : [];
    const usageContainers: Array<Record<string, unknown>> = Array.isArray(resourceUsage.containers) ? resourceUsage.containers : [];
    const containers = statusContainers.map((container: Record<string, unknown>) => {
      const name = String(container.name ?? container.Names ?? "");
      const id = String(container.id ?? container.ID ?? "");
      const usage = usageContainers.find((item: Record<string, unknown>) => {
        const usageName = String(item.name ?? item.Name ?? "");
        const usageId = String(item.id ?? item.ID ?? item.Container ?? "");
        return (name && usageName === name) || (id && usageId === id);
      }) ?? {};
      return {
        id,
        name,
        image: String(container.image ?? container.Image ?? ""),
        status: String(container.status ?? container.Status ?? container.state ?? ""),
        ports: String(container.ports ?? container.Ports ?? ""),
        cpuPercent: String(usage.cpu_percent ?? usage.CPUPerc ?? "0%"),
        memoryUsage: String(usage.memory_usage ?? usage.MemUsage ?? "0B / 0B"),
        memoryPercent: String(usage.memory_percent ?? usage.MemPerc ?? "0%"),
        networkIo: String(usage.network_io ?? usage.NetIO ?? "0B / 0B"),
        blockIo: String(usage.block_io ?? usage.BlockIO ?? "0B / 0B"),
      };
    });

    const updatedAt = stringValue(telemetry.updated_at) ?? stringValue(status.collected_at) ?? stringValue(resourceUsage.collected_at) ?? new Date().toISOString();
    const running = numberValue(status.running) ?? containers.filter((container) => /running|up/i.test(container.status)).length;
    return {
      available: Boolean(status.available ?? resourceUsage.available ?? containers.length),
      source: "telemetry:nukebox",
      sourceDevice: "nukebox",
      sourcePath: filePath,
      version: {},
      running,
      total: numberValue(status.total) ?? containers.length,
      stopped: numberValue(status.stopped) ?? Math.max(0, containers.length - running),
      containers,
      sampledAt: updatedAt,
      note: "Docker CLI is not mounted in the backend container; using read-only NukeBox telemetry.",
      cliError,
    };
  } catch (telemetryError) {
    const telemetryDetail = telemetryError instanceof Error ? telemetryError.message : "Docker telemetry unavailable";
    return {
      available: false,
      source: "unavailable",
      running: 0,
      containers: [],
      error: `${cliError}; telemetry fallback failed: ${telemetryDetail}`,
      sampledAt: new Date().toISOString(),
    };
  }
}

function telemetryInboxPath() {
  return process.env.TELEMETRY_INBOX_PATH || "/telemetry-inbox";
}

function readFacilityDevices() {
  return Promise.all([
    readTelemetryDevice("nukebox", "NukeBox", "mother", process.env.TELEMETRY_NUKEBOX_PATH),
    readTelemetryDevice("hp-laptop", "HP Laptop", "clone"),
    readTelemetryDevice("the-bak3ry", "BAK3RY", "grow1"),
    readTelemetryDevice("hack-safe", "Hack-Safe", "grow2"),
    readTelemetryDevice("oracle-vm", "The Garden", "soil"),
    readTelemetryDevice("cak3d-creations", "CAK3D-Creations", "vmCreations"),
  ]);
}

async function probeServices() {
  const targets = [
    { id: "backend", label: "Backend API", url: "http://127.0.0.1:" + (process.env.PORT || 3006) + "/health" },
    { id: "websocket", label: "Simulation engine", url: (process.env.WEBSOCKET_URL || "http://neurolab-websocket:3007") + "/health" },
    { id: "ai", label: "AI service", url: (process.env.AI_URL || "http://neurolab-ai:3008") + "/health" },
    { id: "monitor", label: "Monitor daemon", url: (process.env.MONITOR_URL || "http://neurolab-monitor:3009") + "/health" },
  ];
  return Promise.all(targets.map(async ({ id, label, url }) => {
    const started = Date.now();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
      const body = await response.json().catch(() => ({})) as { tick?: number; mode?: string };
      return { id, label, ok: response.ok, latencyMs: Date.now() - started, tick: typeof body.tick === "number" ? body.tick : undefined, mode: body.mode };
    } catch (error) {
      return { id, label, ok: false, latencyMs: Date.now() - started, tick: undefined, mode: undefined, error: error instanceof Error ? error.message : "unreachable" };
    }
  }));
}

async function readTelemetryDevice(folder: string, displayName: string, roomId: string, explicitPath?: string) {
  const basePath = explicitPath || path.join(telemetryInboxPath(), folder);
  try {
    const [info, core] = await Promise.all([
      readJsonFile(path.join(basePath, "info.json")),
      readJsonFile(path.join(basePath, "core", "core_stats.json")),
    ]);
    const updatedAt = stringValue(core.updated_at) ?? stringValue(core.sampled_at) ?? stringValue(core.timestamp) ?? stringValue(info.orchestration?.timestamp) ?? stringValue(info.sampled_at) ?? stringValue(info.timestamp);
    const ageMs = updatedAt ? Date.now() - new Date(updatedAt).getTime() : Number.POSITIVE_INFINITY;
    const stale = !Number.isFinite(ageMs) || ageMs > 15 * 60_000;
    const declaredOnline = info.status?.online !== false;
    const online = declaredOnline && !stale;
    return {
      id: folder,
      displayName,
      roomId,
      sourcePath: basePath,
      hostname: stringValue(info.node?.hostname) ?? folder,
      online,
      stale,
      sampledAt: updatedAt ?? null,
      statusFlag: stringValue(info.status?.status_flag) ?? (online ? "nominal" : "offline"),
      temperatureC: numberValue(info.status?.temperature_c) ?? temperatureFromCore(core),
      cpuPercent: numberValue(core.features?.cpu_usage?.total_percent) ?? numberValue(core.features?.cpu_usage?.total_usage_pct) ?? numberValue(core.cpu_percent),
      speedMHz: numberValue(core.features?.cpu_speeds?.current_mhz) ?? numberValue(core.features?.cpu_speeds?.per_core_mhz?.[0]?.current),
      memoryPercent: numberValue(core.features?.ram_and_swap?.ram?.percent) ?? numberValue(core.features?.ram_and_swap?.ram?.used_pct) ?? numberValue(core.memory_percent),
      swapPercent: numberValue(core.features?.ram_and_swap?.swap?.percent) ?? numberValue(core.features?.ram_and_swap?.swap?.used_pct),
      totalMemoryBytes: numberValue(core.features?.ram_and_swap?.ram?.total) ?? numberValue(core.features?.ram_and_swap?.ram?.total_bytes),
      pingMs: numberValue(info.network?.ping_ms),
      note: online ? "Telemetry online" : stale ? "Telemetry is stale or offline" : "Device reports offline",
    };
  } catch {
    return {
      id: folder,
      displayName,
      roomId,
      sourcePath: basePath,
      hostname: folder,
      online: false,
      stale: true,
      sampledAt: null,
      statusFlag: "waiting",
      temperatureC: null,
      cpuPercent: null,
      speedMHz: null,
      memoryPercent: null,
      swapPercent: null,
      totalMemoryBytes: null,
      pingMs: null,
      note: "Telemetry feed not received yet",
    };
  }
}

async function readJsonFile(filePath: string): Promise<Record<string, any>> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content.replace(/^\uFEFF/, "")) as Record<string, any>;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function temperatureFromCore(core: Record<string, any>) {
  const sensors = core.features?.temperatures?.sensors;
  if (Array.isArray(sensors)) return numberValue(sensors[0]?.current_c);
  return undefined;
}

function parseDockerLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function readFacilityLayoutState() {
  return {
    current: readSetting("facility_layout_current", null),
    history: readSetting("facility_layout_history", []),
  };
}

function readStaffConfigState() {
  return {
    current: readSetting("staff_config_current", null),
    history: readSetting("staff_config_history", []),
  };
}

function validateStaffConfigSnapshot(input: any) {
  const failures: string[] = [];
  const warnings: string[] = [];
  const staff = input?.staff && typeof input.staff === "object" && !Array.isArray(input.staff) ? input.staff : undefined;
  if (!staff) failures.push("staff must be an object keyed by staff id");
  const ids = new Set<string>();
  for (const [id, item] of Object.entries(staff ?? {}) as Array<[string, any]>) {
    if (!id.trim()) failures.push("staff id cannot be blank");
    if (ids.has(id)) failures.push(`duplicate staff id: ${id}`);
    ids.add(id);
    if (item?.id && item.id !== id) warnings.push(`${id} payload id differs from key ${item.id}`);
    if (typeof item?.name !== "string" || !item.name.trim()) failures.push(`${id} missing name`);
    if (typeof item?.title !== "string" || !item.title.trim()) failures.push(`${id} missing title`);
    if (typeof item?.role !== "string" || !item.role.trim()) failures.push(`${id} missing role`);
    if (typeof item?.stationRoomId !== "string" || !item.stationRoomId.trim()) warnings.push(`${id} missing station room`);
    if (!Number.isFinite(item?.age) || item.age < 18 || item.age > 99) warnings.push(`${id} age is outside normal staff range`);
  }
  return { failures, warnings };
}

function readActivityState() {
  return {
    current: readSetting("activity_state_current", null),
    history: readSetting("activity_state_history", []),
  };
}

function validateActivityStateSnapshot(input: any) {
  const failures: string[] = [];
  const warnings: string[] = [];
  const state = input?.state;
  if (!state || typeof state !== "object") failures.push("state must be an object");
  if (!Number.isFinite(state?.tick)) failures.push("state.tick must be finite");
  const inventory = state?.inventory;
  if (!inventory || typeof inventory !== "object") failures.push("state.inventory must be an object");
  for (const key of ["packaging", "extractionBatches", "rdSamples", "rdPassed", "rdFailed", "salesStock", "managerRequests"] as const) {
    if (!Number.isFinite(inventory?.[key])) failures.push(`inventory.${key} must be finite`);
    if (Number.isFinite(inventory?.[key]) && inventory[key] < 0) warnings.push(`inventory.${key} is negative`);
  }
  if (!Array.isArray(state?.feed)) failures.push("state.feed must be an array");
  if (Array.isArray(state?.feed) && state.feed.length > 40) warnings.push("activity feed is longer than the visible dashboard limit");
  return { failures, warnings };
}

function readSetting<T>(key: string, fallback: T): T {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row ? safeJson(row.value, fallback) : fallback;
}

function writeSetting(key: string, value: unknown) {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, JSON.stringify(value));
}

function validateFacilityLayoutSnapshot(input: any) {
  const failures: string[] = [];
  const warnings: string[] = [];
  const rooms = Array.isArray(input?.rooms) ? input.rooms : [];
  if (!rooms.length) failures.push("rooms must be a non-empty array");
  const ids = new Set<string>();
  for (const [index, room] of rooms.entries()) {
    const tag = typeof room?.id === "string" && room.id ? room.id : `room[${index}]`;
    if (typeof room?.id !== "string" || !room.id.trim()) failures.push(`${tag} missing id`);
    if (ids.has(room.id)) failures.push(`duplicate room id: ${room.id}`);
    ids.add(room.id);
    if (typeof room?.label !== "string" || !room.label.trim()) failures.push(`${tag} missing label`);
    for (const key of ["x", "y", "w", "h"] as const) if (!Number.isFinite(room?.[key])) failures.push(`${tag} ${key} must be a finite number`);
    if (Number.isFinite(room?.w) && room.w < 3) failures.push(`${tag} width must be at least 3`);
    if (Number.isFinite(room?.h) && room.h < 3) failures.push(`${tag} height must be at least 3`);
    if (Number.isFinite(room?.x) && Number.isFinite(room?.y) && Number.isFinite(room?.w) && Number.isFinite(room?.h)) {
      if (room.x < 0 || room.y < 0) failures.push(`${tag} cannot start outside map origin`);
      if (room.x + room.w > 122 || room.y + room.h > 62) failures.push(`${tag} exceeds Gen2 map bounds`);
    }
    if (!Array.isArray(room?.doors) || !room.doors.length) warnings.push(`${tag} has no doors`);
  }
  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      const a = rooms[i];
      const b = rooms[j];
      if (![a?.x, a?.y, a?.w, a?.h, b?.x, b?.y, b?.w, b?.h].every(Number.isFinite)) continue;
      const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      if (overlap) failures.push(`rooms overlap: ${a.id ?? i} and ${b.id ?? j}`);
    }
  }
  return { failures, warnings };
}

function employeeWarnings(employee: Record<string, any>) {
  const warnings: string[] = [];
  if (employee.hunger > 80) warnings.push("Hungry");
  if (employee.fatigue > 80) warnings.push("Fatigued");
  if (employee.stress > 75) warnings.push("High stress");
  if (employee.stamina < 25) warnings.push("Low stamina");
  return warnings;
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
