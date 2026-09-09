"""Dumps every mesh object and collection in the Z-Anatomy scene to JSON.

The mapping generator needs to know what the model actually contains, and
opening an 86MB .blend to find out takes half a minute each time. This writes
it once so the mapping can be regenerated, diffed and reviewed without Blender
in the loop at all.

  ./tools/blender-*/blender.exe --background atlas/Z-Anatomy/Startup.blend \
      --python src/scripts/blender/dumpObjectNames.py -- \
      --out src/scripts/data/zAnatomyObjects.json

Collections matter as much as objects. Z-Anatomy names some structures only as
a grouping — "Ankle joint" is a collection of twelve meshes, not one object
called "Ankle joint" — so a mapping built from object names alone finds barely
any joints.
"""
import bpy, json, sys, os, argparse

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
a = ap.parse_args(argv)

collections = {}
for c in bpy.data.collections:
    meshes = sorted({o.name for o in c.all_objects if o.type == "MESH"})
    if meshes:
        collections[c.name] = meshes

objects = sorted({o.name for o in bpy.data.objects if o.type == "MESH"})

payload = {
    "generator": "src/scripts/blender/dumpObjectNames.py",
    "objectCount": len(objects),
    "collectionCount": len(collections),
    "objects": objects,
    "collections": collections,
}

os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
with open(a.out, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=1)

print(f"[dump] {len(objects)} meshes, {len(collections)} collections -> {a.out}", flush=True)
