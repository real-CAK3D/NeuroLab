import { createLogger } from "../../../shared/logging/logger";
import { db } from "../database/db";
import { eventBus } from "../events/bus";

/*
 * NeuroLab crop lifecycle: a persistent, time-scaled pipeline that runs 24/7 in the backend.
 *
 *   grow room:  offline -> sterilize -> (device online) pots+soil -> plant clones -> grow 3 weeks -> harvest -> clean -> repeat
 *   batch:      harvest -> dry (1 wk) -> trim (1 wk each, one batch at a time) -> cure (2 wk, back in a dry room)
 *               -> package -> loading/catalog -> warehouse -> sold by sales
 *   extraction: some cured batches are extracted (2 d) -> extract is packaged -> loading -> warehouse
 *   R&D:        samples from growing rooms, drying/curing rooms and extraction every sim day
 *
 * Real telemetry drives it: a room only runs while its device is online. Time runs at NEUROLAB_TIME_SCALE x real time
 * (default 24: one real hour is one facility day, so a full grow-to-warehouse cycle takes about two real days).
 */

const logger = createLogger("neurolab-backend:lifecycle");

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const DURATIONS = {
  sterilize: 1 * DAY,
  prep: 0.75 * DAY,
  plant: 0.5 * DAY,
  grow: 21 * DAY,
  halfGrown: 7 * DAY,
  fullGrown: 14 * DAY,
  harvest: 0.5 * DAY,
  clean: 1 * DAY,
  dry: 7 * DAY,
  trim: 7 * DAY,
  cure: 14 * DAY,
  extract: 2 * DAY,
  package: 1 * DAY,
  load: 0.5 * DAY,
  offlineGrace: 6 * HOUR,
  cropFail: 3 * DAY,
  motherLife: 42 * DAY,
  noMotherRestock: 2 * DAY,
  saleEvery: 4 * HOUR,
  sampleEvery: 1 * DAY,
};

export const GROW_ROOMS = ["grow1", "grow2", "grow3", "grow4"] as const;
export const DRY_ROOMS = ["soil", "vmCreations"] as const; // THE GARDEN (Oracle VM) and CAK3D-CREATIONS
const DRY_CAPACITY = 4;
const PLANTS_PER_ROOM = 10;
const UNITS_PER_PLANT = 4;

// Which telemetry device powers which room (no device = the room stays dark and sterile).
const ROOM_DEVICE: Record<string, string | undefined> = {
  grow1: "the-bak3ry",
  grow2: "hack-safe",
  grow3: undefined,
  grow4: undefined,
  soil: "oracle-vm",
  vmCreations: "cak3d-creations",
  mother: "nukebox",
  clone: "hp-laptop",
};

export type LifecycleDevice = { id: string; online: boolean; cpuPercent?: number | null; memoryPercent?: number | null };

type RoomRow = { room: string; phase: string; phase_started: number; batch_id: number | null; offline_since: number | null; cycles: number };
type BatchRow = {
  id: number; code: string; kind: "flower" | "extract"; stage: string; room: string | null; stage_started: number;
  created_at: number; units: number; quality: number; stress: number; source_batch: number | null; extract_flag: number;
};

let ready = false;

