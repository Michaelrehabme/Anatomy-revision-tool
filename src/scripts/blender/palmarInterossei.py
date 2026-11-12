"""The palmar interossei the atlas leaves out.

Z-Anatomy models ONE palmar interosseous: the third, on the radial side of the
fifth metacarpal. A student reported the plate "does not show all of the
palmar interossei" (12 Nov 2026), and it did not - the other two were never in
the model, so no mapping could find them.

add_missing() adds the first (ulnar side of the second metacarpal) and the
second (radial side of the fourth) by carrying the atlas's own strip from the
fifth metacarpal's frame into each of the others: a frame per metacarpal from
its principal axes (long axis pointing distally, second axis towards the
thumb), the strip's length scaled to the bone, and the first mirrored because
it lies on the ulnar side of its bone. The middle finger has none, as in life:
the palmar interossei adduct towards it. Owner approved the result, 12 Nov 2026.

The left and right objects share one mesh, so it is patched once.
"""
import bpy, bmesh, mathutils
import numpy as np


def _world(name):
    o = bpy.data.objects[name]
    return np.array([(o.matrix_world @ v.co)[:] for v in o.data.vertices])


def _frame(name, thumb_centre):
    p = _world(name)
    c = p.mean(0)
    _, _, vt = np.linalg.svd(p - c, full_matrices=False)
    e1 = vt[0]
    if e1[2] > 0:  # distal is downwards: the hand hangs at the side
        e1 = -e1
    t = thumb_centre - c
    e2 = t - np.dot(t, e1) * e1  # towards the thumb, i.e. radial
    e2 /= np.linalg.norm(e2)
    e3 = np.cross(e1, e2)
    return c, np.stack([e1, e2, e3]), np.ptp((p - c) @ e1)


def add_missing():
    done = set()
    for s in ("l", "r"):
        ob = bpy.data.objects.get(f"Palmar interossei muscles.{s}")
        if ob is None or ob.data.name in done:
            continue
        done.add(ob.data.name)
        mw = ob.matrix_world
        inv = mw.inverted()
        thumb = _world(f"First metacarpal bone.{s}").mean(0)
        c5, r5, l5 = _frame(f"Fifth metacarpal bone.{s}", thumb)
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        orig = [mw @ v.co for v in bm.verts]
        faces = [[v.index for v in f.verts] for f in bm.faces]
        for target, mirror in ((f"Fourth metacarpal bone.{s}", False), (f"Second metacarpal bone.{s}", True)):
            ct, rt, lt = _frame(target, thumb)
            new_verts = []
            for p in orig:
                q = r5 @ (np.array(p[:]) - c5)
                q[0] *= lt / l5
                if mirror:
                    q[1] = -q[1]
                w = ct + rt.T @ q
                new_verts.append(bm.verts.new(inv @ mathutils.Vector(w.tolist())))
            for f in faces:
                vs = [new_verts[i] for i in f]
                if mirror:
                    vs = vs[::-1]
                try:
                    bm.faces.new(vs)
                except ValueError:
                    pass
        bm.to_mesh(ob.data)
        bm.free()
        ob.data.update()
        print(f"[palmarInterossei] {ob.name}: {len(ob.data.vertices)} verts", flush=True)
