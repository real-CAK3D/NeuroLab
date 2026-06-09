import Phaser from "phaser";

type Direction = "down" | "up" | "left" | "right";
type TileKind = "void" | "floor" | "wall";
type RoomKind =
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
  | "warehouse"
  | "sales"
  | "research";

type RoomPlan = {
  name: string;
  kind: RoomKind;
  x: number;
  y: number;
  w: number;
  h: number;
  doors: Array<{ x: number; y: number; w?: number; h?: number }>;
};

type ActorRole = "boss" | "executive" | "cultivation" | "processing" | "science" | "security" | "logistics";

type NpcPlan = {
  role: ActorRole;
  x: number;
  y: number;
  direction: Direction;
  bounds: Phaser.Geom.Rectangle;
  wait: number;
  carrying?: boolean;
  route?: Array<{ x: number; y: number; face?: Direction }>;
};

const TILE = 16;
const WORLD_W = 108;
const WORLD_H = 62;
const VIEW_W = 1366;
const VIEW_H = 768;
const STEP_MS = 260;
const CAMERA_PAD = 160;

const PAL = {
  black: 0x11151d,
  ink: 0x24313a,
  outline: 0x3f4f5a,
  wallDark: 0x5f6566,
  wall: 0xbfc7bf,
  wallTop: 0xf0dfc7,
  floor: 0xe8f0ec,
  floorAlt: 0xd7e3df,
  floorMark: 0xf7f7dd,
  blueFloor: 0x8ec7d7,
  blueFloorAlt: 0x74adbf,
  greyFloor: 0x6b7277,
  greyFloorAlt: 0x4f565c,
  woodFloor: 0xb9874a,
  woodFloorAlt: 0xd0a45d,
  glass: 0xb7e4e2,
  white: 0xf7f7dd,
  red: 0xb54848,
  rug: 0xd45b52,
  wood: 0xb9874a,
  greenDark: 0x35744a,
  green: 0x62a35a,
  greenLite: 0x9acb72,
  blue: 0x447aa0,
  cyan: 0x69c7b8,
  yellow: 0xd5b557,
  box: 0xc99b57,
  metal: 0xb9c2c6,
  purple: 0x7e74ad,
} as const;

const DIRS: Record<Direction, Phaser.Math.Vector2> = {
  down: new Phaser.Math.Vector2(0, 1),
  up: new Phaser.Math.Vector2(0, -1),
  left: new Phaser.Math.Vector2(-1, 0),
  right: new Phaser.Math.Vector2(1, 0),
};

const ROOM_PLANS: RoomPlan[] = [
  { name: "Boss Office", kind: "boss", x: 2, y: 2, w: 17, h: 14, doors: [{ x: 9, y: 15, w: 4 }] },
  { name: "Clone Room", kind: "clone", x: 22, y: 2, w: 11, h: 10, doors: [{ x: 26, y: 11, w: 3 }] },
  { name: "Mother Room", kind: "mother", x: 33, y: 2, w: 15, h: 10, doors: [{ x: 38, y: 11, w: 3 }] },
  { name: "Grow Room 1", kind: "grow", x: 22, y: 13, w: 13, h: 9, doors: [{ x: 27, y: 21, w: 3 }] },
  { name: "Grow Room 2", kind: "grow", x: 35, y: 13, w: 13, h: 9, doors: [{ x: 40, y: 21, w: 3 }] },
  { name: "Soil/Nutrition", kind: "soil", x: 10, y: 25, w: 9, h: 10, doors: [{ x: 13, y: 25, w: 3 }] },
  { name: "Potting Area", kind: "potting", x: 22, y: 25, w: 12, h: 10, doors: [{ x: 26, y: 25, w: 3 }] },
  { name: "Cultivation Manager", kind: "manager", x: 34, y: 25, w: 14, h: 10, doors: [{ x: 39, y: 25, w: 3 }] },
  { name: "Processing/Trim", kind: "processing", x: 51, y: 2, w: 18, h: 12, doors: [{ x: 58, y: 13, w: 3 }] },
  { name: "Packaging", kind: "packaging", x: 70, y: 2, w: 10, h: 12, doors: [{ x: 73, y: 13, w: 3 }] },
  { name: "Extraction Lab", kind: "extraction", x: 81, y: 2, w: 12, h: 12, doors: [{ x: 85, y: 13, w: 3 }] },
  { name: "Security Office", kind: "security", x: 95, y: 2, w: 11, h: 15, doors: [{ x: 99, y: 16, w: 3 }] },
  { name: "Operations Office", kind: "manager", x: 51, y: 16, w: 13, h: 7, doors: [{ x: 56, y: 22, w: 3 }] },
  { name: "Break Room", kind: "break", x: 55, y: 27, w: 18, h: 11, doors: [{ x: 60, y: 27, w: 3 }, { x: 72, y: 31, h: 3 }] },
  { name: "Bathrooms", kind: "bathroom", x: 74, y: 27, w: 8, h: 10, doors: [{ x: 76, y: 27, w: 3 }] },
  { name: "Loading Dock", kind: "warehouse", x: 82, y: 42, w: 23, h: 6, doors: [{ x: 92, y: 42, w: 3 }, { x: 92, y: 47, w: 4 }] },
  { name: "Logistics/Warehouse", kind: "warehouse", x: 82, y: 48, w: 23, h: 12, doors: [{ x: 92, y: 48, w: 4 }] },
  { name: "Sales Office", kind: "sales", x: 2, y: 43, w: 26, h: 15, doors: [{ x: 12, y: 43, w: 4 }] },
  { name: "R&D Lab", kind: "research", x: 38, y: 43, w: 19, h: 15, doors: [{ x: 46, y: 43, w: 3 }] },
  { name: "R&D Test Room", kind: "research", x: 57, y: 43, w: 22, h: 15, doors: [{ x: 67, y: 43, w: 3 }] },
];

export class FacilityScene extends Phaser.Scene {
  private tiles: TileKind[][] = [];
  private blocked = new Set<string>();
  private npcs: Array<{
    plan: NpcPlan;
    tile: Phaser.Math.Vector2;
    direction: Direction;
    sprite: Phaser.GameObjects.Sprite;
    body: Phaser.GameObjects.Container;
    wait: number;
    routeIndex: number;
    moving?: { fromX: number; fromY: number; toX: number; toY: number; start: number };
  }> = [];
  private blinkers: Phaser.GameObjects.Rectangle[] = [];
  private minZoom = 0.7;
  private maxZoom = 2.75;
  private lastDrag?: Phaser.Math.Vector2;

