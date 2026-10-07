import { db } from "../database/db";

/*
 * Staff memories. Notable things (a promotion, a transfer, a new coworker, a talk with the Inspector, facility events) are stored with
 * a timestamp and importance, and fed back into conversations as "I remember when ..." material. Role changes are detected by syncing
 * the roster the dashboard sends along with each chat, so promotions made in Grow Ops are remembered automatically.
 */

export type RosterEntry = { id: string; name: string; title?: string; department?: string };

export function initMemory() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS npc_memories (id INTEGER PRIMARY KEY AUTOINCREMENT, npc_id TEXT NOT NULL, at_ms INTEGER NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL, importance INTEGER NOT NULL DEFAULT 2);
    CREATE INDEX IF NOT EXISTS idx_npc_memories_npc ON npc_memories (npc_id, at_ms);
    CREATE TABLE IF NOT EXISTS npc_state (id TEXT PRIMARY KEY, name TEXT NOT NULL, title TEXT, department TEXT, first_seen_ms INTEGER NOT NULL, last_seen_ms INTEGER NOT NULL);
  `);
}

const KEEP_PER_NPC = 40;
let ready = false;
const ensure = () => { if (!ready) { initMemory(); ready = true; } };

export function addMemory(npcId: string, kind: string, text: string, importance = 2, atMs = Date.now()) {
  ensure();
  db.prepare("INSERT INTO npc_memories (npc_id, at_ms, kind, text, importance) VALUES (?, ?, ?, ?, ?)").run(npcId, atMs, kind, text.slice(0, 280), importance);
  // Keep the most important and the most recent memories only.
  db.prepare(`DELETE FROM npc_memories WHERE npc_id = ? AND id NOT IN (SELECT id FROM npc_memories WHERE npc_id = ? ORDER BY importance DESC, at_ms DESC LIMIT ?)`).run(npcId, npcId, KEEP_PER_NPC);
}

export function relativeTime(thenMs: number, nowMs = Date.now()) {
  const minutes = Math.round((nowMs - thenMs) / 60_000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 9) return `${weeks} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export function memoriesFor(npcId: string, limit = 7) {
  ensure();
  const now = Date.now();
  const rows = db.prepare("SELECT at_ms AS at, kind, text, importance FROM npc_memories WHERE npc_id = ? ORDER BY at_ms DESC LIMIT 60").all(npcId) as Array<{ at: number; kind: string; text: string; importance: number }>;
  // Weight importance, with a gentle recency decay, so a promotion stays memorable longer than small talk.
  return rows
    .map((row) => ({ ...row, score: row.importance * 10 - Math.min(25, (now - row.at) / 86_400_000) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .sort((a, b) => b.at - a.at)
    .map((row) => ({ kind: row.kind, text: row.text, when: relativeTime(row.at), importance: row.importance }));
}

const PROMOTION_TITLE = /manager|lead|senior|supervisor|head|chief|director|captain/i;

// Detect hires, promotions, role changes and transfers from the roster the dashboard sends.
export function syncRoster(roster: RosterEntry[]) {
  ensure();
  if (!roster.length) return;
  const now = Date.now();
  const known = new Map((db.prepare("SELECT id, name, title, department FROM npc_state").all() as Array<{ id: string; name: string; title: string | null; department: string | null }>).map((row) => [row.id, row]));
  const baseline = known.size === 0; // very first sync: just record who is here, no "new hire" memories
  const witnesses = (person: RosterEntry) => roster.filter((other) => other.id !== person.id && other.department && other.department === person.department);
  for (const person of roster) {
    const prior = known.get(person.id);
    if (!prior) {
      db.prepare("INSERT INTO npc_state (id, name, title, department, first_seen_ms, last_seen_ms) VALUES (?, ?, ?, ?, ?, ?)").run(person.id, person.name, person.title ?? null, person.department ?? null, now, now);
      if (!baseline) {
        addMemory(person.id, "hired", `I started working here as ${person.title ?? "staff"} in ${person.department ?? "the facility"}.`, 4, now);
        for (const other of witnesses(person)) addMemory(other.id, "coworker-joined", `${person.name} joined our department as ${person.title ?? "staff"}.`, 2, now);
      }
      continue;
    }
    const titleChanged = (prior.title ?? "") !== (person.title ?? "");
    const deptChanged = (prior.department ?? "") !== (person.department ?? "");
    if (titleChanged || deptChanged) {
      const promoted = titleChanged && PROMOTION_TITLE.test(person.title ?? "") && !PROMOTION_TITLE.test(prior.title ?? "");
      if (deptChanged) {
        addMemory(person.id, "transfer", `I was moved from ${prior.department ?? "my old department"} to ${person.department ?? "a new department"}${titleChanged ? ` as ${person.title}` : ""}.`, 4, now);
        for (const other of witnesses(person)) addMemory(other.id, "coworker-transfer", `${person.name} transferred into our department.`, 2, now);
      } else if (promoted) {
        addMemory(person.id, "promotion", `I got promoted from ${prior.title ?? "my old role"} to ${person.title}. That was a big day for me.`, 5, now);
        for (const other of witnesses(person)) addMemory(other.id, "coworker-promoted", `${person.name} got promoted to ${person.title}.`, 3, now);
      } else {
        addMemory(person.id, "new-role", `My title changed from ${prior.title ?? "my old role"} to ${person.title}.`, 4, now);
      }
    }
    db.prepare("UPDATE npc_state SET name = ?, title = ?, department = ?, last_seen_ms = ? WHERE id = ?").run(person.name, person.title ?? null, person.department ?? null, now, person.id);
  }
}
