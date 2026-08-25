"""apply_joints.py — fold the joint-context turntable render pass into
landmarks.json AND msk-quiz.html's embedded JSON (the copies the live app
actually reads at runtime).

    python apply_joints.py

Safe to re-run after rendering more joints (render_joints.py --joint <id> one
at a time, per the "look before batching" workflow) - only joints that
actually have renders/joints/<id>/frame-00.webp on disk get tagged, and the
embedded blocks below are fully replaced each run, not appended to.

Steps:
  1. add "joint" to every landmark.json/landmark-data entry whose id is
     listed under a rendered joint in joints.json.
  2. insert/replace three new embedded blocks in msk-quiz.html, right after
     hotspot-data (mirrors the joints.json / joint-pins.json /
     joint-hotspots.json files on disk, the same relationship muscle-data has
     to hotspot-data):
       joint-meta-data     - {id, label, frameCount, views: {anterior, posterior, side}}
       joint-pins-data      - joint-pins.json verbatim
       joint-hotspots-data  - joint-hotspots.json verbatim
"""
import json, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))

joints_cfg = json.load(open(os.path.join(ROOT, "joints.json"), encoding="utf-8"))["joints"]
joint_pins = json.load(open(os.path.join(ROOT, "joint-pins.json"), encoding="utf-8"))
joint_hotspots_path = os.path.join(ROOT, "joint-hotspots.json")
joint_hotspots = json.load(open(joint_hotspots_path, encoding="utf-8")) if os.path.exists(joint_hotspots_path) \
    else {"schemaVersion": 1, "normalised": True, "hotspots": {}}

FRAMES = joint_pins["frames"]


def views_for(joint):
    """Frame indices for the Anterior/Posterior/Side quick-jump buttons -
    see render_joints.py's frame_camera_azimuth: angle 0 is anterior, 180 is
    posterior, and joints.json's sideViewAzimuth picks the side."""
    az = joint.get("sideViewAzimuth", 90)
    return {
        "anterior": 0,
        "posterior": FRAMES // 2,
        "side": round(az / (360.0 / FRAMES)) % FRAMES,
    }


landmark_to_joint = {}
joint_meta = {}
for j in joints_cfg:
    jid = j["id"]
    # only claim a joint as "rendered" if render_joints.py actually produced
    # frames for it, so this can be re-run mid-rollout without erroring
    if not os.path.exists(os.path.join(ROOT, "renders", "joints", jid, "frame-00.webp")):
        continue
    turntable = [f"renders/joints/{jid}/frame-{i:02d}.webp" for i in range(FRAMES)]
    joint_meta[jid] = {
        "id": jid,
        "label": j["label"],
        "frameCount": FRAMES,
        "views": views_for(j),
        "images": {"turntable": turntable},
    }
    for lid in j.get("landmarks", []):
        landmark_to_joint[lid] = jid

print(f"[joints] {len(joint_meta)} of {len(joints_cfg)} joints have renders on disk: {sorted(joint_meta)}")


def patch_landmarks(landmark_list):
    n = 0
    for lm in landmark_list:
        jid = landmark_to_joint.get(lm["id"])
        if not jid:
            continue
        lm["joint"] = jid
        n += 1
    return n


# 1a. landmarks.json
landmarks_path = os.path.join(ROOT, "landmarks.json")
data = json.load(open(landmarks_path, encoding="utf-8"))
n_json = patch_landmarks(data["landmarks"])
json.dump(data, open(landmarks_path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print(f"[landmarks.json] tagged {n_json} landmarks with a joint")

# 1b. msk-quiz.html's embedded landmark-data JSON
html_path = os.path.join(ROOT, "msk-quiz.html")
html = open(html_path, encoding="utf-8").read()

m = re.search(r'(<script id="landmark-data" type="application/json">)(.*?)(</script>)', html, re.S)
if not m:
    raise SystemExit("could not find landmark-data script block in msk-quiz.html")
embedded = json.loads(m.group(2))
n_embedded = patch_landmarks(embedded["landmarks"])
new_blob = json.dumps(embedded, indent=2, ensure_ascii=False)
html = html[:m.start()] + m.group(1) + new_blob + m.group(3) + html[m.end():]
print(f"[msk-quiz.html] tagged {n_embedded} landmarks with a joint in embedded landmark-data JSON")

# 2. insert/replace joint-meta-data, joint-pins-data, joint-hotspots-data
for block_id in ("joint-meta-data", "joint-pins-data", "joint-hotspots-data"):
    html = re.sub(rf'\n?<script id="{block_id}" type="application/json">.*?</script>', "", html, flags=re.S)

blocks = [
    ("joint-meta-data", {"schemaVersion": 1, "joints": joint_meta}),
    ("joint-pins-data", joint_pins),
    ("joint-hotspots-data", joint_hotspots),
]
combined = "\n".join(
    f'<script id="{bid}" type="application/json">{json.dumps(payload, indent=2, ensure_ascii=False)}</script>'
    for bid, payload in blocks
)
anchor = re.search(r'<script id="hotspot-data" type="application/json">.*?</script>', html, re.S)
if not anchor:
    raise SystemExit("could not find hotspot-data anchor to insert after")
html = html[:anchor.end()] + "\n" + combined + html[anchor.end():]

open(html_path, "w", encoding="utf-8").write(html)
print(f"[msk-quiz.html] upserted joint-meta-data ({len(joint_meta)} joints), "
      f"joint-pins-data, joint-hotspots-data")
