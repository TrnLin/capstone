"""Convert the DICOMs in dataset/ into web-friendly PNGs.

Outputs land in web/public/samples/cxr/*.png. We percentile-clip and
window the pixel intensities so the resulting PNG has reasonable
contrast (raw VinDr-CXR DICOMs are 16-bit and look black in the browser
without preprocessing).
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pydicom
from PIL import Image
from pydicom.pixel_data_handlers.util import apply_voi_lut


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SRC_DIRS = [ROOT / "dataset" / "train", ROOT / "dataset" / "test"]
OUT_DIR = ROOT / "web" / "public" / "samples" / "cxr"
TARGET_WIDTH = 1024


def dicom_to_array(path: Path) -> np.ndarray:
    ds = pydicom.dcmread(str(path))
    arr = apply_voi_lut(ds.pixel_array, ds).astype(np.float32)

    # MONOCHROME1: high pixel = dark. Invert so bones are bright.
    if str(getattr(ds, "PhotometricInterpretation", "")).upper() == "MONOCHROME1":
        arr = arr.max() - arr

    # Percentile-clip to drop hot/cold outliers, then normalize 0..255.
    lo, hi = np.percentile(arr, (1.0, 99.0))
    if hi <= lo:
        hi = lo + 1.0
    arr = np.clip((arr - lo) / (hi - lo), 0.0, 1.0)
    return (arr * 255.0).astype(np.uint8)


def downscale(img: Image.Image, target_w: int) -> Image.Image:
    w, h = img.size
    if w <= target_w:
        return img
    new_h = round(h * (target_w / w))
    return img.resize((target_w, new_h), Image.LANCZOS)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dicom_paths: list[Path] = []
    for d in SRC_DIRS:
        if not d.exists():
            continue
        dicom_paths.extend(sorted(d.glob("*.dicom")))
        dicom_paths.extend(sorted(d.glob("*.dcm")))

    if not dicom_paths:
        print("No DICOMs found.", file=sys.stderr)
        return 1

    for dcm in dicom_paths:
        try:
            arr = dicom_to_array(dcm)
        except Exception as e:
            print(f"[skip] {dcm.name}: {e}", file=sys.stderr)
            continue
        img = Image.fromarray(arr, mode="L")
        img = downscale(img, TARGET_WIDTH)
        out = OUT_DIR / f"{dcm.stem}.png"
        img.save(out, format="PNG", optimize=True)
        print(f"{dcm.name}  ->  {out.relative_to(ROOT)}  ({img.size[0]}x{img.size[1]})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
