import { FLOOR } from "./walkWorld";

/** Procedural pixel textures in the dashboard's Game Boy Color-like palette. Pixels are packed ABGR in a Uint32Array. */
export type Tex = { w: number; h: number; d: Uint32Array };

/** Alpha value that marks a self-lit (emissive) texel: it ignores room lighting and only fades with distance. */
export const EMIT_ALPHA = 253;
export const TEX = 64;

export function packHex(hex: string, alpha = 255) {
  const n = parseInt(hex.slice(1), 16);
  return (((alpha << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0);
}

function mix(c: number, f: number) {
  const r = Math.max(0, Math.min(255, Math.round((c & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((c >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round(((c >> 16) & 255) * f)));
  return ((c & 0xff000000) | (b << 16) | (g << 8) | r) >>> 0;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

class Painter {
  readonly d: Uint32Array;
  constructor(readonly w: number, readonly h: number, fill = 0) {
    this.d = new Uint32Array(w * h);
    if (fill) this.d.fill(fill);
  }
  px(x: number, y: number, c: number) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) this.px(xx, yy, c);
  }
  frame(x: number, y: number, w: number, h: number, c: number) {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
  }
  noise(seed: number, amount: number) {
    const rand = rng(seed);
    for (let i = 0; i < this.d.length; i += 1) {
      if ((this.d[i] >>> 24) !== 255) continue;
      this.d[i] = mix(this.d[i], 1 + (rand() - 0.5) * amount);
    }
  }
  tex(): Tex {
    return { w: this.w, h: this.h, d: this.d };
  }
}

const C = {
  ink: packHex("#11151d"), cream: packHex("#f6eed8"), slate: packHex("#6f7f86"), dark: packHex("#393c3b"), steel: packHex("#9fb0b1"), mist: packHex("#d8e8df"),
  yellow: packHex("#f2cf3f"), blue: packHex("#8ec7d7"), green: packHex("#48b060"), red: packHex("#d9483d"), wood: packHex("#b9874a"), woodDark: packHex("#80592f"),
  white: packHex("#f4efe2"), glow: packHex("#7ff0d0", EMIT_ALPHA), screen: packHex("#43bd89", EMIT_ALPHA), led: packHex("#ff5a4a", EMIT_ALPHA), ledG: packHex("#5aff9a", EMIT_ALPHA),
};

// ---------------------------------------------------------------- walls

type WallStyle = { style: "tile" | "wood" | "concrete" | "panel" | "plaster" | "corrugated"; base: string; grout: string; accent: string; hazard?: boolean };

const WALL_STYLES: Record<string, WallStyle> = {
  boss: { style: "wood", base: "#8a5a2b", grout: "#5a3a1c", accent: "#d8b070" },
  clone: { style: "tile", base: "#dfeedd", grout: "#9fbfa6", accent: "#48b060" },
  mother: { style: "tile", base: "#dfeedd", grout: "#9fbfa6", accent: "#2a8f55" },
  grow: { style: "tile", base: "#e2efdc", grout: "#a3c4a0", accent: "#83c45d" },
  vm: { style: "concrete", base: "#8c969a", grout: "#5c666a", accent: "#3d9fbf" },
  potting: { style: "tile", base: "#efe2c4", grout: "#c9b88f", accent: "#b9874a" },
  manager: { style: "plaster", base: "#efe2c4", grout: "#c9b88f", accent: "#6f7f86" },
  processing: { style: "tile", base: "#eef0ea", grout: "#aebdb4", accent: "#d9483d" },
  packaging: { style: "tile", base: "#eef0ea", grout: "#aebdb4", accent: "#f2cf3f", hazard: true },
  extraction: { style: "concrete", base: "#b8b48a", grout: "#8d8a68", accent: "#f2cf3f", hazard: true },
  security: { style: "panel", base: "#2b3445", grout: "#11151d", accent: "#8ec7d7" },
  break: { style: "tile", base: "#a6d8e6", grout: "#5797a7", accent: "#f6eed8" },
  bathroom: { style: "tile", base: "#cfeef3", grout: "#8ec7d7", accent: "#84c4d8" },
  screening: { style: "plaster", base: "#f1e6c8", grout: "#c9b88f", accent: "#d9483d" },
  warehouse: { style: "corrugated", base: "#7e8a8e", grout: "#566064", accent: "#f2cf3f", hazard: true },
  sales: { style: "plaster", base: "#f4e4c1", grout: "#c9b88f", accent: "#3f6fb5" },
  research: { style: "tile", base: "#eef4f2", grout: "#aebdb4", accent: "#8ec7d7" },
  maintenance: { style: "concrete", base: "#8c8f86", grout: "#5a5d56", accent: "#f2cf3f", hazard: true },
  ext: { style: "plaster", base: "#e6ece2", grout: "#aebdb4", accent: "#6f7f86" },
};

function hazardBand(p: Painter, y: number, h: number) {
  for (let yy = y; yy < y + h; yy += 1) for (let xx = 0; xx < p.w; xx += 1) p.px(xx, yy, ((xx + yy) >> 2) % 2 === 0 ? C.yellow : C.ink);
}

function paintWall(kind: string): Tex {
  const style = WALL_STYLES[kind] ?? WALL_STYLES.ext;
  const base = packHex(style.base);
  const grout = packHex(style.grout);
  const accent = packHex(style.accent);
  const p = new Painter(TEX, TEX, base);
  const seed = hashString(kind);
  if (style.style === "tile") {
    for (let i = 0; i < TEX; i += 1) {
      for (let k = 0; k < TEX; k += 16) {
        p.px(i, k, grout);
        p.px(k, i, grout);
      }
    }
    for (let ty = 0; ty < TEX; ty += 16) for (let tx = 0; tx < TEX; tx += 16) p.rect(tx + 1, ty + 1, 4, 1, mix(base, 1.12));
  } else if (style.style === "wood") {
    for (let x = 0; x < TEX; x += 8) {
      p.rect(x, 0, 1, TEX, grout);
      p.rect(x + 1, 0, 1, TEX, mix(base, 1.14));
      for (let y = (x * 5) % 24; y < TEX; y += 24) p.rect(x + 2, y, 5, 1, mix(base, 0.85));
    }
  } else if (style.style === "concrete") {
    p.noise(seed, 0.16);
    for (let x = 0; x < TEX; x += 32) p.rect(x, 0, 1, TEX, grout);
    for (let y = 0; y < TEX; y += 32) p.rect(0, y, TEX, 1, grout);
    for (let x = 6; x < TEX; x += 32) for (let y = 6; y < 26; y += 4) p.rect(x, y, 14, 2, mix(base, 0.78));
  } else if (style.style === "panel") {
    for (let x = 0; x < TEX; x += 32) p.rect(x, 0, 1, TEX, grout);
    for (let y = 0; y < TEX; y += 32) p.rect(0, y, TEX, 1, grout);
    for (let x = 4; x < TEX; x += 32) for (let y = 4; y < TEX; y += 32) {
      p.frame(x, y, 24, 24, mix(base, 1.35));
      p.px(x + 20, y + 3, ((x + y) / 4) % 3 < 1 ? C.led : C.ledG);
    }
  } else if (style.style === "plaster") {
    p.noise(seed, 0.07);
    for (let y = 0; y < 34; y += 33) p.rect(0, y, TEX, 1, mix(base, 0.92));
  } else {
    for (let x = 0; x < TEX; x += 4) {
      p.rect(x, 0, 2, TEX, mix(base, 1.12));
      p.rect(x + 2, 0, 2, TEX, mix(base, 0.84));
    }
    p.noise(seed, 0.06);
  }
  // Dado band and baseboard.
  if (style.hazard) hazardBand(p, 44, 6);
  else p.rect(0, 45, TEX, 4, accent);
  p.rect(0, 49, TEX, 1, mix(accent, 0.7));
  p.rect(0, 57, TEX, 7, packHex("#6f7f86"));
  p.rect(0, 57, TEX, 1, packHex("#9fb0b1"));
  p.rect(0, 63, TEX, 1, C.ink);
  p.rect(0, 0, TEX, 1, mix(base, 0.82));
  return p.tex();
}

// ---------------------------------------------------------------- text

const GLYPHS: Record<string, string> = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111", F: "111100110100100", G: "011100101101011",
  H: "101101111101101", I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111", M: "101111111101101", N: "110101101101101",
  O: "010101101101010", P: "110101110100100", Q: "010101101111011", R: "110101110101101", S: "011100010001110", T: "111010010010010", U: "101101101101111",
  V: "101101101101010", W: "101101111111101", X: "101101010101101", Y: "101101010010010", Z: "111001010100111",
  0: "111101101101111", 1: "010110010010111", 2: "110001010100111", 3: "110001010001110", 4: "101101111001001", 5: "111100110001110", 6: "011100111101111",
  7: "111001010010010", 8: "111101111101111", 9: "111101111001110", "&": "010101010101011", "/": "001001010100100", "-": "000000111000000",
  ":": "000010000010000", ".": "000000000000010", ",": "000000000010100", "%": "101001010100101", "#": "101111101111101", "!": "010010010000010",
  "?": "110001010000010", "+": "000010111010000", "(": "001010010010001", ")": "100010010010100", "=": "000111000111000", "_": "000000000000111",
  "'": "010010000000000", "*": "101010111010101", "<": "001010100010001", ">": "100010001010100",
};

function drawText(p: Painter, text: string, x: number, y: number, color: number, scale = 2) {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const glyph = GLYPHS[ch];
    if (glyph) {
      for (let i = 0; i < 15; i += 1) if (glyph[i] === "1") p.rect(cx + (i % 3) * scale, y + Math.floor(i / 3) * scale, scale, scale, color);
    }
    cx += 4 * scale;
  }
}

function textWidth(text: string, scale = 2) {
  return text.length * 4 * scale - scale;
}

// ---------------------------------------------------------------- wall decor (signs, posters, windows ...)

const decorCache = new Map<string, Tex>();

/** One slice (idx of w) of a wall decoration, as a 64x64 texture placed over the room's wall texture. */
export type DecorExtra = { lines?: string[]; clock?: { hours: number; minutes: number; text: string } };

export function decorTexture(kind: string, variant: string | undefined, label: string | undefined, w: number, idx: number, wallKind: string, extra?: DecorExtra): Tex {
  const key = `${kind}|${variant ?? ""}|${label ?? ""}|${w}|${idx}|${wallKind}|${extra?.lines?.join("~") ?? ""}|${extra?.clock?.text ?? ""}`;
  const hit = decorCache.get(key);
  if (hit) return hit;
  if (decorCache.size > 500) decorCache.clear();
  const full = new Painter(TEX * w, TEX);
  const wall = paintWall(wallKind);
  // start from a repeat of the wall so the decoration sits on it
  for (let y = 0; y < TEX; y += 1) for (let x = 0; x < TEX * w; x += 1) full.d[y * full.w + x] = wall.d[y * TEX + (x % TEX)];
  const W2 = TEX * w;
  if (kind === "wallSign") {
    const lines = extra?.lines?.length ? extra.lines : [label ?? "ROOM"];
    const text = lines[0].slice(0, Math.floor((W2 - 8) / 8));
    const sub = lines.slice(1, 3);
    const boxH = sub.length ? 36 : 20;
    full.rect(4, 6, W2 - 8, boxH, C.ink);
    full.frame(4, 6, W2 - 8, boxH, C.steel);
    drawText(full, text, Math.round((W2 - textWidth(text)) / 2), 10, packHex("#8fe9ff", EMIT_ALPHA));
    sub.forEach((line, row) => {
      const clipped = line.slice(0, Math.floor((W2 - 12) / 4));
      drawText(full, clipped, Math.round((W2 - textWidth(clipped, 1)) / 2), 24 + row * 8, packHex(row ? "#9fe0a0" : "#f2cf3f", EMIT_ALPHA), 1);
    });
  } else if (kind === "windowPane") {
    full.rect(6, 10, W2 - 12, 30, packHex("#4a6f8a"));
    full.rect(7, 11, W2 - 14, 28, packHex("#a9d6ee", EMIT_ALPHA));
    for (let x = 8; x < W2 - 8; x += 3) full.rect(x, 11, 1, 28, packHex("#d9f0fb", EMIT_ALPHA));
    full.rect(6, 24, W2 - 12, 2, C.cream);
    full.frame(6, 10, W2 - 12, 30, C.cream);
    full.rect(0, 40, W2, 2, C.cream);
  } else if (kind === "clock") {
    // analog face (hands show the real time) with a digital 12-hour readout underneath
    const cx = 32;
    const cy = 20;
    const R = 14;
    for (let y = -R; y <= R; y += 1) for (let x = -R; x <= R; x += 1) {
      const d = Math.hypot(x, y);
      if (d <= R) full.px(cx + x, cy + y, d > R - 1.5 ? C.ink : C.cream);
    }
    for (let k = 0; k < 12; k += 1) {
      const a = (k / 12) * Math.PI * 2;
      full.px(Math.round(cx + Math.sin(a) * (R - 3)), Math.round(cy - Math.cos(a) * (R - 3)), C.ink);
    }
    const hand = (angle: number, len: number, color: number) => {
      for (let step = 0; step <= len; step += 0.5) full.px(Math.round(cx + Math.sin(angle) * step), Math.round(cy - Math.cos(angle) * step), color);
    };
    const time = extra?.clock ?? { hours: 12, minutes: 0, text: "12:00 PM" };
    hand((((time.hours % 12) + time.minutes / 60) / 12) * Math.PI * 2, 7, C.ink);
    hand((time.minutes / 60) * Math.PI * 2, 11, C.red);
    full.rect(cx - 1, cy - 1, 2, 2, C.ink);
    full.rect(4, 38, W2 - 8, 11, C.ink);
    full.frame(4, 38, W2 - 8, 11, C.steel);
    drawText(full, time.text, Math.round((W2 - textWidth(time.text, 1)) / 2), 41, packHex("#7ff0d0", EMIT_ALPHA), 1);
  } else if (kind === "poster") {
    const col = variant === "leaf" ? packHex("#48b060") : variant === "warn" ? C.yellow : variant === "mirror" ? packHex("#b6e4f0", EMIT_ALPHA) : packHex("#f6eed8");
    full.rect(14, 8, W2 - 28, 36, C.ink);
    full.rect(16, 10, W2 - 32, 32, col);
    if (variant === "chart") for (let i = 0; i < 5; i += 1) full.rect(20 + i * 6, 38 - i * 5 - 2, 4, i * 5 + 2, i % 2 ? C.blue : C.red);
    else if (variant === "leaf") for (let i = 0; i < 8; i += 1) full.rect(30 + (i % 2) * 2, 36 - i * 3, 5 - (i % 3), 2, packHex("#1f6a3b"));
    else if (variant === "warn") {
      for (let i = 0; i < 10; i += 1) full.rect(32 - i, 12 + i * 2, 1 + i * 2, 2, C.ink);
      full.rect(31, 24, 2, 8, C.yellow);
    }
    const caption = variant === "chart" ? "OUTPUT" : variant === "leaf" ? "GROW" : variant === "warn" ? "SAFETY" : "";
    if (caption && W2 >= 64) drawText(full, caption.slice(0, Math.floor((W2 - 32) / 4)), Math.round((W2 - textWidth(caption, 1)) / 2), 10, C.ink, 1);
  } else if (kind === "vent") {
    full.rect(8, 14, W2 - 16, 18, packHex("#566064"));
    for (let y = 16; y < 30; y += 3) full.rect(10, y, W2 - 20, 1, C.ink);
    full.frame(8, 14, W2 - 16, 18, C.steel);
  } else if (kind === "bulletin") {
    full.rect(4, 4, W2 - 8, 44, packHex("#b9874a"));
    full.frame(4, 4, W2 - 8, 44, C.woodDark);
    const lines = extra?.lines?.length ? extra.lines : ["NOTICES"];
    full.rect(8, 8, W2 - 16, 36, C.cream);
    lines.slice(0, 4).forEach((line, row) => {
      const clipped = line.slice(0, Math.floor((W2 - 20) / 4));
      drawText(full, clipped, 11, 11 + row * 8, row === 0 ? C.red : C.ink, 1);
    });
    full.rect(W2 / 2 - 1, 5, 3, 3, C.red);
  } else if (kind === "wallLight") {
    full.rect(26, 10, 12, 8, packHex("#fff6c8", EMIT_ALPHA));
    full.frame(25, 9, 14, 10, C.slate);
    for (let y = 19; y < 30; y += 1) full.rect(24 + (y - 19) / 2, y, 16 - (y - 19), 1, packHex("#fff6c8", 160));
  } else if (kind === "extCabinet") {
    full.rect(22, 18, 20, 26, C.red);
    full.frame(22, 18, 20, 26, C.ink);
    full.rect(26, 24, 12, 14, packHex("#f6a79e"));
    full.rect(30, 20, 4, 3, C.cream);
  }
  const out = new Painter(TEX, TEX);
  for (let y = 0; y < TEX; y += 1) for (let x = 0; x < TEX; x += 1) out.d[y * TEX + x] = full.d[y * full.w + idx * TEX + x];
  const tex = out.tex();
  decorCache.set(key, tex);
  return tex;
}

// ---------------------------------------------------------------- prop front faces

function metal(p: Painter, base: string) {
  const c = packHex(base);
  p.rect(0, 0, TEX, TEX, c);
  p.rect(0, 0, TEX, 2, mix(c, 1.25));
  p.rect(0, TEX - 3, TEX, 3, mix(c, 0.7));
  p.rect(0, 0, 1, TEX, mix(c, 0.85));
  p.rect(TEX - 1, 0, 1, TEX, mix(c, 0.75));
}

function paintProp(kind: string): Tex {
  const p = new Painter(TEX, TEX, C.slate);
  const seed = hashString(kind);
  const rand = rng(seed);
  switch (kind) {
    case "shelf": {
      p.rect(0, 0, TEX, TEX, packHex("#7a5230"));
      p.rect(0, 0, TEX, 2, packHex("#a97a4a"));
      for (let row = 0; row < 4; row += 1) {
        const y = 4 + row * 15;
        p.rect(2, y + 11, TEX - 4, 3, packHex("#a97a4a"));
        p.rect(2, y, TEX - 4, 11, packHex("#3a2616"));
        for (let x = 3; x < TEX - 6; x += 5 + Math.floor(rand() * 3)) {
          const h = 6 + Math.floor(rand() * 5);
          p.rect(x, y + 11 - h, 4, h, [C.red, C.blue, C.yellow, C.green, C.cream, packHex("#a04a8a")][Math.floor(rand() * 6)]);
        }
      }
      break;
    }
    case "rack": {
      p.rect(0, 0, TEX, TEX, packHex("#2a2f36"));
      p.frame(0, 0, TEX, TEX, packHex("#4b5155"));
      for (let y = 3; y < TEX - 4; y += 7) {
        p.rect(3, y, TEX - 6, 5, packHex("#3d4651"));
        p.rect(5, y + 1, 18, 3, packHex("#1a1f26"));
        for (let x = 28; x < TEX - 8; x += 4) p.px(x, y + 2, rand() > 0.35 ? C.ledG : C.led);
      }
      break;
    }
    case "machine": {
      metal(p, "#8a979a");
      p.rect(6, 8, 30, 24, C.ink);
      p.rect(8, 10, 26, 20, packHex("#9fd0c0", EMIT_ALPHA));
      p.rect(8, 22, 26, 8, packHex("#5aa89a", EMIT_ALPHA));
      p.rect(42, 10, 14, 4, C.red);
      p.rect(42, 18, 14, 4, C.yellow);
      p.rect(42, 26, 14, 4, C.green);
      p.rect(6, 40, 52, 3, packHex("#566064"));
      for (let x = 8; x < 56; x += 6) p.rect(x, 46, 3, 8, packHex("#566064"));
      break;
    }
    case "vat": {
      metal(p, "#a9b8bb");
      for (let x = 8; x < TEX; x += 14) p.rect(x, 0, 2, TEX, packHex("#d8e8df"));
      p.rect(0, 14, TEX, 3, packHex("#566064"));
      p.rect(0, 46, TEX, 3, packHex("#566064"));
      p.rect(24, 22, 16, 18, C.ink);
      p.rect(26, 24, 12, 14, packHex("#6fd0e8", EMIT_ALPHA));
      break;
    }
    case "tank": {
      metal(p, "#3d8f5a");
      p.rect(0, 20, TEX, 3, packHex("#cfe8d6"));
      p.rect(20, 28, 24, 14, C.cream);
      drawText(p, "CO2", 22, 32, C.ink, 2);
      break;
    }
    case "fridge": {
      metal(p, "#e4ece8");
      p.rect(0, 26, TEX, 2, packHex("#9fb0b1"));
      p.rect(52, 8, 3, 14, packHex("#6f7f86"));
      p.rect(52, 34, 3, 16, packHex("#6f7f86"));
      drawText(p, "FOOD", 8, 8, packHex("#3d8f5a"), 2);
      drawText(p, "COLD", 8, 34, packHex("#3f6fb5"), 2);
      break;
    }
    case "cabinet": {
      metal(p, "#8f9ba0");
      for (let y = 6; y < 58; y += 13) {
        p.frame(6, y, 52, 11, packHex("#6f7f86"));
        p.rect(26, y + 4, 12, 3, C.ink);
      }
      break;
    }
    case "vending": {
      p.rect(0, 0, TEX, TEX, packHex("#c8403a"));
      p.rect(6, 6, 38, 46, C.ink);
      for (let y = 8; y < 50; y += 11) for (let x = 8; x < 42; x += 9) p.rect(x, y, 7, 8, [C.yellow, C.blue, C.green, C.cream][Math.floor(rand() * 4)] | 0);
      p.rect(8, 8, 34, 42, packHex("#ffffff", 60));
      p.rect(48, 10, 10, 6, packHex("#fff6c8", EMIT_ALPHA));
      p.rect(48, 22, 10, 4, C.dark);
      p.rect(8, 54, 36, 6, C.dark);
      drawText(p, "SNACK", 22, 0, C.cream, 1);
      break;
    }
    case "stall": {
      p.rect(0, 0, TEX, TEX, packHex("#9fb0b1"));
      p.rect(6, 0, 52, 52, packHex("#8ec7d7"));
      p.frame(6, 0, 52, 52, packHex("#566064"));
      p.rect(46, 24, 4, 3, C.red);
      p.rect(0, 56, TEX, 8, C.ink);
      break;
    }
    case "hood": {
      metal(p, "#aebdb4");
      p.rect(4, 8, 56, 26, C.ink);
      p.rect(6, 10, 52, 22, packHex("#b6e4f0", EMIT_ALPHA));
      for (let x = 8; x < 56; x += 5) p.rect(x, 44, 3, 14, packHex("#6f7f86"));
      drawText(p, "FUME", 16, 36, C.ink, 1);
      break;
    }
    case "condenser": {
      metal(p, "#c4d0d2");
      for (let x = 10; x < 56; x += 11) {
        p.rect(x, 4, 5, 56, packHex("#8ec7d7", EMIT_ALPHA));
        p.rect(x + 1, 6, 1, 52, packHex("#e6f6fb", EMIT_ALPHA));
      }
      break;
    }
    case "dryRack": {
      p.rect(0, 0, TEX, TEX, packHex("#5a3d22"));
      for (let y = 4; y < 60; y += 14) p.rect(0, y, TEX, 3, packHex("#a97a4a"));
      for (let x = 6; x < 60; x += 11) for (let y = 8; y < 56; y += 14) {
        p.rect(x, y, 5, 9, packHex(rand() > 0.4 ? "#4f7a3a" : "#6d8f46"));
        p.rect(x + 1, y + 2, 2, 3, packHex("#d8c066"));
      }
      break;
    }
    case "display": {
      p.rect(0, 0, TEX, TEX, packHex("#566064"));
      p.rect(4, 6, 56, 40, packHex("#cfe8ee", EMIT_ALPHA));
      p.rect(8, 28, 12, 14, C.green);
      p.rect(26, 22, 12, 20, C.yellow);
      p.rect(44, 30, 12, 12, C.red);
      p.frame(4, 6, 56, 40, C.steel);
      break;
    }
    case "fan": {
      metal(p, "#6f7f86");
      p.rect(8, 8, 48, 48, C.ink);
      for (let i = 0; i < 20; i += 1) p.rect(32 + Math.round(Math.cos(i) * (4 + i)), 32 + Math.round(Math.sin(i) * (4 + i)), 2, 2, packHex("#9fb0b1"));
      break;
    }
    case "humidifier": {
      metal(p, "#e4ece8");
      p.rect(14, 12, 36, 14, packHex("#9fd8e8", EMIT_ALPHA));
      p.rect(48, 36, 6, 6, C.ledG);
      break;
    }
    case "waterStation": {
      metal(p, "#e4ece8");
      p.rect(14, 4, 36, 26, packHex("#8ec7d7", EMIT_ALPHA));
      p.rect(24, 40, 16, 4, C.ink);
      drawText(p, "H2O", 14, 48, C.ink, 2);
      break;
    }
    case "desk":
    case "table":
    case "trimTable": {
      const base = kind === "trimTable" ? "#aab6b8" : kind === "desk" ? "#a9784a" : "#b98a55";
      metal(p, base);
      p.rect(0, 0, TEX, 8, mix(packHex(base), 1.18));
      if (kind === "desk") {
        p.frame(6, 14, 24, 16, packHex("#6d4a2a"));
        p.rect(14, 20, 8, 3, C.yellow);
        p.frame(34, 14, 24, 16, packHex("#6d4a2a"));
        p.rect(42, 20, 8, 3, C.yellow);
      } else {
        p.rect(4, 14, 4, 50, mix(packHex(base), 0.7));
        p.rect(TEX - 8, 14, 4, 50, mix(packHex(base), 0.7));
      }
      break;
    }
    case "bench": {
      metal(p, "#5f7f6c");
      p.rect(0, 0, TEX, 10, packHex("#8fb09c"));
      p.rect(4, 22, 5, 42, C.dark);
      p.rect(TEX - 9, 22, 5, 42, C.dark);
      break;
    }
    case "chair": {
      p.rect(0, 0, TEX, TEX, packHex("#3d4a5c"));
      p.rect(8, 4, 48, 30, packHex("#4f6178"));
      p.rect(12, 44, 6, 20, C.ink);
      p.rect(46, 44, 6, 20, C.ink);
      break;
    }
    case "crate": {
      p.rect(0, 0, TEX, TEX, packHex("#a87d42"));
      for (let y = 0; y < TEX; y += 16) p.rect(0, y, TEX, 2, packHex("#6d4a2a"));
      p.rect(0, 0, 4, TEX, packHex("#6d4a2a"));
      p.rect(TEX - 4, 0, 4, TEX, packHex("#6d4a2a"));
      for (let i = 0; i < TEX; i += 2) p.px(i, i, packHex("#6d4a2a"));
      break;
    }
    case "box": {
      p.rect(0, 0, TEX, TEX, packHex("#c8a468"));
      p.rect(0, 0, TEX, 10, packHex("#d8b878"));
      p.rect(28, 0, 8, TEX, packHex("#b08a4c"));
      p.rect(12, 30, 18, 12, C.cream);
      break;
    }
    case "barrel": {
      p.rect(0, 0, TEX, TEX, packHex("#3f6fb5"));
      for (let y = 8; y < TEX; y += 20) p.rect(0, y, TEX, 4, packHex("#2a4a80"));
      p.rect(0, 0, 6, TEX, packHex("#5b8fd5"));
      break;
    }
    case "sack": {
      p.rect(0, 0, TEX, TEX, packHex("#d8c79a"));
      p.noise(seed, 0.18);
      p.rect(8, 24, 48, 14, packHex("#c0a870"));
      break;
    }
    case "soil":
    case "pottingMix": {
      p.rect(0, 0, TEX, TEX, packHex("#4a3322"));
      p.noise(seed, 0.4);
      break;
    }
    case "toilet":
    case "urinal":
    case "bath": {
      metal(p, "#f0f0e8");
      p.rect(20, 14, 24, 24, packHex("#d8e0e0"));
      p.rect(28, 40, 8, 10, packHex("#cfd8d8"));
      break;
    }
    case "sink": {
      metal(p, "#d8e8ec");
      p.rect(8, 8, 48, 16, packHex("#aec8d0"));
      p.rect(28, 2, 8, 8, packHex("#6f7f86"));
      break;
    }
    case "bin": {
      p.rect(0, 0, TEX, TEX, packHex("#5c666a"));
      for (let x = 8; x < TEX; x += 12) p.rect(x, 6, 3, TEX - 12, packHex("#43494c"));
      break;
    }
    case "microwave": {
      metal(p, "#cfd6d8");
      p.rect(6, 8, 38, 30, C.ink);
      p.rect(8, 10, 34, 26, packHex("#ffe9a0", EMIT_ALPHA));
      p.rect(48, 12, 10, 18, C.dark);
      p.px(52, 16, C.ledG);
      break;
    }
    case "coffee": {
      metal(p, "#2a2f36");
      p.rect(14, 8, 36, 22, C.dark);
      p.rect(26, 30, 12, 10, C.cream);
      drawText(p, "JAVA", 20, 46, C.cream, 2);
      p.px(46, 14, C.led);
      break;
    }
    case "food": {
      p.rect(0, 0, TEX, TEX, packHex("#d9483d"));
      p.rect(20, 10, 24, 20, C.yellow);
      break;
    }
    case "conveyor": {
      p.rect(0, 0, TEX, TEX, packHex("#3a4046"));
      for (let x = 0; x < TEX; x += 8) p.rect(x, 18, 2, 24, packHex("#8b9496"));
      p.rect(0, 52, TEX, 4, packHex("#f2cf3f"));
      break;
    }
    case "experiment":
    case "glassware": {
      p.rect(0, 0, TEX, TEX, packHex("#566064"));
      for (let x = 8; x < 56; x += 16) {
        p.rect(x, 12, 10, 36, packHex("#d8f2ee", EMIT_ALPHA));
        p.rect(x + 1, 28, 8, 20, packHex(["#6fe08a", "#e8d070", "#e87a9a"][(x / 16) | 0], EMIT_ALPHA));
      }
      break;
    }
    case "microscope":
    case "scale":
    case "printer":
    case "centrifuge": {
      metal(p, kind === "printer" ? "#d8e8df" : "#9fb0b1");
      p.rect(16, 12, 32, 24, packHex("#2a2f36"));
      p.rect(20, 16, 24, 16, packHex("#8fe9ff", EMIT_ALPHA));
      break;
    }
    case "terminal": {
      p.rect(0, 0, TEX, TEX, packHex("#2a2f36"));
      p.rect(6, 6, 52, 34, C.ink);
      p.rect(9, 9, 46, 28, packHex("#103a2c"));
      for (let y = 12; y < 34; y += 5) p.rect(12, y, 8 + Math.floor(rand() * 26), 2, C.screen);
      p.rect(8, 46, 48, 10, packHex("#4b5155"));
      p.rect(10, 48, 44, 2, packHex("#8b9496"));
      break;
    }
    case "sofa": {
      p.rect(0, 0, TEX, TEX, packHex("#a04a3a"));
      p.rect(0, 0, TEX, 18, packHex("#b85a48"));
      p.rect(31, 18, 2, 46, packHex("#7a3428"));
      break;
    }
    case "stanchion": {
      p.rect(0, 0, TEX, TEX, packHex("#566064"));
      p.rect(28, 0, 8, TEX, C.yellow);
      break;
    }
    case "extinguisher": {
      p.rect(0, 0, TEX, TEX, C.red);
      p.rect(26, 6, 12, 14, C.ink);
      break;
    }
    default: {
      metal(p, "#8a9d99");
    }
  }
  p.rect(0, TEX - 1, TEX, 1, C.ink);
  return p.tex();
}

// ---------------------------------------------------------------- cache

const texCache = new Map<string, Tex>();

/** Wall / prop texture by world key ("wall:grow", "prop:shelf"). */
export function getTexture(key: string): Tex {
  let tex = texCache.get(key);
  if (!tex) {
    tex = key.startsWith("wall:") ? paintWall(key.slice(5)) : paintProp(key.slice(5));
    texCache.set(key, tex);
  }
  return tex;
}

let doorTex: Tex | undefined;
/** Door-frame lintel: steel header with a status light. */
export function getDoorTexture() {
  if (!doorTex) {
    const p = new Painter(TEX, TEX, packHex("#7a868a"));
    p.rect(0, 0, TEX, 2, packHex("#c8d4d6"));
    p.rect(0, 10, TEX, 2, packHex("#434b4f"));
    for (let x = 4; x < TEX; x += 8) p.rect(x, 4, 2, 4, packHex("#566064"));
    p.rect(28, 3, 8, 5, packHex("#7ff0d0", EMIT_ALPHA));
    p.rect(0, 14, TEX, 50, packHex("#566064"));
    doorTex = p.tex();
  }
  return doorTex;
}

// ---------------------------------------------------------------- floor and ceiling

const floorCache = new Map<number, Tex>();

export function getFloorTexture(id: number): Tex {
  let tex = floorCache.get(id);
  if (!tex) {
    tex = paintFloor(id);
    floorCache.set(id, tex);
  }
  return tex;
}

function paintFloor(id: number): Tex {
  const p = new Painter(TEX, TEX);
  const rand = rng(id * 977 + 3);
  const tile = (base: string, grout: string, size: number, glint?: string) => {
    p.rect(0, 0, TEX, TEX, packHex(base));
    for (let i = 0; i < TEX; i += 1) for (let k = 0; k < TEX; k += size) {
      p.px(i, k, packHex(grout));
      p.px(k, i, packHex(grout));
    }
    if (glint) for (let k = 0; k < 6; k += 1) p.px(Math.floor(rand() * TEX), Math.floor(rand() * TEX), packHex(glint));
  };
  switch (id) {
    case FLOOR.lab: tile("#e9f1df", "#aebdb4", 32, "#fff2cc"); break;
    case FLOOR.blue: {
      tile("#84c4d8", "#5797a7", 32, "#c7f4f2");
      for (let i = 0; i < TEX; i += 1) { p.px(i, (i + 7) % TEX, packHex("#a8e0ea")); }
      break;
    }
    case FLOOR.grey: tile("#4b5155", "#23282c", 32, "#8b9496"); break;
    case FLOOR.dark: tile("#1f2733", "#0e131a", 32, "#3d4a60"); break;
    case FLOOR.wood: {
      p.rect(0, 0, TEX, TEX, packHex("#b9874a"));
      for (let y = 0; y < TEX; y += 16) {
        p.rect(0, y, TEX, 1, packHex("#80592f"));
        const off = ((y / 16) % 2) * 20;
        p.rect((off + 22) % TEX, y, 1, 16, packHex("#80592f"));
        p.rect(0, y + 1, TEX, 1, packHex("#d6a86a"));
      }
      p.noise(11, 0.08);
      break;
    }
    case FLOOR.hazard: {
      for (let y = 0; y < TEX; y += 1) for (let x = 0; x < TEX; x += 1) p.px(x, y, ((x + y) >> 3) % 2 === 0 ? C.yellow : C.ink);
      break;
    }
    case FLOOR.lane: {
      tile("#e9f1df", "#aebdb4", 32);
      p.rect(0, 28, TEX, 8, packHex("#f2cf3f"));
      break;
    }
    case FLOOR.rugRed:
    case FLOOR.rugBlue:
    case FLOOR.rugGreen:
    case FLOOR.rugBrown: {
      const base = id === FLOOR.rugRed ? "#a8342f" : id === FLOOR.rugBlue ? "#3f6fb5" : id === FLOOR.rugGreen ? "#3d8f5a" : "#80592f";
      p.rect(0, 0, TEX, TEX, packHex(base));
      p.frame(2, 2, TEX - 4, TEX - 4, packHex("#f2cf3f"));
      p.noise(id, 0.12);
      break;
    }
    default: p.rect(0, 0, TEX, TEX, packHex("#0d141b"));
  }
  return p.tex();
}

// ---------------------------------------------------------------- sprites (NPCs, plants, monitors)

export async function loadImageData(url: string): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function blend(dst: number, src: number, alpha: number) {
  const a = alpha / 255;
  const r = Math.round((dst & 255) * (1 - a) + (src & 255) * a);
  const g = Math.round(((dst >> 8) & 255) * (1 - a) + ((src >> 8) & 255) * a);
  const b = Math.round(((dst >> 16) & 255) * (1 - a) + ((src >> 16) & 255) * a);
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}

const FRAME_COLUMN = [0, 1, 3];
const DIR_ROW: Record<string, number> = { down: 24, left: 25, right: 25, up: 26 };

/** The staff body from the shared sprite sheet (column 0), recoloured exactly like the CSS hat / shoe overlay in styles.css. */
export function buildStaffSprite(sheet: ImageData, dir: string, step: 0 | 1 | 2, hat: string, shoe: string): Tex {
  const p = new Painter(16, 16);
  const sx = FRAME_COLUMN[step] * 16;
  const sy = DIR_ROW[dir] * 16;
  const flip = dir === "left";
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const si = ((sy + y) * sheet.width + sx + (flip ? 15 - x : x)) * 4;
      const a = sheet.data[si + 3];
      if (a < 8) continue;
      p.px(x, y, (0xff000000 | (sheet.data[si + 2] << 16) | (sheet.data[si + 1] << 8) | sheet.data[si]) >>> 0);
    }
  }
  const hatC = packHex(hat);
  const shoeC = packHex(shoe);
  const over = (x: number, y: number, w: number, h: number, c: number, alpha = 255) => {
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) {
        if (xx < 0 || yy < 0 || xx >= 16 || yy >= 16) continue;
        const i = yy * 16 + xx;
        p.d[i] = alpha === 255 ? c : blend(p.d[i] >>> 24 ? p.d[i] : c, c, alpha);
      }
    }
  };
  // ::before = cap 8x3 at (4,1) with box-shadows; ::after = shoes 3x2 at (4,13) and (10,13)
  const cap = (x: number, y: number) => x >= 4 && x < 12 && y >= 1 && y < 4;
  const shadowRect = (ox: number, oy: number, c: number, alpha: number) => {
    for (let y = 1 + oy; y < 4 + oy; y += 1) for (let x = 4 + ox; x < 12 + ox; x += 1) if (!cap(x, y)) over(x, y, 1, 1, c, alpha);
  };
  shadowRect(0, 3, hatC, 255);
  shadowRect(1, -1, packHex("#ffffff"), 115);
  shadowRect(-1, 1, packHex("#11151d"), 204);
  over(4, 1, 8, 3, hatC);
  over(4, 13, 3, 2, shoeC);
  over(10, 13, 3, 2, shoeC);
  return p.tex();
}

