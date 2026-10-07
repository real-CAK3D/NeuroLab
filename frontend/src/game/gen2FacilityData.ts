export type Gen2RoomKind =
  | "boss"
  | "clone"
  | "mother"
  | "grow"
  | "soil"
  | "potting"
  | "manager"
  | "processing"
  | "packaging"
  | "extraction"
  | "security"
  | "break"
  | "bathroom"
  | "screening"
  | "warehouse"
  | "sales"
  | "research"
  | "maintenance"
  | "vm";

export type Gen2Direction = "down" | "up" | "left" | "right";
export type Gen2NpcRole = "boss" | "executive" | "cultivation" | "processing" | "science" | "security" | "logistics" | "secretary" | "maintenance";

export type Gen2Room = {
  id: string;
  label: string;
  kind: Gen2RoomKind;
  x: number;
  y: number;
  w: number;
  h: number;
  doors: Array<{ side: "top" | "right" | "bottom" | "left"; at: number; size?: number }>;
};

export type Gen2Prop = {
  kind:
    | "desk"
    | "monitor"
    | "plant"
    | "growLight"
    | "tray"
    | "plantBed"
    | "vat"
    | "co2"
    | "irrigation"
    | "table"
    | "trimTable"
    | "rack"
    | "barrel"
    | "sack"
    | "soil"
    | "crate"
    | "shelf"
    | "machine"
    | "pipe"
    | "terminal"
    | "whiteboard"
    | "chair"
    | "bath"
    | "stall"
    | "toilet"
    | "sink"
    | "fridge"
    | "microwave"
    | "coffee"
    | "waterStation"
    | "urinal"
    | "sealedDoor"
    | "conveyor"
    | "dryRack"
    | "cutPlant"
    | "pottingMix"
    | "experiment"
    | "extinguisher"
    | "food"
    | "rug"
    | "mat"
    | "decal"
    | "poster"
    | "clock"
    | "wallSign"
    | "vent"
    | "bulletin"
    | "wallLight"
    | "windowPane"
    | "plantTag"
    | "extCabinet"
    | "bench"
    | "bin"
    | "fan"
    | "humidifier"
    | "glassware"
    | "centrifuge"
    | "microscope"
    | "scale"
    | "printer"
    | "box"
    | "hood"
    | "condenser"
    | "display"
    | "stanchion"
    | "vending"
    | "sofa"
    | "cabinet";
  x: number;
  y: number;
  w?: number;
  h?: number;
  room?: string;
  /** Text for signs (shown through CSS attr()). */
  label?: string;
  /** Visual variant class suffix for decals, posters and rugs. */
  variant?: string;
};

/** Props that sprites can walk across/behind (wall dressing, floor decals, overlays). */
const GEN2_NON_SOLID_KINDS: ReadonlyArray<Gen2Prop["kind"]> = [
  "monitor", "growLight", "pipe", "irrigation", "whiteboard", "sealedDoor",
  "rug", "mat", "decal", "poster", "clock", "wallSign", "vent", "bulletin", "wallLight", "windowPane", "plantTag", "extCabinet",
];

export function gen2PropBlocksMovement(prop: Gen2Prop) {
  return !GEN2_NON_SOLID_KINDS.includes(prop.kind);
}

export type Gen2Npc = {
  id: string;
  role: Gen2NpcRole;
  x: number;
  y: number;
  dir: Gen2Direction;
  route: Array<{ x: number; y: number; face?: Gen2Direction; pause?: number }>;
  carry?: boolean;
  cargo?: "clone" | "soil" | "cutPlant" | "package" | "extract" | "idea" | "coffee" | "extinguisher";
};

export const GEN2_TILE = 16;
export const GEN2_W = 122;
export const GEN2_H = 62;

const FACILITY_SHIFT_X = 14;

function shiftRoom(room: Gen2Room): Gen2Room {
  return { ...room, x: room.x + FACILITY_SHIFT_X };
}

function shiftProp(prop: Gen2Prop): Gen2Prop {
  return { ...prop, x: prop.x + FACILITY_SHIFT_X };
}

function shiftNpc(npc: Gen2Npc): Gen2Npc {
  return {
    ...npc,
    x: npc.x + FACILITY_SHIFT_X,
    route: npc.route.map((step) => ({ ...step, x: step.x + FACILITY_SHIFT_X })),
  };
}

const baseGen2Rooms: Gen2Room[] = [
  { id: "boss", label: "BOSS OFFICE", kind: "boss", x: 2, y: 2, w: 18, h: 14, doors: [{ side: "bottom", at: 8, size: 2 }] },
  { id: "clone", label: "CLONE ROOM", kind: "clone", x: 22, y: 4, w: 11, h: 10, doors: [{ side: "bottom", at: 4, size: 2 }] },
  { id: "mother", label: "MOTHER ROOM", kind: "mother", x: 33, y: 4, w: 15, h: 10, doors: [{ side: "bottom", at: 5, size: 2 }] },
  { id: "grow1", label: "GROW ROOM 1", kind: "grow", x: 22, y: 16, w: 13, h: 9, doors: [{ side: "bottom", at: 5, size: 2 }] },
  { id: "grow2", label: "GROW ROOM 2", kind: "grow", x: 35, y: 16, w: 13, h: 9, doors: [{ side: "bottom", at: 5, size: 2 }] },
  { id: "grow3", label: "GROW ROOM 3", kind: "grow", x: 51, y: 16, w: 13, h: 9, doors: [{ side: "bottom", at: 5, size: 2 }] },
  { id: "grow4", label: "GROW ROOM 4", kind: "grow", x: 64, y: 16, w: 13, h: 9, doors: [{ side: "bottom", at: 5, size: 2 }] },
  { id: "soil", label: "THE GARDEN", kind: "vm", x: 6, y: 25, w: 13, h: 14, doors: [{ side: "top", at: 7, size: 2 }] },
  { id: "potting", label: "POTTING", kind: "potting", x: 22, y: 29, w: 12, h: 10, doors: [{ side: "top", at: 4, size: 2 }] },
  { id: "cultMgr", label: "CULTIVATION MGR", kind: "manager", x: 34, y: 29, w: 14, h: 10, doors: [{ side: "top", at: 5, size: 2 }] },
  { id: "trim", label: "PROCESS/TRIM", kind: "processing", x: 51, y: 2, w: 18, h: 12, doors: [{ side: "bottom", at: 7, size: 2 }] },
  { id: "pack", label: "PACKAGING", kind: "packaging", x: 70, y: 2, w: 10, h: 12, doors: [{ side: "bottom", at: 3, size: 2 }] },
  { id: "extract", label: "EXTRACTION", kind: "extraction", x: 81, y: 2, w: 12, h: 12, doors: [{ side: "bottom", at: 4, size: 2 }] },
  { id: "security", label: "SECURITY", kind: "security", x: 95, y: 1, w: 11, h: 15, doors: [{ side: "bottom", at: 4, size: 2 }] },
  { id: "ops", label: "OPS OFFICE", kind: "manager", x: 83, y: 18, w: 13, h: 7, doors: [{ side: "bottom", at: 5, size: 2 }] },
  { id: "break", label: "BREAK ROOM", kind: "break", x: 52, y: 27, w: 21, h: 12, doors: [{ side: "top", at: 8, size: 2 }] },
  { id: "bath", label: "BATHROOMS", kind: "bathroom", x: 73, y: 27, w: 9, h: 12, doors: [{ side: "top", at: 3, size: 2 }] },
  { id: "screen", label: "SCREENING ROOM", kind: "screening", x: 85, y: 27, w: 14, h: 12, doors: [{ side: "left", at: 5, size: 2 }, { side: "right", at: 5, size: 2 }] },
  { id: "maintenanceRoom", label: "MAINTENANCE", kind: "maintenance", x: 99, y: 21, w: 9, h: 12, doors: [{ side: "top", at: 1, size: 2 }] },
  { id: "dock", label: "LOADING", kind: "warehouse", x: 82, y: 42, w: 23, h: 6, doors: [{ side: "top", at: 10, size: 2 }, { side: "bottom", at: 10, size: 2 }] },
  { id: "warehouse", label: "WAREHOUSE", kind: "warehouse", x: 82, y: 48, w: 23, h: 12, doors: [{ side: "top", at: 10, size: 2 }] },
  { id: "sales", label: "SALES OFFICE", kind: "sales", x: 2, y: 42, w: 26, h: 15, doors: [{ side: "top", at: 10, size: 2 }] },
  { id: "rd1", label: "R&D LAB", kind: "research", x: 38, y: 42, w: 19, h: 15, doors: [{ side: "top", at: 8, size: 2 }] },
  { id: "rd2", label: "R&D TEST", kind: "research", x: 57, y: 42, w: 22, h: 15, doors: [{ side: "top", at: 10, size: 2 }] },
];

