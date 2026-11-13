import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { contentVersion, evidenceParagraph, gapCorrect, gradeReading, optionOrder, parsePassages, type ChoiceQuestion, type GapQuestion, type ReadingAnswer } from "./reading";
import { recordAnswer, sanitizeReading, submitReading, readingKey, readingStore, type ReadingProgress } from "../store/reading";
import { store } from "../store/store";

const corpus = parsePassages(JSON.parse(readFileSync("public/atlas/reading/passages.json", "utf8")));
const p = corpus.find((p) => p.id === "reading-education-01")!;
const long = corpus.find((p) => p.id === "reading-education-02")!;
const choice = (q: unknown) => q as ChoiceQuestion;
const gaps = long.questions.filter((q): q is GapQuestion => q.type === "gap");
const empty = () => ({ version: 1 as const, attempts: {} });

test("corpus is structurally complete; evidence references stay within passages", () => {
  assert.equal(corpus.length, 25);
  assert.equal(corpus.filter((p) => p.id.endsWith("-01")).length, 19);
  assert.ok(corpus.every((p) => !p.author));
  for (const p of corpus) p.questions.forEach((_, i) => { const n = evidenceParagraph(p, i); if (n) assert.ok(n >= 1 && n <= p.paragraphs.length); });
  assert.throws(() => parsePassages([{ ...p, paragraphs: [] }]));
  assert.throws(() => parsePassages([{ ...p, questions: [{ ...choice(p.questions[0]), answer: 99 }] }]));
  assert.throws(() => parsePassages([p, p]));
});

test("closed-form scoring blocks partial answers and unverified extracts", () => {
  assert.throws(() => gradeReading(p, { 0: 1 }));
  const [a0, a1] = p.questions.map((q) => choice(q).answer);
  assert.equal(gradeReading(p, { 0: a0, 1: a1 }), 2);
  assert.equal(gradeReading(p, { 0: (a0 + 1) % choice(p.questions[0]).options.length, 1: a1 }), 1);
  assert.throws(() => gradeReading({ ...p, author: "Unverified import" }, { 0: 1, 1: 1 }));
});

test("first submission is immutable across reload, retries and content edits", () => {
  // First question wrong, second right: one correct answer.
  let state = recordAnswer(empty(), p, 0, (choice(p.questions[0]).answer + 1) % choice(p.questions[0]).options.length);
  state = recordAnswer(state, p, 1, choice(p.questions[1]).answer);
  state = submitReading(state, p);
  const restored = sanitizeReading(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.attempts[readingKey(p)].correct, 1);
  assert.deepEqual(recordAnswer(restored, p, 0, 1), restored);
  assert.deepEqual(submitReading(restored, p), restored);
  const changed = { ...p, paragraphs: [p.paragraphs[0] + " Updated.", ...p.paragraphs.slice(1)] };
  assert.notEqual(contentVersion(changed), contentVersion(p));
  const newer = recordAnswer(restored, changed, 0, 1);
  assert.equal(Object.keys(newer.attempts).length, 2);
  assert.deepEqual(newer.attempts[readingKey(p)], restored.attempts[readingKey(p)]);
});

