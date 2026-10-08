import { useMemo, type CSSProperties } from "react";
import { GEN2_TILE } from "../game/gen2FacilityData";
import { sunTimes, tintFor } from "./calendarLogic";

/*
 * Pixel decorations for holidays, birthdays and the time of day. Everything here is a non-solid, pointer-transparent overlay
 * drawn from tiny ASCII sprites (rendered once to SVG data URIs), so it never changes collision or the walkable map.
 */

type Palette = Record<string, string>;

const svgCache = new Map<string, string>();

/** ASCII rows + palette ('.' is transparent) -> CSS url() of a crisp SVG. */
function pixelSprite(key: string, rows: string[], palette: Palette): string {
  const hit = svgCache.get(key);
  if (hit) return hit;
  const rects: string[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === "." || !palette[ch]) { x += 1; continue; }
      let end = x + 1;
      while (end < row.length && row[end] === ch) end += 1;
      rects.push(`<rect x='${x}' y='${y}' width='${end - x}' height='1' fill='${palette[ch]}'/>`);
      x = end;
    }
  });
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${rows[0].length}' height='${rows.length}' shape-rendering='crispEdges'>${rects.join("")}</svg>`;
  const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  svgCache.set(key, url);
  return url;
}

type SpriteDef = { rows: string[]; palette: Palette };

const K = "#1b1424";
const SPRITES: Record<string, SpriteDef> = {
  pumpkin: { rows: ["...gg...", "..oooo..", ".oOoOoo.", "oOkoOkoo", "oOoooOoo", "oOkkkkOo", ".oOooOo.", "..oooo.."], palette: { g: "#3e8a3a", o: "#f08a1c", O: "#c9600e", k: K } },
  cobweb: { rows: ["wwwwwwww", "wwww....", "ww.w.w..", "w.w..w..", "w.w...w.", "w..w..w.", "w...w..w", "w....w.."], palette: { w: "#8d8da8" } },
  bat: { rows: ["b..bb..b", "bb.bb.bb", "bbbbbbbb", ".bb..bb.", "..b..b.."], palette: { b: "#2a2236" } },
  leaf: { rows: ["...rr...", "..rrrr..", ".rrorrr.", "rrrorrrr", ".rrorrr.", "..rorr..", "...o....", "...o...."], palette: { r: "#d2501c", o: "#7a3a14" } },
  turkey: { rows: ["o.oyyo.o", ".oyyyyo.", "oyyrryyo", ".yyyyyy.", "..tttt..", "..ttkt..", "..tttt..", "...rr..."], palette: { o: "#c96a1a", y: "#e8b030", r: "#c4301f", t: "#7a4a22", k: K } },
  tree: { rows: ["...yy...", "...gg...", "..gggg..", ".gggrgg.", "..gggg..", ".ggbggg.", "gggggggg", ".gyggrg.", "gggggggg", "...tt...", "...tt..."], palette: { y: "#ffd84a", g: "#2f8a3c", r: "#e03a3a", b: "#4a8af0", t: "#6a4020" } },
  present: { rows: ["..rr.rr.", "...rrr..", "bbbgbbbb", "bbbgbbbb", "bbbgbbbb", "bbbgbbbb"], palette: { r: "#e03a3a", g: "#ffd84a", b: "#3a64c8" } },
  presentG: { rows: ["..yy.yy.", "...yyy..", "gggrgggg", "gggrgggg", "gggrgggg", "gggrgggg"], palette: { y: "#ffd84a", r: "#e03a3a", g: "#2f8a3c" } },
  heart: { rows: [".rr..rr.", "rrrrrrrr", "rrwrrrrr", "rrrrrrrr", ".rrrrrr.", "..rrrr..", "...rr..."], palette: { r: "#e8456a", w: "#ffd0dc" } },
  heartP: { rows: [".rr..rr.", "rrrrrrrr", "rrwrrrrr", "rrrrrrrr", ".rrrrrr.", "..rrrr..", "...rr..."], palette: { r: "#f48fb1", w: "#fff0f5" } },
  shamrock: { rows: [".gg..gg.", "gggggggg", "gggggggg", ".gggggg.", "gggggggg", "gggggggg", ".gg..gg.", "....g...", "....g..."], palette: { g: "#2c9a48" } },
  egg: { rows: ["..pp..", ".pppp.", "pbbbbp", "pppppp", "ypypyp", "pppppp", ".pppp.", "..pp.."], palette: { p: "#f4a6c8", b: "#8ec8f0", y: "#ffe27a" } },
  eggB: { rows: ["..pp..", ".pppp.", "pyyyyp", "pppppp", "gpgpgp", "pppppp", ".pppp.", "..pp.."], palette: { p: "#9ad0f4", y: "#ffe27a", g: "#9ce29a" } },
  star: { rows: ["...yy...", "...yy...", "yyyyyyyy", ".yyyyyy.", "..yyyy..", ".yy..yy.", ".y....y."], palette: { y: "#ffd84a" } },
  firework: { rows: ["...y....", "y..y..y.", ".y.y.y..", "..yyy...", "yyyryyy.", "..yyy...", ".y.y.y..", "y..y..y."], palette: { y: "#f4c63c", r: "#e03a3a" } },
  balloonR: { rows: [".rrrr.", "rrwrrr", "rrwrrr", "rrrrrr", "rrrrrr", ".rrrr.", "..rr..", "..k...", "...k..", "..k..."], palette: { r: "#e8456a", w: "#ffc4d0", k: "#5a5a68" } },
  balloonB: { rows: [".bbbb.", "bbwbbb", "bbwbbb", "bbbbbb", "bbbbbb", ".bbbb.", "..bb..", "...k..", "..k...", "...k.."], palette: { b: "#3f86e8", w: "#bcdcff", k: "#5a5a68" } },
  balloonY: { rows: [".yyyy.", "yywyyy", "yywyyy", "yyyyyy", "yyyyyy", ".yyyy.", "..yy..", "..k...", "...k..", "..k..."], palette: { y: "#f4c63c", w: "#fff3b0", k: "#5a5a68" } },
  cake: { rows: ["y..y..y.", "r..r..r.", "wwwwwwww", "pppppppp", "cccccccc", "pppppppp", "cccccccc", "dddddddd"], palette: { y: "#ffd84a", r: "#e04a3a", w: "#fff8ec", p: "#f48fb1", c: "#8a4a2a", d: "#e8e0d0" } },
  hat: { rows: ["...y....", "..rr....", "..rb....", ".rrbr...", ".rbrrb.."], palette: { y: "#ffd84a", r: "#e8456a", b: "#3f86e8" } },
};

