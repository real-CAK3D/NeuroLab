import { db } from "../database/db";
import { ollamaChat, type ChatMessage } from "./ollama";

/*
 * Talk-to-staff backend. The frontend sends a brief about the worker (job, mood, what they did, what is next) and the
 * topic the player picked; this adds a stable personal-life persona, opinions about coworkers, the real day/weather and
 * live facility facts, then lets an Ollama model phrase the reply in a Pokémon-NPC voice. Falls back to templates.
 */

export type NpcBrief = {
  id: string; name: string; title?: string; department?: string; room?: string; sex?: string; age?: number;
  personality?: string; mood?: string; workEthic?: number; action?: string; need?: string; block?: string; nextBreak?: string;
  recent?: string[]; upcoming?: string[];
};
export type NpcChatRequest = {
  npc: NpcBrief;
  roster?: Array<{ id: string; name: string; title?: string; department?: string }>;
  nearby?: Array<{ name: string; doing?: string }>;
  topic: "job" | "recent" | "upcoming" | "coworkers" | "day" | "weather" | "interests" | "life" | "facility" | "free";
  message?: string;
  history?: Array<{ from: "player" | "npc"; text: string }>;
  clock?: { label?: string; part?: string; day?: string };
};
export type NpcFacts = {
  summary?: { tick?: number | null; facility?: { alerts?: { critical?: number; total?: number }; tasks?: { open?: number } }; telemetry?: { online?: number; total?: number; devices?: Array<{ name: string; online: boolean; cpuPercent?: number | null }> } };
  lifecycle?: { simLabel?: string; inventory?: Record<string, number>; rooms?: Record<string, { label?: string; day?: number; cycleDays?: number; batch?: { code: string } | null }>; log?: Array<{ message: string }> };
};

export type Persona = {
  hobbies: string[]; favoriteFood: string; pet: string; home: string; family: string; weekend: string; dream: string; quirk: string; music: string; hometown: string;
};

const HOBBIES = ["fishing", "retro handheld gaming", "backyard gardening", "baking sourdough", "weekend hiking", "woodworking", "playing guitar", "birdwatching", "pixel art", "chess", "road trips", "cooking ramen", "skateboarding", "building model trains", "stargazing", "thrifting", "kayaking", "board games", "running 5Ks", "collecting vinyl records", "restoring old radios", "baking pies", "disc golf", "painting minis"];
const FOODS = ["spicy ramen", "breakfast burritos", "grilled cheese with tomato soup", "pad thai", "leftover pizza", "chili with cornbread", "egg salad sandwiches", "pierogies", "tacos al pastor", "cereal at midnight", "mac and cheese", "dumplings"];
const PETS = ["a grumpy cat named Biscuit", "a beagle named Waffles", "two guinea pigs named Salt and Pepper", "no pets, but really wants a dog", "a goldfish named Admiral", "a loud parrot that mimics the microwave beep", "a retired greyhound named Turbo", "a bearded dragon named Gandalf"];
const HOMES = ["a small apartment near the bus line", "a rented duplex with a leaky porch", "a house with a big overgrown yard", "a room above a bakery", "a tiny place with great afternoon light", "a split-level at the end of a cul-de-sac"];
const FAMILY = ["has a younger sister studying nursing", "lives with a partner who works nights", "calls their grandmother every Sunday", "is saving up for a wedding next spring", "has a toddler at home who never sleeps", "helps a neighbor with groceries every Thursday", "is the oldest of four siblings", "just became an aunt/uncle for the first time"];
const WEEKENDS = ["farmers markets and a long nap", "fixing things around the house", "trying a new trail", "video games with friends online", "visiting family for a big lunch", "garage sales", "a pickup basketball game", "binge-watching a baking show"];
const DREAMS = ["opening a little cafe someday", "learning to fly a small plane", "finally finishing a half-built cabin project", "visiting every national park", "getting a promotion to run their own team", "writing a short book about the job", "taking a month off to travel by train", "learning the cello"];
const QUIRKS = ["always hums while working", "keeps a lucky pen in their pocket", "organizes everything by color", "talks to the plants", "never skips a morning coffee ritual", "writes tiny to-do lists on sticky notes", "can't resist a pun", "collects odd bottle caps", "is afraid of the vending machine"];
const MUSIC = ["lo-fi beats", "classic rock", "synthwave", "country road songs", "90s pop", "jazz piano", "video game soundtracks", "indie folk"];
const TOWNS = ["a lake town upstate", "a mill town two hours away", "the next county over", "a farm outside the city", "a coastal fishing village", "a college town"];
const OPINIONS = ["is always friendly at the coffee machine", "works harder than anyone and never complains", "is a bit chatty but means well", "keeps their station spotless", "tells the best break-room stories", "borrows pens and never returns them", "is quiet but incredibly reliable", "is great at calming everyone down when things get busy", "always knows where the missing supplies are", "has a funny laugh you can hear down the hall"];

