import { createIntercomMessageSchema, createTaskSchema } from "../../../shared/index";
import type { BootstrapPayload, CreateIntercomMessageInput, CreateTaskInput, Employee, IntercomMessage, Room, Task } from "../types/domain";

// Same-origin by default: the Vite server proxies /api to the backend, so the dashboard works
// from localhost, the LAN, or a Tailscale URL without rebuilding. Set VITE_BACKEND_URL to override.
const backendUrl = (import.meta.env.VITE_BACKEND_URL ?? "").replace(/\/$/, "");

export type HostStats = {
  hostname: string;
  platform: string;
  uptimeSeconds: number;
  cpu: {
    model: string;
    cores: number;
    speedMHz: number;
    usedPercent: number;
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPercent: number;
  };
  loadAverage: number[];
  sensors: {
    temperatureC: number | null;
    fanRpm: number | null;
    note: string;
  };
  sampledAt: string;
};

export type DockerStats = {
  available: boolean;
  running: number;
  containers: Array<{
    id: string;
    name: string;
    image: string;
    status: string;
    ports: string;
    cpuPercent: string;
    memoryUsage: string;
    memoryPercent: string;
    networkIo: string;
    blockIo: string;
  }>;
  error?: string;
  sampledAt: string;
};

export type OllamaModel = {
  name: string;
  model: string;
  size: number;
  modifiedAt: string;
  details: Record<string, unknown>;
};

export type OllamaModels = {
  available: boolean;
  models: OllamaModel[];
  error?: string;
};

export type FacilityDeviceTelemetry = {
  id: string;
  displayName: string;
  roomId: string;
  sourcePath: string;
  hostname: string;
  online: boolean;
  stale: boolean;
  sampledAt: string | null;
  statusFlag: string;
  temperatureC: number | null;
  cpuPercent: number | null;
  speedMHz: number | null;
  memoryPercent: number | null;
  swapPercent: number | null;
  totalMemoryBytes: number | null;
  pingMs: number | null;
  note: string;
};

export type FacilityDevices = {
  inbox: string;
  sampledAt: string;
  devices: FacilityDeviceTelemetry[];
};

export type FacilityLayoutRoom = {
  id: string;
  label: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  doors: Array<{ side: "top" | "right" | "bottom" | "left"; at: number; size?: number }>;
};

export type FacilityLayoutSnapshot = {
  id: string;
  savedAt: string;
  note: string;
  rooms: FacilityLayoutRoom[];
  drafts: Record<string, unknown>;
  validation: { failures: string[]; warnings: string[] };
};

export type FacilityLayoutState = {
  current: FacilityLayoutSnapshot | null;
  history: FacilityLayoutSnapshot[];
};

export type StaffConfigSnapshot = {
  id: string;
  savedAt: string;
  note: string;
  staff: Record<string, unknown>;
  validation: { failures: string[]; warnings: string[] };
};

export type StaffConfigState = {
  current: StaffConfigSnapshot | null;
  history: StaffConfigSnapshot[];
};

export type ActivityStateSnapshot = {
  id: string;
  savedAt: string;
  note: string;
  state: Record<string, unknown>;
  validation: { failures: string[]; warnings: string[] };
};

export type ActivityStateResponse = {
  current: ActivityStateSnapshot | null;
  history: ActivityStateSnapshot[];
};

export type NeuroLabSummary = {
  ok: boolean;
  sampledAt: string;
  tick: number | null;
  facility: {
    employees: number;
    rooms: number;
    departments: number;
    tasks: { open: number; queued: number; completed: number };
    alerts: { total: number; critical: number; last: { level: string; title: string; created_at: string } | null };
    lastEvent: { type: string; message: string; created_at: string } | null;
  };
  services: Array<{ id: string; label: string; ok: boolean; latencyMs: number; tick?: number; mode?: string; error?: string }>;
  host: { hostname: string; cpuPercent: number; memoryPercent: number; uptimeSeconds: number };
  telemetry: {
    online: number;
    total: number;
    stale: number;
    devices: Array<{ id: string; name: string; online: boolean; temperatureC: number | null; cpuPercent: number | null; memoryPercent: number | null }>;
  };
};

