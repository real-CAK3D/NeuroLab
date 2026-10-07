import { gen2Props, type Gen2Prop } from "./gen2FacilityData";
import { gen2Hash01 } from "./gen2OperationsData";
import type { LifecycleBatchRef, LifecycleGrowRoom, LifecyclePlantStage, LifecycleSnapshot } from "../utils/api";

/*
 * Pure helpers that turn a backend lifecycle snapshot (GET /api/lifecycle) into what the facility shows:
 * plant/pot looks, rack and crate contents, room vitals, and the one-shot / state-driven worker tasks.
 * Nothing in here touches React or the DOM.
 */

export const LIFE_GROW_ROOMS = ["grow1", "grow2", "grow3", "grow4"] as const;
export const LIFE_DRY_ROOMS = ["soil", "vmCreations"] as const;
const MOTHER_SLOTS = 12;
const RACK_SLOTS = 4;
const WAREHOUSE_SLOTS = 18; // 10 crates + 8 shelves

export const LIFE_ROOM_NAMES: Record<string, string> = {
  grow1: "GROW ROOM 1", grow2: "GROW ROOM 2", grow3: "GROW ROOM 3", grow4: "GROW ROOM 4",
  soil: "THE GARDEN", vmCreations: "CAK3D-CREATIONS", trim: "PROCESS/TRIM", pack: "PACKAGING", extract: "EXTRACTION",
  dock: "LOADING", warehouse: "WAREHOUSE", mother: "MOTHER ROOM", clone: "CLONE ROOM", sales: "SALES OFFICE",
};

const STAGE_LABEL: Record<string, string> = {
  growing: "GROWING", drying: "DRYING", "trim-queue": "TRIM QUEUE", trimming: "TRIMMING", "cure-queue": "WAIT CURE", curing: "CURING",
  "extract-queue": "WAIT EXTRACT", extracting: "EXTRACTING", packaging: "PACKAGING", loading: "LOADING", warehouse: "SHELVED",
};

export type LifeState = {
  snap: LifecycleSnapshot;
  receivedAt: number;
  mock: boolean;
  /** Epoch ms at which this browser first saw each grow room in its current phase (drives planting / harvest animations). */
  phaseSince: Record<string, number>;
  motherSlots: Array<string | undefined>;
  rackSlots: Record<string, Array<string | undefined>>;
  warehouseSlots: Array<string | undefined>;
};

export function isLifecycleSnapshot(value: unknown): value is LifecycleSnapshot {
  const snap = value as LifecycleSnapshot | undefined;
  return !!snap && typeof snap === "object" && !!snap.rooms && !!snap.rooms.grow1 && !!snap.rooms.mother && Array.isArray(snap.log) && Array.isArray(snap.batches);
}

/** Keeps every code on the slot it already had; new codes take the first free slot, vanished codes free theirs. */
export function assignSlots(prev: Array<string | undefined> | undefined, codes: string[], size: number): Array<string | undefined> {
  const next: Array<string | undefined> = new Array(size).fill(undefined);
  const wanted = new Set(codes);
  (prev ?? []).forEach((code, index) => {
    if (code && wanted.has(code) && index < size) next[index] = code;
  });
  const placed = new Set(next.filter(Boolean));
  for (const code of codes) {
    if (placed.has(code)) continue;
    const free = next.indexOf(undefined);
    if (free < 0) break;
    next[free] = code;
    placed.add(code);
  }
  return next;
}

export function reduceLifeState(prev: LifeState | undefined, snap: LifecycleSnapshot, now: number, mock: boolean): LifeState {
  const phaseSince: Record<string, number> = {};
  for (const room of LIFE_GROW_ROOMS) {
    const phase = snap.rooms[room]?.phase;
    phaseSince[room] = prev && prev.snap.rooms[room]?.phase === phase && prev.phaseSince[room] ? prev.phaseSince[room] : now;
  }
  const rackSlots: Record<string, Array<string | undefined>> = {};
  for (const room of LIFE_DRY_ROOMS) {
    const codes = [...(snap.rooms[room]?.batches ?? [])].map((batch) => batch.code).sort();
    rackSlots[room] = assignSlots(prev?.rackSlots[room], codes, RACK_SLOTS);
  }
  return {
    snap,
    receivedAt: now,
    mock,
    phaseSince,
    motherSlots: assignSlots(prev?.motherSlots, snap.rooms.mother.mothers.map((mother) => mother.code), MOTHER_SLOTS),
    rackSlots,
    warehouseSlots: assignSlots(prev?.warehouseSlots, snap.rooms.warehouse.batches.map((batch) => batch.code), WAREHOUSE_SLOTS),
  };
}

// ---------------------------------------------------------------------------
// Prop slots
// ---------------------------------------------------------------------------

let indexCache: WeakMap<Gen2Prop, number> | undefined;

/** Position of a prop among the props of the same kind in the same room (declaration order). */
function propIndex(prop: Gen2Prop) {
  if (!indexCache) {
    indexCache = new WeakMap();
    const counts = new Map<string, number>();
    for (const item of gen2Props) {
      const key = `${item.room}:${item.kind}`;
      const index = counts.get(key) ?? 0;
      indexCache.set(item, index);
      counts.set(key, index + 1);
    }
  }
  return indexCache.get(prop) ?? 0;
}

export function lifeRoomProps(room: string, kind: Gen2Prop["kind"]) {
  return gen2Props.filter((prop) => prop.room === room && prop.kind === kind);
}

