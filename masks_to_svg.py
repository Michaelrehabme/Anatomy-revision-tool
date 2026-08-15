"""
masks_to_svg.py — turn mask renders into normalised hotspot polygons.

    python3 masks_to_svg.py --masks ./renders/masks --out hotspots.json

Coordinates are normalised 0–1 against the mask dimensions, so the same polygon
works at any display size. Point-in-polygon on the client gives you tap targets
without shipping an image map or a fixed-size canvas.

Output shape:
  { "shoulder-arm": { "supraspinatus": { "polygons": [[[x,y],...]], "area": 0.031,
                                         "centroid": [x,y] } } }
"""
import cv2, numpy as np, json, os, argparse

ap = argparse.ArgumentParser()
ap.add_argument("--masks", default="./renders/masks")
ap.add_argument("--out", default="hotspots.json")
ap.add_argument("--epsilon", type=float, default=0.0025,
                help="simplification, as a fraction of contour perimeter")
ap.add_argument("--min-area", type=float, default=0.00015,
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
    # close pinholes so a muscle crossed by a vessel stays one polygon
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
for region in sorted(os.listdir(a.masks)) if os.path.isdir(a.masks) else []:
    rdir = os.path.join(a.masks, region)
    if not os.path.isdir(rdir):
        continue
    out[region] = {}
    for fn in sorted(os.listdir(rdir)):
        if not fn.lower().endswith(".png"):
            continue
        mid = os.path.splitext(fn)[0]
        res = trace(os.path.join(rdir, fn), a.epsilon, a.min_area)
        if res:
            out[region][mid] = res
        else:
            skipped.append(f"{region}/{mid}")

json.dump({"schemaVersion": 1, "normalised": True, "hotspots": out},
          open(a.out, "w"), indent=2)

n = sum(len(v) for v in out.values())
pts = sum(h["points"] for v in out.values() for h in v.values())
print(f"traced {n} hotspots across {len(out)} regions ({pts} points total) -> {a.out}")
if skipped:
    print("empty masks (muscle hidden behind others at this camera angle?):")
    for s in skipped:
        print("  ", s)