export function initLifecycle() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lifecycle_rooms (room TEXT PRIMARY KEY, phase TEXT NOT NULL, phase_started REAL NOT NULL, batch_id INTEGER, offline_since REAL, cycles INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS lifecycle_batches (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, stage TEXT NOT NULL, room TEXT, stage_started REAL NOT NULL, created_at REAL NOT NULL, units INTEGER NOT NULL DEFAULT 0, quality REAL NOT NULL DEFAULT 100, stress REAL NOT NULL DEFAULT 0, source_batch INTEGER, extract_flag INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS lifecycle_log (id INTEGER PRIMARY KEY AUTOINCREMENT, sim_at REAL NOT NULL, real_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, kind TEXT NOT NULL, room TEXT, batch_code TEXT, message TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS lifecycle_samples (id INTEGER PRIMARY KEY AUTOINCREMENT, sim_at REAL NOT NULL, room TEXT NOT NULL, batch_code TEXT, kind TEXT NOT NULL, result TEXT NOT NULL, note TEXT);
    CREATE TABLE IF NOT EXISTS lifecycle_sales (id INTEGER PRIMARY KEY AUTOINCREMENT, sim_at REAL NOT NULL, order_code TEXT NOT NULL, sku TEXT NOT NULL, units INTEGER NOT NULL, batch_code TEXT);
    CREATE TABLE IF NOT EXISTS lifecycle_mothers (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, source TEXT NOT NULL, born_sim REAL NOT NULL, retired_sim REAL);
    CREATE TABLE IF NOT EXISTS lifecycle_inventory (sku TEXT PRIMARY KEY, units INTEGER NOT NULL DEFAULT 0);
  `);
  for (const sku of ["flower", "extract"]) db.prepare("INSERT OR IGNORE INTO lifecycle_inventory (sku, units) VALUES (?, 0)").run(sku);
  if (setting("lc_mothers_seeded") === undefined) {
    // Starting stock: staggered ages so the mothers do not all retire in the same week.
    const sim = simNow();
    ([["seed", 6], ["seed", 18], ["seed", 30], ["seed", 38]] as const).forEach(([source, age]) => {
      db.prepare("INSERT INTO lifecycle_mothers (code, source, born_sim) VALUES (?, ?, ?)").run(nextCode("M", "lc_mother_counter"), source, sim - age * DAY);
    });
    writeSetting("lc_mothers_seeded", "1");
  }
  ready = true;
}

function setting(key: string): string | undefined {
  return (db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)?.value;
}
function writeSetting(key: string, value: string) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

export function getTimeScale() {
  const stored = Number(setting("lc_scale"));
  const fromEnv = Number(process.env.NEUROLAB_TIME_SCALE);
  return Math.min(100_000, Math.max(1, stored || fromEnv || 24));
}
export function setTimeScale(scale: number) {
  writeSetting("lc_scale", String(Math.min(100_000, Math.max(1, Math.round(scale)))));
}

function simNow() {
  return Number(setting("lc_sim_ms") ?? "0");
}

function log(sim: number, kind: string, room: string | null, batchCode: string | null, message: string) {
  db.prepare("INSERT INTO lifecycle_log (sim_at, kind, room, batch_code, message) VALUES (?, ?, ?, ?, ?)").run(sim, kind, room, batchCode, message);
  db.prepare("DELETE FROM lifecycle_log WHERE id < (SELECT MAX(id) - 400 FROM lifecycle_log)").run();
  eventBus.publish({ type: "LIFECYCLE", message, entity_type: "lifecycle", payload: { kind, room, batch: batchCode } });
}

function getRoom(room: string, sim: number): RoomRow {
  let row = db.prepare("SELECT * FROM lifecycle_rooms WHERE room = ?").get(room) as RoomRow | undefined;
  if (!row) {
    // New rooms start dirty/idle: a room with no live device gets cleaned and sterilized, then waits.
    db.prepare("INSERT INTO lifecycle_rooms (room, phase, phase_started, offline_since) VALUES (?, 'idle', ?, ?)").run(room, sim, sim);
    row = db.prepare("SELECT * FROM lifecycle_rooms WHERE room = ?").get(room) as RoomRow;
  }
  return row;
}
function setPhase(room: string, phase: string, sim: number, batchId?: number | null) {
  if (batchId === undefined) db.prepare("UPDATE lifecycle_rooms SET phase = ?, phase_started = ? WHERE room = ?").run(phase, sim, room);
  else db.prepare("UPDATE lifecycle_rooms SET phase = ?, phase_started = ?, batch_id = ? WHERE room = ?").run(phase, sim, batchId, room);
}

function batchById(id: number | null | undefined) {
  return id == null ? undefined : (db.prepare("SELECT * FROM lifecycle_batches WHERE id = ?").get(id) as BatchRow | undefined);
}
function nextCode(prefix: string, counterKey: string) {
  const next = Number(setting(counterKey) ?? "0") + 1;
  writeSetting(counterKey, String(next));
  return `${prefix}-${String(next).padStart(4, "0")}`;
}
function moveBatch(batch: BatchRow, stage: string, room: string | null, sim: number) {
  db.prepare("UPDATE lifecycle_batches SET stage = ?, room = ?, stage_started = ? WHERE id = ?").run(stage, room, sim, batch.id);
}
function addInventory(sku: string, units: number) {
  db.prepare("UPDATE lifecycle_inventory SET units = units + ? WHERE sku = ?").run(units, sku);
}

type MotherRow = { id: number; code: string; source: string; born_sim: number; retired_sim: number | null };
function activeMothers(): MotherRow[] {
  return db.prepare("SELECT * FROM lifecycle_mothers WHERE retired_sim IS NULL ORDER BY born_sim").all() as MotherRow[];
}
function addMother(sim: number, source: string): MotherRow {
  const code = nextCode("M", "lc_mother_counter");
  db.prepare("INSERT INTO lifecycle_mothers (code, source, born_sim) VALUES (?, ?, ?)").run(code, source, sim);
  return db.prepare("SELECT * FROM lifecycle_mothers WHERE code = ?").get(code) as MotherRow;
}

// Mother plants live six weeks. A room that harvests while it has no mother of its own keeps one plant back to replace the lost one.
function stepMothers(sim: number): boolean {
  let changed = false;
  for (const mother of activeMothers()) {
    if (sim - mother.born_sim >= DURATIONS.motherLife) {
      db.prepare("UPDATE lifecycle_mothers SET retired_sim = ? WHERE id = ?").run(sim, mother.id);
      log(sim, "mother", "mother", mother.code, `Mother ${mother.code} is six weeks old and has been retired from the mother room.`);
      changed = true;
    }
  }
  if (activeMothers().length === 0) {
    const since = Number(setting("lc_no_mother_since") ?? "0") || (writeSetting("lc_no_mother_since", String(sim)), sim);
    if (sim - since >= DURATIONS.noMotherRestock) {
      const fresh = addMother(sim, "seed");
      writeSetting("lc_no_mother_since", "0");
      log(sim, "mother", "mother", fresh.code, `No mother plants left: a new mother ${fresh.code} was started from a seed pack.`);
      changed = true;
    }
  } else if (Number(setting("lc_no_mother_since") ?? "0")) writeSetting("lc_no_mother_since", "0");
  return changed;
}

function roomLabel(room: string) {
  return ({ soil: "THE GARDEN", vmCreations: "CAK3D-CREATIONS", trim: "PROCESS/TRIM", pack: "PACKAGING", extract: "EXTRACTION", dock: "LOADING", warehouse: "WAREHOUSE" } as Record<string, string>)[room] ?? room.replace("grow", "GROW ROOM ").toUpperCase();
}

export function stepLifecycle(sim: number, dtSim: number, devices: LifecycleDevice[]): boolean {
  const byId = new Map(devices.map((device) => [device.id, device]));
  const online = (room: string) => {
    const id = ROOM_DEVICE[room];
    return id ? byId.get(id)?.online === true : false;
  };
  const dtHours = dtSim / HOUR;
  let changed = stepMothers(sim);

  for (const room of GROW_ROOMS) {
    const row = getRoom(room, sim);
    const on = online(room);
    if (!on && row.offline_since == null) db.prepare("UPDATE lifecycle_rooms SET offline_since = ? WHERE room = ?").run(sim, room);
    if (on && row.offline_since != null) db.prepare("UPDATE lifecycle_rooms SET offline_since = NULL WHERE room = ?").run(room);
    const offFor = !on ? sim - (row.offline_since ?? sim) : 0;
    const age = sim - row.phase_started;
    const batch = batchById(row.batch_id);
    const dev = byId.get(ROOM_DEVICE[room] ?? "");

    switch (row.phase) {
      case "idle": // dirty or unknown; clean it out once it has been dark for a while, otherwise start up
        if (on) { setPhase(room, "prep", sim); log(sim, "room", room, null, `${roomLabel(room)} is online: staff bring pots and soil.`); changed = true; }
        else if (offFor >= DURATIONS.offlineGrace) { setPhase(room, "sterilizing", sim); log(sim, "room", room, null, `${roomLabel(room)} has been dark a while: clearing it out and sterilizing.`); changed = true; }
        break;
      case "sterilizing":
        if (age >= DURATIONS.sterilize) { setPhase(room, "sterile", sim); log(sim, "room", room, null, `${roomLabel(room)} sterilized and sealed, waiting for its device.`); changed = true; }
        break;
      case "sterile":
        if (on) { setPhase(room, "prep", sim); log(sim, "room", room, null, `${roomLabel(room)} powered up: bringing in pots and soil.`); changed = true; }
        break;
      case "prep":
        if (!on && offFor >= DURATIONS.offlineGrace) { setPhase(room, "idle", sim); changed = true; }
        else if (on && age >= DURATIONS.prep) { setPhase(room, "planting", sim); log(sim, "room", room, null, `${roomLabel(room)} potted with soil: taking clones from the mother plants.`); changed = true; }
        break;
      case "planting":
        if (!on && offFor >= DURATIONS.offlineGrace) { setPhase(room, "idle", sim); changed = true; }
        else if (on && online("mother") && activeMothers().length > 0 && age >= DURATIONS.plant) {
          const mothers = activeMothers();
          const donor = mothers[Number(setting("lc_mother_rr") ?? "0") % mothers.length];
          writeSetting("lc_mother_rr", String(Number(setting("lc_mother_rr") ?? "0") + 1));
          const code = nextCode("B", "lc_batch_counter");
          const id = Number(db.prepare("INSERT INTO lifecycle_batches (code, kind, stage, room, stage_started, created_at, units) VALUES (?, 'flower', 'growing', ?, ?, ?, ?)").run(code, room, sim, sim, PLANTS_PER_ROOM).lastInsertRowid);
          setPhase(room, "growing", sim, id);
          log(sim, "plant", room, code, `${code}: ${PLANTS_PER_ROOM} clones cut from mother ${donor.code} and planted in ${roomLabel(room)}.`);
          changed = true;
        }
        break;
      case "growing": {
        if (batch) {
          let stress = 0;
          if (!on) stress = dtHours * 2;
          else if ((dev?.cpuPercent ?? 0) > 85 || (dev?.memoryPercent ?? 0) > 92) stress = dtHours;
          if (stress > 0) db.prepare("UPDATE lifecycle_batches SET stress = stress + ? WHERE id = ?").run(stress, batch.id);
        }
        if (!on && offFor >= DURATIONS.cropFail) {
          if (batch) { moveBatch(batch, "lost", null, sim); log(sim, "loss", room, batch.code, `${batch.code} lost: ${roomLabel(room)} was dark too long. Room will be cleared and sterilized.`); }
          setPhase(room, "sterilizing", sim, null);
          changed = true;
        } else if (age >= DURATIONS.grow) { setPhase(room, "harvesting", sim); if (batch) log(sim, "harvest", room, batch.code, `${batch.code} is ripe: harvest underway in ${roomLabel(room)}.`); changed = true; }
        break;
      }
      case "harvesting":
        if (age >= DURATIONS.harvest && batch) {
          const dry = DRY_ROOMS.find((candidate) => online(candidate) && dryCount(candidate) < DRY_CAPACITY);
          if (dry) {
            const quality = Math.max(40, Math.min(100, Math.round(100 - batch.stress * 1.5)));
            let plants = PLANTS_PER_ROOM;
            if (!activeMothers().some((mother) => mother.source === room)) {
              const mother = addMother(sim, room);
              plants -= 1;
              log(sim, "mother", room, mother.code, `One plant from ${roomLabel(room)} was kept back as the new mother ${mother.code}.`);
            }
            const units = Math.max(4, Math.round(plants * UNITS_PER_PLANT * (quality / 100)));
            db.prepare("UPDATE lifecycle_batches SET quality = ?, units = ? WHERE id = ?").run(quality, units, batch.id);
            moveBatch(batch, "drying", dry, sim);
            log(sim, "harvest", room, batch.code, `${batch.code} harvested (quality ${quality}%): hung to dry in ${roomLabel(dry)}.`);
            setPhase(room, "cleaning", sim, null);
            db.prepare("UPDATE lifecycle_rooms SET cycles = cycles + 1 WHERE room = ?").run(room);
            changed = true;
          }
        }
        break;
      case "cleaning":
        if (age >= DURATIONS.clean) { setPhase(room, on ? "prep" : "idle", sim); log(sim, "room", room, null, `${roomLabel(room)} cleaned${on ? ": next crop prep starts" : ", but the device is offline"}.`); changed = true; }
        break;
      default:
        setPhase(room, "idle", sim);
    }
  }

  changed = stepBatches(sim, online) || changed;
  changed = stepSales(sim) || changed;
  changed = stepSamples(sim) || changed;
  return changed;
}

function dryCount(room: string) {
  return (db.prepare("SELECT COUNT(*) AS n FROM lifecycle_batches WHERE room = ? AND stage IN ('drying','curing')").get(room) as { n: number }).n;
}

function stepBatches(sim: number, online: (room: string) => boolean): boolean {
  let changed = false;
  const batches = db.prepare("SELECT * FROM lifecycle_batches WHERE stage NOT IN ('growing','lost','sold','extracted') ORDER BY id").all() as BatchRow[];
  const busy = (stage: string) => batches.some((b) => b.stage === stage);
  for (const b of batches) {
    const age = sim - b.stage_started;
    switch (b.stage) {
      case "drying":
        if (age >= DURATIONS.dry) { moveBatch(b, "trim-queue", "trim", sim); log(sim, "batch", "trim", b.code, `${b.code} is dry: queued for trimming.`); changed = true; }
        break;
      case "trim-queue":
        if (!busy("trimming")) { moveBatch(b, "trimming", "trim", sim); b.stage = "trimming"; log(sim, "batch", "trim", b.code, `${b.code}: trimming started (one week per batch).`); changed = true; }
        break;
      case "trimming":
        if (age >= DURATIONS.trim) { moveBatch(b, "cure-queue", "trim", sim); log(sim, "batch", "trim", b.code, `${b.code} trimmed: going back to a dry room to cure.`); changed = true; }
        break;
      case "cure-queue": {
        const room = DRY_ROOMS.find((candidate) => online(candidate) && dryCount(candidate) < DRY_CAPACITY);
        if (room) { moveBatch(b, "curing", room, sim); log(sim, "batch", room, b.code, `${b.code} is curing in ${roomLabel(room)} (two weeks).`); changed = true; }
        break;
      }
      case "curing":
        if (age >= DURATIONS.cure) {
          const extract = b.id % 3 === 0 ? 1 : 0;
          db.prepare("UPDATE lifecycle_batches SET extract_flag = ? WHERE id = ?").run(extract, b.id);
          moveBatch(b, extract ? "extract-queue" : "packaging", extract ? "extract" : "pack", sim);
          log(sim, "batch", extract ? "extract" : "pack", b.code, `${b.code} is cured: ${extract ? "headed to the extraction lab" : "headed to packaging"}.`);
          changed = true;
        }
        break;
      case "extract-queue":
        if (!busy("extracting")) { moveBatch(b, "extracting", "extract", sim); b.stage = "extracting"; log(sim, "batch", "extract", b.code, `${b.code}: extraction run started.`); changed = true; }
        break;
      case "extracting":
        if (age >= DURATIONS.extract) {
          const code = nextCode("X", "lc_extract_counter");
          const units = Math.max(2, Math.floor(b.units * 0.3));
          db.prepare("INSERT INTO lifecycle_batches (code, kind, stage, room, stage_started, created_at, units, quality, stress, source_batch) VALUES (?, 'extract', 'packaging', 'pack', ?, ?, ?, ?, 0, ?)").run(code, sim, sim, units, b.quality, b.id);
          moveBatch(b, "extracted", null, sim);
          log(sim, "batch", "extract", code, `${code}: ${units} units of extract from ${b.code}, sent to packaging.`);
          changed = true;
        }
        break;
      case "packaging":
        if (age >= DURATIONS.package) { moveBatch(b, "loading", "dock", sim); log(sim, "batch", "dock", b.code, `${b.code} packaged (${b.units} units): moved to the loading bay for cataloging.`); changed = true; }
        break;
      case "loading":
        if (age >= DURATIONS.load) {
          moveBatch(b, "warehouse", "warehouse", sim);
          addInventory(b.kind, b.units);
          log(sim, "batch", "warehouse", b.code, `${b.code} cataloged and shelved in the warehouse (${b.units} ${b.kind} units).`);
          changed = true;
        }
        break;
      default:
        break;
    }
  }
  return changed;
}

function stepSales(sim: number): boolean {
  const last = Number(setting("lc_last_sale") ?? "0");
  if (sim - last < DURATIONS.saleEvery) return false;
  writeSetting("lc_last_sale", String(sim));
  const counter = Number(setting("lc_sale_counter") ?? "0");
  const sku = counter % 3 === 2 ? "extract" : "flower";
  const stock = (db.prepare("SELECT units FROM lifecycle_inventory WHERE sku = ?").get(sku) as { units: number }).units;
  if (stock <= 0) return false;
  const units = Math.min(stock, 1 + (counter % 3));
  const code = nextCode("SO", "lc_order_counter");
  writeSetting("lc_sale_counter", String(counter + 1));
  const source = db.prepare("SELECT code FROM lifecycle_batches WHERE stage = 'warehouse' AND kind = ? ORDER BY id LIMIT 1").get(sku) as { code: string } | undefined;
  db.prepare("UPDATE lifecycle_inventory SET units = units - ? WHERE sku = ?").run(units, sku);
  db.prepare("INSERT INTO lifecycle_sales (sim_at, order_code, sku, units, batch_code) VALUES (?, ?, ?, ?, ?)").run(sim, code, sku, units, source?.code ?? null);
  db.prepare("DELETE FROM lifecycle_sales WHERE id < (SELECT MAX(id) - 200 FROM lifecycle_sales)").run();
  log(sim, "sale", "sales", source?.code ?? null, `${code}: sales sold ${units} ${sku} unit${units > 1 ? "s" : ""} from the warehouse.`);
  return true;
}

function stepSamples(sim: number): boolean {
  const last = Number(setting("lc_last_sample") ?? "0");
  if (sim - last < DURATIONS.sampleEvery) return false;
  writeSetting("lc_last_sample", String(sim));
  const active = db.prepare("SELECT * FROM lifecycle_batches WHERE stage IN ('growing','drying','curing','extracting')").all() as BatchRow[];
  let any = false;
  for (const b of active) {
    if (!b.room) continue;
    const result = b.stress > 12 ? "flag" : "pass";
    db.prepare("INSERT INTO lifecycle_samples (sim_at, room, batch_code, kind, result, note) VALUES (?, ?, ?, ?, ?, ?)").run(sim, b.room, b.code, b.stage, result, result === "flag" ? `stress ${b.stress.toFixed(1)}h logged` : "within spec");
    if (result === "flag") log(sim, "sample", b.room, b.code, `R&D flagged ${b.code} in ${roomLabel(b.room)} (${b.stage}): stress above spec.`);
    any = true;
  }
  db.prepare("DELETE FROM lifecycle_samples WHERE id < (SELECT MAX(id) - 300 FROM lifecycle_samples)").run();
  return any;
}

const STAGE_LENGTH: Record<string, number> = { trimming: DURATIONS.trim, extracting: DURATIONS.extract, packaging: DURATIONS.package, loading: DURATIONS.load };

const PHASE_LABEL: Record<string, string> = {
  idle: "OFFLINE", sterilizing: "STERILIZING", sterile: "STERILE", prep: "POTS + SOIL", planting: "PLANTING CLONES",
  growing: "GROWING", harvesting: "HARVEST", cleaning: "CLEANING",
};

function plantStage(age: number) {
  if (age < 3 * DAY) return "clone";
  if (age < DURATIONS.fullGrown) return "veg";
  if (age < 19 * DAY) return "flower";
  return "ripe";
}

export function getLifecycleSnapshot(devices: LifecycleDevice[] = []) {
  if (!ready) initLifecycle();
  const sim = simNow();
  const byId = new Map(devices.map((device) => [device.id, device]));
  const rooms: Record<string, unknown> = {};
  for (const room of GROW_ROOMS) {
    const row = getRoom(room, sim);
    const batch = batchById(row.batch_id);
    const age = sim - row.phase_started;
    const growing = row.phase === "growing";
    const device = ROOM_DEVICE[room];
    rooms[room] = {
      phase: row.phase,
      label: PHASE_LABEL[row.phase] ?? row.phase.toUpperCase(),
      progress: growing ? Math.min(1, age / DURATIONS.grow) : 0,
      day: growing ? Math.floor(age / DAY) + 1 : 0,
      cycleDays: DURATIONS.grow / DAY,
      plantStage: growing ? plantStage(age) : row.phase === "harvesting" ? "ripe" : null,
      growth: growing ? Math.min(1, age / DURATIONS.grow) : 0,
      device: device ? { id: device, online: byId.get(device)?.online === true } : null,
      cycles: row.cycles,
      batch: batch ? { code: batch.code, units: batch.units, stress: Math.round(batch.stress * 10) / 10 } : null,
    };
  }
  const stageRows = db.prepare("SELECT * FROM lifecycle_batches WHERE stage NOT IN ('growing','lost','sold','extracted','warehouse') ORDER BY id").all() as BatchRow[];
  for (const room of DRY_ROOMS) {
    const mine = stageRows.filter((b) => b.room === room);
    rooms[room] = {
      online: byId.get(ROOM_DEVICE[room] ?? "")?.online === true,
      capacity: DRY_CAPACITY,
      batches: mine.map((b) => ({ code: b.code, stage: b.stage, progress: Math.min(1, (sim - b.stage_started) / (b.stage === "curing" ? DURATIONS.cure : DURATIONS.dry)), units: b.units, quality: b.quality })),
    };
  }
  for (const room of ["trim", "pack", "extract", "dock"]) {
    rooms[room] = {
      batches: stageRows
        .filter((b) => b.room === room)
        .map((b) => ({ code: b.code, stage: b.stage, kind: b.kind, units: b.units, progress: Math.min(1, (sim - b.stage_started) / (STAGE_LENGTH[b.stage] ?? DAY)) })),
    };
  }
  const plantingRooms = GROW_ROOMS.filter((room) => getRoom(room, sim).phase === "planting").length;
  rooms.mother = {
    online: byId.get("nukebox")?.online === true,
    lifeDays: DURATIONS.motherLife / DAY,
    mothers: activeMothers().map((m) => ({ code: m.code, source: m.source, ageDays: Math.round(((sim - m.born_sim) / DAY) * 10) / 10, progress: Math.min(1, (sim - m.born_sim) / DURATIONS.motherLife) })),
  };
  rooms.clone = { online: byId.get("hp-laptop")?.online === true, cuttingsInTray: plantingRooms * PLANTS_PER_ROOM };
  const inventory = Object.fromEntries((db.prepare("SELECT sku, units FROM lifecycle_inventory").all() as Array<{ sku: string; units: number }>).map((row) => [row.sku, row.units]));
  const warehouse = db.prepare("SELECT code, kind, units, quality FROM lifecycle_batches WHERE stage = 'warehouse' ORDER BY id DESC LIMIT 24").all();
  rooms.warehouse = { batches: warehouse, inventory };
  return {
    scale: getTimeScale(),
    simDays: Math.round((sim / DAY) * 100) / 100,
    simLabel: `DAY ${Math.floor(sim / DAY) + 1} ${String(Math.floor((sim % DAY) / HOUR)).padStart(2, "0")}:00`,
    durationsDays: Object.fromEntries(Object.entries(DURATIONS).map(([key, value]) => [key, Math.round((value / DAY) * 100) / 100])),
    rooms,
    inventory,
    log: db.prepare("SELECT sim_at AS simAt, real_at AS realAt, kind, room, batch_code AS batch, message FROM lifecycle_log ORDER BY id DESC LIMIT 40").all(),
    samples: db.prepare("SELECT sim_at AS simAt, room, batch_code AS batch, kind, result, note FROM lifecycle_samples ORDER BY id DESC LIMIT 20").all(),
    sales: db.prepare("SELECT sim_at AS simAt, order_code AS orderCode, sku, units, batch_code AS batch FROM lifecycle_sales ORDER BY id DESC LIMIT 20").all(),
    batches: db.prepare("SELECT code, kind, stage, room, units, quality, stress FROM lifecycle_batches WHERE stage NOT IN ('lost','sold','extracted') ORDER BY id DESC LIMIT 40").all(),
  };
}

export function startLifecycle(getDevices: () => Promise<LifecycleDevice[]>) {
  initLifecycle();
  let busy = false;
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const now = Date.now();
      const lastReal = Number(setting("lc_last_real") ?? String(now));
      const scale = getTimeScale();
      // Cap catch-up after downtime so a long outage does not fast-forward weeks of crop time.
      const realDelta = Math.min(now - lastReal, 10 * 60_000);
      const dtSim = realDelta * scale;
      const sim = simNow() + dtSim;
      writeSetting("lc_sim_ms", String(sim));
      writeSetting("lc_last_real", String(now));
      const devices = await getDevices();
      for (let pass = 0; pass < 20; pass += 1) if (!stepLifecycle(sim, pass === 0 ? dtSim : 0, devices)) break;
    } catch (error) {
      logger.error({ error }, "lifecycle tick failed");
    } finally {
      busy = false;
    }
  }
  setTimeout(tick, 20_000);
  setInterval(tick, 15_000);
}
