"""populate_images.py - after render_muscles.py + masks_to_svg.py have produced
./renders and hotspots.json, fill in muscles.json's per-muscle images block.

    python3 populate_images.py --renders ./renders --muscles muscles.json

images.isolated -> renders/isolated/<id>.png (the muscle alone, transparent bg)
images.hotspot   -> renders/base/<region>.png (the regional plate this muscle's
                     hotspot polygon in hotspots.json overlays - the quiz UI
                     highlights the polygon on top of this image)
images.credit/licence -> the attribution string README.md already drafted for
                     Z-Anatomy (CC BY-SA 4.0)
Only touches muscles that actually have a rendered isolated/<id>.png - muscles
in regions/heads not yet rendered are left untouched (still null).
"""
import json, os, argparse

CREDIT = ("Derived from Z-Anatomy (Gauthier Kervyn et al.), based on BodyParts3D "
          "(Database Center for Life Science).")
LICENCE = "CC BY-SA 4.0"

ap = argparse.ArgumentParser()
ap.add_argument("--renders", default="./renders")
ap.add_argument("--muscles", default="muscles.json")
a = ap.parse_args()

data = json.load(open(a.muscles, encoding="utf-8"))

updated = 0
for m in data["muscles"]:
    isolated_rel = os.path.join("renders", "isolated", f"{m['id']}.png")
    base_rel = os.path.join("renders", "base", f"{m['region']}.png")
    if not os.path.exists(isolated_rel):
        continue
    m["images"]["isolated"] = isolated_rel.replace("\\", "/")
    if os.path.exists(base_rel):
        m["images"]["hotspot"] = base_rel.replace("\\", "/")
    m["images"]["credit"] = CREDIT
    m["images"]["licence"] = LICENCE
    updated += 1

json.dump(data, open(a.muscles, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print(f"populated images for {updated}/{len(data['muscles'])} muscles")
