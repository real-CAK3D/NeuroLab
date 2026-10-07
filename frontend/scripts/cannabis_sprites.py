"""Procedural, hand-tuned cannabis plant sprites (16x24) plus the pot (16x16).

Nothing here is taken from third-party art: leaves are drawn as serrated, tapered
leaflets fanned into 3/5/7-finger leaves, buds are shaded blobs with pistils and frost.
"""
import math

from PIL import Image

W, H = 32, 28
OX, OY = 8, 4  # drawing coordinates are 16x24-based; the canvas adds room for wide fan leaves


def col(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


G_DARK, G_LEAF, G_MID, G_LIGHT, G_PALE = col("#1f4d33"), col("#2f6f43"), col("#4f9b4f"), col("#83c45d"), col("#cfe88b")
PINK, ORANGE, AMBER, FROST, BROWN = col("#e58fb0"), col("#e07b39"), col("#f2cf3f"), col("#fff2d4"), col("#8b6138")
YEL_TIP = col("#d4bf42")


class Canvas:
    def __init__(self):
        self.p = {}

    def put(self, x, y, c):
        x, y = int(math.floor(x + 0.5)) + OX, int(math.floor(y + 0.5)) + OY
        if 0 <= x < W and 0 <= y < H:
            self.p[(x, y)] = c


def leaflet(cv, cx, cy, ang, length, maxw, base, rib):
    a = math.radians(ang)
    dx, dy = math.cos(a), -math.sin(a)
    nx, ny = -dy, dx
    t = 0.0
    while t <= length:
        frac = t / length
        hw = maxw * math.sin(math.pi * min(1.0, frac) ** 0.65)
        if frac > 0.3 and int(t * 1.7) % 2 == 1:  # serrated edge
            hw *= 0.5
        px, py = cx + dx * t, cy + dy * t
        s = -hw
        while s <= hw + 1e-6:
            cv.put(px + nx * s, py + ny * s, base)
            s += 0.4
        t += 0.2
    t = 0.0
    while t <= length * 0.8:
        cv.put(cx + dx * t, cy + dy * t, rib)
        t += 0.4


def fan(cv, cx, cy, ang, length, leaflets=5, back=False, maxw=0.62):
    base = G_LEAF if back else G_MID
    rib = G_MID if back else G_LIGHT
    offs = {3: [0, -40, 40], 5: [0, -32, 32, -64, 64], 7: [0, -26, 26, -52, 52, -78, 78]}[leaflets]
    lens = {3: [1, .7, .7], 5: [1, .88, .88, .6, .6], 7: [1, .94, .94, .78, .78, .52, .52]}[leaflets]
    order = sorted(range(len(offs)), key=lambda i: -abs(offs[i]))
    for i in order:
        leaflet(cv, cx, cy, ang + offs[i], length * lens[i], maxw, base, rib)


def stalk(cv, x, y0, y1, c=G_LEAF):
    for y in range(int(y1), int(y0) + 1):
        cv.put(x, y, c)


def petiole(cv, x0, y0, x1, y1):
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for i in range(n + 1):
        cv.put(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, G_LEAF)


def bud(cv, cx, cy, w, h, ripe, seed):
    """Shaded bud blob; pistils poke out of the rim, a couple of frost specks on top."""
    cells = []
    for yy in range(h):
        for xx in range(w):
            ex, ey = (xx - (w - 1) / 2) / (w / 2), (yy - (h - 1) / 2) / (h / 2)
            if ex * ex + ey * ey <= 1.1:
                c = G_MID
                if xx < w * 0.45 and yy < h * 0.55:
                    c = G_LIGHT
                if yy >= h * 0.7 or xx >= w * 0.75:
                    c = G_LEAF
                x, y = cx - w // 2 + xx, cy - h // 2 + yy
                cv.put(x, y, c)
                cells.append((x, y))
    pist = [AMBER, ORANGE, ORANGE] if ripe else [PINK, ORANGE, PINK]
    edge = [c for c in cells if any((c[0] + dx, c[1] + dy) not in cells for dx, dy in ((1, 0), (-1, 0), (0, -1)))]
    for i in range(max(1, len(cells) // 7)):
        x, y = edge[(seed * 5 + i * 7) % len(edge)]
        cv.put(x, y, pist[i % 3])
    for i in range(max(1, len(cells) // 12)):
        x, y = cells[(seed * 3 + i * 5) % len(cells)]
        cv.put(x, y, FROST)


def cola(cv, cx, ytop, ybot, wmax, ripe, seed):
    y = ybot
    i = 0
    while y > ytop + 2:
        frac = (ybot - y) / max(1, ybot - ytop)
        w = max(3, int(round(wmax * (1 - 0.45 * frac))))
        bud(cv, cx + (0 if i % 2 else 0), y, w, w + 1, ripe, seed + i)
        y -= max(2, w - 1)
        i += 1
    bud(cv, cx, ytop + 1, 3, 3, ripe, seed + 9)


def outline_pass(cv):
    dark = {G_MID: G_LEAF, G_LIGHT: G_MID, G_LEAF: G_DARK, G_PALE: G_LIGHT}
    edge = [k for k, v in cv.p.items() if v in dark and any((k[0] + dx, k[1] + dy) not in cv.p for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for k in edge:
        cv.p[k] = dark[cv.p[k]]


def plant_clone():
    cv = Canvas()
    stalk(cv, 8, 22, 16)
    petiole(cv, 8, 19, 6, 18)
    petiole(cv, 8, 19, 10, 18)
    fan(cv, 6, 18, 160, 3.6, 3, True, 0.7)
    fan(cv, 10, 18, 20, 3.6, 3, True, 0.7)
    fan(cv, 8, 16, 90, 4.4, 3, False, 0.75)
    outline_pass(cv)
    return cv


def plant_veg():
    cv = Canvas()
    stalk(cv, 8, 22, 4)
    petiole(cv, 8, 20, 5, 20)
    petiole(cv, 8, 20, 11, 20)
    fan(cv, 5, 20, 185, 5.6, 5, True)
    fan(cv, 11, 20, -5, 5.6, 5, True)
    petiole(cv, 8, 16, 5, 14)
    petiole(cv, 8, 16, 11, 14)
    fan(cv, 5, 14, 160, 7.6, 7, False)
    fan(cv, 11, 14, 20, 7.6, 7, False)
    petiole(cv, 8, 11, 6, 9)
    petiole(cv, 8, 11, 10, 9)
    fan(cv, 6, 9, 130, 6.0, 5, True)
    fan(cv, 10, 9, 50, 6.0, 5, True)
    fan(cv, 8, 6, 90, 6.4, 7, False)
    outline_pass(cv)
    return cv


def plant_flower():
    cv = Canvas()
    stalk(cv, 8, 22, 3)
    petiole(cv, 8, 20, 5, 20)
    petiole(cv, 8, 20, 11, 20)
    fan(cv, 5, 20, 185, 5.6, 5, True)
    fan(cv, 11, 20, -5, 5.6, 5, True)
    petiole(cv, 8, 16, 5, 15)
    petiole(cv, 8, 16, 11, 15)
    fan(cv, 5, 15, 165, 6.6, 7, False)
    fan(cv, 11, 15, 15, 6.6, 7, False)
    bud(cv, 6, 18, 3, 4, False, 1)
    bud(cv, 10, 18, 3, 4, False, 2)
    bud(cv, 5, 11, 3, 4, False, 3)
    bud(cv, 11, 11, 3, 4, False, 4)
    petiole(cv, 8, 9, 5, 8)
    petiole(cv, 8, 9, 11, 8)
    fan(cv, 5, 8, 150, 3.8, 5, True)
    fan(cv, 11, 8, 30, 3.8, 5, True)
    cola(cv, 8, 0, 11, 5, False, 5)
    outline_pass(cv)
    return cv


def plant_ripe():
    cv = Canvas()
    stalk(cv, 8, 22, 3)
    petiole(cv, 8, 20, 5, 20)
    petiole(cv, 8, 20, 11, 20)
    fan(cv, 5, 20, 190, 5.6, 5, True)
    fan(cv, 11, 20, -10, 5.6, 5, True)
    petiole(cv, 8, 16, 5, 16)
    petiole(cv, 8, 16, 11, 16)
    fan(cv, 5, 16, 175, 5.6, 7, False)
    fan(cv, 11, 16, 5, 5.6, 7, False)
    bud(cv, 5, 13, 4, 5, True, 11)
    bud(cv, 11, 13, 4, 5, True, 12)
    bud(cv, 5, 8, 4, 5, True, 13)
    bud(cv, 11, 8, 4, 5, True, 14)
    cola(cv, 8, 0, 12, 7, True, 21)
    outline_pass(cv)
    for (x, y), c in list(cv.p.items()):  # yellowing leaf tips
        if c == G_DARK and abs(x - 16) >= 6 and y >= 14 and (x + y) % 2 == 0:
            cv.p[(x, y)] = YEL_TIP
    return cv


def plant_dry():
    """A hung, trimmed cola: string at the top, buds hanging down (the ripe cola, flipped)."""
    src = Canvas()
    cola(src, 8, 0, 12, 7, True, 33)
    outline_pass(src)
    out = Canvas()
    ys = [y for (_, y) in src.p]
    lo, hi = min(ys), max(ys)
    for (x, y), c in src.p.items():
        out.p[(x, 6 + (hi - y))] = c
    for y in range(0, 6):
        out.p[(16, y)] = (216, 208, 190) if y < 4 else G_LEAF
    return out


def recolour(cv, mapping):
    out = Canvas()
    out.p = {k: mapping.get(v, v) for k, v in cv.p.items()}
    return out


YELLOW = {G_DARK: col("#9c8c2e"), G_LEAF: col("#9c8c2e"), G_MID: col("#d4bf42"), G_LIGHT: col("#f0de65"), G_PALE: col("#fff2d4"),
          PINK: col("#e07b39")}
GREY = {G_DARK: col("#23282c"), G_LEAF: col("#4b5155"), G_MID: col("#6f7f86"), G_LIGHT: col("#9fb0b1"), G_PALE: col("#d8d0be"),
        PINK: col("#9fb0b1"), ORANGE: col("#6f7f86"), AMBER: col("#9fb0b1"), BROWN: col("#4b5155"), YEL_TIP: col("#9fb0b1")}
DRY = {G_DARK: col("#5b3924"), G_LEAF: col("#6a8044"), G_MID: col("#6a8044"), G_LIGHT: col("#8b6138"), G_PALE: col("#d8d0be"),
       PINK: col("#c09252"), ORANGE: col("#8b6138"), AMBER: col("#c09252")}


def droop(cv):
    """stressed plants sag: the outer upper pixels slump one row"""
    out = Canvas()
    for (x, y), c in cv.p.items():
        dy = 1 if (y < 22 and abs(x - 16) > 2) else 0
        out.p[(x, y + dy)] = c
    for k, c in cv.p.items():
        out.p.setdefault(k, c)
    return out


def paint(img, cv, ox, oy):
    for (x, y), c in cv.p.items():
        if 0 <= x < W and 0 <= y < H:
            img.putpixel((ox + x, oy + y), c + (255,))


def build_plants():
    """4 stage columns (clone, veg, flower, ripe) x rows: healthy, stressed, offline, dry-hung (col 0 only)"""
    stages = [plant_clone(), plant_veg(), plant_flower(), plant_ripe()]
    rows = [stages, [droop(recolour(s, YELLOW)) for s in stages], [recolour(s, GREY) for s in stages]]
    img = Image.new("RGBA", (W * 4, H * 4), (0, 0, 0, 0))
    for r, row in enumerate(rows):
        for c, cv in enumerate(row):
            paint(img, cv, c * W, r * H)
    paint(img, recolour(plant_dry(), DRY), 0, 3 * H)
    return img


POT = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "....KKKKKKKK....",
    "..KKsSssSssSKK..",
    "..KRRRRRRRRRRK..",
    "..KrrrrrrrrrrK..",
    "..KKKKKKKKKKKK..",
    "...KhbbbbbbBK...",
    "...KhbbbbbbBK...",
    "...KhbbbbbbBK...",
    "....KhbbbbBK....",
    "....KhbbbbBK....",
    "....KKKKKKKK....",
]
POT_COL = {"K": "#11151d", "s": "#5b3924", "S": "#8b6138", "R": "#f2cf89", "r": "#c09252", "h": "#c09252", "b": "#8b6138", "B": "#5b3924"}


def build_pot():
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(POT):
        for x, ch in enumerate(row):
            if ch in POT_COL:
                img.putpixel((x, y), col(POT_COL[ch]) + (255,))
    return img