type StripDef = { rows: string[]; palette: Palette };
const STRIPS: Record<string, StripDef> = {
  lights: { rows: ["kkkkkkkkkkkkkkkk", "..r...y...g...b.", "..r...y...g...b."], palette: { k: "#2a2a30", r: "#ff5a4a", y: "#ffe45a", g: "#5ae070", b: "#5aa8ff" } },
  buntingUsa: { rows: ["kkkkkkkkkkkkkkk", "rrrr.wwww.bbbb.", ".rr...ww...bb..", "..r....w....b.."], palette: { k: "#2a2a30", r: "#d8343a", w: "#f4f4f4", b: "#2f52b8" } },
  buntingBoston: { rows: ["kkkkkkkkkkkkkkk", "bbbb.yyyy.bbbb.", ".bb...yy...bb..", "..b....y....b.."], palette: { k: "#2a2a30", b: "#2a52be", y: "#f4c63c" } },
  buntingSpring: { rows: ["kkkkkkkkkkkkkkk", "pppp.yyyy.gggg.", ".pp...yy...gg..", "..p....y....g.."], palette: { k: "#2a2a30", p: "#f4a6c8", y: "#ffe27a", g: "#9ad0f4" } },
  buntingParty: { rows: ["kkkkkkkkkkkkkkk", "rrrr.yyyy.bbbb.", ".rr...yy...bb..", "..r....y....b.."], palette: { k: "#2a2a30", r: "#e8456a", y: "#ffd84a", b: "#3f86e8" } },
  buntingGreen: { rows: ["kkkkkkkkkkkkkkk", "gggg.wwww.oooo.", ".gg...ww...oo..", "..g....w....o.."], palette: { k: "#2a2a30", g: "#2c9a48", w: "#f4f4f4", o: "#f08a1c" } },
  garlandFall: { rows: ["kkkkkkkkkkkkkkk", "rrr.ooo.yyy.rrr", ".r...o...y...r."], palette: { k: "#4a3220", r: "#d2501c", o: "#f08a1c", y: "#e8b030" } },
};

/** Where things go: final tile coordinates in the break room, boss office and screening room, plus the halls. */
type Item = { s?: string; strip?: string; x: number; y: number; w?: number; flip?: boolean; ox?: number; oy?: number; scale?: number; z?: number };

const BREAK = { x: 66, y: 27, w: 21, h: 12 };
const BOSS = { x: 16, y: 2, w: 18, h: 14 };
const SCREEN = { x: 99, y: 27, w: 14, h: 12 };

/** A strip of wall lights / bunting across a room's top wall (inside the doorway-free span). */
const topStrip = (room: { x: number; y: number; w: number }, strip: string, from = 1, to = 1): Item => ({ strip, x: room.x + from, y: room.y, w: room.w - from - to, oy: 11 });

