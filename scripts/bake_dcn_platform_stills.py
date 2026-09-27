#!/usr/bin/env python3
"""Bake DCN X (4:5) and YouTube (16:9) stills with the real DCN logo.

Headlines stay fully inside a safe inset (no left/right clipping).
Instagram still (dcn-ig.jpg) is left untouched.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/web/assets/demo"
CHROME_MUMBAI = OUT / "templates" / "template_post_chrome_mumbai.png"
CHROME_BLR = OUT / "templates" / "template_post_chrome_bengaluru.png"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Safe horizontal inset from each edge (px). Keeps glyphs off the crop edge.
SAFE_X = 110


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def crop_opaque(img: Image.Image, box: tuple[int, int, int, int], pad: int = 4) -> Image.Image:
    region = img.crop(box)
    if region.mode != "RGBA":
        region = region.convert("RGBA")
    alpha = region.split()[-1]
    bbox = alpha.getbbox()
    if not bbox:
        return region
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(region.size[0], r + pad)
    b = min(region.size[1], b + pad)
    return region.crop((l, t, r, b))


def cover_crop(img: Image.Image, tw: int, th: int) -> Image.Image:
    sw, sh = img.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    img = img.resize((nw, nh), Image.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return img.crop((left, top, left + tw, top + th))


def dark_plate(base: Image.Image, top_frac: float = 0.52) -> Image.Image:
    w, h = base.size
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    plate_top = int(h * top_frac)
    fade_end = int(h * (top_frac + 0.14))
    solid = 245
    for y in range(plate_top, h):
        if y < fade_end:
            progress = (y - plate_top) / max(1, fade_end - plate_top)
            alpha = int(solid * (progress**0.55))
        else:
            alpha = solid
        od.line([(0, y), (w, y)], fill=(0, 0, 0, alpha))
    return Image.alpha_composite(base.convert("RGBA"), overlay)


def paste_logo(canvas: Image.Image, chrome: Image.Image, scale: float = 0.92) -> None:
    w, h = chrome.size
    logo = crop_opaque(chrome, (int(w * 0.72), 0, w, int(h * 0.22)))
    nw = max(1, int(logo.size[0] * scale))
    nh = max(1, int(logo.size[1] * scale))
    logo = logo.resize((nw, nh), Image.LANCZOS)
    canvas.paste(logo, (canvas.size[0] - nw - 36, 28), logo)


def draw_footer(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    w, h = canvas.size
    y = h - 78
    draw.line([(w // 2 - 70, y), (w // 2 + 70, y)], fill=(220, 20, 20, 255), width=3)
    f_d = font(BOLD, 20)
    label = "WWW.DCNNEWS.CO.IN"
    bb = draw.textbbox((0, 0), label, font=f_d)
    x = (w - (bb[2] - bb[0])) // 2
    draw.text((x, y + 16), label, font=f_d, fill=(255, 255, 255, 255))


def wrap_lines(draw: ImageDraw.ImageDraw, text: str, fnt, max_w: int) -> list[str]:
    words = text.upper().split()
    lines: list[str] = []
    cur = ""
    for word in words:
        test = (cur + " " + word).strip()
        if draw.textbbox((0, 0), test, font=fnt)[2] <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def fit_headline(draw: ImageDraw.ImageDraw, headline: str, max_w: int, start: int, floor: int) -> tuple[ImageFont.FreeTypeFont, list[str], int]:
    """Shrink font until every wrapped line fits inside max_w."""
    size = start
    while size >= floor:
        f_h = font(BOLD, size)
        lines = wrap_lines(draw, headline, f_h, max_w)
        widest = max((draw.textbbox((0, 0), ln, font=f_h)[2] for ln in lines), default=0)
        if widest <= max_w and len(lines) <= 3:
            return f_h, lines, size
        size -= 2
    f_h = font(BOLD, floor)
    return f_h, wrap_lines(draw, headline, f_h, max_w), floor


def draw_centered_lines(draw: ImageDraw.ImageDraw, lines: list[str], fnt, y: int, line_h: int, fill=(255, 255, 255, 255)) -> int:
    w = draw.im.size[0] if hasattr(draw, "im") else None
    # ImageDraw has .im on some versions; fall back via textbbox centering with canvas width passed in
    return y  # placeholder — use draw_copy below


def draw_copy(canvas: Image.Image, headline: str, deck: str, h_start: int, d_size: int, y_frac: float = 0.62) -> None:
    draw = ImageDraw.Draw(canvas)
    max_w = canvas.size[0] - (SAFE_X * 2)
    f_h, lines, h_size = fit_headline(draw, headline, max_w, h_start, 28)
    f_d = font(REG, d_size)
    line_h = int(h_size * 1.2)
    y = int(canvas.size[1] * y_frac)
    for line in lines:
        bb = draw.textbbox((0, 0), line, font=f_h)
        tw = bb[2] - bb[0]
        x = max(SAFE_X, (canvas.size[0] - tw) // 2)
        # Guard: never let glyph start left of SAFE_X
        if x < SAFE_X:
            x = SAFE_X
        draw.text((x + 2, y + 2), line, font=f_h, fill=(0, 0, 0, 160))
        draw.text((x, y), line, font=f_h, fill=(255, 255, 255, 255))
        y += line_h
    if deck:
        y += 8
        bb = draw.textbbox((0, 0), deck, font=f_d)
        tw = bb[2] - bb[0]
        x = max(SAFE_X, (canvas.size[0] - tw) // 2)
        draw.text((x, y), deck, font=f_d, fill=(255, 255, 255, 220))


def bake_x() -> None:
    photo = Image.open(OUT / "mumbai.jpg").convert("RGB")
    chrome = Image.open(CHROME_MUMBAI).convert("RGBA")
    w, h = 1080, 1350
    fitted = cover_crop(photo, w, h)
    canvas = dark_plate(fitted, top_frac=0.52)
    paste_logo(canvas, chrome, scale=0.95)
    draw_copy(
        canvas,
        "Harbour line late-night clearance window",
        "A late-night clearance window is posted for the Harbour line.",
        h_start=46,
        d_size=22,
        y_frac=0.60,
    )
    draw_footer(canvas)
    dest = OUT / "dcn-x.jpg"
    canvas.convert("RGB").save(dest, quality=92, optimize=True)
    print(f"dcn-x.jpg 4:5 {canvas.size} safe_x={SAFE_X}")


def bake_yt() -> None:
    photo = Image.open(OUT / "bengaluru.jpg").convert("RGB")
    chrome = Image.open(CHROME_BLR).convert("RGBA")
    w, h = 1920, 1080
    fitted = cover_crop(photo, w, h)
    canvas = dark_plate(fitted, top_frac=0.50)
    paste_logo(canvas, chrome, scale=1.2)
    draw_copy(
        canvas,
        "Whitefield feeders add a late last trip",
        "DCN  ·  YouTube",
        h_start=52,
        d_size=22,
        y_frac=0.55,
    )
    draw_footer(canvas)
    dest = OUT / "dcn-yt.jpg"
    canvas.convert("RGB").save(dest, quality=92, optimize=True)
    print(f"dcn-yt.jpg 16:9 {canvas.size} safe_x={SAFE_X}")


def main() -> None:
    if not CHROME_MUMBAI.exists() or not CHROME_BLR.exists():
        raise SystemExit("missing DCN chrome templates")
    bake_x()
    bake_yt()


if __name__ == "__main__":
    main()
