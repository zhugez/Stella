import assert from "node:assert/strict";
import { test } from "node:test";
import type { Atlas, WordRef } from "../atlas/types";
import { MEDIA } from "../atlas/types";
import { makeNote, noteRef, withNotes } from "../lib/notes";
import { answer, advance, buildSession, distractors, gradeFor, nextNew, quizKind, rememberedCount, retentionStats, sessionStats, streakOf } from "./session";
import { Rating, type CardState } from "./srs";
import { defaultSettings, emptyProgress, exportBackup, importBackup, sanitizeProgress, store, type ActiveSession, type QuizKind, type Step } from "./store";

const storage = new Map<string, string>();
Object.assign(globalThis, {
  window: { clearTimeout() {}, setTimeout() { return 0; } },
  localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) },
});
const makeAtlas = (rows: [string, string, number?, number?][]) => {
  const words: WordRef[] = rows.map(([id, zh, cefr = 0, media = 0], order) => ({ id, word: id, zh, ipa: "", cefr, topic: 0, media, order }));
  return { words, byId: new Map(words.map((w) => [w.id, w])), cefr: ["A1", "A2", "B1", "B2", "C1", "C2"] } as Atlas;
};
const atlas = makeAtlas(["one", "two", "three", "four"].map((id) => [id, `n. ${id}`]));
const card = (s: number, st: 0 | 1 | 2 | 3 = 2): CardState => ({ due: 1, s, d: 5, el: 0, sd: 1, ls: 0, reps: 3, lapses: 0, st, last: 1, seen: 1 });

/** One new word: intro, practice check, end-of-session recall. Returns the recall step, ready to answer. */
function start(index = 2) {
  const p = emptyProgress("session-test");
  const s = buildSession(atlas, p, { ...defaultSettings, dailyNew: 1 });
  s.index = index;
  store.progress(() => ({ ...p, session: s }));
  const step = s.steps[s.index];
  assert.notEqual(step.kind, "intro");
  return step as Step & { kind: QuizKind };
}
const current = () => store.get().progress.session!.steps[store.get().progress.session!.index];

test("a session with new words is intro, practice checks, then one recall per new word; reviews come first", () => {
  const rows: [string, string, number?, number?][] = Array.from({ length: 9 }, (_, i) => [`w${i}`, `n. w${i}`, 0, MEDIA.img]);
  const big = makeAtlas(rows);
  const p = emptyProgress("session-test");
  p.cards = { w0: card(1, 1), w1: card(1, 1) };
  const s = buildSession(big, p, { ...defaultSettings, dailyNew: 7 });
  const kinds = s.steps.map((x) => (x.kind === "intro" ? "intro" : x.practice ? "practice" : x.kind === "recall" ? "recall" : "quiz"));
  assert.deepEqual(s.reviewIds, ["w0", "w1"]);
  assert.deepEqual(kinds, ["quiz", "quiz", ...Array(5).fill("intro"), ...Array(5).fill("practice"), "intro", "intro", "practice", "practice", ...Array(7).fill("recall")]);
  for (const step of s.steps) {
    if (step.kind === "intro" || !step.practice) continue;
    assert.ok(["picture", "meaning", "listen"].includes(step.kind));
    assert.equal(step.ex, 0);
    assert.ok(step.options && step.options.length === 4);
  }
  const recalls = s.steps.filter((x) => x.kind === "recall");
  assert.deepEqual(recalls.map((x) => x.id).sort(), [...s.newIds].sort());
  assert.ok(recalls.every((x) => x.kind === "recall" && !x.options));
});

test("serialized sessions resume through intro, practice, recall and completion", () => {
  const p = emptyProgress("session-test");
  p.session = buildSession(atlas, p, { ...defaultSettings, dailyNew: 1 });
  store.progress(() => sanitizeProgress(JSON.parse(JSON.stringify(p)), p.datasetId));
  advance(2, current());
  const practice = current();
  assert.ok(practice.kind !== "intro" && practice.practice);
  answer(atlas, practice, true, Rating.Good, practice.id);
  const saved = store.get().progress;
  store.progress(() => sanitizeProgress(JSON.parse(JSON.stringify(saved)), saved.datasetId));
  assert.equal(store.get().progress.session!.pending!.correct, true);
  advance(2, current());
  const recall = current();
  assert.equal(recall.kind, "recall");
  answer(atlas, recall as Step & { kind: QuizKind }, true, Rating.Good, "remembered", 4000);
  advance(2, recall);
  const after = store.get().progress;
  assert.ok(after.session!.finished);
  assert.equal(sessionStats(after.session!).accuracy, 100);
  assert.equal(Object.values(after.days)[0].s, 1);
});

