"""convert_frames_to_webp.py — re-encode turntable base plates (the frames
the client actually ships) from PNG to WebP.

    python convert_frames_to_webp.py --dir renders/joints
    python convert_frames_to_webp.py --dir renders/regions

Only touches <dir>/<id>/frame-NN.png (the shared base plates) - NOT the
masks/ subdirectories, which are trace-only intermediates that never reach
the browser and stay PNG (untouched, and gitignored separately).

Why: these are large flat-shaded renders with a transparent background and
smooth gradients - close to worst-case content for PNG's per-pixel deflate,
and close to best-case for WebP's block-transform prediction. A quick check
on one joint frame: 712KB PNG -> 19KB WebP at quality=85, no visible loss for
a reference anatomy image. Across all 240 joint frames that was the
difference between shipping ~180MB and ~5MB in the deployed site.
"""
import os, argparse
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--dir", required=True, help="e.g. renders/joints or renders/regions")
ap.add_argument("--quality", type=int, default=85)
a = ap.parse_args()

converted, saved_bytes, before_bytes = 0, 0, 0
for item in sorted(os.listdir(a.dir)):
    idir = os.path.join(a.dir, item)
    if not os.path.isdir(idir):
        continue
    for fn in sorted(os.listdir(idir)):
        if not (fn.startswith("frame-") and fn.endswith(".png")):
            continue
        png_path = os.path.join(idir, fn)
        webp_path = png_path[:-4] + ".webp"
        before = os.path.getsize(png_path)
        Image.open(png_path).save(webp_path, "WEBP", quality=a.quality, method=6)
        after = os.path.getsize(webp_path)
        os.remove(png_path)
        converted += 1
        before_bytes += before
        saved_bytes += before - after

print(f"[convert] {converted} frames: {before_bytes / 1024 / 1024:.1f}MB -> "
      f"{(before_bytes - saved_bytes) / 1024 / 1024:.1f}MB "
      f"({saved_bytes / 1024 / 1024:.1f}MB saved)")
