"""populate_landmark_images.py - fills landmarks.json's images block from
render_landmarks.py's output (renders/isolated/<id>.png for solid landmarks,
landmark-pins.json for pin landmarks referencing a shared context image).

    python3 populate_landmark_images.py
"""
import json, os

CREDIT = ("Derived from Z-Anatomy (Gauthier Kervyn et al.), based on BodyParts3D "
          "(Database Center for Life Science).")
LICENCE = "CC BY-SA 4.0"

landmarks = json.load(open("landmarks.json", encoding="utf-8"))
pins = json.load(open("landmark-pins.json", encoding="utf-8"))["pins"]

solid, pin = 0, 0
for lm in landmarks["landmarks"]:
    lid = lm["id"]
    isolated_rel = os.path.join("renders", "isolated", f"{lid}.png").replace("\\", "/")
    if os.path.exists(isolated_rel):
        lm["images"]["isolated"] = isolated_rel
        lm["images"]["credit"] = CREDIT
        lm["images"]["licence"] = LICENCE
        lm["kind"] = "solid"
        solid += 1
    elif lid in pins:
        p = pins[lid]
        lm["images"]["hotspot"] = p["contextImage"]
        lm["images"]["credit"] = CREDIT
        lm["images"]["licence"] = LICENCE
        lm["pin"] = {"x": p["x"], "y": p["y"], "approximate": p["approximate"]}
        lm["kind"] = "pin"
        pin += 1

json.dump(landmarks, open("landmarks.json", "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print(f"populated {solid} solid + {pin} pin landmarks / {len(landmarks['landmarks'])} total")
