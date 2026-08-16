"""merge_posterior_hotspots.py — fold hotspots-posterior.json (traced from
renders/masks-posterior) into hotspots.json AND msk-quiz.html's embedded
hotspot-data JSON, under "<region>-posterior" keys.

    python merge_posterior_hotspots.py
"""
import json, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))

posterior = json.load(open(os.path.join(ROOT, "hotspots-posterior.json"), encoding="utf-8"))


def merge_into(hotspots_obj):
    n = 0
    for region, entries in posterior["hotspots"].items():
        key = f"{region}-posterior"
        hotspots_obj[key] = entries
        n += len(entries)
    return n


# hotspots.json
main_path = os.path.join(ROOT, "hotspots.json")
main = json.load(open(main_path, encoding="utf-8"))
n = merge_into(main["hotspots"])
json.dump(main, open(main_path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print(f"[hotspots.json] merged {n} posterior hotspots")

# msk-quiz.html embedded hotspot-data JSON
html_path = os.path.join(ROOT, "msk-quiz.html")
html = open(html_path, encoding="utf-8").read()
m = re.search(r'(<script id="hotspot-data" type="application/json">)(.*?)(</script>)', html, re.S)
if not m:
    raise SystemExit("could not find hotspot-data script block in msk-quiz.html")
embedded = json.loads(m.group(2))
n_embedded = merge_into(embedded["hotspots"])
new_blob = json.dumps(embedded, indent=2, ensure_ascii=False)
html = html[:m.start()] + m.group(1) + new_blob + m.group(3) + html[m.end():]
open(html_path, "w", encoding="utf-8").write(html)
print(f"[msk-quiz.html] merged {n_embedded} posterior hotspots into embedded hotspot-data JSON")