  constructor() {
    super("FacilityScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#11151d");
    this.cameras.main.setRoundPixels(true);
    this.createTextures();
    this.buildCollisionMap();
    this.drawMap();
    this.addProps();
    this.addActors();
    this.setupOverviewCamera();

    this.time.addEvent({
      delay: 420,
      loop: true,
      callback: () => {
        for (let i = 0; i < this.blinkers.length; i += 1) this.blinkers[i].setVisible((this.time.now + i * 173) % 900 > 280);
      },
    });
  }

  update(time: number) {
    this.updateNpcs(time);
  }

  private setupOverviewCamera() {
    const camera = this.cameras.main;
    camera.setBounds(-CAMERA_PAD, -CAMERA_PAD, worldPixelWidth() + CAMERA_PAD * 2, worldPixelHeight() + CAMERA_PAD * 2);
    this.minZoom = Math.min(VIEW_W / worldPixelWidth(), VIEW_H / worldPixelHeight()) * 0.96;
    this.maxZoom = Math.max(2.75, this.minZoom * 3.6);
    camera.setZoom(this.minZoom);
    camera.centerOn(worldPixelWidth() / 2, worldPixelHeight() / 2);

    this.input.on("wheel", (pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number, _dz: number, event?: WheelEvent) => {
      event?.preventDefault();
      const before = pointer.positionToCamera(camera) as Phaser.Math.Vector2;
      const nextZoom = Phaser.Math.Clamp(camera.zoom * (dy > 0 ? 0.9 : 1.1), this.minZoom, this.maxZoom);
      camera.setZoom(nextZoom);
      const after = pointer.positionToCamera(camera) as Phaser.Math.Vector2;
      camera.scrollX += before.x - after.x;
      camera.scrollY += before.y - after.y;
      this.clampCamera();
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.lastDrag = new Phaser.Math.Vector2(pointer.x, pointer.y);
    });
    this.input.on("pointerup", () => {
      this.lastDrag = undefined;
    });
    this.input.on("pointerout", () => {
      this.lastDrag = undefined;
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const dragging = pointer.isDown || pointer.primaryDown || this.input.activePointer.isDown;
      if (!dragging || !this.lastDrag || camera.zoom <= this.minZoom + 0.01) return;
      camera.scrollX -= (pointer.x - this.lastDrag.x) / camera.zoom;
      camera.scrollY -= (pointer.y - this.lastDrag.y) / camera.zoom;
      this.lastDrag.set(pointer.x, pointer.y);
      this.clampCamera();
    });
  }

  private clampCamera() {
    const camera = this.cameras.main;
    const viewW = camera.width / camera.zoom;
    const viewH = camera.height / camera.zoom;
    camera.scrollX = Phaser.Math.Clamp(camera.scrollX, -CAMERA_PAD, Math.max(-CAMERA_PAD, worldPixelWidth() - viewW + CAMERA_PAD));
    camera.scrollY = Phaser.Math.Clamp(camera.scrollY, -CAMERA_PAD, Math.max(-CAMERA_PAD, worldPixelHeight() - viewH + CAMERA_PAD));
  }

  private buildCollisionMap() {
    this.tiles = Array.from({ length: WORLD_H }, () => Array.from<TileKind>({ length: WORLD_W }).fill("void"));
    this.blocked.clear();

    this.carveHall(2, 17, 101, 5);
    this.carveHall(2, 35, 102, 6);
    this.carveHall(18, 16, 5, 20);
    this.carveHall(48, 14, 4, 23);
    this.carveHall(80, 14, 5, 35);
    this.carveHall(28, 40, 55, 4);

    for (const room of ROOM_PLANS) this.carveRoom(room);

    for (let y = 1; y < WORLD_H - 1; y += 1) {
      for (let x = 1; x < WORLD_W - 1; x += 1) {
        if (this.tiles[y][x] !== "void") continue;
        if (this.neighborFloor(x, y)) this.tiles[y][x] = "wall";
      }
    }
  }

  private carveHall(x: number, y: number, w: number, h: number) {
    for (let ty = y; ty < y + h; ty += 1) {
      for (let tx = x; tx < x + w; tx += 1) this.setFloor(tx, ty);
    }
  }

