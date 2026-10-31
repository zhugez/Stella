import assert from "node:assert/strict";
import { test } from "node:test";
import { clean, hidesAnswer, isComplete, maskChar, same, typingDelta, typingMetrics } from "./typing";

test("typing counts inserted characters and does not reward deletions", () => {
  assert.deepEqual(typingDelta("", "c", "cat"), { total: 1, correct: 1 });
  assert.deepEqual(typingDelta("c", "cx", "cat"), { total: 1, correct: 0 });
  assert.deepEqual(typingDelta("cx", "c", "cat"), { total: 0, correct: 0 });
  assert.deepEqual(typingDelta("cat", "cat", "cat"), { total: 0, correct: 0 });
});

test("a corrected mistake remains in the cumulative accuracy denominator", () => {
  let total = 0,
    correct = 0,
    previous = "";
  for (const value of ["c", "cx", "c", "ca", "cat"]) {
    const delta = typingDelta(previous, value, "cat");
    total += delta.total;
    correct += delta.correct;
    previous = value;
  }
  assert.deepEqual(typingMetrics(correct, total, 3, 6000), {
    accuracy: 75,
    wpm: 6,
  });
});

test("replacement and middle insertion assess only new characters at their new positions", () => {
  assert.deepEqual(typingDelta("cxt", "cat", "cat"), { total: 1, correct: 1 });
  assert.deepEqual(typingDelta("cat", "cart", "cart"), {
    total: 1,
    correct: 1,
  });
  assert.deepEqual(typingDelta("cart", "cat", "cat"), { total: 0, correct: 0 });
  assert.deepEqual(typingDelta("cat", "cats", "cat"), { total: 1, correct: 0 });
});

test("case and equivalent smart punctuation are accepted, punctuation is still required", () => {
  assert.ok(same("Cat", "cat"));
  assert.ok(same("It’s fine.", "It's fine."));
  assert.ok(!same("Its fine", "It's fine."));
  assert.ok(!same("cat ", "cat"));
  assert.deepEqual(typingDelta("", "Cat", "cat"), { total: 3, correct: 3 });
  assert.equal(clean("Ａ—Ｂ"), "A-B");
});

test("IME commits or multi-character replacements are assessed as one insertion", () => {
  assert.deepEqual(typingDelta("", "hello", "hello"), { total: 5, correct: 5 });
  assert.deepEqual(typingDelta("hel", "hello", "hello"), {
    total: 2,
    correct: 2,
  });
  assert.deepEqual(typingDelta("hello", "hello", "hello"), {
    total: 0,
    correct: 0,
  });
  assert.deepEqual(typingDelta("", "你好", "hello"), { total: 2, correct: 0 });
});

test("WPM uses five characters per word and excludes discarded error characters", () => {
  assert.deepEqual(typingMetrics(200, 250, 200, 60000), {
    accuracy: 80,
    wpm: 40,
  });
  assert.deepEqual(typingMetrics(150, 150, 150, 30000), {
    accuracy: 100,
    wpm: 60,
  });
});

test("an untouched or subsecond round never reports infinite or misleading WPM", () => {
  assert.deepEqual(typingMetrics(0, 0, 0, 0), { accuracy: 100, wpm: 0 });
  assert.equal(typingMetrics(1, 1, 1, 20).wpm, 0);
  assert.equal(typingMetrics(50, 50, 50, 999).wpm, 0);
});

test("normalized ligatures count as the same displayed characters", () => {
  assert.deepEqual(typingDelta("", "oﬃce", "office"), { total: 6, correct: 6 });
  assert.deepEqual(typingDelta("oﬃce", "office", "office"), { total: 0, correct: 0 });
});

test("decomposed accents normalize before positions and accuracy are assessed", () => {
  assert.deepEqual(typingDelta("", "cafe\u0301", "café"), { total: 4, correct: 4 });
  assert.deepEqual(typingDelta("café", "cafe\u0301", "café"), { total: 0, correct: 0 });
});

test("supplementary Unicode characters do not shift the following letter positions", () => {
  assert.deepEqual(typingDelta("", "𝔸B", "AB"), { total: 2, correct: 2 });
  assert.deepEqual(typingDelta("", "🙂a", "🙂a"), { total: 2, correct: 2 });
});

test("source nonbreaking spaces match keyboard spaces but omitted punctuation does not", () => {
  assert.ok(same("a b", "a\u00a0b"));
  assert.deepEqual(typingDelta("", "a b", "a\u00a0b"), { total: 3, correct: 3 });
  assert.ok(!same("well being", "well-being"));
});

test("metrics never emit NaN, Infinity, negatives or accuracy above 100", () => {
  assert.deepEqual(typingMetrics(20, 10, 10, 60000), { accuracy: 100, wpm: 2 });
  assert.deepEqual(typingMetrics(-1, 10, -10, 60000), { accuracy: 0, wpm: 0 });
  assert.deepEqual(typingMetrics(NaN, Infinity, 2, Infinity), { accuracy: 100, wpm: 0 });
});

/** Mirrors the preview row in Practice: untyped characters are masked only when the mode hides the answer. */
const preview = (target: string, typed: string, mode: string) =>
  Array.from(target)
    .map((ch, i) => (typed[i] === undefined && hidesAnswer(mode) ? maskChar(ch) : (typed[i] ?? ch)))
    .join("");

test("cloze and dictation keep the answer hidden, other modes show it", () => {
  assert.ok(hidesAnswer("cloze"));
  assert.ok(hidesAnswer("dictation"));
  assert.ok(!hidesAnswer("word"));
  assert.ok(!hidesAnswer("sentence"));
  assert.ok(!hidesAnswer("collocation"));
  assert.equal(preview("picture", "", "cloze"), "·······");
  assert.equal(preview("picture", "pic", "cloze"), "pic····");
  assert.equal(preview("picture", "", "word"), "picture");
  assert.equal(preview("a fine day", "", "dictation"), "· ···· ···");
});

test("a hidden cloze answer never leaks letters before they are typed", () => {
  const target = "picture";
  for (const typed of ["", "p", "pic", "pictu"]) {
    const shown = preview(target, typed, "cloze");
    const letters = Array.from(shown).filter((ch) => /[A-Za-z]/.test(ch)).join("");
    assert.equal(letters, typed, `leaked letters after typing "${typed}"`);
  }
});

test("completion needs the whole answer, ignoring case and typography", () => {
  assert.ok(isComplete("picture", "picture"));
  assert.ok(isComplete("Picture", "picture"));
  assert.ok(isComplete("picture", "picture".replace("c", "c")));
  assert.ok(isComplete("It’s fine.", "It's fine."));
  assert.ok(!isComplete("pictur", "picture"));
  assert.ok(!isComplete("pictures", "picture"));
  assert.ok(!isComplete("", "picture"));
});
