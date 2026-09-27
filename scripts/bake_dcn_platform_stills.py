#!/usr/bin/env python3
"""Bake DCN X (4:5) and YouTube (16:9) stills with the real DCN logo.

Replaces the lime placeholder badges on dcn-x.jpg / dcn-yt.jpg.
Instagram still (dcn-ig.jpg) is left untouched.
"""
from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/web/assets/demo"
CHROME_MUMBAI = OUT / "templates" / "template_post_chrome_mumbai.png"
CHROME_BLR = OUT / "templates" / "template_post_chrome_bengaluru.png"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


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


def draw_copy(canvas: Image.Image, headline: str, deck: str, h_size: int, d_size: int) -> None:
    draw = ImageDraw.Draw(canvas)
    f_h = font(BOLD, h_size)
    f_d = font(REG, d_size)
    max_w = canvas.size[0] - 160
    lines = wrap_lines(draw, headline, f_h, max_w)
    line_h = int(h_size * 1.2)
    total = len(lines) * line_h + (int(d_size * 1.6) if deck else 0)
    y = int(canvas.size[1] * 0.62)
    for line in lines:
        bb = draw.textbbox((0, 0), line, font=f_h)
        x = (canvas.size[0] - (bb[2] - bb[0])) // 2
        draw.text((x + 2, y + 2), line, font=f_h, fill=(0, 0, 0, 160))
        draw.text((x, y), line, font=f_h, fill=(255, 255, 255, 255))
        y += line_h
    if deck:
        y += 6
        bb = draw.textbbox((0, 0), deck, font=f_d)
        x = (canvas.size[0] - (bb[2] - bb[0])) // 2
        draw.text((x, y), deck, font=f_d, fill=(255, 255, 255, 220))


def bake_x() -> None:
    src = OUT / "mumbai-card.jpg"
    dest = OUT / "dcn-x.jpg"
    shutil.copyfile(src, dest)
    print(f"dcn-x.jpg ← {src.name} ({Image.open(dest).size})")


def bake_yt() -> None:
    photo = Image.open(OUT / "bengaluru.jpg").convert("RGB")
    chrome = Image.open(CHROME_BLR).convert("RGBA")
    w, h = 1920, 1080
    fitted = cover_crop(photo, w, h)
    canvas = dark_plate(fitted, top_frac=0.50)
    paste_logo(canvas, chrome, scale=1.2)
    draw = ImageDraw.Draw(canvas)
    f_h = font(BOLD, 48)
    for i, line in enumerate(["WHITEFIELD FEEDERS", "ADD A LATE LAST TRIP"]):
        bb = draw.textbbox((0, 0), line, font=f_h)
        x = (1920 - (bb[2] - bb[0])) // 2
        y = 620 + i * 58
        draw.text((x + 2, y + 2), line, font=f_h, fill=(0, 0, 0, 160))
        draw.text((x, y), line, font=f_h, fill=(255, 255, 255, 255))
    f_d = font(REG, 22)
    deck = "DCN  ·  YouTube"
    bb = draw.textbbox((0, 0), deck, font=f_d)
    draw.text(((1920 - (bb[2] - bb[0])) // 2, 744), deck, font=f_d, fill=(255, 255, 255, 220))
    draw_footer(canvas)
    dest = OUT / "dcn-yt.jpg"
    canvas.convert("RGB").save(dest, quality=92, optimize=True)
    print(f"dcn-yt.jpg 16:9 {canvas.size}")


def main() -> None:
    if not CHROME_MUMBAI.exists() or not CHROME_BLR.exists():
        raise SystemExit("missing DCN chrome templates")
    bake_x()
    bake_yt()


if __name__ == "__main__":
    main()