  private carveRoom(room: RoomPlan) {
    for (let ty = room.y; ty < room.y + room.h; ty += 1) {
      for (let tx = room.x; tx < room.x + room.w; tx += 1) {
        const edge = tx === room.x || ty === room.y || tx === room.x + room.w - 1 || ty === room.y + room.h - 1;
        this.tiles[ty][tx] = edge ? "wall" : "floor";
      }
    }
    for (const door of room.doors) {
      const w = door.w ?? 1;
      const h = door.h ?? 1;
      for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) this.setFloor(door.x + dx, door.y + dy);
    }
  }

  private drawMap() {
    for (let y = 0; y < WORLD_H; y += 1) {
      for (let x = 0; x < WORLD_W; x += 1) {
        const kind = this.tiles[y][x];
        if (kind === "void") continue;
      const key = kind === "wall" ? wallKeyFor(this.tiles, x, y) : floorKey(x, y, floorStyleForTile(x, y));
        this.add.image(tilePx(x), tilePx(y), key).setOrigin(0).setDepth(y);
      }
    }

    for (const room of ROOM_PLANS) {
      this.drawRoomTrim(room);
      this.drawSign(room);
    }
  }

  private drawRoomTrim(room: RoomPlan) {
    const x = tilePx(room.x);
    const y = tilePx(room.y);
    const w = room.w * TILE;
    const h = room.h * TILE;
    this.add.rectangle(x + w / 2, y + 5, w - 12, 3, PAL.wallTop, 1).setDepth(room.y + 2);
    this.add.rectangle(x + 5, y + h / 2, 3, h - 14, PAL.outline, 1).setDepth(room.y + 2);
    this.add.rectangle(x + w - 5, y + h / 2, 3, h - 14, PAL.outline, 1).setDepth(room.y + 2);
    for (const door of room.doors) {
      const dw = (door.w ?? 1) * TILE;
      const dh = (door.h ?? 1) * TILE;
      const dx = tilePx(door.x);
      const dy = tilePx(door.y);
      this.add.rectangle(dx + dw / 2, dy + dh / 2, dw, dh, doorFloorColor(room), 1).setDepth(room.y + 3);
      if (door.w) {
        this.add.rectangle(dx + dw / 2, dy + 2, dw, 5, PAL.ink, 1).setDepth(room.y + 4);
        this.add.rectangle(dx + dw / 2, dy + 8, dw - 8, 4, PAL.wallTop, 1).setDepth(room.y + 5);
        this.add.rectangle(dx + 3, dy + 8, 4, 10, PAL.outline, 1).setDepth(room.y + 5);
        this.add.rectangle(dx + dw - 3, dy + 8, 4, 10, PAL.outline, 1).setDepth(room.y + 5);
      }
      if (door.h) {
        this.add.rectangle(dx + 2, dy + dh / 2, 5, dh, PAL.ink, 1).setDepth(room.y + 4);
        this.add.rectangle(dx + 8, dy + dh / 2, 4, dh - 8, PAL.wallTop, 1).setDepth(room.y + 5);
        this.add.rectangle(dx + 8, dy + 3, 10, 4, PAL.outline, 1).setDepth(room.y + 5);
        this.add.rectangle(dx + 8, dy + dh - 3, 10, 4, PAL.outline, 1).setDepth(room.y + 5);
      }
    }
  }

  private drawSign(room: RoomPlan) {
    const short = room.name
      .replace("Processing/Trim", "TRIM")
      .replace("Logistics/Warehouse", "WH")
      .replace("Operations Office", "OPS")
      .replace("Cultivation Manager", "MGR")
      .replace("Soil/Nutrition", "SOIL")
      .replace("Boss Office", "BOSS")
      .slice(0, 6)
      .toUpperCase();
    const x = tilePx(room.x + Math.floor(room.w / 2)) + 8;
    const y = tilePx(room.y) - 2;
    this.add.rectangle(x, y, Math.max(26, short.length * 5), 10, PAL.white, 1).setStrokeStyle(1, PAL.ink, 1).setDepth(700);
    this.add.text(x, y - 1, short, { fontFamily: "monospace", fontSize: "6px", color: "#24313a" }).setOrigin(0.5).setDepth(701);
  }

  private addProps() {
    for (const room of ROOM_PLANS) {
      if (room.kind === "boss") this.propsBoss(room);
      if (room.kind === "clone") this.propsClone(room);
      if (room.kind === "mother" || room.kind === "grow") this.propsGrow(room);
      if (room.kind === "soil") this.propsSoil(room);
      if (room.kind === "potting") this.propsPotting(room);
      if (room.kind === "manager") this.propsManager(room);
      if (room.kind === "processing") this.propsProcessing(room);
      if (room.kind === "packaging") this.propsPackaging(room);
      if (room.kind === "extraction") this.propsExtraction(room);
      if (room.kind === "security") this.propsSecurity(room);
      if (room.kind === "break") this.propsBreak(room);
      if (room.kind === "bathroom") this.propsBathroom(room);
      if (room.kind === "warehouse") this.propsWarehouse(room);
      if (room.kind === "sales") this.propsSales(room);
      if (room.kind === "research") this.propsResearch(room);
    }

    for (const [x, y] of [
      [4, 19],
      [34, 18],
      [68, 18],
      [100, 20],
      [7, 37],
      [34, 38],
      [75, 39],
      [100, 39],
      [31, 43],
    ]) this.addObject("plant", x, y, 1, 1);
  }

  private propsBoss(room: RoomPlan) {
    this.add.rectangle(tilePx(room.x + 8) + 8, tilePx(room.y + 8) + 8, 112, 72, 0x9b6b3c, 1).setStrokeStyle(2, 0x6f4a2c, 1).setDepth(60);
    this.addObject("desk", room.x + 6, room.y + 8, 5, 2);
    for (let i = 0; i < 5; i += 1) this.addObject("monitor", room.x + 3 + i * 2, room.y + 2, 1, 1);
    this.addObject("plant", room.x + 2, room.y + 12, 1, 1);
    this.addObject("plant", room.x + 14, room.y + 12, 1, 1);
  }

  private propsClone(room: RoomPlan) {
    this.addObject("grow-light", room.x + 2, room.y + 2, 7, 1);
    this.addObject("water-vat", room.x + room.w - 3, room.y + 3, 2, 3);
    this.addObject("irrigation", room.x + 2, room.y + 8, 7, 1);
    for (let row = 0; row < 2; row += 1) for (let col = 0; col < 4; col += 1) this.addObject("tray", room.x + 2 + col * 2, room.y + 4 + row * 2, 1, 1);
  }

  private propsGrow(room: RoomPlan) {
    this.addObject("grow-light", room.x + 2, room.y + 2, room.w - 4, 1);
    this.addObject("irrigation", room.x + 2, room.y + room.h - 2, room.w - 4, 1);
    this.addObject("co2", room.x + room.w - 3, room.y + 3, 1, 3);
    for (let y = room.y + 4; y < room.y + room.h - 2; y += 2) {
      for (let x = room.x + 2; x < room.x + room.w - 2; x += 2) this.addObject("plant-pot", x, y, 1, 1);
    }
  }

  private propsSoil(room: RoomPlan) {
    for (let i = 0; i < 4; i += 1) this.addObject("barrel", room.x + 2 + (i % 2) * 2, room.y + 2 + Math.floor(i / 2) * 2, 1, 1);
    this.addObject("water-vat", room.x + 6, room.y + 2, 2, 3);
    this.addObject("sack", room.x + 5, room.y + 6, 1, 1);
    this.addObject("sack", room.x + 6, room.y + 3, 1, 1);
  }

  private propsPotting(room: RoomPlan) {
    this.addObject("workbench", room.x + 2, room.y + 2, 7, 2);
    this.addObject("soil-pile", room.x + 3, room.y + 6, 2, 2);
    this.addObject("soil-pile", room.x + 8, room.y + 6, 2, 2);
  }

  private propsManager(room: RoomPlan) {
    this.addObject("desk", room.x + 2, room.y + 5, 4, 2);
    this.addObject("whiteboard", room.x + 7, room.y + 2, 5, 2);
    this.addObject("plant", room.x + 2, room.y + 2, 1, 1);
  }

  private propsProcessing(room: RoomPlan) {
    for (let x = room.x + 2; x < room.x + room.w - 3; x += 5) this.addObject("trim-table", x, room.y + 4, 4, 2);
    this.addObject("trim-table", room.x + 6, room.y + 8, 5, 2);
    this.addObject("dry-rack", room.x + 13, room.y + 3, 3, 3);
    this.addObject("bins", room.x + 14, room.y + 8, 2, 2);
  }

  private propsPackaging(room: RoomPlan) {
    for (let y = room.y + 2; y < room.y + 8; y += 2) this.addObject("crate-stack", room.x + 2, y, 3, 1);
    this.addObject("scale", room.x + 6, room.y + 7, 1, 1);
    this.addObject("box", room.x + 5, room.y + 9, 1, 1);
  }

  private propsExtraction(room: RoomPlan) {
    this.addObject("tank", room.x + 2, room.y + 4, 2, 4);
    this.addObject("tank", room.x + 6, room.y + 3, 2, 5);
    this.addObject("machine", room.x + 8, room.y + 7, 2, 3);
    this.addObject("extractor", room.x + 4, room.y + 8, 4, 2);
    this.addObject("pipes", room.x + 2, room.y + 2, 8, 1);
  }

  private propsSecurity(room: RoomPlan) {
    this.addObject("camera-bank", room.x + 2, room.y + 2, 7, 4);
    for (let y = room.y + 2; y <= room.y + 5; y += 2) for (let x = room.x + 2; x <= room.x + 7; x += 2) this.addObject("monitor", x, y, 1, 1);
    this.addObject("desk", room.x + 3, room.y + 10, 4, 2);
    this.addObject("red-panel", room.x + 8, room.y + 7, 1, 1);
  }

  private propsBreak(room: RoomPlan) {
    this.addObject("table", room.x + 4, room.y + 5, 4, 2);
    this.addObject("table", room.x + 11, room.y + 5, 4, 2);
    this.addObject("vending", room.x + 14, room.y + 2, 2, 2);
    this.addObject("shelf", room.x + 3, room.y + 2, 4, 1);
  }

  private propsBathroom(room: RoomPlan) {
    this.addObject("toilet", room.x + 2, room.y + 2, 1, 2);
    this.addObject("toilet", room.x + 5, room.y + 2, 1, 2);
    this.addObject("sink", room.x + 2, room.y + 7, 4, 1);
  }

  private propsWarehouse(room: RoomPlan) {
    for (let x = room.x + 2; x < room.x + room.w - 3; x += 6) this.addObject("shelf", x, room.y + 2, 4, 2);
    this.addObject("crate-stack", room.x + 3, room.y + room.h - 4, 3, 2);
    this.addObject("crate-stack", room.x + room.w - 6, room.y + room.h - 4, 3, 2);
    this.addObject("pallet", room.x + 11, room.y + room.h - 3, 5, 2);
  }

  private propsSales(room: RoomPlan) {
    this.addObject("conference", room.x + 8, room.y + 7, 10, 3);
    this.addObject("whiteboard", room.x + 18, room.y + 3, 5, 2);
    this.addObject("water", room.x + 3, room.y + 3, 1, 1);
    this.addObject("plant", room.x + 2, room.y + 12, 1, 1);
  }

  private propsResearch(room: RoomPlan) {
    this.addObject("lab-table", room.x + 3, room.y + 5, 5, 2);
    this.addObject("terminal", room.x + room.w - 5, room.y + 3, 2, 2);
    this.addObject("whiteboard", room.x + 8, room.y + 2, 5, 2);
    this.addObject("sample-rack", room.x + room.w - 4, room.y + 9, 2, 3);
  }

  private addObject(type: string, x: number, y: number, w: number, h: number) {
    const px = tilePx(x);
    const py = tilePx(y);
    const d = y + h + 100;
    const g = this.add.graphics().setDepth(d);

    if (type === "desk") drawBlock(g, px, py, w * TILE, h * TILE, PAL.wood);
    else if (type === "monitor") this.drawMonitor(px, py, d);
    else if (type === "plant" || type === "plant-pot") this.drawPlant(px, py, type === "plant-pot");
    else if (type === "grow-light") this.drawGrowLight(px, py, w * TILE);
    else if (type === "tray") drawTray(g, px, py);
    else if (type === "barrel") drawBarrel(g, px, py);
    else if (type === "water-vat") drawWaterVat(g, px, py, w * TILE, h * TILE);
    else if (type === "co2") drawCo2(g, px, py, h * TILE);
    else if (type === "irrigation") drawIrrigation(g, px, py, w * TILE);
    else if (type === "dry-rack") drawDryRack(g, px, py, w * TILE, h * TILE);
    else if (type === "extractor") drawExtractor(g, px, py, w * TILE, h * TILE);
    else if (type === "camera-bank") drawCameraBank(g, px, py, w * TILE, h * TILE);
    else if (type === "sack") drawSack(g, px, py);
    else if (type === "workbench" || type === "trim-table" || type === "table" || type === "lab-table") drawBlock(g, px, py, w * TILE, h * TILE, type === "table" ? PAL.cyan : PAL.metal);
    else if (type === "soil-pile") drawSoil(g, px, py, w * TILE, h * TILE);
    else if (type === "whiteboard") drawWhiteboard(g, px, py, w * TILE, h * TILE);
    else if (type === "bins") drawBins(g, px, py);
    else if (type === "crate-stack") drawCrates(g, px, py, w, h);
    else if (type === "scale") drawScale(g, px, py);
    else if (type === "box") drawBox(g, px, py);
    else if (type === "tank") drawTank(g, px, py, w * TILE, h * TILE);
    else if (type === "machine") this.drawMachine(px, py, w * TILE, h * TILE);
    else if (type === "pipes") drawPipes(g, px, py, w * TILE);
    else if (type === "red-panel") this.drawPanel(px, py, PAL.red);
    else if (type === "vending") this.drawPanel(px, py, PAL.blue);
    else if (type === "shelf") drawShelf(g, px, py, w * TILE, h * TILE);
    else if (type === "toilet") drawToilet(g, px, py);
    else if (type === "sink") drawSink(g, px, py, w * TILE);
    else if (type === "pallet") drawPallet(g, px, py, w * TILE, h * TILE);
    else if (type === "conference") drawConference(g, px, py, w * TILE, h * TILE);
    else if (type === "water") drawWater(g, px, py);
    else if (type === "terminal") this.drawTerminal(px, py);
    else if (type === "sample-rack") drawSampleRack(g, px, py);

    if (!["plant-pot", "grow-light", "monitor", "red-panel", "terminal", "irrigation", "camera-bank"].includes(type)) this.blockArea(x, y, w, h);
  }

  private drawMonitor(px: number, py: number, depth: number) {
    const screen = this.add.rectangle(px + 8, py + 7, 14, 10, PAL.ink, 1).setStrokeStyle(1, PAL.wallTop, 1).setDepth(depth);
    const line = this.add.rectangle(px + 8, py + 7, 8, 2, PAL.greenLite, 1).setDepth(depth + 1);
    this.blinkers.push(line);
    return screen;
  }

  private drawTerminal(px: number, py: number) {
    drawBlock(this.add.graphics().setDepth(py / TILE + 130), px, py, 32, 28, PAL.metal);
    this.drawMonitor(px + 8, py + 2, py / TILE + 140);
    this.blockArea(px / TILE, py / TILE, 2, 2);
  }

  private drawPanel(px: number, py: number, color: number) {
    const panel = this.add.rectangle(px + 8, py + 8, 12, 14, PAL.ink, 1).setStrokeStyle(1, color, 1).setDepth(180);
    const light = this.add.rectangle(px + 8, py + 6, 6, 3, color, 1).setDepth(181);
    this.blinkers.push(panel, light);
  }

  private drawMachine(px: number, py: number, w: number, h: number) {
    const g = this.add.graphics().setDepth(py / TILE + 130);
    drawBlock(g, px, py, w, h, PAL.metal);
    const light = this.add.rectangle(px + w - 10, py + 9, 5, 5, PAL.greenLite, 1).setDepth(py / TILE + 131);
    this.blinkers.push(light);
    this.blockArea(px / TILE, py / TILE, w / TILE, h / TILE);
  }

  private drawGrowLight(px: number, py: number, width: number) {
    const bar = this.add.rectangle(px + width / 2, py + 5, width - 4, 5, PAL.white, 1).setStrokeStyle(1, PAL.outline, 1).setDepth(py / TILE + 120);
    const glow = this.add.rectangle(px + width / 2, py + 13, width - 10, 12, PAL.greenLite, 0.22).setDepth(py / TILE + 119);
    this.blinkers.push(bar, glow);
  }

  private drawPlant(px: number, py: number, pot: boolean) {
    const g = this.add.graphics().setDepth(py / TILE + 145);
    if (pot) drawBlock(g, px + 3, py + 10, 10, 5, PAL.wood);
    else drawBlock(g, px + 3, py + 9, 10, 6, PAL.blue);
    g.fillStyle(PAL.greenDark, 1).fillRect(px + 5, py + 4, 6, 7).fillRect(px + 2, py + 6, 5, 5).fillRect(px + 9, py + 2, 5, 7);
    g.fillStyle(PAL.greenLite, 1).fillRect(px + 7, py + 1, 4, 4);
    if (!pot) this.blockArea(px / TILE, py / TILE, 1, 1);
  }

  private addActors() {
    const plans: NpcPlan[] = [
      { role: "boss", x: 10, y: 10, direction: "down", bounds: new Phaser.Geom.Rectangle(4, 4, 12, 10), wait: 1200 },
      { role: "cultivation", x: 29, y: 8, direction: "left", bounds: new Phaser.Geom.Rectangle(24, 4, 8, 6), wait: 500 },
      { role: "cultivation", x: 40, y: 17, direction: "down", bounds: new Phaser.Geom.Rectangle(37, 15, 9, 5), wait: 400 },
      { role: "cultivation", x: 28, y: 31, direction: "right", bounds: new Phaser.Geom.Rectangle(24, 27, 8, 6), wait: 600 },
      { role: "processing", x: 62, y: 10, direction: "left", bounds: new Phaser.Geom.Rectangle(53, 5, 14, 7), wait: 450 },
      { role: "processing", x: 75, y: 10, direction: "down", bounds: new Phaser.Geom.Rectangle(72, 5, 6, 7), wait: 700 },
      { role: "science", x: 66, y: 51, direction: "left", bounds: new Phaser.Geom.Rectangle(59, 46, 16, 10), wait: 900 },
      { role: "science", x: 48, y: 51, direction: "right", bounds: new Phaser.Geom.Rectangle(41, 46, 13, 10), wait: 650 },
      { role: "security", x: 100, y: 13, direction: "up", bounds: new Phaser.Geom.Rectangle(96, 5, 8, 10), wait: 900 },
      {
        role: "security",
        x: 93,
        y: 38,
        direction: "left",
        bounds: new Phaser.Geom.Rectangle(2, 17, 102, 24),
        wait: 260,
        route: [
          { x: 99, y: 20, face: "up" },
          { x: 93, y: 38, face: "left" },
          { x: 80, y: 38, face: "right" },
          { x: 80, y: 20, face: "up" },
        ],
      },
      {
        role: "logistics",
        x: 93,
        y: 54,
        direction: "left",
        bounds: new Phaser.Geom.Rectangle(80, 42, 24, 18),
        wait: 240,
        carrying: true,
        route: [
          { x: 96, y: 54, face: "right" },
          { x: 92, y: 45, face: "up" },
          { x: 88, y: 38, face: "left" },
          { x: 94, y: 50, face: "down" },
        ],
      },
      {
        role: "executive",
        x: 63,
        y: 34,
        direction: "down",
        bounds: new Phaser.Geom.Rectangle(48, 17, 32, 24),
        wait: 320,
        route: [
          { x: 63, y: 34, face: "down" },
          { x: 57, y: 20, face: "up" },
          { x: 72, y: 20, face: "right" },
          { x: 69, y: 35, face: "left" },
        ],
      },
    ];

    for (const plan of plans) {
      const sprite = this.add.sprite(0, -5, actorTexture(plan.role, plan.direction, 0)).setOrigin(0.5, 0.86);
      sprite.setScale(1.22);
      const body = this.add.container(tileCenter(plan.x), tileCenter(plan.y), [sprite]).setDepth(900 + plan.y);
      if (plan.carrying) body.add(this.add.image(9, -4, "carry-box").setOrigin(0.5, 0.5));
      this.npcs.push({ plan, tile: new Phaser.Math.Vector2(plan.x, plan.y), direction: plan.direction, sprite, body, wait: plan.wait, routeIndex: 0 });
    }
  }

  private updateNpcs(time: number) {
    for (const npc of this.npcs) {
      if (npc.moving) {
        const done = this.stepActor(npc.body, npc.sprite, npc.moving, npc.direction, time, npc.plan.role);
        npc.body.setDepth(900 + npc.body.y);
        if (done) {
          npc.tile.set(npc.moving.toX, npc.moving.toY);
          npc.moving = undefined;
          npc.wait = npc.plan.wait + Phaser.Math.Between(160, npc.plan.route ? 620 : 1300);
        }
        continue;
      }

      npc.wait -= this.game.loop.delta;
      npc.sprite.setTexture(actorTexture(npc.plan.role, npc.direction, 0));
      if (npc.wait > 0) continue;

      if (npc.plan.route?.length) {
        const target = npc.plan.route[npc.routeIndex];
        if (npc.tile.x === target.x && npc.tile.y === target.y) {
          if (target.face) npc.direction = target.face;
          npc.routeIndex = (npc.routeIndex + 1) % npc.plan.route.length;
          npc.wait = npc.plan.wait + Phaser.Math.Between(420, 1200);
          continue;
        }
        const step = this.nextPathStep(npc.tile, target, npc);
        if (step) this.startNpcStep(npc, step);
        else npc.wait = 480;
        continue;
      }

      const choices = Phaser.Utils.Array.Shuffle(["down", "up", "left", "right"] as Direction[]);
      const picked = choices.find((dir) => {
        const t = npc.tile.clone().add(DIRS[dir]);
        return npc.plan.bounds.contains(t.x, t.y) && this.isWalkable(t.x, t.y) && !this.isOccupiedByNpc(t.x, t.y);
      });

      if (!picked) {
        npc.direction = choices[0];
        npc.wait = npc.plan.wait;
        continue;
      }

      this.startNpcStep(npc, npc.tile.clone().add(DIRS[picked]));
    }
  }

  private startNpcStep(npc: (typeof this.npcs)[number], target: Phaser.Math.Vector2) {
    const dx = target.x - npc.tile.x;
    const dy = target.y - npc.tile.y;
    npc.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    npc.moving = { fromX: npc.tile.x, fromY: npc.tile.y, toX: target.x, toY: target.y, start: this.time.now };
  }

  private nextPathStep(from: Phaser.Math.Vector2, target: { x: number; y: number }, npc: (typeof this.npcs)[number]) {
    const queue: Array<{ x: number; y: number; first?: Phaser.Math.Vector2 }> = [{ x: from.x, y: from.y }];
    const visited = new Set<string>([key(from.x, from.y)]);
    while (queue.length) {
      const current = queue.shift();
      if (!current) break;
      for (const dir of ["down", "up", "left", "right"] as Direction[]) {
        const next = { x: current.x + DIRS[dir].x, y: current.y + DIRS[dir].y };
        const nextKey = key(next.x, next.y);
        if (visited.has(nextKey)) continue;
        if (!npc.plan.bounds.contains(next.x, next.y) || !this.isWalkable(next.x, next.y)) continue;
        if (this.isOccupiedByNpc(next.x, next.y, npc)) continue;
        const first = current.first ?? new Phaser.Math.Vector2(next.x, next.y);
        if (next.x === target.x && next.y === target.y) return first;
        visited.add(nextKey);
        queue.push({ ...next, first });
      }
    }
    return undefined;
  }

  private stepActor(
    body: Phaser.GameObjects.Container,
    sprite: Phaser.GameObjects.Sprite,
    move: { fromX: number; fromY: number; toX: number; toY: number; start: number },
    direction: Direction,
    time: number,
    role: ActorRole,
  ) {
    const progress = Math.min(1, (time - move.start) / STEP_MS);
    const x = Phaser.Math.Linear(tileCenter(move.fromX), tileCenter(move.toX), progress);
    const y = Phaser.Math.Linear(tileCenter(move.fromY), tileCenter(move.toY), progress);
    body.setPosition(Math.round(x), Math.round(y));
    const frame = progress < 0.5 ? 1 : 2;
    sprite.setTexture(actorTexture(role, direction, frame));
    sprite.y = -6;
    return progress >= 1;
  }

  private isWalkable(x: number, y: number) {
    if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return false;
    if (this.tiles[y][x] !== "floor") return false;
    if (this.blocked.has(key(x, y))) return false;
    return true;
  }

  private isOccupiedByNpc(x: number, y: number, except?: (typeof this.npcs)[number]) {
    return this.npcs.some((npc) => npc !== except && npc.tile.x === x && npc.tile.y === y);
  }

  private setFloor(x: number, y: number) {
    if (x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H) this.tiles[y][x] = "floor";
  }

  private neighborFloor(x: number, y: number) {
    return this.tiles[y - 1]?.[x] === "floor" || this.tiles[y + 1]?.[x] === "floor" || this.tiles[y]?.[x - 1] === "floor" || this.tiles[y]?.[x + 1] === "floor";
  }

  private blockArea(x: number, y: number, w: number, h: number) {
    for (let ty = y; ty < y + h; ty += 1) for (let tx = x; tx < x + w; tx += 1) this.blocked.add(key(tx, ty));
  }

  private createTextures() {
    makeTile(this, "floor-lab-a", PAL.floor, PAL.floorAlt, "lab");
    makeTile(this, "floor-lab-b", PAL.floorAlt, PAL.floor, "lab");
    makeTile(this, "floor-blue-a", PAL.blueFloor, PAL.blueFloorAlt, "blue");
    makeTile(this, "floor-blue-b", PAL.blueFloorAlt, PAL.blueFloor, "blue");
    makeTile(this, "floor-grey-a", PAL.greyFloor, PAL.greyFloorAlt, "grey");
    makeTile(this, "floor-grey-b", PAL.greyFloorAlt, PAL.greyFloor, "grey");
    makeTile(this, "floor-wood-a", PAL.woodFloor, PAL.woodFloorAlt, "wood");
    makeTile(this, "floor-wood-b", PAL.woodFloorAlt, PAL.woodFloor, "wood");
    makeWall(this, "wall");
    makeWall(this, "wall-shadow", PAL.wallDark);
    makeCarryBox(this);
    for (const role of ["boss", "executive", "cultivation", "processing", "science", "security", "logistics"] as ActorRole[]) {
      for (const direction of ["down", "up", "left", "right"] as Direction[]) {
        for (let frame = 0; frame < 3; frame += 1) makeActor(this, role, direction, frame);
      }
    }
  }
}

