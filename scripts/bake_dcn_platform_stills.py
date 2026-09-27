#!/usr/bin/env python3
"""Bake DCN X (4:5) and YouTube (16:9) stills — demo-ready for judges.

X uses the real DCN template (chroma-key) over a sharp night train photo.
YouTube is true 16:9 with the same DCN logo chrome, dark plate, and punchy type.
Instagram still (dcn-ig.jpg) is left untouched.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/web/assets/demo"
TEMPLATE = OUT / "templates" / "template_post.png"
PEXELS = Path("/tmp/pexels-dl")

BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

GREEN = (0, 122, 63)
PILL = (851, 173, 1063, 216)  # city pill on 1080x1350 template
SAFE_X_X = 72  # matches bake_dcn_cards (W-120)/2 vibe; template chrome frames the card
SAFE_X_YT = 150


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def cover_crop(img: Image.Image, tw: int, th: int, bias_y: float = 0.20) -> Image.Image:
    """Cover-fit crop. bias_y 0=top, 0.5=center, 1=bottom."""
    sw, sh = img.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale + 0.5), int(sh * scale + 0.5)
    img = img.resize((nw, nh), Image.LANCZOS)
    left = max(0, (nw - tw) // 2)
    max_top = max(0, nh - th)
    top = int(max_top * bias_y)
    top = max(0, min(top, max_top))
    return img.crop((left, top, left + tw, top + th))


def punch_photo(img: Image.Image, contrast: float = 1.18, color: float = 1.12, sharp: float = 1.35) -> Image.Image:
    """Make demo photos pop — slight contrast/color + unsharp."""
    img = ImageEnhance.Contrast(img).enhance(contrast)
    img = ImageEnhance.Color(img).enhance(color)
    img = ImageEnhance.Sharpness(img).enhance(sharp)
    return img


def dark_plate(base: Image.Image, top_frac: float = 0.52, solid: int = 250) -> Image.Image:
    w, h = base.size
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    plate_top = int(h * top_frac)
    fade_end = int(h * (top_frac + 0.14))
    for y in range(plate_top, h):
        if y < fade_end:
            progress = (y - plate_top) / max(1, fade_end - plate_top)
            alpha = int(solid * (progress**0.55))
        else:
            alpha = solid
        od.line([(0, y), (w, y)], fill=(0, 0, 0, alpha))
    return Image.alpha_composite(base.convert("RGBA"), overlay)


def chroma_key(template_rgba: Image.Image, green_rgb=GREEN, tolerance: int = 45) -> Image.Image:
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


def erase_lorem(tpl: Image.Image, w: int, h: int) -> Image.Image:
    edit = tpl.copy()
    data = edit.load()
    erase_top = int(h * 0.60)
    erase_bot = int(h * 0.930)
    for y in range(erase_top, erase_bot):
        for x in range(0, w):
            r, g, b, a = data[x, y]
            is_red = r > 150 and g < 60 and b < 60
            if not is_red and max(r, g, b) > 60:
                data[x, y] = (0, 0, 0, 0)
    return edit


def swap_city_pill(tpl: Image.Image, city: str) -> Image.Image:
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


def wrap_lines(draw: ImageDraw.ImageDraw, text: str, fnt, max_w: int, max_lines: int | None = None) -> list[str]:
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


def fit_headline(draw, text: str, max_w: int, start: int, floor: int, max_lines: int = 3) -> tuple:
    size = start
    while size >= floor:
        f_h = font(BOLD, size)
        lines = wrap_lines(draw, text.upper(), f_h, max_w)
        widest = max((draw.textbbox((0, 0), ln, font=f_h)[2] for ln in lines), default=0)
        if widest <= max_w and len(lines) <= max_lines:
            return f_h, lines, size
        size -= 2
    f_h = font(BOLD, floor)
    return f_h, wrap_lines(draw, text.upper(), f_h, max_w, max_lines=max_lines), floor


def draw_text_block(
    canvas: Image.Image,
    headline: str,
    deck: str,
    *,
    safe_x: int,
    h_start: int,
    h_floor: int,
    d_size: int,
    zone_top_frac: float,
    zone_bot_frac: float,
    max_lines: int = 3,
) -> None:
    draw = ImageDraw.Draw(canvas)
    w, h = canvas.size
    max_w = w - (safe_x * 2)
    f_h, lines, h_size = fit_headline(draw, headline, max_w, h_start, h_floor, max_lines=max_lines)
    f_d = font(REG, d_size)
    line_h = int(h_size * 1.18)
    body = wrap_lines(draw, deck.strip(), f_d, max_w, max_lines=2) if deck else []
    body_h = int(d_size * 1.35)
    total = len(lines) * line_h + (14 if body else 0) + len(body) * body_h
    zone_top, zone_bot = int(h * zone_top_frac), int(h * zone_bot_frac)
    y = (zone_top + zone_bot) // 2 - total // 2
    for line in lines:
        bb = draw.textbbox((0, 0), line, font=f_h)
        tw = bb[2] - bb[0]
        x = max(safe_x, (w - tw) // 2)
        for dx, dy in ((3, 3), (2, 2), (-1, 1), (1, -1)):
            draw.text((x + dx, y + dy), line, font=f_h, fill=(0, 0, 0, 170))
        draw.text((x, y), line, font=f_h, fill=(255, 255, 255, 255))
        y += line_h
    if body:
        y += 14
        for line in body:
            bb = draw.textbbox((0, 0), line, font=f_d)
            tw = bb[2] - bb[0]
            x = max(safe_x, (w - tw) // 2)
            draw.text((x + 2, y + 2), line, font=f_d, fill=(0, 0, 0, 200))
            draw.text((x, y), line, font=f_d, fill=(255, 255, 255, 255))
            y += body_h


def extract_logo_stack(chrome: Image.Image) -> Image.Image:
    """Crop the DCN red badge + city pill from a 1080x1350 chrome PNG."""
    w, h = chrome.size
    # Logo + pill live in the top-right
    box = (int(w * 0.70), int(h * 0.02), w - 18, int(h * 0.20))
    region = chrome.crop(box)
    if region.mode != "RGBA":
        region = region.convert("RGBA")
    alpha = region.split()[-1]
    bbox = alpha.getbbox()
    if bbox:
        l, t, r, b = bbox
        pad = 4
        region = region.crop((max(0, l - pad), max(0, t - pad), min(region.size[0], r + pad), min(region.size[1], b + pad)))
    return region


def draw_footer_yt(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    w, h = canvas.size
    y = h - 70
    draw.line([(w // 2 - 90, y), (w // 2 + 90, y)], fill=(220, 20, 20, 255), width=4)
    f_d = font(BOLD, 22)
    label = "DCNNEWS.CO.IN"
    bb = draw.textbbox((0, 0), label, font=f_d)
    x = (w - (bb[2] - bb[0])) // 2
    draw.text((x, y + 14), label, font=f_d, fill=(255, 255, 255, 255))


def bake_x() -> None:
    """4:5 DCN Mumbai card — real template chrome over sharp Harbour Line still."""
    photo_path = PEXELS / "train-night-hi.jpg"
    if not photo_path.exists():
        photo_path = OUT / "mumbai.jpg"
    photo = punch_photo(Image.open(photo_path).convert("RGB"), contrast=1.22, color=1.15, sharp=1.45)
    w, h = 1080, 1350
    fitted = cover_crop(photo, w, h, bias_y=0.18)
    base = dark_plate(fitted, top_frac=0.54, solid=248)

    template = Image.open(TEMPLATE).convert("RGBA")
    if template.size != (w, h):
        template = template.resize((w, h), Image.LANCZOS)
    tpl = erase_lorem(template, w, h)
    tpl = swap_city_pill(tpl, "Mumbai")
    keyed = chroma_key(tpl)
    canvas = Image.alpha_composite(base, keyed)

    draw_text_block(
        canvas,
        "Harbour line late-night clearance",
        "A late-night clearance window is posted for the Harbour line.",
        safe_x=SAFE_X_X,
        h_start=64,
        h_floor=40,
        d_size=28,
        zone_top_frac=0.70,
        zone_bot_frac=0.92,
        max_lines=3,
    )
    dest = OUT / "dcn-x.jpg"
    canvas.convert("RGB").save(dest, quality=94, optimize=True)
    print(f"dcn-x.jpg 4:5 {canvas.size} safe_x={SAFE_X_X} src={photo_path.name}")


def bake_yt() -> None:
    """True 16:9 DCN Bengaluru YouTube still — sharp metro/transit night + logo chrome."""
    photo_path = PEXELS / "delhi-metro-hi.jpg"
    if not photo_path.exists():
        photo_path = PEXELS / "bus-night-hi.jpg"
    if not photo_path.exists():
        photo_path = OUT / "bengaluru.jpg"
    photo = punch_photo(Image.open(photo_path).convert("RGB"), contrast=1.18, color=1.10, sharp=1.50)
    photo = ImageEnhance.Brightness(photo).enhance(1.10)
    w, h = 1920, 1080
    # Keep faces/platform mid-frame for landscape
    fitted = cover_crop(photo, w, h, bias_y=0.40)
    canvas = dark_plate(fitted, top_frac=0.50, solid=248)

    chrome_path = OUT / "templates" / "template_post_chrome_bengaluru.png"
    if not chrome_path.exists():
        chrome_path = OUT / "templates" / "template_post_chrome_mumbai.png"
    chrome = Image.open(chrome_path).convert("RGBA")
    logo = extract_logo_stack(chrome)
    target_w = 360
    scale = target_w / logo.size[0]
    logo = logo.resize((target_w, max(1, int(logo.size[1] * scale))), Image.LANCZOS)
    canvas.paste(logo, (w - logo.size[0] - 44, 32), logo)

    draw_text_block(
        canvas,
        "Whitefield feeders add a late last trip",
        "DCN Bengaluru  ·  YouTube",
        safe_x=SAFE_X_YT,
        h_start=62,
        h_floor=38,
        d_size=28,
        zone_top_frac=0.56,
        zone_bot_frac=0.90,
        max_lines=2,
    )
    draw_footer_yt(canvas)
    dest = OUT / "dcn-yt.jpg"
    canvas.convert("RGB").save(dest, quality=94, optimize=True)
    print(f"dcn-yt.jpg 16:9 {canvas.size} safe_x={SAFE_X_YT} src={photo_path.name}")


def main() -> None:
    if not TEMPLATE.exists():
        raise SystemExit(f"missing DCN template: {TEMPLATE}")
    bake_x()
    bake_yt()


if __name__ == "__main__":
    main()
