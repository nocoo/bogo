#!/usr/bin/env python3
"""Generate derived logo assets from root logo.png.

Requires Pillow: pip install Pillow
Outputs:
  - packages/ui/public/logo-24.png (sidebar icon)
  - packages/ui/public/logo-80.png (loading/display)
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "logo.png"
OUTPUT_DIR = ROOT / "packages" / "ui" / "public"

SIZES = {
    "logo-24.png": 24,
    "logo-80.png": 80,
}


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Source logo not found: {SOURCE}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with Image.open(SOURCE) as img:
        for filename, size in SIZES.items():
            resized = img.resize((size, size), Image.LANCZOS)
            out_path = OUTPUT_DIR / filename
            resized.save(out_path, "PNG", optimize=True)
            print(f"  {out_path.relative_to(ROOT)} ({size}x{size})")

    print("Done.")


if __name__ == "__main__":
    main()