function makeTile(scene: Phaser.Scene, keyName: string, base: number, line: number, style: "lab" | "blue" | "grey" | "wood") {
  if (scene.textures.exists(keyName)) return;
  const g = scene.add.graphics();
  g.fillStyle(base, 1).fillRect(0, 0, TILE, TILE);
  if (style === "wood") {
    g.fillStyle(line, 1).fillRect(0, 0, TILE, 2).fillRect(0, 8, TILE, 2);
    g.fillStyle(0x8c6338, 1).fillRect(2, 3, 9, 1).fillRect(6, 12, 8, 1);
  } else {
    g.fillStyle(line, 1).fillRect(0, 0, TILE, 1).fillRect(0, 0, 1, TILE);
    if (style === "lab") {
      g.fillStyle(PAL.floorMark, 1).fillRect(2, 2, 2, 2).fillRect(11, 11, 2, 2);
      g.fillStyle(0xb8c8c4, 0.65).fillRect(15, 0, 1, TILE).fillRect(0, 15, TILE, 1);
    } else if (style === "blue") {
      g.fillStyle(0xb9e5ef, 1).fillRect(7, 2, 2, 12).fillRect(2, 7, 12, 2);
    } else {
      g.fillStyle(0x2e3438, 1).fillRect(0, 15, TILE, 1).fillRect(15, 0, 1, TILE);
      g.fillStyle(0x90989c, 1).fillRect(3, 3, 3, 2).fillRect(10, 10, 3, 2);
    }
  }
  g.generateTexture(keyName, TILE, TILE);
  g.destroy();
}

