import assert from "node:assert/strict";
import { test } from "node:test";
import { accepts, twinOf } from "./spelling";

test("a slash headword accepts either spelling", () => {
  assert.equal(accepts("cheque", "cheque/check"), true);
  assert.equal(accepts("check", "cheque/check"), true);
  assert.equal(accepts("czech", "cheque/check"), false);
});

test("UK and US spellings are accepted both ways", () => {
  assert.equal(accepts("organize", "organise"), true);
  assert.equal(accepts("organise", "organize"), true);
  assert.equal(accepts("colour", "color"), true);
  assert.equal(accepts("kilometer", "kilometre"), true);
  assert.equal(accepts("gray", "grey"), true);
  assert.equal(accepts("jewelry", "jewellery"), true);
  assert.equal(accepts("enroll", "enrol"), true);
  assert.equal(accepts("fulfill", "fulfil"), true);
});

test("inflected forms follow the spelling", () => {
  assert.equal(accepts("organized", "organised"), true);
  assert.equal(accepts("organizing", "organising"), true);
  assert.equal(accepts("colors", "colours"), true);
  assert.equal(accepts("traveling", "travelling"), true);
  assert.equal(accepts("enrolled", "enrolled"), true);
  assert.equal(accepts("favorite", "favourite"), true);
});

test("case and spacing do not matter", () => {
  assert.equal(accepts("  Organize ", "organise"), true);
  assert.equal(accepts("day  OFF", "day off"), true);
});

test("wrong letters and different words are rejected", () => {
  assert.equal(accepts("hor", "hour"), false);
  assert.equal(accepts("organ", "organise"), false);
  assert.equal(accepts("analyzis", "analysis"), false);
  assert.equal(accepts("story", "storey"), false);
  assert.equal(accepts("tire", "tyre"), false);
  assert.equal(accepts("license", "licence"), false);
  assert.equal(accepts("program", "programme"), false);
  assert.equal(accepts("enrolled", "enroll"), false);
});

test("twinOf returns the other spelling in both directions", () => {
  assert.equal(twinOf("organise"), "organize");
  assert.equal(twinOf("Organize"), "organise");
  assert.equal(twinOf("grey"), "gray");
  assert.equal(twinOf("table"), undefined);
  assert.equal(twinOf("storey"), undefined);
});
