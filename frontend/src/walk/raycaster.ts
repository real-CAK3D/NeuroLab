import { GEN2_H, GEN2_W } from "../game/gen2FacilityData";
import type { FpRenderer } from "./WalkEngine";
import { buildStaffSprite, buildPlantSprite, ceilingPixel, decorTexture, EMIT_ALPHA, getDoorTexture, getFloorTexture, getMonitorSprite, getTexture, labeledTexture, loadImageData, panelTexture, TEX, type DecorExtra, type Tex } from "./textures";
import type { WalkHost, WalkNpc } from "./walkTypes";
import { buildWalkWorld, type Billboard, type WalkWorld } from "./walkWorld";

/** Grid raycaster over the facility tile map (Wolfenstein / Grimrock style), drawn into a small canvas that CSS upscales. */

const INTERNAL_H = 200;
const MIN_W = 240;
const MAX_W = 480;
const PLANE = 0.95;
const FOG_END = 13;
const FOG_R = 0x0d;
const FOG_G = 0x14;
const FOG_B = 0x1b;
const MAX_HITS = 48;
const OCC_SLOTS = 4;
const NPC_TWEEN_MS = 390;
const LOOK_REFRESH_MS = 600;
const LINTEL = 0.22;
const LABEL_DISTANCE = 3.8;
const LABELED_BOXES = new Set(["crate", "shelf", "rack", "dryRack", "cabinet", "machine", "vat", "terminal", "box", "barrel", "fridge"]);

/** Distance fog: 256 = fully lit, small = nearly fog colour. */
const FOG = new Uint16Array(512);
for (let i = 0; i < FOG.length; i += 1) {
  const d = i / 16;
  const t = Math.min(1, d / FOG_END);
  FOG[i] = Math.max(22, Math.round(256 * (1 - Math.pow(t, 1.05))));
}
function fogAt(dist: number) {
  const i = (dist * 16) | 0;
  return FOG[i > 511 ? 511 : i];
}

function shade(c: number, mr: number, mg: number, mb: number, ar: number, ag: number, ab: number) {
  const r = (((c & 255) * mr) >> 8) + ar;
  const g = ((((c >> 8) & 255) * mg) >> 8) + ag;
  const b = ((((c >> 16) & 255) * mb) >> 8) + ab;
  return (0xff000000 | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r)) & 0xfff8f8f8;
}

type NpcTrack = { fx: number; fy: number; tx: number; ty: number; t0: number; npc: WalkNpc };
type Camera = { x: number; y: number; angle: number };
type SpriteItem = { tex: Tex; x: number; y: number; depth: number; height: number; widthScale: number; lift: number; cell: number };

