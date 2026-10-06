import { useEffect, useState } from "react";
import { getSummary, type NeuroLabSummary } from "../utils/api";

const POLL_MS = 5000;

export function StatusStrip() {
  const [summary, setSummary] = useState<NeuroLabSummary>();
  const [error, setError] = useState<string>();
  const [lastOk, setLastOk] = useState<number>();

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
    poll();
    const interval = window.setInterval(poll, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const down = summary?.services.filter((service) => !service.ok).length ?? 0;
  const tone = error ? "border-[#b4533c] text-[#f0a48f]" : down ? "border-[#c9a23c] text-[#f2d98a]" : "border-[#4f8f5c] text-[#9fe0ab]";
  const headline = error ? `OFFLINE // ${error}` : !summary ? "CONNECTING" : down ? `${down} SERVICE${down > 1 ? "S" : ""} DOWN` : "ALL SYSTEMS NOMINAL";
  const facility = summary?.facility;

  return (
    <section className="mx-auto mb-3 max-w-[1400px] font-mono text-[11px] uppercase tracking-normal" aria-label="NeuroLab status">
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 border bg-[#262827] px-3 py-2 ${tone}`}>
        <b className="text-xs">{headline}</b>
        {summary && (
          <>
            <span>Tick {summary.tick ?? "n/a"}</span>
            <span>{facility?.employees} staff</span>
            <span>{facility?.tasks.open} open tasks</span>
            <span className={facility?.alerts.critical ? "text-[#f0a48f]" : ""}>{facility?.alerts.critical ? `${facility.alerts.critical} critical alerts` : `${facility?.alerts.total} alerts`}</span>
            <span>Telemetry {summary.telemetry.online}/{summary.telemetry.total}</span>
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
      {facility?.lastEvent && !error && <p className="mt-1 truncate px-1 text-[#cfc7b9]">Latest: {facility.lastEvent.message}</p>}
    </section>
  );
}
