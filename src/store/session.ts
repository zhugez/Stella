import type { Atlas, WordRef } from "../atlas/types";
import { MEDIA } from "../atlas/types";
import { twinOf } from "../lib/spelling";
import { hashSeed, normalize, shuffle } from "../lib/text";
import { isMastered, retrievability, review, Rating, type Grade } from "./srs";
import { bumpDay, dayKey, store, type ActiveSession, type Progress, type QuizKind, type Settings, type Step } from "./store";

export function dueIds(p: Progress, now = Date.now()) {
  return Object.entries(p.cards)
    .filter(([, c]) => c.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

export function newToday(p: Progress) {
  return p.days[dayKey()]?.n ?? 0;
}

const wordIds = new WeakMap<Atlas, Map<string, string>>();
/** Id of the headword spelled `word`; the index is built once per atlas. */
function idOfWord(atlas: Atlas, word: string) {
  let ids = wordIds.get(atlas);
  if (!ids) wordIds.set(atlas, (ids = new Map(atlas.words.map((w) => [normalize(w.word), w.id]))));
  return ids.get(normalize(word));
}

/** Bookmarked words first (oldest bookmark first), then unseen words along the learning path from the learner's level. */
export function nextNew(atlas: Atlas, p: Progress, settings: Settings, count: number) {
  const out: string[] = [];
  const taken = (id: string) => !!p.cards[id] || out.includes(id);
  // A UK/US twin that was already learned or is already queued would be the same word twice.
  const twinTaken = (w: WordRef) => {
    const twin = twinOf(w.word);
    const id = twin && idOfWord(atlas, twin);
    return !!id && taken(id);
  };
  const add = (w: WordRef | undefined) => {
    if (w && !taken(w.id) && !twinTaken(w)) out.push(w.id);
  };
  for (const id of [...p.bookmarks].reverse()) {
    if (out.length >= count) return out;
    add(atlas.byId.get(id));
  }
  const pass = (from: number) => {
    for (const w of atlas.words) {
      if (out.length >= count) return;
      if (w.cefr >= from) add(w);
    }
  };
  pass(settings.startLevel);
  if (out.length < count) pass(0);
  return out;
}

export function todayPlan(atlas: Atlas, p: Progress, s: Settings) {
  const due = dueIds(p).filter((id) => atlas.byId.has(id));
  const newLeft = Math.max(0, s.dailyNew - newToday(p));
  const fresh = nextNew(atlas, p, s, newLeft);
  return { due, fresh, minutes: Math.max(1, Math.round(due.length * 0.25 + fresh.length * 1.1)) };
}

/** "v. khuyên, tư vấn" → { pos: "v.", text: "khuyên, tư vấn" }. */
export function glossParts(zh: string) {
  const m = /^([a-z]+\.)\s*([\s\S]*)$/.exec(zh);
  return m ? { pos: m[1], text: m[2] } : { pos: "", text: zh };
}

const glossSegments = (zh: string) =>
  glossParts(zh)
    .text.split(/[,;，；]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

/** Recognition only: used for new and fragile memories, and for the check right after an intro. */
function recognitionKind(ref: WordRef, roll: number): QuizKind {
  if (roll < 40) return ref.media & MEDIA.img ? "picture" : "meaning";
  return roll < 75 ? "meaning" : "listen";
}

/** Harder formats as memory gets stronger (FSRS stability in days). */
export function quizKind(ref: WordRef, p: Progress, s: Settings, salt: number): QuizKind {
  const c = p.cards[ref.id];
  const roll = hashSeed(ref.id + salt) % 100;
  if (!c || c.s < 2) return recognitionKind(ref, roll);
  if (c.s >= 4 && s.spell) return roll < 40 ? "spell" : roll < 70 ? "recall" : roll < 85 ? "dictation" : "listen";
  if (roll < 40) return "recall";
  return roll < 70 ? "listen" : ref.media & MEDIA.img ? "picture" : "meaning";
}

/** Plausible wrong answers: same part of speech and level, never a second correct answer. */
export function distractors(atlas: Atlas, ref: WordRef, kind: QuizKind, seed: number) {
  const target = normalize(ref.word);
  const own = new Set(glossSegments(ref.zh));
  const pos = ref.zh.split(" ")[0];
  const posBonus = kind === "picture" ? 80 : 60;
  const scored: [number, WordRef][] = [];
  const pool = atlas.words;
  const start = Math.max(0, ref.order - 400);
  for (let i = start; i < Math.min(pool.length, ref.order + 400); i++) {
    const w = pool[i];
    if (w.id === ref.id || normalize(w.word) === target) continue;
    if (glossSegments(w.zh).some((x) => own.has(x))) continue;
    let score = hashSeed(w.id + seed) % 100;
    if (w.zh.split(" ")[0] === pos) score += posBonus;
    if (w.cefr === ref.cefr) score += 40;
    scored.push([score, w]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const seen = new Set<string>();
  const picks: string[] = [];
  for (const [, w] of scored) {
    const key = kind === "picture" ? normalize(w.word) : w.zh;
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push(w.id);
    if (picks.length === 3) break;
  }
  return shuffle([ref.id, ...picks], seed);
}

const CHOICE_KINDS: QuizKind[] = ["meaning", "picture", "listen"];

export function buildSession(atlas: Atlas, p: Progress, s: Settings, opts?: { ids?: string[]; reviewOnly?: boolean }): ActiveSession {
  const seed = Date.now();
  const plan = todayPlan(atlas, p, s);
  const reviewIds = opts?.ids ? opts.ids.filter((id) => p.cards[id]) : plan.due.slice(0, 120);
  const newIds = opts?.ids ? opts.ids.filter((id) => !p.cards[id]) : opts?.reviewOnly ? [] : plan.fresh;
  const steps: Step[] = [];
  const quiz = (id: string, salt: number): Step => {
    const ref = atlas.byId.get(id)!;
    let kind = quizKind(ref, p, s, seed + salt);
    // Dictation needs the sentence recording; private datasets may lack it.
    if (kind === "dictation" && !(ref.media & MEDIA.ex)) kind = "spell";
    const options = CHOICE_KINDS.includes(kind) ? distractors(atlas, ref, kind, seed + salt) : undefined;
    if (kind !== "picture" && kind !== "spell" && kind !== "dictation") return { id, kind, options };
    const second = hashSeed(id + seed + "ex") % 2 === 1 && (kind !== "dictation" || !!(ref.media & MEDIA.ex2));
    const ex = second ? 1 : 0;
    return { id, kind, options, ex, plain: ex === 1 || (p.cards[id]?.s ?? 0) >= 4 };
  };
  // Reviews first while attention is fresh, then new words in small groups:
  // meet five, check them at once, and recall all of them again at the very end.
  reviewIds.forEach((id, i) => steps.push(quiz(id, i)));
  for (let g = 0; g < newIds.length; g += 5) {
    const group = newIds.slice(g, g + 5);
    group.forEach((id) => steps.push({ id, kind: "intro" }));
    shuffle(group, seed + g).forEach((id, i) => {
      const ref = atlas.byId.get(id)!;
      const kind = recognitionKind(ref, hashSeed(id + (seed + 1000 + g + i)) % 100);
      steps.push({ id, kind, practice: true, options: distractors(atlas, ref, kind, seed + 1000 + g + i), ex: 0 });
    });
  }
  shuffle(newIds, seed + 2000).forEach((id) => steps.push({ id, kind: "recall" }));
  return { id: `s${seed}`, started: seed, steps, index: 0, graded: {}, newIds, reviewIds };
}

/** Hints weigh more than speed: two or more count as not remembered. */
export function gradeFor(kind: QuizKind, correct: boolean, ms: number, hints: number): Grade {
  if (!correct || hints >= 2) return Rating.Again;
  if (hints === 1) return Rating.Hard;
  if (kind === "spell" || kind === "dictation") return ms > 20000 ? Rating.Hard : ms < 6000 ? Rating.Easy : Rating.Good;
  if (kind === "picture") return ms > 12000 ? Rating.Hard : Rating.Good;
  if (kind === "recall") return Rating.Good;
  return ms > 9000 ? Rating.Hard : Rating.Good;
}

/** Apply an answer. Only the first graded attempt for a word in a session updates memory and stats; practice and retries never do. */
export function answer(atlas: Atlas, step: Step & { kind: QuizKind }, correct: boolean, grade: Grade, value: string, ms = 0) {
  const { settings } = store.get();
  store.progress((p) => {
    const sess = p.session;
    if (!sess || sess.finished || sess.pending || sess.steps[sess.index] !== step) return p;
    let next: Progress = { ...p, session: { ...sess, pending: { correct, value } } };
    const first = !(step.id in sess.graded) && !step.retry && !step.practice;
    if (first) {
      const now = Date.now();
      const prev = p.cards[step.id];
      next = {
        ...next,
        cards: { ...next.cards, [step.id]: review(prev, grade, now, settings.retention) },
        session: { ...next.session!, graded: { ...sess.graded, [step.id]: grade }, kinds: { ...sess.kinds, [step.id]: step.kind } },
        mistakes: correct ? next.mistakes : [step.id, ...next.mistakes.filter((x) => x !== step.id)].slice(0, 300),
        log: [...p.log, { id: step.id, t: now, k: step.kind, g: grade, ms: Math.round(ms), st: prev?.st ?? 0 }].slice(-5000),
      };
      next = bumpDay(next, { r: 1, c: correct ? 1 : 0, n: sess.newIds.includes(step.id) ? 1 : 0 });
    }
    if (!correct) {
      // Practise it again a few steps later in another format; never re-graded.
      const steps = [...next.session!.steps];
      const retries = steps.filter((x) => x.id === step.id && "retry" in x && x.retry).length;
      if (retries < 2) {
        const ref = atlas.byId.get(step.id)!;
        const kind: QuizKind = step.kind === "meaning" ? (ref.media & MEDIA.img ? "picture" : "listen") : "meaning";
        const at = Math.min(steps.length, sess.index + 4);
        steps.splice(at, 0, { id: step.id, kind, retry: true, options: distractors(atlas, ref, kind, Date.now()), ex: 0, plain: false });
        next = { ...next, session: { ...next.session!, steps } };
      }
    }
    return next;
  });
}

/** Move to the next step; `seconds` is time spent on this step, capped so idle tabs don't inflate stats. */
export function advance(seconds: number, step: Step) {
  store.progress((p) => {
    const s = p.session;
    if (!s || s.finished || s.steps[s.index] !== step || (step.kind !== "intro" && !s.pending)) return p;
    const index = s.index + 1;
    const finished = index >= s.steps.length ? Date.now() : undefined;
    const next = bumpDay(p, { t: Math.max(0, Math.min(90, Math.round(seconds))), s: finished ? 1 : 0 });
    return { ...next, session: { ...s, index, pending: undefined, finished } };
  });
}

const RECALL_KINDS: QuizKind[] = ["recall", "spell", "dictation"];

export function sessionStats(s: ActiveSession) {
  const graded = Object.values(s.graded);
  const correct = graded.filter((g) => g !== Rating.Again).length;
  // Sessions saved before `kinds` existed cannot be split.
  const split = (group: QuizKind[]) => {
    const ids = Object.keys(s.graded).filter((id) => s.kinds && group.includes(s.kinds[id]));
    return { n: ids.length, ok: ids.filter((id) => s.graded[id] !== Rating.Again).length };
  };
  return {
    total: graded.length,
    correct,
    accuracy: graded.length ? Math.round((correct / graded.length) * 100) : 0,
    recall: split(RECALL_KINDS),
    choice: split(CHOICE_KINDS),
  };
}

export const masteredCount = (p: Progress) => Object.values(p.cards).filter(isMastered).length;

export function isDayActive(d?: { r: number; s?: number }) {
  if (!d) return false;
  return d.s !== undefined ? d.s > 0 : d.r > 0;
}

export function streakOf(days: Record<string, { r: number; s?: number }>) {
  let n = 0;
  const d = new Date();
  if (!isDayActive(days[dayKey(d)])) d.setDate(d.getDate() - 1);
  while (isDayActive(days[dayKey(d)])) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function rememberedCount(p: Progress, now = Date.now(), retention = 0.9) {
  return Math.round(Object.values(p.cards).reduce((sum, c) => sum + retrievability(c, now, retention), 0));
}

export function retentionStats(log: Progress["log"], now = Date.now(), days = 30) {
  const since = now - days * 86400000;
  const recall: { ok: boolean }[] = [];
  const choice: { ok: boolean }[] = [];
  for (const entry of log) {
    if (entry.t < since || entry.st !== 2) continue;
    const ok = entry.g !== Rating.Again;
    if (RECALL_KINDS.includes(entry.k)) recall.push({ ok });
    else if (CHOICE_KINDS.includes(entry.k)) choice.push({ ok });
  }
  return {
    recall: { n: recall.length, ok: recall.filter((x) => x.ok).length },
    choice: { n: choice.length, ok: choice.filter((x) => x.ok).length },
  };
}
