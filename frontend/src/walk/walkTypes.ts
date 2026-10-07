import type { Gen2Direction, Gen2Prop } from "../game/gen2FacilityData";

export type WalkDir = Gen2Direction;
export type WalkView = "top" | "fp";

/** Minimal NPC snapshot the walk engine needs (the dashboard keeps the real simulation). */
export type WalkNpc = {
  id: string;
  x: number;
  y: number;
  dir: WalkDir;
  stepFrame: 0 | 1 | 2;
  role: string;
  hatColor?: string;
  shoeColor?: string;
};

/** What a plant billboard should look like: a column / row of plants.png, "pot" for an empty pot, undefined to hide it. */
export type WalkPlantLook = { col: number; row: number } | "pot" | undefined;

/** Everything the walk engine needs from the dashboard; the dashboard refreshes this each render. */
export type WalkHost = {
  /** The dashboard's own walkable-tile set (walls, doors and solid props already applied). */
  walkable: Set<string>;
  getNpcs(): WalkNpc[];
  plantLook(prop: Gen2Prop): WalkPlantLook;
  /** A: act on the tile the player faces. Returns a short feedback line when nothing happened. */
  interact(x: number, y: number): string | undefined;
  /** Short label for what the player is facing (empty when nothing). */
  describe(x: number, y: number): string;
  /** Longer one-line readout (same content as the A card) for the caption strip, or "". */
  caption(x: number, y: number): string;
  /** Real wall-clock time for first-person wall clocks. */
  clock(): { hours: number; minutes: number; text: string };
  /** Text lines a screen / whiteboard / crate / shelf / terminal shows (first line is its title). */
  readout(prop: Gen2Prop): string[] | undefined;
  /** Lines for a room's wall sign: name plus live vitals / lifecycle phase. */
  signLines(roomId: string): string[];
  /** Lines for a room's bulletin board. */
  noticeLines(roomId: string): string[];
  /** B: close the topmost card/menu/dialog. Returns true when something was closed. */
  back(): boolean;
  /** True while a modal (terminal chat, dialog) should swallow movement keys. */
  inputBlocked(): boolean;
};

export type WalkSnapshot = {
  x: number;
  y: number;
  dir: WalkDir;
};

export const DIR_VEC: Record<WalkDir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const DIR_OPPOSITE: Record<WalkDir, WalkDir> = { up: "down", down: "up", left: "right", right: "left" };
/** Turning right (clockwise as seen from above, y down) from each heading. */
export const DIR_RIGHT_OF: Record<WalkDir, WalkDir> = { up: "right", right: "down", down: "left", left: "up" };
export const DIR_LEFT_OF: Record<WalkDir, WalkDir> = { up: "left", left: "down", down: "right", right: "up" };
/** First-person heading in radians (0 = east, y grows downward so north is -PI/2). */
export const DIR_ANGLE: Record<WalkDir, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

export function tileKey(x: number, y: number) {
  return `${x},${y}`;
}
