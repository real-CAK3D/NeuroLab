// Client-side calendar: used when GET /api/calendar is unavailable (older backend) and for the dev mock overrides
//   ?calendarMock=halloween | thanksgiving | christmas | newyear | valentines | stpatricks | easter | fourth | patriots | YYYY-MM-DD
//   ?calendarHour=21   (pretend it is 9 PM)       ?weatherMock=rain | snow | clear | cold | hot
import { lifeParam, type CalendarInfo } from "./lifeApi";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Holiday = { name: string; month: number; day: number; year: number; note: string };

function dayNumber(year: number, month: number, day: number) {
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}
function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}
function lastWeekday(year: number, month: number, weekday: number) {
  const last = new Date(Date.UTC(year, month, 0));
  return last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7);
}
export function easterOf(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return { month: Math.floor((h + l - 7 * m + 114) / 31), day: ((h + l - 7 * m + 114) % 31) + 1 };
}

function holidaysForYear(year: number): Holiday[] {
  const f = (name: string, month: number, day: number, note: string): Holiday => ({ name, month, day, year, note });
  const e = easterOf(year);
  return [
    f("New Year's Day", 1, 1, "fresh start"), f("Valentine's Day", 2, 14, "candy and cards in the break room"), f("St. Patrick's Day", 3, 17, "green everything"),
    f("April Fools' Day", 4, 1, "pranks are risky around expensive equipment"), f("4/20", 4, 20, "the facility's unofficial holiday"), f("Juneteenth", 6, 19, "a federal holiday"),
    f("Independence Day", 7, 4, "fireworks, cookouts and lobster rolls"), f("Halloween", 10, 31, "costumes and candy"), f("Veterans Day", 11, 11, "a day to thank veterans"),
    f("Christmas Eve", 12, 24, "lights and last-minute shopping"), f("Christmas Day", 12, 25, "family, food and snow"), f("New Year's Eve", 12, 31, "countdown plans"),
    f("Martin Luther King Jr. Day", 1, nthWeekday(year, 1, 1, 3), "a federal holiday"), f("Presidents' Day", 2, nthWeekday(year, 2, 1, 3), "a long weekend in winter"),
    f("Patriots' Day", 4, nthWeekday(year, 4, 1, 3), "Marathon Monday"), f("Easter", e.month, e.day, "brunch and candy"), f("Mother's Day", 5, nthWeekday(year, 5, 0, 2), "call your mom"),
    f("Memorial Day", 5, lastWeekday(year, 5, 1), "the unofficial start of summer"), f("Father's Day", 6, nthWeekday(year, 6, 0, 3), "grilling and dad jokes"),
    f("Labor Day", 9, nthWeekday(year, 9, 1, 1), "the last long weekend of summer"), f("Indigenous Peoples' Day", 10, nthWeekday(year, 10, 1, 2), "second Monday in October"),
    f("Election Day", 11, nthWeekday(year, 11, 1, 1) + 1, "vote early if you can"), f("Thanksgiving", 11, nthWeekday(year, 11, 4, 4), "turkey, pie and family"),
    f("Black Friday", 11, nthWeekday(year, 11, 4, 4) + 1, "shopping chaos"),
  ];
}

export function seasonOf(month: number) {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "fall";
}

/** Decoration set for a local date (same windows as the backend's decorFor). */
export function decorForDate(date: Date): string | null {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const md = month * 100 + day;
  const today = dayNumber(year, month, day);
  if (md >= 1015 && md <= 1101) return "halloween";
  if (md >= 1115 && md <= 1128) return "thanksgiving";
  if (md >= 1201 && md <= 1226) return "christmas";
  if (md >= 1227 || md <= 102) return "newyear";
  if (md >= 207 && md <= 214) return "valentines";
  if (md >= 310 && md <= 317) return "stpatricks";
  const e = easterOf(year);
  const toEaster = dayNumber(year, e.month, e.day) - today;
  if (toEaster >= 0 && toEaster <= 7) return "easter";
  if (md >= 628 && md <= 705) return "fourth";
  const patriots = dayNumber(year, 4, nthWeekday(year, 4, 1, 3)) - today;
  if (patriots >= 0 && patriots <= 2) return "patriots";
  return null;
}

