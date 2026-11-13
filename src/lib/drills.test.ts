import assert from "node:assert/strict";
import { test } from "node:test";
import type { Entry } from "../atlas/types";
import type { Progress } from "../store/store";
import { headwordPattern } from "./text";
import { clozeTarget, collocationQuestion, familyQuestion, paraphraseQuestion, parseFamily, passage, sentenceCheck, weakWords } from "./drills";
import { same } from "./typing";

const card = (lapses: number, d = 5) => ({ due: 0, s: 1, d, el: 0, sd: 0, ls: 0, reps: 1, lapses, st: 2 as const, seen: 0 });

const entry = (id: string, col: string[], ex = "", pos = "v.", syn: string[] = [], ant: string[] = []): Entry =>
  ({ id, w: id, uk: "", us: "", senses: [{ pos, zh: "", en: "" }], ex: ex ? [{ en: ex, zh: "" }] : [], col, fam: [], syn, ant, tip: "", cefr: "B1", topic: "education", m: 0 }) as Entry;

const progress = (cards: Record<string, ReturnType<typeof card>>) => ({ cards } as unknown as Progress);

test("weak words rank by lapses, then difficulty, and skip clean cards", () => {
  const p = progress({ a: card(1), b: card(3), c: card(0), d: card(3, 8), e: card(2) });
  assert.deepEqual(weakWords(p, 3), ["d", "b", "e"]);
  assert.deepEqual(weakWords(progress({ c: card(0) })), []);
});

test("collocation question masks headword and excludes synonyms/duplicates", () => {
  const target = entry("run", ["run a risk｜liều lĩnh", "run out of｜hết"]);
  const syn = entry("sprint", ["sprint ahead｜lao nhanh"], "", "v.", ["run"]);
  const o1 = entry("carry", ["carry out｜thực hiện"], "", "v.");
  const o2 = entry("break", ["break down｜hỏng"], "", "v.");
  const o3 = entry("take", ["take off｜cất cánh"], "", "v.");
  const dup = entry("walk", ["walk a risk｜liều"], "", "v."); // frame "___ a risk" equals target frame
  const pool = [target, syn, o1, o2, o3, dup];
  const q = collocationQuestion(target, pool, 1);
  assert.ok(q);
  assert.equal(q.options.length, 4);
  assert.ok(q.options.includes(q.answer));
  assert.ok(["___ a risk", "___ out of"].includes(q.answer));
  assert.ok(q.full === "run a risk" || q.full === "run out of");
  assert.ok(q.gloss.length > 0);
  // No option contains the target headword
  assert.equal(headwordPattern(target.w).test(q.options.join(" ")), false);
  // Every option contains "___"
  assert.ok(q.options.every((o) => o.includes("___")));
  // Synonym entry never supplied a distractor
  assert.ok(!q.options.includes("___ ahead"));
  // Duplicate frame was excluded
  assert.equal(q.options.filter((o) => o === "___ a risk").length, q.answer === "___ a risk" ? 1 : 0);
});

test("collocation question needs three usable distractors", () => {
  const target = entry("run", ["run a risk｜liều lĩnh"]);
  assert.equal(collocationQuestion(target, [target, entry("x", ["carry out｜thực hiện"])], 1), null);
  assert.equal(collocationQuestion(entry("none", []), [target], 1), null);
});

test("passage keeps only sentences long enough to read with a highlightable headword", () => {
  const long = "Training with a friend motivates me to keep going every single week.";
  const keep = entry("friend", [], long);
  // Real dataset entry: the headword carries a variant, so the sentence has nothing to highlight.
  const variant = { ...entry("cheque/check", [], "My grandmother sent me a cheque for my birthday.") };
  const list = passage([keep, entry("b", [], "Too short."), entry("c", []), variant], 6);
  assert.deepEqual(
    list.map((e) => e.id),
    ["friend"],
  );
});

