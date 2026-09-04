"""Converts rendered region plates to the .webp files the app actually loads.

Blender is already a dependency of the render pipeline and handles webp, which
avoids adding an image library to a project whose runtime never touches one.

  blender --background --python src/scripts/blender/platesToWebp.py -- \
      --plates renders/regions-bones --out public/anatomy/regions \
      --views anterior=0,lateral=6,posterior=12 [--quality 82]

Writes <out>/<region>-<view>.webp, the paths images.seed.ts derives.
"""
import bpy, sys, os, argparse, glob

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--plates", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--views", default="anterior=0,lateral=6,posterior=12")
ap.add_argument("--quality", type=int, default=82)
ap.add_argument("--prefix", default="composited",
                help="'composited' for the subject-over-context plates the app ships, "
                     "'frame' for the raw region-only subject plate")
a = ap.parse_args(argv)

views = {}
for pair in a.views.split(","):
    name, frame = pair.split("=")
    views[name] = int(frame)

scene = bpy.context.scene
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.quality = a.quality

os.makedirs(a.out, exist_ok=True)
written = 0

for region_dir in sorted(glob.glob(os.path.join(a.plates, "*"))):
    if not os.path.isdir(region_dir):
        continue
    region = os.path.basename(region_dir)
    for view, frame in views.items():
        src = os.path.join(region_dir, f"{a.prefix}-{frame:02d}.png")
        if not os.path.exists(src):
            print(f"[warn] missing {src}")
            continue
        img = bpy.data.images.load(os.path.abspath(src))
        dst = os.path.abspath(os.path.join(a.out, f"{region}-{view}.webp"))
        img.file_format = "WEBP"
        img.save_render(dst)
        size = os.path.getsize(dst)
        print(f"[webp] {region}-{view}  {img.size[0]}x{img.size[1]}  {size // 1024}KB")
        bpy.data.images.remove(img)
        written += 1

print(f"[complete] {written} webp -> {a.out}")
