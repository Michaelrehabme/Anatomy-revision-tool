import bpy
ob = bpy.data.objects["Fibula.r"]
zs = [(ob.matrix_world @ v.co).z for v in ob.data.vertices]
print("FIB top", round(max(zs) * 1000, 1), "bottom", round(min(zs) * 1000, 1))
for n in ["Head of fibula.j", "Neck of fibula.j", "Apex of head of fibula.j"]:
    for o in bpy.data.objects:
        if o.name.startswith(n):
            mw = o.matrix_world
            pts = [mw @ v.co for v in o.data.vertices] if o.type == "MESH" and o.data.vertices else [mw.translation]
            c = sum(pts, pts[0] * 0) / len(pts)
            print("ANCHOR", o.name, [round(c.x * 1000, 1), round(c.y * 1000, 1), round(c.z * 1000, 1)])