const pct = (value: number | undefined) => `${Math.round(Math.max(0, Math.min(1, value ?? 0)) * 100)}%`;
const isGrow = (room: string): room is (typeof LIFE_GROW_ROOMS)[number] => (LIFE_GROW_ROOMS as readonly string[]).includes(room);
const isDry = (room: string): room is (typeof LIFE_DRY_ROOMS)[number] => (LIFE_DRY_ROOMS as readonly string[]).includes(room);

function growLabel(room: LifecycleGrowRoom) {
  if (room.phase !== "growing") return room.label;
  const stage = room.plantStage;
  const word = stage === "clone" ? "CLONES" : stage === "veg" ? (room.day >= 8 ? "HALF GROWN" : "VEGGING") : stage === "flower" ? "FLOWERING" : "RIPE";
  return `DAY ${room.day}/${room.cycleDays} ${word}`;
}

// ---------------------------------------------------------------------------
// Per-prop looks
// ---------------------------------------------------------------------------

export type LifeSelection = { type: "plant" | "equipment" | "room"; title: string; lines: string[] };
export type LifeProp = {
  /** Plant sprite stage override. */
  stage?: LifecyclePlantStage;
  classes: string;
  style?: Record<string, string | number>;
  /** Short text drawn on racks and crates (CSS attr(data-tag)). */
  tag?: string;
  selection?: LifeSelection;
  /** The lifecycle owns this plant's look (skip the room-status stress / offline tint). */
  ownsLook?: boolean;
  /** The lifecycle owns this prop's work animation (skip the demo production pulse). */
  ownsProduction?: boolean;
};

function batchLines(batch: LifecycleBatchRef | undefined, extra: string[] = []) {
  if (!batch) return ["EMPTY"];
  return [`BATCH: ${batch.code}`, `KIND: ${(batch.kind ?? "flower").toUpperCase()}`, `STAGE: ${STAGE_LABEL[batch.stage] ?? batch.stage.toUpperCase()}`, `UNITS: ${batch.units}`, `QUALITY: ${batch.quality ?? "--"}%`, ...(batch.progress !== undefined ? [`PROGRESS: ${pct(batch.progress)}`] : []), ...extra];
}