test("cloze asks for the form in the sentence, and grading accepts it", () => {
  const shine = entry("shine", [], "The sun shone through my bedroom window.");
  const learn = entry("learn", [], "My grandfather is learning to swim at the local pool.");
  const absent = entry("bicycle", [], "The museum opens at nine.");
  const twice = entry("hearing", [], "His hearing improved after he received a hearing aid.");
  assert.equal(clozeTarget(shine), "shone");
  assert.equal(clozeTarget(learn), "learning");
  assert.equal(clozeTarget(absent), null);
  assert.equal(clozeTarget(twice), null);
  assert.ok(same("shone", clozeTarget(shine)!));
  assert.ok(!same("shine", clozeTarget(shine)!));
});

const word = (id: string, o: Partial<Entry> = {}, pos = "adj."): Entry => ({ ...entry(id, [], "", pos), ...o }) as Entry;
const ex = (...en: string[]) => en.map((s) => ({ en: s, zh: "" }));

test("paraphrase question prefers the IELTS sentence and offers a synonym among clean distractors", () => {
  const target = word("strong", { syn: ["powerful", "sturdy"], ant: ["weak"], ex: ex("He is strong.", "A strong economy attracts investment.") });
  const pool = [
    target,
    word("big", { syn: ["large", "huge"] }),
    word("quick", { syn: ["fast", "rapid"] }),
    word("tidy", { syn: ["neat"], ant: ["messy"] }),
    word("tough", { syn: ["strong"] }), // lists the target word: never a distractor source
    word("mighty", { syn: ["powerful"] }), // not excluded as an entry, but "powerful" is the target's synonym
  ];
  for (let seed = 1; seed < 40; seed++) {
    const q = paraphraseQuestion(target, pool, seed);
    assert.ok(q);
    assert.deepEqual(q.sentence, ["A ", "strong", " economy attracts investment."]);
    assert.equal(q.kind, "syn");
    assert.deepEqual(q.all, ["powerful", "sturdy"]);
    assert.ok(q.all.includes(q.answer));
    assert.equal(q.options.length, 4);
    assert.ok(q.options.includes(q.answer));
    const lowered = q.options.map((o) => o.toLowerCase());
    assert.equal(new Set(lowered).size, 4);
    const distractors = q.options.filter((o) => o !== q.answer);
    for (const d of distractors) {
      assert.ok(!["strong", "powerful", "sturdy", "weak", "tough"].includes(d.toLowerCase()), d);
    }
  }
});

test("paraphrase question falls back to ex[0], then to antonyms, and prefers same-POS distractors", () => {
  const target = word("calm", { ant: ["agitated"], ex: ex("The sea was calm today.") });
  const pool = [
    target,
    word("a1", { syn: ["x1"] }, "adj."),
    word("a2", { syn: ["x2"] }, "adj."),
    word("a3", { syn: ["x3"] }, "adj."),
    word("n1", { syn: ["y1", "y2", "y3"] }, "n."),
  ];
  const q = paraphraseQuestion(target, pool, 5);
  assert.ok(q);
  assert.deepEqual(q.sentence, ["The sea was ", "calm", " today."]);
  assert.equal(q.kind, "ant");
  assert.equal(q.answer, "agitated");
  // Three same-POS words are available, so no other-POS word appears.
  assert.ok(q.options.every((o) => o === "agitated" || /^(a\d|x\d)$/.test(o)));
});

test("paraphrase question returns null without highlight, related words, or three distractors", () => {
  const sentence = ex("A strong economy attracts investment.");
  const pool = [word("big", { syn: ["large"] }), word("quick", { syn: ["fast"] })];
  assert.equal(paraphraseQuestion(word("strong", { syn: ["powerful"], ex: ex("Nothing here.") }), pool, 1), null);
  assert.equal(paraphraseQuestion(word("strong", { ex: sentence }), pool, 1), null);
  assert.equal(paraphraseQuestion(word("strong", { syn: ["powerful"], ex: [] }), pool, 1), null);
  // Candidates are big, large, quick, fast; the target's own synonyms remove two, leaving two.
  assert.equal(paraphraseQuestion(word("strong", { syn: ["powerful", "big", "quick"], ex: sentence }), pool, 1), null);
});