test("a practice answer creates no card, counter or log; a wrong one queues one ungraded retry", () => {
  const practice = start(1);
  assert.equal((practice as { practice?: boolean }).practice, true);
  answer(atlas, practice, false, Rating.Again, "wrong");
  const p = store.get().progress;
  assert.deepEqual(p.cards, {});
  assert.deepEqual(p.days, {});
  assert.deepEqual(p.log, []);
  assert.deepEqual(p.session!.graded, {});
  const retries = p.session!.steps.filter((x) => x.kind !== "intro" && x.retry);
  assert.equal(retries.length, 1);
  assert.equal(p.session!.steps.filter((x) => x.kind === "recall").length, 1);
  // Four steps later than the practice step, or at the end of the session when it is shorter.
  assert.equal(p.session!.steps[3].kind !== "intro" && (p.session!.steps[3] as { retry?: boolean }).retry, true);
  store.progress((q) => ({ ...q, session: { ...q.session!, index: 3, pending: undefined } }));
  const retry = current();
  assert.ok(retry.kind !== "intro" && retry.retry);
  answer(atlas, retry, true, Rating.Good, retry.id);
  assert.deepEqual(store.get().progress.cards, {});
  assert.deepEqual(store.get().progress.log, []);
});

test("a graded answer writes one log entry and the kind; retries write none", () => {
  const step = start();
  answer(atlas, step, false, Rating.Again, "forgot", 1234.6);
  const first = store.get().progress;
  assert.equal(first.log.length, 1);
  assert.deepEqual({ ...first.log[0], t: 0 }, { id: step.id, t: 0, k: "recall", g: Rating.Again, ms: 1235, st: 0 });
  assert.equal(first.session!.kinds![step.id], "recall");
  assert.equal(first.cards[step.id].reps, 1);
  advance(3, step);
  const retry = current();
  assert.ok(retry.kind !== "intro" && retry.retry);
  answer(atlas, retry, true, Rating.Good, retry.id);
  assert.equal(store.get().progress.log.length, 1);
  assert.deepEqual(store.get().progress.session!.kinds, { [step.id]: "recall" });
});

test("first submitted feedback and retry queue cannot be overwritten", () => {
  const step = start();
  answer(atlas, step, false, Rating.Again, "wrong");
  const first = store.get().progress;
  answer(atlas, step, true, Rating.Good, step.id);
  assert.deepEqual(store.get().progress, first);
  assert.equal(sessionStats(first.session!).accuracy, 0);
});

test("stale answers and duplicate continue events do not skip an unanswered quiz", () => {
  const step = start();
  answer(atlas, step, false, Rating.Again, "wrong");
  advance(3, step);
  const next = store.get().progress;
  answer(atlas, step, true, Rating.Good, step.id);
  advance(3, step);
  assert.deepEqual(store.get().progress, next);
});

test("duplicate feedback continue cannot skip the next introduction", () => {
  const step = start();
  store.progress((p) => ({ ...p, session: { ...p.session!, steps: [...p.session!.steps, { id: "two", kind: "intro" }] } }));
  answer(atlas, step, true, Rating.Good, step.id);
  advance(1, step);
  const next = store.get().progress;
  assert.equal(next.session!.steps[next.session!.index].kind, "intro");
  advance(1, step);
  assert.deepEqual(store.get().progress, next);
});

test("retry feedback does not change first-attempt cards or counters; backups preserve them", () => {
  const step = start();
  answer(atlas, step, false, Rating.Again, "wrong");
  const first = store.get().progress;
  advance(3, step);
  const retry = current();
  assert.ok(retry.kind !== "intro" && retry.retry);
  answer(atlas, retry, true, Rating.Good, retry.id);
  const after = store.get().progress;
  assert.deepEqual(after.cards, first.cards);
  assert.equal(sessionStats(after.session!).accuracy, 0);
  const counters = Object.values(after.days)[0];
  assert.equal(counters.r, 1);
  assert.equal(counters.c, 0);
  const backup = exportBackup();
  assert.equal(importBackup(backup).ok, true);
  assert.deepEqual(store.get().progress.cards, after.cards);
  assert.deepEqual(store.get().progress.days, after.days);
  assert.deepEqual(store.get().progress.log, after.log);
  assert.equal(store.get().progress.session, null);
});

