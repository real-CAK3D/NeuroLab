import { db } from "../database/db";
import { calendarFacts, clockLabel, dayPart, daysUntilBirthday, formatBirthday, localParts } from "./calendar";
import { addMemory, memoriesFor, syncRoster } from "./npcMemory";
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
  topic: "job" | "recent" | "upcoming" | "coworkers" | "day" | "weather" | "interests" | "life" | "facility" | "memories" | "plans" | "favorites" | "free";
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
  likes: string[]; dislikes: string[]; loves: string[]; hates: string[]; favoriteColor: string; favoriteArtist: string; favoriteShow: string; favoriteTeam: string;
  maineThing: string; commute: string; relationship: string; morning: string; fear: string; guiltyPleasure: string; catchphrase: string; birthdayMonth: number; birthdayDay: number;
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
const LIKES = ["a hot cup of coffee before sunrise", "fresh-baked bread", "a tidy, organized station", "a good rainstorm", "old kung fu movies", "a parking spot right by the door", "the smell of cut grass", "crisp sunny fall days", "mechanical keyboards", "a quiet lunch outside", "trivia night", "well-labeled storage bins", "fuzzy socks", "cold lemonade", "crossword puzzles", "a freshly mopped floor", "maple creemees", "long phone calls with old friends"];
const DISLIKES = ["loud chewing", "slow elevators", "lukewarm coffee", "people who microwave fish", "tangled cables", "being rushed", "wet socks", "spreadsheets with merged cells", "Monday mornings", "crowded grocery stores", "stale donuts", "slow Wi-Fi", "unlabeled containers", "when the vending machine eats a dollar"];
const LOVES = ["their grandmother's recipes", "live music", "the first snowfall", "fall foliage drives", "their pet, more than most people", "Red Sox games on the radio", "homemade pie", "old family photos", "lakeside sunsets", "a really good book"];
const HATES = ["black flies in June", "mud season", "paperwork", "spiders", "being late", "turnpike traffic", "parallel parking", "cilantro (tastes like soap to them)", "the dentist", "how early it gets dark in November"];
const COLORS = ["forest green", "sunset orange", "sky blue", "burgundy", "teal", "mustard yellow", "lavender", "charcoal", "coral", "navy blue", "olive", "rust red"];
const ARTISTS = ["Fleetwood Mac", "Tom Petty", "Taylor Swift", "Johnny Cash", "Bob Seger", "Dolly Parton", "Queen", "Hozier", "the Beatles", "Stevie Wonder", "Fleet Foxes", "Journey"];
const SHOWS = ["a baking competition show", "old sitcom reruns", "nature documentaries", "cozy mystery shows", "a long-running cartoon", "home renovation shows", "retro game speedruns", "true-crime documentaries"];
const TEAMS = ["the Red Sox", "the Patriots", "the Bruins", "the Maine Mariners", "the Portland Sea Dogs", "the Celtics", "no team, they just like the snacks"];
const MAINE_THINGS = ["lobster rolls", "Moxie soda", "whoopie pies", "poutine from a Lewiston spot", "ice fishing", "snowmobiling", "walking the Androscoggin River trail", "Bates College hockey games", "apple picking in the fall", "camping at a lake in the summer", "their L.L.Bean boots", "Italian sandwiches", "the Great Falls Balloon Festival", "blueberry picking in August"];
const COMMUTES = ["drives a rusty pickup whose heater only works on high", "bikes in when the weather is decent", "takes the bus and reads the whole ride", "carpools with a neighbor", "walks in from a few blocks away", "drives a hand-me-down hatchback with 200,000 miles on it"];
const RELATIONSHIPS = ["single and happy about it", "in a long relationship", "married with a loud dinner table", "recently engaged", "dating someone new and shy about it", "lives with roommates"];
const MORNINGS = ["up at 5:30 for coffee on the porch", "hits snooze three times", "does a short stretch routine", "packs a big lunch the night before", "listens to the radio in the truck"];
const FEARS = ["ice on the roads", "deep water", "public speaking", "spiders", "heights", "forgetting an important date"];
const GUILTY = ["reality dating shows", "gas station pastries", "buying yet another notebook", "falling asleep during movies", "humming along to bad pop songs"];
const CATCHPHRASES = ["Well, there you go.", "Ayuh, that tracks.", "Can't complain.", "That's how the cookie crumbles.", "Wicked good.", "Fair enough.", "Alright, alright.", "Take it easy now."];
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
    likes: [pick(LIKES, seed, 13), pick(LIKES, seed, 14), pick(LIKES, seed, 15)], dislikes: [pick(DISLIKES, seed, 16), pick(DISLIKES, seed, 17)],
    loves: [pick(LOVES, seed, 18)], hates: [pick(HATES, seed, 19)], favoriteColor: pick(COLORS, seed, 20), favoriteArtist: pick(ARTISTS, seed, 21),
    favoriteShow: pick(SHOWS, seed, 22), favoriteTeam: pick(TEAMS, seed, 23), maineThing: pick(MAINE_THINGS, seed, 24), commute: pick(COMMUTES, seed, 25),
    relationship: pick(RELATIONSHIPS, seed, 26), morning: pick(MORNINGS, seed, 27), fear: pick(FEARS, seed, 28), guiltyPleasure: pick(GUILTY, seed, 29),
    catchphrase: pick(CATCHPHRASES, seed, 30), birthdayMonth: (hashString(`${seed}:bm`) % 12) + 1, birthdayDay: (hashString(`${seed}:bd`) % 28) + 1,
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

