import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getHistory, getSummary, type HistorySample, type NeuroLabSummary } from "../utils/api";

const POLL_MS = 5000;
const HISTORY_POLL_MS = 60_000;

function Spark({ label, values, color, max = 100 }: { label: string; values: number[]; color: string; max?: number }) {
  if (values.length < 2) return null;
  const width = 64;
  const height = 14;
  const step = width / (values.length - 1);
  const points = values.map((value, index) => `${(index * step).toFixed(1)},${(height - (Math.min(value, max) / max) * (height - 2) - 1).toFixed(1)}`).join(" ");
  const last = values[values.length - 1];
  return (
    <span className="inline-flex items-center gap-1" title={`${label} over the last 2 hours`}>
      {label}
      <svg width={width} height={height} aria-hidden="true">
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
      {Math.round(last)}%
    </span>
  );
}

export function StatusStrip() {
  const [summary, setSummary] = useState<NeuroLabSummary>();
  const [error, setError] = useState<string>();
  const [lastOk, setLastOk] = useState<number>();
  const [history, setHistory] = useState<HistorySample[]>([]);
  const [live, setLive] = useState(false);
  const [liveTick, setLiveTick] = useState<number>();
  const [liveEvent, setLiveEvent] = useState<string>();

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const next = await getSummary();
        if (!alive) return;
        setSummary(next);
        setError(undefined);
        setLastOk(Date.now());
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "unreachable");
      }
    }
    async function pollHistory() {
      try {
        const data = await getHistory(120);
        if (alive) setHistory(data.samples);
      } catch {
        /* sparklines are optional */
      }
    }
    poll();
    pollHistory();
    const interval = window.setInterval(poll, POLL_MS);
    const historyInterval = window.setInterval(pollHistory, HISTORY_POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);

    // Live simulation stream (same origin; Vite proxies /socket.io to the websocket service). Polling stays as the fallback.
    const socket = io({ transports: ["websocket", "polling"], reconnectionDelayMax: 10_000 });
    socket.on("connect", () => alive && setLive(true));
    socket.on("disconnect", () => alive && setLive(false));
    socket.on("simulation:snapshot", (snapshot: { tick?: number }) => alive && typeof snapshot.tick === "number" && setLiveTick(snapshot.tick));
    socket.on("event", (event: { message?: string }) => alive && event.message && setLiveEvent(event.message));

    return () => {
      alive = false;
      window.clearInterval(interval);
      window.clearInterval(historyInterval);
      document.removeEventListener("visibilitychange", onVisible);
      socket.close();
    };
  }, []);

  const down = summary?.services.filter((service) => !service.ok).length ?? 0;
  const tone = error ? "border-[#b4533c] text-[#f0a48f]" : down ? "border-[#c9a23c] text-[#f2d98a]" : "border-[#4f8f5c] text-[#9fe0ab]";
  const headline = error ? `OFFLINE // ${error}` : !summary ? "CONNECTING" : down ? `${down} SERVICE${down > 1 ? "S" : ""} DOWN` : "ALL SYSTEMS NOMINAL";
  const facility = summary?.facility;
  const cpu = history.map((sample) => sample.cpu ?? 0);
  const mem = history.map((sample) => sample.mem ?? 0);
  const latest = liveEvent ?? facility?.lastEvent?.message;

  return (
    <section className="mx-auto mb-3 max-w-[1400px] font-mono text-[11px] uppercase tracking-normal" aria-label="NeuroLab status">
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 border bg-[#262827] px-3 py-2 ${tone}`}>
        <b className="text-xs">{headline}</b>
        <span className={live ? "text-[#9fe0ab]" : "text-[#cfc7b9]"} title={live ? "Live socket connected" : "Live socket reconnecting; polling instead"}>{live ? "● LIVE" : "○ POLLING"}</span>
        {summary && (
          <>
            <span>Tick {liveTick ?? summary.tick ?? "n/a"}</span>
            <span>{facility?.employees} staff</span>
            <span>{facility?.tasks.open} open tasks</span>
            <span className={facility?.alerts.critical ? "text-[#f0a48f]" : ""}>{facility?.alerts.critical ? `${facility.alerts.critical} critical alerts` : `${facility?.alerts.total} alerts`}</span>
            <span>Telemetry {summary.telemetry.online}/{summary.telemetry.total}</span>
            <Spark label="CPU" values={cpu} color="#9fe0ab" />
            <Spark label="MEM" values={mem} color="#8fc7e8" />
            <span className="flex flex-wrap gap-2">
              {summary.services.map((service) => (
                <span key={service.id} title={service.ok ? `${service.latencyMs} ms${service.mode ? ` · ${service.mode}` : ""}` : service.error ?? "down"} className={service.ok ? "text-[#9fe0ab]" : "text-[#f0a48f]"}>
                  {service.ok ? "●" : "○"} {service.label}
                </span>
              ))}
            </span>
          </>
        )}
        {lastOk && error && <span>last ok {Math.round((Date.now() - lastOk) / 1000)}s ago</span>}
      </div>
      {latest && !error && <p className="mt-1 truncate px-1 text-[#cfc7b9]">Latest: {latest}</p>}
    </section>
  );
}