/** Pot with the foliage sprite (32x28 cell of plants.png) on top, 32x36 px. */
export function buildPlantSprite(plants: ImageData | null, pot: ImageData | null, look: { col: number; row: number } | "pot"): Tex {
  const p = new Painter(32, 36);
  const copy = (img: ImageData | null, sx: number, sy: number, w: number, h: number, dx: number, dy: number) => {
    if (!img) return;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const si = ((sy + y) * img.width + sx + x) * 4;
        if (img.data[si + 3] < 100) continue;
        p.px(dx + x, dy + y, (0xff000000 | (img.data[si + 2] << 16) | (img.data[si + 1] << 8) | img.data[si]) >>> 0);
      }
    }
  };
  if (look === "pot") {
    copy(pot, 0, 0, 16, 16, 8, 20);
    return p.tex();
  }
  if (look.row !== 3) copy(pot, 0, 0, 16, 16, 8, 20);
  copy(plants, look.col * 32, look.row * 28, 32, 28, 0, look.row === 3 ? 4 : 0);
  return p.tex();
}

let monitorTex: Tex | undefined;
export function getMonitorSprite(alert = false) {
  if (monitorTex && !alert) return monitorTex;
  const p = new Painter(16, 16);
  p.rect(2, 2, 12, 9, packHex("#2a2f36"));
  p.rect(3, 3, 10, 7, packHex(alert ? "#ff8a7a" : "#7fe8d8", EMIT_ALPHA));
  for (let y = 4; y < 10; y += 2) p.rect(4, y, 6, 1, packHex(alert ? "#a02a20" : "#2a8f7a", EMIT_ALPHA));
  p.rect(7, 11, 2, 2, packHex("#566064"));
  p.rect(4, 13, 8, 2, packHex("#4b5155"));
  const tex = p.tex();
  if (!alert) monitorTex = tex;
  return tex;
}

