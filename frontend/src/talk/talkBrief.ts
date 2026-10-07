// Talk-to-staff plumbing: the brief the dashboard feeds the NPC chat backend, the request itself (30 s timeout, local
// template fallback), per-NPC session memory, greetings and Pokemon-style text pagination. No React in here.

export type TalkTopic = "job" | "recent" | "upcoming" | "coworkers" | "day" | "weather" | "interests" | "life" | "favorites" | "memories" | "plans" | "facility" | "free";

export type TalkNpcBrief = {
  id: string;
  name: string;
  title: string;
  department: string;
  room: string;
  sex: string;
  age: number;
  personality: string;
  mood: string;
  workEthic: string;
  action: string;
  need: string;
  block: string;
  nextBreak: string;
  recent: string[];
  upcoming: string[];
};

export type TalkBrief = {
  npc: TalkNpcBrief;
  roster: Array<{ id: string; name: string; title: string; department: string }>;
  nearby: Array<{ name: string; doing: string }>;
};

export type TalkTurn = { from: "player" | "npc"; text: string };
export type TalkClock = { label: string; part: "morning" | "afternoon" | "evening" | "night"; day: string };
export type TalkReply = { reply: string; source: "ollama" | "template"; model?: string };

const REQUEST_TIMEOUT_MS = 60_000;
const HISTORY_TURNS = 6;
export const TALK_MESSAGE_LIMIT = 140;
const backendUrl = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "").replace(/\/$/, "");

/** Conversation memory per NPC for the browser session, so follow-up questions make sense. */
const talkHistory = new Map<string, TalkTurn[]>();

export function talkHistoryFor(id: string): TalkTurn[] {
  return talkHistory.get(id) ?? [];
}

function remember(id: string, turns: TalkTurn[]) {
  talkHistory.set(id, [...talkHistoryFor(id), ...turns].slice(-HISTORY_TURNS));
}

export function talkClock(date = new Date()): TalkClock {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const label = `${hours % 12 === 0 ? 12 : hours % 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
  const part = hours >= 5 && hours < 12 ? "morning" : hours >= 12 && hours < 17 ? "afternoon" : hours >= 17 && hours < 21 ? "evening" : "night";
  return { label, part, day: date.toLocaleDateString("en-US", { weekday: "long" }) };
}

export const TOPIC_QUESTIONS: Record<TalkTopic, string> = {
  job: "What do you do here?",
  recent: "What have you been up to lately?",
  upcoming: "What's coming up for you?",
  coworkers: "What do you think of your coworkers?",
  day: "How's your day going?",
  weather: "How's the weather?",
  interests: "What do you do for fun?",
  life: "Tell me about your life outside work.",
  favorites: "What are your favorite things?",
  memories: "Tell me a memory.",
  plans: "Any plans for the weekend?",
  facility: "How's the facility doing?",
  free: "",
};

export async function askNpc(brief: TalkBrief, topic: TalkTopic, message: string | undefined, signal: AbortSignal): Promise<TalkReply> {
  const clock = talkClock();
  const history = talkHistoryFor(brief.npc.id);
  const playerText = topic === "free" ? (message ?? "").trim() : TOPIC_QUESTIONS[topic];
  const body = { npc: brief.npc, roster: brief.roster, nearby: brief.nearby, topic, ...(topic === "free" ? { message: playerText } : {}), history, clock };
  let result: TalkReply | undefined;
  const timeout = new AbortController();
  const timer = window.setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
  const relay = () => timeout.abort();
  signal.addEventListener("abort", relay);
  try {
    const response = await fetch(`${backendUrl}/api/npc/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: timeout.signal,
    });
    if (!response.ok) throw new Error(`chat ${response.status}`);
    const data = (await response.json()) as Partial<TalkReply>;
    if (typeof data.reply === "string" && data.reply.trim()) result = { reply: data.reply.trim(), source: data.source === "ollama" ? "ollama" : "template", model: data.model };
  } catch {
    if (signal.aborted) throw new DOMException("cancelled", "AbortError");
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener("abort", relay);
  }
  const reply = result ?? { reply: templateReply(brief, topic, playerText, clock), source: "template" as const };
  remember(brief.npc.id, [{ from: "player", text: playerText }, { from: "npc", text: reply.reply }]);
  return reply;
}

