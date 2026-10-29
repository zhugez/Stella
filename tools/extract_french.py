import json
import os
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

INDEX_FILE = '/home/dev/stella/public/atlas/index.json'
OUT_FILE = '/home/dev/stella/public/atlas/french_map.json'

def translate_batch_fr(batch):
    joined = '\n'.join(batch)
    params = urllib.parse.urlencode({'client': 'gtx', 'sl': 'en', 'tl': 'fr', 'dt': 't', 'q': joined})
    url = f'https://translate.googleapis.com/translate_a/single?{params}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                full = ''.join(seg[0] for seg in data[0] if seg and seg[0])
                lines = [p.strip().lower() for p in full.split('\n')]
                if len(lines) == len(batch):
                    return {b: l for b, l in zip(batch, lines)}
                res = {}
                for i in range(min(len(batch), len(lines))):
                    res[batch[i]] = lines[i]
                return res
        except Exception:
            time.sleep(1 + attempt)
    return {}

def get_glosbe_audio(item):
    w_id, fr_word = item
    if not fr_word:
        return w_id, ""
    encoded_fr = urllib.parse.quote(fr_word)
    g_url = f'https://vi.glosbe.com/api/audios/fr/{encoded_fr}'
    g_req = urllib.request.Request(g_url, headers={'User-Agent': 'Mozilla/5.0'})
    for attempt in range(2):
        try:
            with urllib.request.urlopen(g_req, timeout=5) as resp:
                g_data = json.loads(resp.read().decode('utf-8'))
                entries = g_data.get('phraseAudioCarrier', {}).get('audioEntries', [])
                for e in entries:
                    if e.get('phrase', '').lower() == fr_word:
                        mp3_file = e.get('url', {}).get('mp3')
                        if mp3_file:
                            return w_id, f'https://glosbe.com/fb_aud/mp3/{mp3_file}'
                if entries:
                    mp3_file = entries[0].get('url', {}).get('mp3')
                    if mp3_file:
                        return w_id, f'https://glosbe.com/fb_aud/mp3/{mp3_file}'
        except Exception:
            time.sleep(0.5)
    return w_id, ""

def main():
    with open(INDEX_FILE, 'r', encoding='utf-8') as f:
        idx_data = json.load(f)

    words = [r[1] for r in idx_data.get('words', [])]
    word_ids = [r[0] for r in idx_data.get('words', [])]
    print(f"Loaded {len(words)} words from index.json")

    # Step 1: Translate all words to French in batches of 40
    print("Translating words to French...")
    BATCH_SIZE = 40
    batches = [words[i:i + BATCH_SIZE] for i in range(0, len(words), BATCH_SIZE)]
    
    fr_word_map = {}
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(translate_batch_fr, batches))
    for r in results:
        fr_word_map.update(r)

    print(f"Translated {len(fr_word_map)}/{len(words)} French words in {time.time() - t0:.2f}s!")

    # Step 2: Fetch native French audio for words from Glosbe
    print("Fetching native French audio tracks from Glosbe...")
    items = []
    for w_id, w in zip(word_ids, words):
        fr = fr_word_map.get(w, "")
        items.append((w_id, fr))

    audio_map = {}
    t1 = time.time()
    with ThreadPoolExecutor(max_workers=15) as executor:
        audio_results = list(executor.map(get_glosbe_audio, items))
    for w_id, aud in audio_results:
        audio_map[w_id] = aud

    has_audio = sum(1 for a in audio_map.values() if a)
    print(f"Extracted {has_audio} native audio tracks from Glosbe in {time.time() - t1:.2f}s!")

    # Step 3: Combine and save
    final_map = {}
    for w_id, w in zip(word_ids, words):
        final_map[w_id] = {
            "fr_word": fr_word_map.get(w, ""),
            "fr_audio": audio_map.get(w_id, "")
        }

    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_map, f, ensure_ascii=False, indent=2)

    print(f"Successfully saved {len(final_map)} French entries to {OUT_FILE}!")

if __name__ == '__main__':
    main()
