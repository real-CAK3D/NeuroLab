import { GEN2_H, GEN2_W, gen2PropBlocksMovement, gen2Props, gen2Rooms, type Gen2Prop } from "../game/gen2FacilityData";
import { tileKey } from "./walkTypes";

/** Floor surface ids (index into the floor painters in textures.ts). */
export const FLOOR = { void: 0, lab: 1, blue: 2, grey: 3, wood: 4, dark: 5, hazard: 6, lane: 7, rugRed: 8, rugBlue: 9, rugGreen: 10, rugBrown: 11 } as const;

type Shape = { h: number; top?: string };

/** Height (percent of wall height) and top colour of every solid prop the raycaster draws as a box. */
const BOX_SHAPES: Partial<Record<Gen2Prop["kind"], Shape>> = {
  shelf: { h: 100 }, rack: { h: 100 }, machine: { h: 100 }, vat: { h: 100 }, fridge: { h: 100 }, cabinet: { h: 100 }, vending: { h: 100 },
  stall: { h: 100 }, hood: { h: 100 }, condenser: { h: 100 }, dryRack: { h: 100 }, co2: { h: 100 },
  display: { h: 72 }, fan: { h: 70 }, humidifier: { h: 55 }, waterStation: { h: 62 },
  desk: { h: 45, top: "#b9874a" }, table: { h: 45, top: "#c99b5c" }, trimTable: { h: 45, top: "#aab6b8" }, bench: { h: 28, top: "#6f8f7a" },
  chair: { h: 32, top: "#3d4a5c" }, crate: { h: 38, top: "#c09252" }, box: { h: 28, top: "#c8a468" }, barrel: { h: 45, top: "#3f6fb5" },
  sack: { h: 30, top: "#d8c79a" }, soil: { h: 22, top: "#4a3322" }, pottingMix: { h: 22, top: "#4a3322" }, toilet: { h: 35, top: "#f4efe2" },
  urinal: { h: 50 }, sink: { h: 45, top: "#cfe0e4" }, bin: { h: 30, top: "#5c666a" }, microwave: { h: 38, top: "#aab6b8" }, coffee: { h: 40, top: "#2a2f36" },
  food: { h: 14, top: "#d9483d" }, conveyor: { h: 30, top: "#3a4046" }, experiment: { h: 45, top: "#9fd0c0" }, glassware: { h: 38, top: "#9fd0c0" },
  microscope: { h: 40, top: "#2a2f36" }, scale: { h: 22, top: "#aab6b8" }, printer: { h: 40, top: "#d8e8df" }, centrifuge: { h: 42, top: "#aab6b8" },
  terminal: { h: 50, top: "#2a2f36" }, sofa: { h: 42, top: "#a04a3a" }, bath: { h: 40, top: "#f4efe2" }, stanchion: { h: 42, top: "#f2cf3f" },
  extinguisher: { h: 45, top: "#d9483d" }, tray: { h: 0 },
};

/** Props drawn as camera-facing sprites instead of boxes. */
const BILLBOARD_KINDS = new Set<Gen2Prop["kind"]>(["plant", "plantBed", "tray", "cutPlant"]);
const DECOR_KINDS = new Set<Gen2Prop["kind"]>(["windowPane", "wallSign", "clock", "poster", "vent", "bulletin", "wallLight", "extCabinet"]);

export type WallDecor = { kind: Gen2Prop["kind"]; variant?: string; label?: string; room?: string; w: number; idx: number; outside: boolean };
export type Billboard = { x: number; y: number; prop: Gen2Prop; kind: "plant" | "monitor" | "board" };

export type WalkWorld = {
  w: number;
  h: number;
  /** Box height in percent: 0 = rays pass, 100 = full wall, between = low box. */
  hgt: Uint8Array;
  /** Index into texKeys (wall / prop front texture). */
  texId: Uint16Array;
  texKeys: string[];
  /** Top-face colour (packed ABGR) of low boxes. */
  topCol: Uint32Array;
  /** Room index owning a boundary wall cell, or -1. */
  wallRoom: Int16Array;
  /** Room index of every cell inside a room rectangle (walls included), or -1 for hallway / void. */
  roomIdx: Int16Array;
  doorCell: Uint8Array;
  floorId: Uint8Array;
  /** 0 none, 1 fluorescent panel, 2 grow light. */
  ceilLamp: Uint8Array;
  /** Ambient light multipliers (0..255) per colour channel. */
  lightR: Uint8Array;
  lightG: Uint8Array;
  lightB: Uint8Array;
  decor: Map<number, WallDecor>;
  billboards: Billboard[];
  /** The prop a box cell was built from (for text labels). */
  boxProp: Map<number, Gen2Prop>;
};