test("sessionStats splits recall from multiple choice and ignores sessions without kinds", () => {
  const graded: ActiveSession["graded"] = { a: Rating.Good, b: Rating.Again, c: Rating.Hard, d: Rating.Good };
  const s = { ...buildSession(atlas, emptyProgress("x"), defaultSettings), graded };
  assert.deepEqual({ r: sessionStats(s).recall, c: sessionStats(s).choice }, { r: { n: 0, ok: 0 }, c: { n: 0, ok: 0 } });
  const split = sessionStats({ ...s, kinds: { a: "recall", b: "spell", c: "meaning", d: "dictation" } });
  assert.deepEqual(split.recall, { n: 3, ok: 2 });
  assert.deepEqual(split.choice, { n: 1, ok: 1 });
});

test("quizKind picks formats by memory stability and the spelling setting", () => {
  const ref = makeAtlas([["a", "n. a", 0, MEDIA.img]]).words[0];
  const kindsAt = (cardS: number | null, spell: boolean) => {
    const p = emptyProgress("x");
    if (cardS !== null) p.cards.a = card(cardS);
    return new Set(Array.from({ length: 300 }, (_, i) => quizKind(ref, p, { ...defaultSettings, spell }, i)));
  };
  assert.deepEqual([...kindsAt(null, true)].sort(), ["listen", "meaning", "picture"]);
  assert.deepEqual([...kindsAt(1.9, true)].sort(), ["listen", "meaning", "picture"]);
  assert.deepEqual([...kindsAt(3, true)].sort(), ["listen", "picture", "recall"]);
  assert.deepEqual([...kindsAt(6, true)].sort(), ["dictation", "listen", "recall", "spell"]);
  assert.deepEqual([...kindsAt(6, false)].sort(), ["listen", "picture", "recall"]);
});

test("gradeFor: hints beat speed and each kind has its own slow limit", () => {
  assert.equal(gradeFor("spell", true, 8000, 1), Rating.Hard);
  assert.equal(gradeFor("spell", true, 8000, 2), Rating.Again);
  assert.equal(gradeFor("dictation", true, 8000, 3), Rating.Again);
  assert.equal(gradeFor("meaning", false, 100, 0), Rating.Again);
  assert.equal(gradeFor("spell", true, 20001, 0), Rating.Hard);
  assert.equal(gradeFor("dictation", true, 5000, 0), Rating.Easy);
  assert.equal(gradeFor("spell", true, 10000, 0), Rating.Good);
  assert.equal(gradeFor("picture", true, 12001, 0), Rating.Hard);
  assert.equal(gradeFor("picture", true, 12000, 0), Rating.Good);
  assert.equal(gradeFor("meaning", true, 9001, 0), Rating.Hard);
  assert.equal(gradeFor("listen", true, 9000, 0), Rating.Good);
  assert.equal(gradeFor("listen", true, 500, 0), Rating.Good);
});

test("listen options are four distinct meanings and none shares a gloss segment with the answer", () => {
  const rows: [string, string, number?, number?][] = [["big", "adj. lớn, to"], ["large", "adj. LỚN; rộng"], ["huge", "adj. khổng lồ"], ["tiny", "adj. nhỏ xíu"], ["small", "adj. nhỏ"], ["short", "adj. ngắn"], ["long", "adj. dài"], ["wide", "adj. rộng"], ["thin", "adj. mỏng"], ["thick", "adj. dày"], ["dup", "adj. dày"], ["cat", "n. con mèo"], ["dog", "n. con chó"]];
  const a = makeAtlas(rows);
  for (let seed = 0; seed < 40; seed++) {
    const ids = distractors(a, a.byId.get("big")!, "listen", seed);
    assert.equal(ids.length, 4);
    assert.ok(ids.includes("big"));
    assert.ok(!ids.includes("large"), "large shares the gloss 'lớn' with big");
    assert.equal(new Set(ids.map((id) => a.byId.get(id)!.zh)).size, 4);
    assert.equal(new Set(ids).size, 4);
  }
});