export function lifePropState(prop: Gen2Prop, life: LifeState | undefined, now: number): LifeProp | undefined {
  if (!life || !prop.room) return undefined;
  const snap = life.snap;
  const room = prop.room;
  const index = propIndex(prop);

  if (prop.kind === "plantBed" && isGrow(room)) return growPot(prop, room, index, life, now);

  if (prop.kind === "plantBed" && room === "mother") {
    const code = life.motherSlots[index];
    const mother = snap.rooms.mother.mothers.find((item) => item.code === code);
    if (!mother) return { classes: "is-open-pot life-open life-soil", ownsLook: true, selection: { type: "plant", title: "EMPTY MOTHER POT", lines: ["STATUS: WAITING FOR A PROMOTED CLONE", `MOTHERS: ${snap.rooms.mother.mothers.length} OF ${MOTHER_SLOTS} POTS`] } };
    const old = mother.progress > 0.88;
    const stage: LifecyclePlantStage = mother.progress < 0.1 ? "clone" : "veg";
    const grow = mother.progress < 0.1 ? 0.7 : 0.72 + 0.38 * Math.min(1, mother.progress / 0.8);
    return {
      stage,
      classes: `life-mother ${old ? "is-stressed-plant" : ""} ${snap.rooms.mother.online ? "" : "is-device-offline"}`,
      style: { "--grow": grow.toFixed(2) },
      ownsLook: true,
      selection: { type: "plant", title: `MOTHER ${mother.code}`, lines: [`AGE: ${mother.ageDays} OF ${snap.rooms.mother.lifeDays} DAYS`, `SOURCE: ${mother.source === "seed" ? "SEED PACK" : (LIFE_ROOM_NAMES[mother.source] ?? mother.source.toUpperCase())}`, `LIFE LEFT: ${pct(1 - mother.progress)}`, old ? "STATUS: RETIRING SOON" : "STATUS: HEALTHY", "JOB: DONATES CLONES"] },
    };
  }

  if (prop.kind === "tray" && room === "clone") {
    const cuttings = snap.rooms.clone.cuttingsInTray;
    const filled = Math.min(8, Math.ceil(cuttings / 2.5));
    if (index >= filled) return { classes: "is-open-pot life-open life-empty-tray", ownsLook: true, selection: { type: "plant", title: "CLONE TRAY", lines: ["STATUS: EMPTY", "CUTTINGS ARE CUT WHEN A GROW ROOM IS PLANTING"] } };
    return { stage: "clone", classes: snap.rooms.clone.online ? "" : "is-device-offline", style: { "--grow": 0.8 }, ownsLook: true, selection: { type: "plant", title: "CLONE TRAY", lines: [`CUTTINGS IN TRAYS: ${cuttings}`, "STATUS: ROOTED, READY TO PLANT", "DESTINATION: ROOMS IN PLANTING"] } };
  }

  if (isDry(room)) {
    const dry = snap.rooms[room];
    if (prop.kind !== "dryRack" && prop.kind !== "cutPlant") return undefined;
    const code = life.rackSlots[room]?.[index];
    const batch = dry.batches.find((item) => item.code === code);
    const selection: LifeSelection = {
      type: "equipment",
      title: batch ? `${batch.code} ${batch.stage === "curing" ? "CURING" : "DRYING"} RACK` : `${LIFE_ROOM_NAMES[room]} RACK ${index + 1}`,
      lines: batch ? batchLines(batch, [`ROOM: ${LIFE_ROOM_NAMES[room]}`, `RACKS FREE: ${dry.capacity - dry.batches.length} OF ${dry.capacity}`]) : ["EMPTY RACK", `ROOM: ${LIFE_ROOM_NAMES[room]}`, `RACKS FREE: ${dry.capacity - dry.batches.length} OF ${dry.capacity}`],
    };
    if (prop.kind === "dryRack") {
      return {
        classes: batch ? `life-rack life-occupied life-${batch.stage}` : "life-rack",
        style: batch ? { "--prog": pct(batch.progress) } : undefined,
        tag: batch ? `${batch.code} ${batch.stage === "curing" ? "CURE" : "DRY"} ${pct(batch.progress)}` : undefined,
        selection,
        ownsProduction: true,
      };
    }
    if (!batch) return { classes: "life-hidden", ownsProduction: true, selection };
    return { classes: batch.stage === "curing" ? "life-cure" : "is-drying-active", ownsProduction: true, selection };
  }

  if (room === "trim") {
    const trimming = snap.rooms.trim.batches.find((item) => item.stage === "trimming");
    const queued = snap.rooms.trim.batches.filter((item) => item.stage === "trim-queue" || item.stage === "cure-queue");
    const selection: LifeSelection = {
      type: "equipment",
      title: "TRIM STATION",
      lines: [trimming ? `NOW: ${trimming.code} ${pct(trimming.progress)} (${trimming.units}U)` : "NOW: NO BATCH ON THE TABLES", `QUEUE: ${queued.length ? queued.map((item) => item.code).join(", ") : "EMPTY"}`],
    };
    if (prop.kind === "cutPlant") {
      const onTable = index < 2;
      const show = onTable ? !!trimming : queued.length > index - 2;
      return { classes: show ? (onTable ? "is-trim-active" : "") : "life-hidden", ownsProduction: true, selection };
    }
    if (prop.kind === "trimTable" || prop.kind === "rack") return { classes: trimming && prop.kind === "trimTable" ? "life-working" : "", selection, ownsProduction: true };
    return undefined;
  }

  if (room === "pack") {
    const packing = snap.rooms.pack.batches.find((item) => item.stage === "packaging");
    if (prop.kind === "conveyor") return { classes: packing ? "is-package-active" : "", ownsProduction: true, selection: { type: "equipment", title: "PACK LINE", lines: packing ? batchLines(packing) : ["STATUS: IDLE", "WAITING FOR A CURED BATCH"] } };
    if (prop.kind === "crate") {
      const filled = !!packing && index < Math.max(1, Math.ceil((packing.progress ?? 0) * 9));
      return { classes: `life-crate ${filled ? "life-filled is-package-active" : "life-empty"}`, tag: filled && index === 0 ? packing?.code : undefined, ownsProduction: true, selection: { type: "equipment", title: "PACKAGING CRATE", lines: filled ? batchLines(packing) : ["EMPTY CRATE"] } };
    }
    return undefined;
  }

  if (room === "extract") {
    const run = snap.rooms.extract.batches.find((item) => item.stage === "extracting");
    const waiting = snap.rooms.extract.batches.filter((item) => item.stage === "extract-queue");
    if (prop.kind === "vat" || prop.kind === "machine" || prop.kind === "crate") {
      return { classes: `${run && prop.kind !== "crate" ? "is-package-active" : ""} ${prop.kind === "crate" ? (run || waiting.length ? "life-crate life-filled" : "life-crate life-empty") : ""}`, ownsProduction: true, selection: { type: "equipment", title: "EXTRACTION", lines: run ? batchLines(run, [`WAITING: ${waiting.length}`]) : ["STATUS: IDLE", `WAITING: ${waiting.map((item) => item.code).join(", ") || "NONE"}`] } };
    }
    return undefined;
  }

  if (room === "dock" && prop.kind === "crate") {
    const batch = snap.rooms.dock.batches[Math.floor(index / 3)];
    return { classes: `life-crate ${batch ? "life-filled is-delivery-active" : "life-empty"} ${batch?.kind === "extract" ? "life-kind-extract" : ""}`, tag: batch && index % 3 === 0 ? batch.code : undefined, ownsProduction: true, selection: { type: "equipment", title: "LOADING CRATE", lines: batchLines(batch) } };
  }

  if (room === "warehouse" && (prop.kind === "crate" || prop.kind === "shelf")) {
    const slot = prop.kind === "crate" ? index : 10 + index;
    const code = life.warehouseSlots[slot];
    const batch = snap.rooms.warehouse.batches.find((item) => item.code === code);
    const inv = snap.rooms.warehouse.inventory;
    return {
      classes: `${prop.kind === "crate" ? "life-crate" : "life-shelf"} ${batch ? "life-filled" : "life-empty"} ${batch?.kind === "extract" ? "life-kind-extract" : ""}`,
      tag: batch ? batch.code : undefined,
      ownsProduction: true,
      selection: {
        type: "equipment",
        title: batch ? `${batch.code} STOCK` : prop.kind === "crate" ? "EMPTY CRATE" : "EMPTY SHELF",
        lines: batch ? [`BATCH: ${batch.code}`, `KIND: ${batch.kind.toUpperCase()}`, `UNITS: ${batch.units}`, `QUALITY: ${batch.quality}%`, `WAREHOUSE: FLOWER ${inv.flower} / EXTRACT ${inv.extract}`] : [`WAREHOUSE: FLOWER ${inv.flower} / EXTRACT ${inv.extract}`, `BATCHES SHELVED: ${snap.rooms.warehouse.batches.length}`],
      },
    };
  }

  if (room === "sales" && (prop.kind === "display" || prop.kind === "shelf")) {
    const sale = snap.sales[0];
    return { classes: "", selection: { type: "equipment", title: "SALES STOCK", lines: [`FLOWER: ${snap.inventory.flower} UNITS`, `EXTRACT: ${snap.inventory.extract} UNITS`, sale ? `LAST: ${sale.orderCode} ${sale.units} ${sale.sku.toUpperCase()}` : "LAST: NO ORDERS YET"] } };
  }

  return undefined;
}

