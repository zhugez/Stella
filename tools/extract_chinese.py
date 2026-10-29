import glob
import json
import os
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ATLAS_PATH = os.path.join(BASE_DIR, "data", "word-atlas.json")
ENTRIES_DIR = os.path.join(BASE_DIR, "public", "atlas", "entries")
OUTPUT_PATH = os.path.join(BASE_DIR, "public", "atlas", "chinese_map.json")


def extract_concise_chinese(zh_def: str) -> str:
    if not zh_def:
        return ""
    s = re.split(r"[；;]", zh_def)[0].strip()
    s = re.sub(r"（.*?）|\(.*?\)", "", s).strip()
    s = re.sub(r"《(.*?)》", r"\1", s).strip()
    s = s.strip("《》“”\"'！! ")
    s = s.strip("…. ")
    return s


def build_chinese_map():
    if not os.path.exists(ATLAS_PATH):
        raise FileNotFoundError(f"Missing {ATLAS_PATH}")
    with open(ATLAS_PATH, "r", encoding="utf-8") as f:
        atlas_data = json.load(f)

    entry_files = sorted(
        glob.glob(os.path.join(ENTRIES_DIR, "*.json")),
        key=lambda p: int(os.path.basename(p).split(".")[0]),
    )
    entries_map = {}
    for p in entry_files:
        with open(p, "r", encoding="utf-8") as f:
            for item in json.load(f):
                entries_map[item["w"]] = item

    chinese_map = {}
    for item in atlas_data:
        word = item["w"]
        senses = item.get("senses", [])
        if not senses and word in entries_map:
            senses = entries_map[word].get("senses", [])

        zh_def = senses[0].get("zh", "").strip() if senses else ""
        zh_word = extract_concise_chinese(zh_def)

        if not zh_word and zh_def:
            zh_word = re.split(r"[；;]", zh_def)[0].strip()

        chinese_map[word] = {
            "zh_word": zh_word,
            "zh_def": zh_def,
        }

    total = len(chinese_map)
    empty_headwords = [w for w, v in chinese_map.items() if not v["zh_word"]]
    empty_defs = [w for w, v in chinese_map.items() if not v["zh_def"]]

    print(f"Total words mapped: {total}")
    print(f"Empty Chinese headwords: {len(empty_headwords)}")
    print(f"Empty Chinese definitions: {len(empty_defs)}")

    if total != 7298:
        raise ValueError(f"Expected 7,298 words, got {total}")
    if empty_headwords:
        raise ValueError(f"Found {len(empty_headwords)} empty Chinese headwords: {empty_headwords[:10]}")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(chinese_map, f, ensure_ascii=False, indent=2)

    print(f"Successfully saved {total} entries to {OUTPUT_PATH}")
    return chinese_map


if __name__ == "__main__":
    build_chinese_map()