const BREAK_FLOOR: Array<[number, number]> = [[72, 37], [85, 37]];
const BREAK_TABLE: Array<[number, number]> = [[73, 33], [81, 33], [78, 32]];
const BOSS_FLOOR: Array<[number, number]> = [[17, 14], [32, 14]];
const SCREEN_FLOOR: Array<[number, number]> = [[112, 37], [100, 38]];
const HALL_FLOOR: Array<[number, number]> = [[67, 26], [96, 26], [110, 26]];

function itemsFor(decor: string): Item[] {
  const items: Item[] = [];
  const floor = (s: string, spots: Array<[number, number]>, extra: Partial<Item> = {}) => spots.forEach(([x, y], i) => items.push({ s, x, y, flip: i % 2 === 1, ...extra }));
  switch (decor) {
    case "halloween":
      floor("pumpkin", BREAK_FLOOR); floor("pumpkin", BOSS_FLOOR); floor("pumpkin", SCREEN_FLOOR); floor("pumpkin", HALL_FLOOR);
      items.push({ s: "pumpkin", x: 73, y: 33, oy: -4 }, { s: "cobweb", x: 67, y: 27 }, { s: "cobweb", x: 85, y: 27, flip: true }, { s: "cobweb", x: 17, y: 2 }, { s: "cobweb", x: 32, y: 2, flip: true }, { s: "cobweb", x: 100, y: 27 }, { s: "cobweb", x: 112, y: 27, flip: true });
      items.push({ s: "bat", x: 81, y: 27, oy: 2 }, { s: "bat", x: 83, y: 27, oy: 6, flip: true }, { s: "bat", x: 105, y: 27, oy: 3 }, { s: "bat", x: 28, y: 2, oy: 4 });
      break;
    case "thanksgiving":
      floor("leaf", BREAK_FLOOR); floor("leaf", BOSS_FLOOR); floor("pumpkin", SCREEN_FLOOR); floor("leaf", HALL_FLOOR);
      items.push({ s: "turkey", x: 79, y: 32, oy: -4 }, { s: "pumpkin", x: 73, y: 33, oy: -4 }, topStrip(BREAK, "garlandFall", 1, 1), topStrip(SCREEN, "garlandFall", 3, 1), { s: "leaf", x: 111, y: 36 });
      break;
    case "christmas":
      items.push(topStrip(BREAK, "lights"), topStrip(BOSS, "lights"), topStrip(SCREEN, "lights", 1, 1), { strip: "lights", x: 68, y: 23, w: 42, oy: -2 });
      items.push({ s: "tree", x: 85, y: 36, scale: 2.2, oy: -10 }, { s: "tree", x: 17, y: 12, scale: 2.2, oy: -10 }, { s: "tree", x: 111, y: 35, scale: 2.2, oy: -10 });
      items.push({ s: "present", x: 84, y: 37, oy: 2 }, { s: "presentG", x: 86, y: 37, ox: -6, oy: 2 }, { s: "present", x: 18, y: 14, oy: 2 }, { s: "presentG", x: 112, y: 37, oy: 2 });
      break;
    case "newyear":
      items.push(topStrip(BREAK, "buntingParty"), topStrip(BOSS, "buntingParty"), topStrip(SCREEN, "buntingParty", 1, 1));
      items.push({ s: "balloonB", x: 72, y: 36, oy: -6 }, { s: "balloonY", x: 85, y: 35, oy: -6 }, { s: "star", x: 73, y: 33, oy: -4 }, { s: "hat", x: 81, y: 33, oy: -2 }, { s: "balloonR", x: 17, y: 13 }, { s: "balloonB", x: 32, y: 13 }, { s: "firework", x: 105, y: 28 });
      break;
    case "valentines":
      items.push(topStrip(BREAK, "buntingParty", 1, 1));
      floor("heart", BREAK_FLOOR); floor("heartP", BOSS_FLOOR); floor("heart", SCREEN_FLOOR); floor("heartP", HALL_FLOOR);
      items.push({ s: "heart", x: 73, y: 33, oy: -4 }, { s: "heartP", x: 81, y: 33, oy: -4 }, { s: "heart", x: 84, y: 27 }, { s: "heartP", x: 30, y: 2 }, { s: "heart", x: 104, y: 27 });
      break;
    case "stpatricks":
      items.push(topStrip(BREAK, "buntingGreen"), topStrip(SCREEN, "buntingGreen", 1, 1));
      floor("shamrock", BREAK_FLOOR); floor("shamrock", BOSS_FLOOR); floor("shamrock", SCREEN_FLOOR); floor("shamrock", HALL_FLOOR);
      items.push({ s: "shamrock", x: 73, y: 33, oy: -4 }, { s: "shamrock", x: 81, y: 33, oy: -4 }, { s: "shamrock", x: 84, y: 27 }, { s: "shamrock", x: 30, y: 2 });
      break;
    case "easter":
      items.push(topStrip(BREAK, "buntingSpring"), topStrip(SCREEN, "buntingSpring", 1, 1));
      floor("egg", BREAK_FLOOR, { scale: 2 }); floor("eggB", BOSS_FLOOR, { scale: 2 }); floor("egg", SCREEN_FLOOR, { scale: 2 }); floor("eggB", HALL_FLOOR, { scale: 2 });
      items.push({ s: "egg", x: 73, y: 33, oy: -4 }, { s: "eggB", x: 81, y: 33, oy: -4 }, { s: "eggB", x: 79, y: 33, oy: -2, ox: 3 });
      break;
    case "fourth":
      items.push(topStrip(BREAK, "buntingUsa"), topStrip(BOSS, "buntingUsa"), topStrip(SCREEN, "buntingUsa", 1, 1), { strip: "buntingUsa", x: 68, y: 23, w: 42, oy: -2 });
      items.push({ s: "star", x: 72, y: 37 }, { s: "star", x: 85, y: 37 }, { s: "firework", x: 105, y: 28 }, { s: "firework", x: 83, y: 27 }, { s: "star", x: 73, y: 33, oy: -4 });
      break;
    case "patriots":
      items.push(topStrip(BREAK, "buntingBoston"), topStrip(SCREEN, "buntingBoston", 1, 1), { strip: "buntingBoston", x: 68, y: 23, w: 42, oy: -2 });
      items.push({ s: "star", x: 72, y: 37 }, { s: "star", x: 85, y: 37 }, { s: "star", x: 73, y: 33, oy: -4 });
      break;
    default:
      break;
  }
  return items;
}

