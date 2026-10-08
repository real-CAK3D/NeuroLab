import { useCallback, useEffect, useRef, useState } from "react";
import { calendarMocked, clientCalendar, lifeNow, mockWeather } from "./calendarLogic";
import { fetchCalendar, getPersona, lifeParam, postRoster, type CalendarInfo, type RosterEntry } from "./lifeApi";

/** Open-Meteo straight from the browser, used only when the backend has no /api/calendar yet (Lewiston, Maine). */
async function clientWeather(): Promise<CalendarInfo["weather"]> {
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=44.1004&longitude=-70.2148&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=1";
    const data = (await (await fetch(url, { signal: AbortSignal.timeout(6000) })).json()) as { current?: { temperature_2m?: number; weather_code?: number } };
    if (!data.current) return null;
    const codes: Record<number, string> = { 0: "clear skies", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "foggy", 48: "foggy", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 61: "light rain", 63: "rain", 65: "heavy rain", 71: "light snow", 73: "snow", 75: "heavy snow", 80: "rain showers", 81: "rain showers", 82: "heavy showers", 95: "thunderstorms", 96: "thunderstorms", 99: "thunderstorms" };
    const summary = codes[data.current.weather_code ?? -1] ?? "mixed weather";
    const tempF = Math.round(data.current.temperature_2m ?? 0);
    return { text: `${summary}, ${tempF}°F`, tempF, summary };
  } catch {
    return null;
  }
}

/** Calendar + weather for the header chip, holiday badge, decorations and ambience. Polls every 10 minutes; the clock ticks every 30 s. */
export function useLifeCalendar() {
  const [info, setInfo] = useState<CalendarInfo | undefined>();
  const [now, setNow] = useState(() => lifeNow());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(lifeNow()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      const date = lifeNow();
      const api = calendarMocked() ? undefined : await fetchCalendar();
      const base = api ?? { ...clientCalendar(date), weather: null };
      let weather = mockWeather() ?? base.weather;
      if (!weather && !lifeParam("weatherMock")) weather = await clientWeather();
      if (alive) setInfo({ ...base, weather });
    }
    void load();
    const timer = window.setInterval(() => void load(), 10 * 60_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  return { info, now };
}

const BDAY_KEY = "gen2-life-bdays-v1";
export type BirthdayMap = Record<string, { m: number; d: number }>;

/** Every worker's persona birthday (GET /api/npc/persona/:id once, cached in localStorage for an hour). */
export function useBirthdays(ids: string[]) {
  const [birthdays, setBirthdays] = useState<BirthdayMap>(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(BDAY_KEY) ?? "{}") as { at?: number; data?: BirthdayMap };
      return raw.data ?? {};
    } catch {
      return {};
    }
  });
  const key = ids.join("|");
  const busy = useRef(false);

  const store = useCallback((data: BirthdayMap, at = Date.now()) => {
    try { window.localStorage.setItem(BDAY_KEY, JSON.stringify({ at, data })); } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      let at = 0;
      let cached: BirthdayMap = {};
      try {
        const raw = JSON.parse(window.localStorage.getItem(BDAY_KEY) ?? "{}") as { at?: number; data?: BirthdayMap };
        at = raw.at ?? 0;
        cached = raw.data ?? {};
      } catch { /* ignore */ }
      const fresh = Date.now() - at < 3_600_000;
      const missing = ids.filter((id) => !cached[id] || !fresh);
      if (!missing.length || busy.current) return;
      busy.current = true;
      const next: BirthdayMap = { ...cached };
      try {
        for (let i = 0; i < missing.length; i += 4) {
          const batch = missing.slice(i, i + 4);
          const results = await Promise.allSettled(batch.map((id) => getPersona(id)));
          results.forEach((result, index) => {
            if (result.status === "fulfilled" && Number.isFinite(result.value.birthdayMonth) && Number.isFinite(result.value.birthdayDay)) next[batch[index]] = { m: result.value.birthdayMonth, d: result.value.birthdayDay };
          });
          if (!alive) return;
        }
        store(next, missing.length === ids.length || !fresh ? Date.now() : at);
        if (alive) setBirthdays(next);
      } finally {
        busy.current = false;
      }
    }
    void load();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setBirthday = useCallback((id: string, m: number, d: number) => {
    setBirthdays((current) => {
      const next = { ...current, [id]: { m, d } };
      store(next, Date.now());
      return next;
    });
  }, [store]);

  return { birthdays, setBirthday };
}

/** Sends the roster (stable ids + displayed title / department) on load, whenever it changes, and every ~5 minutes. */
export function useRosterSync(roster: RosterEntry[]) {
  const signature = roster.map((item) => `${item.id}|${item.name}|${item.title}|${item.department}`).join("\n");
  const rosterRef = useRef(roster);
  rosterRef.current = roster;
  const lastSent = useRef("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (signature === lastSent.current) return;
      lastSent.current = signature;
      void postRoster(rosterRef.current);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [signature]);

  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) void postRoster(rosterRef.current); }, 5 * 60_000);
    return () => window.clearInterval(timer);
  }, []);
}
