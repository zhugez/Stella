import type { Entry } from "../atlas/types";
import type { Progress } from "../store/store";
import { gap, headwordPattern, shuffle, splitHighlight, splitPair } from "./text";

/** Words the scheduler keeps forgetting, hardest first. Only lapsed cards qualify. */
export function weakWords(p: Progress, limit = 8): string[] {
  return Object.entries(p.cards)
    .filter(([, c]) => c.lapses > 0)
    .sort((a, b) => b[1].lapses - a[1].lapses || b[1].d - a[1].d)
    .slice(0, limit)
    .map(([id]) => id);
}

/** The form a cloze round asks for: the headword as it appears in the sentence, or null if absent or repeated. */
export function clozeTarget(entry: Entry): string | null {
  const g = gap(entry.ex[0].en, entry.w);
  if (!g) return null;
  // A second occurrence would print the answer in the visible sentence. Test the two segments
  // separately: gluing them together could invent a match across the removed word.
  const p = headwordPattern(entry.w);
  return p.test(g.before) || p.test(g.after) ? null : g.hidden;
}

function maskCol(entry: Entry, raw: string): { masked: string; full: string; gloss: string } | null {
  const pair = splitPair(raw);
  if (!pair.en) return null;
  const p = new RegExp(headwordPattern(entry.w).source, "gi");
  if (!p.test(pair.en)) return null;
  const masked = pair.en.replace(p, "___");
  return { masked, full: pair.en, gloss: pair.vi || pair.zh };
}

/** One collocation question: a masked collocation of `target` plus three borrowed from other words. */
export function collocationQuestion(
  target: Entry,
  pool: Entry[],
  seed: number,
): { answer: string; options: string[]; full: string; gloss: string } | null {
  const targetMasked = (target.col || [])
    .map((c) => maskCol(target, c))
    .filter((x): x is NonNullable<typeof x> => !!x);
  if (!targetMasked.length) return null;
  const chosen = shuffle(targetMasked, seed)[0];
  const targetFrames = new Set(targetMasked.map((c) => c.masked.toLowerCase()));

  const targetRelated = new Set([
    ...target.syn.map((s) => splitPair(s).en.toLowerCase()),
    ...target.ant.map((s) => splitPair(s).en.toLowerCase()),
  ]);

  const targetW = target.w.toLowerCase();
  const targetPos = target.senses[0]?.pos;

  const samePosCandidates: string[] = [];
  const otherPosCandidates: string[] = [];

  for (const entry of pool) {
    if (entry.id === target.id) continue;
    const entryW = entry.w.toLowerCase();
    if (targetRelated.has(entryW)) continue;
    const entryRelated = [
      ...entry.syn.map((s) => splitPair(s).en.toLowerCase()),
      ...entry.ant.map((s) => splitPair(s).en.toLowerCase()),
    ];
    if (entryRelated.includes(targetW)) continue;

    const isSamePos = !!targetPos && entry.senses[0]?.pos === targetPos;

    for (const c of entry.col || []) {
      const m = maskCol(entry, c);
      if (!m) continue;
      const lower = m.masked.toLowerCase();
      if (targetFrames.has(lower)) continue;
      if (isSamePos) samePosCandidates.push(m.masked);
      else otherPosCandidates.push(m.masked);
    }
  }

  const seen = new Set<string>();
  const distractors: string[] = [];

  const addUnique = (list: string[]) => {
    for (const item of list) {
      const lower = item.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        distractors.push(item);
        if (distractors.length === 3) break;
      }
    }
  };

  addUnique(shuffle(samePosCandidates, seed + 7));
  if (distractors.length < 3) {
    addUnique(shuffle(otherPosCandidates, seed + 11));
  }

  if (distractors.length < 3) return null;
  return {
    answer: chosen.masked,
    full: chosen.full,
    gloss: chosen.gloss,
    options: shuffle([chosen.masked, ...distractors], seed + 13),
  };
}

/** Sentences long enough to read as a passage, keeping the order given. */
export function passage(entries: Entry[], size = 6): Entry[] {
  return entries
    .filter((e) => e.ex[0]?.en && e.ex[0].en.length > 30 && splitHighlight(e.ex[0].en, e.w))
    .slice(0, size);
}
