import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workdir = join(root, 'local', 'checks');
mkdirSync(workdir, { recursive: true });
const entry = join(workdir, 'facility-check-entry.ts');
const outfile = join(workdir, 'facility-check-entry.mjs');

writeFileSync(entry, String.raw`import { GEN2_H, GEN2_W, gen2PropBlocksMovement, gen2Hallways, gen2Npcs, gen2Props, gen2Rooms, type Gen2Prop, type Gen2Room } from '../../src/game/gen2FacilityData';

const failures: string[] = [];
const warnings: string[] = [];

function rect(item: { x: number; y: number; w?: number; h?: number }) {
  return { x: item.x, y: item.y, w: item.w ?? 1, h: item.h ?? 1 };
}
function rectsOverlap(a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function containsRect(container: ReturnType<typeof rect>, child: ReturnType<typeof rect>) {
  return child.x >= container.x && child.y >= container.y && child.x + child.w <= container.x + container.w && child.y + child.h <= container.y + container.h;
}
function inMap(item: ReturnType<typeof rect>) {
  return item.x >= 0 && item.y >= 0 && item.x + item.w <= GEN2_W && item.y + item.h <= GEN2_H;
}
function fill(set: Set<string>, x: number, y: number, w: number, h: number) {
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) set.add(String(xx) + ',' + String(yy));
}
function cellsForDoor(room: Gen2Room, door: Gen2Room['doors'][number]) {
  const size = door.size ?? 2;
  const cells: Array<{ x: number; y: number }> = [];
  const pushRect = (x: number, y: number, w: number, h: number) => {
    for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) cells.push({ x: xx, y: yy });
  };
  if (door.side === 'top') pushRect(room.x + door.at, room.y, size, 2);
  if (door.side === 'bottom') pushRect(room.x + door.at, room.y + room.h - 2, size, 3);
  if (door.side === 'left') pushRect(room.x, room.y + door.at, 2, size);
  if (door.side === 'right') pushRect(room.x + room.w - 2, room.y + door.at, 3, size);
  return cells;
}
const propBlocksMovement = gen2PropBlocksMovement;
function nearestRoomForProp(prop: Gen2Prop) {
  const propRect = rect(prop);
  return gen2Rooms.find((room) => containsRect(rect(room), propRect));
}

const roomIds = new Set<string>();
const hallwayTiles = new Set<string>();
for (const hall of gen2Hallways) fill(hallwayTiles, hall.x, hall.y, hall.w, hall.h);

for (const room of gen2Rooms) {
  if (roomIds.has(room.id)) failures.push('duplicate room id: ' + room.id);
  roomIds.add(room.id);
  if (room.w < 3 || room.h < 3) failures.push(room.id + ' is too small for walls/interior: ' + room.w + 'x' + room.h);
  if (!inMap(rect(room))) failures.push(room.id + ' outside map bounds at ' + room.x + ',' + room.y + ' ' + room.w + 'x' + room.h);
  if (!room.doors.length) warnings.push(room.id + ' has no doors');
  for (const [index, door] of room.doors.entries()) {
    const size = door.size ?? 2;
    if (size < 1) failures.push(room.id + ' door[' + index + '] has invalid size ' + size);
    const span = door.side === 'top' || door.side === 'bottom' ? room.w : room.h;
    if (door.at < 0 || door.at + size > span) failures.push(room.id + ' door[' + index + '] overflows ' + door.side + ' wall: at=' + door.at + ' size=' + size);
    const cells = cellsForDoor(room, door);
    if (cells.some((cell) => cell.x < 0 || cell.y < 0 || cell.x >= GEN2_W || cell.y >= GEN2_H)) failures.push(room.id + ' door[' + index + '] opens outside map bounds');
    if (!cells.some((cell) => hallwayTiles.has(String(cell.x) + ',' + String(cell.y)))) warnings.push(room.id + ' door[' + index + '] does not directly overlap a hallway tile');
  }
}

for (let i = 0; i < gen2Rooms.length; i += 1) {
  for (let j = i + 1; j < gen2Rooms.length; j += 1) {
    const a = gen2Rooms[i];
    const b = gen2Rooms[j];
    if (rectsOverlap(rect(a), rect(b))) failures.push('rooms overlap: ' + a.id + ' and ' + b.id);
  }
}

for (const [index, prop] of gen2Props.entries()) {
  const tag = prop.kind + '[' + index + ']';
  const propRect = rect(prop);
  if (!inMap(propRect)) failures.push(tag + ' outside map bounds at ' + prop.x + ',' + prop.y + ' ' + propRect.w + 'x' + propRect.h);
  if (prop.room && !roomIds.has(prop.room)) failures.push(tag + ' references missing room ' + prop.room);
  const container = prop.room ? gen2Rooms.find((room) => room.id === prop.room) : nearestRoomForProp(prop);
  if (prop.room && container && !containsRect(rect(container), propRect)) failures.push(tag + ' is outside declared room ' + prop.room);
  if (!prop.room && !container && !hallwayTiles.has(String(prop.x) + ',' + String(prop.y))) warnings.push(tag + ' is not inside any room and has no room id');
  if (propBlocksMovement(prop) && propRect.w * propRect.h > 32) warnings.push(tag + ' blocks ' + (propRect.w * propRect.h) + ' tiles; confirm routes avoid it');
}

const npcIds = new Set<string>();
for (const npc of gen2Npcs) {
  if (npcIds.has(npc.id)) failures.push('duplicate npc id: ' + npc.id);
  npcIds.add(npc.id);
  if (!inMap({ x: npc.x, y: npc.y, w: 1, h: 1 })) failures.push(npc.id + ' starts outside map bounds at ' + npc.x + ',' + npc.y);
  if (!npc.route.length) warnings.push(npc.id + ' has an empty route');
  for (const [index, step] of npc.route.entries()) {
    if (!inMap({ x: step.x, y: step.y, w: 1, h: 1 })) failures.push(npc.id + ' route[' + index + '] outside map bounds at ' + step.x + ',' + step.y);
  }
}

console.log(JSON.stringify({
  map: { width: GEN2_W, height: GEN2_H },
  rooms: gen2Rooms.length,
  hallways: gen2Hallways.length,
  props: gen2Props.length,
  npcs: gen2Npcs.length,
  warnings,
  failures,
}, null, 2));
if (failures.length) process.exit(1);
`);

buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent' });
await import(pathToFileURL(outfile).href);
rmSync(workdir, { recursive: true, force: true });