// ---------------------------------------------------------------- ceiling

const CEIL_GROW = packHex("#ff9de0", EMIT_ALPHA);
const CEIL_PANEL = packHex("#fffbe0", EMIT_ALPHA);
const CEIL_HOUSING = packHex("#6f7f86");
const CEIL_GRID = packHex("#9aa6a6");
const CEIL_TILE = packHex("#c9d2cf");

/** Ceiling colour at a point inside a cell (u, v in 0..1): acoustic tile grid with an optional light panel. */
export function ceilingPixel(u: number, v: number, lamp: number): number {
  if (lamp > 0) {
    if (u > 0.18 && u < 0.82 && v > 0.28 && v < 0.72) return lamp === 2 ? CEIL_GROW : CEIL_PANEL;
    if (u > 0.14 && u < 0.86 && v > 0.24 && v < 0.76) return CEIL_HOUSING;
  }
  const gu = (u * 4) % 1;
  const gv = (v * 4) % 1;
  return gu < 0.06 || gv < 0.06 ? CEIL_GRID : CEIL_TILE;
}


// ---------------------------------------------------------------- dynamic, text-bearing textures (cached by content)

const dynCache = new Map<string, Tex>();
function remember(key: string, make: () => Tex): Tex {
  let tex = dynCache.get(key);
  if (!tex) {
    if (dynCache.size > 600) dynCache.clear();
    tex = make();
    dynCache.set(key, tex);
  }
  return tex;
}

