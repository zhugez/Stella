import assert from "node:assert/strict";
import { test } from "node:test";
import type { Entry } from "../atlas/types";
import type { Progress } from "../store/store";
import { clozeTarget, collocationQuestion, passage, weakWords } from "./drills";
import { same } from "./typing";

const card = (lapses: number, d = 5) => ({ due: 0, s: 1, d, el: 0, sd: 0, ls: 0, reps: 1, lapses, st: 2 as const, seen: 0 });

const entry = (id: string, col: string[], ex = ""): Entry =>
  ({ id, w: id, uk: "", us: "", senses: [], ex: ex ? [{ en: ex, zh: "" }] : [], col, fam: [], syn: [], ant: [], tip: "", cefr: "B1", topic: "education", m: 0 }) as Entry;

const progress = (cards: Record<string, ReturnType<typeof card>>) => ({ cards } as unknown as Progress);

test("weak words rank by lapses, then difficulty, and skip clean cards", () => {
  const p = progress({ a: card(1), b: card(3), c: card(0), d: card(3, 8), e: card(2) });
  assert.deepEqual(weakWords(p, 3), ["d", "b", "e"]);
  assert.deepEqual(weakWords(progress({ c: card(0) })), []);
});

test("collocation question offers the real collocation and only foreign distractors", () => {
  const target = entry("run", ["run a risk｜liều lĩnh", "run out of｜用尽"]);
  const pool = [target, entry("x", ["carry out｜执行"]), entry("y", ["in terms of｜就……而言"]), entry("z", ["run late｜迟到"])];
  const q = collocationQuestion(target, pool, 1);
  assert.ok(q);
  assert.ok(q.options.includes(q.answer));
  assert.equal(q.options.length, 4);
  const own = target.col.map((c) => c.split("｜")[0]);
  assert.ok(own.includes(q.answer));
  // Distractors are borrowed, so none of them may be one of this word's own collocations.
  assert.equal(q.options.filter((o) => own.includes(o)).length, 1);
  assert.equal(new Set(q.options).size, 4);
});

test("collocation question needs three usable distractors", () => {
  const target = entry("run", ["run a risk｜liều lĩnh"]);
  assert.equal(collocationQuestion(target, [target, entry("x", ["carry out｜执行"])], 1), null);
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
