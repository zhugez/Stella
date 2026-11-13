import assert from "node:assert/strict";
import { test } from "node:test";
import type { Atlas, Entry, WordRef } from "../atlas/types";
import { findHeadword, makeNote, noteEntry, noteId, noteRef, sentenceAt, withNotes } from "./notes";

const words: WordRef[] = ["advise", "study", "car", "stunt", "day off", "parade", "stop", "begin"].map((word, order) => ({ id: `w${order}`, word, zh: "", ipa: "", cefr: 1, topic: 0, media: 3, order }));
const atlas = {
  words,
  byId: new Map(words.map((w) => [w.id, w])),
  count: words.length,
  peek: (id: string) => (id === "w0" ? ({ id } as Entry) : undefined),
  entry: async (id: string) => ({ id }) as Entry,
  img: () => "img.webp",
  audio: () => "a.mp3",
} as unknown as Atlas;

test("noteId lowercases, trims and joins words with a dash", () => {
  assert.equal(noteId("  Take   Off "), "u:take-off");
  assert.equal(noteId("Don’t"), "u:don't");
});

test("makeNote trims, caps and leaves out empty optional fields", () => {
  const n = makeNote(" Salt ", " muối ", "  ", undefined, "");
  assert.deepEqual({ ...n, added: 0 }, { id: "u:salt", w: "Salt", vi: "muối", added: 0 });
  const long = makeNote("x".repeat(60), "y".repeat(200), "z".repeat(900), "s".repeat(200), "n.");
  assert.deepEqual([long.w.length, long.vi.length, long.ctx!.length, long.src!.length, long.pos], [40, 120, 400, 80, "n."]);
});

test("noteEntry and noteRef carry the learner's data and nothing else", () => {
  const n = makeNote("salt", "muối", "Pass the salt.", "Dinner", "n.");
  const e = noteEntry(n);
  assert.equal(e.id, "u:salt");
  assert.deepEqual(e.senses, [{ pos: "n.", zh: "", vi: "muối", en: "" }]);
  assert.deepEqual(e.ex, [{ en: "Pass the salt.", zh: "", vi: "" }]);
  assert.deepEqual([e.m, e.uk, e.us, e.cefr, e.topic, e.vi_word, e.col, e.fam, e.syn, e.ant, e.tip], [0, "", "", "", "", "muối", [], [], [], [], ""]);
  assert.deepEqual(noteEntry(makeNote("salt", "muối")).ex, []);
  assert.deepEqual(noteRef(n, 9), { id: "u:salt", word: "salt", zh: "n. muối", ipa: "", cefr: 0, topic: 0, media: 0, order: 9 });
  assert.equal(noteRef(makeNote("salt", "muối"), 0).zh, "muối");
});

test("findHeadword matches the headword, then an inflected form, and misses everything else", () => {
  assert.equal(findHeadword(atlas, "Study"), "w1");
  assert.equal(findHeadword(atlas, "day  off"), "w4");
  assert.equal(findHeadword(atlas, "advised"), "w0");
  assert.equal(findHeadword(atlas, "studies"), "w1");
  assert.equal(findHeadword(atlas, "studying"), "w1");
  assert.equal(findHeadword(atlas, "stu"), undefined);
  assert.equal(findHeadword(atlas, "salt"), undefined);
  assert.equal(findHeadword(atlas, "advisorsxx"), undefined);
});

test("findHeadword accepts endings only, so a longer unrelated word is not taken for a short headword", () => {
  assert.equal(findHeadword(atlas, "stopped"), "w6");
  assert.equal(findHeadword(atlas, "began"), "w7");
  assert.equal(findHeadword(atlas, "paradigm"), undefined);
  assert.equal(findHeadword(atlas, "carpet"), undefined);
  assert.equal(findHeadword(atlas, "carpets"), undefined);
  assert.equal(findHeadword(atlas, "cars"), "w2");
});

test("sentenceAt returns the sentence around an index", () => {
  const text = "First one. Is it here? Yes! The last sentence.";
  assert.equal(sentenceAt(text, 0), "First one.");
  assert.equal(sentenceAt(text, text.indexOf("here")), "Is it here?");
  assert.equal(sentenceAt(text, text.indexOf("Yes")), "Yes!");
  assert.equal(sentenceAt(text, text.indexOf("last")), "The last sentence.");
  assert.equal(sentenceAt("No stop", 3), "No stop");
});

test("withNotes answers for note ids and leaves the atlas path alone", async () => {
  assert.equal(withNotes(atlas, []), atlas);
  const n = makeNote("salt", "muối", "Pass the salt.");
  const a = withNotes(atlas, [n]);
  assert.equal(a.words, atlas.words);
  assert.equal(a.words.length, 8);
  assert.equal(a.byId.get("u:salt")!.order, 8);
  assert.equal(a.byId.get("w1"), words[1]);
  assert.equal(a.peek("u:salt")!.vi_word, "muối");
  assert.equal(a.peek("w0")!.id, "w0");
  assert.equal((await a.entry("u:salt")).w, "salt");
  assert.equal((await a.entry("w2")).id, "w2");
  assert.equal(a.img(a.byId.get("u:salt")!), null);
  assert.equal(a.audio(noteEntry(n), "uk"), null);
  assert.equal(a.img(words[1]), "img.webp");
  assert.equal(a.audio(words[1], "uk"), "a.mp3");
});