function growPot(prop: Gen2Prop, room: (typeof LIFE_GROW_ROOMS)[number], index: number, life: LifeState, now: number): LifeProp {
  const r = life.snap.rooms[room];
  const seconds = (now - (life.phaseSince[room] ?? now)) / 1000;
  const jitter = 0.94 + gen2Hash01(`${prop.x},${prop.y}`, "grow") * 0.12;
  const online = r.device?.online === true;
  const stress = r.batch?.stress ?? 0;
  const label = LIFE_ROOM_NAMES[room];
  const base = (title: string, lines: string[]): LifeSelection => ({ type: "plant", title, lines: [`ROOM: ${label}`, `PHASE: ${r.label}`, ...lines] });
  switch (r.phase) {
    case "idle":
      return { classes: "is-open-pot life-open life-dim", ownsLook: true, selection: base("EMPTY POT", ["STATUS: ROOM OFFLINE, NOTHING PLANTED"]) };
    case "sterilizing":
    case "cleaning":
      return { classes: "is-open-pot life-open life-sterile life-spraying", ownsLook: true, selection: base("EMPTY POT", [`STATUS: ${r.phase === "cleaning" ? "BEING CLEANED" : "BEING STERILIZED"}`]) };
    case "sterile":
      return { classes: "is-open-pot life-open life-sterile", ownsLook: true, selection: base("EMPTY POT", ["STATUS: STERILE, WAITING FOR POWER"]) };
    case "prep":
      return { classes: "is-open-pot life-open life-soil", ownsLook: true, selection: base("POTTED SOIL", ["STATUS: POT FILLED, WAITING FOR CLONES"]) };
    case "planting": {
      const planted = index < Math.min(9, Math.floor(seconds / 2.5));
      if (!planted) return { classes: "is-open-pot life-open life-soil", ownsLook: true, selection: base("POTTED SOIL", ["STATUS: WAITING FOR A CUTTING"]) };
      return { stage: "clone", classes: "life-planted", style: { "--grow": 0.7 }, ownsLook: true, selection: base("NEW CLONE", ["STAGE: CLONE", "STATUS: JUST PLANTED"]) };
    }
    case "harvesting": {
      const cut = Math.floor(seconds / 1.5);
      if (index < cut) return { classes: "is-open-pot life-open life-soil", ownsLook: true, selection: base("CUT POT", ["STATUS: HARVESTED, PLANT SENT TO DRY ROOM"]) };
      return { stage: "ripe", classes: index === cut ? "life-cutting" : "", style: { "--grow": 1.05 }, ownsLook: true, selection: base("RIPE PLANT", ["STAGE: RIPE", "STATUS: BEING HARVESTED", ...(r.batch ? [`BATCH: ${r.batch.code}`] : [])]) };
    }
    case "growing":
    default: {
      const stage = r.plantStage ?? "veg";
      const stressed = stress >= 6 || !online;
      const grey = !online && stress >= 14;
      return {
        stage,
        classes: `${stressed ? "is-stressed-plant" : ""} ${grey ? "is-device-offline" : ""}`,
        style: { "--grow": (0.7 + 0.42 * r.growth) * jitter },
        ownsLook: true,
        selection: base("CANNABIS PLANT", [`BATCH: ${r.batch?.code ?? "--"}`, `DAY: ${r.day} OF ${r.cycleDays}`, `STAGE: ${stage.toUpperCase()}`, `STRESS: ${stress.toFixed(1)}H`, `STATUS: ${grey ? "WILTING IN THE DARK" : stressed ? "STRESSED" : "HEALTHY"}`]),
      };
    }
  }
}

/** Room-level classes (sterile wash, spray) for the room frame. */
export function lifeRoomPhase(life: LifeState | undefined, roomId: string): string | undefined {
  if (!life || !isGrow(roomId)) return undefined;
  return life.snap.rooms[roomId].phase;
}

// ---------------------------------------------------------------------------
// Room vitals
// ---------------------------------------------------------------------------

export type LifeVital = {
  primary: string;
  secondary: string;
  status: "OK" | "BUSY" | "WATCH";
  detail: string[];
  phase?: string;
  /** True for rooms that have no device telemetry of their own: the lifecycle line replaces the placeholder vitals. */
  replace: boolean;
};

function leading(batches: LifecycleBatchRef[]) {
  return [...batches].sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))[0];
}

