import type { Gen2Direction } from "../game/gen2FacilityData";

/** Short-lived bubbles pinned to a worker (promotion, "Congrats!", birthday songs, arrivals). NpcView reads these each render. */
export type Moment = { text: string; until: number; mark?: boolean; tone?: "promo" | "cheer" | "party" | "hello" };
export const MOMENTS = new Map<string, Moment>();

export function setMoment(id: string, text: string, ms: number, extra: Pick<Moment, "mark" | "tone"> = {}) {
  MOMENTS.set(id, { text, until: Date.now() + ms, ...extra });
}

export function activeMoment(id: string): Moment | undefined {
  const moment = MOMENTS.get(id);
  if (!moment) return undefined;
  if (moment.until <= Date.now()) {
    MOMENTS.delete(id);
    return undefined;
  }
  return moment;
}

/** Workers standing still for a celebration (id -> facing + until). advanceNpc holds them like a conversation with the visitor. */
export const CELEBRATE_HOLD = new Map<string, { face: Gen2Direction; until: number }>();

export function activeHold(id: string): Gen2Direction | undefined {
  const hold = CELEBRATE_HOLD.get(id);
  if (!hold) return undefined;
  if (hold.until <= Date.now()) {
    CELEBRATE_HOLD.delete(id);
    return undefined;
  }
  return hold.face;
}

/** The sim context's smalltalk lines for weather and holidays (set by the dashboard when the calendar loads). */
export const LIFE_TALK: { lines: string[] } = { lines: [] };