function fitLine(line: string, width: number, scale = 1) {
  return line.slice(0, Math.max(1, Math.floor((width - 6) / (4 * scale))));
}

/** A readable screen / board texture: header line, then lines of 3x5 pixel text (nearest-neighbour friendly). */
export function panelTexture(lines: string[], w: number, h: number, look: "screen" | "board" | "alert"): Tex {
  return remember(`panel|${look}|${w}x${h}|${lines.join("~")}`, () => {
    const screen = look !== "board";
    const p = new Painter(w, h, screen ? packHex("#14202a") : C.cream);
    const fg = look === "alert" ? packHex("#ffd0c8", EMIT_ALPHA) : screen ? packHex("#7fe8d8", EMIT_ALPHA) : C.ink;
    const head = look === "alert" ? packHex("#ff8a7a", EMIT_ALPHA) : screen ? packHex("#f2cf3f", EMIT_ALPHA) : C.red;
    p.frame(0, 0, w, h, screen ? packHex("#2a2f36") : packHex("#9fb0b1"));
    p.frame(1, 1, w - 2, h - 2, screen ? packHex("#4b5155") : C.white);
    const rows = Math.floor((h - 6) / 7);
    lines.slice(0, rows).forEach((line, row) => {
      drawText(p, fitLine(line, w), 4, 4 + row * 7, row === 0 ? head : fg, 1);
    });
    return p.tex();
  });
}

