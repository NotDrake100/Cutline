#!/usr/bin/env python3
"""Bake DCN Hyderabad-style Telegram news cards for Cutline demo tips.

Layout matches /workspace/dcn-hyd-card-fix/after.png + auto_post.py plate:
  1080x1350, dark bottom plate ~56–68%H, ALL CAPS headline ~62px, deck,
  red DCN logo + city pill top-right, red divider + dcnnews.co.in footer.

Run once; demo serves the baked JPGs — never call Gemini per request.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/web/assets/demo"
SRC = Path("/tmp/pexels-dl")
MANIFEST = OUT / "dcn-card-sources.json"

W, H = 1080, 1350
DCN_RED = (220, 20, 40)
NEWS_YELLOW = (255, 214, 0)
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)

BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
LOGO_BOLD = "/usr/share/fonts/truetype/sand-box/google/Montserrat Alternates/MontserratAlternates-ExtraBold.ttf"
LOGO_SEMI = "/usr/share/fonts/truetype/sand-box/google/Montserrat Alternates/MontserratAlternates-Bold.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def cover_crop(img: Image.Image, tw: int, th: int) -> Image.Image:
    """Cover-fit, bias upper so faces/subject sit above the plate."""
    sw, sh = img.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    img = img.resize((nw, nh), Image.LANCZOS)
    left = (nw - tw) // 2
    max_top = max(0, nh - th)
    top = int(max_top * 0.15)
    return img.crop((left, top, left + tw, top + th))


def dark_plate(base: Image.Image) -> Image.Image:
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    plate_top = int(H * 0.56)
    fade_end = int(H * 0.68)
    solid = 245
    for y in range(plate_top, H):
        if y < fade_end:
            progress = (y - plate_top) / max(1, fade_end - plate_top)
            alpha = int(solid * (progress ** 0.55))
        else:
            alpha = solid
        od.line([(0, y), (W, y)], fill=(0, 0, 0, alpha))
    return Image.alpha_composite(base.convert("RGBA"), overlay)


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt, max_w: int, max_lines: int | None = None) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for word in words:
        test = (cur + " " + word).strip()
        if draw.textbbox((0, 0), test, font=fnt)[2] <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            if max_lines and len(lines) >= max_lines:
                return lines
            cur = word
    if cur and (not max_lines or len(lines) < max_lines):
        lines.append(cur)
    return lines[:max_lines] if max_lines else lines


def draw_logo(draw: ImageDraw.ImageDraw, city: str) -> None:
    # Red badge top-right — matches after.png (~212x168 at x≈852,y≈16)
    bx, by, bw, bh = 852, 16, 212, 168
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=10, fill=DCN_RED)
    f_dcn = font(LOGO_BOLD if Path(LOGO_BOLD).exists() else BOLD, 64)
    f_sub = font(LOGO_SEMI if Path(LOGO_SEMI).exists() else BOLD, 18)
    f_news = font(LOGO_BOLD if Path(LOGO_BOLD).exists() else BOLD, 28)
    # DCN
    bb = draw.textbbox((0, 0), "DCN", font=f_dcn)
    draw.text((bx + (bw - (bb[2] - bb[0])) // 2, by + 8), "DCN", font=f_dcn, fill=WHITE)
    # DAILY CITY
    bb = draw.textbbox((0, 0), "DAILY CITY", font=f_sub)
    draw.text((bx + (bw - (bb[2] - bb[0])) // 2, by + 78), "DAILY CITY", font=f_sub, fill=WHITE)
    # NEWS (yellow)
    bb = draw.textbbox((0, 0), "NEWS", font=f_news)
    draw.text((bx + (bw - (bb[2] - bb[0])) // 2, by + 104), "NEWS", font=f_news, fill=NEWS_YELLOW)

    # City pill under logo
    f_city = font(BOLD, 22)
    label = city.upper()
    cbb = draw.textbbox((0, 0), label, font=f_city)
    cw = (cbb[2] - cbb[0]) + 36
    ch = 36
    cx = bx + bw - cw
    cy = by + bh - 6
    # white outline ring
    draw.rounded_rectangle([cx - 2, cy - 2, cx + cw + 2, cy + ch + 2], radius=ch // 2 + 2, fill=WHITE)
    draw.rounded_rectangle([cx, cy, cx + cw, cy + ch], radius=ch // 2, fill=BLACK)
    draw.text((cx + (cw - (cbb[2] - cbb[0])) // 2, cy + 6), label, font=f_city, fill=WHITE)


def draw_text_block(draw: ImageDraw.ImageDraw, headline: str, deck: str) -> None:
    f_h = font(BOLD, 62)
    f_d = font(REG, 28)
    f_f = font(BOLD, 18)
    max_w = W - 120
    lines = wrap(draw, headline.upper().strip(), f_h, max_w)
    body = wrap(draw, deck.strip(), f_d, max_w, max_lines=2) if deck else []

    line_h, body_h = 74, 38
    total_h = len(lines) * line_h + (18 if body else 0) + len(body) * body_h
    zone_top, zone_bot = int(H * 0.72), int(H * 0.92)
    start_y = (zone_top + zone_bot) // 2 - total_h // 2

    for i, line in enumerate(lines):
        bb = draw.textbbox((0, 0), line, font=f_h)
        x = (W - (bb[2] - bb[0])) // 2
        y = start_y + i * line_h
        for dx, dy in ((3, 3), (2, 2), (-1, 1), (1, -1)):
            draw.text((x + dx, y + dy), line, font=f_h, fill=(0, 0, 0, 160))
        draw.text((x, y), line, font=f_h, fill=WHITE)

    if body:
        by = start_y + len(lines) * line_h + 18
        for i, line in enumerate(body):
            bb = draw.textbbox((0, 0), line, font=f_d)
            x = (W - (bb[2] - bb[0])) // 2
            y = by + i * body_h
            draw.text((x + 3, y + 3), line, font=f_d, fill=(0, 0, 0, 255))
            draw.text((x, y), line, font=f_d, fill=WHITE)

    # Red divider + footer (matches after.png ~y=1242)
    ly = 1242
    draw.line([(340, ly), (740, ly)], fill=DCN_RED, width=3)
    footer = "DCNNEWS.CO.IN"
    # small globe disc
    gx, gy, gr = W // 2 - 90, ly + 22, 10
    draw.ellipse([gx - gr, gy - gr, gx + gr, gy + gr], fill=DCN_RED)
    draw.ellipse([gx - gr + 3, gy - gr + 3, gx + gr - 3, gy + gr - 3], outline=WHITE, width=1)
    fbb = draw.textbbox((0, 0), footer, font=f_f)
    draw.text((gx + 18, gy - (fbb[3] - fbb[1]) // 2 - 1), footer, font=f_f, fill=WHITE)


def bake(photo: Path, city: str, headline: str, deck: str, out_card: Path, out_base: Path | None) -> dict:
    img = Image.open(photo).convert("RGB")
    fitted = cover_crop(img, W, H)
    if out_base:
        # also save a landscape-ish article still (1080x720 crop from fitted upper)
        still = fitted.crop((0, 80, W, 80 + 720)).resize((1080, 720), Image.LANCZOS)
        still.save(out_base, quality=90, optimize=True)
    card = dark_plate(fitted)
    draw = ImageDraw.Draw(card, "RGBA")
    draw_logo(draw, city)
    draw_text_block(draw, headline, deck)
    card.convert("RGB").save(out_card, quality=92, optimize=True)
    return {
        "city": city,
        "photo": str(photo),
        "pexels_hint": photo.name,
        "card": str(out_card.relative_to(ROOT)),
        "base": str(out_base.relative_to(ROOT)) if out_base else None,
        "headline": headline,
    }


CARDS = [
    {
        "city": "Pune",
        "photo": SRC / "bus-night.jpg",
        "pexels": "https://www.pexels.com/photo/late-night-bus-ride-in-mumbai-city-34105075/",
        "headline": "Overnight bus routes go to a vote",
        "deck": "Pune councillors take up the overnight bus plan this week.",
        "slug": "pune",
    },
    {
        "city": "Mumbai",
        "photo": SRC / "train-night.jpg",
        "pexels": "https://www.pexels.com/photo/dimly-lit-urban-train-station-at-night-35457284/",
        "headline": "Harbour line late-night clearance",
        "deck": "A late-night clearance window is posted for the Harbour line.",
        "slug": "mumbai",
    },
    {
        "city": "Bengaluru",
        "photo": SRC / "bus-passengers.jpg",
        "pexels": "https://www.pexels.com/photo/candid-photo-of-passengers-sitting-inside-a-bus-19244393/",
        "headline": "Whitefield feeders add late last trip",
        "deck": "A late last trip is added on Whitefield feeders after the metro.",
        "slug": "bengaluru",
    },
    {
        "city": "Delhi",
        "photo": SRC / "delhi-metro.jpg",
        "pexels": "https://www.pexels.com/photo/people-in-metro-station-14981613/",
        "headline": "Yellow Line work shifts to Monday",
        "deck": "Weekend engineering work on the Yellow Line moves to early Monday.",
        "slug": "delhi",
    },
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    records = []
    for c in CARDS:
        photo = c["photo"]
        if not photo.exists():
            raise SystemExit(f"missing photo: {photo}")
        card_path = OUT / f"{c['slug']}-card.jpg"
        base_path = OUT / f"{c['slug']}.jpg"
        rec = bake(photo, c["city"], c["headline"], c["deck"], card_path, base_path)
        rec["pexels"] = c["pexels"]
        # also copy card over as primary still alias used by older paths? keep separate
        records.append(rec)
        print(f"baked {c['slug']}: {card_path.name} + {base_path.name}")
    MANIFEST.write_text(json.dumps(records, indent=2) + "\n")
    print("manifest", MANIFEST)


if __name__ == "__main__":
    main()
