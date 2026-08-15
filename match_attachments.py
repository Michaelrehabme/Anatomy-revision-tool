"""match_attachments.py - links muscles.json's free-text origin/insertion
strings to landmarks.json entries by substring match on the landmark name,
so the "___ attaches here" question type has real content: show a landmark
image, ask which muscle attaches there.

    python3 match_attachments.py

Writes attachments.json: [{muscleId, muscleName, landmarkId, landmarkName, relation}]
"""
import json, re


def norm(s):
    return re.sub(r"\s+", " ", s.lower().strip())


muscles = json.load(open("muscles.json", encoding="utf-8"))["muscles"]
landmarks = json.load(open("landmarks.json", encoding="utf-8"))["landmarks"]

# only landmarks with a usable image (solid render or pin+context) are worth matching
usable = [lm for lm in landmarks if lm.get("kind")]

matches = []
for m in muscles:
    for relation in ("origin", "insertion"):
        for text in m.get(relation) or []:
            nt = norm(text)
            for lm in usable:
                if norm(lm["name"]) in nt:
                    matches.append({
                        "muscleId": m["id"], "muscleName": m["name"],
                        "landmarkId": lm["id"], "landmarkName": lm["name"],
                        "relation": relation, "sourceText": text,
                    })

json.dump(matches, open("attachments.json", "w", encoding="utf-8"), indent=2, ensure_ascii=False)
by_landmark = {}
for x in matches:
    by_landmark.setdefault(x["landmarkId"], []).append(x["muscleName"])
print(f"{len(matches)} matches across {len(by_landmark)} landmarks (of {len(usable)} usable)")
for lid, names in sorted(by_landmark.items()):
    print(f"  {lid}: {names}")