export function lifeVitals(snap: LifecycleSnapshot): Record<string, LifeVital> {
  const out: Record<string, LifeVital> = {};
  for (const room of LIFE_GROW_ROOMS) {
    const r = snap.rooms[room];
    out[room] = {
      primary: growLabel(r),
      secondary: r.batch ? `${r.batch.code} ${r.batch.units}U${r.batch.stress >= 1 ? ` STRESS ${r.batch.stress.toFixed(0)}` : ""}` : `CYCLE ${r.cycles + 1}`,
      status: r.phase === "growing" || r.phase === "idle" ? "OK" : "BUSY",
      phase: r.phase,
      replace: false,
      detail: [`LIFECYCLE: ${r.label}`, ...(r.batch ? [`BATCH: ${r.batch.code} (${r.batch.units} PLANTS)`, `STRESS: ${r.batch.stress.toFixed(1)}H`] : []), ...(r.phase === "growing" ? [`DAY ${r.day} OF ${r.cycleDays}, ${pct(r.progress)} GROWN`] : []), `CROPS FINISHED: ${r.cycles}`],
    };
  }
  for (const room of LIFE_DRY_ROOMS) {
    const dry = snap.rooms[room];
    const lead = leading(dry.batches);
    out[room] = {
      primary: dry.batches.length ? `${dry.batches.length} BATCH${dry.batches.length === 1 ? "" : "ES"}` : "NO BATCHES",
      secondary: lead ? `${lead.stage === "curing" ? "CURING" : "DRYING"} ${pct(lead.progress)}` : `RACKS ${dry.capacity} FREE`,
      status: dry.batches.length ? "BUSY" : "OK",
      replace: false,
      detail: dry.batches.length ? dry.batches.map((batch) => `${batch.code} ${batch.stage === "curing" ? "CURING" : "DRYING"} ${pct(batch.progress)} ${batch.units}U Q${batch.quality ?? "--"}`) : ["RACKS EMPTY"],
    };
  }
  const trimming = snap.rooms.trim.batches.find((batch) => batch.stage === "trimming");
  const queue = snap.rooms.trim.batches.filter((batch) => batch.stage !== "trimming");
  out.trim = {
    primary: trimming ? `TRIM ${trimming.code} ${pct(trimming.progress)}` : queue.length ? "WAITING FOR TABLE" : "TABLES FREE",
    secondary: `QUEUE ${queue.length}`,
    status: trimming ? "BUSY" : "OK",
    replace: true,
    detail: [trimming ? `NOW: ${trimming.code} ${trimming.units}U ${pct(trimming.progress)}` : "NOW: NOTHING ON THE TABLES", ...queue.map((batch) => `${batch.code} ${STAGE_LABEL[batch.stage] ?? batch.stage}`)],
  };
  const packing = snap.rooms.pack.batches.find((batch) => batch.stage === "packaging");
  out.pack = {
    primary: packing ? `PACK ${packing.code}` : "PACK LINE IDLE",
    secondary: packing ? `${packing.units}U ${pct(packing.progress)}` : "WAITING FOR CURE",
    status: packing ? "BUSY" : "OK",
    replace: true,
    detail: packing ? batchLines(packing) : ["NO BATCH ON THE LINE"],
  };
  const running = snap.rooms.extract.batches.find((batch) => batch.stage === "extracting");
  const waiting = snap.rooms.extract.batches.filter((batch) => batch.stage === "extract-queue");
  out.extract = {
    primary: running ? `EXTRACT ${running.code} ${pct(running.progress)}` : "LAB IDLE",
    secondary: `QUEUE ${waiting.length}`,
    status: running ? "BUSY" : "OK",
    replace: true,
    detail: running ? batchLines(running) : ["NO EXTRACTION RUN"],
  };
  const loading = snap.rooms.dock.batches;
  out.dock = {
    primary: loading.length ? `LOADING ${loading[0].code}` : "DOCK CLEAR",
    secondary: loading.length ? `${loading.reduce((sum, batch) => sum + batch.units, 0)}U STAGED` : "NOTHING STAGED",
    status: loading.length ? "BUSY" : "OK",
    replace: true,
    detail: loading.length ? loading.map((batch) => `${batch.code} ${batch.units}U ${pct(batch.progress)}`) : ["NO PACKAGES AT THE DOCK"],
  };
  const inv = snap.rooms.warehouse.inventory;
  out.warehouse = {
    primary: `FLOWER ${inv.flower}U`,
    secondary: `EXTRACT ${inv.extract}U`,
    status: "OK",
    replace: true,
    detail: [`STOCK: FLOWER ${inv.flower} / EXTRACT ${inv.extract}`, ...snap.rooms.warehouse.batches.slice(0, 6).map((batch) => `${batch.code} ${batch.kind.toUpperCase()} ${batch.units}U Q${batch.quality}`)],
  };
  const last = snap.sales[0];
  out.sales = {
    primary: `STOCK F${snap.inventory.flower} X${snap.inventory.extract}`,
    secondary: last ? `LAST ${last.orderCode} ${last.units}${last.sku.slice(0, 1).toUpperCase()}` : "NO ORDERS YET",
    status: "OK",
    replace: true,
    detail: [`STOCK: FLOWER ${snap.inventory.flower} / EXTRACT ${snap.inventory.extract}`, ...snap.sales.slice(0, 4).map((sale) => `${sale.orderCode} ${sale.units} ${sale.sku.toUpperCase()}${sale.batch ? ` FROM ${sale.batch}` : ""}`)],
  };
  const mothers = snap.rooms.mother.mothers;
  out.mother = {
    primary: `${mothers.length} MOTHER${mothers.length === 1 ? "" : "S"}`,
    secondary: mothers.length ? `OLDEST ${Math.max(...mothers.map((mother) => mother.ageDays)).toFixed(0)}D/${snap.rooms.mother.lifeDays}` : "RESTOCKING",
    status: mothers.length ? "OK" : "WATCH",
    replace: false,
    detail: mothers.length ? mothers.map((mother) => `${mother.code} ${mother.ageDays}D FROM ${mother.source === "seed" ? "SEED" : (LIFE_ROOM_NAMES[mother.source] ?? mother.source)}`) : ["NO MOTHER PLANTS LEFT"],
  };
  out.clone = {
    primary: snap.rooms.clone.cuttingsInTray ? `CUTTINGS ${snap.rooms.clone.cuttingsInTray}` : "TRAYS EMPTY",
    secondary: snap.rooms.clone.cuttingsInTray ? "FOR PLANTING" : "NO ROOM PLANTING",
    status: "OK",
    replace: false,
    detail: [`CUTTINGS IN TRAYS: ${snap.rooms.clone.cuttingsInTray}`],
  };
  return out;
}

