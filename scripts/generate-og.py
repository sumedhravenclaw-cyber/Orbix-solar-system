#!/usr/bin/env python3
"""
Generates public/og.png — the 1280x720 link-preview card.

This is a one-off asset generator, NOT part of `npm run build`. The card only
changes when the product name or tagline does, so it is committed as a PNG and
this script exists to make that PNG reproducible rather than mysterious.

    python scripts/generate-og.py

Requires Pillow and fontTools (`pip install pillow fonttools`), and expects
`npm install` to have run — the brand fonts are read straight out of the
@fontsource packages in node_modules so the card can never drift from the type
the app actually ships. fontTools converts them from .woff to .ttf in a temp
directory because FreeType, which Pillow uses, cannot read web font formats.

Colours are the tokens from src/styles/tokens.css.
"""

from __future__ import annotations

import math
import tempfile
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "og.png"
FONTS = ROOT / "node_modules" / "@fontsource"

W, H = 1280, 720

# --- tokens.css -------------------------------------------------------------
SPACE = (5, 7, 11)
INK = (230, 237, 246)
INK_DIM = (163, 177, 196)
INK_MUTE = (124, 139, 161)
AMBER = (245, 165, 36)
CYAN = (56, 189, 248)

# The scene sits left of centre so the type block has uncluttered space. A
# rotated, squashed orbit of radius r spans r*0.956 horizontally and r*0.421
# vertically, so the outermost trace below reaches x≈714 — just short of the
# type column at 700, where the vignette has already taken hold.
SUN_X, SUN_Y = 265, H // 2 + 30
TILT = math.radians(-18)  # ecliptic seen near edge-on, as in the app
SQUASH = 0.30


def load_font(package: str, file_stem: str, size: int) -> ImageFont.FreeTypeFont:
    """Convert a @fontsource .woff to .ttf and load it at `size`."""
    src = FONTS / package / "files" / f"{file_stem}.woff"
    if not src.exists():
        raise SystemExit(f"Missing {src} — run `npm install` first.")
    cached = Path(tempfile.gettempdir()) / "orbix-og-fonts" / f"{file_stem}.ttf"
    if not cached.exists():
        cached.parent.mkdir(parents=True, exist_ok=True)
        font = TTFont(str(src))
        font.flavor = None  # drop the WOFF wrapper, leaving plain TrueType
        font.save(str(cached))
    return ImageFont.truetype(str(cached), size)


def tracked_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    tracking: float = 0.0,
) -> float:
    """Draw `text` with letter-spacing; returns the advance width."""
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=font, fill=fill)
        x += draw.textlength(char, font=font) + tracking
    return x - xy[0]


def radial_glow(
    layer: Image.Image,
    cx: float,
    cy: float,
    radius: float,
    stops: list[tuple[float, tuple[int, int, int], float]],
    steps: int = 240,
) -> None:
    """
    Paint a radial gradient by compositing concentric discs, outermost first.

    `stops` run centre to edge: t=0 is the centre, t=1 the outer radius. They
    must be sorted ascending — a descending list silently draws nothing, because
    no `t` ever falls inside a bracketing pair.
    """
    assert all(a[0] <= b[0] for a, b in zip(stops, stops[1:])), "stops must ascend"

    draw = ImageDraw.Draw(layer)
    for i in range(steps, 0, -1):
        t = i / steps
        # Locate `t` in the stop list and interpolate colour + alpha.
        for (t0, c0, a0), (t1, c1, a1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                k = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
                colour = tuple(round(c0[j] + (c1[j] - c0[j]) * k) for j in range(3))
                alpha = round((a0 + (a1 - a0) * k) * 255)
                break
        else:
            continue
        if alpha <= 0:
            continue
        r = radius * t
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*colour, alpha))


def project(orbit_radius: float, angle: float) -> tuple[float, float]:
    """Position on an inclined circular orbit, in image coordinates."""
    px, py = math.cos(angle) * orbit_radius, math.sin(angle) * orbit_radius * SQUASH
    return (
        SUN_X + px * math.cos(TILT) - py * math.sin(TILT),
        SUN_Y + px * math.sin(TILT) + py * math.cos(TILT),
    )