export function clientCalendar(date: Date): Omit<CalendarInfo, "weather"> {
  const today = dayNumber(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const holidays: CalendarInfo["holidays"] = [];
  for (const holiday of [...holidaysForYear(date.getFullYear() - 1), ...holidaysForYear(date.getFullYear()), ...holidaysForYear(date.getFullYear() + 1)]) {
    const diff = dayNumber(holiday.year, holiday.month, holiday.day) - today;
    if (diff >= -3 && diff <= 30) holidays.push({ name: holiday.name, daysUntil: diff, note: holiday.note });
  }
  holidays.sort((a, b) => a.daysUntil - b.daysUntil);
  const hour = date.getHours();
  return {
    now: { iso: date.toISOString(), weekday: WEEKDAYS[date.getDay()], date: `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`, clock12: `${hour % 12 === 0 ? 12 : hour % 12}:${String(date.getMinutes()).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}` },
    season: seasonOf(date.getMonth() + 1),
    holidays,
    decor: decorForDate(date),
  };
}

// ---- dev mocks ----

const MOCK_DATES: Record<string, (year: number) => [number, number]> = {
  halloween: () => [10, 25], thanksgiving: () => [11, 20], christmas: () => [12, 15], newyear: () => [12, 30], valentines: () => [2, 10], stpatricks: () => [3, 14],
  easter: (year) => { const e = easterOf(year); return [e.month, Math.max(1, e.day - 3)]; }, fourth: () => [7, 1],
  patriots: (year) => [4, nthWeekday(year, 4, 1, 3) - 2],
};

/** The date the facility believes it is: real now, or the ?calendarMock / ?calendarHour dev override. */
export function lifeNow(): Date {
  const real = new Date();
  const mock = lifeParam("calendarMock");
  const hour = lifeParam("calendarHour");
  let date = real;
  if (mock) {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(mock);
    if (iso) date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), real.getHours(), real.getMinutes());
    else if (MOCK_DATES[mock]) {
      const [month, day] = MOCK_DATES[mock](real.getFullYear());
      date = new Date(real.getFullYear(), month - 1, day, real.getHours(), real.getMinutes());
    }
  }
  if (hour !== null && Number.isFinite(Number(hour))) {
    date = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(Number(hour)), Math.round((Number(hour) % 1) * 60));
  }
  return date;
}

export const calendarMocked = () => !!lifeParam("calendarMock");

export function mockWeather(): CalendarInfo["weather"] {
  const mock = lifeParam("weatherMock");
  if (!mock) return null;
  const table: Record<string, { tempF: number; summary: string }> = {
    rain: { tempF: 51, summary: "rain" }, snow: { tempF: 27, summary: "snow" }, clear: { tempF: 64, summary: "clear skies" }, cold: { tempF: 12, summary: "overcast" }, hot: { tempF: 91, summary: "mostly clear" },
  };
  const entry = table[mock] ?? table.clear;
  return { text: `${entry.summary}, ${entry.tempF}°F (mock)`, ...entry };
}

// ---- header chip ----

const SHORT_HOLIDAY: Record<string, string> = {
  "Indigenous Peoples' Day": "INDIGENOUS DAY", "Martin Luther King Jr. Day": "MLK DAY", "Presidents' Day": "PRESIDENTS DAY", "Independence Day": "4TH OF JULY", "St. Patrick's Day": "ST PATRICK'S",
  "Valentine's Day": "VALENTINE'S", "New Year's Day": "NEW YEAR", "New Year's Eve": "NEW YEAR'S EVE", "Christmas Day": "CHRISTMAS", "April Fools' Day": "APRIL FOOLS",
};

export function chipText(date: Date, weather: CalendarInfo["weather"]) {
  const day = `${WEEKDAYS[date.getDay()].slice(0, 3)} ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`.toUpperCase();
  if (!weather) return day;
  const summary = weather.summary.replace(/ skies?$/, "").toUpperCase();
  return `${day} · ${weather.tempF}°F ${summary}`;
}

