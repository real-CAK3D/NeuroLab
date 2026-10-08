// Files notable floor events as staff memories (POST /api/npc/memories/:id). De-duplicated by event key with localStorage
// seen-ids (so a reload never re-files old events) and drained through a small rate-limited queue. ?lifeDry=1 makes it a no-op.
import { LIFE_DRY, isTestId, postMemory } from "./lifeApi";

const SEEN_KEY = "gen2-life-memories-seen-v1";
const MIN_GAP_MS = 2500;
const MAX_QUEUE = 24;

type Pending = { key: string; npcId: string; kind: string; text: string; importance: number };

let seen: Set<string> | undefined;
const queue: Pending[] = [];
let timer: number | undefined;

function loadSeen() {
  if (seen) return seen;
  try {
    const raw = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]");
    seen = new Set<string>(Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : []);
  } catch {
    seen = new Set<string>();
  }
  return seen;
}

function persistSeen() {
  try {
    const list = [...loadSeen()].slice(-500);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable: events may be re-filed after a reload, the server also de-duplicates for 12 hours
  }
}

function drain() {
  timer = undefined;
  const next = queue.shift();
  if (!next) return;
  void postMemory(next.npcId, next.kind, next.text, next.importance).catch(() => undefined);
  if (queue.length) timer = window.setTimeout(drain, MIN_GAP_MS);
}

/** True once per event key. `enabled` is false in dev mock modes / for non-real staff. */
export function fileMemory(npcId: string, key: string, kind: string, text: string, importance: number, enabled = true): boolean {
  if (!enabled || isTestId(npcId)) return false;
  if (LIFE_DRY) {
    // dev aid: nothing is written, but window.__lifeDryLog shows what would have been filed (once per event key)
    const log = ((window as unknown as Record<string, unknown>).__lifeDryLog ??= []) as Array<Pending & { at: number }>;
    if (log.some((item) => item.key === `${npcId}:${key}`)) return false;
    log.push({ key: `${npcId}:${key}`, npcId, kind, text, importance, at: Date.now() });
    return false;
  }
  const known = loadSeen();
  const full = `${npcId}:${key}`;
  if (known.has(full)) return false;
  if (queue.length >= MAX_QUEUE) return false;
  known.add(full);
  persistSeen();
  queue.push({ key: full, npcId, kind, text, importance });
  if (timer === undefined) timer = window.setTimeout(drain, 600);
  return true;
}

export function memorySeen(npcId: string, key: string) {
  return loadSeen().has(`${npcId}:${key}`);
}