// ---------------------------------------------------------------------------
// Panel summary
// ---------------------------------------------------------------------------

export function lifeStageCounts(snap: LifecycleSnapshot) {
  const count = (stage: string) => snap.batches.filter((batch) => batch.stage === stage).length;
  return [
    ["GROWING", LIFE_GROW_ROOMS.filter((room) => snap.rooms[room].phase === "growing").length],
    ["DRYING", count("drying")],
    ["TRIM Q", count("trim-queue") + count("cure-queue")],
    ["TRIMMING", count("trimming")],
    ["CURING", count("curing")],
    ["EXTRACT", count("extract-queue") + count("extracting")],
    ["PACKING", count("packaging")],
    ["LOADING", count("loading")],
    ["SHELVED", count("warehouse")],
  ] as Array<[string, number]>;
}

// ---------------------------------------------------------------------------
// Worker tasks
// ---------------------------------------------------------------------------

export type TaskCargo = "clone" | "soil" | "cutPlant" | "package" | "extract" | "spray" | "mop";

export type TaskStop = {
  /** Room to walk to; or a batch code whose current room is resolved when the worker gets there. */
  room?: string;
  batch?: string;
  /** Prefer a tile next to one of these prop kinds. */
  near?: Array<Gen2Prop["kind"]>;
  /** Minimum time at the stop, in movement ticks (about 0.43 s each). */
  dwell: number;
  /** Keep working while this lifecycle key is active (see lifeActiveKeys). */
  whileKey?: string;
  maxDwell?: number;
  say?: string;
  /** Work animation: spray, mop, cut, plant, pot, trim, pack, extract, sample, hang. */
  act?: string;
  pickup?: TaskCargo;
  drop?: boolean;
};

export type PendingTask = {
  id: string;
  /** Dedupe key for state-driven tasks ("st:..."); one-shot event tasks use "ev:...". */
  key: string;
  label: string;
  candidates: string[];
  stops: TaskStop[];
  expires: number;
};

export type LifeBubble = { id: string; room: string; x: number; y: number; text: string; until: number };

export function lifeActiveKeys(snap: LifecycleSnapshot) {
  const keys = new Set<string>();
  for (const room of LIFE_GROW_ROOMS) keys.add(`phase:${room}:${snap.rooms[room].phase}`);
  for (const batch of snap.batches) keys.add(`stage:${batch.code}:${batch.stage}`);
  return keys;
}

export function lifeBatchRooms(snap: LifecycleSnapshot) {
  const rooms: Record<string, string> = {};
  for (const batch of snap.batches) if (batch.room) rooms[batch.code] = batch.room;
  return rooms;
}

const GROW_TECH: Record<string, string> = { grow1: "growWorker", grow2: "grow2Worker", grow3: "grow3Worker", grow4: "grow4Worker" };
const TASK_TTL = 4 * 60_000;

let taskCounter = 0;
function makeTask(key: string, label: string, candidates: string[], stops: TaskStop[], now: number, ttl = TASK_TTL): PendingTask {
  taskCounter += 1;
  return { id: `${key}#${taskCounter}`, key, label, candidates, stops, expires: now + ttl };
}

export type LifeEvents = { tasks: PendingTask[]; bubbles: LifeBubble[]; notices: string[]; seenAdd: string[] };

const SAMPLE_NEAR: Record<string, Array<Gen2Prop["kind"]>> = { grow1: ["plantBed"], grow2: ["plantBed"], grow3: ["plantBed"], grow4: ["plantBed"], soil: ["dryRack"], vmCreations: ["dryRack"], extract: ["vat", "machine"] };

function potPosition(room: string, slot: number) {
  const pot = lifeRoomProps(room, "plantBed")[slot];
  return pot ? { x: pot.x, y: pot.y } : undefined;
}

/**
 * Compares the previous and the new snapshot (and the persisted seen-id set) and returns the worker tasks and bubbles they
 * imply. State-driven tasks ("sterilizing", "harvesting", "trimming"...) are issued once per phase/stage; one-shot tasks
 * (carry a batch, a sale, a sample, mother changes) only fire for ids that were not in the previous snapshot.
 */
