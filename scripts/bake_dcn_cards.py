#!/usr/bin/env python3
"""Bake DCN Hyderabad-style Telegram news cards for Cutline demo tips.

Matches /workspace/dcn-hyd-card-fix/auto_post.py:
  photo cover-crop → dark plate → chroma_key green (0,122,63) on real
  template_post.png → composite → draw ALL CAPS headline + body deck.

Does NOT redraw the DCN logo or footer — those come from the real template.
City pill text is swapped per card (template ships with HYDERABAD).

Run once; demo serves the baked JPGs — never call Gemini per request.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/web/assets/demo"
TEMPLATE = OUT / "templates" / "template_post.png"
SRC = Path("/tmp/pexels-dl")
MANIFEST = OUT / "dcn-card-sources.json"

W, H = 1080, 1350
GREEN = (0, 122, 63)
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Pill region on template_post.png (black capsule under red DCN badge)
PILL = (851, 173, 1063, 216)


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def cover_crop(img: Image.Image, tw: int, th: int) -> Image.Image:
    """Cover-fit crop biased toward the upper third (auto_post.py)."""
    sw, sh = img.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    img = img.resize((nw, nh), Image.LANCZOS)
    left = (nw - tw) // 2
    max_top = max(0, nh - th)
    top = int(max_top * 0.15)
    return img.crop((left, top, left + tw, top + th))


def dark_plate(base: Image.Image) -> Image.Image:
    """Strong dark bottom plate with soft fade — newspaper IG/Telegram card style."""
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


def chroma_key(template_rgba: Image.Image, green_rgb=GREEN, tolerance=45) -> Image.Image:
    """Replace green pixels with transparency so the photo shows through."""
    data = template_rgba.load()
    tw, th = template_rgba.size
    gr, gg, gb = green_rgb
    for y in range(th):
        for x in range(tw):
            r, g, b, a = data[x, y]
            if (
                abs(r - gr) < tolerance
                and abs(g - gg) < tolerance
                and abs(b - gb) < tolerance
                and g > r + 15
                and g > b + 15
            ):
                data[x, y] = (r, g, b, 0)
    return template_rgba


def erase_lorem(tpl: Image.Image) -> Image.Image:
    """Blank placeholder Lorem ipsum in the text zone; keep red divider pixels."""
    edit = tpl.copy()
    data = edit.load()
    erase_top = int(H * 0.60)
    erase_bot = int(H * 0.930)
    for y in range(erase_top, erase_bot):
        for x in range(0, W):
            r, g, b, a = data[x, y]
            is_red = r > 150 and g < 60 and b < 60
            if not is_red and max(r, g, b) > 60:
                data[x, y] = (0, 0, 0, 0)
    return edit


def swap_city_pill(tpl: Image.Image, city: str) -> Image.Image:
    """Replace HYDERABAD pill text with the demo city name (keep real pill chrome)."""
    edit = tpl.copy()
    x0, y0, x1, y1 = PILL
    draw = ImageDraw.Draw(edit)
    draw.rounded_rectangle([x0 + 2, y0 + 2, x1 - 2, y1 - 2], radius=18, fill=(0, 0, 0, 255))
    label = city.upper()
    f_city = font(BOLD, 22)
    bb = draw.textbbox((0, 0), label, font=f_city)
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    cx = x0 + (x1 - x0 - tw) // 2
    cy = y0 + (y1 - y0 - th) // 2 - 1
    draw.text((cx, cy), label, font=f_city, fill=(255, 255, 255, 255))
    return edit


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


def draw_headline_deck(composite: Image.Image, headline: str, deck: str) -> None:
    """Draw ALL CAPS headline + body deck only (logo/footer already on template)."""
    draw = ImageDraw.Draw(composite)
    f_h = font(BOLD, 62)
    f_d = font(REG, 28)
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
        draw.text((x, y), line, font=f_h, fill=(255, 255, 255, 255))

    if body:
        by = start_y + len(lines) * line_h + 18
        for i, line in enumerate(body):
            bb = draw.textbbox((0, 0), line, font=f_d)
            x = (W - (bb[2] - bb[0])) // 2
            y = by + i * body_h
            draw.text((x + 3, y + 3), line, font=f_d, fill=(0, 0, 0, 255))
            draw.text((x, y), line, font=f_d, fill=(255, 255, 255, 255))


def bake(
    photo: Path,
    city: str,
    headline: str,
    deck: str,
    out_card: Path,
    out_base: Path | None,
    template: Image.Image,
) -> dict:
    img = Image.open(photo).convert("RGB")
    fitted = cover_crop(img, W, H)
    if out_base:
        still = fitted.crop((0, 80, W, 80 + 720)).resize((1080, 720), Image.LANCZOS)
        still.save(out_base, quality=90, optimize=True)

    base = dark_plate(fitted)
    tpl = erase_lorem(template)
    tpl = swap_city_pill(tpl, city)
    keyed = chroma_key(tpl)
    composite = Image.alpha_composite(base, keyed)
    draw_headline_deck(composite, headline, deck)
    composite.convert("RGB").save(out_card, quality=92, optimize=True)
    return {
        "city": city,
        "photo": str(photo),
        "pexels_hint": photo.name,
        "card": str(out_card.relative_to(ROOT)),
        "base": str(out_base.relative_to(ROOT)) if out_base else None,
        "headline": headline,
        "template": str(TEMPLATE.relative_to(ROOT)),
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
    if not TEMPLATE.exists():
        raise SystemExit(f"missing real DCN template: {TEMPLATE}")
    for c in CARDS:
        if not c["photo"].exists():
            raise SystemExit(f"missing photo: {c['photo']}")

    OUT.mkdir(parents=True, exist_ok=True)
    template = Image.open(TEMPLATE).convert("RGBA")
    if template.size != (W, H):
        template = template.resize((W, H), Image.LANCZOS)
    print(f"template {TEMPLATE} {template.size}")

    records = []
    for c in CARDS:
        card_path = OUT / f"{c['slug']}-card.jpg"
        base_path = OUT / f"{c['slug']}.jpg"
        tpl = template.copy()
        rec = bake(c["photo"], c["city"], c["headline"], c["deck"], card_path, base_path, tpl)
        rec["pexels"] = c["pexels"]
        records.append(rec)
        print(f"baked {c['slug']}: {card_path.name} + {base_path.name}")
    MANIFEST.write_text(json.dumps(records, indent=2) + "\n")
    print("manifest", MANIFEST)


if __name__ == "__main__":
    main()
