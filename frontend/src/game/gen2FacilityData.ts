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
    | "food";
  x: number;
  y: number;
  w?: number;
  h?: number;
  room?: string;
};

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
  { kind: "whiteboard", x: 8, y: 36, w: 6, h: 2, room: "vmCreations" },
  { kind: "terminal", x: 22, y: 28, room: "soil" },
  { kind: "terminal", x: 26, y: 28, room: "soil" },
  { kind: "monitor", x: 22, y: 30, room: "soil" },
  { kind: "monitor", x: 24, y: 30, room: "soil" },
  { kind: "monitor", x: 26, y: 30, room: "soil" },
  { kind: "rack", x: 29, y: 28, w: 3, h: 5, room: "soil" },
  { kind: "crate", x: 30, y: 35, room: "soil" },
  { kind: "whiteboard", x: 22, y: 36, w: 6, h: 2, room: "soil" },
];

export const gen2Props: Gen2Prop[] = [
  ...vmRoomProps,
  ...baseGen2Props.filter((prop) => prop.room !== "soil").map(shiftProp),
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
