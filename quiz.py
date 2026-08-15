"""
quiz.py — region- and question-type-filtered muscle quiz, driven by muscles.json.

    python3 quiz.py [--data muscles.json]

Lets you narrow a study session to the body regions and question types you
actually want to be drilled on, then run it as open-ended practice or a
scored assessment of N questions, self-graded (flashcard) or auto-graded
(multiple choice).

Region filtering note: muscles.json only tags each muscle with one of 5 broad
regions (shoulder-arm, forearm-hand, hip-thigh, lower-leg-foot, back-core).
The picker below offers 10 finer-grained labels but several of them collapse
onto the same underlying region (e.g. Shoulder and Elbow both resolve to
shoulder-arm), so they currently produce identical question pools. See
REGION_MAP.
"""
import json
import os
import random
import argparse
from dataclasses import dataclass, field

REGION_MAP = {
    "All upper limb": ["shoulder-arm", "forearm-hand"],
    "Shoulder": ["shoulder-arm"],
    "Elbow": ["shoulder-arm"],
    "Wrist & hand": ["forearm-hand"],
    "All lower limb": ["hip-thigh", "lower-leg-foot"],
    "Hip": ["hip-thigh"],
    "Knee": ["hip-thigh"],
    "Ankle & foot": ["lower-leg-foot"],
    "Spine & back": ["back-core"],
    "Torso": ["back-core"],
}
REGION_LABELS = list(REGION_MAP.keys())

QUESTION_TYPES = ["identify", "origin", "insertion", "nerve", "action"]


@dataclass
class Question:
    muscle_id: str
    qtype: str
    prompt: str
    answer: str
    choices: list = field(default_factory=list)  # populated for multiple-choice


