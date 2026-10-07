import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workdir = join(root, 'local', 'checks');
mkdirSync(workdir, { recursive: true });
const entry = join(workdir, 'npc-boundaries-entry.ts');
const outfile = join(workdir, 'npc-boundaries-entry.mjs');

writeFileSync(entry, String.raw`import { gen2DecorProps, gen2Hallways, gen2PropBlocksMovement, gen2Npcs, gen2Props, gen2Rooms, type Gen2Npc, type Gen2Prop } from '../../src/game/gen2FacilityData';

type LiveNpc = Gen2Npc & { routeIndex: number; stepFrame: 0 | 1 | 2; pause: number };

function fill(set: Set<string>, x: number, y: number, w: number, h: number) {
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) set.add(\`\${xx},\${yy}\`);
}
function fillDoor(set: Set<string>, doorCells: Set<string>, x: number, y: number, w: number, h: number) {
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) { const key = \`\${xx},\${yy}\`; set.add(key); doorCells.add(key); }
}
const propBlocksMovement = gen2PropBlocksMovement;
function buildWalkable(withDecor = true) {
  const set = new Set<string>();
  const doorCells = new Set<string>();
  for (const hall of gen2Hallways) fill(set, hall.x, hall.y, hall.w, hall.h);
  for (const room of gen2Rooms) fill(set, room.x + 1, room.y + 1, room.w - 2, room.h - 2);
  for (const room of gen2Rooms) for (const door of room.doors) {
    const size = door.size ?? 2;
    if (door.side === 'top') fillDoor(set, doorCells, room.x + door.at, room.y, size, 2);
    if (door.side === 'bottom') fillDoor(set, doorCells, room.x + door.at, room.y + room.h - 2, size, 3);
    if (door.side === 'left') fillDoor(set, doorCells, room.x, room.y + door.at, 2, size);
    if (door.side === 'right') fillDoor(set, doorCells, room.x + room.w - 2, room.y + door.at, 3, size);
  }
  for (const room of gen2Rooms) for (let y = room.y; y < room.y + room.h; y += 1) for (let x = room.x; x < room.x + room.w; x += 1) {
    const isBoundary = x === room.x || x === room.x + room.w - 1 || y === room.y || y === room.y + room.h - 1;
    const key = \`\${x},\${y}\`;
    if (isBoundary && !doorCells.has(key)) set.delete(key);
  }
  for (const prop of gen2Props) {
    if (!withDecor && gen2DecorProps.includes(prop)) continue;
    if (!propBlocksMovement(prop)) continue;
    for (let y = prop.y; y < prop.y + (prop.h ?? 1); y += 1) for (let x = prop.x; x < prop.x + (prop.w ?? 1); x += 1) set.delete(\`\${x},\${y}\`);
  }
  return set;
}
function nearestWalkableGoal(to: { x: number; y: number }, walkable: Set<string>, maxDistance = 4) {
  if (walkable.has(\`\${to.x},\${to.y}\`)) return to;
  for (let distance = 1; distance <= maxDistance; distance += 1) for (let y = to.y - distance; y <= to.y + distance; y += 1) for (let x = to.x - distance; x <= to.x + distance; x += 1) {
    if (Math.abs(x - to.x) + Math.abs(y - to.y) !== distance) continue;
    if (walkable.has(\`\${x},\${y}\`)) return { x, y };
  }
  return undefined;
}
function firstWalkableRouteTile(npc: LiveNpc, walkable: Set<string>) {
  for (const step of npc.route) {
    const safe = nearestWalkableGoal(step, walkable, 18);
    if (safe) return safe;
  }
  return undefined;
}
function sanitizeNpcs(npcs: LiveNpc[], walkable: Set<string>) {
  return npcs.map((npc) => {
    const safePosition = nearestWalkableGoal({ x: npc.x, y: npc.y }, walkable, 18) ?? firstWalkableRouteTile(npc, walkable) ?? { x: npc.x, y: npc.y };
    const route = npc.route.map((step) => nearestWalkableGoal(step, walkable, 6) ? step : { ...step, ...(nearestWalkableGoal(step, walkable, 18) ?? { x: safePosition.x, y: safePosition.y }) });
    return { ...npc, x: safePosition.x, y: safePosition.y, route };
  });
}
const walkable = buildWalkable();
const initial = sanitizeNpcs(gen2Npcs.map((npc) => ({ ...npc, routeIndex: 0, stepFrame: 0 as const, pause: 0 })), walkable);
const failures: string[] = [];
for (const npc of initial) {
  if (!walkable.has(\`\${npc.x},\${npc.y}\`)) failures.push(\`\${npc.id} sanitized start outside walkable floor at \${npc.x},\${npc.y}\`);
  for (const [index, step] of npc.route.entries()) if (!nearestWalkableGoal(step, walkable, 6)) failures.push(\`\${npc.id} sanitized route[\${index}] unreachable near \${step.x},\${step.y}\`);
}

function floodFrom(walkable: Set<string>, start: { x: number; y: number }) {
  const seen = new Set<string>([start.x + ',' + start.y]);
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const cur = queue[head];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = (cur.x + dx) + ',' + (cur.y + dy);
      if (seen.has(key) || !walkable.has(key)) continue;
      seen.add(key);
      queue.push({ x: cur.x + dx, y: cur.y + dy });
    }
  }
  return seen;
}
function coveredByDecor(key: string) {
  const [x, y] = key.split(',').map(Number);
  return gen2Props.some((prop) => gen2DecorProps.includes(prop) && propBlocksMovement(prop) && x >= prop.x && x < prop.x + (prop.w ?? 1) && y >= prop.y && y < prop.y + (prop.h ?? 1));
}
const baseline = buildWalkable(false);
const seed = nearestWalkableGoal({ x: gen2Hallways[2].x, y: gen2Hallways[2].y }, walkable, 8)!;
const reachFull = floodFrom(walkable, seed);
const reachBase = floodFrom(baseline, seed);
for (const key of reachBase) {
  if (walkable.has(key) && !reachFull.has(key)) failures.push('scenery isolated walkable tile ' + key);
  if (!walkable.has(key) && !coveredByDecor(key)) failures.push('tile ' + key + ' lost walkability for a non-scenery reason');
}
const rawStops = gen2Npcs.flatMap((npc) => [{ id: npc.id, x: npc.x, y: npc.y }, ...npc.route.map((step, index) => ({ id: npc.id + ' route[' + index + ']', x: step.x, y: step.y }))]);
for (const stop of rawStops) {
  const key = stop.x + ',' + stop.y;
  if (baseline.has(key) && !walkable.has(key)) failures.push(stop.id + ' stop ' + key + ' is now blocked by scenery');
}
for (const room of gen2Rooms) {
  let reachableInterior = 0;
  for (let y = room.y + 1; y < room.y + room.h - 1; y += 1) for (let x = room.x + 1; x < room.x + room.w - 1; x += 1) if (reachFull.has(x + ',' + y)) reachableInterior += 1;
  if (!reachableInterior) failures.push(room.id + ' has no reachable interior tile');
}
console.log(JSON.stringify({ rooms: gen2Rooms.length, props: gen2Props.length, npcs: initial.length, walkableTiles: walkable.size, failures }, null, 2));
if (failures.length) process.exit(1);
`.replaceAll('\\`', '`').replaceAll('\\${', '${'));

buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent' });
await import(pathToFileURL(outfile).href);
rmSync(workdir, { recursive: true, force: true });