const ROOM_LIGHT: Record<string, [number, number, number]> = {
  boss: [250, 228, 190], clone: [238, 214, 238], mother: [238, 214, 238], grow: [238, 210, 240], vm: [190, 214, 238], security: [135, 158, 205],
  warehouse: [205, 205, 198], extraction: [225, 222, 200], maintenance: [210, 208, 196], break: [235, 245, 250], bathroom: [235, 248, 250],
};
const HALL_LIGHT: [number, number, number] = [236, 236, 230];
const DEFAULT_LIGHT: [number, number, number] = [242, 240, 232];

function hexToAbgr(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
}

function floorForKind(kind: string) {
  if (kind === "boss") return FLOOR.wood;
  if (kind === "break" || kind === "bathroom") return FLOOR.blue;
  if (kind === "security") return FLOOR.dark;
  if (kind === "warehouse" || kind === "extraction" || kind === "vm") return FLOOR.grey;
  return FLOOR.lab;
}

let cached: { walkable: Set<string>; world: WalkWorld } | undefined;

/** Builds (once) the raycaster's cell data from the same facility data and walkable set the dashboard uses. */
export function buildWalkWorld(walkable: Set<string>): WalkWorld {
  if (cached && cached.walkable === walkable) return cached.world;
  const W = GEN2_W;
  const H = GEN2_H;
  const N = W * H;
  const hgt = new Uint8Array(N);
  const texId = new Uint16Array(N);
  const texKeys: string[] = [""];
  const texIndex = new Map<string, number>();
  const idFor = (key: string) => {
    let id = texIndex.get(key);
    if (id === undefined) {
      id = texKeys.length;
      texKeys.push(key);
      texIndex.set(key, id);
    }
    return id;
  };
  const topCol = new Uint32Array(N);
  const wallRoom = new Int16Array(N).fill(-1);
  const roomIdx = new Int16Array(N).fill(-1);
  const doorCell = new Uint8Array(N);
  const floorId = new Uint8Array(N);
  const ceilLamp = new Uint8Array(N);
  const decor = new Map<number, WallDecor>();
  const billboards: Billboard[] = [];
  const boxProp = new Map<number, Gen2Prop>();
  const at = (x: number, y: number) => y * W + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

  gen2Rooms.forEach((room, index) => {
    for (let y = room.y; y < room.y + room.h; y += 1) {
      for (let x = room.x; x < room.x + room.w; x += 1) {
        if (!inside(x, y)) continue;
        roomIdx[at(x, y)] = index;
        const boundary = x === room.x || x === room.x + room.w - 1 || y === room.y || y === room.y + room.h - 1;
        if (boundary) wallRoom[at(x, y)] = index;
      }
    }
  });

  // Prop footprints, tallest solid prop per cell wins.
  const propsAt = new Map<number, Gen2Prop[]>();
  for (const prop of gen2Props) {
    for (let y = prop.y; y < prop.y + (prop.h ?? 1); y += 1) {
      for (let x = prop.x; x < prop.x + (prop.w ?? 1); x += 1) {
        if (!inside(x, y)) continue;
        const list = propsAt.get(at(x, y));
        if (list) list.push(prop);
        else propsAt.set(at(x, y), [prop]);
      }
    }
  }

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = at(x, y);
      const open = walkable.has(tileKey(x, y));
      const room = roomIdx[i] >= 0 ? gen2Rooms[roomIdx[i]] : undefined;
      floorId[i] = open || room ? floorForKind(room?.kind ?? "hall") : FLOOR.void;
      if (open) {
        if (wallRoom[i] >= 0) doorCell[i] = 1;
        continue;
      }
      // Blocked cell: the tallest box prop on it, else a wall.
      let best: { h: number; kind: Gen2Prop["kind"]; prop: Gen2Prop } | undefined;
      let billboard = false;
      for (const prop of propsAt.get(i) ?? []) {
        if (!gen2PropBlocksMovement(prop)) continue;
        if (BILLBOARD_KINDS.has(prop.kind)) {
          billboard = true;
          continue;
        }
        const shape = BOX_SHAPES[prop.kind] ?? { h: 40, top: "#8a9d99" };
        if (shape.h > 0 && (!best || shape.h > best.h)) best = { h: shape.h, kind: prop.kind, prop };
      }
      if (best) {
        hgt[i] = best.h;
        texId[i] = idFor(`prop:${best.kind}`);
        boxProp.set(i, best.prop);
        topCol[i] = hexToAbgr(BOX_SHAPES[best.kind]?.top ?? "#8a9d99");
      } else if (billboard) {
        hgt[i] = 0;
      } else {
        hgt[i] = 100;
        texId[i] = idFor(wallRoom[i] >= 0 ? `wall:${gen2Rooms[wallRoom[i]].kind}` : "wall:ext");
      }
    }
  }

  // Plants (billboards), monitors, wall decor, ceiling lights, floor decals.
  const lampCells: number[] = [];
  for (const prop of gen2Props) {
    const pw = prop.w ?? 1;
    const ph = prop.h ?? 1;
    if (BILLBOARD_KINDS.has(prop.kind)) {
      for (let y = prop.y; y < prop.y + ph; y += 1) {
        for (let x = prop.x; x < prop.x + pw; x += 1) {
          if (inside(x, y) && hgt[at(x, y)] === 0) billboards.push({ x: x + 0.5, y: y + 0.5, prop: { ...prop, x, y, w: 1, h: 1 }, kind: "plant" });
        }
      }
    } else if (prop.kind === "whiteboard") {
      billboards.push({ x: prop.x + pw / 2, y: prop.y + ph / 2, prop, kind: "board" });
    } else if (prop.kind === "monitor") {
      if (inside(prop.x, prop.y) && hgt[at(prop.x, prop.y)] === 0) billboards.push({ x: prop.x + 0.5, y: prop.y + 0.5, prop, kind: "monitor" });
    } else if (DECOR_KINDS.has(prop.kind)) {
      for (let k = 0; k < pw; k += 1) {
        const x = prop.x + k;
        if (inside(x, prop.y) && hgt[at(x, prop.y)] === 100) {
          decor.set(at(x, prop.y), { kind: prop.kind, variant: prop.variant, label: prop.label, room: prop.room, w: pw, idx: k, outside: prop.kind === "extCabinet" });
        }
      }
    } else if (prop.kind === "growLight") {
      for (let k = 0; k < pw; k += 1) {
        for (let m = 0; m < ph; m += 1) {
          const x = prop.x + k;
          const y = prop.y + m;
          if (!inside(x, y)) continue;
          ceilLamp[at(x, y)] = 2;
          lampCells.push(at(x, y));
        }
      }
    } else if (prop.kind === "rug") {
      const id = prop.variant === "blue" ? FLOOR.rugBlue : prop.variant === "green" ? FLOOR.rugGreen : prop.variant === "brown" ? FLOOR.rugBrown : FLOOR.rugRed;
      for (let y = prop.y; y < prop.y + ph; y += 1) for (let x = prop.x; x < prop.x + pw; x += 1) if (inside(x, y) && floorId[at(x, y)] !== FLOOR.void) floorId[at(x, y)] = id;
    } else if (prop.kind === "decal" && (prop.variant === "hazard" || prop.variant === "lane")) {
      const id = prop.variant === "hazard" ? FLOOR.hazard : FLOOR.lane;
      for (let x = prop.x; x < prop.x + pw; x += 1) if (inside(x, prop.y) && floorId[at(x, prop.y)] !== FLOOR.void) floorId[at(x, prop.y)] = id;
    }
  }

  // Fluorescent panels on a sparse grid (security keeps the lights low).
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = at(x, y);
      if (ceilLamp[i] || (hgt[i] === 100)) continue;
      const kind = roomIdx[i] >= 0 ? gen2Rooms[roomIdx[i]].kind : "hall";
      const step = kind === "security" ? 6 : 3;
      if (x % step === 1 && y % step === 1) ceilLamp[i] = 1;
    }
  }

  // Ambient light per cell: room tint, with pink spill under the grow lights.
  const base = new Float32Array(N * 3);
  for (let i = 0; i < N; i += 1) {
    const kind = roomIdx[i] >= 0 ? gen2Rooms[roomIdx[i]].kind : "hall";
    const tint = ROOM_LIGHT[kind] ?? (kind === "hall" ? HALL_LIGHT : DEFAULT_LIGHT);
    base[i * 3] = tint[0];
    base[i * 3 + 1] = tint[1];
    base[i * 3 + 2] = tint[2];
  }
  for (const lamp of lampCells) {
    const lx = lamp % W;
    const ly = Math.floor(lamp / W);
    for (let dy = -3; dy <= 3; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        const x = lx + dx;
        const y = ly + dy;
        if (!inside(x, y)) continue;
        const fall = Math.max(0, 1 - Math.hypot(dx, dy) / 4);
        const i = at(x, y);
        base[i * 3] = Math.min(255, base[i * 3] + 14 * fall);
        base[i * 3 + 1] = Math.max(120, base[i * 3 + 1] - 6 * fall);
        base[i * 3 + 2] = Math.min(255, base[i * 3 + 2] + 22 * fall);
      }
    }
  }
  const lightR = new Uint8Array(N);
  const lightG = new Uint8Array(N);
  const lightB = new Uint8Array(N);
  for (let i = 0; i < N; i += 1) {
    lightR[i] = base[i * 3];
    lightG[i] = base[i * 3 + 1];
    lightB[i] = base[i * 3 + 2];
  }

  const world: WalkWorld = { w: W, h: H, hgt, texId, texKeys, topCol, wallRoom, roomIdx, doorCell, floorId, ceilLamp, lightR, lightG, lightB, decor, billboards, boxProp };
  cached = { walkable, world };
  return world;
}
