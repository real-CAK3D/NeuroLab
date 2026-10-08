// Staff "little life" plumbing: persona / memory / roster / calendar / banter calls to the backend, all failing soft.
// Dev flags: ?lifeDry=1 turns every memory / persona / roster WRITE into a no-op (and banter ids get a "zz-test-" prefix) so the
// dashboard can be tried against live data without touching it.

const backendUrl = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "").replace(/\/$/, "");

export function lifeParam(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

export const LIFE_DRY = lifeParam("lifeDry") === "1";

export type Persona = {
  hobbies: string[]; favoriteFood: string; pet: string; home: string; family: string; weekend: string; dream: string; quirk: string; music: string; hometown: string;
  likes: string[]; dislikes: string[]; loves: string[]; hates: string[]; favoriteColor: string; favoriteArtist: string; favoriteShow: string; favoriteTeam: string;
  maineThing: string; commute: string; relationship: string; morning: string; fear: string; guiltyPleasure: string; catchphrase: string; birthdayMonth: number; birthdayDay: number;
};

export type MemoryItem = { kind: string; text: string; when: string; at?: number; importance: number };
export type BanterLine = { who: "a" | "b"; text: string };
export type BanterBrief = { id: string; name: string; title?: string; department?: string; mood?: string; action?: string; recent?: string[] };

async function request<T>(path: string, init?: RequestInit, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${backendUrl}${path}`, { ...init, signal: controller.signal, headers: init?.body ? { "Content-Type": "application/json" } : undefined });
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

export const isTestId = (id: string) => id.startsWith("zz-test-");

export function getPersona(id: string) {
  return request<Persona>(`/api/npc/persona/${encodeURIComponent(id)}`);
}

/** Returns the saved persona, or undefined when the write was skipped (dry mode). */
export async function putPersona(id: string, persona: Partial<Persona>): Promise<Persona | undefined> {
  if (LIFE_DRY) return undefined;
  return request<Persona>(`/api/npc/persona/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(persona) });
}

export async function getMemories(id: string): Promise<MemoryItem[]> {
  const data = await request<{ memories?: MemoryItem[] }>(`/api/npc/memories/${encodeURIComponent(id)}`);
  return data.memories ?? [];
}

/** Files a memory. Dry mode skips the write and resolves to undefined. */
export async function postMemory(id: string, kind: string, text: string, importance: number): Promise<MemoryItem[] | undefined> {
  if (LIFE_DRY) return undefined;
  const data = await request<{ memories?: MemoryItem[] }>(`/api/npc/memories/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify({ kind, text, importance }) });
  return data.memories ?? [];
}

export type RosterEntry = { id: string; name: string; title: string; department: string };

export async function postRoster(roster: RosterEntry[]): Promise<boolean> {
  if (LIFE_DRY || !roster.length) return false;
  try {
    await request<{ ok: boolean }>("/api/npc/roster", { method: "POST", body: JSON.stringify({ roster }) });
    return true;
  } catch {
    return false;
  }
}

/** One overheard exchange between two staff. Test ids are sent with a zz-test- prefix in dry mode and mapped back. */
export async function postBanter(a: BanterBrief, b: BanterBrief, place: string): Promise<{ lines: BanterLine[]; source: string } | undefined> {
  const wire = (brief: BanterBrief): BanterBrief => (LIFE_DRY ? { ...brief, id: `zz-test-${brief.id}` } : brief);
  try {
    const data = await request<{ lines?: BanterLine[]; source?: string }>("/api/npc/banter", { method: "POST", body: JSON.stringify({ a: wire(a), b: wire(b), place }) }, 50_000);
    const lines = (data.lines ?? []).filter((line) => (line.who === "a" || line.who === "b") && typeof line.text === "string" && line.text.trim()).map((line) => ({ who: line.who, text: line.text.trim().slice(0, 80) }));
    return lines.length >= 2 ? { lines, source: data.source ?? "ollama" } : undefined;
  } catch {
    return undefined;
  }
}

export type CalendarInfo = {
  now: { iso: string; weekday: string; date: string; clock12: string };
  season: string;
  holidays: Array<{ name: string; daysUntil: number; note: string }>;
  decor: string | null;
  weather: { text: string; tempF: number; summary: string } | null;
};

export async function fetchCalendar(): Promise<CalendarInfo | undefined> {
  try {
    const data = await request<Partial<CalendarInfo>>("/api/calendar", undefined, 8000);
    if (!data || !data.now || !Array.isArray(data.holidays)) return undefined;
    return { now: data.now, season: data.season ?? "", holidays: data.holidays, decor: data.decor ?? null, weather: data.weather ?? null };
  } catch {
    return undefined;
  }
}
