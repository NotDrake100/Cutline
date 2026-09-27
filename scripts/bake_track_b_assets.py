#!/usr/bin/env python3
"""Bake Track B demo stills: matching city photos + DCN-logo X/YouTube frames."""
from __future__ import annotations

import io
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/web/assets/demo"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Credit-safe Pexels (direct image). Tips must match the story, not a random apartment.
PHOTOS = {
    "hyderabad.jpg": "https://images.pexels.com/photos/30425142/pexels-photo-30425142.jpeg?auto=compress&cs=tinysrgb&w=1600",
    "pune-metro.jpg": "https://images.pexels.com/photos/14981613/pexels-photo-14981613.jpeg?auto=compress&cs=tinysrgb&w=1600",
}


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def fetch(url: str) -> Image.Image:
    req = urllib.request.Request(url, headers={"User-Agent": "CutlineDemo/1.0"})
    with urllib.request.urlopen(req, timeout=40) as res:
        data = res.read()
    return Image.open(io.BytesIO(data)).convert("RGB")


def cover(img: Image.Image, tw: int, th: int) -> Image.Image:
    sw, sh = img.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    img = img.resize((nw, nh), Image.LANCZOS)
    left = (nw - tw) // 2
    top = max(0, (nh - th) // 5)
    return img.crop((left, top, left + tw, top + th))


def draw_dcn_mark(draw: ImageDraw.ImageDraw, x: int, y: int, scale: float = 1.0, city: str = "PUNE") -> tuple[int, int]:
    """Stacked DCN Daily City News mark from the live IG card."""
    w = int(168 * scale)
    row_h = int(36 * scale)
    dcn_h = int(48 * scale)
    city_h = int(32 * scale)
    total_h = dcn_h + row_h * 3 + city_h
    # DCN on red
    draw.rectangle((x, y, x + w, y + dcn_h), fill=(227, 6, 19))
    f = font(BOLD, int(28 * scale))
    tw = draw.textlength("DCN", font=f)
    draw.text((x + (w - tw) / 2, y + int(8 * scale)), "DCN", font=f, fill=(255, 255, 255))
    # DAILY CITY NEWS on white
    labels = ("DAILY", "CITY", "NEWS")
    f2 = font(BOLD, int(16 * scale))
    for i, lab in enumerate(labels):
        top = y + dcn_h + i * row_h
        draw.rectangle((x, top, x + w, top + row_h), fill=(255, 255, 255))
        tw = draw.textlength(lab, font=f2)
        draw.text((x + (w - tw) / 2, top + int(8 * scale)), lab, font=f2, fill=(10, 10, 10))
    # city on black
    top = y + dcn_h + 3 * row_h
    draw.rectangle((x, top, x + w, top + city_h), fill=(10, 10, 10))
    f3 = font(BOLD, int(16 * scale))
    tw = draw.textlength(city, font=f3)
    draw.text((x + (w - tw) / 2, top + int(6 * scale)), city, font=f3, fill=(255, 255, 255))
    return w, total_h


def save_jpeg(img: Image.Image, path: Path, quality: int = 88) -> None:
    img.convert("RGB").save(path, "JPEG", quality=quality, optimize=True)
    print(f"wrote {path} ({path.stat().st_size} bytes)")


def bake_logo() -> Image.Image:
    img = Image.new("RGB", (400, 520), (10, 10, 10))
    draw = ImageDraw.Draw(img)
    draw_dcn_mark(draw, 40, 40, scale=1.9, city="PUNE")
    img.save(OUT / "dcn-logo.png", "PNG")
    print(f"wrote {OUT / 'dcn-logo.png'}")
    return img


def bake_x_card() -> None:
    w, h = 1080, 1350  # IG-like 4:5
    img = Image.new("RGB", (w, h), (10, 10, 10))
    draw = ImageDraw.Draw(img)
    mw, _ = draw_dcn_mark(draw, w - 220, 48, scale=1.05, city="PUNE")
    draw.rectangle((48, 48, 48 + 120, 88), fill=(255, 255, 255))
    draw.text((64, 56), "DCN · X", font=font(BOLD, 22), fill=(10, 10, 10))
    lines = ["Harbour line holds", "a late-night", "clearance window."]
    f = font(BOLD, 64)
    y = 520
    for line in lines:
        draw.text((56, y), line, font=f, fill=(255, 255, 255))
        y += 86
    draw.line((56, y + 16, 220, y + 16), fill=(227, 6, 19), width=4)
    draw.text((56, h - 90), "dcnews.co.in", font=font(REG, 28), fill=(200, 200, 200))
    save_jpeg(img, OUT / "dcn-x.jpg")


def bake_yt_card() -> None:
    w, h = 1920, 1080  # 16:9
    img = Image.new("RGB", (w, h), (10, 10, 10))
    draw = ImageDraw.Draw(img)
    draw_dcn_mark(draw, w - 250, 48, scale=1.15, city="PUNE")
    draw.rectangle((56, 48, 56 + 200, 96), fill=(255, 255, 255))
    draw.text((76, 58), "DCN · YouTube", font=font(BOLD, 26), fill=(10, 10, 10))
    lines = ["Whitefield feeders add", "a late last trip."]
    f = font(BOLD, 72)
    y = 400
    for line in lines:
        draw.text((64, y), line, font=f, fill=(255, 255, 255))
        y += 96
    draw.line((64, y + 12, 280, y + 12), fill=(227, 6, 19), width=5)
    draw.text((64, h - 80), "16:9 · dcnews.co.in", font=font(REG, 28), fill=(200, 200, 200))
    save_jpeg(img, OUT / "dcn-yt.jpg")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, url in PHOTOS.items():
        img = cover(fetch(url), 1600, 1066)
        save_jpeg(img, OUT / name, quality=86)
    bake_logo()
    bake_x_card()
    bake_yt_card()


if __name__ == "__main__":
    main()