const PERSONA_LIST_KEYS = ["hobbies", "likes", "dislikes", "loves", "hates"] as const;
const PERSONA_TEXT_KEYS = ["favoriteFood", "pet", "home", "family", "weekend", "dream", "quirk", "music", "hometown", "favoriteColor", "favoriteArtist", "favoriteShow", "favoriteTeam", "maineThing", "commute", "relationship", "morning", "fear", "guiltyPleasure", "catchphrase"] as const;

/** Keeps only known persona fields with sane types and lengths (lists may arrive as arrays or comma separated text). */
export function sanitizePersona(input: unknown): Partial<Persona> {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of PERSONA_LIST_KEYS) {
    const value = raw[key];
    const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : undefined;
    if (items) out[key] = items.map((item) => String(item).trim().slice(0, 80)).filter(Boolean).slice(0, 8);
  }
  for (const key of PERSONA_TEXT_KEYS) {
    const value = raw[key];
    if (typeof value === "string") out[key] = value.trim().slice(0, 140);
  }
  const month = Number(raw.birthdayMonth);
  const day = Number(raw.birthdayDay);
  if (Number.isInteger(month) && month >= 1 && month <= 12) out.birthdayMonth = month;
  if (Number.isInteger(day) && day >= 1 && day <= 31) out.birthdayDay = day;
  return out as Partial<Persona>;
}

export function updatePersona(id: string, patch: Partial<Persona>) {
  const merged = { ...getPersona(id), ...patch };
  db.prepare("INSERT OR REPLACE INTO npc_personas (id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)").run(id, JSON.stringify(merged));
  return merged;
}

// ---- weather (real, optional) ----
export type WeatherInfo = { text: string; tempF: number; summary: string };
let weatherCache: { at: number; info: WeatherInfo | null } | undefined;
const WEATHER_CODES: Record<number, string> = { 0: "clear skies", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "foggy", 48: "foggy", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 61: "light rain", 63: "rain", 65: "heavy rain", 71: "light snow", 73: "snow", 75: "heavy snow", 80: "rain showers", 81: "rain showers", 82: "heavy showers", 95: "thunderstorms", 96: "thunderstorms with hail", 99: "thunderstorms with hail" };

/** Text version of the weather for prompts. */
export async function currentWeather(): Promise<string | null> {
  return (await currentWeatherInfo())?.text ?? null;
}

