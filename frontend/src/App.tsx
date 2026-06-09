import { Gen2FacilityDashboard } from "./components/Gen2FacilityDashboard";

export function App() {
  return (
    <main className="min-h-[120vh] bg-[#2f3130] px-4 py-5 text-[#f4ead8]">
      <section className="mx-auto flex max-w-[1400px] items-end justify-between gap-4 pb-3">
        <div>
          <h1 className="font-mono text-xl font-bold uppercase tracking-normal">Facility Overview</h1>
          <p className="font-mono text-xs uppercase tracking-normal text-[#cfc7b9]">Gen 2 facility dashboard.</p>
        </div>
      </section>
      <Gen2FacilityDashboard />
      <section className="mx-auto max-w-[1400px] py-8 font-mono text-xs uppercase tracking-normal text-[#cfc7b9]">
        Page scroll remains active outside the facility board.
      </section>
    </main>
  );
}
