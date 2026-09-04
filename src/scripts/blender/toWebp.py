"""Converts images to .webp, optionally resizing.

The app ships 22MB of atlas PNGs and 2.4MB of 255px panel crops; webp cuts both
by roughly an order of magnitude. Blender is already the pipeline's image tool,
which avoids adding an image library the runtime never uses.

  blender --background --factory-startup --python src/scripts/blender/toWebp.py -- \
      --in public/anatomy/atlas --out public/anatomy/atlas --quality 90 [--delete-source]
      [--only a.png,b.png] [--width 1400]

Atlas slides carry rendered labels, so keep quality high there (90+); flat
3D renders on transparent backgrounds tolerate 80-85 fine.
"""
import bpy, sys, os, argparse, glob

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--in", dest="src", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--quality", type=int, default=90)
ap.add_argument("--width", type=int, default=0, help="resize longest edge to this; 0 keeps size")
ap.add_argument("--only", default=None, help="comma-separated basenames to convert")
ap.add_argument("--delete-source", action="store_true")
a = ap.parse_args(argv)

only = set(a.only.split(",")) if a.only else None

scene = bpy.context.scene
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.quality = a.quality

os.makedirs(a.out, exist_ok=True)
before = after = 0
count = 0

for src in sorted(glob.glob(os.path.join(a.src, "*.png"))):
    base = os.path.basename(src)
    if only and base not in only:
        continue
    img = bpy.data.images.load(os.path.abspath(src))
    if a.width and img.size[0] != a.width:
        h = round(img.size[1] * a.width / img.size[0])
        img.scale(a.width, h)
    dst = os.path.abspath(os.path.join(a.out, os.path.splitext(base)[0] + ".webp"))
    img.file_format = "WEBP"
    img.save_render(dst)

    src_size = os.path.getsize(src)
    dst_size = os.path.getsize(dst)
    before += src_size
    after += dst_size
    count += 1
    print(f"[webp] {base:<44} {img.size[0]}x{img.size[1]}  "
          f"{src_size // 1024}KB -> {dst_size // 1024}KB")
    bpy.data.images.remove(img)
    if a.delete_source:
        os.remove(src)

if count:
    print(f"[complete] {count} files  {before / 1048576:.1f}MB -> {after / 1048576:.1f}MB "
          f"({100 * (before - after) / before:.0f}% smaller)")
else:
    print("[complete] nothing matched")