/** Structured current weather (cached 10 minutes): prompt text plus temperature and a short summary like "light rain". */
export async function currentWeatherInfo(): Promise<WeatherInfo | null> {
  if (weatherCache && Date.now() - weatherCache.at < 10 * 60_000) return weatherCache.info;
  // Default location: Lewiston, Maine (override with NEUROLAB_WEATHER_LAT / LON / PLACE).
  const lat = Number(process.env.NEUROLAB_WEATHER_LAT || 44.1004);
  const lon = Number(process.env.NEUROLAB_WEATHER_LON || -70.2148);
  const place = process.env.NEUROLAB_WEATHER_PLACE || "Lewiston, Maine";
  let info: WeatherInfo | null = null;
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    try {
      const tz = encodeURIComponent(process.env.NEUROLAB_TZ || "America/New_York");
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${tz}&forecast_days=1`;
      const data = await (await fetch(url, { signal: AbortSignal.timeout(6000) })).json() as { current?: { temperature_2m?: number; apparent_temperature?: number; weather_code?: number; wind_speed_10m?: number }; daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[]; sunrise?: string[]; sunset?: string[] } };
      const c = data.current;
      if (c) {
        // The API returns local wall-clock times (no zone), so read the clock digits directly.
        const sun = (iso?: string) => { if (!iso) return "?"; const [h, m] = iso.slice(11, 16).split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
        const summary = WEATHER_CODES[c.weather_code ?? -1] ?? "mixed weather";
        const text = `${summary}, ${Math.round(c.temperature_2m ?? 0)}°F (feels like ${Math.round(c.apparent_temperature ?? c.temperature_2m ?? 0)}°F), wind ${Math.round(c.wind_speed_10m ?? 0)} mph in ${place}; today's high ${Math.round(data.daily?.temperature_2m_max?.[0] ?? 0)}°F, low ${Math.round(data.daily?.temperature_2m_min?.[0] ?? 0)}°F; sunrise ${sun(data.daily?.sunrise?.[0])}, sunset ${sun(data.daily?.sunset?.[0])}`;
        info = { text, tempF: Math.round(c.temperature_2m ?? 0), summary };
      }
    } catch { info = null; }
  }
  weatherCache = { at: Date.now(), info };
  return info;
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
  for (const line of calendarFacts()) lines.push(line);
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
  memories: "Share a memory from your time working here, or a milestone you remember, using only the memories listed.",
  plans: "Talk about your plans for the weekend or the next holiday or event on the calendar.",
  favorites: "Talk about some things you love, hate, like and dislike, and a favorite or two.",
  free: "",
};

function birthdayLine(name: string, persona: Persona) {
  const days = daysUntilBirthday(persona.birthdayMonth, persona.birthdayDay);
  if (days === 0) return `${name}'s birthday is TODAY (${formatBirthday(persona.birthdayMonth, persona.birthdayDay)}).`;
  if (days <= 14) return `${name}'s birthday is in ${days} day${days > 1 ? "s" : ""} (${formatBirthday(persona.birthdayMonth, persona.birthdayDay)}).`;
  return "";
}

