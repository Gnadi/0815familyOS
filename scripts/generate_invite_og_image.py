#!/usr/bin/env python3
"""Generate the invite-link share images (public/og-invite*.png, 1200x630 PNG).

Run:  python3 scripts/generate_invite_og_image.py

One card per UI language (English + German); scripts/emit-app-shell.mjs builds a
matching shell and vercel.json picks between them on Accept-Language.

This is the picture a messenger (WhatsApp, Signal, iMessage, Telegram …) pulls
when someone forwards a /join/<token> link. Those crawlers never run JS, so the
card is built from the static tags in dist/join*.html (see
scripts/emit-app-shell.mjs) and from this file — the family name is deliberately
NOT in it: reading an invite needs an authenticated caller, and a link that
travels through group chats should not announce which family it belongs to.

Fonts: reads Outfit/WorkSans TTFs from $OG_FONTS_DIR. Any clean sans-serif TTFs
work — the layout measures the text it draws, so a substitute font still fits.
Palette and monogram mirror public/favicon.svg and the landing hero.
"""
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630

INDIGO = (79, 70, 229)       # #4F46E5 — brand tile / gradient start
INDIGO_DEEP = (67, 56, 202)  # #4338CA — gradient end
VIOLET = (139, 92, 246)      # #8B5CF6 — bottom glow
CORAL = (251, 113, 133)      # #FB7185 — the "OS" accent square
WHITE = (255, 255, 255)
LAVENDER = (199, 210, 254)   # #C7D2FE — secondary copy on indigo

FONTS_DIR = os.environ.get(
    "OG_FONTS_DIR", "/mnt/skills/examples/canvas-design/canvas-fonts"
)
PUBLIC = os.path.join(os.path.dirname(__file__), "..", "public")

# Keep in sync with INVITE_PREVIEWS in scripts/emit-app-shell.mjs, which points
# og:image at these files (file name -> the copy printed on that card).
LOCALES = {
    "og-invite.png": {
        "kicker": "YOU\u2019RE INVITED",
        "headline": ("Join your family", "on myFAOS"),
        "sub": "Shared calendar, tasks, meals and documents.",
    },
    "og-invite-de.png": {
        "kicker": "DU BIST EINGELADEN",
        "headline": ("Tritt deiner Familie", "auf myFAOS bei"),
        "sub": "Gemeinsamer Kalender, Aufgaben, Essensplan, Dokumente.",
    },
}

MARGIN = 88
PANEL_X = 700  # left edge of the members panel; the headline stops short of it


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS_DIR, name), size)