def main() -> None:
    card = Image.new("RGB", (W, H), SPACE)

    # --- starfield ----------------------------------------------------------
    # A deterministic LCG rather than `random`, so re-running produces a
    # byte-identical file and the commit diff stays empty when nothing changed.
    stars = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stars)
    seed = 1337

    def rnd() -> float:
        nonlocal seed
        seed = (seed * 1664525 + 1013904223) % (2**32)
        return seed / 2**32

    for _ in range(620):
        sx, sy, r = rnd() * W, rnd() * H, rnd() * 1.15 + 0.25
        alpha = round((0.18 + rnd() * 0.62) * 255)
        tint = (188, 216, 255) if rnd() > 0.9 else (255, 255, 255)
        sd.ellipse((sx - r, sy - r, sx + r, sy + r), fill=(*tint, alpha))
    card = Image.alpha_composite(card.convert("RGBA"), stars)

    # --- orbit traces -------------------------------------------------------
    orbits = [88, 134, 186, 240, 300, 362, 420, 470]
    pad = 600
    traces = Image.new("RGBA", (pad * 2, pad * 2), (0, 0, 0, 0))
    td = ImageDraw.Draw(traces)
    for i, r in enumerate(orbits):
        ry = r * SQUASH
        td.ellipse(
            (pad - r, pad - ry, pad + r, pad + ry),
            outline=(*CYAN, max(12, round((0.30 - i * 0.026) * 255))),
            width=3 if i == 2 else 2,  # Earth's trace reads as the primary one
        )
    traces = traces.rotate(-math.degrees(TILT), resample=Image.BICUBIC)
    card.alpha_composite(traces, (SUN_X - pad, SUN_Y - pad))

    # --- planets ------------------------------------------------------------
    # Angles are hand-placed rather than physical: they spread the discs around
    # the traces instead of letting several line up in the type column.
    planets = [
        (88, 2.55, 3.2, (168, 155, 140)),
        (134, 1.05, 4.6, (232, 195, 155)),
        (186, 3.70, 5.0, (90, 169, 230)),
        (240, 5.30, 4.0, (193, 68, 14)),
        (300, 1.60, 8.6, (216, 174, 109)),
        (362, 4.10, 7.6, (227, 211, 164)),
        (420, 3.05, 5.8, (143, 214, 224)),
        (470, 4.75, 5.6, (75, 108, 214)),
    ]
    for orbit_r, angle, size, colour in planets:
        px, py = project(orbit_r, angle)
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        # Opaque disc out to 0.4, then a soft halo fading to nothing at the rim.
        radial_glow(
            glow,
            px,
            py,
            size * 3.2,
            [(0.0, colour, 1.0), (0.40, colour, 1.0), (0.52, colour, 0.34), (1.0, colour, 0.0)],
            steps=110,
        )
        card.alpha_composite(glow)

    # --- sun ----------------------------------------------------------------
    sun = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # Corona: bright and warm at the centre, falling to nothing at the rim.
    radial_glow(
        sun,
        SUN_X,
        SUN_Y,
        180,
        [
            (0.0, (255, 246, 214), 0.95),
            (0.10, (255, 201, 110), 0.55),
            (0.32, (245, 165, 36), 0.20),
            (0.66, (255, 126, 40), 0.05),
            (1.0, (255, 110, 30), 0.0),
        ],
    )
    # Photosphere: white-hot core grading out to amber.
    radial_glow(
        sun,
        SUN_X,
        SUN_Y,
        30,
        [(0.0, (255, 253, 242), 1.0), (0.55, (255, 210, 122), 1.0), (1.0, (245, 165, 36), 1.0)],
        steps=80,
    )
    card.alpha_composite(sun)

    # --- vignette -----------------------------------------------------------
    # Darkens the right half so the type sits on near-solid ground and stays
    # legible however bright the scene behind it happens to be.
    veil = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    vd = ImageDraw.Draw(veil)
    start = int(W * 0.34)
    for col in range(start, W):
        t = (col - start) / (W - start)
        vd.line((col, 0, col, H), fill=(*SPACE, round(min(0.94, t * 1.9) * 255)))
    card.alpha_composite(veil)

    # --- type ---------------------------------------------------------------
    draw = ImageDraw.Draw(card)
    mono_500 = load_font("jetbrains-mono", "jetbrains-mono-latin-500-normal", 19)
    mono_700 = load_font("jetbrains-mono", "jetbrains-mono-latin-700-normal", 88)
    mono_foot = load_font("jetbrains-mono", "jetbrains-mono-latin-500-normal", 16)
    sans = load_font("ibm-plex-sans", "ibm-plex-sans-latin-400-normal", 24)

    tx = 700
    tracked_text(draw, (tx, 218), "INTERACTIVE SIMULATOR", mono_500, AMBER, tracking=5)

    width = tracked_text(draw, (tx, 276), "ORBIX", mono_700, INK, tracking=2)
    tracked_text(draw, (round(tx + width + 24), 276), "SOL", mono_700, CYAN, tracking=2)

    for i, line in enumerate(
        [
            "A real-time 3D model of the solar system —",
            "true relative orbital periods, procedural",
            "surfaces, and a live starfield.",
        ]
    ):
        draw.text((tx, 398 + i * 36), line, font=sans, fill=INK_DIM)

    draw.line((tx, 516, W - 92, 516), fill=(148, 163, 184), width=1)
    tracked_text(draw, (tx, 538), "8 PLANETS · 16 MOONS · WEBGL", mono_foot, INK_MUTE, tracking=3)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    card.convert("RGB").save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