export function deriveLifeEvents(prev: LifeState | undefined, next: LifeState, issued: Set<string>, seen: Set<string>, now: number): LifeEvents {
  const snap = next.snap;
  const events: LifeEvents = { tasks: [], bubbles: [], notices: [], seenAdd: [] };
  const live = new Set<string>();
  const issue = (task: PendingTask) => {
    live.add(task.key);
    if (issued.has(task.key)) return;
    issued.add(task.key);
    events.tasks.push(task);
  };

  // ---- state-driven tasks -------------------------------------------------
  for (const room of LIFE_GROW_ROOMS) {
    const r = snap.rooms[room];
    const tech = GROW_TECH[room];
    const name = LIFE_ROOM_NAMES[room];
    const phaseKey = `phase:${room}:${r.phase}`;
    const cycle = `${room}:${r.cycles}`;
    if (r.phase === "sterilizing" || r.phase === "cleaning") {
      const mop = r.phase === "cleaning";
      issue(makeTask(`st:${mop ? "mop" : "spray"}:${cycle}:${r.phase}`, `${mop ? "MOP" : "STERILIZE"} ${name}`, ["maintenance", tech], [
        { room: "maintenanceRoom", near: ["rack", "crate"], dwell: 3, say: mop ? "GRAB MOP" : "GRAB SPRAYER", pickup: mop ? "mop" : "spray" },
        { room, near: ["plantBed"], dwell: 10, whileKey: phaseKey, maxDwell: 100_000, act: mop ? "mop" : "spray", say: mop ? "MOPPING" : "SPRAYING", drop: true },
      ], now, 15 * 60_000));
    }
    if (r.phase === "prep") {
      issue(makeTask(`st:pots:${cycle}`, `POT ${name}`, ["pottingWorker", tech], [
        { room: "potting", near: ["pottingMix", "soil", "table"], dwell: 4, say: "LOAD POTS", pickup: "soil" },
        { room, near: ["plantBed"], dwell: 26, act: "pot", say: "POTTING", drop: true },
      ], now, 10 * 60_000));
    }
    if (r.phase === "planting") {
      issue(makeTask(`st:plant-clone:${cycle}`, `PLANT ${name}`, ["cloneWorker"], [
        { room: "clone", near: ["tray"], dwell: 5, say: "CUTTINGS", pickup: "clone" },
        { room, near: ["plantBed"], dwell: 12, whileKey: phaseKey, maxDwell: 900, act: "plant", say: "PLANTING", drop: true },
      ], now, 10 * 60_000));
      issue(makeTask(`st:plant-mother:${cycle}`, `PLANT ${name}`, ["motherWorker"], [
        { room: "mother", near: ["plantBed"], dwell: 5, say: "CLONES", pickup: "clone" },
        { room, near: ["plantBed"], dwell: 12, whileKey: phaseKey, maxDwell: 900, act: "plant", say: "PLANTING", drop: true },
      ], now, 10 * 60_000));
    }
    if (r.phase === "harvesting" && r.batch) {
      const code = r.batch.code;
      const stops = (say: string): TaskStop[] => [
        { room, near: ["plantBed"], dwell: 10, whileKey: phaseKey, maxDwell: 900, act: "cut", say, pickup: "cutPlant" },
        { batch: code, near: ["dryRack"], dwell: 10, act: "hang", say: `HANG ${code}`, drop: true },
      ];
      issue(makeTask(`st:harvest-tech:${cycle}`, `HARVEST ${name}`, [tech, "growWorker"], stops("HARVESTING"), now, 10 * 60_000));
      issue(makeTask(`st:harvest-help:${cycle}`, `HARVEST ${name}`, ["motherWorker", "pottingWorker", "cloneWorker"], stops("CUTTING"), now, 10 * 60_000));
    }
  }
  for (const batch of snap.batches) {
    const key = (name: string) => `st:${name}:${batch.code}:${batch.stage}`;
    const stageKey = `stage:${batch.code}:${batch.stage}`;
    if (batch.stage === "trimming") {
      issue(makeTask(key("trim-a"), `TRIM ${batch.code}`, ["processor"], [{ room: "trim", near: ["trimTable"], dwell: 8, whileKey: stageKey, maxDwell: 100_000, act: "trim", say: "TRIMMING" }], now, 15 * 60_000));
      // A second pair of hands for the first few minutes of each batch (the packer / extractor have their own rooms to run).
      issue(makeTask(key("trim-b"), `TRIM ${batch.code}`, ["packer", "extractor"], [{ room: "trim", near: ["trimTable"], dwell: 8, whileKey: stageKey, maxDwell: 700, act: "trim", say: "TRIMMING" }], now, 3 * 60_000));
    }
    if (batch.stage === "packaging") {
      issue(makeTask(key("pack"), `PACK ${batch.code}`, ["packer", "processor"], [{ room: "pack", near: ["conveyor", "crate"], dwell: 8, whileKey: stageKey, maxDwell: 100_000, act: "pack", say: `PACKING ${batch.code}` }], now, 15 * 60_000));
    }
    if (batch.stage === "extracting") {
      issue(makeTask(key("extract"), `EXTRACT ${batch.code}`, ["extractor"], [{ room: "extract", near: ["machine", "vat", "table"], dwell: 8, whileKey: stageKey, maxDwell: 100_000, act: "extract", say: "EXTRACTING" }], now, 15 * 60_000));
    }
  }
  for (const key of [...issued]) if (key.startsWith("st:") && !live.has(key)) issued.delete(key);

  // ---- one-shot events (need a previous snapshot; the first one is only a baseline) ----------
  const baseline = !prev;
  const prevStage = new Map((prev?.snap.batches ?? []).map((batch) => [batch.code, batch]));
  if (!baseline) {
    for (const batch of snap.batches) {
      const before = prevStage.get(batch.code);
      if (!before || before.stage === batch.stage) continue;
      const xfer = `ev:xfer:${batch.code}:${batch.stage}`;
      if (seen.has(xfer)) continue;
      const mark = () => { seen.add(xfer); events.seenAdd.push(xfer); };
      if (before.stage === "drying" && (batch.stage === "trim-queue" || batch.stage === "trimming") && before.room) {
        mark();
        events.tasks.push(makeTask(xfer, `${batch.code} TO TRIM`, ["soilWorker", "processor"], [
          { room: before.room, near: ["dryRack"], dwell: 6, say: `TAKE ${batch.code}`, pickup: "cutPlant" },
          { room: "trim", near: ["rack", "trimTable"], dwell: 8, say: `TRIM ${batch.code}`, drop: true },
        ], now));
      } else if ((before.stage === "cure-queue" || before.stage === "trimming") && batch.stage === "curing" && batch.room) {
        mark();
        events.tasks.push(makeTask(xfer, `${batch.code} TO CURE`, ["soilWorker", "processor"], [
          { room: "trim", near: ["rack"], dwell: 6, say: `TAKE ${batch.code}`, pickup: "cutPlant" },
          { room: batch.room, near: ["dryRack"], dwell: 10, act: "hang", say: `CURE ${batch.code}`, drop: true },
        ], now));
      } else if (before.stage === "packaging" && batch.stage === "loading") {
        mark();
        events.tasks.push(makeTask(xfer, `${batch.code} TO DOCK`, ["logistics"], [
          { room: "pack", near: ["conveyor", "crate"], dwell: 5, say: `LOAD ${batch.code}`, pickup: "package" },
          { room: "dock", near: ["crate"], dwell: 8, say: `DOCK ${batch.code}`, drop: true },
        ], now));
      } else if (before.stage === "loading" && batch.stage === "warehouse") {
        mark();
        events.tasks.push(makeTask(xfer, `${batch.code} TO WAREHOUSE`, ["logistics"], [
          { room: "dock", near: ["crate"], dwell: 5, say: `PICK ${batch.code}`, pickup: "package" },
          { room: "warehouse", near: ["shelf", "crate"], dwell: 10, say: `SHELVE ${batch.code}`, drop: true },
        ], now));
      }
    }

    // mothers: retired plants vanish with a bubble, promoted plants arrive with one
    const before = new Set(prev?.snap.rooms.mother.mothers.map((mother) => mother.code));
    const after = new Set(snap.rooms.mother.mothers.map((mother) => mother.code));
    for (const code of before) {
      if (after.has(code)) continue;
      const slot = prev?.motherSlots.indexOf(code) ?? -1;
      const at = slot >= 0 ? potPosition("mother", slot) : undefined;
      if (at) events.bubbles.push({ id: `b:retire:${code}`, room: "mother", x: at.x, y: at.y, text: `RETIRED ${code}`, until: now + 9000 });
    }
    for (const mother of snap.rooms.mother.mothers) {
      if (before.has(mother.code)) continue;
      const slot = next.motherSlots.indexOf(mother.code);
      const at = slot >= 0 ? potPosition("mother", slot) : undefined;
      const fromRoom = mother.source !== "seed";
      if (at) events.bubbles.push({ id: `b:new:${mother.code}`, room: "mother", x: at.x, y: at.y, text: `NEW MOTHER ${mother.code}`, until: now + 9000 });
      const key = `ev:mother:${mother.code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.seenAdd.push(key);
      if (fromRoom) {
        events.tasks.push(makeTask(key, `PROMOTE ${mother.code}`, [GROW_TECH[mother.source] ?? "growWorker", "motherWorker"], [
          { room: mother.source, near: ["plantBed"], dwell: 6, say: "KEEP ONE PLANT", pickup: "clone" },
          { room: "mother", near: ["plantBed"], dwell: 10, act: "plant", say: `NEW MOTHER ${mother.code}`, drop: true },
        ], now));
      } else {
        events.tasks.push(makeTask(key, `SEED ${mother.code}`, ["motherWorker"], [{ room: "mother", near: ["plantBed"], dwell: 14, act: "plant", say: "SEED PACK", drop: true }], now));
      }
    }
  }

  // sales and samples are tracked by id so a reload never replays old ones
  let saleTasks = 0;
  for (const sale of [...snap.sales].reverse()) {
    const key = `ev:sale:${sale.orderCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.seenAdd.push(key);
    if (baseline || saleTasks >= 2) continue;
    saleTasks += 1;
    events.tasks.push(makeTask(key, `SALE ${sale.orderCode}`, ["salesAssistant", "salesRep"], [
      { room: "warehouse", near: ["shelf", "crate"], dwell: 5, say: `SOLD ${sale.orderCode}`, pickup: "package" },
      { room: "sales", near: ["display", "table", "shelf"], dwell: 10, say: `SOLD ${sale.orderCode}`, drop: true },
    ], now, 6 * 60_000));
  }
  let sampleTasks = 0;
  for (const sample of [...snap.samples].reverse()) {
    const key = `ev:sample:${sample.simAt}:${sample.room}:${sample.batch ?? ""}:${sample.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.seenAdd.push(key);
    if (baseline || sampleTasks >= 2) continue;
    const label = LIFE_ROOM_NAMES[sample.room] ?? sample.room.toUpperCase();
    const result = sample.result === "flag" ? "FLAG" : "PASS";
    const worker = sampleTasks === 0 ? ["researcher", "rdSafety"] : ["rdSafety", "researcher"];
    sampleTasks += 1;
    events.tasks.push(makeTask(key, `SAMPLE ${label}`, worker, [
      { room: sample.room, near: SAMPLE_NEAR[sample.room] ?? ["plantBed"], dwell: 12, act: "sample", say: `SAMPLING ${label}`, pickup: "extract" },
      { room: "rd1", near: ["microscope", "centrifuge", "terminal", "desk"], dwell: 14, act: "sample", say: `${result} ${sample.batch ?? ""}`.trim(), drop: true },
    ], now, 8 * 60_000));
  }

  // new log lines are announced on the intercom (stale ones, from before a reload, are ignored)
  for (const entry of [...snap.log].reverse()) {
    const key = `log:${entry.simAt}:${entry.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.seenAdd.push(key);
    if (!baseline) events.notices.push(entry.message);
  }
  return events;
}
