import type {
  LifecycleBatchRef,
  LifecycleBatchRow,
  LifecycleGrowRoom,
  LifecycleLogEntry,
  LifecyclePlantStage,
  LifecycleSale,
  LifecycleSample,
  LifecycleSnapshot,
} from "../utils/api";

/*
 * Dev-only synthetic lifecycle (enable with ?lifecycleMock=1). It is a miniature copy of the backend engine
 * (backend/src/services/lifecycle.ts) running in browser seconds instead of facility days, so every phase,
 * plant stage, dry/cure batch, mother retirement, sale and sample can be seen within a couple of minutes.
 * It feeds the very same code path as the real GET /api/lifecycle response and never touches the backend.
 */

export function lifecycleMockEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const flag = new URLSearchParams(window.location.search).get("lifecycleMock");
    return flag !== null && flag !== "0" && flag !== "false";
  } catch {
    return false;
  }
}

// One mock "day" is 3 seconds.
const DAY = 3;
// Long enough for a worker to walk across the facility and do the job (real durations are hours).
const D = { sterilize: 70, prep: 30, plant: 40, grow: 21 * DAY, harvest: 40, clean: 50, dry: 40, trim: 40, cure: 40, extract: 25, package: 20, load: 15, saleEvery: 16, sampleEvery: 22, motherLife: 108, restock: 20 };
const PLANTS = 10;
const DRY_ROOMS = ["soil", "vmCreations"] as const;
const GROW = ["grow1", "grow2", "grow3", "grow4"] as const;
const ROOM_LABEL: Record<string, string> = { soil: "THE GARDEN", vmCreations: "CAK3D-CREATIONS", trim: "PROCESS/TRIM", pack: "PACKAGING", extract: "EXTRACTION", dock: "LOADING", warehouse: "WAREHOUSE" };
const PHASE_LABEL: Record<string, string> = { idle: "OFFLINE", sterilizing: "STERILIZING", sterile: "STERILE", prep: "POTS + SOIL", planting: "PLANTING CLONES", growing: "GROWING", harvesting: "HARVEST", cleaning: "CLEANING" };

type MockRoom = { phase: string; since: number; batch: string | null; cycles: number };
type MockBatch = { code: string; kind: "flower" | "extract"; stage: string; room: string | null; since: number; units: number; quality: number; stress: number };
type MockMother = { code: string; source: string; born: number; retired: boolean };
type MockState = {
  t: number;
  startedAt: number;
  rooms: Record<string, MockRoom>;
  batches: MockBatch[];
  mothers: MockMother[];
  inventory: { flower: number; extract: number };
  log: LifecycleLogEntry[];
  samples: LifecycleSample[];
  sales: LifecycleSale[];
  counters: { batch: number; extract: number; mother: number; order: number; sale: number };
  lastSale: number;
  lastSample: number;
  noMotherSince: number;
  rr: number;
};

let state: MockState | undefined;
let pausedAt: number | undefined;

/** Dev helpers on window.lifecycleMock: pause(), resume(), skip(seconds), t() so a phase can be inspected without racing it. */
function exposeControls() {
  if (typeof window === "undefined") return;
  (window as unknown as { lifecycleMock: unknown }).lifecycleMock = {
    pause: () => { pausedAt = pausedAt ?? Date.now(); },
    resume: () => {
      if (state && pausedAt !== undefined) state.startedAt += Date.now() - pausedAt;
      pausedAt = undefined;
    },
    skip: (seconds: number) => { if (state) state.startedAt -= seconds * 1000; },
    t: () => state?.t ?? 0,
  };
}

function deviceOnline(room: string, t: number) {
  if (room === "grow1" || room === "grow2") return true;
  if (room === "grow4") return !(t % 150 > 96 && t % 150 < 116); // periodic outage: crop stress, then recovery
  return false;
}

function init(now: number): MockState {
  const rooms: Record<string, MockRoom> = {
    grow1: { phase: "prep", since: 0, batch: null, cycles: 0 },
    grow2: { phase: "growing", since: -30, batch: "B-0001", cycles: 0 },
    grow3: { phase: "idle", since: 0, batch: null, cycles: 0 },
    grow4: { phase: "sterilizing", since: -2, batch: null, cycles: 0 },
  };
  return {
    t: 0,
    startedAt: now,
    rooms,
    batches: [
      { code: "B-0001", kind: "flower", stage: "growing", room: "grow2", since: -30, units: PLANTS, quality: 100, stress: 8 },
      { code: "B-0000", kind: "flower", stage: "curing", room: "soil", since: -10, units: 36, quality: 96, stress: 0 },
    ],
    mothers: [20, 45, 70, 95].map((age, index) => ({ code: `M-000${index + 1}`, source: "seed", born: -age, retired: false })),
    inventory: { flower: 6, extract: 0 },
    log: [],
    samples: [],
    sales: [],
    counters: { batch: 1, extract: 0, mother: 4, order: 0, sale: 0 },
    lastSale: 0,
    lastSample: 0,
    noMotherSince: 0,
    rr: 0,
  };
}