export const gen2Rooms: Gen2Room[] = [
  { id: "vmCreations", label: "CAK3D-CREATIONS", kind: "vm", x: 6, y: 25, w: 13, h: 14, doors: [{ side: "top", at: 7, size: 2 }] },
  ...baseGen2Rooms.map(shiftRoom),
];

const baseGen2Hallways = [
  { x: 10, y: 16, w: 12, h: 4 },
  { x: 22, y: 12, w: 30, h: 4 },
  { x: 27, y: 12, w: 5, h: 17 },
  { x: 38, y: 12, w: 5, h: 17 },
  { x: 42, y: 12, w: 10, h: 4 },
  { x: 13, y: 23, w: 10, h: 2 },
  { x: 13, y: 25, w: 39, h: 4 },
  { x: 19, y: 19, w: 4, h: 24 },
  { x: 48, y: 12, w: 4, h: 31 },
  { x: 48, y: 14, w: 55, h: 4 },
  { x: 99, y: 17, w: 4, h: 4 },
  { x: 52, y: 23, w: 47, h: 4 },
  { x: 80, y: 18, w: 5, h: 25 },
  { x: 96, y: 33, w: 4, h: 3 },
  { x: 12, y: 39, w: 84, h: 4 },
];

export const gen2Hallways = [
  { x: 13, y: 23, w: 28, h: 2 },
  { x: 13, y: 25, w: 7, h: 4 },
  ...baseGen2Hallways.map((hall) => ({ ...hall, x: hall.x + FACILITY_SHIFT_X })),
];

