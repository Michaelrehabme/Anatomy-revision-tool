"""apply_regions.py — fold the region-turntable muscle render pass into
muscles.json AND msk-quiz.html's embedded JSON (the copies the live app
actually reads at runtime).

    python apply_regions.py

Safe to re-run after rendering more regions (render_regions.py --region <id>
one at a time). Only regions that actually have renders/regions/<id>/frame-00
on disk get wired up; muscles in regions not yet rendered keep working via
the old single-image/hotspotRegion path untouched (see structureImage()'s
fallback in msk-quiz.html) until every region is done and that path is
retired for good (see the plan's cleanup step).

Adds:
  - muscles.json: no change to muscle records themselves (primaryJoint was
    already added by add_primary_joint.py) - this script's job is purely the
    render-derived data below.
  - msk-quiz.html embedded blocks, inserted next to joint-meta-data/etc:
      region-meta-data     - {region: {frameCount, views, images.turntable}}
      region-hotspots-data - region-hotspots.json verbatim
"""
import json, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))

region_hotspots_path = os.path.join(ROOT, "region-hotspots.json")
region_hotspots = json.load(open(region_hotspots_path, encoding="utf-8")) if os.path.exists(region_hotspots_path) \
    else {"schemaVersion": 1, "normalised": True, "hotspots": {}}

ALL_REGIONS = ["shoulder-arm", "forearm-hand", "hip-thigh", "lower-leg-foot", "back-core"]
FRAMES = 24  # fixed for every region, same convention as joints (render_regions.py's --frames default)


def views_for():
    return {"anterior": 0, "posterior": FRAMES // 2, "side": FRAMES // 4}


region_meta = {}
for region in ALL_REGIONS:
    if not os.path.exists(os.path.join(ROOT, "renders", "regions", region, "frame-00.webp")) and \
       not os.path.exists(os.path.join(ROOT, "renders", "regions", region, "frame-00.png")):
        continue
    ext = "webp" if os.path.exists(os.path.join(ROOT, "renders", "regions", region, "frame-00.webp")) else "png"
    turntable = [f"renders/regions/{region}/frame-{i:02d}.{ext}" for i in range(FRAMES)]
    region_meta[region] = {
        "frameCount": FRAMES,
        "views": views_for(),
        "images": {"turntable": turntable},
    }

print(f"[regions] {len(region_meta)} of {len(ALL_REGIONS)} regions have renders on disk: {sorted(region_meta)}")

# msk-quiz.html's embedded blocks
html_path = os.path.join(ROOT, "msk-quiz.html")
html = open(html_path, encoding="utf-8").read()

for block_id in ("region-meta-data", "region-hotspots-data"):
    html = re.sub(rf'\n?<script id="{block_id}" type="application/json">.*?</script>', "", html, flags=re.S)

blocks = [
    ("region-meta-data", {"schemaVersion": 1, "regions": region_meta}),
    ("region-hotspots-data", region_hotspots),
]
combined = "\n".join(
    f'<script id="{bid}" type="application/json">{json.dumps(payload, indent=2, ensure_ascii=False)}</script>'
    for bid, payload in blocks
)
anchor = re.search(r'<script id="joint-hotspots-data" type="application/json">.*?</script>', html, re.S)
if not anchor:
    raise SystemExit("could not find joint-hotspots-data anchor to insert after")
html = html[:anchor.end()] + "\n" + combined + html[anchor.end():]

# also sync muscles.json's primaryJoint into the embedded muscle-data block,
# same reasoning as apply_joints.py syncing landmark.joint
muscles_data = json.load(open(os.path.join(ROOT, "muscles.json"), encoding="utf-8"))
by_id = {m["id"]: m for m in muscles_data["muscles"]}

m = re.search(r'(<script id="muscle-data" type="application/json">)(.*?)(</script>)', html, re.S)
if not m:
    raise SystemExit("could not find muscle-data script block in msk-quiz.html")
embedded = json.loads(m.group(2))
n_synced = 0
for em in embedded["muscles"]:
    src = by_id.get(em["id"])
    if src and "primaryJoint" in src:
        em["primaryJoint"] = src["primaryJoint"]
        n_synced += 1
new_blob = json.dumps(embedded, indent=2, ensure_ascii=False)
html = html[:m.start()] + m.group(1) + new_blob + m.group(3) + html[m.end():]

open(html_path, "w", encoding="utf-8").write(html)
print(f"[msk-quiz.html] upserted region-meta-data ({len(region_meta)} regions), region-hotspots-data, "
      f"synced primaryJoint for {n_synced} muscles")
