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

// ---- calendar snapshot, decor windows, persona sanitizing, de-duplicated event memories ----
const { calendarSnapshot, decorFor } = await import("../src/services/calendar");
const { sanitizePersona } = await import("../src/services/npcChat");
const { addMemoryOnce } = await import("../src/services/npcMemory");
const fail = (message: string) => { console.error("FAIL:", message); process.exitCode = 1; };
const at = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 17));
const decorCases: Array<[Date, string | null]> = [
  [at(2026, 10, 14), null], [at(2026, 10, 15), "halloween"], [at(2026, 11, 1), "halloween"], [at(2026, 11, 2), null],
  [at(2026, 11, 20), "thanksgiving"], [at(2026, 12, 1), "christmas"], [at(2026, 12, 26), "christmas"], [at(2026, 12, 27), "newyear"],
  [at(2027, 1, 2), "newyear"], [at(2027, 1, 3), null], [at(2027, 2, 10), "valentines"], [at(2027, 3, 12), "stpatricks"],
  [at(2027, 3, 24), "easter"], // Easter 2027 is Mar 28
  [at(2027, 3, 28), "easter"], [at(2027, 3, 29), null], [at(2026, 6, 30), "fourth"], [at(2026, 7, 6), null],
  [at(2026, 4, 18), "patriots"], [at(2026, 4, 20), "patriots"], [at(2026, 4, 21), null], [at(2026, 8, 10), null],
];
for (const [date, expected] of decorCases) if (decorFor(date) !== expected) fail(`decorFor ${date.toISOString().slice(0, 10)} = ${decorFor(date)}, expected ${expected}`);
const snap = calendarSnapshot(at(2026, 10, 7));
console.log("snapshot:", JSON.stringify({ now: snap.now, season: snap.season, decor: snap.decor, holidays: snap.holidays.slice(0, 4) }));
if (!snap.holidays.some((h) => h.name === "Halloween" && h.daysUntil === 24)) fail("Halloween should be 24 days from Oct 7");
if (snap.holidays.some((h) => h.daysUntil > 30 || h.daysUntil < -3)) fail("holiday window");
const clean = sanitizePersona({ likes: " tea, , cats ,dogs", favoriteColor: "  green ", bogus: "x", birthdayMonth: 13, birthdayDay: 9, hobbies: ["a", 5] });
console.log("sanitized:", JSON.stringify(clean));
if (clean.likes?.join("|") !== "tea|cats|dogs" || clean.favoriteColor !== "green" || "bogus" in clean || "birthdayMonth" in clean || clean.birthdayDay !== 9) fail("sanitizePersona");
if (!addMemoryOnce("gigi", "fire", "I helped put out a fire.", 3)) fail("first addMemoryOnce should store");
if (addMemoryOnce("gigi", "fire", "I helped put out a fire.", 3)) fail("duplicate addMemoryOnce should be skipped");
console.log(process.exitCode ? "SOME CHECKS FAILED" : "all life checks passed");
