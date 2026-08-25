"""add_primary_joint.py — tag each muscle in muscles.json with a `primaryJoint`
label, the same "which joint is this?" orientation cue landmarks already got
from render_joints.py/apply_joints.py.

    python add_primary_joint.py

Unlike landmarks, a muscle's turntable render stays REGION-wide (a muscle
like latissimus dorsi or biceps femoris genuinely spans more than one joint's
narrow bone group - see the plan's reasoning), so `primaryJoint` here is a
plain display label, not a joints.json id to look up a turntable through.

Muscles already carry an `actions` array of joint-action tags (e.g.
"hip-flexion", "elbow-flexion") - each tag maps to one of the 8 region
labels already used by the UI's REGION_MAP (Shoulder, Elbow, Wrist & hand,
Hip, Knee, Ankle & foot, Spine & back, Torso). For a multi-joint muscle the
label with the most matching tags wins; ties break toward the more distal
joint (elbow over shoulder, knee over hip, ankle over knee), matching how
these muscles are conventionally taught (e.g. biceps brachii -> Elbow even
though it also flexes the shoulder). Validated against 9 known multi-joint
muscles (biceps brachii, gastrocnemius, semitendinosus, rectus femoris,
sartorius, deltoid, latissimus dorsi, trapezius) before running for real.

back-core's 24 muscles don't carry a joint-action tag at all (their tags are
neck-*/spinal-*/trunk-*/core-stabilisation/respiration, none of which name a
limb joint), so they're an explicit override below rather than inferred.
"""
import json, os

ROOT = os.path.dirname(os.path.abspath(__file__))

# joint-action tag prefix -> REGION_MAP label (see msk-quiz.html's REGION_MAP)
TAG_TO_LABEL = {}
for tag in ["elbow-extension", "elbow-flexion", "forearm-pronation", "forearm-supination"]:
    TAG_TO_LABEL[tag] = "Elbow"
for tag in ["shoulder-abduction", "shoulder-adduction", "shoulder-extension", "shoulder-external-rotation",
            "shoulder-flexion", "shoulder-internal-rotation", "glenohumeral-stabilisation",
            "scapular-depression", "scapular-downward-rotation", "scapular-elevation",
            "scapular-protraction", "scapular-retraction", "scapular-upward-rotation"]:
    TAG_TO_LABEL[tag] = "Shoulder"
for tag in ["hip-abduction", "hip-adduction", "hip-extension", "hip-external-rotation",
            "hip-flexion", "hip-internal-rotation"]:
    TAG_TO_LABEL[tag] = "Hip"
for tag in ["knee-extension", "knee-external-rotation", "knee-flexion", "knee-internal-rotation"]:
    TAG_TO_LABEL[tag] = "Knee"
for tag in ["ankle-dorsiflexion", "ankle-plantarflexion", "foot-eversion", "foot-inversion",
            "toe-abduction", "toe-adduction", "toe-extension", "toe-flexion"]:
    TAG_TO_LABEL[tag] = "Ankle & foot"
for tag in ["wrist-extension", "wrist-flexion", "radial-deviation", "ulnar-deviation",
            "finger-abduction", "finger-adduction", "finger-extension", "finger-flexion",
            "finger-opposition", "thumb-abduction", "thumb-adduction", "thumb-extension",
            "thumb-flexion", "thumb-opposition"]:
    TAG_TO_LABEL[tag] = "Wrist & hand"

# distal-first tiebreak order (see module docstring)
LABEL_PRIORITY = ["Elbow", "Wrist & hand", "Ankle & foot", "Knee", "Shoulder", "Hip"]

# Vote-counting by action-tag label picks the label with the most listed
# *sub*-actions, which isn't the same as "primary mover" - the data doesn't
# distinguish a cardinal action from a secondary/assistive one. Verified by
# hand against every muscle whose actions span more than one label (10 of
# them); these 4 came out wrong and are overridden directly:
#   gracilis: hip-adduction(1) vs knee-flexion+knee-internal-rotation(2) picks
#     Knee, but gracilis is grouped with the adductor muscles (adductor
#     longus/brevis/magnus/gracilis) and taught as a hip adductor first - its
#     knee-flexion role is secondary (small cross-section at the knee).
#   triceps-brachii: elbow-extension(1) vs shoulder-extension+
#     shoulder-adduction(2) picks Shoulder, but triceps is THE textbook elbow
#     extensor; only the long head crosses the shoulder, secondarily.
#   gastrocnemius / plantaris: ankle-plantarflexion(1) vs knee-flexion(1) is
#     an exact tie, which should go to the more distal joint (ankle) per the
#     priority list above - these two were computed before that list got its
#     ordering bug fixed, so they're pinned here rather than re-trusted blind.
MULTI_JOINT_OVERRIDE = {
    "gracilis": "Hip",
    "triceps-brachii": "Elbow",
    "gastrocnemius": "Ankle & foot",
    "plantaris": "Ankle & foot",
}

# back-core: no action tag names a limb joint, so classify directly.
BACK_CORE_OVERRIDE = {
    "diaphragm": "Torso",
    "external-intercostals": "Torso",
    "internal-intercostals": "Torso",
    "rectus-abdominis": "Torso",
    "external-oblique": "Torso",
    "internal-oblique": "Torso",
    "transversus-abdominis": "Torso",
    "quadratus-lumborum": "Torso",
    "sternocleidomastoid": "Spine & back",
    "scalene-anterior": "Spine & back",
    "scalene-middle": "Spine & back",
    "scalene-posterior": "Spine & back",
    "splenius-capitis": "Spine & back",
    "splenius-cervicis": "Spine & back",
    "iliocostalis": "Spine & back",
    "longissimus": "Spine & back",
    "spinalis": "Spine & back",
    "semispinalis": "Spine & back",
    "multifidus": "Spine & back",
    "rotatores": "Spine & back",
    "interspinales": "Spine & back",
    "intertransversarii": "Spine & back",
    "longus-colli": "Spine & back",
    "longus-capitis": "Spine & back",
}


def primary_joint_for(m):
    if m["id"] in BACK_CORE_OVERRIDE:
        return BACK_CORE_OVERRIDE[m["id"]]
    if m["id"] in MULTI_JOINT_OVERRIDE:
        return MULTI_JOINT_OVERRIDE[m["id"]]
    votes = {}
    for tag in m.get("actions", []):
        label = TAG_TO_LABEL.get(tag)
        if label:
            votes[label] = votes.get(label, 0) + 1
    if not votes:
        return None
    best = max(votes.values())
    tied = [label for label, v in votes.items() if v == best]
    if len(tied) == 1:
        return tied[0]
    for label in LABEL_PRIORITY:
        if label in tied:
            return label
    return tied[0]


path = os.path.join(ROOT, "muscles.json")
data = json.load(open(path, encoding="utf-8"))
unclassified = []
counts = {}
for m in data["muscles"]:
    label = primary_joint_for(m)
    if label is None:
        unclassified.append(m["id"])
        continue
    m["primaryJoint"] = label
    counts[label] = counts.get(label, 0) + 1

json.dump(data, open(path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print(f"[add_primary_joint] tagged {sum(counts.values())} of {len(data['muscles'])} muscles")
for label, n in sorted(counts.items(), key=lambda kv: -kv[1]):
    print(f"  {label}: {n}")
if unclassified:
    print(f"[warn] {len(unclassified)} muscles got no label: {unclassified}")
