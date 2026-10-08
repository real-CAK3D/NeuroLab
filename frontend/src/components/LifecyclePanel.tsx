import { LIFE_GROW_ROOMS, LIFE_ROOM_NAMES, lifeStageCounts, type LifeState } from "../game/lifecycleLogic";

export type LifecycleCalendar = {
  dateText: string;
  weatherText?: string;
  decor: string | null;
  holidays: Array<{ name: string; daysUntil: number }>;
  birthdays: Array<{ name: string; days: number; label: string }>;
};

/** Compact Game Boy style readout of the backend crop lifecycle (facility sim clock, stage counts, inventory, recent log). */
export function LifecyclePanel({ life, calendar, onClose }: { life?: LifeState; calendar?: LifecycleCalendar; onClose: () => void }) {
  const snap = life?.snap;
  return (
    <div className="lifecycle-panel" role="dialog" aria-label="Crop lifecycle" onClick={(event) => event.stopPropagation()}>
      <header>
        <div>
          <strong>LIFECYCLE</strong>
          <span>{life?.mock ? "MOCK FEED (?lifecycleMock=1), NOT LIVE DATA" : "CROP CYCLE, GROW TO SALE"}</span>
        </div>
        <button type="button" onClick={onClose}>CLOSE</button>
      </header>
      {calendar ? (
        <>
          <h4>CALENDAR</h4>
          <div className="lifecycle-log life-calendar">
            <span>{calendar.dateText}{calendar.decor ? ` · ${calendar.decor.toUpperCase()} DECOR UP` : ""}</span>
            {calendar.weatherText ? <span>WEATHER: {calendar.weatherText.split(";")[0].toUpperCase()}</span> : null}
            {calendar.holidays.map((holiday) => <span key={holiday.name}>{holiday.name.toUpperCase()} {holiday.daysUntil === 0 ? "TODAY" : `IN ${holiday.daysUntil} DAY${holiday.daysUntil === 1 ? "" : "S"}`}</span>)}
            {calendar.birthdays.length
              ? calendar.birthdays.map((birthday) => <span key={`${birthday.name}-${birthday.label}`} className="is-birthday">BIRTHDAY: {birthday.name.toUpperCase()} {birthday.days === 0 ? "TODAY" : `${birthday.label} (IN ${birthday.days}D)`}</span>)
              : <span>NO STAFF BIRTHDAYS IN THE NEXT 7 DAYS.</span>}
          </div>
        </>
      ) : null}
      {!snap ? (
        <div className="lifecycle-clock">LIFECYCLE FEED NOT AVAILABLE. THE FLOOR KEEPS ITS DEMO LOOP.</div>
      ) : (
        <>
          <div className="lifecycle-clock">SIM CLOCK {snap.simLabel} · X{snap.scale} · 1 REAL HOUR = {Number((snap.scale / 24).toFixed(2))} SIM DAY(S)</div>
          <h4>BATCHES BY STAGE</h4>
          <div className="lifecycle-grid">
            {lifeStageCounts(snap).map(([label, count]) => (
              <span key={label}><b>{count}</b><em>{label}</em></span>
            ))}
          </div>
          <h4>INVENTORY</h4>
          <div className="lifecycle-grid">
            <span><b>{snap.inventory.flower}</b><em>FLOWER UNITS</em></span>
            <span><b>{snap.inventory.extract}</b><em>EXTRACT UNITS</em></span>
            <span><b>{snap.rooms.mother.mothers.length}</b><em>MOTHER PLANTS</em></span>
          </div>
          <h4>GROW ROOMS</h4>
          <div className="lifecycle-log">
            {LIFE_GROW_ROOMS.map((room) => {
              const r = snap.rooms[room];
              return <span key={room}>{LIFE_ROOM_NAMES[room]}: {r.phase === "growing" ? `DAY ${r.day}/${r.cycleDays} ${r.plantStage?.toUpperCase()} ${r.batch?.code ?? ""}` : r.label}</span>;
            })}
          </div>
          <h4>LAST EVENTS</h4>
          <div className="lifecycle-log">
            {snap.log.length ? snap.log.slice(0, 8).map((entry, index) => <span key={`${entry.simAt}-${index}`} className={`is-${entry.kind}`}>{entry.message}</span>) : <span>NO EVENTS YET.</span>}
          </div>
          <h4>LAST ORDER / SAMPLE</h4>
          <div className="lifecycle-log">
            <span>{snap.sales[0] ? `${snap.sales[0].orderCode}: ${snap.sales[0].units} ${snap.sales[0].sku}${snap.sales[0].batch ? ` FROM ${snap.sales[0].batch}` : ""}` : "NO ORDERS YET"}</span>
            <span>{snap.samples[0] ? `${snap.samples[0].result.toUpperCase()}: ${snap.samples[0].batch ?? ""} IN ${LIFE_ROOM_NAMES[snap.samples[0].room] ?? snap.samples[0].room}` : "NO SAMPLES YET"}</span>
          </div>
        </>
      )}
    </div>
  );
}