/** The prop's own front texture with a label plate (or screen text) drawn on it, for crates, shelves, racks, terminals ... */
export function labeledTexture(baseKey: string, lines: string[]): Tex {
  return remember(`label|${baseKey}|${lines.join("~")}`, () => {
    const base = getTexture(baseKey);
    const p = new Painter(TEX, TEX);
    p.d.set(base.d);
    const kind = baseKey.slice(5);
    if (kind === "terminal") {
      p.rect(9, 9, 46, 28, packHex("#0b2a20"));
      lines.slice(0, 4).forEach((line, row) => drawText(p, fitLine(line, 52), 11, 11 + row * 7, row === 0 ? packHex("#f2cf3f", EMIT_ALPHA) : C.screen, 1));
      return p.tex();
    }
    const perLine = Math.floor((TEX - 10) / 4);
    const wrapped: Array<{ text: string; head: boolean }> = [];
    lines.forEach((line, i) => {
      let rest = line.toUpperCase();
      while (rest.length > 0 && wrapped.length < 6) {
        let cut = Math.min(perLine, rest.length);
        if (cut < rest.length) {
          const space = rest.lastIndexOf(" ", cut);
          if (space > 3) cut = space;
        }
        wrapped.push({ text: rest.slice(0, cut).trim(), head: i === 0 });
        rest = rest.slice(cut).trim();
      }
    });
    const rows = Math.min(6, wrapped.length);
    const plateY = 18;
    p.rect(4, plateY, TEX - 8, 7 * rows + 5, C.cream);
    p.frame(4, plateY, TEX - 8, 7 * rows + 5, C.ink);
    wrapped.slice(0, rows).forEach((line, row) => drawText(p, line.text, 7, plateY + 3 + row * 7, line.head ? C.red : C.ink, 1));
    return p.tex();
  });
}
