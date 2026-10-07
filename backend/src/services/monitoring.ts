import { appendFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { createLogger } from "../../../shared/logging/logger";
import { db } from "../database/db";
import { eventBus } from "../events/bus";

const logger = createLogger("neurolab-backend:monitoring");

type Summary = {
  ok: boolean;
  tick: number | null;
  facility: { employees: number; tasks: { open: number; queued: number; completed: number }; alerts: { total: number; critical: number }; lastEvent: { message: string } | null };
  services: Array<{ id: string; label: string; ok: boolean; latencyMs: number; error?: string }>;
  host: { cpuPercent: number; memoryPercent: number };
  telemetry: { online: number; total: number; stale: number; devices: Array<{ id: string; name: string; online: boolean; temperatureC?: number | null; cpuPercent?: number | null; memoryPercent?: number | null }> };
};
export type SummaryProvider = () => Promise<Summary>;

const dataDir = path.dirname(process.env.DATABASE_PATH || "/data/neurolab.sqlite");
const reportsDir = path.join(dataDir, "reports");
const backupsDir = path.join(dataDir, "backups");
const SAMPLE_MS = 60_000;
const REPORT_EVERY_MS = 60 * 60_000;
const BACKUP_EVERY_MS = 24 * 60 * 60_000;
const HISTORY_DAYS = 7;
const BACKUPS_KEPT = 7;

const previousDevices = new Map<string, boolean>();
const previousServices = new Map<string, boolean>();

export function initMonitoringTables() {
  db.exec(`CREATE TABLE IF NOT EXISTS summary_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sampled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cpu REAL, mem REAL, tick INTEGER,
    telemetry_online INTEGER, telemetry_total INTEGER, services_down INTEGER, alerts_critical INTEGER, open_tasks INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_summary_history_at ON summary_history (sampled_at);`);
  mkdirSync(reportsDir, { recursive: true });
  mkdirSync(backupsDir, { recursive: true });
}

function setting(key: string): string | undefined {
  return (db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)?.value;
}

function writeSetting(key: string, value: string) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

function nextWorkOrder() {
  const next = Number(setting("wo_counter") ?? "0") + 1;
  writeSetting("wo_counter", String(next));
  return `WO-${String(next).padStart(6, "0")}`;
}

export function readHistory(minutes: number, maxPoints = 240) {
  const rows = db.prepare("SELECT sampled_at AS t, cpu, mem, tick, telemetry_online AS online, telemetry_total AS total, services_down AS down, alerts_critical AS critical, open_tasks AS tasks FROM summary_history WHERE sampled_at >= datetime('now', ?) ORDER BY id")
    .all(`-${Math.max(1, Math.round(minutes))} minutes`) as Array<Record<string, number | string | null>>;
  if (rows.length <= maxPoints) return rows;
  const step = rows.length / maxPoints;
  return Array.from({ length: maxPoints }, (_, index) => rows[Math.min(rows.length - 1, Math.floor(index * step))]);
}

function recordSample(summary: Summary) {
  db.prepare("INSERT INTO summary_history (cpu, mem, tick, telemetry_online, telemetry_total, services_down, alerts_critical, open_tasks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(summary.host.cpuPercent, summary.host.memoryPercent, summary.tick, summary.telemetry.online, summary.telemetry.total, summary.services.filter((s) => !s.ok).length, summary.facility.alerts.critical, summary.facility.tasks.open);
  db.prepare("DELETE FROM summary_history WHERE sampled_at < datetime('now', ?)").run(`-${HISTORY_DAYS} days`);
}

function raiseAlert(level: "NOTICE" | "WARNING" | "CRITICAL", title: string, message: string, payload: Record<string, unknown>) {
  db.prepare("INSERT INTO alerts (level, category, title, message) VALUES (?, 'TELEMETRY', ?, ?)").run(level, title, message);
  eventBus.publish({ type: "ALERT", message: `${title}: ${message}`, entity_type: "telemetry", payload: { level, ...payload } });
}

// Real device/service state changes become facility alerts (lights off, offline rooms, security call-outs).
function detectTransitions(summary: Summary) {
  const firstPass = previousDevices.size === 0 && previousServices.size === 0;
  for (const device of summary.telemetry.devices) {
    const was = previousDevices.get(device.id);
    if (!firstPass && was !== undefined && was !== device.online) {
      if (device.online) raiseAlert("NOTICE", `${device.name} back online`, "Telemetry feed resumed; room lights restored.", { device: device.id });
      else raiseAlert("WARNING", `${device.name} offline`, "Telemetry feed went stale; the room is dark until it reports again.", { device: device.id });
    }
    previousDevices.set(device.id, device.online);
  }
  for (const service of summary.services) {
    const was = previousServices.get(service.id);
    if (!firstPass && was !== undefined && was !== service.ok) {
      if (service.ok) raiseAlert("NOTICE", `${service.label} recovered`, `Responding in ${service.latencyMs} ms.`, { service: service.id });
      else raiseAlert("CRITICAL", `${service.label} down`, service.error ?? "Health check failed.", { service: service.id });
    }
    previousServices.set(service.id, service.ok);
  }
}

async function pickOllamaModel(ollamaUrl: string): Promise<string | undefined> {
  if (process.env.NEUROLAB_REPORT_MODEL) return process.env.NEUROLAB_REPORT_MODEL;
  const response = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
  const data = await response.json() as { models?: Array<{ name: string; size?: number }> };
  return [...(data.models ?? [])].sort((a, b) => (a.size ?? 0) - (b.size ?? 0))[0]?.name;
}

async function narrate(prompt: string): Promise<{ text: string; model: string } | undefined> {
  const ollamaUrl = process.env.OLLAMA_URL || "http://host.docker.internal:11434";
  try {
    const model = await pickOllamaModel(ollamaUrl);
    if (!model) return undefined;
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: false, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) return undefined;
    const data = await response.json() as { message?: { content?: string } };
    const text = data.message?.content?.trim();
    return text ? { text, model } : undefined;
  } catch {
    return undefined;
  }
}

function templateNarrative(summary: Summary, stats: { cpuAvg: number; cpuMax: number; memAvg: number }) {
  const down = summary.services.filter((s) => !s.ok).map((s) => s.label);
  const offline = summary.telemetry.devices.filter((d) => !d.online).map((d) => d.name);
  return [
    down.length ? `Services down: ${down.join(", ")}.` : "All four NeuroLab services are responding.",
    `Host CPU averaged ${stats.cpuAvg}% (peak ${stats.cpuMax}%), memory ${stats.memAvg}% over the last hour.`,
    offline.length ? `Rooms dark (device feed offline): ${offline.join(", ")}.` : "Every monitored device is reporting.",
    `${summary.facility.tasks.open} open tasks (${summary.facility.tasks.queued} queued), ${summary.facility.alerts.critical} critical alerts.`,
  ].join(" ");
}

export async function generateShiftReport(getSummary: SummaryProvider, kind: "hourly" | "manual" = "hourly") {
  const summary = await getSummary();
  const history = readHistory(60, 1000) as Array<{ cpu: number | null; mem: number | null }>;
  const cpus = history.map((row) => row.cpu ?? 0);
  const stats = {
    cpuAvg: cpus.length ? Math.round(cpus.reduce((a, b) => a + b, 0) / cpus.length) : summary.host.cpuPercent,
    cpuMax: cpus.length ? Math.round(Math.max(...cpus)) : summary.host.cpuPercent,
    memAvg: history.length ? Math.round(history.reduce((a, b) => a + (b.mem ?? 0), 0) / history.length) : summary.host.memoryPercent,
  };
  const facts = templateNarrative(summary, stats);
  const ai = await narrate(`You are the boss of a retro pixel-art cannabis grow facility that secretly monitors a home lab. Write a 3-4 sentence debrief for the owner, plain and a little in-character, using only these facts:\n${facts}\nDevices: ${summary.telemetry.devices.map((d) => `${d.name} ${d.online ? "online" : "offline"}`).join(", ")}.`);
  const wo = nextWorkOrder();
  const stamp = new Date().toISOString();
  const severity = summary.services.some((s) => !s.ok) ? "CRITICAL" : summary.telemetry.online < summary.telemetry.total ? "WARNING" : "INFO";
  const markdown = `## ${wo} · ${stamp} · Boss debrief (${kind})\n\n${ai?.text ?? facts}\n\n- Facts: ${facts}\n- Severity: ${severity}${ai ? `\n- Narrated by: ${ai.model}` : "\n- Narrated by: template (Ollama unavailable)"}\n\n`;
  const file = path.join(reportsDir, "wo-log.md");
  if (!existsSync(file)) appendFileSync(file, "# NeuroLab work-order log\n\nOne entry per boss debrief, newest last.\n\n");
  appendFileSync(file, markdown);
  db.prepare("INSERT INTO reports (report_type, recipient_role, severity, title, body) VALUES ('SHIFT_BRIEF', 'OWNER', ?, ?, ?)").run(severity, `${wo} Boss debrief`, ai?.text ?? facts);
  eventBus.publish({ type: "REPORT", message: `${wo} boss debrief filed.`, entity_type: "report", payload: { wo, severity } });
  return { wo, stamp, severity, narrative: ai?.text ?? facts, narratedBy: ai?.model ?? "template", file };
}

export function latestShiftReport() {
  return db.prepare("SELECT title, body, severity, created_at AS createdAt FROM reports WHERE report_type = 'SHIFT_BRIEF' ORDER BY id DESC LIMIT 1").get() ?? null;
}

function backupDatabase() {
  const file = path.join(backupsDir, `neurolab-${new Date().toISOString().slice(0, 10)}.sqlite`);
  if (existsSync(file)) unlinkSync(file);
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const stale = readdirSync(backupsDir).filter((name) => /^neurolab-.*\.sqlite$/.test(name)).sort().slice(0, -BACKUPS_KEPT);
  for (const name of stale) unlinkSync(path.join(backupsDir, name));
  logger.info({ file }, "database backup written");
}

function due(key: string, everyMs: number) {
  const stored = setting(key);
  if (stored === undefined) {
    // First run: start the clock instead of filing a report/backup the moment the stack boots.
    writeSetting(key, String(Date.now()));
    return false;
  }
  if (Date.now() - Number(stored) < everyMs) return false;
  writeSetting(key, String(Date.now()));
  return true;
}

export function startMonitoring(getSummary: SummaryProvider) {
  initMonitoringTables();
  async function tick() {
    try {
      const summary = await getSummary();
      recordSample(summary);
      detectTransitions(summary);
      if (due("last_backup_at", BACKUP_EVERY_MS)) backupDatabase();
      if (due("last_shift_report_at", REPORT_EVERY_MS)) await generateShiftReport(getSummary, "hourly");
    } catch (error) {
      logger.error({ error }, "monitoring tick failed");
    }
  }
  setTimeout(tick, 30_000);
  setInterval(tick, SAMPLE_MS);
}