const baseGen2Props: Gen2Prop[] = [
  { kind: "desk", x: 7, y: 8, w: 6, h: 3, room: "boss" },
  { kind: "chair", x: 9, y: 11, room: "boss" },
  { kind: "desk", x: 14, y: 10, w: 4, h: 2, room: "boss" },
  { kind: "terminal", x: 15, y: 10, room: "boss" },
  { kind: "chair", x: 15, y: 12, room: "boss" },
  ...Array.from({ length: 5 }, (_, i) => ({ kind: "monitor" as const, x: 4 + i * 2, y: 4, room: "boss" })),
  { kind: "whiteboard", x: 14, y: 4, w: 4, h: 2, room: "boss" },
  { kind: "shelf", x: 5, y: 5, w: 3, h: 2, room: "boss" },
  { kind: "table", x: 13, y: 7, w: 3, h: 2, room: "boss" },
  { kind: "plant", x: 4, y: 13, room: "boss" },
  { kind: "plant", x: 17, y: 13, room: "boss" },
  { kind: "growLight", x: 24, y: 6, w: 7, room: "clone" },
  { kind: "irrigation", x: 23, y: 7, h: 5, room: "clone" },
  ...Array.from({ length: 8 }, (_, i) => ({ kind: "tray" as const, x: 24 + (i % 4) * 2, y: 8 + Math.floor(i / 4) * 2, room: "clone" })),
  { kind: "growLight", x: 35, y: 6, w: 11, room: "mother" },
  { kind: "irrigation", x: 34, y: 7, h: 5, room: "mother" },
  ...Array.from({ length: 12 }, (_, i) => ({ kind: "plantBed" as const, x: 35 + (i % 6) * 2, y: 8 + Math.floor(i / 6) * 2, room: "mother" })),
  { kind: "growLight", x: 24, y: 17, w: 9, room: "grow1" },
  { kind: "growLight", x: 37, y: 17, w: 9, room: "grow2" },
  { kind: "growLight", x: 53, y: 17, w: 9, room: "grow3" },
  { kind: "growLight", x: 66, y: 17, w: 9, room: "grow4" },
  ...Array.from({ length: 10 }, (_, i) => ({ kind: "plantBed" as const, x: 24 + (i % 5) * 2, y: 19 + Math.floor(i / 5) * 2, room: "grow1" })),
  ...Array.from({ length: 10 }, (_, i) => ({ kind: "plantBed" as const, x: 37 + (i % 5) * 2, y: 19 + Math.floor(i / 5) * 2, room: "grow2" })),
  ...Array.from({ length: 10 }, (_, i) => ({ kind: "plantBed" as const, x: 53 + (i % 5) * 2, y: 19 + Math.floor(i / 5) * 2, room: "grow3" })),
  ...Array.from({ length: 10 }, (_, i) => ({ kind: "plantBed" as const, x: 66 + (i % 5) * 2, y: 19 + Math.floor(i / 5) * 2, room: "grow4" })),
  { kind: "irrigation", x: 23, y: 18, h: 5, room: "grow1" },
  { kind: "irrigation", x: 36, y: 18, h: 5, room: "grow2" },
  { kind: "irrigation", x: 52, y: 18, h: 5, room: "grow3" },
  { kind: "irrigation", x: 65, y: 18, h: 5, room: "grow4" },
  { kind: "dryRack", x: 7, y: 27, w: 3, h: 6, room: "soil" },
  { kind: "dryRack", x: 11, y: 27, w: 3, h: 6, room: "soil" },
  { kind: "dryRack", x: 15, y: 27, w: 3, h: 6, room: "soil" },
  { kind: "cutPlant", x: 8, y: 28, room: "soil" },
  { kind: "cutPlant", x: 12, y: 28, room: "soil" },
  { kind: "cutPlant", x: 16, y: 28, room: "soil" },
  { kind: "cutPlant", x: 12, y: 30, room: "soil" },
  { kind: "cutPlant", x: 16, y: 31, room: "soil" },
  { kind: "machine", x: 11, y: 33, w: 2, h: 1, room: "soil" },
  { kind: "table", x: 24, y: 31, w: 7, h: 2, room: "potting" },
  { kind: "pottingMix", x: 25, y: 33, w: 5, h: 2, room: "potting" },
  { kind: "vat", x: 23, y: 34, w: 2, h: 3, room: "potting" },
  { kind: "barrel", x: 30, y: 34, room: "potting" },
  { kind: "barrel", x: 31, y: 34, room: "potting" },
  { kind: "sack", x: 30, y: 36, room: "potting" },
  { kind: "soil", x: 26, y: 36, w: 3, h: 2, room: "potting" },
  { kind: "desk", x: 36, y: 34, w: 5, h: 2, room: "cultMgr" },
  { kind: "chair", x: 38, y: 36, room: "cultMgr" },
  { kind: "terminal", x: 38, y: 34, room: "cultMgr" },
  { kind: "whiteboard", x: 42, y: 31, w: 4, h: 2, room: "cultMgr" },
  { kind: "plant", x: 45, y: 36, room: "cultMgr" },
  { kind: "shelf", x: 36, y: 31, w: 3, h: 2, room: "cultMgr" },
  { kind: "trimTable", x: 53, y: 6, w: 5, h: 2, room: "trim" },
  { kind: "trimTable", x: 60, y: 6, w: 5, h: 2, room: "trim" },
  { kind: "trimTable", x: 57, y: 10, w: 5, h: 2, room: "trim" },
  { kind: "rack", x: 65, y: 5, w: 3, h: 4, room: "trim" },
  { kind: "cutPlant", x: 54, y: 6, room: "trim" },
  { kind: "cutPlant", x: 61, y: 6, room: "trim" },
  { kind: "cutPlant", x: 66, y: 6, room: "trim" },
  { kind: "cutPlant", x: 66, y: 8, room: "trim" },
  ...Array.from({ length: 9 }, (_, i) => ({ kind: "crate" as const, x: 72 + (i % 3) * 2, y: 4 + Math.floor(i / 3) * 2, room: "pack" })),
  { kind: "conveyor", x: 73, y: 10, w: 5, room: "pack" },
  { kind: "machine", x: 85, y: 6, w: 3, h: 3, room: "extract" },
  { kind: "vat", x: 83, y: 5, w: 2, h: 4, room: "extract" },
  { kind: "vat", x: 88, y: 4, w: 2, h: 5, room: "extract" },
  { kind: "pipe", x: 83, y: 4, w: 8, room: "extract" },
  { kind: "table", x: 82, y: 10, w: 4, h: 2, room: "extract" },
  { kind: "crate", x: 90, y: 10, room: "extract" },
  ...Array.from({ length: 16 }, (_, i) => ({ kind: "monitor" as const, x: 97 + (i % 4) * 2, y: 3 + Math.floor(i / 4) * 2, room: "security" })),
  { kind: "desk", x: 99, y: 11, w: 4, h: 2, room: "security" },
  { kind: "chair", x: 100, y: 13, room: "security" },
  { kind: "desk", x: 85, y: 20, w: 4, h: 2, room: "ops" },
  { kind: "chair", x: 86, y: 22, room: "ops" },
  { kind: "terminal", x: 86, y: 20, room: "ops" },
  { kind: "whiteboard", x: 92, y: 22, w: 3, h: 2, room: "ops" },
  { kind: "table", x: 56, y: 32, w: 4, h: 2, room: "break" },
  { kind: "table", x: 64, y: 32, w: 4, h: 2, room: "break" },
  { kind: "chair", x: 56, y: 34, room: "break" },
  { kind: "chair", x: 59, y: 34, room: "break" },
  { kind: "chair", x: 64, y: 34, room: "break" },
  { kind: "chair", x: 67, y: 34, room: "break" },
  { kind: "fridge", x: 53, y: 29, w: 2, h: 3, room: "break" },
  { kind: "table", x: 65, y: 28, w: 7, h: 2, room: "break" },
  { kind: "coffee", x: 66, y: 28, room: "break" },
  { kind: "microwave", x: 68, y: 28, w: 2, room: "break" },
  { kind: "waterStation", x: 71, y: 28, room: "break" },
  { kind: "food", x: 57, y: 32, room: "break" },
  { kind: "urinal", x: 74, y: 29, room: "bath" },
  { kind: "urinal", x: 74, y: 30, room: "bath" },
  { kind: "stall", x: 74, y: 31, w: 2, h: 3, room: "bath" },
  { kind: "stall", x: 74, y: 34, w: 2, h: 3, room: "bath" },
  { kind: "toilet", x: 74, y: 33, room: "bath" },
  { kind: "toilet", x: 74, y: 36, room: "bath" },
  { kind: "sink", x: 79, y: 31, w: 2, room: "bath" },
  { kind: "sink", x: 79, y: 34, w: 2, room: "bath" },
  { kind: "desk", x: 88, y: 31, w: 5, h: 2, room: "screen" },
  { kind: "terminal", x: 89, y: 30, room: "screen" },
  { kind: "chair", x: 90, y: 33, room: "screen" },
  { kind: "chair", x: 93, y: 31, room: "screen" },
  { kind: "shelf", x: 94, y: 29, w: 3, h: 2, room: "screen" },
  { kind: "plant", x: 96, y: 36, room: "screen" },
  { kind: "whiteboard", x: 89, y: 36, w: 5, h: 2, room: "screen" },
  { kind: "sealedDoor", x: 98, y: 32, h: 2, room: "screen" },
  { kind: "desk", x: 101, y: 24, w: 4, h: 2, room: "maintenanceRoom" },
  { kind: "terminal", x: 102, y: 24, room: "maintenanceRoom" },
  { kind: "chair", x: 102, y: 26, room: "maintenanceRoom" },
  { kind: "rack", x: 105, y: 24, w: 2, h: 6, room: "maintenanceRoom" },
  { kind: "crate", x: 101, y: 30, room: "maintenanceRoom" },
  { kind: "machine", x: 104, y: 30, w: 3, h: 2, room: "maintenanceRoom" },
  ...Array.from({ length: 8 }, (_, i) => ({ kind: "shelf" as const, x: 86 + (i % 4) * 4, y: 50 + Math.floor(i / 4) * 5, w: 4, h: 2, room: "warehouse" })),
  ...Array.from({ length: 10 }, (_, i) => ({ kind: "crate" as const, x: 86 + (i % 5) * 4, y: 53 + Math.floor(i / 5) * 4, room: "warehouse" })),
  ...Array.from({ length: 6 }, (_, i) => ({ kind: "crate" as const, x: 86 + i * 3, y: 44, room: "dock" })),
  { kind: "table", x: 9, y: 49, w: 12, h: 3, room: "sales" },
  { kind: "desk", x: 5, y: 45, w: 5, h: 2, room: "sales" },
  { kind: "terminal", x: 6, y: 46, room: "sales" },
  { kind: "chair", x: 7, y: 47, room: "sales" },
  { kind: "chair", x: 10, y: 52, room: "sales" },
  { kind: "chair", x: 13, y: 52, room: "sales" },
  { kind: "chair", x: 16, y: 52, room: "sales" },
  { kind: "shelf", x: 22, y: 50, w: 4, h: 3, room: "sales" },
  { kind: "whiteboard", x: 21, y: 46, w: 5, h: 2, room: "sales" },
  { kind: "shelf", x: 20, y: 53, w: 5, h: 2, room: "sales" },
  { kind: "plant", x: 5, y: 54, room: "sales" },
  { kind: "plant", x: 24, y: 44, room: "sales" },
  { kind: "desk", x: 41, y: 45, w: 15, h: 2, room: "rd1" },
  { kind: "table", x: 41, y: 48, w: 7, h: 2, room: "rd1" },
  { kind: "chair", x: 42, y: 50, room: "rd1" },
  { kind: "chair", x: 46, y: 50, room: "rd1" },
  { kind: "terminal", x: 42, y: 45, room: "rd1" },
  { kind: "terminal", x: 47, y: 45, room: "rd1" },
  { kind: "terminal", x: 52, y: 45, room: "rd1" },
  { kind: "whiteboard", x: 48, y: 44, w: 5, h: 2, room: "rd1" },
  { kind: "machine", x: 50, y: 52, w: 3, h: 3, room: "rd1" },
  { kind: "experiment", x: 44, y: 48, w: 2, h: 2, room: "rd1" },
  { kind: "shelf", x: 51, y: 54, w: 4, h: 2, room: "rd1" },
  { kind: "plant", x: 39, y: 54, room: "rd1" },
  { kind: "desk", x: 60, y: 45, w: 18, h: 2, room: "rd2" },
  { kind: "table", x: 60, y: 48, w: 8, h: 2, room: "rd2" },
  { kind: "chair", x: 61, y: 50, room: "rd2" },
  { kind: "chair", x: 65, y: 50, room: "rd2" },
  { kind: "terminal", x: 61, y: 45, room: "rd2" },
  { kind: "terminal", x: 65, y: 45, room: "rd2" },
  { kind: "terminal", x: 69, y: 45, room: "rd2" },
  { kind: "terminal", x: 73, y: 45, room: "rd2" },
  { kind: "terminal", x: 77, y: 45, room: "rd2" },
  { kind: "whiteboard", x: 67, y: 44, w: 5, h: 2, room: "rd2" },
  { kind: "shelf", x: 61, y: 54, w: 5, h: 2, room: "rd2" },
  { kind: "machine", x: 75, y: 52, w: 3, h: 3, room: "rd2" },
  { kind: "experiment", x: 66, y: 48, w: 2, h: 2, room: "rd2" },
  { kind: "shelf", x: 70, y: 54, w: 4, h: 2, room: "rd2" },
  { kind: "plant", x: 58, y: 54, room: "rd2" },
];