export async function getSummary(): Promise<NeuroLabSummary> {
  return fetchJson(`${backendUrl}/api/summary`);
}

export type HistorySample = { t: string; cpu: number | null; mem: number | null; tick: number | null; online: number | null; total: number | null; down: number | null; critical: number | null; tasks: number | null };

export async function getHistory(minutes = 120): Promise<{ minutes: number; samples: HistorySample[] }> {
  return fetchJson(`${backendUrl}/api/history?minutes=${minutes}`);
}

export async function getBootstrap(): Promise<BootstrapPayload> {
  return fetchJson(`${backendUrl}/api/bootstrap`);
}

export async function getEmployee(id: number): Promise<Employee> {
  return fetchJson(`${backendUrl}/api/employees/${id}`);
}

export async function getRoom(id: number): Promise<Room> {
  return fetchJson(`${backendUrl}/api/rooms/${id}`);
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const parsed = createTaskSchema.parse(input);
  return fetchJson(`${backendUrl}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed),
  });
}

export async function getIntercomHistory(): Promise<IntercomMessage[]> {
  return fetchJson(`${backendUrl}/api/intercom`);
}

export async function sendIntercom(input: CreateIntercomMessageInput): Promise<IntercomMessage> {
  const parsed = createIntercomMessageSchema.parse(input);
  return fetchJson(`${backendUrl}/api/intercom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed),
  });
}

export async function chatWithOllama(input: { model: string; message: string }): Promise<{ response: string; model: string }> {
  return fetchJson(`${backendUrl}/api/ollama/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getHostStats(): Promise<HostStats> {
  return fetchJson(`${backendUrl}/api/system/host`);
}

export async function getDockerStats(): Promise<DockerStats> {
  return fetchJson(`${backendUrl}/api/system/docker`);
}

export async function getOllamaModels(): Promise<OllamaModels> {
  return fetchJson(`${backendUrl}/api/ollama/models`);
}

export async function getFacilityDevices(): Promise<FacilityDevices> {
  return fetchJson(`${backendUrl}/api/system/facility-devices`);
}

export async function getFacilityLayoutSnapshot(): Promise<FacilityLayoutState> {
  return fetchJson(`${backendUrl}/api/facility-layout`);
}

export async function applyFacilityLayoutSnapshot(input: { rooms: FacilityLayoutRoom[]; drafts: Record<string, unknown>; note?: string }): Promise<FacilityLayoutState> {
  return fetchJson(`${backendUrl}/api/facility-layout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function undoFacilityLayoutSnapshot(): Promise<FacilityLayoutState> {
  return fetchJson(`${backendUrl}/api/facility-layout/undo`, { method: "POST" });
}

export async function getStaffConfigSnapshot(): Promise<StaffConfigState> {
  return fetchJson(`${backendUrl}/api/staff-config`);
}

export async function applyStaffConfigSnapshot(input: { staff: Record<string, unknown>; note?: string }): Promise<StaffConfigState> {
  return fetchJson(`${backendUrl}/api/staff-config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function undoStaffConfigSnapshot(): Promise<StaffConfigState> {
  return fetchJson(`${backendUrl}/api/staff-config/undo`, { method: "POST" });
}

export async function getActivityStateSnapshot(): Promise<ActivityStateResponse> {
  return fetchJson(`${backendUrl}/api/activity-state`);
}

export async function applyActivityStateSnapshot(input: { state: Record<string, unknown>; note?: string }): Promise<ActivityStateResponse> {
  return fetchJson(`${backendUrl}/api/activity-state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function undoActivityStateSnapshot(): Promise<ActivityStateResponse> {
  return fetchJson(`${backendUrl}/api/activity-state/undo`, { method: "POST" });
}

// When the server sets NEUROLAB_WRITE_TOKEN, save it once in this browser: localStorage.setItem("neurolab.token", "<token>").
function writeToken() {
  try {
    return localStorage.getItem("neurolab.token") ?? "";
  } catch {
    return "";
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = writeToken();
  if (token && (init?.method ?? "GET") !== "GET") headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000), ...init, headers });
  if (response.status === 401) throw new Error("NeuroLab is write-locked (missing or wrong neurolab.token)");
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}
