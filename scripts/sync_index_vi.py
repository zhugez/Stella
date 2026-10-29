import json
import os

INDEX_PATH = '/home/dev/stella/public/atlas/index.json'
ENTRIES_DIR = '/home/dev/stella/public/atlas/entries'

with open(INDEX_PATH, 'r', encoding='utf-8') as f:
    index_data = json.load(f)

# Build a lookup map of id -> short definition string
defs_map = {}

for fname in sorted(os.listdir(ENTRIES_DIR)):
    if not fname.endswith('.json'):
        continue
    chunk_path = os.path.join(ENTRIES_DIR, fname)
    with open(chunk_path, 'r', encoding='utf-8') as f:
        try:
            chunk = json.load(f)
        except Exception:
            continue
    for entry in chunk:
        w_id = entry.get('id')
        senses = entry.get('senses', [])
        # Find first sense with 'vi'
        vi_sense = next((s for s in senses if s.get('vi')), None)
        if vi_sense:
            pos = vi_sense.get('pos', '').strip()
            vi = vi_sense.get('vi', '').strip()
            # If multiple vi senses, join up to 2
            other_vi = [s.get('vi', '').strip() for s in senses[1:] if s.get('vi')]
            combined = f"{pos} {vi}" if pos else vi
            if other_vi:
                combined += f"; {other_vi[0]}"
            defs_map[w_id] = combined

updated_count = 0
for row in index_data.get('words', []):
    w_id = row[0]
    if w_id in defs_map:
        row[2] = defs_map[w_id]
        updated_count += 1

with open(INDEX_PATH, 'w', encoding='utf-8') as f:
    json.dump(index_data, f, ensure_ascii=False, separators=(',', ':'))

print(f"Successfully synced {updated_count} word definitions in index.json!")