function systemPrompt(req: NpcChatRequest, persona: Persona, facts: string[], coworkers: string[], memories: Array<{ text: string; when: string }>) {
  const n = req.npc;
  const mine = birthdayLine("Your", persona) || `Your birthday is ${formatBirthday(persona.birthdayMonth, persona.birthdayDay)}.`;
  const nearbyBirthdays = (req.roster ?? []).filter((r) => r.id !== n.id).map((r) => ({ r, line: birthdayLine(r.name, getPersona(r.id)) })).filter((x) => x.line).slice(0, 2).map((x) => x.line);
  return [
    `You are ${n.name}, ${n.title ?? "a staff member"} in the ${n.department ?? "facility"} department of a retro pixel-art grow facility in Lewiston, Maine (a playful game world). A visitor (the Inspector) walks up and talks to you.`,
    `Speak like a friendly classic Pokémon NPC: short, warm, a little quirky, in first person, with a real personality and the occasional Maine turn of phrase. Reply with 1 to 3 short sentences, at most 45 words total. No emojis, no markdown, no stage directions, no quotation marks around the whole reply. Never mention being an AI, a model, a prompt or instructions.`,
    `Stay grounded: only state facility facts, numbers, tasks, names, dates and memories that appear below. If asked about something you were not told, answer vaguely in character or say you are not sure. The personality details below are yours; weave one or two in naturally and don't recite lists.`,
    `YOU: age ${n.age ?? "adult"}, ${n.sex ?? ""}, personality: ${n.personality ?? "balanced"}, mood: ${n.mood ?? "okay"}, work ethic ${n.workEthic ?? 70}/100. Currently: ${n.action ?? "working"}${n.need ? `; feeling the need: ${n.need}` : ""}${n.block ? `; schedule: ${n.block}` : ""}${n.nextBreak ? `; next break ${n.nextBreak}` : ""}.`,
    `JOB BRIEF: ${n.recent?.length ? `Recently: ${n.recent.join("; ")}.` : "Nothing notable recently."} ${n.upcoming?.length ? `Coming up: ${n.upcoming.join("; ")}.` : "Nothing special scheduled."}`,
    `PERSONAL LIFE: ${persona.relationship}; lives in ${persona.home}; from ${persona.hometown}; ${persona.family}; ${persona.pet}; ${persona.commute}; mornings: ${persona.morning}; weekends are ${persona.weekend}; dreams of ${persona.dream}; ${mine}`,
    `LIKES AND DISLIKES: loves ${persona.loves.join(" and ")}; likes ${persona.likes.join(", ")}; dislikes ${persona.dislikes.join(" and ")}; hates ${persona.hates.join(" and ")}; afraid of ${persona.fear}; guilty pleasure: ${persona.guiltyPleasure}.`,
    `FAVORITES: color ${persona.favoriteColor}; food ${persona.favoriteFood}; music ${persona.music} (especially ${persona.favoriteArtist}); show ${persona.favoriteShow}; team ${persona.favoriteTeam}; hobbies ${persona.hobbies.join(" and ")}; local favorite ${persona.maineThing}; quirk: ${persona.quirk}${Math.random() < 0.2 ? `; you may end this reply with your catchphrase: "${persona.catchphrase}"` : ". Do not use a catchphrase in this reply."}`,
    memories.length ? `YOUR MEMORIES (you may bring one up naturally, like "I remember when ...", and only these):\n${memories.map((m) => `- ${m.text} (${m.when})`).join("\n")}` : "",
    coworkers.length ? `COWORKERS: ${coworkers.join(" ")}` : "",
    nearbyBirthdays.length ? `BIRTHDAYS COMING UP: ${nearbyBirthdays.join(" ")}` : "",
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
    case "memories": return memoriesFor(n.id, 1)[0]?.text ?? "Not much to look back on yet. Every day here is still kind of new!";
    case "plans": return `This weekend? ${persona.weekend.charAt(0).toUpperCase()}${persona.weekend.slice(1)}, probably.`;
    case "favorites": return `My favorite color's ${persona.favoriteColor}, and I'm all about ${persona.likes[0]}. ${persona.catchphrase}`;
    default: return "Hmm, good question. Let me think about that and get back to you!";
  }
}

// ---- queue + cache so a slow model never piles up ----
const cache = new Map<string, { at: number; reply: { reply: string; source: string; model?: string } }>();
let chain: Promise<unknown> = Promise.resolve();
let waiting = 0;

export async function npcChat(req: NpcChatRequest, facts: NpcFacts): Promise<{ reply: string; source: "ollama" | "template"; model?: string }> {
  if (req.roster?.length) syncRoster(req.roster); // notices promotions, transfers and new hires and files them as memories
  const persona = getPersona(req.npc.id);
  const weather = await currentWeather();
  const key = `${req.npc.id}|${req.topic}|${req.message ?? ""}|${(req.history ?? []).length}|${req.npc.action ?? ""}|${req.npc.mood ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 45_000) return hit.reply as { reply: string; source: "ollama" | "template"; model?: string };

  const fallback = () => ({ reply: template(req, persona, weather), source: "template" as const });
  if (waiting >= 3) return fallback();

  const system = systemPrompt(req, persona, factLines(req, facts, weather), coworkerLines(req), memoriesFor(req.npc.id, 7));
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
  if (req.topic !== "memories") addMemory(req.npc.id, "visitor", req.topic === "free" ? `The Inspector asked me: "${(req.message ?? "").slice(0, 90)}"` : `The Inspector stopped to chat with me about ${req.topic === "job" ? "my job" : req.topic}.`, 1);
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  return reply;
}

// ---- banter: short overheard exchanges between two staff, used for chat bubbles ----
export type BanterRequest = { a: NpcBrief; b: NpcBrief; place?: string; topic?: string };
const banterCache = new Map<string, { at: number; lines: Array<{ who: "a" | "b"; text: string }> }>();

function banterTemplate(req: BanterRequest, weather: string | null) {
  const pa = getPersona(req.a.id);
  const pb = getPersona(req.b.id);
  return [
    { who: "a" as const, text: weather ? `Nice day to be inside, huh?` : `How's your day going, ${req.b.name}?` },
    { who: "b" as const, text: `Can't complain. ${pb.catchphrase}` },
    { who: "a" as const, text: `I'm just thinking about ${pa.loves[0]}.` },
  ];
}