const SCALE = 2; // sprite pixel -> board px (a 16px tile is an 8-pixel sprite)

function styleFor(item: Item): CSSProperties {
  const left = item.x * GEN2_TILE + (item.ox ?? 0);
  const top = item.y * GEN2_TILE + (item.oy ?? 0);
  if (item.strip) {
    const def = STRIPS[item.strip];
    return { left, top, width: (item.w ?? 1) * GEN2_TILE, height: def.rows.length * 2, backgroundImage: pixelSprite(`strip:${item.strip}`, def.rows, def.palette), backgroundSize: `${def.rows[0].length * 2}px ${def.rows.length * 2}px`, backgroundRepeat: "repeat-x" };
  }
  const def = SPRITES[item.s as string];
  const scale = item.scale ?? SCALE;
  return { left, top, width: def.rows[0].length * scale, height: def.rows.length * scale, backgroundImage: pixelSprite(`sprite:${item.s}`, def.rows, def.palette), transform: item.flip ? "scaleX(-1)" : undefined };
}

export function HolidayDecor({ decor }: { decor: string | null }) {
  const items = useMemo(() => (decor ? itemsFor(decor).filter((item) => (item.strip ? STRIPS[item.strip] : SPRITES[item.s as string])) : []), [decor]);
  if (!items.length) return null;
  return (
    <div className={`life-decor life-decor-${decor}`} aria-hidden="true">
      {items.map((item, index) => <i key={index} className={`life-prop ${item.strip ? "life-strip" : ""}`} style={styleFor(item)} />)}
    </div>
  );
}

export type BirthdayDecorProps = { stations: Array<{ id: string; x: number; y: number }>; cake: { x: number; y: number } | null };

/** Balloons by each birthday worker's station and a cake with candles in the break room. */
export function BirthdayDecor({ stations, cake }: BirthdayDecorProps) {
  if (!stations.length && !cake) return null;
  const balloons = ["balloonR", "balloonB", "balloonY"];
  return (
    <div className="life-decor life-decor-birthday" aria-hidden="true">
      {stations.flatMap((station) => balloons.map((name, i) => <i key={`${station.id}-${i}`} className="life-prop life-balloon" style={{ ...styleFor({ s: name, x: station.x, y: station.y, ox: -4 + i * 8, oy: -22 - (i === 1 ? 4 : 0) }), animationDelay: `${-i * 0.7}s` }} />))}
      {cake ? <i className="life-prop life-cake" style={styleFor({ s: "cake", x: cake.x, y: cake.y, oy: -5, ox: 4, scale: 1.5 })} /> : null}
    </div>
  );
}

export function AmbienceOverlay({ date }: { date: Date }) {
  const tint = tintFor(date);
  if (tint.a < 0.015) return null;
  return <div className="life-ambient" aria-hidden="true" style={{ background: `rgba(${tint.r}, ${tint.g}, ${tint.b}, ${tint.a.toFixed(3)})` }} />;
}

/** Windows are lit from a little before sunset until a little after sunrise. */
export function isNight(date: Date) {
  const hour = date.getHours() + date.getMinutes() / 60;
  const { sunrise, sunset } = sunTimes(date);
  return hour < sunrise + 0.2 || hour > sunset - 0.1;
}