def load_data(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data["muscles"], data.get("indexes", {})


def humanize_tag(tag):
    return tag.replace("-", " ")


def open_image_if_present(muscle):
    for key in ("isolated", "hotspot"):
        rel = muscle.get("images", {}).get(key)
        if rel and os.path.exists(rel):
            try:
                os.startfile(rel)  # Windows
            except OSError:
                pass
            return True
    return False


# --- question-content generators: (prompt, correct-answer) per type ---

def gen_identify(muscle):
    if open_image_if_present(muscle):
        return "Which muscle is shown in the image that just opened?", muscle["name"]
    clue_bits = []
    if muscle.get("origin"):
        clue_bits.append("originates at " + "; ".join(muscle["origin"]))
    if muscle.get("actionText"):
        clue_bits.append(muscle["actionText"])
    clue = " ".join(clue_bits) or "No clues available for this muscle."
    return f"Name the muscle: {clue}", muscle["name"]


def gen_origin(muscle):
    return f"What is the origin of {muscle['name']}?", "; ".join(muscle.get("origin") or ["(none recorded)"])


def gen_insertion(muscle):
    return f"What is the insertion of {muscle['name']}?", "; ".join(muscle.get("insertion") or ["(none recorded)"])


def gen_nerve(muscle):
    names = [n["name"] for n in muscle.get("nerve") or []]
    return f"What nerve innervates {muscle['name']}?", "; ".join(names) or "(none recorded)"


def gen_action(muscle):
    text = muscle.get("actionText") or ", ".join(humanize_tag(t) for t in muscle.get("actions") or [])
    return f"What is the action of {muscle['name']}?", text or "(none recorded)"


GENERATORS = {
    "identify": gen_identify,
    "origin": gen_origin,
    "insertion": gen_insertion,
    "nerve": gen_nerve,
    "action": gen_action,
}


# --- multiple-choice distractor pools ---

def distractors_identify(muscle, pool, all_muscles, n=3):
    others = [m["name"] for m in pool if m["id"] != muscle["id"]]
    if len(others) < n:
        others = [m["name"] for m in all_muscles if m["id"] != muscle["id"]]
    return random.sample(others, min(n, len(others)))


def distractors_nerve(muscle, indexes, n=3):
    correct = {nv["name"] for nv in muscle.get("nerve") or []}
    candidates = [k for k in indexes.get("byNerve", {}).keys() if k not in correct]
    return random.sample(candidates, min(n, len(candidates)))


def distractors_action(muscle, indexes, n=3):
    own = set(muscle.get("actions") or [])
    candidates = [humanize_tag(k) for k in indexes.get("byAction", {}).keys() if k not in own]
    return random.sample(candidates, min(n, len(candidates)))


def distractors_text_field(muscle, pool, all_muscles, field_name, n=3):
    def values(muscles):
        out = []
        for m in muscles:
            if m["id"] == muscle["id"]:
                continue
            v = "; ".join(m.get(field_name) or [])
            if v:
                out.append(v)
        return out

    candidates = values(pool)
    if len(candidates) < n:
        candidates = values(all_muscles)
    candidates = list(dict.fromkeys(candidates))  # dedupe, preserve order
    return random.sample(candidates, min(n, len(candidates)))


def build_choices(question, muscle, pool, all_muscles, indexes):
    if question.qtype == "identify":
        distractors = distractors_identify(muscle, pool, all_muscles)
    elif question.qtype == "nerve":
        distractors = distractors_nerve(muscle, indexes)
    elif question.qtype == "action":
        distractors = distractors_action(muscle, indexes)
    elif question.qtype in ("origin", "insertion"):
        distractors = distractors_text_field(muscle, pool, all_muscles, question.qtype)
    else:
        distractors = []
    choices = distractors + [question.answer]
    random.shuffle(choices)
    return choices


# --- filter pickers ---

def pick_checklist(label, options):
    print(f"\n{label}")
    for i, opt in enumerate(options, 1):
        print(f"  {i}. {opt}")
    raw = input("Enter numbers separated by commas, or 'all': ").strip().lower()
    if raw == "all" or raw == "":
        return list(options)
    picked = []
    for tok in raw.split(","):
        tok = tok.strip()
        if not tok.isdigit():
            continue
        idx = int(tok) - 1
        if 0 <= idx < len(options):
            picked.append(options[idx])
    return picked or list(options)


def filter_by_regions(muscles, selected_labels):
    data_regions = set()
    for label in selected_labels:
        data_regions.update(REGION_MAP[label])
    return [m for m in muscles if m.get("region") in data_regions]


def build_pool(muscles, qtypes):
    pool = []
    for m in muscles:
        for qt in qtypes:
            pool.append((m, qt))
    return pool


# --- session runners ---

def ask_flashcard(prompt, answer):
    input(f"\n{prompt}\n(press Enter to reveal answer) ")
    print(f"Answer: {answer}")
    resp = input("Did you get it right? (y/n): ").strip().lower()
    return resp.startswith("y")


def ask_multiple_choice(question):
    print(f"\n{question.prompt}")
    for i, choice in enumerate(question.choices, 1):
        print(f"  {i}. {choice}")
    raw = input("Your answer (number): ").strip()
    if not raw.isdigit():
        return False
    idx = int(raw) - 1
    return 0 <= idx < len(question.choices) and question.choices[idx] == question.answer


def run_session(muscles, indexes, num_questions, answer_style):
    labels = pick_checklist("Select body regions to include:", REGION_LABELS)
    filtered = filter_by_regions(muscles, labels)
    if not filtered:
        print("No muscles match that region selection.")
        return

    qtypes = pick_checklist("Select question types to include:", QUESTION_TYPES)
    pool = build_pool(filtered, qtypes)
    if not pool:
        print("No question types selected.")
        return

    print(f"\n{len(filtered)} muscles, {len(pool)} possible questions in the pool.")

    if num_questions is not None:
        num_questions = min(num_questions, len(pool))
        sample = random.sample(pool, num_questions)
    else:
        sample = pool[:]
        random.shuffle(sample)

    correct = 0
    total = 0
    by_type = {}

    for muscle, qtype in sample:
        prompt, answer = GENERATORS[qtype](muscle)
        q = Question(muscle_id=muscle["id"], qtype=qtype, prompt=prompt, answer=answer)

        if answer_style == "multiple-choice":
            q.choices = build_choices(q, muscle, filtered, muscles, indexes)
            got_it = ask_multiple_choice(q)
        else:
            got_it = ask_flashcard(q.prompt, q.answer)

        total += 1
        by_type.setdefault(qtype, [0, 0])
        by_type[qtype][1] += 1
        if got_it:
            correct += 1
            by_type[qtype][0] += 1

        if num_questions is None:
            more = input("Continue? (y/n): ").strip().lower()
            if not more.startswith("y"):
                break

    print(f"\nScore: {correct} / {total} correct")
    if len(by_type) > 1:
        for qtype, (c, t) in by_type.items():
            print(f"  {qtype}: {c} / {t}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="muscles.json")
    args = ap.parse_args()

    muscles, indexes = load_data(args.data)

    mode = input("Mode — practice (open-ended) or assessment (fixed count)? [practice/assessment]: ").strip().lower()
    num_questions = None
    if mode.startswith("a"):
        raw = input("How many questions? ").strip()
        num_questions = int(raw) if raw.isdigit() else 10

    style = input("Answer style — flashcard (self-graded) or multiple-choice (auto-graded)? [flashcard/multiple-choice]: ").strip().lower()
    answer_style = "multiple-choice" if style.startswith("m") else "flashcard"

    run_session(muscles, indexes, num_questions, answer_style)


if __name__ == "__main__":
    main()
