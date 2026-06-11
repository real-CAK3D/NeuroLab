import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workdir = join(root, 'local', 'checks');
mkdirSync(workdir, { recursive: true });
const entry = join(workdir, 'facility-layout-api-check-entry.ts');
const outfile = join(workdir, 'facility-layout-api-check-entry.mjs');

writeFileSync(entry, String.raw`import { gen2Rooms } from '../../src/game/gen2FacilityData';

const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:3006';
const rooms = gen2Rooms.map((room) => ({ id: room.id, label: room.label, kind: room.kind, x: room.x, y: room.y, w: room.w, h: room.h, doors: room.doors }));
async function json(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.text();
  if (!response.ok) throw new Error(response.status + ' ' + body);
  return body ? JSON.parse(body) : null;
}
const before = await json(backendUrl + '/api/facility-layout');
const first = await json(backendUrl + '/api/facility-layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rooms, drafts: {}, note: 'verification checkpoint A' }) });
const second = await json(backendUrl + '/api/facility-layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rooms, drafts: {}, note: 'verification checkpoint B' }) });
const restored = await json(backendUrl + '/api/facility-layout/undo', { method: 'POST' });
console.log(JSON.stringify({
  beforeCurrent: before.current?.id ?? null,
  firstCurrent: first.current?.id,
  secondCurrent: second.current?.id,
  restoredCurrent: restored.current?.id,
  restoredNote: restored.current?.note,
  historyAfterRestore: restored.history.length,
  rooms: restored.current?.rooms?.length,
  failures: restored.current?.validation?.failures ?? [],
}, null, 2));
`);

buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent' });
await import(pathToFileURL(outfile).href);
rmSync(workdir, { recursive: true, force: true });