export async function npcBanter(req: BanterRequest) {
  const key = `${req.a.id}|${req.b.id}|${req.topic ?? ""}|${Math.floor(Date.now() / 300_000)}`;
  const hit = banterCache.get(key);
  if (hit) return { lines: hit.lines, source: "cache" as const };
  const weather = await currentWeather();
  const pa = getPersona(req.a.id);
  const pb = getPersona(req.b.id);
  const brief = (n: NpcBrief, p: Persona) => {
    const memory = memoriesFor(n.id, 1)[0];
    const birthday = daysUntilBirthday(p.birthdayMonth, p.birthdayDay);
    return `${n.name} (${n.title ?? "staff"}, mood ${n.mood ?? "okay"}, doing: ${n.action ?? "working"}; loves ${p.loves[0]}; likes ${p.likes[0]}; hobby ${p.hobbies[0]}; favorite color ${p.favoriteColor}; catchphrase "${p.catchphrase}"${memory ? `; remembers: ${memory.text}` : ""}${birthday <= 3 ? `; birthday ${birthday === 0 ? "is today" : `in ${birthday} days`}` : ""})`;
  };
  const calendar = calendarFacts().slice(0, 3).join(" ");
  const system = `Write a short overheard exchange between two coworkers at a retro pixel-art grow facility in Lewiston, Maine. Output 3 or 4 lines, alternating, each starting with "A:" or "B:". Each line is under 14 words, casual, in character, no emojis, no markdown, no narration. Use only the facts given. Topic hint: ${req.topic ?? "whatever coworkers chat about: work, the day, weekend plans, hobbies, food, the weather, a holiday"}.`;
  const user = `A is ${brief(req.a, pa)}. B is ${brief(req.b, pb)}. Place: ${req.place ?? "the hallway"}. ${calendar}${weather ? ` Weather: ${weather}.` : " Nobody has checked the weather."} ${req.a.recent?.[0] ? `A recently: ${req.a.recent[0]}.` : ""} ${req.b.recent?.[0] ? `B recently: ${req.b.recent[0]}.` : ""}`;
  waiting += 1;
  const run = chain.then(() => ollamaChat([{ role: "system", content: system }, { role: "user", content: user }], { model: process.env.NEUROLAB_NPC_MODEL, fast: true, maxTokens: 110, temperature: 0.95, timeoutMs: 45_000 }));
  chain = run.catch(() => undefined);
  const result = await run.finally(() => { waiting -= 1; });
  let lines: Array<{ who: "a" | "b"; text: string }> = [];
  if (result) {
    lines = result.text.split(/\n+/).map((line) => line.trim().match(/^(A|B)\s*[:\-]\s*(.+)$/i)).filter((m): m is RegExpMatchArray => !!m).map((m) => ({ who: m[1].toLowerCase() as "a" | "b", text: m[2].replace(/^["“]|["”]$/g, "").slice(0, 90) })).slice(0, 4);
  }
  const source = lines.length >= 2 ? ("ollama" as const) : ("template" as const);
  if (source === "template") lines = banterTemplate(req, weather);
  banterCache.set(key, { at: Date.now(), lines });
  if (banterCache.size > 200) banterCache.delete(banterCache.keys().next().value as string);
  return { lines, source };
}

export { addMemory, memoriesFor };
