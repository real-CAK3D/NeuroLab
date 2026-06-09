export function createLogger(service: string) {
  return {
    info: (payload: Record<string, unknown>, message: string) => writeLog("info", service, message, payload),
    warn: (payload: Record<string, unknown>, message: string) => writeLog("warn", service, message, payload),
    error: (payload: Record<string, unknown>, message: string) => writeLog("error", service, message, normalizeErrorPayload(payload)),
  };
}

function writeLog(level: string, service: string, message: string, payload: Record<string, unknown>) {
  const minimum = process.env.LOG_LEVEL || "info";
  const order: Record<string, number> = { debug: 10, info: 20, warn: 30, error: 40 };
  if ((order[level] ?? 20) < (order[minimum] ?? 20)) return;
  console.log(JSON.stringify({ level, service, message, time: new Date().toISOString(), ...payload }));
}

function normalizeErrorPayload(payload: Record<string, unknown>) {
  const normalized = { ...payload };
  for (const [key, value] of Object.entries(normalized)) {
    if (value instanceof Error) normalized[key] = { name: value.name, message: value.message, stack: value.stack };
  }
  return normalized;
}

