"""joint_masks_to_hotspots.py — trace joint-context landmark masks into
per-frame normalised hotspot polygons.

    python joint_masks_to_hotspots.py --masks ./renders/joints --out joint-hotspots.json

Walks renders/joints/<joint>/masks/<landmark-id>/frame-NN.png (written by
render_joints.py for "solid" landmarks - a real mesh, not a marker pin) and
traces each frame with the same algorithm masks_to_svg.py uses for muscles
(see that module for the tracing itself; this is the same function, just
looped one level deeper for frame index).

--min-area is much smaller here than masks_to_svg.py's default: a landmark
like the glenoid labrum is a small fraction of its *joint's* frame (which
frames the whole joint, not just that one structure), unlike a muscle mask
which is often a large fraction of its region's frame.

Output shape:
  { "<joint>": { "<landmark-id>": { "0": {polygons, area, centroid}, "1": {...}, ... } } }
"""
import cv2, numpy as np, json, os, argparse

ap = argparse.ArgumentParser()
ap.add_argument("--masks", default="./renders/joints")
ap.add_argument("--out", default="joint-hotspots.json")
ap.add_argument("--epsilon", type=float, default=0.0025,
                help="simplification, as a fraction of contour perimeter")
ap.add_argument("--min-area", type=float, default=0.00002,
                help="drop specks below this fraction of the image")
a = ap.parse_args()


def trace(path, epsilon, min_area):
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        return None
    # Prefer alpha (transparent background renders); fall back to luminance.
    mask = img[:, :, 3] if img.ndim == 3 and img.shape[2] == 4 else \
        cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    h, w = mask.shape[:2]
    _, binary = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
    # close pinholes so a thin ring-shaped structure (e.g. a labrum) stays one polygon
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    total = float(h * w)
    polys = []
    for c in contours:
        if cv2.contourArea(c) / total < min_area:
            continue
        simplified = cv2.approxPolyDP(c, epsilon * cv2.arcLength(c, True), True)
        if len(simplified) < 3:
            continue
        polys.append([[round(float(p[0][0]) / w, 5), round(float(p[0][1]) / h, 5)]
                      for p in simplified])
    if not polys:
        return None

    area = sum(cv2.contourArea(c) for c in contours) / total
    M = cv2.moments(binary, binaryImage=True)
    centroid = [round(M["m10"] / M["m00"] / w, 5), round(M["m01"] / M["m00"] / h, 5)] \
        if M["m00"] else None
    return {"polygons": polys, "area": round(area, 5), "centroid": centroid,
            "points": sum(len(p) for p in polys), "size": [w, h]}


out, skipped = {}, []
for joint in sorted(os.listdir(a.masks)) if os.path.isdir(a.masks) else []:
    masks_dir = os.path.join(a.masks, joint, "masks")
    if not os.path.isdir(masks_dir):
        continue
    joint_out = {}
    for landmark_id in sorted(os.listdir(masks_dir)):
        ldir = os.path.join(masks_dir, landmark_id)
        if not os.path.isdir(ldir):
            continue
        frames = {}
        for fn in sorted(os.listdir(ldir)):
            if not fn.lower().endswith(".png"):
                continue
            frame_idx = str(int(os.path.splitext(fn)[0].replace("frame-", "")))
            res = trace(os.path.join(ldir, fn), a.epsilon, a.min_area)
            if res:
                frames[frame_idx] = res
            else:
                skipped.append(f"{joint}/{landmark_id}/{fn}")
        if frames:
            joint_out[landmark_id] = frames
    if joint_out:
        out[joint] = joint_out

# merge with whatever's already on disk, same reasoning as render_joints.py:
# running one joint at a time shouldn't clobber previously-traced joints.
if os.path.exists(a.out):
    existing = json.load(open(a.out, encoding="utf-8")).get("hotspots", {})
    existing.update(out)
    out = existing

json.dump({"schemaVersion": 1, "normalised": True, "hotspots": out},
          open(a.out, "w"), indent=2)

n = sum(len(v) for v in out.values())
frames_traced = sum(len(f) for v in out.values() for f in v.values())
print(f"traced {n} landmark(s) across {len(out)} joint(s), {frames_traced} frames total -> {a.out}")
if skipped:
    print(f"{len(skipped)} empty masks (landmark hidden/too thin at that angle):")
    for s in skipped[:20]:
        print("  ", s)
    if len(skipped) > 20:
        print(f"   ... and {len(skipped) - 20} more")
