"""Hand-fix for landmarks reconcile_landmarks.py couldn't auto-match - mostly
because landmarks.json used the colloquial/textbook name while Z-Anatomy's
object uses different wording or word order (e.g. "L4 Vertebra" vs the file's
"Vertebra L4", "Auricular Surface (Ilium)" vs "Auricular surface of ilium").
Joints (acromioclavicular, sternoclavicular, sacroiliac) have no single
matching object - they're relationships between two bones, not a mesh - so
they're left unresolved/unrendered for now rather than force-matched.
"""
import json

FIXES = {
    "acromion": ["Acromion.i"],
    "auricular-surface-ilium": ["Auricular surface of ilium.i"],
    "auricular-surface-sacrum": ["Auricular surface of sacrum.j"],
    "coronoid-process-ulna": ["Coronoid process of ulna.i"],
    "cuboid": ["Cuboid bone.l", "Cuboid bone.r"],
    "glenoid-labrum": ["Glenoid labrum.l", "Glenoid labrum.r"],
    "inferior-articular-facet-vertebra": ["Inferior articular facet of vertebra.j"],
    "navicular": ["Navicular bone.l", "Navicular bone.r"],
    "radial-notch-ulna": ["Radial notch.i"],
    "fovea-capitis": ["Fovea for ligament of head of femur.i"],
    "glenoid-cavity": ["Glenoid fossa.i"],
    "menisci": ["Lateral meniscus.l", "Lateral meniscus.r", "Medial meniscus.l", "Medial meniscus.r"],
    "vertebra-l4": ["Vertebra L4"],
    "intervertebral-disc": ["Intervertebral disc L4-L5"],
}

path = "ta2-mapping-landmarks.resolved.json"
data = json.load(open(path, encoding="utf-8"))

fixed = 0
for e in data["mapping"]:
    if e["id"] in FIXES and not e["blenderObjects"]:
        e["blenderObjects"] = FIXES[e["id"]]
        e["resolution"] = "manual"
        e["resolutionConfidence"] = 1.0
        fixed += 1

data["counts"]["resolved"] += fixed
data["counts"]["unresolved"] -= fixed
json.dump(data, open(path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print(f"fixed {fixed}/{len(FIXES)} -> resolved {data['counts']['resolved']}/{data['counts']['total']}")

still_unresolved = [e["id"] for e in data["mapping"] if not e["blenderObjects"]]
print("still unresolved (joints - no single mesh, left for a future joint-specific approach):", still_unresolved)
