// Calendar awareness for staff small talk: today's date in the facility's time zone, nearby holidays, season and local (Maine) flavor.

const TZ = process.env.NEUROLAB_TZ || "America/New_York";
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type Holiday = { name: string; month: number; day: number; year: number; note: string };

// "Now" as calendar parts in the facility time zone.
export function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hour12: false, weekday: "long" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), hour, minute: Number(get("minute")), weekday: get("weekday") };
}

export function clockLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

export function dayPart(hour: number) {
  if (hour < 5) return "the middle of the night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}
function lastWeekday(year: number, month: number, weekday: number) {
  const last = new Date(Date.UTC(year, month, 0));
  return last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7);
}
function easter(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

export function holidaysForYear(year: number): Holiday[] {
  const fixed = (name: string, month: number, day: number, note: string): Holiday => ({ name, month, day, year, note });
  const e = easter(year);
  const list: Holiday[] = [
    fixed("New Year's Day", 1, 1, "fresh start, everyone swears they will organize better"),
    fixed("Valentine's Day", 2, 14, "candy and cards in the break room"),
    fixed("St. Patrick's Day", 3, 17, "green everything"),
    fixed("April Fools' Day", 4, 1, "pranks are risky around expensive equipment"),
    fixed("4/20", 4, 20, "the facility's unofficial holiday (the break room gets extra snacks)"),
    fixed("Juneteenth", 6, 19, "a federal holiday"),
    fixed("Independence Day", 7, 4, "fireworks, cookouts and lobster rolls"),
    fixed("Halloween", 10, 31, "costumes and candy, pumpkins on the desks"),
    fixed("Veterans Day", 11, 11, "a day to thank veterans"),
    fixed("Christmas Eve", 12, 24, "lights and last-minute shopping"),
    fixed("Christmas Day", 12, 25, "family, food and snow if we are lucky"),
    fixed("New Year's Eve", 12, 31, "countdown plans and sparkling cider"),
    fixed("Martin Luther King Jr. Day", 1, nthWeekday(year, 1, 1, 3), "a federal holiday"),
    fixed("Presidents' Day", 2, nthWeekday(year, 2, 1, 3), "a long weekend in the dead of winter"),
    fixed("Patriots' Day", 4, nthWeekday(year, 4, 1, 3), "a Maine and Massachusetts holiday, with the Boston Marathon"),
    fixed("Easter", e.month, e.day, "brunch, candy and spring finally showing up"),
    fixed("Mother's Day", 5, nthWeekday(year, 5, 0, 2), "call your mom"),
    fixed("Memorial Day", 5, lastWeekday(year, 5, 1), "the unofficial start of summer"),
    fixed("Father's Day", 6, nthWeekday(year, 6, 0, 3), "grilling and dad jokes"),
    fixed("Labor Day", 9, nthWeekday(year, 9, 1, 1), "the last long weekend of summer"),
    fixed("Indigenous Peoples' Day", 10, nthWeekday(year, 10, 1, 2), "Maine's name for the second Monday in October"),
    fixed("Election Day", 11, nthWeekday(year, 11, 1, 1) + 1, "vote early if you can"),
    fixed("Thanksgiving", 11, nthWeekday(year, 11, 4, 4), "turkey, pie and family"),
    fixed("Black Friday", 11, nthWeekday(year, 11, 4, 4) + 1, "shopping chaos"),
  ];
  return list;
}

function dayNumber(year: number, month: number, day: number) {
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function seasonOf(month: number) {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "fall";
}

const MAINE_SEASON_FLAVOR: Record<string, string> = {
  winter: "Lewiston winters mean snow banks, plow trucks, wood stoves and ice fishing on the lakes.",
  spring: "Spring in Maine means mud season, black flies on the way and everyone itching to get outside.",
  summer: "Maine summers are short and perfect: lakes, lobster rolls, blueberries and long evenings.",
  fall: "Fall in Maine means peak foliage, apple cider doughnuts, woodsmoke and the first frosty mornings.",
};

export function calendarFacts(date = new Date()): string[] {
  const p = localParts(date);
  const today = dayNumber(p.year, p.month, p.day);
  const all = [...holidaysForYear(p.year), ...holidaysForYear(p.year + 1)];
  const lines = [`Today is ${p.weekday}, ${MONTHS[p.month - 1]} ${p.day}, ${p.year}. It is ${dayPart(p.hour)} (${clockLabel(date)}). Season: ${seasonOf(p.month)}. ${MAINE_SEASON_FLAVOR[seasonOf(p.month)]} The facility is in Lewiston, Maine.`];
  const isWeekend = p.weekday === "Saturday" || p.weekday === "Sunday";
  lines.push(isWeekend ? "It is the weekend; the skeleton crew is on." : `The weekend is ${p.weekday === "Friday" ? "tomorrow" : `${(6 - WEEKDAYS.indexOf(p.weekday) + 7) % 7} days away`}.`);
  for (const holiday of all) {
    const diff = dayNumber(holiday.year, holiday.month, holiday.day) - today;
    if (diff === 0) lines.push(`Today is ${holiday.name}: ${holiday.note}.`);
    else if (diff > 0 && diff <= 21) lines.push(`${holiday.name} is ${diff === 1 ? "tomorrow" : `in ${diff} days`} (${MONTHS[holiday.month - 1]} ${holiday.day}): ${holiday.note}.`);
    else if (diff < 0 && diff >= -3) lines.push(`${holiday.name} was ${diff === -1 ? "yesterday" : `${-diff} days ago`}.`);
  }
  return lines;
}

export function daysUntilBirthday(month: number, day: number, date = new Date()) {
  const p = localParts(date);
  const today = dayNumber(p.year, p.month, p.day);
  let target = dayNumber(p.year, month, day);
  if (target < today) target = dayNumber(p.year + 1, month, day);
  return target - today;
}

export function formatBirthday(month: number, day: number) {
  return `${MONTHS[month - 1]} ${day}`;
}