export function holidayBadge(info: Pick<CalendarInfo, "holidays">, withinDays = 10) {
  const next = info.holidays.find((holiday) => holiday.daysUntil >= 0 && holiday.daysUntil <= withinDays && !/^(4\/20|April Fools)/.test(holiday.name));
  if (!next) return undefined;
  const name = (SHORT_HOLIDAY[next.name] ?? next.name).toUpperCase();
  return next.daysUntil === 0 ? `${name} TODAY` : `${name} IN ${next.daysUntil}D`;
}

// ---- time-of-day ambience ----

export type Tint = { r: number; g: number; b: number; a: number };

/** Approximate sunrise / sunset (local hours) for Maine from the day of year. */
export function sunTimes(date: Date) {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const doy = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86_400_000);
  const s = Math.sin(((doy - 80) / 365) * Math.PI * 2);
  return { sunrise: 6.1 - 1.1 * s, sunset: 18.2 + 2.2 * s };
}

export function tintFor(date: Date): Tint {
  const hour = date.getHours() + date.getMinutes() / 60;
  const { sunrise: sr, sunset: ss } = sunTimes(date);
  const night: Tint = { r: 16, g: 26, b: 78, a: 0.36 };
  const none: Tint = { r: 255, g: 255, b: 255, a: 0 };
  const stops: Array<[number, Tint]> = [
    [0, night], [sr - 1, night], [sr - 0.15, { r: 255, g: 130, b: 90, a: 0.2 }], [sr + 0.9, { r: 255, g: 190, b: 120, a: 0.1 }], [sr + 2, none],
    [ss - 2, none], [ss - 0.6, { r: 255, g: 190, b: 100, a: 0.1 }], [ss + 0.1, { r: 255, g: 120, b: 60, a: 0.2 }], [ss + 0.9, { r: 110, g: 70, b: 130, a: 0.27 }], [ss + 1.9, night], [24, night],
  ];
  for (let i = 1; i < stops.length; i += 1) {
    const [h1, t1] = stops[i];
    const [h0, t0] = stops[i - 1];
    if (hour <= h1) {
      const k = h1 === h0 ? 1 : Math.max(0, (hour - h0) / (h1 - h0));
      return { r: Math.round(t0.r + (t1.r - t0.r) * k), g: Math.round(t0.g + (t1.g - t0.g) * k), b: Math.round(t0.b + (t1.b - t0.b) * k), a: t0.a + (t1.a - t0.a) * k };
    }
  }
  return night;
}

export type WeatherKind = "rain" | "snow" | "clear";

export function weatherKind(weather: CalendarInfo["weather"]): WeatherKind {
  const text = `${weather?.summary ?? ""}`.toLowerCase();
  if (/snow/.test(text)) return "snow";
  if (/rain|drizzle|shower|thunder/.test(text)) return "rain";
  return "clear";
}

/** Short smalltalk lines (<= ~22 chars, upper case like the other canned chat) driven by the weather and the next holiday. */
export function smallTalkLines(info: Pick<CalendarInfo, "holidays" | "weather"> | undefined): string[] {
  const lines: string[] = [];
  if (!info) return lines;
  const w = info.weather;
  if (w) {
    const kind = weatherKind(w);
    if (kind === "rain") lines.push("RAINING AGAIN OUT THERE", "HOPE YOU HAD AN UMBRELLA", "RAIN ON THE ROOF IS NICE");
    else if (kind === "snow") lines.push("SNOWING PRETTY GOOD", "PLOWS ARE OUT ALREADY", "ROADS WERE ROUGH TODAY");
    if (w.tempF <= 20) lines.push(`${w.tempF} DEGREES, WICKED COLD`, "MY CAR WOULDNT START");
    else if (w.tempF >= 85) lines.push(`${w.tempF} OUT, TOO HOT`, "LAKE WEATHER, HONESTLY");
    else lines.push(`${w.tempF} DEGREES OUT TODAY`);
  }
  const holiday = info.holidays.find((item) => item.daysUntil >= 0 && item.daysUntil <= 10 && !/^(4\/20|April Fools)/.test(item.name));
  if (holiday) lines.push(holiday.daysUntil === 0 ? `HAPPY ${(SHORT_HOLIDAY[holiday.name] ?? holiday.name).toUpperCase()}` : `${(SHORT_HOLIDAY[holiday.name] ?? holiday.name).toUpperCase()} IN ${holiday.daysUntil} DAYS`);
  return lines.map((line) => line.slice(0, 26));
}