const vmRoomProps: Gen2Prop[] = [
  { kind: "terminal", x: 8, y: 28, room: "vmCreations" },
  { kind: "terminal", x: 12, y: 28, room: "vmCreations" },
  { kind: "monitor", x: 8, y: 30, room: "vmCreations" },
  { kind: "monitor", x: 10, y: 30, room: "vmCreations" },
  { kind: "monitor", x: 12, y: 30, room: "vmCreations" },
  { kind: "rack", x: 15, y: 28, w: 3, h: 5, room: "vmCreations" },
  { kind: "crate", x: 16, y: 35, room: "vmCreations" },
  { kind: "whiteboard", x: 8, y: 37, w: 6, h: 1, room: "vmCreations" },
  { kind: "terminal", x: 22, y: 28, room: "soil" },
  { kind: "terminal", x: 26, y: 28, room: "soil" },
  { kind: "monitor", x: 22, y: 30, room: "soil" },
  { kind: "monitor", x: 24, y: 30, room: "soil" },
  { kind: "monitor", x: 26, y: 30, room: "soil" },
  { kind: "rack", x: 29, y: 28, w: 3, h: 5, room: "soil" },
  { kind: "crate", x: 30, y: 35, room: "soil" },
  { kind: "whiteboard", x: 22, y: 37, w: 6, h: 1, room: "soil" },
  // Drying / curing racks: one per batch (capacity 4 per dry room), each with a hung plant bundle that the lifecycle shows or hides.
  ...[{ room: "vmCreations", left: 7 }, { room: "soil", left: 21 }].flatMap(({ room, left }) => [
    ...[[0, 32], [3, 32], [0, 35], [3, 35]].map(([dx, y]) => ({ kind: "dryRack" as const, x: left + dx, y, w: 3, h: 2, room })),
    ...[[1, 32], [4, 32], [1, 35], [4, 35]].map(([dx, y]) => ({ kind: "cutPlant" as const, x: left + dx, y, room })),
  ]),
];

// ---------------------------------------------------------------------------
// Scenery pass: wall dressing, floor decals, rugs and room equipment.
// Coordinates below are final (post-shift) tile coordinates.
// ---------------------------------------------------------------------------

type WallDecor = { kind: Gen2Prop["kind"]; w?: number; label?: string; variant?: string };

const WALL_SIGN_LABELS: Record<string, string> = {
  vmCreations: "CREATIONS", boss: "BOSS", clone: "CLONE", mother: "MOTHER", grow1: "GROW 1", grow2: "GROW 2", grow3: "GROW 3", grow4: "GROW 4",
  soil: "GARDEN", potting: "POTTING", cultMgr: "CULT MGR", trim: "TRIM", pack: "PACK", extract: "EXTRACT", security: "SECURITY", ops: "OPS",
  break: "BREAK", bath: "WC", screen: "SCREENING", maintenanceRoom: "MAINT", dock: "LOADING", warehouse: "WAREHOUSE", sales: "SALES", rd1: "R&D LAB", rd2: "R&D TEST",
};

