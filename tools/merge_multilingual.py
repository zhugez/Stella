import glob
import json
import os

ZH_MAP_FILE = '/home/dev/stella/public/atlas/chinese_map.json'
FR_MAP_FILE = '/home/dev/stella/public/atlas/french_map.json'
INDEX_FILE = '/home/dev/stella/public/atlas/index.json'
ENTRIES_DIR = '/home/dev/stella/public/atlas/entries'

with open(ZH_MAP_FILE, 'r', encoding='utf-8') as f:
    zh_map = json.load(f)

with open(FR_MAP_FILE, 'r', encoding='utf-8') as f:
    fr_map = json.load(f)

print(f"Loaded {len(zh_map)} Chinese entries and {len(fr_map)} French entries.")

# Update all 73 chunk files
updated_entries = 0
for p in sorted(glob.glob(f"{ENTRIES_DIR}/*.json")):
    with open(p, 'r', encoding='utf-8') as f:
        data = json.load(f)
    for e in data:
        w_id = e.get('id')
        if w_id in zh_map:
            e['zh_word'] = zh_map[w_id].get('zh_word', '')
            if not e.get('zh'):
                e['zh'] = zh_map[w_id].get('zh_def', '')
        if w_id in fr_map:
            e['fr_word'] = fr_map[w_id].get('fr_word', '')
            e['fr_audio'] = fr_map[w_id].get('fr_audio', '')
        updated_entries += 1
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Successfully updated {updated_entries} entries in chunk files!")

# Update index.json to include zh_word and fr_word for instant 4-language search
with open(INDEX_FILE, 'r', encoding='utf-8') as f:
    idx_data = json.load(f)

# Each row: [id, word, vi_def, ipa, cefr, topic, media, zh_word, fr_word]
new_rows = []
for r in idx_data.get('words', []):
    w_id = r[0]
    zh_w = zh_map.get(w_id, {}).get('zh_word', '')
    fr_w = fr_map.get(w_id, {}).get('fr_word', '')
    new_rows.append([r[0], r[1], r[2], r[3], r[4], r[5], r[6], zh_w, fr_w])

idx_data['words'] = new_rows
idx_data['fields'] = ['id', 'word', 'vi', 'ipa', 'cefr', 'topic', 'media', 'zh', 'fr']

with open(INDEX_FILE, 'w', encoding='utf-8') as f:
    json.dump(idx_data, f, ensure_ascii=False, separators=(',', ':'))

print(f"Successfully updated index.json with 4-language index ({len(new_rows)} words)!")