def background():
    """Diagonal indigo gradient with a soft violet glow at the bottom."""
    img = Image.new("RGB", (W, H), INDIGO)
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        draw.line(
            [(0, y), (W, y)],
            fill=tuple(
                int(a + (b - a) * t) for a, b in zip(INDIGO, INDIGO_DEEP)
            ),
        )

    # The glow is painted on a half-size layer and blurred, which is both
    # faster and smoother than shading it pixel by pixel.
    glow = Image.new("L", (W // 2, H // 2), 0)
    ImageDraw.Draw(glow).ellipse([120, 190, 480, 400], fill=190)
    glow = glow.filter(ImageFilter.GaussianBlur(60)).resize((W, H), Image.LANCZOS)
    return Image.composite(Image.new("RGB", (W, H), VIOLET), img, glow)


def monogram(img, x, y, size):
    """The myFAOS "F" lettermark on its white app tile (see favicon.svg)."""
    draw = ImageDraw.Draw(img)
    s = size / 64  # the mark is authored on a 64x64 grid

    def box(bx, by, bw, bh, radius, fill):
        draw.rounded_rectangle(
            [x + bx * s, y + by * s, x + (bx + bw) * s, y + (by + bh) * s],
            radius=radius * s,
            fill=fill,
        )

    box(0, 0, 64, 64, 14, WHITE)
    box(22, 16, 7, 33, 3.5, INDIGO)   # stem
    box(22, 16, 22, 7, 3.5, INDIGO)   # top arm
    box(22, 28, 15, 7, 3.5, INDIGO)   # middle arm
    box(36, 40, 9, 9, 2.5, CORAL)     # "OS" accent


def tracked(draw, xy, text, fnt, fill, tracking):
    """draw.text with letter spacing, for the small all-caps kicker."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking


def member_panel(img, x, y, w, h):
    """Frosted panel showing three joined members and one open seat.

    Says "a family you are being added to" without naming anyone — the card is
    public, the family is not.
    """
    panel = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(panel)
    draw.rounded_rectangle([0, 0, w - 1, h - 1], radius=36, fill=(255, 255, 255, 28))

    rows = 4
    pad = 40
    row_h = (h - 2 * pad) / rows
    for i in range(rows):
        cy = pad + row_h * (i + 0.5)
        r = 26
        cx = pad + r
        joined = i < rows - 1
        if joined:
            draw.ellipse(
                [cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 230)
            )
            # A simple head-and-shoulders silhouette in brand indigo.
            draw.ellipse([cx - 8, cy - 12, cx + 8, cy + 4], fill=INDIGO + (255,))
            draw.pieslice(
                [cx - 15, cy - 1, cx + 15, cy + 29], 180, 360, fill=INDIGO + (255,)
            )
        else:
            # The open seat: a dashed ring with a coral "+".
            for a in range(0, 360, 30):
                draw.arc(
                    [cx - r, cy - r, cx + r, cy + r], a, a + 18,
                    fill=(255, 255, 255, 190), width=4,
                )
            draw.rounded_rectangle(
                [cx - 11, cy - 3, cx + 11, cy + 3], radius=3, fill=CORAL + (255,)
            )
            draw.rounded_rectangle(
                [cx - 3, cy - 11, cx + 3, cy + 11], radius=3, fill=CORAL + (255,)
            )

        # Name/detail bars beside each seat.
        bx = pad + 2 * r + 26
        alpha = 200 if joined else 120
        widths = [(150, 16), (108, 12), (132, 16), (96, 12)]
        bw, bh = widths[i]
        draw.rounded_rectangle(
            [bx, cy - bh, bx + bw, cy], radius=bh / 2, fill=(255, 255, 255, alpha)
        )
        draw.rounded_rectangle(
            [bx, cy + 8, bx + bw * 0.62, cy + 8 + bh * 0.7],
            radius=bh / 3,
            fill=(255, 255, 255, alpha - 90),
        )

    img.alpha_composite(panel, (x, y))


def card(copy):
    img = background().convert("RGBA")
    draw = ImageDraw.Draw(img)

    # Brand row: tile + wordmark, vertically centred on each other.
    tile = 116
    monogram(img, MARGIN, MARGIN - 8, tile)
    wordmark = font("Outfit-Bold.ttf", 54)
    draw.text(
        (MARGIN + tile + 30, MARGIN - 8 + tile / 2),
        "myFAOS",
        font=wordmark,
        fill=WHITE,
        anchor="lm",
    )

    # Kicker.
    kicker = font("WorkSans-Bold.ttf", 26)
    tracked(draw, (MARGIN, 272), copy["kicker"], kicker, LAVENDER, 4)

    # Headline, auto-sized so the longer German wording still clears the panel.
    line_a, line_b = copy["headline"]
    size = 78
    while size > 52:
        headline = font("Outfit-Bold.ttf", size)
        widest = max(draw.textlength(line, font=headline) for line in (line_a, line_b))
        if widest <= PANEL_X - MARGIN - 24:
            break
        size -= 2
    draw.text((MARGIN, 314), line_a, font=headline, fill=WHITE)
    draw.text((MARGIN, 314 + size * 1.1), line_b, font=headline, fill=WHITE)

    # Supporting line, auto-sized so a substituted font still fits the margins.
    size = 32
    while size > 20:
        sub = font("WorkSans-Regular.ttf", size)
        if draw.textlength(copy["sub"], font=sub) <= W - 2 * MARGIN:
            break
        size -= 1
    draw.text((MARGIN, 524), copy["sub"], font=sub, fill=LAVENDER)

    member_panel(img, PANEL_X, 150, W - PANEL_X - MARGIN, 340)

    return img.convert("RGB")


def main():
    for name, copy in LOCALES.items():
        out = os.path.abspath(os.path.join(PUBLIC, name))
        card(copy).save(out, "PNG", optimize=True)
        print("wrote", out)


if __name__ == "__main__":
    main()