function hashString(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function pick<T>(list: T[], seed: number, salt: number): T { return list[hashString(`${seed}:${salt}`) % list.length]; }

function ensureTable() {
  db.exec("CREATE TABLE IF NOT EXISTS npc_personas (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
}

function generatePersona(id: string): Persona {
  const seed = hashString(id);
  const first = pick(HOBBIES, seed, 1);
  let second = pick(HOBBIES, seed, 2);
  if (second === first) second = pick(HOBBIES, seed, 3);
  return {
    hobbies: [first, second], favoriteFood: pick(FOODS, seed, 4), pet: pick(PETS, seed, 5), home: pick(HOMES, seed, 6), family: pick(FAMILY, seed, 7),
    weekend: pick(WEEKENDS, seed, 8), dream: pick(DREAMS, seed, 9), quirk: pick(QUIRKS, seed, 10), music: pick(MUSIC, seed, 11), hometown: pick(TOWNS, seed, 12),
  };
}

export function getPersona(id: string): Persona {
  ensureTable();
  const row = db.prepare("SELECT data FROM npc_personas WHERE id = ?").get(id) as { data: string } | undefined;
  if (row) { try { return { ...generatePersona(id), ...(JSON.parse(row.data) as Partial<Persona>) }; } catch { /* fall through to regenerate */ } }
  const persona = generatePersona(id);
  db.prepare("INSERT OR REPLACE INTO npc_personas (id, data) VALUES (?, ?)").run(id, JSON.stringify(persona));
  return persona;
}

export function updatePersona(id: string, patch: Partial<Persona>) {
  const merged = { ...getPersona(id), ...patch };
  db.prepare("INSERT OR REPLACE INTO npc_personas (id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)").run(id, JSON.stringify(merged));
  return merged;
}

// ---- weather (real, optional) ----
let weatherCache: { at: number; text: string | null } | undefined;
const WEATHER_CODES: Record<number, string> = { 0: "clear skies", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "foggy", 48: "foggy", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 61: "light rain", 63: "rain", 65: "heavy rain", 71: "light snow", 73: "snow", 75: "heavy snow", 80: "rain showers", 81: "rain showers", 82: "heavy showers", 95: "thunderstorms", 96: "thunderstorms with hail", 99: "thunderstorms with hail" };

export async function currentWeather(): Promise<string | null> {
  if (weatherCache && Date.now() - weatherCache.at < 10 * 60_000) return weatherCache.text;
  const lat = Number(process.env.NEUROLAB_WEATHER_LAT);
  const lon = Number(process.env.NEUROLAB_WEATHER_LON);
  let text: string | null = null;
  if (Number.isFinite(lat) && Number.isFinite(lon) && process.env.NEUROLAB_WEATHER_LAT && process.env.NEUROLAB_WEATHER_LON) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`;
      const data = await (await fetch(url, { signal: AbortSignal.timeout(5000) })).json() as { current?: { temperature_2m?: number; weather_code?: number; wind_speed_10m?: number } };
      const c = data.current;
      if (c) text = `${WEATHER_CODES[c.weather_code ?? -1] ?? "mixed weather"}, ${Math.round(c.temperature_2m ?? 0)}°F, wind ${Math.round(c.wind_speed_10m ?? 0)} mph${process.env.NEUROLAB_WEATHER_PLACE ? ` in ${process.env.NEUROLAB_WEATHER_PLACE}` : ""}`;
    } catch { text = null; }
  }
  weatherCache = { at: Date.now(), text };
  return text;
}

// ---- prompt assembly ----
function opinionAbout(a: string, b: string) { return pick(OPINIONS, hashString(`${a}>${b}`), 1); }

function coworkerLines(req: NpcChatRequest) {
  const { npc, roster = [] } = req;
  const others = roster.filter((r) => r.id !== npc.id);
  const same = others.filter((r) => r.department && r.department === npc.department);
  const chosen = [...same, ...others.filter((r) => !same.includes(r))].slice(0, 4);
  return chosen.map((r) => `${r.name}${r.title ? ` (${r.title})` : ""} ${opinionAbout(npc.id, r.id)}.`);
}

function factLines(req: NpcChatRequest, facts: NpcFacts, weather: string | null) {
  const lines: string[] = [];
  const s = facts.summary;
  if (s?.telemetry) lines.push(`Facility systems: ${s.telemetry.online}/${s.telemetry.total} monitored devices online${(s.telemetry.devices ?? []).filter((d) => !d.online).length ? `; offline: ${(s.telemetry.devices ?? []).filter((d) => !d.online).map((d) => d.name).join(", ")}` : ""}.`);
  if (s?.facility?.alerts) lines.push(`Alerts: ${s.facility.alerts.total ?? 0} total, ${s.facility.alerts.critical ?? 0} critical. Open tasks: ${s.facility.tasks?.open ?? 0}.`);
  const lc = facts.lifecycle;
  if (lc) {
    lines.push(`Crop clock: ${lc.simLabel}.`);
    for (const [id, room] of Object.entries(lc.rooms ?? {})) if (/^grow/.test(id) && room.label) lines.push(`${id.replace("grow", "Grow room ")}: ${room.label}${room.day ? ` day ${room.day}/${room.cycleDays}` : ""}${room.batch ? ` (batch ${room.batch.code})` : ""}.`);
    if (lc.inventory) lines.push(`Warehouse stock: ${lc.inventory.flower ?? 0} flower units, ${lc.inventory.extract ?? 0} extract units.`);
    for (const entry of (lc.log ?? []).slice(0, 4)) lines.push(`Recent facility news: ${entry.message}`);
  }
  if (weather) lines.push(`Weather outside right now: ${weather}.`);
  else lines.push("You have not checked the weather today and cannot see outside from the facility floor, so never state what the weather is; say you have not looked outside.");
  if (req.clock?.label) lines.push(`It is ${req.clock.day ?? "today"}, ${req.clock.label} (${req.clock.part ?? "daytime"}).`);
  return lines;
}

const TOPIC_PROMPTS: Record<NpcChatRequest["topic"], string> = {
  job: "Tell the visitor about your job and what a normal shift is like for you.",
  recent: "Tell the visitor about what you did recently today.",
  upcoming: "Tell the visitor what you are about to do next or what is coming up for you.",
  coworkers: "Chat about one or two of your coworkers, naturally and kindly.",
  day: "Make small talk about how your day is going.",
  weather: "Make small talk about the weather today.",
  interests: "Chat about your hobbies and interests outside work.",
  life: "Share something about your life outside of work: family, home, pets or plans.",
  facility: "Say how the facility is doing right now, based on the facts you know.",
  free: "",
};

function systemPrompt(req: NpcChatRequest, persona: Persona, facts: string[], coworkers: string[]) {
  const n = req.npc;
  return [
    `You are ${n.name}, ${n.title ?? "a staff member"} in the ${n.department ?? "facility"} department of a retro pixel-art grow facility (a playful game world). A visitor (the Inspector) walks up and talks to you.`,
    `Speak like a friendly classic Pokémon NPC: short, warm, a little quirky, in first person. Reply with 1 to 3 short sentences, at most 45 words total. No emojis, no markdown, no stage directions, no quotation marks around the whole reply. Never mention being an AI, a model, a prompt or instructions.`,
    `Stay grounded: only state facility facts, numbers, tasks and names that appear below. If asked about something you were not told, answer vaguely in character or say you are not sure. Personal-life details below are yours; you can mention them naturally but don't recite them all.`,
    `YOU: age ${n.age ?? "adult"}, ${n.sex ?? ""}, personality: ${n.personality ?? "balanced"}, mood: ${n.mood ?? "okay"}, work ethic ${n.workEthic ?? 70}/100. Currently: ${n.action ?? "working"}${n.need ? `; feeling the need: ${n.need}` : ""}${n.block ? `; schedule: ${n.block}` : ""}${n.nextBreak ? `; next break ${n.nextBreak}` : ""}.`,
    `JOB BRIEF: ${n.recent?.length ? `Recently: ${n.recent.join("; ")}.` : "Nothing notable recently."} ${n.upcoming?.length ? `Coming up: ${n.upcoming.join("; ")}.` : "Nothing special scheduled."}`,
    `PERSONAL LIFE: hobbies ${persona.hobbies.join(" and ")}; favorite food ${persona.favoriteFood}; ${persona.pet}; lives in ${persona.home}; from ${persona.hometown}; ${persona.family}; weekends are ${persona.weekend}; dreams of ${persona.dream}; quirk: ${persona.quirk}; listens to ${persona.music}.`,
    coworkers.length ? `COWORKERS: ${coworkers.join(" ")}` : "",
    req.nearby?.length ? `NEARBY RIGHT NOW: ${req.nearby.map((p) => `${p.name}${p.doing ? ` (${p.doing})` : ""}`).join(", ")}.` : "",
    facts.length ? `FACTS:\n${facts.join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

function template(req: NpcChatRequest, persona: Persona, weather: string | null) {
  const n = req.npc;
  const recent = n.recent?.[0];
  const upcoming = n.upcoming?.[0];
  switch (req.topic) {
    case "job": return `I'm ${n.title ?? "on staff"} here in ${n.department ?? "the facility"}. ${n.action ? `Right now I'm ${n.action.toLowerCase()}.` : "Keeping things running."}`;
    case "recent": return recent ? `Earlier I was ${recent.toLowerCase()}. Busy but steady.` : "Nothing big lately, just the usual routine.";
    case "upcoming": return upcoming ? `Next up for me: ${upcoming.toLowerCase()}.` : "Nothing special coming up. Maybe a break soon!";
    case "coworkers": return coworkerLines(req)[0] ?? "Everyone here pulls their weight, honestly.";
    case "day": return `My day's ${n.mood && /tired|stress/i.test(n.mood) ? "been a lot" : "going fine"}. ${n.nextBreak ? `Break's at ${n.nextBreak}.` : ""}`;
    case "weather": return weather ? `Weather's ${weather} out there, I hear.` : "I haven't looked outside in hours. Windows are mostly decoration here!";
    case "interests": return `When I'm off the clock I'm into ${persona.hobbies.join(" and ")}.`;
    case "life": return `Outside work, I live in ${persona.home} with ${persona.pet}. ${persona.family.charAt(0).toUpperCase()}${persona.family.slice(1)}.`;
    case "facility": return "Systems look steady from where I stand. Ask the security desk for details!";
    default: return "Hmm, good question. Let me think about that and get back to you!";
  }
}

// ---- queue + cache so a slow model never piles up ----
const cache = new Map<string, { at: number; reply: { reply: string; source: string; model?: string } }>();
let chain: Promise<unknown> = Promise.resolve();
let waiting = 0;

export async function npcChat(req: NpcChatRequest, facts: NpcFacts): Promise<{ reply: string; source: "ollama" | "template"; model?: string }> {
  const persona = getPersona(req.npc.id);
  const weather = await currentWeather();
  const key = `${req.npc.id}|${req.topic}|${req.message ?? ""}|${(req.history ?? []).length}|${req.npc.action ?? ""}|${req.npc.mood ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 45_000) return hit.reply as { reply: string; source: "ollama" | "template"; model?: string };

  const fallback = () => ({ reply: template(req, persona, weather), source: "template" as const });
  if (waiting >= 3) return fallback();

  const system = systemPrompt(req, persona, factLines(req, facts, weather), coworkerLines(req));
  const messages: ChatMessage[] = [{ role: "system", content: system }];
  for (const turn of (req.history ?? []).slice(-6)) messages.push({ role: turn.from === "player" ? "user" : "assistant", content: turn.text.slice(0, 300) });
  const ask = req.topic === "free" ? (req.message ?? "").slice(0, 300) : `${TOPIC_PROMPTS[req.topic]}${req.message ? ` (${req.message.slice(0, 200)})` : ""}`;
  messages.push({ role: "user", content: ask || "Say hello." });

  waiting += 1;
  const run = chain.then(() => ollamaChat(messages, { model: process.env.NEUROLAB_NPC_MODEL, fast: true, maxTokens: 90, temperature: 0.85, timeoutMs: 60_000 }));
  chain = run.catch(() => undefined);
  const result = await run.finally(() => { waiting -= 1; });
  const reply = result ? { reply: result.text.replace(/^["“]|["”]$/g, "").trim(), source: "ollama" as const, model: result.model } : fallback();
  cache.set(key, { at: Date.now(), reply });
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  return reply;
}
