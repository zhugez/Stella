import type { Entry } from "../atlas/types";
import type { Progress } from "../store/store";
import { gap, headwordPattern, normalize, shuffle, splitHighlight, splitPair } from "./text";

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

const lower = (s: string) => s.trim().toLowerCase();
const related = (e: Entry) => [...e.syn, ...e.ant].map(lower);

/** One paraphrase question: pick a synonym (or, with no synonyms, an antonym) of the word highlighted in its sentence. */
export function paraphraseQuestion(
  target: Entry,
  pool: Entry[],
  seed: number,
): { sentence: [string, string, string]; kind: "syn" | "ant"; answer: string; options: string[]; all: string[] } | null {
  const sentence = [target.ex[1], target.ex[0]].flatMap((x) => {
    const parts = x && splitHighlight(x.en, target.w);
    return parts ? [parts] : [];
  })[0];
  if (!sentence) return null;
  const kind = target.syn.length ? "syn" : "ant";
  const all = target[kind].map((s) => s.trim()).filter(Boolean);
  if (!all.length) return null;
  const answer = shuffle(all, seed)[0];

  const targetW = lower(target.w);
  const blocked = new Set([targetW, ...related(target)]);
  const targetPos = target.senses[0]?.pos;
  const byHeadword = new Map(pool.map((e) => [lower(e.w), e]));

  const samePos: string[] = [];
  const otherPos: string[] = [];
  for (const entry of pool) {
    if (entry.id === target.id || related(entry).includes(targetW)) continue;
    const bucket = !!targetPos && entry.senses[0]?.pos === targetPos ? samePos : otherPos;
    for (const word of [entry.w, ...entry.syn, ...entry.ant]) {
      const w = lower(word);
      // A candidate that is itself a pool headword is judged by its own lists too.
      if (blocked.has(w) || (byHeadword.get(w) && related(byHeadword.get(w)!).includes(targetW))) continue;
      bucket.push(word.trim());
    }
  }

  const seen = new Set(blocked);
  const distractors: string[] = [];
  for (const word of [...shuffle(samePos, seed + 7), ...shuffle(otherPos, seed + 11)]) {
    if (distractors.length === 3) break;
    if (seen.has(lower(word))) continue;
    seen.add(lower(word));
    distractors.push(word);
  }
  if (distractors.length < 3) return null;
  return { sentence, kind, answer, options: shuffle([answer, ...distractors], seed + 13), all };
}

export type Pos = "n" | "v" | "adj" | "adv";
export type FamilyMember = { word: string; pos: Pos };

const FAMILY_ITEM = /^(.+?)\s*\((n|v|adj|adv)\.\)$/;

/** "strength (n.)" → { word: "strength", pos: "n" }; items that do not match are dropped. */
export function parseFamily(entry: Entry): FamilyMember[] {
  return entry.fam.flatMap((item) => {
    const m = FAMILY_ITEM.exec(item.trim());
    return m ? [{ word: m[1], pos: m[2] as Pos }] : [];
  });
}

/** One word-family question: which family member has the asked part of speech. */
export function familyQuestion(
  target: Entry,
  pool: Entry[],
  seed: number,
): { pos: Pos; answer: string; options: string[]; family: FamilyMember[] } | null {
  const family = parseFamily(target);
  const targetPos = target.senses[0]?.pos.replace(/\.$/, "");
  const chosen = shuffle(
    family.filter((m) => m.pos !== targetPos),
    seed,
  )[0];
  if (!chosen) return null;

  const seen = new Set([lower(chosen.word)]);
  const distractors: string[] = [];
  const add = (words: string[]) => {
    for (const word of words) {
      if (distractors.length === 3) break;
      if (seen.has(lower(word))) continue;
      seen.add(lower(word));
      distractors.push(word);
    }
  };
  add(shuffle([...family.filter((m) => m.pos !== chosen.pos).map((m) => m.word), ...(targetPos !== chosen.pos ? [target.w] : [])], seed + 7));
  const others = pool.filter((e) => e.id !== target.id).flatMap((e) => parseFamily(e).filter((m) => m.pos !== chosen.pos));
  add(shuffle(others.map((m) => m.word), seed + 11));
  if (distractors.length < 3) return null;
  return { pos: chosen.pos, answer: chosen.word, options: shuffle([chosen.word, ...distractors], seed + 13), family };
}

export type SentenceCheck = { ok: boolean; reason: "short" | "missing" | "copied" | "ok" };

/** Cheap checks on a learner's own sentence; there is no grammar checking. */
export function sentenceCheck(input: string, target: Entry): SentenceCheck {
  const reason = (r: SentenceCheck["reason"]): SentenceCheck => ({ ok: r === "ok", reason: r });
  if (input.trim().split(/\s+/).filter(Boolean).length < 5) return reason("short");
  if (!headwordPattern(target.w).test(input)) return reason("missing");
  const n = normalize(input);
  if (target.ex.slice(0, 2).some((x) => normalize(x.en) === n)) return reason("copied");
  return reason("ok");
}

/** Sentences long enough to read as a passage, keeping the order given. */
export function passage(entries: Entry[], size = 6): Entry[] {
  return entries
    .filter((e) => e.ex[0]?.en && e.ex[0].en.length > 30 && splitHighlight(e.ex[0].en, e.w))
    .slice(0, size);
}
