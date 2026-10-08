// AI banter prefetch queue for sprite-to-sprite chat bubbles, plus deterministic friend affinities.
// Ollama is slow (4-20 s), so nothing here ever blocks the sim: the dashboard pumps `pumpBanter()` on a timer, results land in a
// per-pair queue, and `takeBanter()` is a synchronous lookup when two staff start chatting (canned lines are the fallback).
import { postBanter, type BanterBrief, type BanterLine } from "./lifeApi";

// ---- affinity (same FNV-1a pair hash the backend uses to pick each coworker opinion) ----

function hashString(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Backend OPINIONS list order: friendly at the coffee machine, works hard, chatty, spotless, best stories, borrows pens,
// quiet but reliable, calms everyone, knows the supplies, funny laugh.
const OPINION_SCORE = [0.8, 0.6, 0.7, 0.4, 1.0, -0.2, 0.2, 0.6, 0.5, 0.8];

function opinionScore(from: string, to: string) {
  const seed = hashString(`${from}>${to}`);
  return OPINION_SCORE[hashString(`${seed}:1`) % OPINION_SCORE.length];
}

const affinityCache = new Map<string, number>();

/** 0..1 how much two workers like each other (symmetric, stable). >= FRIEND_AT means friends, <= RARE_AT rarely chat. */
export function pairAffinity(a: string, b: string, sameDepartment = false) {
  const key = a < b ? `${a}|${b}|${sameDepartment ? 1 : 0}` : `${b}|${a}|${sameDepartment ? 1 : 0}`;
  const hit = affinityCache.get(key);
  if (hit !== undefined) return hit;
  const raw = (opinionScore(a, b) + opinionScore(b, a)) / 2 + (sameDepartment ? 0.2 : 0);
  const value = Math.max(0, Math.min(1, (raw + 0.2) / 1.35));
  affinityCache.set(key, value);
  return value;
}

export const FRIEND_AT = 0.7;
export const RARE_AT = 0.38;
export const isFriend = (a: string, b: string, sameDepartment = false) => pairAffinity(a, b, sameDepartment) >= FRIEND_AT;

// ---- queue ----

type Exchange = { aId: string; bId: string; lines: BanterLine[]; at: number };
const STORAGE_KEY = "gen2-life-banter-v1";
const MAX_AGE_MS = 25 * 60_000;
const MAX_PER_PAIR = 2;
const MAX_TOTAL = 12;

const queues = new Map<string, Exchange[]>();
const wanted = new Set<string>();
let inFlight = false;
let lastRequestAt = 0;
let nextGapMs = 60_000 + Math.random() * 30_000;

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function load() {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "[]") as Exchange[];
    for (const item of Array.isArray(raw) ? raw : []) {
      if (item && typeof item.aId === "string" && typeof item.bId === "string" && Array.isArray(item.lines) && Date.now() - item.at < MAX_AGE_MS) {
        const key = pairKey(item.aId, item.bId);
        queues.set(key, [...(queues.get(key) ?? []), item]);
      }
    }
  } catch {
    // session storage unavailable: the queue simply starts empty
  }
}
function save() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...queues.values()].flat()));
  } catch {
    // ignore
  }
}
if (typeof window !== "undefined") load();

function prune() {
  const now = Date.now();
  for (const [key, list] of queues) {
    const fresh = list.filter((item) => now - item.at < MAX_AGE_MS);
    if (fresh.length) queues.set(key, fresh);
    else queues.delete(key);
  }
}

export const banterQueued = () => [...queues.values()].reduce((sum, list) => sum + list.length, 0);
export const banterQueuedFor = (a: string, b: string) => queues.get(pairKey(a, b))?.length ?? 0;
export const banterInFlight = () => inFlight;

/** Marks a pair as one the next prefetch should prefer (they chatted with canned lines because nothing was queued). */
export function wantBanter(a: string, b: string) {
  if (wanted.size < 20) wanted.add(pairKey(a, b));
}

/** Synchronous: pops an exchange for the pair and returns each line with the speaker's real id, or undefined. */
export function takeBanter(a: string, b: string): Array<{ speaker: string; text: string }> | undefined {
  prune();
  const key = pairKey(a, b);
  const list = queues.get(key);
  const item = list?.shift();
  if (list && !list.length) queues.delete(key);
  if (!item) {
    wantBanter(a, b);
    return undefined;
  }
  save();
  return item.lines.map((line) => ({ speaker: line.who === "a" ? item.aId : item.bId, text: line.text }));
}

/** Pairs who are standing close together are the likeliest to chat next, so their exchange is prefetched first. */
export type BanterCandidate = { a: BanterBrief; b: BanterBrief; place: string; score: number };

/**
 * Called by a timer (~every 5 s). Requests at most one exchange at a time, no more often than every 60-90 s, or 20 s after
 * `urgent` (two staff heading into the break room / sharing a room). Skips hidden tabs. `candidates()` is only evaluated when a request is due.
 */
export function pumpBanter(candidates: () => BanterCandidate[], urgent: boolean) {
  if (inFlight || typeof document === "undefined" || document.hidden) return;
  const now = Date.now();
  const gap = urgent ? 20_000 : nextGapMs;
  if (now - lastRequestAt < gap) return;
  prune();
  if (banterQueued() >= MAX_TOTAL) return;
  const eligible = candidates().filter((item) => banterQueuedFor(item.a.id, item.b.id) < MAX_PER_PAIR);
  if (!eligible.length) return;
  const scored = eligible.map((item) => ({ item, score: item.score + (wanted.has(pairKey(item.a.id, item.b.id)) ? 4 : 0) - banterQueuedFor(item.a.id, item.b.id) * 2 + Math.random() * 1.5 })).sort((x, y) => y.score - x.score);
  const pick = scored[0].item;
  inFlight = true;
  lastRequestAt = now;
  nextGapMs = 60_000 + Math.random() * 30_000;
  wanted.delete(pairKey(pick.a.id, pick.b.id));
  void postBanter(pick.a, pick.b, pick.place)
    .then((result) => {
      if (!result || result.source === "template") return; // the sim's own canned lines beat the generic server template
      const key = pairKey(pick.a.id, pick.b.id);
      const exchange: Exchange = { aId: pick.a.id, bId: pick.b.id, lines: result.lines, at: Date.now() };
      queues.set(key, [...(queues.get(key) ?? []), exchange]);
      save();
    })
    .catch(() => undefined)
    .finally(() => {
      inFlight = false;
    });
}