class Raycaster implements FpRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly world: WalkWorld;
  private image: ImageData;
  private buf: Uint32Array;
  private W = 360;
  private H = INTERNAL_H;
  private focal = 190;
  private zbuf = new Float32Array(360);
  private occN = new Uint8Array(360);
  private occT = new Float32Array(360 * OCC_SLOTS);
  private occY = new Float32Array(360 * OCC_SLOTS);
  private occLow = new Uint8Array(360 * OCC_SLOTS);
  private readonly texById: Array<Tex | undefined>;
  private readonly floorTex: Tex[] = [];
  private readonly doorTex = getDoorTexture();
  private readonly tracks = new Map<string, NpcTrack>();
  private readonly npcSprites = new Map<string, Tex>();
  private readonly plantSprites = new Map<string, Tex>();
  private readonly looks = new Map<number, { look: ReturnType<WalkHost["plantLook"]>; sprite?: Tex }>();
  private looksAt = -1e9;
  private readonly boardTex = new Map<Billboard, Tex>();
  private readonly labelCache = new Map<number, { until: number; tex?: Tex }>();
  private readonly signCache = new Map<string, { until: number; lines: string[] }>();
  private clockCache?: { until: number; value: { hours: number; minutes: number; text: string } };
  private frameNow = 0;
  // per-column hit scratch
  private hT = new Float32Array(MAX_HITS);
  private hExit = new Float32Array(MAX_HITS);
  private hIdx = new Int32Array(MAX_HITS);
  private hPrev = new Int32Array(MAX_HITS);
  private hSide = new Uint8Array(MAX_HITS);
  private hKind = new Uint8Array(MAX_HITS);
  private hFlip = new Uint8Array(MAX_HITS);
  private hTexX = new Uint8Array(MAX_HITS);
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly host: () => WalkHost, private readonly sheet: ImageData | null, private readonly plants: ImageData | null, private readonly pot: ImageData | null) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2d canvas unavailable");
    this.ctx = ctx;
    this.world = buildWalkWorld(host().walkable);
    this.texById = new Array(this.world.texKeys.length);
    for (let id = 0; id < 12; id += 1) this.floorTex[id] = getFloorTexture(id);
    this.image = ctx.createImageData(this.W, this.H);
    this.buf = new Uint32Array(this.image.data.buffer);
    this.allocate(this.W);
  }

  resize(cssWidth: number, cssHeight: number) {
    if (this.disposed || cssWidth < 10 || cssHeight < 10) return;
    const width = Math.max(MIN_W, Math.min(MAX_W, Math.round((INTERNAL_H * cssWidth) / cssHeight)));
    this.allocate(width);
  }

  private allocate(width: number) {
    this.W = width;
    this.H = INTERNAL_H;
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.focal = this.W / (2 * PLANE);
    this.image = this.ctx.createImageData(this.W, this.H);
    this.buf = new Uint32Array(this.image.data.buffer);
    this.zbuf = new Float32Array(this.W);
    this.occN = new Uint8Array(this.W);
    this.occT = new Float32Array(this.W * OCC_SLOTS);
    this.occY = new Float32Array(this.W * OCC_SLOTS);
    this.occLow = new Uint8Array(this.W * OCC_SLOTS);
  }

  dispose() {
    this.disposed = true;
    this.tracks.clear();
    this.npcSprites.clear();
    this.plantSprites.clear();
    this.looks.clear();
  }

  setNpcs(list: WalkNpc[], now: number) {
    const seen = new Set<string>();
    for (const npc of list) {
      seen.add(npc.id);
      const track = this.tracks.get(npc.id);
      if (!track) {
        this.tracks.set(npc.id, { fx: npc.x, fy: npc.y, tx: npc.x, ty: npc.y, t0: now - 10_000, npc });
        continue;
      }
      if (track.tx !== npc.x || track.ty !== npc.y) {
        const p = this.trackPos(track, now);
        track.fx = p.x;
        track.fy = p.y;
        track.tx = npc.x;
        track.ty = npc.y;
        track.t0 = now;
      }
      track.npc = npc;
    }
    for (const id of [...this.tracks.keys()]) if (!seen.has(id)) this.tracks.delete(id);
  }

  private trackPos(track: NpcTrack, now: number) {
    const t = Math.min(1, Math.max(0, (now - track.t0) / NPC_TWEEN_MS));
    return { x: track.fx + (track.tx - track.fx) * t, y: track.fy + (track.ty - track.fy) * t };
  }

  isAnimating(cam: Camera, now: number) {
    for (const track of this.tracks.values()) {
      if (now - track.t0 > NPC_TWEEN_MS + 20) continue;
      const dx = track.tx + 0.5 - cam.x;
      const dy = track.ty + 0.5 - cam.y;
      if (dx * dx + dy * dy > 15 * 15) continue;
      const forward = dx * Math.cos(cam.angle) + dy * Math.sin(cam.angle);
      if (forward > -1) return true;
    }
    return false;
  }

  private worldTex(id: number) {
    let tex = this.texById[id];
    if (!tex) {
      tex = getTexture(this.world.texKeys[id]);
      this.texById[id] = tex;
    }
    return tex;
  }

  render(cam: Camera, now: number) {
    if (this.disposed) return;
    this.frameNow = now;
    const { W, H, world, buf } = this;
    const dirX = Math.cos(cam.angle);
    const dirY = Math.sin(cam.angle);
    const planeX = -dirY * PLANE;
    const planeY = dirX * PLANE;
    const posX = cam.x;
    const posY = cam.y;
    const half = H >> 1;
    const f = this.focal;
    const { lightR, lightG, lightB, floorId, ceilLamp } = world;
    const mapW = world.w;
    const mapH = world.h;

    // ---- floor and ceiling ----
    for (let y = 0; y < H; y += 1) {
      const isFloor = y >= half;
      const p = isFloor ? y - half + 0.5 : half - y - 0.5;
      const rowDist = (0.5 * f) / p;
      const fog = fogAt(rowDist);
      const fa = (FOG_R * (256 - fog)) >> 8;
      const fb = (FOG_G * (256 - fog)) >> 8;
      const fc = (FOG_B * (256 - fog)) >> 8;
      let fx = posX + rowDist * (dirX - planeX);
      let fy = posY + rowDist * (dirY - planeY);
      const sx = (rowDist * 2 * planeX) / W;
      const sy = (rowDist * 2 * planeY) / W;
      let o = y * W;
      for (let x = 0; x < W; x += 1) {
        const cx = Math.floor(fx);
        const cy = Math.floor(fy);
        let c: number;
        if (cx < 0 || cy < 0 || cx >= mapW || cy >= mapH) {
          buf[o] = 0xff000000 | (FOG_B << 16) | (FOG_G << 8) | FOG_R;
        } else {
          const idx = cy * mapW + cx;
          const u = fx - cx;
          const v = fy - cy;
          if (isFloor) {
            const tex = this.floorTex[floorId[idx]];
            c = tex.d[(((v * TEX) | 0) << 6) + ((u * TEX) | 0)];
          } else {
            c = ceilingPixel(u, v, ceilLamp[idx]);
          }
          if ((c >>> 24) === EMIT_ALPHA) buf[o] = shade(c, fog, fog, fog, fa, fb, fc);
          else buf[o] = shade(c, (lightR[idx] * fog) >> 8, (lightG[idx] * fog) >> 8, (lightB[idx] * fog) >> 8, fa, fb, fc);
        }
        o += 1;
        fx += sx;
        fy += sy;
      }
    }

    // ---- walls, boxes and door lintels (painter's order per column) ----
    for (let x = 0; x < W; x += 1) {
      const cameraX = (2 * x) / W - 1;
      const rdx = dirX + planeX * cameraX;
      const rdy = dirY + planeY * cameraX;
      let mapX = Math.floor(posX);
      let mapY = Math.floor(posY);
      const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
      const ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
      const stepX = rdx < 0 ? -1 : 1;
      const stepY = rdy < 0 ? -1 : 1;
      let sideX = rdx < 0 ? (posX - mapX) * ddx : (mapX + 1 - posX) * ddx;
      let sideY = rdy < 0 ? (posY - mapY) * ddy : (mapY + 1 - posY) * ddy;
      let n = 0;
      let farT = 1e9;
      this.occN[x] = 0;
      for (let guard = 0; guard < 64 && n < MAX_HITS; guard += 1) {
        let side: number;
        let t: number;
        let prev: number;
        if (sideX < sideY) {
          prev = mapY * mapW + mapX;
          mapX += stepX;
          t = sideX;
          sideX += ddx;
          side = 0;
        } else {
          prev = mapY * mapW + mapX;
          mapY += stepY;
          t = sideY;
          sideY += ddy;
          side = 1;
        }
        if (mapX < 0 || mapY < 0 || mapX >= mapW || mapY >= mapH) {
          farT = t;
          break;
        }
        const idx = mapY * mapW + mapX;
        const h = world.hgt[idx];
        const isDoor = h === 0 && world.doorCell[idx] === 1;
        if (h === 0 && !isDoor) continue;
        const wallX0 = side === 0 ? posY + t * rdy : posX + t * rdx;
        let wallX = wallX0 - Math.floor(wallX0);
        // screen-right follows (-dirY, dirX), so u grows to the right on +x/+y facing sides and must flip on the others
        const flip = (side === 0 && rdx < 0) || (side === 1 && rdy > 0);
        if (flip) wallX = 1 - wallX;
        this.hFlip[n] = flip ? 1 : 0;
        this.hT[n] = t;
        this.hExit[n] = Math.min(sideX, sideY);
        this.hIdx[n] = idx;
        this.hPrev[n] = prev;
        this.hSide[n] = side;
        this.hKind[n] = h === 100 ? 0 : isDoor ? 2 : 1;
        this.hTexX[n] = Math.min(TEX - 1, (wallX * TEX) | 0);
        n += 1;
        if (h === 100) {
          farT = t;
          break;
        }
      }
      if (n === 0) {
        this.zbuf[x] = 1e9;
        continue;
      }
      let zWall = 1e9;
      if (this.hKind[n - 1] === 0) zWall = this.hT[n - 1];
      else if (farT < 1e8) zWall = farT;
      this.zbuf[x] = zWall;
      for (let i = n - 1; i >= 0; i -= 1) this.drawHit(x, i, zWall);
    }

    // ---- sprites ----
    this.frameNow = now;
    this.drawSprites(cam, now, dirX, dirY, planeX, planeY);
    this.ctx.putImageData(this.image, 0, 0);
  }

  private drawHit(x: number, i: number, zWall: number) {
    void zWall;
    const { world, buf, W, H } = this;
    const f = this.focal;
    const t = Math.max(this.hT[i], 0.05);
    const kind = this.hKind[i];
    const idx = this.hIdx[i];
    const prev = this.hPrev[i];
    const side = this.hSide[i];
    const half = H / 2;
    const fog = fogAt(t);
    const fa = (FOG_R * (256 - fog)) >> 8;
    const fb = (FOG_G * (256 - fog)) >> 8;
    const fc = (FOG_B * (256 - fog)) >> 8;
    let lr = world.lightR[prev];
    let lg = world.lightG[prev];
    let lb = world.lightB[prev];
    if (side === 1) {
      lr = (lr * 205) >> 8;
      lg = (lg * 205) >> 8;
      lb = (lb * 205) >> 8;
    }
    const mr = (lr * fog) >> 8;
    const mg = (lg * fog) >> 8;
    const mb = (lb * fog) >> 8;
    const line = f / t;
    const texX = this.hTexX[i];

    if (kind === 2) {
      // door frame: steel lintel with a status light, dark underside
      const top = half - 0.5 * line;
      const y1 = top + LINTEL * line;
      this.column(x, top, y1, this.doorTex, texX, 0, 14, mr, mg, mb, fa, fb, fc, fog);
      const tExit = Math.max(this.hExit[i], t + 0.01);
      const yFar = half - (0.5 - LINTEL) * (f / tExit);
      const under = shade(0xff3a4044, mr, mg, mb, fa, fb, fc);
      const ys = Math.max(0, Math.ceil(y1));
      const ye = Math.min(H, Math.ceil(yFar));
      for (let y = ys; y < ye; y += 1) buf[y * W + x] = under;
      this.pushOcc(x, t, yFar, false);
      return;
    }

    let tex: Tex;
    let heightFrac = 1;
    if (kind === 0) {
      tex = this.worldTex(world.texId[idx]);
      const room = world.wallRoom[idx];
      const decor = world.decor.get(idx);
      const interior = room >= 0 && world.roomIdx[prev] === room;
      if (room >= 0 && !interior) tex = getTexture("wall:ext");
      if (t < LABEL_DISTANCE && world.boxProp.has(idx)) tex = this.labelTex(idx, tex);
      if (decor && decor.outside !== interior) {
        const wallKey = world.texKeys[world.texId[idx]];
        tex = decorTexture(decor.kind, decor.variant, decor.label, decor.w, this.hFlip[i] ? decor.w - 1 - decor.idx : decor.idx, interior ? wallKey.slice(5) : "ext", this.decorExtra(decor.kind, decor.room));
      }
    } else {
      tex = this.worldTex(world.texId[idx]);
      heightFrac = world.hgt[idx] / 100;
      if (t < LABEL_DISTANCE) tex = this.labelTex(idx, tex);
      if (heightFrac < 0.5) {
        const tExit = Math.max(this.hExit[i], t + 0.01);
        const yNear = half + (0.5 - heightFrac) * line;
        const yFar = half + (0.5 - heightFrac) * (f / tExit);
        const topC = shade(world.topCol[idx], mr, mg, mb, fa, fb, fc);
        const ys = Math.max(0, Math.ceil(yFar));
        const ye = Math.min(H, Math.ceil(yNear));
        for (let y = ys; y < ye; y += 1) buf[y * W + x] = topC;
        this.pushOcc(x, t, yFar, true);
      } else {
        this.pushOcc(x, t, half - (heightFrac - 0.5) * line, true);
      }
    }
    const top = half - (heightFrac - 0.5) * line;
    const bottom = half + 0.5 * line;
    this.column(x, top, bottom, tex, texX, 0, TEX, mr, mg, mb, fa, fb, fc, fog);
  }

  /** One textured vertical strip between screen rows top..bottom, taking texture rows v0..v1. */
  private column(x: number, top: number, bottom: number, tex: Tex, texX: number, v0: number, v1: number, mr: number, mg: number, mb: number, fa: number, fb: number, fc: number, fog: number) {
    const { buf, W, H } = this;
    const span = bottom - top;
    if (span <= 0) return;
    const y0 = Math.max(0, Math.floor(top));
    const y1 = Math.min(H - 1, Math.ceil(bottom) - 1);
    const vStep = (v1 - v0) / span;
    let v = v0 + (y0 + 0.5 - top) * vStep;
    const d = tex.d;
    for (let y = y0; y <= y1; y += 1) {
      const vi = v < 0 ? 0 : v >= TEX ? TEX - 1 : v | 0;
      const c = d[(vi << 6) + texX];
      if ((c >>> 24) === EMIT_ALPHA) buf[y * W + x] = shade(c, fog, fog, fog, fa, fb, fc);
      else buf[y * W + x] = shade(c, mr, mg, mb, fa, fb, fc);
      v += vStep;
    }
  }

  private pushOcc(x: number, t: number, y: number, low: boolean) {
    const n = this.occN[x];
    if (n >= OCC_SLOTS) return;
    const k = x * OCC_SLOTS + n;
    this.occT[k] = t;
    this.occY[k] = y;
    this.occLow[k] = low ? 1 : 0;
    this.occN[x] = n + 1;
  }

  // ---- text-bearing faces (regenerated when their data changes, cached by content) ----

  private clockInfo() {
    const now = this.frameNow;
    if (!this.clockCache || now > this.clockCache.until) this.clockCache = { until: now + 1000, value: this.host().clock() };
    return this.clockCache.value;
  }

  private roomLines(kind: "sign" | "notice", room: string) {
    const key = `${kind}|${room}`;
    const hit = this.signCache.get(key);
    if (hit && this.frameNow < hit.until) return hit.lines;
    const host = this.host();
    const lines = kind === "sign" ? host.signLines(room) : host.noticeLines(room);
    this.signCache.set(key, { until: this.frameNow + LOOK_REFRESH_MS, lines });
    return lines;
  }

  private decorExtra(kind: string, room: string | undefined): DecorExtra | undefined {
    if (kind === "clock") return { clock: this.clockInfo() };
    if (!room) return undefined;
    if (kind === "wallSign") return { lines: this.roomLines("sign", room) };
    if (kind === "bulletin") return { lines: this.roomLines("notice", room) };
    return undefined;
  }

  private labelTex(idx: number, base: Tex): Tex {
    const prop = this.world.boxProp.get(idx);
    if (!prop || !LABELED_BOXES.has(prop.kind)) return base;
    const hit = this.labelCache.get(idx);
    if (hit && this.frameNow < hit.until) return hit.tex ?? base;
    const lines = this.host().readout(prop);
    const tex = lines && lines.length ? labeledTexture(this.world.texKeys[this.world.texId[idx]], lines) : undefined;
    this.labelCache.set(idx, { until: this.frameNow + LOOK_REFRESH_MS, tex });
    return tex ?? base;
  }

  // ---- billboards ----

  private npcTex(npc: WalkNpc, camAngle: number): Tex | undefined {
    if (!this.sheet) return undefined;
    const facing = npc.dir === "right" ? 0 : npc.dir === "down" ? Math.PI / 2 : npc.dir === "left" ? Math.PI : -Math.PI / 2;
    let rel = facing - camAngle;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    const abs = Math.abs(rel);
    const shown = abs < Math.PI / 4 ? "up" : abs > (3 * Math.PI) / 4 ? "down" : rel > 0 ? "right" : "left";
    const hat = npc.hatColor ?? "#f4efe2";
    const shoe = npc.shoeColor ?? "#f4efe2";
    const key = `${shown}|${npc.stepFrame}|${hat}|${shoe}`;
    let tex = this.npcSprites.get(key);
    if (!tex) {
      tex = buildStaffSprite(this.sheet, shown, npc.stepFrame, hat, shoe);
      this.npcSprites.set(key, tex);
    }
    return tex;
  }

  private refreshLooks(now: number, cam: Camera) {
    if (now - this.looksAt < LOOK_REFRESH_MS) return;
    this.looksAt = now;
    const host = this.host();
    const { billboards, w } = this.world;
    for (const b of billboards) {
      if (b.kind !== "plant") {
        if (Math.abs(b.x - cam.x) > 11 || Math.abs(b.y - cam.y) > 11) continue;
        const lines = host.readout(b.prop);
        if (!lines) continue;
        if (b.kind === "monitor") this.boardTex.set(b, panelTexture(lines, 96, 64, lines.some((line) => /ALERT|WARN|WATCH/.test(line)) ? "alert" : "screen"));
        else this.boardTex.set(b, panelTexture(lines, 64 * (b.prop.w ?? 1), 44, "board"));
        continue;
      }
      const idx = Math.floor(b.y) * w + Math.floor(b.x);
      const look = host.plantLook(b.prop);
      const entry = this.looks.get(idx);
      if (entry && JSON.stringify(entry.look) === JSON.stringify(look)) continue;
      let sprite: Tex | undefined;
      if (look) {
        const key = look === "pot" ? "pot" : `${look.col},${look.row}`;
        sprite = this.plantSprites.get(key);
        if (!sprite) {
          sprite = buildPlantSprite(this.plants, this.pot, look);
          this.plantSprites.set(key, sprite);
        }
      }
      this.looks.set(idx, { look, sprite });
    }
  }

  private drawSprites(cam: Camera, now: number, dirX: number, dirY: number, planeX: number, planeY: number) {
    const { W, H, world } = this;
    const f = this.focal;
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    this.refreshLooks(now, cam);
    const items: SpriteItem[] = [];
    const consider = (tex: Tex | undefined, sx: number, sy: number, height: number, widthScale: number, lift: number) => {
      if (!tex) return;
      const dx = sx - cam.x;
      const dy = sy - cam.y;
      const depth = invDet * (-planeY * dx + planeX * dy);
      if (depth < 0.18 || depth > FOG_END) return;
      const cell = Math.floor(sy) * world.w + Math.floor(sx);
      items.push({ tex, x: invDet * (dirY * dx - dirX * dy), y: 0, depth, height, widthScale, lift, cell });
    };
    for (const b of world.billboards) {
      if (b.kind === "monitor") consider(this.boardTex.get(b) ?? getMonitorSprite(), b.x, b.y, 0.5, 1, 0.3);
      else if (b.kind === "board") consider(this.boardTex.get(b), b.x, b.y, 0.5, 1, 0.32);
      else consider(this.looks.get(Math.floor(b.y) * world.w + Math.floor(b.x))?.sprite, b.x, b.y, 0.74, 1, 0);
    }
    for (const track of this.tracks.values()) {
      const p = this.trackPos(track, now);
      consider(this.npcTex(track.npc, cam.angle), p.x + 0.5, p.y + 0.5, 0.7, 1, 0);
    }
    items.sort((a, b) => b.depth - a.depth);
    for (const s of items) {
      const scale = f / s.depth;
      const spriteH = scale * s.height;
      const spriteW = spriteH * (s.tex.w / s.tex.h) * s.widthScale;
      const screenX = (W / 2) * (1 + s.x / s.depth);
      const bottom = H / 2 + (0.5 - s.lift) * scale;
      const top = bottom - spriteH;
      const x0 = Math.floor(screenX - spriteW / 2);
      const x1 = Math.ceil(screenX + spriteW / 2);
      const fog = fogAt(s.depth);
      const fa = (FOG_R * (256 - fog)) >> 8;
      const fb = (FOG_G * (256 - fog)) >> 8;
      const fc = (FOG_B * (256 - fog)) >> 8;
      const mr = (world.lightR[s.cell] * fog) >> 8;
      const mg = (world.lightG[s.cell] * fog) >> 8;
      const mb = (world.lightB[s.cell] * fog) >> 8;
      const tw = s.tex.w;
      const th = s.tex.h;
      for (let x = Math.max(0, x0); x < Math.min(W, x1); x += 1) {
        if (s.depth >= this.zbuf[x]) continue;
        let yMin = Math.max(0, Math.floor(top));
        let yMax = Math.min(H - 1, Math.ceil(bottom) - 1);
        const n = this.occN[x];
        for (let k = 0; k < n; k += 1) {
          const slot = x * OCC_SLOTS + k;
          if (this.occT[slot] >= s.depth) continue;
          if (this.occLow[slot]) yMax = Math.min(yMax, Math.ceil(this.occY[slot]) - 1);
          else yMin = Math.max(yMin, Math.ceil(this.occY[slot]));
        }
        if (yMin > yMax) continue;
        const tx = Math.min(tw - 1, Math.max(0, (((x + 0.5 - (screenX - spriteW / 2)) / spriteW) * tw) | 0));
        const vStep = th / (bottom - top);
        let v = (yMin + 0.5 - top) * vStep;
        for (let y = yMin; y <= yMax; y += 1) {
          const ty = v < 0 ? 0 : v >= th ? th - 1 : v | 0;
          const c = s.tex.d[ty * tw + tx];
          v += vStep;
          const a = c >>> 24;
          if (a < 128) continue;
          this.buf[y * W + x] = a === EMIT_ALPHA ? shade(c, fog, fog, fog, fa, fb, fc) : shade(c, mr, mg, mb, fa, fb, fc);
        }
      }
    }
  }
}

export async function createRaycaster(canvas: HTMLCanvasElement, host: () => WalkHost): Promise<FpRenderer> {
  const [sheet, plants, pot] = await Promise.all([
    loadImageData("/assets/portfolio-spritesheet.png"),
    loadImageData("/assets/tiles/plants.png"),
    loadImageData("/assets/tiles/pot.png"),
  ]);
  return new Raycaster(canvas, host, sheet, plants, pot);
}

// keep the map size constants referenced so a layout change is a compile-time reminder
export const WALK_MAP_SIZE = { w: GEN2_W, h: GEN2_H };
