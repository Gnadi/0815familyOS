#!/usr/bin/env python3
"""Generate the social-share OG image (public/og-image.png, 1200x630 PNG).

Run:  python3 scripts/generate_og_image.py

Fonts: by default reads Outfit/WorkSans TTFs from $OG_FONTS_DIR. Any clean
sans-serif TTFs work — adjust the paths below if regenerating elsewhere.
The brand palette mirrors the landing hero (Tailwind brand-500 -> brand-700).
"""
import os

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BRAND_500 = (59, 130, 246)   # #3B82F6
BRAND_700 = (29, 78, 216)    # #1D4ED8
WHITE = (255, 255, 255)

FONTS_DIR = os.environ.get(
    "OG_FONTS_DIR", "/mnt/skills/examples/canvas-design/canvas-fonts"
)
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "og-image.png")


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS_DIR, name), size)


def main():
    img = Image.new("RGB", (W, H), BRAND_500)
    draw = ImageDraw.Draw(img)

    # Diagonal brand gradient (top-left brand-500 -> bottom-right brand-700).
    for y in range(H):
        t = y / H
        r = int(BRAND_500[0] + (BRAND_700[0] - BRAND_500[0]) * t)
        g = int(BRAND_500[1] + (BRAND_700[1] - BRAND_500[1]) * t)
        b = int(BRAND_500[2] + (BRAND_700[2] - BRAND_500[2]) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # House logo (rounded square + roof + door), echoing favicon.svg.
    box = 132
    bx, by = 96, 96
    draw.rounded_rectangle([bx, by, bx + box, by + box], radius=30, fill=WHITE)
    cx, cy = bx + box / 2, by + box / 2
    draw.polygon(
        [(cx - 42, cy - 4), (cx, cy - 40), (cx + 42, cy - 4)], fill=BRAND_500
    )
    draw.rectangle(
        [cx - 30, cy - 4, cx + 30, cy + 36], fill=BRAND_500
    )
    draw.rectangle(
        [cx - 8, cy + 14, cx + 8, cy + 36], fill=WHITE
    )

    # Wordmark next to the logo.
    draw.text((bx + box + 28, by + 38), "myFAOS", font=font("Outfit-Bold.ttf", 56), fill=WHITE)

    # Headline + value proposition.
    headline = font("Outfit-Bold.ttf", 92)
    draw.text((96, 300), "Organize Your", font=headline, fill=WHITE)
    draw.text((96, 396), "Family Life", font=headline, fill=WHITE)

    # Value proposition, auto-sized to fit within the side margins.
    sub_text = "Shared calendar, document vault, gifts & tasks — one secure place."
    max_width = W - 2 * 96
    sub_size = 36
    while sub_size > 20:
        sub = font("WorkSans-Regular.ttf", sub_size)
        if draw.textlength(sub_text, font=sub) <= max_width:
            break
        sub_size -= 1
    draw.text((96, 524), sub_text, font=sub, fill=(235, 242, 255))

    img.save(os.path.abspath(OUT), "PNG", optimize=True)
    print("wrote", os.path.abspath(OUT), img.size)


if __name__ == "__main__":
    main()
