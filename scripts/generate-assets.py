"""Generate 3awedlou PNG assets (icon, adaptive-icon, splash, favicon).

Brand: green #16a34a background, white recycling emblem, dark splash #0b100e.
Pure Pillow rasterization so the script needs no extra dependencies.
Run: python scripts/generate-assets.py
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

GREEN = (22, 163, 74)
GREEN_DARK = (21, 128, 61)
WHITE = (255, 255, 255)
SPLASH_BG = (11, 16, 14)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
FONT_DIRS = [
    r"C:\Windows\Fonts",
    r"C:\Windows\System32\fonts",
]
FONT_CANDIDATES = ["arialbd.ttf", "arial.ttf", "segoeuib.ttf", "segoeui.ttf"]


def load_font(size: int):
    for d in FONT_DIRS:
        for name in FONT_CANDIDATES:
            path = os.path.join(d, name)
            if os.path.exists(path):
                try:
                    return ImageFont.truetype(path, size)
                except OSError:
                    continue
    return ImageFont.load_default()


def polygon(cx, cy, radius, rotation, n=3):
    return [
        (
            cx + radius * math.sin(rotation + 2 * math.pi * k / n),
            cy - radius * math.cos(rotation + 2 * math.pi * 3 / 3 * k / 3 + 2 * math.pi * k / n),
        )
        for k in range(n)
    ]


def triangle_pts(cx, cy, r, rot):
    return [
        (cx + r * math.sin(rot + 2 * math.pi * i / 3), cy - r * math.cos(rot + 2 * math.pi * i / 3))
        for i in range(3)
    ]


def draw_arrowhead(draw, cx, cy, r, rot, color, alpha=255):
    pts = triangle_pts(cx, cy, r, rot)
    draw.polygon(pts, fill=color)


def emblem_layer(size: int) -> Image.Image:
    """White recycling emblem on transparent background, drawn at supersampled scale."""
    ss = 4
    s = size * ss
    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    cx, cy = s / 2, s / 2
    R = s * 0.30          # orbit radius of triangle corners
    tr = s * 0.085        # arrowhead radius
    band = s * 0.055      # chase band width

    # Three arcs (240deg each, offset 120deg) forming the chasing-arrows triangle.
    bbox = [cx - R, cy - R, cx + R, cy + R]
    for k in range(3):
        start = -90 + 120 * k - 60 + 14   # +14deg gap between arrows
        end = start + 240 - 28
        d.arc(bbox, start=start, end=end, fill=WHITE + (255,), width=int(band * ss) if False else 0)
    # Pillow arc() has no width param usable with fill+width on RGBA? It does: use width.
    # (Redo properly below; the call above is a no-op placeholder.)
    for k in range(3):
        start = -90 + 120 * k + 14
        end = start + 240 - 28
        d.arc(bbox, start=start, end=end, fill=WHITE + (255,), width=max(1, int(band)))

    # Arrowheads at each arc end (tangent direction = rotation + 90deg).
    for k in range(3):
        tip_deg = -90 + 120 * k + 14 + (240 - 28)
        tip = math.radians(tip_deg)
        px = cx + R * math.sin(tip)
        py = cy - R * math.cos(tip)
        tangent = tip_deg + 90
        draw_arrowhead(d, px, py, tr * ss / ss * ss, tangent, WHITE)
        # second smaller barb for a chunkier look
        back = math.radians(tip_deg)
        bx = cx + (R - s * 0.02) * math.sin(back)
        by = cy - (R - s * 0.02) * math.cos(back)
        draw_arrowhead(d, bx, by, tr * 0.55, tangent, WHITE)

    # Center leaf: pointed-oval rotated 45deg.
    leaf = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    dl = ImageDraw.Draw(leaf)
    h = s * 0.36
    w = s * 0.16
    dl.ellipse([cx - w, cy - h / 2, cx + w, cy + h / 2], fill=WHITE + (255,))
    leaf = leaf.rotate(45, resample=Image.BICUBIC, center=(cx, cy))
    layer.alpha_composite(leaf)

    return layer.resize((size, size), Image.LANCZOS)


def make_icon(size: int, radius_ratio: float = 0.0) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if radius_ratio > 0:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=GREEN + (255,))
        # subtle darker bottom edge for depth
        shade = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ds = ImageDraw.Draw(shade)
        ds.ellipse([-size * 0.4, size * 0.55, size * 1.4, size * 1.6], fill=GREEN_DARK + (255,))
        mask = Image.new("L", (size, size), 0)
        dm = ImageDraw.Draw(mask)
        dm.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
        img.paste(shade, (0, 0), Image.composite(shade.split()[3], Image.new("L", (size, size), 0), mask))
    else:
        d.rectangle([0, 0, size, size], fill=GREEN + (255,))
    emblem = emblem_layer(int(size * 0.78))
    img.alpha_composite(emblem, (int(size * 0.11), int(size * 0.11)))
    return img


def make_adaptive_foreground(size: int) -> Image.Image:
    """Foreground must keep the emblem inside the ~66% center safe zone; background color is separate."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    emblem = emblem_layer(int(size * 0.56))
    img.alpha_composite(emblem, (int(size * 0.22), int(size * 0.22)))
    return img


def make_splash(width: int, height: int) -> Image.Image:
    img = Image.new("RGB", (width, height), SPLASH_BG)
    em = emblem_layer(int(width * 0.16))
    img.paste(em, (int(width * 0.42), int(height * 0.40)), em)

    f1 = load_font(int(width * 0.075))
    f2 = load_font(int(width * 0.026))
    d = ImageDraw.Draw(img)
    cx = width / 2
    text1 = "3awedlou"
    text2 = "Smart PET recycling"
    w1 = d.textlength(text1, font=f1)
    w2 = d.textlength(text2, font=f2)
    d.text((cx - w1 / 2, height * 0.50), text1, font=f1, fill=(74, 222, 128))
    d.text((cx - w2 / 2, height * 0.555), text2, font=f2, fill=(154, 168, 159))
    return img


def make_favicon(size: int) -> Image.Image:
    return make_icon(size, radius_ratio=0.22)


def save(img: Image.Image, name: str) -> None:
    path = os.path.join(ASSETS, name)
    img.save(path)
    print("wrote", path, img.size)


def main():
    os.makedirs(ASSETS, exist_ok=True)
    save(make_icon(1024), "icon.png")
    save(make_adaptive_foreground(1024), "adaptive-icon.png")
    save(make_splash(1284, 2778), "splash.png")
    save(make_favicon(48), "favicon.png")


if __name__ == "__main__":
    main()
