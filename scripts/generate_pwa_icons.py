#!/usr/bin/env python3
"""Generate the PWA / touch icons in public/icons from the brand mark.

Run:  python3 scripts/generate_pwa_icons.py

The mark mirrors public/favicon.svg — an indigo (#4F46E5) rounded square with
a white "F"-shaped calendar glyph and a rose (#FB7185) accent tile. We render
it at high resolution and downscale for crisp anti-aliasing.

Outputs (all PNG, in public/icons):
  icon-192.png          192x192  any-purpose
  icon-512.png          512x512  any-purpose
  icon-maskable-192.png 192x192  maskable (glyph inside the 80% safe zone)
  icon-maskable-512.png 512x512  maskable
  apple-touch-icon.png  180x180  iOS home-screen (opaque, no transparency)
"""
import os

from PIL import Image, ImageDraw

BRAND = (79, 70, 229)   # #4F46E5 indigo
ROSE = (251, 113, 133)  # #FB7185
WHITE = (255, 255, 255)

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
SS = 4  # supersampling factor for anti-aliasing


def rounded(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_mark(size, *, maskable=False, opaque=False):
    """Render the brand mark at `size` px. Returns an RGBA image."""
    s = size * SS
    img = Image.new("RGBA", (s, s), WHITE if opaque else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Maskable icons must keep the glyph inside the inner 80% safe zone, so the
    # tile fills the whole canvas and the glyph is scaled/centered within it.
    # Non-maskable icons inset the tile slightly for a little breathing room.
    if maskable:
        tile_box = (0, 0, s, s)
        tile_radius = int(s * 0.22)
        # glyph occupies the central safe zone
        g = s * 0.56
        gx = (s - g) / 2
        gy = (s - g) / 2
    else:
        pad = s * 0.06
        tile_box = (pad, pad, s - pad, s - pad)
        tile_radius = int(s * 0.22)
        g = s * 0.62
        gx = (s - g) / 2
        gy = (s - g) / 2

    rounded(d, tile_box, tile_radius, BRAND)

    # The favicon viewBox is 64x64; map its glyph rects into the g x g box.
    def gx_(x):
        return gx + (x - 16) / 33 * g

    def gy_(y):
        return gy + (y - 16) / 33 * g

    def rect(x, y, w, h, fill, rad):
        d.rounded_rectangle(
            (gx_(x), gy_(y), gx_(x + w), gy_(y + h)),
            radius=rad * (g / 33),
            fill=fill,
        )

    # vertical stem + two arms (white "F"), plus the rose accent tile.
    rect(22, 16, 7, 33, WHITE, 3.5)
    rect(22, 16, 22, 7, WHITE, 3.5)
    rect(22, 28, 15, 7, WHITE, 3.5)
    rect(36, 40, 9, 9, ROSE, 2.5)

    return img.resize((size, size), Image.LANCZOS)


def save(img, name):
    path = os.path.join(OUT_DIR, name)
    img.save(path, "PNG")
    print("wrote", os.path.relpath(path))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    save(draw_mark(192), "icon-192.png")
    save(draw_mark(512), "icon-512.png")
    save(draw_mark(192, maskable=True), "icon-maskable-192.png")
    save(draw_mark(512, maskable=True), "icon-maskable-512.png")
    save(draw_mark(180, opaque=True), "apple-touch-icon.png")


if __name__ == "__main__":
    main()
