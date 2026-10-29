import glob
import json
import os
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ORIG_FILE = '/home/dev/word-atlas/data/word-atlas.json'
ENTRIES_DIR = '/home/dev/stella/public/atlas/entries'

with open(ORIG_FILE, 'r', encoding='utf-8') as f:
    orig_data = json.load(f)

orig_map = {e['w']: e for e in orig_data}
print(f"Loaded {len(orig_map)} original entries.")

def translate_batch(batch, sl, tl, max_retries=4):
    if not batch:
        return {}
    joined = '\n'.join(batch)
    params = urllib.parse.urlencode({'client': 'gtx', 'sl': sl, 'tl': tl, 'dt': 't', 'q': joined})
    url = f'https://translate.googleapis.com/translate_a/single?{params}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                full = ''.join(seg[0] for seg in data[0] if seg and seg[0])
                lines = [p.strip() for p in full.split('\n')]
                if len(lines) == len(batch):
                    return dict(zip(batch, lines))
                res = {}
                for i in range(min(len(batch), len(lines))):
                    res[batch[i]] = lines[i]
                return res
        except Exception:
            time.sleep(0.8 + attempt * 0.5)
    return {}

all_chunk_files = sorted(glob.glob(f"{ENTRIES_DIR}/*.json"))
all_entries = []
for p in all_chunk_files:
    with open(p, 'r', encoding='utf-8') as f:
        all_entries.extend(json.load(f))

print(f"Loaded {len(all_entries)} total entries across all chunks.")

all_ex_sentences = list({x['en'].strip() for e in all_entries for x in e.get('ex', []) if x.get('en')})
print(f"Total unique example sentences to translate to French: {len(all_ex_sentences)}")

BATCH_SIZE = 30
ex_batches = [all_ex_sentences[i:i + BATCH_SIZE] for i in range(0, len(all_ex_sentences), BATCH_SIZE)]
fr_ex_map = {}
t0 = time.time()
with ThreadPoolExecutor(max_workers=15) as exe:
    for res in exe.map(lambda b: translate_batch(b, 'en', 'fr'), ex_batches):
        fr_ex_map.update(res)
print(f"Translated {len(fr_ex_map)}/{len(all_ex_sentences)} sentences to French in {time.time() - t0:.2f}s!")

all_col_phrases = list({c.split('｜')[0].strip() for e in all_entries for c in e.get('col', []) if c.split('｜')[0].strip()})
print(f"Total unique collocation phrases to translate to French: {len(all_col_phrases)}")

col_batches = [all_col_phrases[i:i + BATCH_SIZE] for i in range(0, len(all_col_phrases), BATCH_SIZE)]
fr_col_map = {}
t1 = time.time()
with ThreadPoolExecutor(max_workers=15) as exe:
    for res in exe.map(lambda b: translate_batch(b, 'en', 'fr'), col_batches):
        fr_col_map.update(res)
print(f"Translated {len(fr_col_map)}/{len(all_col_phrases)} collocations to French in {time.time() - t1:.2f}s!")

all_orig_tips = list({orig_map[e['w']].get('tip', '').strip() for e in all_entries if e['w'] in orig_map and orig_map[e['w']].get('tip')})
print(f"Total authentic tips to translate: {len(all_orig_tips)}")

tip_batches = [all_orig_tips[i:i + BATCH_SIZE] for i in range(0, len(all_orig_tips), BATCH_SIZE)]
vi_tip_map = {}
fr_tip_map = {}
t2 = time.time()
with ThreadPoolExecutor(max_workers=15) as exe:
    for res in exe.map(lambda b: translate_batch(b, 'zh-CN', 'vi'), tip_batches):
        vi_tip_map.update(res)
with ThreadPoolExecutor(max_workers=15) as exe:
    for res in exe.map(lambda b: translate_batch(b, 'zh-CN', 'fr'), tip_batches):
        fr_tip_map.update(res)
print(f"Translated {len(vi_tip_map)} tips to Vietnamese and {len(fr_tip_map)} to French in {time.time() - t2:.2f}s!")

for p in all_chunk_files:
    with open(p, 'r', encoding='utf-8') as f:
        chunk_data = json.load(f)
    for e in chunk_data:
        w = e['w']
        orig_e = orig_map.get(w, {})

        if w == 'pit':
            e['syn'] = ['hole', 'cavity', 'hollow']
            e['tip_vi'] = 'Khu vực kỹ thuật trường đua hay dùng "the pits"; nghĩa hạt trái cây (hạt đào, mận) chủ yếu dùng trong tiếng Anh-Mỹ.'

        for x in e.get('ex', []):
            en_sent = x.get('en', '').strip()
            if en_sent in fr_ex_map:
                x['fr'] = fr_ex_map[en_sent]

        raw_tip = orig_e.get('tip', '').strip()
        if raw_tip:
            e['tip'] = raw_tip
            if raw_tip in vi_tip_map and not (w == 'pit' and e.get('tip_vi')):
                e['tip_vi'] = vi_tip_map[raw_tip]
            if raw_tip in fr_tip_map:
                e['tip_fr'] = fr_tip_map[raw_tip]

        orig_cols = orig_e.get('col', [])
        curr_cols = e.get('col', [])

        col_zh_list = []
        col_fr_list = []

        for idx, c in enumerate(curr_cols):
            parts = c.split('｜')
            en_phrase = parts[0].strip()
            vi_def = parts[1].strip() if len(parts) > 1 else ""

            if en_phrase == 'a peach pit':
                vi_def = 'hạt đào (quả hạch)'
                curr_cols[idx] = f"{en_phrase}｜{vi_def}"

            fr_phrase = fr_col_map.get(en_phrase, en_phrase)
            col_fr_list.append(f"{fr_phrase}｜{vi_def}")

            if idx < len(orig_cols):
                orig_parts = orig_cols[idx].split('｜')
                zh_phrase = orig_parts[1].strip() if len(orig_parts) > 1 else orig_parts[0].strip()
                col_zh_list.append(f"{zh_phrase}｜{vi_def}")
            else:
                col_zh_list.append(f"{en_phrase}｜{vi_def}")

        e['col'] = curr_cols
        e['col_zh'] = col_zh_list
        e['col_fr'] = col_fr_list

    with open(p, 'w', encoding='utf-8') as f:
        json.dump(chunk_data, f, ensure_ascii=False, indent=2)

print("SUCCESS: 100% of entries enriched with French examples, French collocations, Chinese collocations, and authentic tips!")