function makeWall(scene: Phaser.Scene, keyName: string, shade: number = PAL.wall) {
  if (scene.textures.exists(keyName)) return;
  const g = scene.add.graphics();
  g.fillStyle(PAL.ink, 1).fillRect(0, 0, TILE, TILE);
  g.fillStyle(shade, 1).fillRect(1, 1, 14, 14);
  g.fillStyle(PAL.wallTop, 1).fillRect(1, 1, 14, 4);
  g.fillStyle(PAL.outline, 1).fillRect(1, 13, 14, 2).fillRect(13, 4, 2, 9);
  g.generateTexture(keyName, TILE, TILE);
  g.destroy();
}

function makeCarryBox(scene: Phaser.Scene) {
  if (scene.textures.exists("carry-box")) return;
  const g = scene.add.graphics();
  drawBlock(g, 0, 0, 12, 10, PAL.box);
  g.generateTexture("carry-box", 12, 10);
  g.destroy();
}

function makeActor(scene: Phaser.Scene, role: ActorRole, direction: Direction, frame: number) {
  const keyName = actorTexture(role, direction, frame);
  if (scene.textures.exists(keyName)) return;
  const accent = roleAccent(role);
  const g = scene.add.graphics();
  const skin = role === "security" ? 0x8f6d52 : 0xd8aa7a;
  const hair = role === "boss" ? 0x202020 : 0x5b3b2b;
  const body = role === "boss" ? 0x222832 : role === "science" ? 0xf0f0df : accent;
  const step = frame === 0 ? 0 : frame === 1 ? -1 : 1;

  g.fillStyle(0x000000, 0).fillRect(0, 0, 14, 18);
  pix(g, PAL.ink, 4, 0, 6, 2);
  pix(g, PAL.ink, 3, 2, 8, 5);
  pix(g, skin, 4, 3, 6, 4);
  pix(g, hair, 3, 2, 8, 2);
  if (role === "cultivation" || role === "logistics" || role === "security") pix(g, accent, 3, 1, 8, 3);
  if (direction === "down") {
    pix(g, PAL.ink, 4, 5, 2, 1);
    pix(g, PAL.ink, 8, 5, 2, 1);
  } else if (direction === "up") {
    pix(g, hair, 4, 4, 6, 2);
  } else if (direction === "left") {
    pix(g, PAL.ink, 3, 5, 2, 1);
  } else {
    pix(g, PAL.ink, 9, 5, 2, 1);
  }

  pix(g, PAL.ink, 3, 8, 8, 6);
  pix(g, body, 4, 9, 6, 4);
  pix(g, accent, 4, 10, 6, 2);

  if (direction === "left" || direction === "right") {
    const forward = direction === "left" ? -1 : 1;
    pix(g, PAL.ink, forward < 0 ? 1 : 10, 9 + (step > 0 ? 1 : 0), 3, 5);
    pix(g, body, forward < 0 ? 2 : 10, 10 + (step > 0 ? 1 : 0), 2, 3);
    pix(g, PAL.ink, forward < 0 ? 10 : 1, 9 + (step < 0 ? 1 : 0), 3, 5);
    pix(g, body, forward < 0 ? 10 : 2, 10 + (step < 0 ? 1 : 0), 2, 3);
  } else {
    pix(g, PAL.ink, 1, 9 + (step > 0 ? 1 : 0), 3, 5);
    pix(g, PAL.ink, 10, 9 + (step < 0 ? 1 : 0), 3, 5);
    pix(g, body, 2, 10 + (step > 0 ? 1 : 0), 2, 3);
    pix(g, body, 10, 10 + (step < 0 ? 1 : 0), 2, 3);
  }

  const leftFootY = 16 + (step < 0 ? 1 : 0);
  const rightFootY = 16 + (step > 0 ? 1 : 0);
  pix(g, PAL.ink, 4, 14, 3, 3);
  pix(g, PAL.ink, 7, 14, 3, 3);
  pix(g, body, 5, 14, 1, 2);
  pix(g, body, 8, 14, 1, 2);
  pix(g, PAL.ink, step < 0 ? 3 : 4, leftFootY, 4, 2);
  pix(g, PAL.ink, step > 0 ? 8 : 7, rightFootY, 4, 2);
  g.generateTexture(keyName, 14, 18);
  g.destroy();
}

