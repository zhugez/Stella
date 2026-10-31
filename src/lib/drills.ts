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

/** One collocation question: a real collocation of `target` plus three borrowed from other words. */
export function collocationQuestion(target: Entry, pool: Entry[], seed: number): { answer: string; options: string[] } | null {
  const mine = new Set(target.col.map((c) => splitPair(c).en.toLowerCase()));
  const answer = splitPair(shuffle(target.col, seed)[0] ?? "").en;
  if (!answer) return null;
  const borrowed = pool
    .filter((e) => e.id !== target.id)
    .flatMap((e) => e.col.map((c) => splitPair(c).en))
    .filter((en) => en && !mine.has(en.toLowerCase()));
  const distractors = shuffle([...new Set(borrowed)], seed + 7).slice(0, 3);
  if (distractors.length < 3) return null;
  return { answer, options: shuffle([answer, ...distractors], seed + 13) };
}

/** Sentences long enough to read as a passage, keeping the order given. */
export function passage(entries: Entry[], size = 6): Entry[] {
  return entries
    .filter((e) => e.ex[0]?.en && e.ex[0].en.length > 30 && splitHighlight(e.ex[0].en, e.w))
    .slice(0, size);
}
