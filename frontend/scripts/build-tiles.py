#!/usr/bin/env python3
"""Regenerates the processed scenery sheets used by the Gen-2 facility dashboard.

    python frontend/scripts/build-tiles.py [--raw <dir>]

Downloads (once, into --raw or a temp dir) the freely licensed source art:
  * Kenney "Roguelike Indoors"          CC0       https://kenney.nl/assets/roguelike-indoors
  * marceles "Laboratory tileset 16px"  CC-BY 4.0 https://opengameart.org/content/laboratory-tileset-pixelart-16px
and writes, under frontend/public/assets/tiles/:
  kenney.png  lab.png  lab-floor.png   -> the sheets, quantised to the dashboard's Game Boy Color-like palette
  floor-*.png                          -> single floor tiles
  sprites/*.png                        -> trimmed prop sprites (+ src/propSprites.css with their classes)
  plants.png / pot.png                 -> hand-drawn (procedural) cannabis plant sprites, never taken from any source art

Requires Pillow. The raw archives are not committed.
"""
import io
import math
import os
import sys
import tempfile
import urllib.request
import zipfile

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cannabis_sprites import build_plants, build_pot  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
FRONT = os.path.dirname(HERE)
OUT = os.path.join(FRONT, "public", "assets", "tiles")
CSS_OUT = os.path.join(FRONT, "src", "propSprites.css")

KENNEY_URL = "https://kenney.nl/media/pages/assets/roguelike-indoors/4d5b520b03-1702169567/kenney_roguelike-indoors.zip"
LAB_URL = "https://opengameart.org/sites/default/files/tiles_laboratory_landofpixels_0.zip"

# ---------------------------------------------------------------- palette
PALETTE = [
    "#11151d", "#23282c", "#4b5155", "#6f7f86", "#9fb0b1", "#d8d0be", "#fff2d4", "#ffffff",
    "#5b3924", "#8b6138", "#c09252", "#f2cf89",
    "#1f4d33", "#2f6f43", "#4f9b4f", "#83c45d", "#cfe88b",
    "#315a96", "#4da6be", "#8ec7d7",
    "#8b2a29", "#d94f4f", "#e07b39", "#e58fb0",
    "#9c8c2e", "#d4bf42", "#f0de65", "#6a8044",
]


def hex2rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


PAL = [hex2rgb(h) for h in PALETTE]


def nearest(rgb):
    r, g, b = rgb
    best, bd = None, 1e18
    for p in PAL:
        d = 2 * (r - p[0]) ** 2 + 4 * (g - p[1]) ** 2 + 3 * (b - p[2]) ** 2
        if d < bd:
            best, bd = p, d
    return best


def quantise(im, tint=None):
    im = im.convert("RGBA")
    px = im.load()
    cache = {}
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < 128:
                px[x, y] = (0, 0, 0, 0)
                continue
            if tint:
                lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255
                r, g, b = [int(c * (0.55 + 0.45 * lum)) for c in tint]
            key = (r, g, b)
            if key not in cache:
                cache[key] = nearest(key)
            px[x, y] = cache[key] + (255,)
    return im


def fetch_zip(url, dest):
    if not os.path.isdir(dest):
        print("downloading", url)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        data = urllib.request.urlopen(req, timeout=60).read()
        os.makedirs(dest, exist_ok=True)
        zipfile.ZipFile(io.BytesIO(data)).extractall(dest)
    return dest


# ---------------------------------------------------------------- prop sprite atlas
# name -> (sheet, x, y, w, h); the box is auto-trimmed to its opaque pixels.
def kt(c, r, cw=1, rh=1):  # Kenney tile coords (16px tiles, 1px margin)
    return ("kenney", c * 17, r * 17, cw * 17 - 1, rh * 17 - 1)


SPRITES = {
    "chair": kt(0, 2),
    "sink": kt(8, 12, 2, 1),
    "desk": kt(0, 0, 3, 2),
    "rack": ("lab", 528, 144, 32, 48),
    "vat": ("lab", 489, 111, 28, 60),
    "machine": ("lab", 338, 121, 40, 38),
    "shelf": ("lab", 432, 213, 48, 32),
    "screen": ("lab", 417, 177, 45, 34),
    "conveyor": ("lab", 293, 40, 76, 26),
}


def trim(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def build_sprites(sheets):
    """trim every SPRITES entry to its opaque pixels; returns {name: Image}"""
    cells = {}
    for name, (sheet, x, y, w, h) in SPRITES.items():
        c = trim(sheets[sheet].crop((x, y, x + w, y + h)))
        if name == "desk":  # multi-tile crop: re-compose from tiles to drop the 1px margins
            c = compose_tiles(sheets["kenney"], 0, 0, 3, 2)
        cells[name] = c
    return cells


def compose_tiles(sheet, c0, r0, cols, rows):
    out = Image.new("RGBA", (cols * 16, rows * 16), (0, 0, 0, 0))
    for r in range(rows):
        for c in range(cols):
            x, y = (c0 + c) * 17, (r0 + r) * 17
            out.paste(sheet.crop((x, y, x + 16, y + 16)), (c * 16, r * 16))
    return out


# ---------------------------------------------------------------- main
def main():
    raw = None
    if "--raw" in sys.argv:
        raw = sys.argv[sys.argv.index("--raw") + 1]
    raw = raw or os.path.join(tempfile.gettempdir(), "neurolab-tile-sources")
    kdir = fetch_zip(KENNEY_URL, os.path.join(raw, "kenney"))
    ldir = fetch_zip(LAB_URL, os.path.join(raw, "lab"))
    lab16 = os.path.join(ldir, "tiles_laboratory_LandOfPixels", "16px")
    os.makedirs(OUT, exist_ok=True)

    kenney = quantise(Image.open(os.path.join(kdir, "Tilesheets", "roguelikeIndoor_transparent.png")))
    lab = quantise(Image.open(os.path.join(lab16, "tilesStuff.png")))
    floor = quantise(Image.open(os.path.join(lab16, "tilesFloor.png")))
    kenney.save(os.path.join(OUT, "kenney.png"))
    lab.save(os.path.join(OUT, "lab.png"))
    floor.save(os.path.join(OUT, "lab-floor.png"))

    def cell(sheet, c, r):
        return sheet.crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16))

    raw_floor = Image.open(os.path.join(lab16, "tilesFloor.png"))
    quantise(cell(raw_floor, 5, 16)).save(os.path.join(OUT, "floor-lab.png"))
    quantise(cell(raw_floor, 5, 16), tint=hex2rgb("#84c4d8")).save(os.path.join(OUT, "floor-blue.png"))
    quantise(cell(raw_floor, 8, 16), tint=hex2rgb("#6f7f86")).save(os.path.join(OUT, "floor-grey.png"))

    sprites = build_sprites({"kenney": kenney, "lab": lab})
    os.makedirs(os.path.join(OUT, "sprites"), exist_ok=True)
    css = ["/* generated by scripts/build-tiles.py - do not edit */"]
    for name, c in sprites.items():
        c.save(os.path.join(OUT, "sprites", name + ".png"))
        css.append(f'.spr-{name} {{ --spr-img: url("/assets/tiles/sprites/{name}.png"); --spr-w: {c.width}px; --spr-h: {c.height}px; }}')
    with open(CSS_OUT, "w", newline="\n") as f:
        f.write("\n".join(css) + "\n")

    build_plants().save(os.path.join(OUT, "plants.png"))
    build_pot().save(os.path.join(OUT, "pot.png"))
    print("done:", ", ".join(f"{n}={c.width}x{c.height}" for n, c in sprites.items()))


if __name__ == "__main__":
    main()
