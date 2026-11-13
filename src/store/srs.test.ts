import assert from "node:assert/strict";
import { test } from "node:test";
import { dict, type TranslationKey } from "../i18n";
import { formatInterval, isMastered, preview, Rating, review } from "./srs";

const DAY = 86400000;

test("a new card answered Good is scheduled soon, Again sooner", () => {
  const now = Date.UTC(2026, 9, 25);
  const p = preview(undefined, now);
  assert.ok(p[Rating.Again] < p[Rating.Good]);
  assert.ok(p[Rating.Good] <= p[Rating.Easy]);
  const c = review(undefined, Rating.Good, now);
  assert.equal(c.reps, 1);
  assert.equal(c.seen, now);
});

test("repeated successful reviews grow stability until mastered", () => {
  let now = Date.UTC(2026, 9, 25);
  let c = review(undefined, Rating.Good, now);
  for (let i = 0; i < 8 && !isMastered(c); i++) {
    now = Math.max(c.due, now + DAY);
    c = review(c, Rating.Good, now);
  }
  assert.ok(isMastered(c), `stability ${c.s}`);
});

test("a lapse resets progress and counts the lapse", () => {
  let now = Date.UTC(2026, 9, 25);
  let c = review(undefined, Rating.Good, now);
  for (let i = 0; i < 5; i++) {
    now = Math.max(c.due, now + DAY);
    c = review(c, Rating.Good, now);
  }
  const before = c.s;
  c = review(c, Rating.Again, c.due);
  assert.equal(c.lapses, 1);
  assert.ok(c.s < before);
  assert.equal(isMastered(c), false);
});

test("formatInterval writes English units", () => {
  const t = (k: TranslationKey) => dict.en[k];
  assert.equal(formatInterval(10_000, t), "<1 min");
  assert.equal(formatInterval(5 * 60_000, t), "5 min");
  assert.equal(formatInterval(3 * 3600_000, t), "3 h");
  assert.equal(formatInterval(DAY, t), "1 day");
  assert.equal(formatInterval(3 * DAY, t), "3 days");
  assert.equal(formatInterval(60 * DAY, t), "2 months");
  assert.equal(formatInterval(400 * DAY, t), "1.1 years");
});

test("formatInterval writes Vietnamese units", () => {
  const t = (k: TranslationKey) => dict.vi[k];
  assert.equal(formatInterval(3 * DAY, t), "3 ngày");
  assert.equal(formatInterval(10_000, t), "<1 phút");
});
