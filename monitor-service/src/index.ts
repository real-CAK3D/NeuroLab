import cors from "cors";
import express, { type Request, type Response } from "express";
import { statfsSync } from "node:fs";
import os from "node:os";
import { appConfig } from "../../shared/index";
import { createLogger } from "../../shared/logging/logger";
import { eventBus } from "./events/bus";

const logger = createLogger("neurolab-monitor");
const port = Number(process.env.PORT || 3009);
const app = express();

app.use(cors());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "neurolab-monitor", mode: "os-read-only" });
});

app.get("/metrics", (_req: Request, res: Response) => {
  const metrics = mockMetrics();
  const facilityEvents = mapMetricsToFacilityEvents(metrics);
  eventBus.publish({
    type: "INFRASTRUCTURE",
    message: "Mock monitor metrics sampled.",
    entity_type: "system_metrics",
    payload: { metrics, facilityEvents },
  });
  res.json({ ...metrics, facilityEvents });
});

setInterval(() => {
  const metrics = mockMetrics();
  const facilityEvents = mapMetricsToFacilityEvents(metrics);
  eventBus.publish({
    type: "INFRASTRUCTURE",
    message: "Mock infrastructure polling interval elapsed.",
    entity_type: "system_metrics",
    payload: { metrics, facilityEvents },
  });
}, appConfig.simulation.infrastructurePollingMs);

app.listen(port, "0.0.0.0", () => {
  logger.info({ port, intervalMs: appConfig.simulation.infrastructurePollingMs }, "NeuroLab monitor placeholder listening");
});

let lastCpu = cpuTimes();
let lastCpuPercent = 0;

function cpuTimes() {
  return os.cpus().reduce((acc, cpu) => {
    acc.idle += cpu.times.idle;
    acc.total += Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
    return acc;
  }, { idle: 0, total: 0 });
}

// Real, read-only readings from the environment the monitor runs in (os + statfs); no writes, no Docker socket.
function cpuPercent() {
  const now = cpuTimes();
  const totalDelta = now.total - lastCpu.total;
  if (totalDelta > 0) lastCpuPercent = round1((1 - (now.idle - lastCpu.idle) / totalDelta) * 100);
  lastCpu = now;
  return lastCpuPercent;
}

function diskPercent() {
  try {
    const stats = statfsSync("/");
    return stats.blocks > 0 ? round1((1 - stats.bavail / stats.blocks) * 100) : 0;
  } catch {
    return 0;
  }
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function mockMetrics() {
  return {
    mode: "os-read-only",
    cpu: cpuPercent(),
    memory: round1((1 - os.freemem() / os.totalmem()) * 100),
    disk: diskPercent(),
    uptimeSeconds: Math.round(process.uptime()),
    services: {
      backend: "unknown-safe",
      websocket: "unknown-safe",
      ai: "placeholder",
      monitor: "online",
    },
    thresholds: appConfig.alerts,
    note: "No Docker socket or host write access is used by this MVP daemon.",
  };
}

function mapMetricsToFacilityEvents(metrics: ReturnType<typeof mockMetrics>) {
  const events = [
    thresholdEvent("CPU", metrics.cpu, appConfig.alerts.cpuNotice, appConfig.alerts.cpuWarning, appConfig.alerts.cpuCritical, "Extraction Lab and R&D workload pressure."),
    thresholdEvent("MEMORY", metrics.memory, appConfig.alerts.memoryNotice, appConfig.alerts.memoryWarning, appConfig.alerts.memoryCritical, "Operations memory pressure."),
    thresholdEvent("DISK", metrics.disk, appConfig.alerts.diskNotice, appConfig.alerts.diskWarning, appConfig.alerts.diskCritical, "Logistics and Storage capacity pressure."),
  ].filter(Boolean);

  if (events.length === 0) {
    return [{
      source: "monitor",
      category: "SYSTEM",
      severity: "INFO",
      title: "Facility normal",
      message: "Mock infrastructure sample is within normal operating range.",
      timestamp: new Date().toISOString(),
      affectedDepartmentId: null,
      affectedRoomId: null,
      affectedEmployeeIds: [],
      status: "OPEN",
      recommendedAction: "No action needed.",
      rawMetadata: metrics,
    }];
  }

  return events;
}

function thresholdEvent(category: string, value: number, notice: number, warning: number, critical: number, message: string) {
  const severity = value >= critical ? "CRITICAL" : value >= warning ? "WARNING" : value >= notice ? "NOTICE" : null;
  if (!severity) return null;
  return {
    source: "monitor",
    category,
    severity,
    title: `${category} ${severity.toLowerCase()}`,
    message: `${message} Current value: ${value}%.`,
    timestamp: new Date().toISOString(),
    affectedDepartmentId: null,
    affectedRoomId: null,
    affectedEmployeeIds: [],
    status: "OPEN",
    recommendedAction: severity === "CRITICAL" ? "Boss briefing should prioritize this immediately." : "Manager should watch this trend.",
    rawMetadata: { value, notice, warning, critical },
  };
}