test("paraphrase question ignores duplicates case-insensitively", () => {
  const target = word("strong", { syn: ["powerful"], ex: ex("A strong economy attracts investment.") });
  // Candidates are "a" plus three spellings of one word: two distinct words, not three.
  const pool = [target, word("a", { syn: ["Large", "large", "LARGE"] })];
  assert.equal(paraphraseQuestion(target, pool, 1), null);
  const more = [...pool, word("b")];
  assert.equal(new Set(paraphraseQuestion(target, more, 1)?.options.map((o) => o.toLowerCase())).size, 4);
});

test("family question parses fam items and asks for another part of speech", () => {
  assert.deepEqual(parseFamily(word("x", { fam: ["strength (n.)", "strongly (adv.)", "odd (prep.)", "bad"] })), [
    { word: "strength", pos: "n" },
    { word: "strongly", pos: "adv" },
  ]);
  const target = word("strong", { fam: ["strength (n.)", "strengthen (v.)", "strongly (adv.)"] });
  const pool = [target, word("wise", { fam: ["wisdom (n.)", "wisely (adv.)"] }), word("act", { fam: ["action (n.)", "active (adj.)"] }, "v.")];
  for (let seed = 1; seed < 40; seed++) {
    const q = familyQuestion(target, pool, seed);
    assert.ok(q);
    assert.notEqual(q.pos, "adj");
    assert.equal(q.options.length, 4);
    assert.ok(q.options.includes(q.answer));
    assert.equal(new Set(q.options.map((o) => o.toLowerCase())).size, 4);
    assert.equal(q.family.length, 3);
    // Every distractor has a part of speech other than the asked one, so only one option can be right.
    const asked = new Map([...q.family, { word: "strong", pos: "adj" as const }, { word: "wisdom", pos: "n" as const }, { word: "wisely", pos: "adv" as const }, { word: "action", pos: "n" as const }, { word: "active", pos: "adj" as const }].map((m) => [m.word, m.pos]));
    for (const o of q.options.filter((x) => x !== q.answer)) assert.notEqual(asked.get(o), q.pos, o);
  }
});

test("family question uses the target's own family before other words", () => {
  const target = word("advise", { fam: ["advice (n.)", "advisor (n.)", "advisory (adj.)", "advisable (adj.)"] }, "v.");
  const pool = [target, word("wise", { fam: ["wisdom (n.)"] })];
  const q = familyQuestion(target, pool, 3);
  assert.ok(q);
  // Own-family candidates other than the asked POS are enough for all three distractors.
  assert.ok(!q.options.includes("wisdom"));
  assert.ok(q.options.every((o) => o === q.answer || ["advise", "advice", "advisor", "advisory", "advisable"].includes(o)));
});

test("family question needs another POS and three distractors", () => {
  const pool = [word("wise", { fam: ["wisdom (n.)"] }), word("act", { fam: ["action (n.)"] }, "v.")];
  assert.equal(familyQuestion(word("strong", { fam: [] }), pool, 1), null);
  // The only family member has the target's own POS.
  assert.equal(familyQuestion(word("strong", { fam: ["strong (adj.)"] }), pool, 1), null);
  // Fewer than three distractors in total.
  assert.equal(familyQuestion(word("strong", { fam: ["strength (n.)"] }), pool, 1), null);
});

test("sentence check rejects short, missing and copied sentences", () => {
  const target = word("strong", { ex: ex("He is strong.", "A strong economy attracts investment.") });
  assert.deepEqual(sentenceCheck("  A strong team  ", target), { ok: false, reason: "short" });
  assert.deepEqual(sentenceCheck("The team played very well today.", target), { ok: false, reason: "missing" });
  assert.deepEqual(sentenceCheck("a strong economy attracts   INVESTMENT.", target), { ok: false, reason: "copied" });
  assert.deepEqual(sentenceCheck("The team grew stronger after the long winter break.", target), { ok: true, reason: "ok" });
});