const roomWallDecor: Record<string, WallDecor[]> = {
  boss: [{ kind: "windowPane", w: 2 }, { kind: "wallSign", w: 2 }, { kind: "clock" }, { kind: "poster", variant: "chart" }, { kind: "windowPane", w: 2 }, { kind: "wallLight" }],
  clone: [{ kind: "wallSign", w: 2 }, { kind: "vent", w: 2 }, { kind: "clock" }],
  mother: [{ kind: "wallSign", w: 2 }, { kind: "vent", w: 2 }, { kind: "poster", variant: "leaf" }, { kind: "clock" }, { kind: "vent", w: 2 }],
  grow1: [{ kind: "wallSign", w: 2 }, { kind: "vent", w: 2 }, { kind: "clock" }, { kind: "vent", w: 2 }],
  grow2: [{ kind: "wallSign", w: 2 }, { kind: "vent", w: 2 }, { kind: "poster", variant: "leaf" }, { kind: "vent", w: 2 }],
  grow3: [{ kind: "wallSign", w: 2 }, { kind: "vent", w: 2 }, { kind: "clock" }, { kind: "vent", w: 2 }],
  grow4: [{ kind: "wallSign", w: 2 }, { kind: "vent", w: 2 }, { kind: "poster", variant: "warn" }, { kind: "vent", w: 2 }],
  soil: [{ kind: "wallSign", w: 2 }, { kind: "vent", w: 2 }, { kind: "poster", variant: "warn" }, { kind: "clock" }],
  vmCreations: [{ kind: "wallSign", w: 2 }, { kind: "vent", w: 2 }, { kind: "poster", variant: "warn" }, { kind: "clock" }],
  potting: [{ kind: "wallSign", w: 2 }, { kind: "poster", variant: "leaf" }, { kind: "wallLight" }, { kind: "clock" }],
  cultMgr: [{ kind: "windowPane", w: 2 }, { kind: "wallSign", w: 2 }, { kind: "clock" }, { kind: "bulletin", w: 2 }],
  trim: [{ kind: "wallSign", w: 2 }, { kind: "vent", w: 2 }, { kind: "clock" }, { kind: "poster", variant: "warn" }, { kind: "wallLight" }, { kind: "vent", w: 2 }],
  pack: [{ kind: "wallSign", w: 2 }, { kind: "clock" }, { kind: "poster", variant: "warn" }, { kind: "wallLight" }],
  extract: [{ kind: "wallSign", w: 2 }, { kind: "poster", variant: "warn" }, { kind: "vent", w: 2 }, { kind: "clock" }, { kind: "wallLight" }],
  security: [{ kind: "wallSign", w: 2 }, { kind: "clock" }, { kind: "poster", variant: "warn" }, { kind: "wallLight" }],
  ops: [{ kind: "wallSign", w: 2 }, { kind: "clock" }, { kind: "bulletin", w: 2 }, { kind: "windowPane", w: 2 }],
  break: [{ kind: "wallSign", w: 2 }, { kind: "windowPane", w: 2 }, { kind: "clock" }, { kind: "bulletin", w: 2 }, { kind: "poster", variant: "leaf" }, { kind: "windowPane", w: 2 }, { kind: "wallLight" }],
  bath: [{ kind: "wallSign", w: 1 }, { kind: "vent", w: 2 }],
  screen: [{ kind: "wallSign", w: 2 }, { kind: "clock" }, { kind: "poster", variant: "chart" }, { kind: "bulletin", w: 2 }, { kind: "windowPane", w: 2 }],
  maintenanceRoom: [{ kind: "wallSign", w: 2 }, { kind: "clock" }, { kind: "bulletin", w: 2 }],
  dock: [{ kind: "wallSign", w: 2 }, { kind: "clock" }, { kind: "poster", variant: "warn" }, { kind: "wallLight" }, { kind: "vent", w: 2 }, { kind: "wallLight" }, { kind: "bulletin", w: 2 }, { kind: "wallLight" }],
  warehouse: [{ kind: "wallSign", w: 2 }, { kind: "clock" }, { kind: "wallLight" }, { kind: "poster", variant: "warn" }, { kind: "vent", w: 2 }, { kind: "wallLight" }, { kind: "bulletin", w: 2 }],
  sales: [{ kind: "windowPane", w: 2 }, { kind: "wallSign", w: 2 }, { kind: "poster", variant: "chart" }, { kind: "clock" }, { kind: "poster", variant: "chart" }, { kind: "windowPane", w: 2 }, { kind: "bulletin", w: 2 }, { kind: "wallLight" }],
  rd1: [{ kind: "wallSign", w: 2 }, { kind: "poster", variant: "warn" }, { kind: "clock" }, { kind: "vent", w: 2 }, { kind: "wallLight" }, { kind: "bulletin", w: 2 }],
  rd2: [{ kind: "wallSign", w: 2 }, { kind: "poster", variant: "warn" }, { kind: "clock" }, { kind: "vent", w: 2 }, { kind: "wallLight" }, { kind: "bulletin", w: 2 }, { kind: "poster", variant: "chart" }],
};

