# Measures the spine of the scapula as seen from behind: for each 4mm column
# across Scapula.r, the z-range where the bone stands proud of the blade
# (its most posterior point is well behind the blade's). Prints world mm.
import bpy
import json

ob = bpy.data.objects["Scapula.r"]
mw = ob.matrix_world
pts = [mw @ v.co for v in ob.data.vertices]
xs = [p.x for p in pts]
x0, x1 = min(xs), max(xs)
zs = [p.z for p in pts]
print("BBOX", [round(v * 1000, 1) for v in (x0, x1, min(zs), max(zs), min(p.y for p in pts), max(p.y for p in pts))])

out = []
step = 0.004
x = x0
while x < x1:
    col = [p for p in pts if x <= p.x < x + step]
    x += step
    if len(col) < 10:
        continue
    slices = {}
    for p in col:
        k = round(p.z * 1000)
        slices[k] = max(slices.get(k, -1e9), p.y)
    band = [k for k in slices if 1330 <= k <= 1420]
    if not band:
        continue
    peak = max(band, key=lambda k: slices[k])
    win = [k for k in slices if peak - 45 <= k <= peak + 45]
    base = min(slices[k] for k in win)
    cut = base + 0.35 * (slices[peak] - base)
    lo = hi = peak
    while lo - 1 in slices and slices[lo - 1] > cut:
        lo -= 1
    while hi + 1 in slices and slices[hi + 1] > cut:
        hi += 1
    out.append({"x": round((x - step / 2) * 1000, 1), "peak": peak, "zlo": lo, "zhi": hi, "proudMm": round((slices[peak] - base) * 1000, 1), "colTop": max(slices)})

print("SPINE " + json.dumps(out))