function actorTexture(role: ActorRole, direction: Direction, frame: number) {
  return `actor-${role}-${direction}-${frame}`;
}

function roleAccent(role: ActorRole) {
  return {
    boss: PAL.red,
    executive: PAL.blue,
    cultivation: PAL.green,
    processing: 0x5b9dcc,
    science: PAL.purple,
    security: 0x37404c,
    logistics: 0x2f74a0,
  }[role];
}

function pix(g: Phaser.GameObjects.Graphics, color: number, x: number, y: number, w: number, h: number) {
  g.fillStyle(color, 1).fillRect(x, y, w, h);
}

function drawBlock(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number) {
  g.fillStyle(PAL.ink, 1).fillRect(x, y, w, h);
  g.fillStyle(color, 1).fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle(PAL.white, 0.45).fillRect(x + 2, y + 2, w - 4, 3);
  g.fillStyle(PAL.outline, 0.65).fillRect(x + 2, y + h - 4, w - 4, 2);
}

function drawTray(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  drawBlock(g, x + 2, y + 4, 12, 9, PAL.metal);
  g.fillStyle(PAL.green, 1).fillRect(x + 4, y + 6, 3, 3).fillRect(x + 9, y + 7, 3, 3);
}

function drawBarrel(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  drawBlock(g, x + 3, y + 2, 10, 13, PAL.blue);
  g.fillStyle(PAL.white, 0.5).fillRect(x + 4, y + 4, 8, 2);
}