function pushLog(s: MockState, kind: string, room: string | null, batch: string | null, message: string) {
  s.log.unshift({ simAt: s.t, realAt: new Date().toISOString().replace("T", " ").slice(0, 19), kind, room, batch, message });
  s.log.length = Math.min(s.log.length, 40);
}

const active = (s: MockState) => s.mothers.filter((mother) => !mother.retired);
const dryCount = (s: MockState, room: string) => s.batches.filter((b) => b.room === room && (b.stage === "drying" || b.stage === "curing")).length;
const roomName = (room: string) => ROOM_LABEL[room] ?? room.replace("grow", "GROW ROOM ").toUpperCase();

function tick(s: MockState) {
  const t = s.t;
  for (const mother of active(s)) {
    if (t - mother.born >= D.motherLife) {
      mother.retired = true;
      pushLog(s, "mother", "mother", mother.code, `Mother ${mother.code} is six weeks old and has been retired from the mother room.`);
    }
  }
  if (!active(s).length) {
    if (!s.noMotherSince) s.noMotherSince = t;
    if (t - s.noMotherSince >= D.restock) {
      const code = `M-${String(++s.counters.mother).padStart(4, "0")}`;
      s.mothers.push({ code, source: "seed", born: t, retired: false });
      s.noMotherSince = 0;
      pushLog(s, "mother", "mother", code, `No mother plants left: a new mother ${code} was started from a seed pack.`);
    }
  } else s.noMotherSince = 0;

  for (const room of GROW) {
    const r = s.rooms[room];
    const on = deviceOnline(room, t);
    const age = t - r.since;
    const batch = s.batches.find((b) => b.code === r.batch);
    const go = (phase: string, batchCode?: string | null) => {
      r.phase = phase;
      r.since = t;
      if (batchCode !== undefined) r.batch = batchCode;
    };
    switch (r.phase) {
      case "idle":
        if (on) go("prep");
        else if (age >= 6) go("sterilizing");
        break;
      case "sterilizing":
        if (age >= D.sterilize) go("sterile");
        break;
      case "sterile":
        if (on) go("prep");
        else if (age >= 30) go("idle"); // the no-device room keeps cycling idle -> sterilizing -> sterile
        break;
      case "prep":
        if (on && age >= D.prep) go("planting");
        break;
      case "planting":
        if (on && active(s).length && age >= D.plant) {
          const code = `B-${String(++s.counters.batch).padStart(4, "0")}`;
          s.batches.push({ code, kind: "flower", stage: "growing", room, since: t, units: PLANTS, quality: 100, stress: 0 });
          go("growing", code);
          const donor = active(s)[s.rr++ % active(s).length];
          pushLog(s, "plant", room, code, `${code}: ${PLANTS} clones cut from mother ${donor.code} and planted in ${roomName(room)}.`);
        }
        break;
      case "growing":
        if (batch && !on) batch.stress += 1.2 * 0.5;
        if (batch && room === "grow2") batch.stress = Math.max(batch.stress, 8); // keeps one room yellow on purpose
        if (age >= D.grow) {
          go("harvesting");
          if (batch) pushLog(s, "harvest", room, batch.code, `${batch.code} is ripe: harvest underway in ${roomName(room)}.`);
        }
        break;
      case "harvesting":
        if (age >= D.harvest && batch) {
          const dry = DRY_ROOMS.find((candidate) => dryCount(s, candidate) < 4);
          if (dry) {
            const quality = Math.max(40, Math.min(100, Math.round(100 - batch.stress * 1.5)));
            let plants = PLANTS;
            if (!active(s).some((mother) => mother.source === room)) {
              const code = `M-${String(++s.counters.mother).padStart(4, "0")}`;
              s.mothers.push({ code, source: room, born: t, retired: false });
              plants -= 1;
              pushLog(s, "mother", room, code, `One plant from ${roomName(room)} was kept back as the new mother ${code}.`);
            }
            batch.units = Math.max(4, Math.round(plants * 4 * (quality / 100)));
            batch.quality = quality;
            batch.stage = "drying";
            batch.room = dry;
            batch.since = t;
            pushLog(s, "harvest", room, batch.code, `${batch.code} harvested (quality ${quality}%): hung to dry in ${roomName(dry)}.`);
            go("cleaning", null);
            r.cycles += 1;
          }
        }
        break;
      case "cleaning":
        if (age >= D.clean) go(on ? "prep" : "idle");
        break;
      default:
        go("idle");
    }
  }

  const busy = (stage: string) => s.batches.some((b) => b.stage === stage);
  const move = (b: MockBatch, stage: string, room: string | null) => {
    b.stage = stage;
    b.room = room;
    b.since = t;
  };
  for (const b of [...s.batches]) {
    const age = t - b.since;
    switch (b.stage) {
      case "drying":
        if (age >= D.dry) { move(b, "trim-queue", "trim"); pushLog(s, "batch", "trim", b.code, `${b.code} is dry: queued for trimming.`); }
        break;
      case "trim-queue":
        if (!busy("trimming")) { move(b, "trimming", "trim"); pushLog(s, "batch", "trim", b.code, `${b.code}: trimming started.`); }
        break;
      case "trimming":
        if (age >= D.trim) { move(b, "cure-queue", "trim"); pushLog(s, "batch", "trim", b.code, `${b.code} trimmed: going back to a dry room to cure.`); }
        break;
      case "cure-queue": {
        const room = DRY_ROOMS.find((candidate) => dryCount(s, candidate) < 4);
        if (room) { move(b, "curing", room); pushLog(s, "batch", room, b.code, `${b.code} is curing in ${roomName(room)}.`); }
        break;
      }
      case "curing":
        if (age >= D.cure) {
          const extract = b.units % 3 === 0 || Number(b.code.slice(2)) % 3 === 0;
          move(b, extract ? "extract-queue" : "packaging", extract ? "extract" : "pack");
          pushLog(s, "batch", extract ? "extract" : "pack", b.code, `${b.code} is cured: headed to ${extract ? "the extraction lab" : "packaging"}.`);
        }
        break;
      case "extract-queue":
        if (!busy("extracting")) { move(b, "extracting", "extract"); pushLog(s, "batch", "extract", b.code, `${b.code}: extraction run started.`); }
        break;
      case "extracting":
        if (age >= D.extract) {
          const code = `X-${String(++s.counters.extract).padStart(4, "0")}`;
          const units = Math.max(2, Math.floor(b.units * 0.3));
          s.batches.push({ code, kind: "extract", stage: "packaging", room: "pack", since: t, units, quality: b.quality, stress: 0 });
          b.stage = "extracted";
          b.room = null;
          pushLog(s, "batch", "extract", code, `${code}: ${units} units of extract from ${b.code}, sent to packaging.`);
        }
        break;
      case "packaging":
        if (age >= D.package) { move(b, "loading", "dock"); pushLog(s, "batch", "dock", b.code, `${b.code} packaged (${b.units} units): moved to the loading bay.`); }
        break;
      case "loading":
        if (age >= D.load) {
          move(b, "warehouse", "warehouse");
          s.inventory[b.kind] += b.units;
          pushLog(s, "batch", "warehouse", b.code, `${b.code} cataloged and shelved in the warehouse (${b.units} ${b.kind} units).`);
        }
        break;
      default:
        break;
    }
  }
  s.batches = s.batches.filter((b) => b.stage !== "extracted" || t - b.since < 1);

  if (t - s.lastSale >= D.saleEvery) {
    s.lastSale = t;
    const sku = s.counters.sale % 3 === 2 ? "extract" : "flower";
    const stock = s.inventory[sku as "flower" | "extract"];
    if (stock > 0) {
      const units = Math.min(stock, 1 + (s.counters.sale % 3));
      const code = `SO-${String(++s.counters.order).padStart(4, "0")}`;
      s.counters.sale += 1;
      s.inventory[sku as "flower" | "extract"] -= units;
      const source = s.batches.find((b) => b.stage === "warehouse" && b.kind === sku);
      s.sales.unshift({ simAt: t, orderCode: code, sku, units, batch: source?.code ?? null });
      s.sales.length = Math.min(s.sales.length, 20);
      pushLog(s, "sale", "sales", source?.code ?? null, `${code}: sales sold ${units} ${sku} unit${units > 1 ? "s" : ""} from the warehouse.`);
    }
  }

  if (t - s.lastSample >= D.sampleEvery) {
    s.lastSample = t;
    for (const b of s.batches.filter((item) => ["growing", "drying", "curing", "extracting"].includes(item.stage) && item.room)) {
      const result = b.stress > 12 ? "flag" : "pass";
      s.samples.unshift({ simAt: t, room: b.room as string, batch: b.code, kind: b.stage, result, note: result === "flag" ? "stress logged" : "within spec" });
      if (result === "flag") pushLog(s, "sample", b.room, b.code, `R&D flagged ${b.code} in ${roomName(b.room as string)} (${b.stage}): stress above spec.`);
    }
    s.samples.length = Math.min(s.samples.length, 20);
  }
}

