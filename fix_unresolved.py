"""One-off hand-fix for muscles reconcile.py can't auto-resolve, per README.md's
documented workflow ("fix anything printed as UNRESOLVED by hand"). All of these
are multi-part/multi-headed muscles in Z-Anatomy with no single combined mesh
matching the TA2 group term - each fix lists the real per-part BASE names (as
seen in objects.json's "base" field), expanded here to every real object name
sharing that base (collection == "4: Muscular system", verts >= 50). Some parts
are modelled as plain .l/.r pairs, a few (e.g. Iliocostalis colli) as one
unsuffixed object + one .r - this expands whatever actually exists rather than
assuming a fixed suffix pattern.
"""
import json

FIXES = {
    "deltoid": ["Acromial part of deltoid muscle", "Clavicular part of deltoid muscle",
                "Scapular spinal part of deltoid muscle"],
    "gastrocnemius": ["Lateral head of gastrocnemius", "Medial head of gastrocnemius"],
    "flexor-pollicis-brevis": ["Deep head of flexor pollicis brevis", "Superficial head of flexor pollicis brevis"],
    "spinalis": ["Spinalis capitis muscle", "Spinalis colli muscle", "Spinalis thoracis muscle"],
    "adductor-pollicis": ["Oblique head of adductor pollicis", "Transverse head of adductor pollicis"],
    "extensor-carpi-ulnaris": ["Humeral head of extensor carpi ulnaris", "Ulnar head of extensor carpi ulnaris"],
    "flexor-carpi-ulnaris": ["Humeral head of flexor carpi ulnaris", "Ulnar head of flexor carpi ulnaris"],
    "flexor-digitorum-superficialis": ["Humero-ulnar head of flexor digitorum superficialis",
                                        "Radial head of flexor digitorum superficialis"],
    "pronator-teres": ["Deep head of pronator teres", "Superficial head of pronator teres"],
    "biceps-femoris": ["Long head of biceps femoris", "Short head of biceps femoris"],
    "flexor-hallucis-brevis": ["Lateral head of flexor hallucis brevis", "Medial head of flexor hallucis brevis"],
    "biceps-brachii": ["Long head of biceps brachii", "Short head of biceps brachii"],
    "pectoralis-major": ["(Abdominal part of pectoralis major muscle)",
                          "Clavicular head of pectoralis major muscle",
                          "Sternocostal head of pectoralis major muscle"],
    "trapezius": ["Ascending part of trapezius muscle", "Descending part of trapezius muscle",
                  "Transverse part of trapezius muscle"],
    "triceps-brachii": ["Lateral head of triceps brachii", "Long head of triceps brachii",
                         "Medial head of triceps brachii"],
    "iliocostalis": ["Iliocostalis colli muscle", "Iliocostalis lumborum muscle", "Iliocostalis thoracis muscle"],
    "interspinales": ["Interspinales colli muscles", "Interspinales lumborum muscles", "Interspinales thoracis muscles"],
    "intertransversarii": ["Dorsal parts of lateral intertransversarii lumborum muscles",
                            "Ventral parts of lateral intertransversarii lumborum muscles"],
    "longissimus": ["Longissimus capitis muscle", "Longissimus colli muscle", "Longissimus thoracis muscle"],
    "multifidus": ["Multifidus colli muscle", "Multifidus lumborum muscle", "Multifidus thoracis muscle"],
    "semispinalis": ["Semispinalis colli muscle", "Semispinalis thoracis muscle"],
}

objs = json.load(open("objects.json", encoding="utf-8"))
real = [o for o in objs["objects"] if "4: Muscular system" in o.get("collections", []) and o.get("verts", 0) >= 50]
by_base = {}
for o in real:
    by_base.setdefault(o["base"], []).append(o["name"])

path = "ta2-mapping.resolved.json"
data = json.load(open(path, encoding="utf-8"))

fixed = 0
for e in data["mapping"]:
    if e["id"] in FIXES and not e["blenderObjects"]:
        names = []
        missing = []
        for base in FIXES[e["id"]]:
            if base in by_base:
                names.extend(by_base[base])
            else:
                missing.append(base)
        if missing:
            print(f"  [warn] {e['id']}: base name(s) not found in real objects: {missing}")
        if names:
            e["blenderObjects"] = sorted(names)
            e["resolution"] = "manual"
            e["resolutionConfidence"] = 1.0
            fixed += 1

data["counts"]["resolved"] += fixed
data["counts"]["unresolved"] -= fixed

json.dump(data, open(path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print(f"fixed {fixed}/{len(FIXES)} -> resolved {data['counts']['resolved']}/{data['counts']['total']}")