function drawWaterVat(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  drawBlock(g, x + 2, y + 1, w - 4, h - 2, PAL.cyan);
  g.fillStyle(PAL.white, 0.72).fillRect(x + 5, y + 4, w - 10, 3);
  g.fillStyle(PAL.blue, 1).fillRect(x + 6, y + h - 8, w - 12, 3);
}

function drawCo2(g: Phaser.GameObjects.Graphics, x: number, y: number, h: number) {
  drawBlock(g, x + 4, y + 1, 8, h - 2, PAL.metal);
  g.fillStyle(PAL.white, 1).fillRect(x + 6, y + 5, 4, h - 11);
  g.fillStyle(PAL.ink, 1).fillRect(x + 5, y + 2, 6, 2);
}

function drawIrrigation(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number) {
  g.fillStyle(PAL.blue, 1).fillRect(x + 2, y + 7, w - 4, 3);
  for (let px = x + 7; px < x + w - 4; px += 16) g.fillStyle(PAL.cyan, 1).fillRect(px, y + 10, 2, 4);
}

function drawDryRack(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  drawBlock(g, x, y, w, h, PAL.wall);
  for (let yy = y + 6; yy < y + h - 4; yy += 8) {
    g.fillStyle(PAL.ink, 1).fillRect(x + 2, yy, w - 4, 2);
    for (let px = x + 5; px < x + w - 5; px += 8) g.fillStyle(PAL.greenDark, 1).fillRect(px, yy + 2, 3, 4);
  }
}

