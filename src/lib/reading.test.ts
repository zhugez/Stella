import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { contentVersion, evidenceParagraph, gradeReading, optionOrder, parsePassages } from "./reading";
import { recordAnswer, sanitizeReading, submitReading, readingKey, readingStore } from "../store/reading";
import { store } from "../store/store";

const corpus = parsePassages(JSON.parse(readFileSync("public/atlas/reading/passages.json", "utf8")));
const p = corpus.find((p) => p.id === "reading-education-01")!;
const empty = () => ({ version: 1 as const, attempts: {} });

test("corpus is structurally complete; evidence references stay within passages", () => {
  assert.equal(corpus.length, 19);
  assert.ok(corpus.every((p) => !p.author));
  for (const p of corpus) p.questions.forEach((_, i) => { const n = evidenceParagraph(p, i); if (n) assert.ok(n >= 1 && n <= p.paragraphs.length); });
  assert.throws(() => parsePassages([{ ...p, paragraphs: [] }]));
  assert.throws(() => parsePassages([{ ...p, questions: [{ ...p.questions[0], answer: 99 }] }]));
  assert.throws(() => parsePassages([p, p]));
});

test("closed-form scoring blocks partial answers and unverified extracts", () => {
  assert.throws(() => gradeReading(p, { 0: 1 }));
  const [a0, a1] = p.questions.map((q) => q.answer);
  assert.equal(gradeReading(p, { 0: a0, 1: a1 }), 2);
  assert.equal(gradeReading(p, { 0: (a0 + 1) % 4, 1: a1 }), 1);
  assert.throws(() => gradeReading({ ...p, author: "Unverified import" }, { 0: 1, 1: 1 }));
});

test("first submission is immutable across reload, retries and content edits", () => {
  // First question wrong, second right: one correct answer.
  let state = recordAnswer(empty(), p, 0, (p.questions[0].answer + 1) % 4);
  state = recordAnswer(state, p, 1, p.questions[1].answer);
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
  const answers = { 0: p.questions[0].answer, 1: p.questions[1].answer };
  assert.equal(gradeReading(p, answers), 2);
});
