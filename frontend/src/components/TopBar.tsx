import { useNeuroLabStore } from "../store/useNeuroLabStore";

export function TopBar({ apiReady, socketReady }: { apiReady: boolean; socketReady: boolean }) {
  const tick = useNeuroLabStore((state) => state.tick);
  const tickMs = useNeuroLabStore((state) => state.tickMs);
  const employees = useNeuroLabStore((state) => state.employees);
  const rooms = useNeuroLabStore((state) => state.rooms);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-lab-line bg-lab-panel px-4 py-3">
      <div>
        <h1 className="text-xl font-semibold tracking-normal text-white">NeuroLab</h1>
        <p className="text-sm text-lab-mist/70">Clean-room mission control MVP</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Status label="API" ok={apiReady} />
        <Status label="Socket" ok={socketReady} />
        <span className="rounded border border-lab-line px-3 py-1 text-lab-mist">Tick {tick} / {tickMs / 1000}s</span>
        <span className="rounded border border-lab-line px-3 py-1 text-lab-mist">{employees.length} staff</span>
        <span className="rounded border border-lab-line px-3 py-1 text-lab-mist">{rooms.length} rooms</span>
      </div>
    </header>
  );
}

function Status({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`rounded border px-3 py-1 ${ok ? "border-lab-green text-lab-green" : "border-lab-amber text-lab-amber"}`}>
      {label}: {ok ? "online" : "waiting"}
    </span>
  );
}