function drawExtractor(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  drawBlock(g, x, y, w, h, PAL.metal);
  g.fillStyle(PAL.ink, 1).fillRect(x + 6, y + 6, w - 12, 4);
  g.fillStyle(PAL.cyan, 1).fillRect(x + 8, y + h - 9, w - 16, 4);
  g.fillStyle(PAL.outline, 1).fillRect(x + 4, y - 5, 3, 8).fillRect(x + w - 7, y - 5, 3, 8);
}

function drawCameraBank(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  drawBlock(g, x, y, w, h, 0x24282d);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const px = x + 5 + col * 12;
      const py = y + 5 + row * 9;
      g.fillStyle(PAL.ink, 1).fillRect(px, py, 9, 6);
      g.fillStyle(row === 1 ? PAL.blue : PAL.greenLite, 1).fillRect(px + 2, py + 2, 5, 2);
    }
  }
}

function drawSack(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.fillStyle(PAL.ink, 1).fillRect(x + 2, y + 4, 12, 10);
  g.fillStyle(0xc6b06d, 1).fillRect(x + 3, y + 3, 10, 11);
  g.fillStyle(0x9b8450, 1).fillRect(x + 5, y + 10, 7, 2);
}

function drawSoil(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.fillStyle(0x594331, 1).fillRect(x + 3, y + 7, w - 6, h - 9);
  g.fillStyle(0x7a5a3f, 1).fillRect(x + 7, y + 4, w - 14, h - 8);
}

function drawWhiteboard(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  drawBlock(g, x, y, w, h, PAL.white);
  g.fillStyle(PAL.cyan, 1).fillRect(x + 4, y + 7, w - 12, 2);
  g.fillStyle(PAL.red, 1).fillRect(x + 7, y + 11, w - 18, 2);
}

function drawBins(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  drawBlock(g, x, y + 4, 12, 12, PAL.green);
  drawBlock(g, x + 14, y, 12, 12, PAL.blue);
  drawBlock(g, x + 8, y + 16, 12, 12, PAL.yellow);
}

function drawCrates(g: Phaser.GameObjects.Graphics, x: number, y: number, cols: number, rows: number) {
  for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) drawBox(g, x + col * 14, y + row * 13);
}

function drawBox(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  drawBlock(g, x + 1, y + 2, 13, 11, PAL.box);
  g.fillStyle(0x8f6a36, 1).fillRect(x + 7, y + 3, 2, 9);
}

function drawScale(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  drawBlock(g, x + 3, y + 8, 10, 5, PAL.metal);
  g.fillStyle(PAL.ink, 1).fillRect(x + 7, y + 2, 2, 7).fillRect(x + 3, y + 1, 10, 3);
}

function drawTank(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  drawBlock(g, x + 2, y, w - 4, h, PAL.metal);
  g.fillStyle(PAL.cyan, 1).fillRect(x + w / 2 - 5, y + 6, 10, h - 14);
}

function drawPipes(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number) {
  g.fillStyle(PAL.outline, 1).fillRect(x, y + 7, w, 4).fillRect(x + 10, y + 7, 4, 16).fillRect(x + w - 14, y + 7, 4, 18);
  g.fillStyle(PAL.wallTop, 1).fillRect(x, y + 7, w, 1);
}

function drawShelf(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  drawBlock(g, x, y, w, h, PAL.wall);
  for (let yy = y + 7; yy < y + h - 2; yy += 12) {
    g.fillStyle(PAL.ink, 1).fillRect(x + 2, yy, w - 4, 2);
    g.fillStyle(PAL.box, 1).fillRect(x + 5, yy - 5, 8, 5).fillRect(x + 17, yy - 5, 8, 5);
  }
}

function drawToilet(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  drawBlock(g, x + 4, y + 1, 8, 12, PAL.white);
  g.fillStyle(PAL.cyan, 1).fillRect(x + 5, y + 5, 6, 4);
}

function drawSink(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number) {
  drawBlock(g, x, y + 2, w, 10, PAL.white);
  g.fillStyle(PAL.cyan, 1).fillRect(x + 8, y + 5, w - 16, 4);
}

function drawPallet(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  drawBlock(g, x, y, w, h, 0xd6c18c);
  for (let xx = x + 5; xx < x + w - 3; xx += 12) g.fillStyle(0x8f6a36, 1).fillRect(xx, y + 2, 2, h - 4);
}

function drawConference(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  drawBlock(g, x, y, w, h, PAL.cyan);
  for (let i = 0; i < 5; i += 1) drawBlock(g, x + i * 18, y - 12, 10, 8, PAL.blue);
  for (let i = 0; i < 5; i += 1) drawBlock(g, x + i * 18, y + h + 4, 10, 8, PAL.blue);
}

function drawWater(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  drawBlock(g, x + 4, y + 1, 8, 14, PAL.blue);
  g.fillStyle(PAL.white, 1).fillRect(x + 5, y + 3, 6, 3);
}

function drawSampleRack(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  drawBlock(g, x, y, 24, 42, PAL.metal);
  for (let row = 0; row < 3; row += 1) for (let col = 0; col < 2; col += 1) g.fillStyle([PAL.green, PAL.cyan, PAL.purple][row], 1).fillRect(x + 5 + col * 10, y + 7 + row * 11, 5, 6);
}

function key(x: number, y: number) {
  return `${x},${y}`;
}

function tilePx(tile: number) {
  return tile * TILE;
}

function tileCenter(tile: number) {
  return tile * TILE + TILE / 2;
}

function worldPixelWidth() {
  return WORLD_W * TILE;
}

function worldPixelHeight() {
  return WORLD_H * TILE;
}

function floorKey(x: number, y: number, style: "lab" | "blue" | "grey" | "wood") {
  return `floor-${style}-${(x + y) % 2 === 0 ? "a" : "b"}`;
}

function floorStyleForTile(x: number, y: number): "lab" | "blue" | "grey" | "wood" {
  const room = ROOM_PLANS.find((item) => x > item.x && x < item.x + item.w - 1 && y > item.y && y < item.y + item.h - 1);
  if (!room) return "lab";
  if (room.kind === "boss") return "wood";
  if (room.kind === "break" || room.kind === "bathroom") return "blue";
  if (room.kind === "security" || room.kind === "warehouse" || room.kind === "extraction") return "grey";
  return "lab";
}

function doorFloorColor(room: RoomPlan) {
  const style = room.kind === "boss" ? "wood" : room.kind === "break" || room.kind === "bathroom" ? "blue" : room.kind === "security" || room.kind === "warehouse" || room.kind === "extraction" ? "grey" : "lab";
  return {
    lab: PAL.floor,
    blue: PAL.blueFloor,
    grey: PAL.greyFloor,
    wood: PAL.woodFloor,
  }[style];
}

function wallKeyFor(tiles: TileKind[][], x: number, y: number) {
  return tiles[y + 1]?.[x] === "floor" ? "wall-shadow" : "wall";
}
