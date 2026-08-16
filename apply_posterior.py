"""apply_posterior.py — one-off: fold a completed posterior Blender render
pass (./renders_posterior) into the main renders/ tree, muscles.json, AND
msk-quiz.html's embedded muscle-data JSON (the copy the live app actually
reads at runtime), using posterior_classification.json to decide which
muscles get the back-camera treatment.

    python apply_posterior.py

Steps:
  1. copy renders_posterior/base/<region>.png -> renders/base/<region>-posterior.png (all 5)
  2. overwrite renders/isolated/<id>.png with the posterior version, classified ids only
  3. copy renders_posterior/masks/<region>/<id>.png -> renders/masks-posterior/<region>/<id>.png, classified ids only
  4. add "hotspotRegion" + posterior images.hotspot path to muscles.json AND
     msk-quiz.html's embedded muscle-data JSON, classified ids only
"""
import json, os, re, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "renders_posterior")
DST = os.path.join(ROOT, "renders")

classification = json.load(open(os.path.join(ROOT, "posterior_classification.json"), encoding="utf-8"))
all_posterior_ids = set()
for region, ids in classification.items():
    all_posterior_ids.update(ids)


def patch_muscles(muscle_list):
    by_id = {m["id"]: m for m in muscle_list}
    n = 0
    for region, ids in classification.items():
        for mid in ids:
            m = by_id.get(mid)
            if not m:
                print(f"[warn] {mid} not found in muscle list")
                continue
            m["hotspotRegion"] = f"{region}-posterior"
            m["images"]["hotspot"] = f"renders/base/{region}-posterior.png"
            n += 1
    return n


# 1. base plates - all 5 regions
os.makedirs(os.path.join(DST, "base"), exist_ok=True)
for region in classification:
    src = os.path.join(SRC, "base", f"{region}.png")
    dst = os.path.join(DST, "base", f"{region}-posterior.png")
    shutil.copyfile(src, dst)
    print(f"[base] {region} -> {os.path.relpath(dst, ROOT)}")

# 2. isolated portraits - overwrite, classified ids only
n_iso = 0
for mid in sorted(all_posterior_ids):
    src = os.path.join(SRC, "isolated", f"{mid}.png")
    dst = os.path.join(DST, "isolated", f"{mid}.png")
    if not os.path.exists(src):
        print(f"[warn] no posterior isolated render for {mid}, skipping")
        continue
    shutil.copyfile(src, dst)
    n_iso += 1
print(f"[isolated] overwrote {n_iso} of {len(all_posterior_ids)} classified muscles")

# 3. masks - classified ids only, into a parallel masks-posterior tree
n_masks = 0
for region, ids in classification.items():
    out_dir = os.path.join(DST, "masks-posterior", region)
    os.makedirs(out_dir, exist_ok=True)
    for mid in ids:
        src = os.path.join(SRC, "masks", region, f"{mid}.png")
        dst = os.path.join(out_dir, f"{mid}.png")
        if not os.path.exists(src):
            print(f"[warn] no posterior mask for {region}/{mid}, skipping")
            continue
        shutil.copyfile(src, dst)
        n_masks += 1
print(f"[masks] copied {n_masks} of {len(all_posterior_ids)} classified masks")

# 4a. muscles.json
muscles_path = os.path.join(ROOT, "muscles.json")
data = json.load(open(muscles_path, encoding="utf-8"))
muscles = data["muscles"] if isinstance(data, dict) and "muscles" in data else data
n_json = patch_muscles(muscles)
json.dump(data, open(muscles_path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print(f"[muscles.json] updated {n_json} muscles")

# 4b. msk-quiz.html's embedded muscle-data JSON (the copy the live app reads)
html_path = os.path.join(ROOT, "msk-quiz.html")
html = open(html_path, encoding="utf-8").read()
m = re.search(r'(<script id="muscle-data" type="application/json">)(.*?)(</script>)', html, re.S)
if not m:
    raise SystemExit("could not find muscle-data script block in msk-quiz.html")
embedded = json.loads(m.group(2))
n_embedded = patch_muscles(embedded["muscles"])
new_blob = json.dumps(embedded, indent=2, ensure_ascii=False)
html = html[:m.start()] + m.group(1) + new_blob + m.group(3) + html[m.end():]
open(html_path, "w", encoding="utf-8").write(html)
print(f"[msk-quiz.html] updated {n_embedded} muscles in embedded muscle-data JSON")

print("done. next: run masks_to_svg.py against renders/masks-posterior -> hotspots-posterior.json,")
print("then run merge_posterior_hotspots.py to fold it into hotspots.json + msk-quiz.html's hotspot-data JSON.")
