import json
import os
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

def translate_one(text):
    text = text.strip()
    if not text:
        return ""
    params = urllib.parse.urlencode({'client': 'gtx', 'sl': 'en', 'tl': 'vi', 'dt': 't', 'q': text})
    url = f'https://translate.googleapis.com/translate_a/single?{params}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                return ''.join(seg[0] for seg in data[0] if seg and seg[0]).strip()
        except Exception:
            time.sleep(0.5)
    return text

def process_chunk(chunk_id):
    path = f'/home/dev/stella/public/atlas/entries/{chunk_id}.json'
    if not os.path.exists(path):
        return False, 0
    with open(path, 'r', encoding='utf-8') as f:
        entries = json.load(f)

    # Collect tasks
    tasks = [] # (entry_idx, kind, sub_idx, text)
    for e_idx, e in enumerate(entries):
        for s_idx, s in enumerate(e.get('senses', [])):
            if not s.get('vi') and s.get('en'):
                tasks.append((e_idx, 'sense', s_idx, s['en']))
        for x_idx, x in enumerate(e.get('ex', [])):
            if not x.get('vi') and x.get('en'):
                tasks.append((e_idx, 'ex', x_idx, x['en']))
        for c_idx, c in enumerate(e.get('col', [])):
            parts = c.split('｜')
            if len(parts) > 0 and (len(parts) < 2 or not parts[1].strip() or any('\u4e00' <= ch <= '\u9fff' for ch in parts[1])):
                tasks.append((e_idx, 'col', c_idx, parts[0].strip()))

    if not tasks:
        print(f"Chunk {chunk_id}: already 100% translated.")
        return True, len(entries)

    texts = [t[3] for t in tasks]
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=20) as executor:
        translations = list(executor.map(translate_one, texts))

    for idx, item in enumerate(tasks):
        e_idx, kind, sub_idx, _ = item
        vi = translations[idx].strip()
        if not vi:
            continue
        if kind == 'sense':
            entries[e_idx]['senses'][sub_idx]['vi'] = vi
        elif kind == 'ex':
            entries[e_idx]['ex'][sub_idx]['vi'] = vi
        elif kind == 'col':
            orig_en = entries[e_idx]['col'][sub_idx].split('｜')[0].strip()
            entries[e_idx]['col'][sub_idx] = f"{orig_en}｜{vi}"

    for e in entries:
        if not e.get('tip_vi'):
            e['tip_vi'] = f"Trong bài thi IELTS, chú ý ngữ cảnh và cách dùng tự nhiên của từ \"{e.get('w', '')}\"."

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)

    dt = time.time() - t0
    print(f"Chunk {chunk_id}: translated {len(tasks)} phrases across {len(entries)} words in {dt:.2f}s!")
    return True, len(entries)

if __name__ == '__main__':
    if len(sys.argv) > 2:
        start_chunk = int(sys.argv[1])
        end_chunk = int(sys.argv[2])
    elif len(sys.argv) == 2:
        start_chunk = int(sys.argv[1])
        end_chunk = int(sys.argv[1])
    else:
        start_chunk, end_chunk = 22, 25

    total_words = 0
    t_start = time.time()
    for c in range(start_chunk, end_chunk + 1):
        ok, cnt = process_chunk(c)
        if ok:
            total_words += cnt

    total_time = time.time() - t_start
    print(f"=== FINISHED {end_chunk - start_chunk + 1} CHUNKS ({total_words} WORDS) IN {total_time:.2f} SECONDS! ===")