test("nextNew takes bookmarked words first, oldest bookmark first, and skips UK/US twins", () => {
  const a = makeAtlas([["a", "n. a"], ["b", "n. b"], ["c", "n. c"], ["organise", "v. o"], ["organize", "v. o2"], ["d", "n. d"], ["grey", "adj. g1"], ["gray", "adj. g2"]]);
  const p = emptyProgress("x");
  p.bookmarks = ["gone", "c", "b"]; // newest first; "gone" is not in the atlas
  assert.deepEqual(nextNew(a, p, defaultSettings, 4), ["b", "c", "a", "organise"]);
  assert.deepEqual(nextNew(a, p, defaultSettings, 8), ["b", "c", "a", "organise", "d", "grey"]);
  p.cards.organize = card(1);
  p.cards.gray = card(1);
  assert.deepEqual(nextNew(a, p, defaultSettings, 8), ["b", "c", "a", "d"]);
  p.bookmarks = ["grey"]; // its twin has a card, so even a bookmark does not bring it back
  assert.deepEqual(nextNew(a, p, defaultSettings, 2), ["a", "b"]);
  delete p.cards.gray;
  assert.deepEqual(nextNew(a, p, defaultSettings, 1), ["grey"]);
});

test("streakOf counts finished sessions, respects legacy days without s, and holds until today ends", () => {
  const d = new Date();
  const key = (daysAgo: number) => {
    const target = new Date(d);
    target.setDate(target.getDate() - daysAgo);
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
  };
  // Legacy days without `s` count by r > 0
  const legacyDays = { [key(1)]: { n: 0, r: 5, c: 5, t: 30 }, [key(2)]: { n: 0, r: 3, c: 3, t: 20 } };
  assert.equal(streakOf(legacyDays), 2);

  // A day with s: 0 and r: 5 does not count
  const nonFinishedDays = { [key(1)]: { n: 0, r: 5, c: 5, t: 30, s: 0 }, [key(2)]: { n: 0, r: 3, c: 3, t: 20, s: 1 } };
  assert.equal(streakOf(nonFinishedDays), 0);

  // Today not active yet still keeps yesterday's streak
  const yesterdayOnly = { [key(1)]: { n: 0, r: 5, c: 5, t: 30, s: 1 } };
  assert.equal(streakOf(yesterdayOnly), 1);

  // Today finished increments streak
  const todayFinished = { [key(0)]: { n: 0, r: 5, c: 5, t: 30, s: 1 }, [key(1)]: { n: 0, r: 5, c: 5, t: 30, s: 1 } };
  assert.equal(streakOf(todayFinished), 2);
});

test("rememberedCount and retentionStats measure retrievability and review retention", () => {
  const p = emptyProgress("test-retention");
  assert.equal(rememberedCount(p), 0);

  const now = Date.now();
  p.cards.w1 = { due: now + 86400000, s: 10, d: 3, el: 1, sd: 5, ls: 0, reps: 3, lapses: 0, st: 2, last: now - 86400000, seen: now - 86400000 };
  p.cards.w2 = { due: now - 86400000, s: 5, d: 5, el: 6, sd: 5, ls: 0, reps: 2, lapses: 1, st: 2, last: now - 6 * 86400000, seen: now - 200000 };
  const rem = rememberedCount(p, now, 0.9);
  assert.ok(rem >= 1 && rem <= 2);

  p.log = [
    // Old entry > 30 days
    { id: "w1", t: now - 40 * 86400000, k: "recall", g: Rating.Good, ms: 2000, st: 2 },
    // Entry with st !== 2 (e.g. learning step)
    { id: "w2", t: now - 5 * 86400000, k: "recall", g: Rating.Good, ms: 2000, st: 1 },
    // Valid review entries in past 30 days
    { id: "w1", t: now - 2 * 86400000, k: "recall", g: Rating.Good, ms: 3000, st: 2 },
    { id: "w2", t: now - 1 * 86400000, k: "spell", g: Rating.Again, ms: 8000, st: 2 },
    { id: "w3", t: now - 1 * 86400000, k: "meaning", g: Rating.Good, ms: 4000, st: 2 },
  ];
  const rStats = retentionStats(p.log, now, 30);
  assert.deepEqual(rStats.recall, { n: 2, ok: 1 });
  assert.deepEqual(rStats.choice, { n: 1, ok: 1 });
});

const saltNote = makeNote("salt", "muối", "Pass the salt, please.", "Dinner", "n.");
const pepperNote = { ...makeNote("pepper", "hạt tiêu"), added: saltNote.added - 10 };
// Reading the gloss of an atlas word is what `distractors` does first, so any call for a note throws.
const trapped = makeAtlas(["one", "two", "three", "four"].map((id) => [id, `n. ${id}`]));
trapped.words.forEach((w) => Object.defineProperty(w, "zh", { get: () => assert.fail("distractors ran for a note") }));
const noteAtlas = withNotes(trapped, [saltNote, pepperNote]);