function plantStage(ageSeconds: number): LifecyclePlantStage {
  const days = ageSeconds / DAY;
  if (days < 3) return "clone";
  if (days < 14) return "veg";
  if (days < 19) return "flower";
  return "ripe";
}

export function mockLifecycleSnapshot(now: number): LifecycleSnapshot {
  if (!state) {
    state = init(now);
    exposeControls();
  }
  const s = state;
  const target = ((pausedAt ?? now) - s.startedAt) / 1000;
  for (let guard = 0; s.t < target && guard < 600; guard += 1) {
    s.t = Math.min(target, s.t + 0.5);
    tick(s);
  }
  const t = s.t;
  const growRoom = (room: (typeof GROW)[number]): LifecycleGrowRoom => {
    const r = s.rooms[room];
    const age = t - r.since;
    const growing = r.phase === "growing";
    const batch = s.batches.find((b) => b.code === r.batch);
    const dev = room === "grow3" ? null : { id: room, online: deviceOnline(room, t) };
    return {
      phase: r.phase,
      label: PHASE_LABEL[r.phase] ?? r.phase.toUpperCase(),
      progress: growing ? Math.min(1, age / D.grow) : 0,
      day: growing ? Math.floor(age / DAY) + 1 : 0,
      cycleDays: 21,
      plantStage: growing ? plantStage(age) : r.phase === "harvesting" ? "ripe" : null,
      growth: growing ? Math.min(1, age / D.grow) : 0,
      device: dev,
      cycles: r.cycles,
      batch: batch ? { code: batch.code, units: batch.units, stress: Math.round(batch.stress * 10) / 10 } : null,
    };
  };
  const lengths: Record<string, number> = { trimming: D.trim, extracting: D.extract, packaging: D.package, loading: D.load };
  const live = s.batches.filter((b) => !["growing", "lost", "sold", "extracted", "warehouse"].includes(b.stage));
  const ref = (b: MockBatch): LifecycleBatchRef => ({ code: b.code, stage: b.stage, kind: b.kind, units: b.units, quality: b.quality, progress: Math.min(1, (t - b.since) / (lengths[b.stage] ?? (b.stage === "curing" ? D.cure : D.dry))) });
  const dry = (room: string) => ({ online: true, capacity: 4, batches: live.filter((b) => b.room === room).map(ref) });
  const stageRoom = (room: string) => ({ batches: live.filter((b) => b.room === room).map(ref) });
  const planting = GROW.filter((room) => s.rooms[room].phase === "planting").length;
  const rows: LifecycleBatchRow[] = s.batches.filter((b) => !["lost", "sold", "extracted"].includes(b.stage)).map((b) => ({ code: b.code, kind: b.kind, stage: b.stage, room: b.room, units: b.units, quality: b.quality, stress: b.stress }));
  const mothers = active(s).map((m) => ({ code: m.code, source: m.source, ageDays: Math.round(((t - m.born) / DAY) * 10) / 10, progress: Math.min(1, (t - m.born) / D.motherLife) }));
  return {
    scale: 24,
    simDays: Math.round((t / DAY) * 100) / 100,
    simLabel: `MOCK DAY ${Math.floor(t / DAY) + 1} ${String(Math.floor(((t % DAY) / DAY) * 24)).padStart(2, "0")}:00`,
    durationsDays: {},
    rooms: {
      grow1: growRoom("grow1"),
      grow2: growRoom("grow2"),
      grow3: growRoom("grow3"),
      grow4: growRoom("grow4"),
      soil: dry("soil"),
      vmCreations: dry("vmCreations"),
      trim: stageRoom("trim"),
      pack: stageRoom("pack"),
      extract: stageRoom("extract"),
      dock: stageRoom("dock"),
      mother: { online: true, lifeDays: D.motherLife / DAY, mothers },
      clone: { online: true, cuttingsInTray: planting * PLANTS },
      warehouse: {
        batches: s.batches.filter((b) => b.stage === "warehouse").reverse().slice(0, 24).map((b) => ({ code: b.code, kind: b.kind, units: b.units, quality: b.quality })),
        inventory: { ...s.inventory },
      },
    },
    inventory: { ...s.inventory },
    log: s.log.slice(),
    samples: s.samples.slice(),
    sales: s.sales.slice(),
    batches: rows,
  };
}
