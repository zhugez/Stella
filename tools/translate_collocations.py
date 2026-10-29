import glob
import json
import os
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

zh_pattern = re.compile(r'[\u4e00-\u9fff]')

def translate_batch(batch):
    # batch is list of english phrases
    joined = '\n'.join(batch)
    params = urllib.parse.urlencode({'client': 'gtx', 'sl': 'en', 'tl': 'vi', 'dt': 't', 'q': joined})
    url = f'https://translate.googleapis.com/translate_a/single?{params}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                full = ''.join(seg[0] for seg in data[0] if seg and seg[0])
                lines = [p.strip() for p in full.split('\n')]
                if len(lines) == len(batch):
                    return {b: l for b, l in zip(batch, lines)}
                # If lengths differ slightly, match as many as possible
                res = {}
                for i in range(min(len(batch), len(lines))):
                    res[batch[i]] = lines[i]
                return res
        except Exception:
            time.sleep(1 + attempt)
    return {}

def main():
    entries_dir = '/home/dev/stella/public/atlas/entries'
    chunk_files = sorted(glob.glob(f'{entries_dir}/*.json'))

    # Step 1: Collect unique English collocation phrases that still have Chinese
    unique_en = set()
    for p in chunk_files:
        with open(p, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for e in data:
            for c in e.get('col', []):
                parts = c.split('｜')
                if len(parts) > 1 and zh_pattern.search(parts[1]):
                    unique_en.add(parts[0].strip())

    unique_list = sorted(list(unique_en))
    print(f"Total unique English collocations to translate: {len(unique_list)}")

    # Step 2: Batch translate
    BATCH_SIZE = 25
    batches = [unique_list[i:i + BATCH_SIZE] for i in range(0, len(unique_list), BATCH_SIZE)]
    print(f"Divided into {len(batches)} batches of {BATCH_SIZE}...")

    trans_map = {}
    t0 = time.time()
    
    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(translate_batch, batches))

    for r in results:
        trans_map.update(r)

    print(f"Translated {len(trans_map)}/{len(unique_list)} collocations in {time.time() - t0:.2f}s!")

    # Step 3: Replace in all chunk files
    replaced_count = 0
    for p in chunk_files:
        with open(p, 'r', encoding='utf-8') as f:
            data = json.load(f)
        modified = False
        for e in data:
            new_cols = []
            for c in e.get('col', []):
                parts = c.split('｜')
                en = parts[0].strip()
                if len(parts) > 1 and zh_pattern.search(parts[1]):
                    vi = trans_map.get(en)
                    if vi and not zh_pattern.search(vi):
                        new_cols.append(f"{en}｜{vi}")
                        replaced_count += 1
                        modified = True
                    else:
                        new_cols.append(c)
                else:
                    new_cols.append(c)
            e['col'] = new_cols

        if modified:
            with open(p, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Successfully replaced {replaced_count} collocations across chunk files!")

if __name__ == '__main__':
    main()