test("nextNew puts unlearned notes first (oldest first), then bookmarks, then the path", () => {
  const p = emptyProgress("x");
  p.notes = [saltNote, pepperNote];
  p.bookmarks = ["three"];
  assert.deepEqual(nextNew(noteAtlas, p, defaultSettings, 4), ["u:pepper", "u:salt", "three", "one"]);
  assert.deepEqual(nextNew(noteAtlas, p, defaultSettings, 1), ["u:pepper"]);
  p.cards["u:pepper"] = card(1);
  assert.deepEqual(nextNew(noteAtlas, p, defaultSettings, 2), ["u:salt", "three"]);
});

test("quizKind for a note is recall, plus spell and a cloze once the memory holds, never choice or audio kinds", () => {
  const ref = noteRef(saltNote, 4);
  const kindsAt = (cardS: number | null, spell: boolean, notes = [saltNote]) => {
    const p = emptyProgress("x");
    p.notes = notes;
    if (cardS !== null) p.cards[ref.id] = card(cardS);
    return new Set(Array.from({ length: 300 }, (_, i) => quizKind(ref, p, { ...defaultSettings, spell }, i)));
  };
  assert.deepEqual([...kindsAt(null, true)], ["recall"]);
  assert.deepEqual([...kindsAt(1.9, true)], ["recall"]);
  assert.deepEqual([...kindsAt(3, false)].sort(), ["picture", "recall"]);
  assert.deepEqual([...kindsAt(6, true)].sort(), ["picture", "recall", "spell"]);
  assert.deepEqual([...kindsAt(6, true, [{ ...saltNote, ctx: undefined }])].sort(), ["recall", "spell"]);
  // The sentence must contain the word, or there is nothing to blank.
  assert.deepEqual([...kindsAt(6, false, [{ ...saltNote, ctx: "Nothing here." }])], ["recall"]);
});

test("a session with a note is intro, recall check, recall and never asks for distractors", () => {
  const p = emptyProgress("session-test");
  p.notes = [saltNote];
  const s = buildSession(noteAtlas, p, { ...defaultSettings, dailyNew: 1 });
  assert.deepEqual(s.newIds, ["u:salt"]);
  assert.deepEqual(
    s.steps.map((x) => (x.kind === "intro" ? "intro" : `${x.kind}${x.practice ? "-practice" : ""}`)),
    ["intro", "recall-practice", "recall"],
  );
  assert.ok(s.steps.every((x) => x.kind === "intro" || !x.options));
});

test("reviewing a note builds only recall, spell or a four-option cloze without an image", () => {
  const p = emptyProgress("session-test");
  p.notes = [saltNote];
  p.cards["u:salt"] = card(6);
  const kinds = new Set<string>();
  const realNow = Date.now;
  try {
    for (let i = 0; i < 40; i++) {
      // The session seed is the clock; fixed seeds keep this test repeatable.
      Date.now = () => 1_700_000_000_000 + i;
      const s = buildSession(noteAtlas, p, { ...defaultSettings, dailyNew: 0 }, { reviewOnly: true });
      const step = s.steps[0];
      kinds.add(step.kind);
      if (step.kind === "intro") assert.fail("reviews have no intro");
      assert.ok(["recall", "spell", "picture"].includes(step.kind));
      if (step.kind === "picture") {
        assert.equal(step.plain, true);
        assert.equal(step.options!.length, 4);
        assert.ok(step.options!.includes("u:salt"));
        assert.equal(new Set(step.options).size, 4);
      } else assert.equal(step.options, undefined);
    }
  } finally {
    Date.now = realNow;
  }
  assert.deepEqual([...kinds].sort(), ["picture", "recall", "spell"]);
});

test("answering a note creates a card and a log entry; a wrong answer retries with recall, not choices", () => {
  const p = emptyProgress("note-answer");
  p.notes = [saltNote];
  const s = buildSession(noteAtlas, p, { ...defaultSettings, dailyNew: 1 });
  s.index = 2;
  store.progress(() => ({ ...p, session: s }));
  const recall = current() as Step & { kind: QuizKind };
  assert.equal(recall.kind, "recall");
  answer(noteAtlas, recall, false, Rating.Again, "forgot", 2000);
  const after = store.get().progress;
  assert.deepEqual(Object.keys(after.cards), ["u:salt"]);
  assert.deepEqual(after.log.map((l) => [l.id, l.k, l.g]), [["u:salt", "recall", Rating.Again]]);
  assert.deepEqual(after.mistakes, ["u:salt"]);
  assert.equal(Object.values(after.days)[0].n, 1);
  const retry = after.session!.steps[3];
  assert.ok(retry.kind === "recall" && retry.retry && !retry.options);
});