function hashUnit(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function buildWallDecor(): Gen2Prop[] {
  const decor: Gen2Prop[] = [];
  for (const room of gen2Rooms) {
    const doorSpans = room.doors.filter((door) => door.side === "top").map((door) => ({ from: room.x + door.at - 1, to: room.x + door.at + (door.size ?? 2) }));
    let x = room.x + 2;
    for (const item of roomWallDecor[room.id] ?? []) {
      const w = item.w ?? 1;
      for (const span of doorSpans) if (x <= span.to && x + w - 1 >= span.from) x = span.to + 1;
      if (x + w > room.x + room.w - 2) break;
      decor.push({ kind: item.kind, x, y: room.y, w, h: 1, room: room.id, variant: item.variant, label: item.kind === "wallSign" ? WALL_SIGN_LABELS[room.id] ?? room.label : undefined });
      x += w + 1;
    }
  }
  return decor;
}

function buildScuffs(): Gen2Prop[] {
  const scuffs: Gen2Prop[] = [];
  for (const room of gen2Rooms) {
    const count = Math.max(2, Math.floor((room.w * room.h) / 55));
    for (let i = 0; i < count; i += 1) {
      const x = room.x + 1 + Math.floor(hashUnit(`${room.id}-sx-${i}`) * (room.w - 2));
      const y = room.y + 2 + Math.floor(hashUnit(`${room.id}-sy-${i}`) * (room.h - 3));
      scuffs.push({ kind: "decal", variant: i % 3 === 0 ? "stain" : "scuff", x, y, room: room.id });
    }
  }
  return scuffs;
}

const sceneryProps: Gen2Prop[] = [
  // Executive suite
  { kind: "rug", variant: "red", x: 20, y: 7, w: 8, h: 6, room: "boss" },
  { kind: "sofa", x: 18, y: 12, w: 3, room: "boss" },
  { kind: "cabinet", x: 17, y: 8, h: 3, room: "boss" },
  { kind: "bin", x: 32, y: 12, room: "boss" },
  { kind: "mat", x: 24, y: 14, w: 2, room: "boss" },
  // Cultivation rooms: tray tags, fans, humidifiers
  ...Array.from({ length: 8 }, (_, i) => ({ kind: "plantTag" as const, x: 38 + (i % 4) * 2, y: 9 + Math.floor(i / 4) * 2, room: "clone" })),
  { kind: "humidifier", x: 45, y: 6, room: "clone" },
  { kind: "fan", x: 45, y: 8, room: "clone" },
  { kind: "humidifier", x: 45, y: 11, room: "clone" },
  { kind: "mat", x: 40, y: 12, w: 2, room: "clone" },
  ...Array.from({ length: 12 }, (_, i) => ({ kind: "plantTag" as const, x: 49 + (i % 6) * 2, y: 9 + Math.floor(i / 6) * 2, room: "mother" })),
  { kind: "fan", x: 60, y: 7, room: "mother" },
  { kind: "humidifier", x: 60, y: 11, room: "mother" },
  { kind: "mat", x: 53, y: 12, w: 2, room: "mother" },
  { kind: "fan", x: 47, y: 18, room: "grow1" },
  { kind: "humidifier", x: 47, y: 22, room: "grow1" },
  { kind: "mat", x: 41, y: 23, w: 2, room: "grow1" },
  { kind: "fan", x: 60, y: 18, room: "grow2" },
  { kind: "humidifier", x: 60, y: 22, room: "grow2" },
  { kind: "mat", x: 54, y: 23, w: 2, room: "grow2" },
  { kind: "fan", x: 76, y: 18, room: "grow3" },
  { kind: "humidifier", x: 76, y: 22, room: "grow3" },
  { kind: "mat", x: 70, y: 23, w: 2, room: "grow3" },
  { kind: "fan", x: 89, y: 18, room: "grow4" },
  { kind: "humidifier", x: 89, y: 22, room: "grow4" },
  { kind: "mat", x: 83, y: 23, w: 2, room: "grow4" },
  // Dry rooms / server bays
  { kind: "decal", variant: "cable", x: 22, y: 29, w: 8, room: "soil" },
  { kind: "decal", variant: "cable", x: 8, y: 29, w: 7, room: "vmCreations" },
  { kind: "bin", x: 17, y: 37, room: "vmCreations" },
  { kind: "bin", x: 31, y: 37, room: "soil" },
  { kind: "mat", x: 27, y: 26, w: 2, room: "soil" },
  { kind: "mat", x: 13, y: 26, w: 2, room: "vmCreations" },
  // Potting and cultivation manager
  { kind: "bin", x: 46, y: 36, room: "potting" },
  { kind: "box", x: 37, y: 37, room: "potting" },
  { kind: "scale", x: 38, y: 37, room: "potting" },
  { kind: "mat", x: 40, y: 30, w: 2, room: "potting" },
  { kind: "rug", variant: "blue", x: 50, y: 33, w: 7, h: 5, room: "cultMgr" },
  { kind: "cabinet", x: 49, y: 31, h: 2, room: "cultMgr" },
  { kind: "bin", x: 58, y: 36, room: "cultMgr" },
  { kind: "mat", x: 53, y: 30, w: 2, room: "cultMgr" },
  // Processing line
  { kind: "scale", x: 68, y: 4, room: "trim" },
  { kind: "bin", x: 66, y: 12, room: "trim" },
  { kind: "box", x: 80, y: 11, room: "trim" },
  { kind: "box", x: 81, y: 11, room: "trim" },
  { kind: "mat", x: 72, y: 12, w: 2, room: "trim" },
  { kind: "decal", variant: "hazard", x: 66, y: 9, w: 16, room: "trim" },
  { kind: "scale", x: 85, y: 10, room: "pack" },
  { kind: "printer", x: 92, y: 10, room: "pack" },
  { kind: "box", x: 85, y: 12, room: "pack" },
  { kind: "box", x: 92, y: 12, room: "pack" },
  { kind: "mat", x: 87, y: 12, w: 2, room: "pack" },
  { kind: "hood", x: 102, y: 10, w: 2, room: "extract" },
  { kind: "condenser", x: 105, y: 5, h: 2, room: "extract" },
  { kind: "condenser", x: 105, y: 8, h: 2, room: "extract" },
  { kind: "glassware", x: 104, y: 12, room: "extract" },
  { kind: "decal", variant: "hazard", x: 96, y: 9, w: 10, room: "extract" },
  { kind: "mat", x: 99, y: 12, w: 2, room: "extract" },
  // Security and operations
  { kind: "desk", x: 111, y: 10, w: 7, room: "security" },
  { kind: "cabinet", x: 118, y: 6, h: 2, room: "security" },
  { kind: "bin", x: 118, y: 13, room: "security" },
  { kind: "mat", x: 113, y: 14, w: 2, room: "security" },
  { kind: "rug", variant: "blue", x: 99, y: 19, w: 5, h: 4, room: "ops" },
  { kind: "cabinet", x: 98, y: 20, h: 2, room: "ops" },
  { kind: "printer", x: 107, y: 20, room: "ops" },
  { kind: "bin", x: 108, y: 19, room: "ops" },
  { kind: "mat", x: 103, y: 23, w: 2, room: "ops" },
  // Break room
  { kind: "vending", x: 70, y: 28, w: 2, h: 2, room: "break" },
  { kind: "rug", variant: "green", x: 70, y: 31, w: 6, h: 5, room: "break" },
  { kind: "rug", variant: "brown", x: 78, y: 31, w: 6, h: 5, room: "break" },
  { kind: "sofa", x: 68, y: 36, w: 4, room: "break" },
  { kind: "bench", x: 82, y: 37, w: 3, room: "break" },
  { kind: "bin", x: 85, y: 30, room: "break" },
  { kind: "bin", x: 85, y: 35, room: "break" },
  { kind: "plant", x: 67, y: 35, room: "break" },
  { kind: "mat", x: 74, y: 28, w: 2, room: "break" },
  { kind: "decal", variant: "stain", x: 77, y: 30, room: "break" },
  // Bathrooms
  { kind: "bin", x: 94, y: 37, room: "bath" },
  { kind: "bin", x: 88, y: 37, room: "bath" },
  { kind: "poster", variant: "mirror", x: 95, y: 31, room: "bath" },
  { kind: "poster", variant: "mirror", x: 95, y: 34, room: "bath" },
  { kind: "mat", x: 90, y: 28, w: 2, room: "bath" },
  // Screening lobby
  { kind: "bench", x: 101, y: 28, w: 3, room: "screen" },
  { kind: "bench", x: 100, y: 36, w: 2, room: "screen" },
  { kind: "stanchion", x: 101, y: 31, room: "screen" },
  { kind: "stanchion", x: 101, y: 34, room: "screen" },
  { kind: "rug", variant: "red", x: 100, y: 32, w: 1, h: 2, room: "screen" },
  { kind: "plant", x: 110, y: 28, room: "screen" },
  { kind: "bin", x: 110, y: 37, room: "screen" },
  // Maintenance closet
  { kind: "bin", x: 114, y: 30, room: "maintenanceRoom" },
  { kind: "cabinet", x: 114, y: 27, h: 2, room: "maintenanceRoom" },
  { kind: "mat", x: 114, y: 22, w: 2, room: "maintenanceRoom" },
  // Loading dock and warehouse
  { kind: "decal", variant: "hazard", x: 97, y: 46, w: 21, room: "dock" },
  { kind: "box", x: 97, y: 43, room: "dock" },
  { kind: "box", x: 98, y: 43, room: "dock" },
  { kind: "box", x: 97, y: 45, room: "dock" },
  { kind: "bench", x: 115, y: 45, w: 2, room: "dock" },
  { kind: "cabinet", x: 117, y: 43, h: 2, room: "dock" },
  { kind: "mat", x: 106, y: 43, w: 2, room: "dock" },
  { kind: "box", x: 97, y: 52, room: "warehouse" },
  { kind: "box", x: 97, y: 53, room: "warehouse" },
  { kind: "box", x: 98, y: 53, room: "warehouse" },
  { kind: "box", x: 117, y: 52, room: "warehouse" },
  { kind: "box", x: 117, y: 53, room: "warehouse" },
  { kind: "decal", variant: "lane", x: 99, y: 54, w: 18, room: "warehouse" },
  { kind: "decal", variant: "lane", x: 99, y: 52, w: 18, room: "warehouse" },
  { kind: "bin", x: 97, y: 58, room: "warehouse" },
  { kind: "mat", x: 106, y: 49, w: 2, room: "warehouse" },
  // Sales showroom
  { kind: "rug", variant: "blue", x: 22, y: 48, w: 14, h: 6, room: "sales" },
  { kind: "display", x: 28, y: 44, w: 2, room: "sales" },
  { kind: "display", x: 31, y: 44, w: 2, room: "sales" },
  { kind: "sofa", x: 18, y: 53, w: 3, room: "sales" },
  { kind: "cabinet", x: 17, y: 44, h: 2, room: "sales" },
  { kind: "bin", x: 40, y: 55, room: "sales" },
  { kind: "mat", x: 26, y: 43, w: 2, room: "sales" },
  // R&D labs
  { kind: "centrifuge", x: 58, y: 46, room: "rd1" },
  { kind: "microscope", x: 62, y: 46, room: "rd1" },
  { kind: "glassware", x: 66, y: 46, room: "rd1" },
  { kind: "glassware", x: 67, y: 46, room: "rd1" },
  { kind: "hood", x: 53, y: 52, w: 2, room: "rd1" },
  { kind: "decal", variant: "hazard", x: 55, y: 47, w: 8, room: "rd1" },
  { kind: "mat", x: 60, y: 43, w: 2, room: "rd1" },
  { kind: "centrifuge", x: 76, y: 46, room: "rd2" },
  { kind: "microscope", x: 80, y: 46, room: "rd2" },
  { kind: "glassware", x: 86, y: 46, room: "rd2" },
  { kind: "glassware", x: 88, y: 46, room: "rd2" },
  { kind: "hood", x: 83, y: 52, w: 2, room: "rd2" },
  { kind: "cabinet", x: 72, y: 51, h: 2, room: "rd2" },
  { kind: "decal", variant: "hazard", x: 75, y: 47, w: 8, room: "rd2" },
  { kind: "mat", x: 81, y: 43, w: 2, room: "rd2" },
];

// Corridor furniture sits against room walls and never in front of a door.
const hallwayProps: Gen2Prop[] = [
  { kind: "plant", x: 44, y: 14 },
  { kind: "waterStation", x: 57, y: 14 },
  { kind: "bench", x: 67, y: 14, w: 3 },
  { kind: "bin", x: 70, y: 14 },
  { kind: "extinguisher", x: 78, y: 14 },
  { kind: "plant", x: 83, y: 14 },
  { kind: "bench", x: 93, y: 14, w: 3 },
  { kind: "waterStation", x: 104, y: 14 },
  { kind: "bin", x: 108, y: 14 },
  { kind: "bench", x: 45, y: 25, w: 3 },
  { kind: "bench", x: 58, y: 25, w: 3 },
  { kind: "plant", x: 66, y: 25 },
  { kind: "bench", x: 75, y: 25, w: 3 },
  { kind: "extinguisher", x: 88, y: 25 },
  { kind: "plant", x: 34, y: 39 },
  { kind: "waterStation", x: 45, y: 39 },
  { kind: "bench", x: 62, y: 39, w: 3 },
  { kind: "bin", x: 70, y: 39 },
  { kind: "plant", x: 100, y: 39 },
  { kind: "bench", x: 40, y: 41, w: 3 },
  { kind: "plant", x: 50, y: 41 },
  { kind: "waterStation", x: 66, y: 41 },
  { kind: "bin", x: 75, y: 41 },
  { kind: "bench", x: 92, y: 41, w: 3 },
  { kind: "extinguisher", x: 56, y: 41 },
  { kind: "decal", variant: "lane", x: 28, y: 40, w: 88 },
  { kind: "decal", variant: "lane", x: 40, y: 26, w: 65 },
  // Wall-mounted fire extinguisher cabinets on bottom walls facing corridors
  { kind: "extCabinet", x: 44, y: 13, room: "clone" },
  { kind: "extCabinet", x: 58, y: 13, room: "mother" },
  { kind: "extCabinet", x: 77, y: 13, room: "trim" },
  { kind: "extCabinet", x: 91, y: 13, room: "pack" },
  { kind: "extCabinet", x: 103, y: 13, room: "extract" },
  { kind: "extCabinet", x: 46, y: 24, room: "grow1" },
  { kind: "extCabinet", x: 58, y: 24, room: "grow2" },
  { kind: "extCabinet", x: 75, y: 24, room: "grow3" },
  { kind: "extCabinet", x: 88, y: 24, room: "grow4" },
  { kind: "extCabinet", x: 44, y: 38, room: "potting" },
  { kind: "extCabinet", x: 57, y: 38, room: "cultMgr" },
  { kind: "extCabinet", x: 80, y: 38, room: "break" },
];

const decorProps: Gen2Prop[] = [...buildScuffs(), ...sceneryProps, ...buildWallDecor(), ...hallwayProps];

/** Scenery-pass props, exposed so layout checks can compare against the pre-scenery floor plan. */
export const gen2DecorProps: ReadonlyArray<Gen2Prop> = decorProps;

export const gen2Props: Gen2Prop[] = [
  ...vmRoomProps,
  ...baseGen2Props.filter((prop) => prop.room !== "soil").map(shiftProp),
  ...decorProps,
];

const baseGen2Npcs: Gen2Npc[] = [
  { id: "boss", role: "boss", x: 10, y: 10, dir: "down", route: [{ x: 10, y: 10, face: "down", pause: 10 }, { x: 4, y: 6, face: "up", pause: 5 }, { x: 6, y: 6, face: "up", pause: 5 }, { x: 8, y: 6, face: "up", pause: 5 }, { x: 10, y: 6, face: "up", pause: 5 }, { x: 12, y: 6, face: "up", pause: 5 }, { x: 11, y: 9, face: "left", pause: 7 }, { x: 8, y: 12, face: "up", pause: 5 }] },
  { id: "bossSecretary", role: "secretary", x: 15, y: 12, dir: "up", route: [{ x: 15, y: 12, face: "up", pause: 8 }, { x: 12, y: 17 }, { x: 41, y: 36 }, { x: 89, y: 22 }, { x: 15, y: 12, face: "up", pause: 8 }] },
  { id: "cloneWorker", role: "cultivation", x: 29, y: 10, dir: "left", cargo: "clone", route: [{ x: 29, y: 10, face: "left", pause: 16 }, { x: 28, y: 13 }, { x: 28, y: 27 }, { x: 28, y: 32, face: "up", pause: 10 }, { x: 29, y: 10, face: "left", pause: 16 }] },
  { id: "motherWorker", role: "cultivation", x: 42, y: 10, dir: "up", cargo: "clone", route: [{ x: 42, y: 10, face: "up", pause: 18 }, { x: 39, y: 13 }, { x: 28, y: 13 }, { x: 29, y: 10, face: "left", pause: 10 }, { x: 42, y: 10, face: "up", pause: 18 }] },
  { id: "growWorker", role: "cultivation", x: 28, y: 21, dir: "down", cargo: "cutPlant", route: [{ x: 28, y: 21, face: "up", pause: 18 }, { x: 28, y: 27 }, { x: 14, y: 28, face: "right", pause: 10 }, { x: 28, y: 21, face: "up", pause: 18 }] },
  { id: "grow2Worker", role: "cultivation", x: 41, y: 21, dir: "down", cargo: "soil", route: [{ x: 41, y: 21, face: "up", pause: 18 }, { x: 28, y: 32, face: "up", pause: 10 }, { x: 41, y: 21, face: "up", pause: 18 }] },
  { id: "grow3Worker", role: "cultivation", x: 56, y: 20, dir: "down", cargo: "cutPlant", route: [{ x: 56, y: 20, face: "up", pause: 18 }, { x: 57, y: 26 }, { x: 14, y: 30, face: "right", pause: 10 }, { x: 56, y: 20, face: "up", pause: 18 }] },
  { id: "grow4Worker", role: "cultivation", x: 69, y: 20, dir: "down", cargo: "soil", route: [{ x: 69, y: 20, face: "up", pause: 18 }, { x: 28, y: 32, face: "up", pause: 10 }, { x: 69, y: 20, face: "up", pause: 18 }] },
  { id: "pottingWorker", role: "cultivation", x: 28, y: 32, dir: "down", cargo: "soil", route: [{ x: 28, y: 32, face: "up", pause: 18 }, { x: 28, y: 21, face: "up", pause: 10 }, { x: 28, y: 32, face: "up", pause: 18 }, { x: 56, y: 20, face: "up", pause: 10 }] },
  { id: "soilWorker", role: "cultivation", x: 14, y: 33, dir: "up", cargo: "cutPlant", route: [{ x: 14, y: 33, face: "up", pause: 18 }, { x: 14, y: 28, face: "right", pause: 12 }, { x: 14, y: 27 }, { x: 49, y: 15 }, { x: 59, y: 10, face: "left", pause: 10 }, { x: 14, y: 33, face: "up", pause: 18 }] },
  { id: "cultManager", role: "executive", x: 44, y: 35, dir: "left", cargo: "coffee", route: [{ x: 44, y: 35, face: "left", pause: 14 }, { x: 41, y: 27, face: "down", pause: 4 }, { x: 76, y: 33, face: "left", pause: 18 }, { x: 80, y: 35, face: "left", pause: 8 }, { x: 28, y: 21, face: "up", pause: 4 }, { x: 44, y: 35, face: "left", pause: 14 }] },
  { id: "processor", role: "processing", x: 62, y: 10, dir: "left", cargo: "package", route: [{ x: 62, y: 10, face: "left", pause: 20 }, { x: 75, y: 10, face: "up", pause: 10 }, { x: 62, y: 10, face: "left", pause: 20 }] },
  { id: "packer", role: "processing", x: 75, y: 10, dir: "down", cargo: "package", route: [{ x: 75, y: 10, face: "up", pause: 20 }, { x: 93, y: 44, face: "down", pause: 10 }, { x: 75, y: 10, face: "up", pause: 20 }] },
  { id: "extractor", role: "processing", x: 86, y: 9, dir: "left", cargo: "extract", route: [{ x: 86, y: 9, face: "left", pause: 18 }, { x: 75, y: 10, face: "up", pause: 10 }, { x: 86, y: 9, face: "left", pause: 22 }, { x: 44, y: 49, face: "down", pause: 12 }, { x: 86, y: 9, face: "left", pause: 18 }] },
  { id: "opsManager", role: "executive", x: 94, y: 22, dir: "left", cargo: "package", route: [{ x: 94, y: 22, face: "left", pause: 14 }, { x: 75, y: 10, face: "up", pause: 8 }, { x: 10, y: 49, face: "up", pause: 12 }, { x: 94, y: 22, face: "left", pause: 14 }, { x: 62, y: 10, face: "left", pause: 4 }, { x: 68, y: 33, face: "up", pause: 4 }] },
  { id: "security", role: "security", x: 100, y: 12, dir: "up", route: [{ x: 100, y: 12, face: "up", pause: 8 }, { x: 97, y: 11, face: "up", pause: 3 }, { x: 99, y: 11, face: "up", pause: 3 }, { x: 101, y: 11, face: "up", pause: 3 }, { x: 103, y: 11, face: "up", pause: 3 }, { x: 100, y: 8, face: "down", pause: 5 }, { x: 100, y: 19 }, { x: 82, y: 40 }, { x: 78, y: 33, face: "right", pause: 3 }] },
  { id: "patrol", role: "security", x: 93, y: 40, dir: "left", route: [{ x: 93, y: 40 }, { x: 83, y: 40 }, { x: 85, y: 20 }, { x: 99, y: 20 }, { x: 70, y: 36 }, { x: 80, y: 32, face: "left", pause: 3 }] },
  { id: "logistics", role: "logistics", x: 93, y: 54, dir: "left", carry: true, cargo: "package", route: [{ x: 93, y: 54, face: "left", pause: 20 }, { x: 93, y: 43, face: "up", pause: 10 }, { x: 93, y: 54, face: "left", pause: 20 }] },
  { id: "researcher", role: "science", x: 66, y: 50, dir: "left", cargo: "extract", route: [{ x: 44, y: 49, face: "down", pause: 16 }, { x: 66, y: 50, face: "left", pause: 16 }, { x: 10, y: 49, face: "up", pause: 10 }, { x: 94, y: 22, face: "left", pause: 8 }, { x: 44, y: 49, face: "down", pause: 16 }] },
  { id: "rdSafety", role: "science", x: 54, y: 53, dir: "left", cargo: "extinguisher", route: [{ x: 54, y: 53, face: "left", pause: 20 }, { x: 45, y: 49, face: "down", pause: 12 }, { x: 67, y: 49, face: "down", pause: 12 }, { x: 75, y: 53, face: "left", pause: 8 }, { x: 54, y: 53, face: "left", pause: 20 }] },
  { id: "salesRep", role: "executive", x: 8, y: 48, dir: "up", cargo: "idea", route: [{ x: 8, y: 48, face: "up", pause: 22 }, { x: 41, y: 35, face: "left", pause: 10 }, { x: 88, y: 22, face: "left", pause: 10 }, { x: 10, y: 10, face: "down", pause: 10 }, { x: 8, y: 48, face: "up", pause: 22 }] },
  { id: "salesAssistant", role: "executive", x: 18, y: 49, dir: "left", route: [{ x: 18, y: 49, face: "left", pause: 24 }, { x: 8, y: 48, face: "up", pause: 10 }, { x: 18, y: 49, face: "left", pause: 24 }] },
  { id: "screenHr", role: "executive", x: 91, y: 34, dir: "up", route: [{ x: 91, y: 34, face: "up", pause: 18 }, { x: 90, y: 33, face: "up", pause: 16 }, { x: 94, y: 30, face: "down", pause: 12 }, { x: 91, y: 34, face: "up", pause: 18 }] },
  { id: "maintenance", role: "maintenance", x: 103, y: 29, dir: "left", cargo: "soil", route: [{ x: 103, y: 29, face: "left", pause: 10 }, { x: 101, y: 21, face: "down", pause: 4 }, { x: 93, y: 34, face: "up", pause: 4 }, { x: 80, y: 40, face: "left", pause: 3 }, { x: 65, y: 35, face: "up", pause: 4 }, { x: 53, y: 40, face: "left", pause: 3 }, { x: 22, y: 40, face: "left", pause: 3 }, { x: 103, y: 29, face: "left", pause: 10 }] },
];

export const gen2Npcs: Gen2Npc[] = baseGen2Npcs.map(shiftNpc);
