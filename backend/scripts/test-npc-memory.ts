// Scratch-DB check of staff memories: `npx tsx scripts/test-npc-memory.ts`
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), "neurolab-mem-")), "mem.sqlite");
const { initDatabase } = await import("../src/database/db");
const { syncRoster, memoriesFor } = await import("../src/services/npcMemory");
const { getPersona, updatePersona } = await import("../src/services/npcChat");
const { calendarFacts } = await import("../src/services/calendar");

initDatabase();
const base = [
  { id: "gigi", name: "Gigi", title: "Grow Room 2 Technician", department: "Cultivation" },
  { id: "dan", name: "Dan", title: "Cultivation Manager", department: "Cultivation" },
  { id: "knox", name: "Knox", title: "Security Operator", department: "Security" },
];
syncRoster(base);
console.log("after baseline sync, gigi memories:", memoriesFor("gigi").length, "(expect 0)");
syncRoster([{ ...base[0], title: "Grow Room 2 Lead Technician" }, base[1], base[2]]);
console.log("promotion:", JSON.stringify(memoriesFor("gigi")));
console.log("witness (dan):", JSON.stringify(memoriesFor("dan")));
syncRoster([{ ...base[0], title: "Grow Room 2 Lead Technician" }, base[1], { ...base[2], department: "Operations", title: "Security Operator" }, { id: "sam", name: "Sam", title: "Packer", department: "Cultivation" }]);
console.log("transfer (knox):", JSON.stringify(memoriesFor("knox")));
console.log("new hire (sam):", JSON.stringify(memoriesFor("sam")), "| gigi sees coworker joined:", JSON.stringify(memoriesFor("gigi").filter((m) => m.kind === "coworker-joined")));
console.log("persona sample:", JSON.stringify(getPersona("gigi")).slice(0, 380));
console.log("edit persona:", updatePersona("gigi", { favoriteColor: "hot pink" }).favoriteColor);
console.log("calendar:\n  " + calendarFacts().join("\n  "));
