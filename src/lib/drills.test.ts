import assert from "node:assert/strict";
import { test } from "node:test";
import type { Entry } from "../atlas/types";
import type { Progress } from "../store/store";
import { headwordPattern } from "./text";
import { clozeTarget, collocationQuestion, passage, weakWords } from "./drills";
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
