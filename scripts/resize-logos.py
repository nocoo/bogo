#!/usr/bin/env python3
"""Generate Bogo application assets from the adopted family masters.

Run with: uv run --with pillow python scripts/resize-logos.py
The transparent source, square tile and rounded tile share one composition.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "logo.png"
BRAND = ROOT / "assets" / "brand"


def save_png(image: Image.Image, relative: str, size: int) -> None:
    destination = ROOT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.resize((size, size), Image.Resampling.LANCZOS).save(destination, "PNG")
    print(f"  {relative}: {size}x{size}")


def main() -> None:
    foreground = Image.open(SOURCE).convert("RGBA")
    square = Image.open(BRAND / "icon.png").convert("RGBA")
    rounded = Image.open(BRAND / "icon-rounded.png").convert("RGBA")
    if foreground.size != (2048, 2048) or square.size != foreground.size or rounded.size != foreground.size:
        raise ValueError("All approved brand masters must share their 2048-square framing")
    if square.getchannel("A").getextrema() != (255, 255) or rounded.getpixel((0, 0))[3] != 0:
        raise ValueError("Square and rounded master roles are inconsistent")
    save_png(rounded, "packages/ui/public/logo-24.png", 24)
    save_png(rounded, "packages/ui/public/logo-80.png", 80)
    save_png(square, "packages/ui/public/favicon.png", 32)


if __name__ == "__main__":
    main()