test("reading import merges without replacing first submissions", () => {
  const storage = new Map<string, string>();
  Object.assign(globalThis, { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
  readingStore.library(corpus);
  readingStore.answer(p, 0, 0);
  readingStore.answer(p, 1, 1);
  readingStore.submit(p);
  const before = readingStore.export();
  const replacement = submitReading(recordAnswer(recordAnswer(empty(), p, 0, 1), p, 1, 1), p);
  readingStore.import(JSON.stringify(replacement));
  assert.equal(readingStore.export(), before);
  assert.throws(() => readingStore.import('{"version":2}'));
  assert.equal(readingStore.export(), before);
});

test("storage failure is observable and does not advance in-memory answers", () => {
  // store.settings() schedules a save through window.setTimeout; give Node a window so it can.
  Object.assign(globalThis, { window: globalThis });
  store.settings({ lang: "en" });
  const before = readingStore.status().progress;
  Object.assign(globalThis, { localStorage: { getItem: () => JSON.stringify(before), setItem() { throw new Error("quota"); } } });
  readingStore.answer(corpus.find((item) => item.id !== p.id)!, 0, 1);
  assert.equal(readingStore.status().progress, before);
  assert.match(readingStore.status().error, /could not be saved/);
});

test("reading backup validates before restoring without touching vocabulary", () => {
  const a = recordAnswer(empty(), p, 0, 1);
  assert.deepEqual(sanitizeReading(JSON.parse(JSON.stringify(a))), a);
  assert.throws(() => sanitizeReading({ version: 2, attempts: {} }));
  assert.throws(() => sanitizeReading({ version: 1, attempts: { x: { answers: {} } } }));
  const invalid = { version: 1, attempts: { [readingKey(p)]: { passageId: p.id, version: contentVersion(p), started: 1, submitted: 2, correct: 0, answers: {}, assisted: false } } };
  assert.throws(() => sanitizeReading(invalid, [p]));
  const submitted = submitReading(recordAnswer(a, p, 1, 1), p);
  assert.deepEqual(sanitizeReading(submitted, [p]), submitted);
  submitted.attempts[readingKey(p)].correct = 0;
  assert.throws(() => sanitizeReading(submitted, [p]));
});

test("reading errors follow the interface language", () => {
  store.settings({ lang: "vi" });
  assert.throws(() => parsePassages([]), /Thư viện đọc hiểu đang trống/);
  store.settings({ lang: "en" });
  assert.throws(() => parsePassages([]), /The reading library is empty/);
});

test("optionOrder preserves TFNG order and deterministically shuffles MCQ", () => {
  const tfngOrder = optionOrder(p, 1);
  assert.deepEqual(tfngOrder, [0, 1, 2]);

  const mcqOrder1 = optionOrder(p, 0);
  const mcqOrder2 = optionOrder(p, 0);
  assert.deepEqual(mcqOrder1, mcqOrder2);
  assert.equal(mcqOrder1.length, 4);
  assert.deepEqual([...mcqOrder1].sort(), [0, 1, 2, 3]);

  // Grading still uses original indices regardless of optionOrder
  const answers = { 0: choice(p.questions[0]).answer, 1: choice(p.questions[1]).answer };
  assert.equal(gradeReading(p, answers), 2);
});

test("optionOrder returns no options for gap questions", () => {
  assert.deepEqual(optionOrder(long, long.questions.findIndex((q) => q.type === "gap")), []);
});

test("parsePassages validates gap questions and evidence", () => {
  const gap = gaps[0];
  const withQuestion = (q: unknown) => [{ ...long, questions: [q] }];
  assert.equal(parsePassages(withQuestion(gap)).length, 1);
  for (const bad of [
    { ...gap, question: "No blank here." },
    { ...gap, question: "Two ____ blanks ____ here." },
    { ...gap, accept: [] },
    { ...gap, accept: ["a", "b", "c", "d"] },
    { ...gap, accept: ["one two three"] },
    { ...gap, accept: ["  "] },
    { ...gap, accept: [7] },
    { ...gap, evidence: 0 },
    { ...gap, evidence: long.paragraphs.length + 1 },
    { ...gap, evidence: 1.5 },
    { ...choice(long.questions[0]), evidence: "2" },
  ]) assert.throws(() => parsePassages(withQuestion(bad)));
  assert.equal(parsePassages(withQuestion({ ...gap, evidence: undefined })).length, 1);
});

test("evidenceParagraph prefers the question field and keeps the -01 table", () => {
  assert.equal(evidenceParagraph(long, 0), long.questions[0].evidence);
  assert.equal(evidenceParagraph({ ...p, questions: [{ ...p.questions[0], evidence: 1 }, p.questions[1]] }, 0), 1);
  assert.equal(evidenceParagraph(p, 0), 2);
  assert.equal(evidenceParagraph({ ...long, author: "Unverified import" }, 0), undefined);
  assert.equal(evidenceParagraph(long, 99), undefined);
});

test("gap grading accepts variants, ignores case and one leading article, rejects more than two words", () => {
  const q: GapQuestion = { type: "gap", question: "It is ____.", accept: ["free market", "free markets", "the market"], explanation: "x" };
  assert.ok(gapCorrect(q, "free market"));
  assert.ok(gapCorrect(q, "  Free   MARKETS "));
  assert.ok(gapCorrect(q, "market"));
  assert.ok(gapCorrect(q, "a market"));
  assert.ok(!gapCorrect(q, "a free market"));
  assert.ok(!gapCorrect(q, "the free market"));
  assert.ok(!gapCorrect(q, "very free market"));
  assert.ok(!gapCorrect(q, "free"));
  assert.ok(!gapCorrect(q, ""));
  assert.ok(!gapCorrect({ ...q, accept: ["the"] }, "a"));
});

test("sanitizer accepts string answers only for gap questions and at most 60 characters", () => {
  const gi = long.questions.findIndex((q) => q.type === "gap");
  const ci = long.questions.findIndex((q) => q.type !== "gap");
  const typed = recordAnswer(empty(), long, gi, "word");
  assert.deepEqual(sanitizeReading(JSON.parse(JSON.stringify(typed)), [long]), typed);
  assert.deepEqual(recordAnswer(empty(), long, ci, "word"), empty());
  assert.deepEqual(recordAnswer(empty(), long, gi, 1), empty());
  assert.deepEqual(recordAnswer(empty(), long, gi, "x".repeat(61)), empty());
  const attempt = typed.attempts[readingKey(long)];
  const withAnswers = (answers: Record<string, ReadingAnswer>) => ({ version: 1, attempts: { [readingKey(long)]: { ...attempt, answers } } });
  assert.throws(() => sanitizeReading(withAnswers({ [gi]: "x".repeat(61) })));
  assert.throws(() => sanitizeReading(withAnswers({ [ci]: "word" }), [long]));
  assert.throws(() => sanitizeReading(withAnswers({ [gi]: 1 }), [long]));
  assert.throws(() => sanitizeReading(withAnswers({ [gi]: ["word"] as never })));
});

test("a full -02 passage grades with its own answer key", () => {
  const key = long.questions.map((q) => (q.type === "gap" ? q.accept[0] : q.answer));
  const answers = Object.fromEntries(key.map((a, i) => [i, a]));
  assert.equal(long.questions.length, 13);
  assert.equal(gradeReading(long, answers), 13);
  const gi = long.questions.findIndex((q) => q.type === "gap");
  assert.equal(gradeReading(long, { ...answers, [gi]: `${gaps[0].accept[0]} extra words` }), 12);
  assert.throws(() => gradeReading(long, { ...answers, [gi]: "   " }));
  let state: ReadingProgress = empty();
  key.forEach((a, i) => { state = recordAnswer(state, long, i, a); });
  state = submitReading(state, long);
  assert.equal(state.attempts[readingKey(long)].correct, 13);
  assert.deepEqual(sanitizeReading(JSON.parse(JSON.stringify(state)), [long]), state);
});