function pickBy<T>(items: T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return items[hash % items.length];
}

function lower(text: string) {
  return text.toLowerCase();
}

/** Local line used when the backend is unreachable. */
function templateReply(brief: TalkBrief, topic: TalkTopic, message: string, clock: TalkClock): string {
  const { npc } = brief;
  switch (topic) {
    case "job":
      return `I'm the ${npc.title} in ${npc.department}. Right now I'm ${lower(npc.action)}, mostly around ${npc.room}.`;
    case "recent":
      return npc.recent.length ? `Lately? ${npc.recent.slice(-3).join(". Then ")}.` : "Nothing much yet. It's been a quiet stretch.";
    case "upcoming":
      return npc.upcoming.length ? `Coming up: ${npc.upcoming.slice(0, 3).join(". After that, ")}.` : `Next break is ${npc.nextBreak}. Otherwise, more of the same.`;
    case "coworkers": {
      const mate = brief.roster.find((other) => other.id !== npc.id && other.department === npc.department) ?? brief.roster.find((other) => other.id !== npc.id);
      return mate ? `I get on fine with everyone. ${mate.name}, the ${mate.title}, keeps things interesting.` : "I mostly keep to myself, to be honest.";
    }
    case "day":
      return `It's ${clock.day} ${clock.part}, and I'm feeling ${lower(npc.mood)}. ${npc.block}.`;
    case "weather":
      return `No windows in here! I couldn't tell you. It's ${clock.label} on a ${clock.day}, that's all I know.`;
    case "interests":
      return "When I'm off the clock I like to unwind and do my own thing. You should ask me again later.";
    case "life":
      return "My life outside work is pretty simple. I keep it quiet.";
    case "favorites":
      return "I like the simple things, a good coffee and a quiet shift. Ask me again later.";
    case "memories":
      return "I remember my first day here. Everything felt new. It's been a good stretch since.";
    case "plans":
      return "Nothing big planned. Probably catching up on sleep and some chores.";
    case "facility":
      return `The facility keeps us busy. I work in ${npc.department}, around ${npc.room}. Check the room panels for the live numbers.`;
    default:
      return message ? `Hmm, "${message.slice(0, 40)}"? Good question. I'd have to think about that one.` : "Hm? Sorry, I zoned out.";
  }
}

export function talkGreeting(brief: TalkBrief): string {
  const { npc } = brief;
  const clock = talkClock();
  const hello: Record<TalkClock["part"], string[]> = {
    morning: ["Oh, good morning!", "Morning! Oh, hello!", "Oh, hello! Early start today."],
    afternoon: ["Oh, hello!", "Good afternoon!", "Oh, hi there! Afternoon."],
    evening: ["Oh, hello! Good evening.", "Evening! Oh, hi there.", "Oh, hello! Long day, huh?"],
    night: ["Oh! Hello. Quiet around here at this hour.", "Late night, huh? Hello.", "Oh, hello! Burning the midnight oil?"],
  };
  const mood = lower(npc.mood);
  const moodLine = /tired|sleep|drain|exhaust/.test(mood)
    ? "Sorry, I'm a little worn out."
    : /busy|work|focus|check/.test(mood)
      ? `I'm ${mood} at the moment, but I've got a minute.`
      : `I'm feeling ${mood} today.`;
  return `${pickBy(hello[clock.part], npc.id + clock.part)} ${moodLine} What's up?`;
}

/** Splits reply text into short pages (about two lines each), preferring sentence breaks. */
export function paginate(text: string, limit = 120): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return ["..."];
  const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [clean];
  const pages: string[] = [];
  let page = "";
  const flush = () => {
    if (page.trim()) pages.push(page.trim());
    page = "";
  };
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (sentence.length > limit) {
      flush();
      let line = "";
      for (const word of sentence.split(" ")) {
        if (line && (line + " " + word).length > limit) {
          pages.push(line);
          line = word;
        } else line = line ? `${line} ${word}` : word;
      }
      page = line;
      continue;
    }
    if (page && (page + " " + sentence).length > limit) flush();
    page = page ? `${page} ${sentence}` : sentence;
  }
  flush();
  return pages;
}
