// Fast-forward the crop lifecycle against a scratch database: `npx tsx scripts/simulate-lifecycle.ts [days]`
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), "neurolab-sim-")), "sim.sqlite");
const { initDatabase, db } = await import("../src/database/db");
const { initLifecycle, stepLifecycle, getLifecycleSnapshot } = await import("../src/services/lifecycle");

initDatabase();
initLifecycle();
const HOUR = 3_600_000;
const days = Number(process.argv[2] ?? 75);
const base = ["nukebox", "hack-safe", "the-bak3ry", "oracle-vm", "cak3d-creations"]; // hp-laptop and grow3/4 devices stay offline
let sim = 0;
const seen: Record<string, number> = {};
for (let hour = 0; hour < days * 24; hour += 1) {
  sim += HOUR;
  const day = hour / 24;
  const outage = day >= 12 && day < 17.5; // Hack-Safe (Grow Room 2) dark for 5.5 days
  const devices = base.map((id) => ({ id, online: !(id === "hack-safe" && outage), cpuPercent: 20, memoryPercent: 40 }));
  for (let pass = 0; pass < 20; pass += 1) if (!stepLifecycle(sim, pass === 0 ? HOUR : 0, devices)) break;
  void seen;
}
db.prepare("INSERT INTO settings (key, value) VALUES ('lc_sim_ms', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(sim));
const snapshot = getLifecycleSnapshot(base.map((id) => ({ id, online: true })));
const log = db.prepare("SELECT sim_at, kind, room, message FROM lifecycle_log ORDER BY id").all() as Array<{ sim_at: number; kind: string; room: string; message: string }>;
const kinds: Record<string, number> = {};
for (const row of log) kinds[row.kind] = (kinds[row.kind] ?? 0) + 1;
console.log("sim days:", (sim / 86_400_000).toFixed(1), "| log kinds:", JSON.stringify(kinds));
for (const row of log.filter((r) => ["room", "loss", "plant", "harvest", "mother"].includes(r.kind) && (r.room?.startsWith("grow") || r.room === "mother")).slice(0, 40)) console.log(`  day ${(row.sim_at / 86_400_000).toFixed(1).padStart(5)}  ${row.message}`);
console.log("--- first batch journey:");
const first = db.prepare("SELECT code FROM lifecycle_batches WHERE kind='flower' AND stage NOT IN ('lost') ORDER BY id LIMIT 1").get() as { code: string } | undefined;
for (const row of log.filter((r) => first && r.message.includes(first.code))) console.log(`  day ${(row.sim_at / 86_400_000).toFixed(1).padStart(5)}  ${row.message}`);
console.log("--- inventory:", JSON.stringify(snapshot.inventory), "| sales logged:", kinds.sale ?? 0, "| samples:", kinds.sample ?? 0);
console.log("--- batches by stage:", JSON.stringify((db.prepare("SELECT stage, COUNT(*) n FROM lifecycle_batches GROUP BY stage").all())));
console.log("--- mothers:", JSON.stringify((snapshot.rooms.mother as { mothers: unknown[] }).mothers));
console.log("--- rooms:", JSON.stringify(Object.fromEntries(["grow1", "grow2", "grow3", "grow4"].map((r) => [r, (snapshot.rooms[r] as { phase: string }).phase]))));
