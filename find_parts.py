import json, sys

objs = json.load(open("objects.json", encoding="utf-8"))
real = [o for o in objs["objects"] if "4: Muscular system" in o.get("collections", []) and o.get("verts", 0) >= 50]
bases = sorted({o["base"] for o in real})

keywords = ["iliocostalis", "interspinales", "intertransversarii", "longissimus", "multifidus",
            "semispinalis", "spinalis", "adductor pollicis", "extensor carpi ulnaris",
            "flexor carpi ulnaris", "flexor digitorum superficialis", "flexor pollicis brevis",
            "pronator teres", "biceps femoris", "flexor hallucis brevis", "gastrocnemius",
            "biceps brachii", "deltoid", "pectoralis major", "trapezius", "triceps brachii"]

for kw in keywords:
    matches = [b for b in bases if kw in b.lower()]
    print(f"\n{kw}:")
    for m in matches:
        print(" ", m)
