import assert from "node:assert/strict";
import { test } from "node:test";
import { bumpDay, dayKey, emptyProgress, sanitizeProgress, sanitizeSettings } from "./store";

const card = { due: 1, s: 2, d: 5, el: 0, sd: 1, ls: 0, reps: 1, lapses: 0, st: 2, seen: 1 };

test("keeps valid progress and drops malformed records", () => {
  const p = sanitizeProgress(
    {
      version: 2,
      cards: { ok: card, bad: { ...card, d: 99 }, worse: "x" },
      bookmarks: ["ok", 3],
      days: { "2026-10-25": { n: 1, r: 2, c: 1, t: 30 }, nope: { n: 1, r: 1, c: 1, t: 1 } },
      typing: [{ at: 1, mode: "word", items: 10, wpm: 40, accuracy: 98 }, { at: 1, mode: "hack", items: 1, wpm: 1, accuracy: 1 }],
    },
    "word-atlas-open",
  );
  assert.deepEqual(Object.keys(p.cards), ["ok"]);
  assert.deepEqual(p.bookmarks, ["ok"]);
  assert.deepEqual(Object.keys(p.days), ["2026-10-25"]);
  assert.equal(p.typing.length, 1);
});

test("rejects other versions and unknown settings", () => {
  assert.deepEqual(sanitizeProgress({ version: 1, cards: { ok: card } }, "x").cards, {});
  const s = sanitizeSettings({ accent: "fr", dailyNew: 1e9, theme: "dark", retention: 0.5 });
  assert.equal(s.accent, "uk");
  assert.equal(s.dailyNew, 10);
  assert.equal(s.theme, "dark");
  assert.equal(s.retention, 0.9);
});

test("display name is trimmed, capped and defaults to empty", () => {
  assert.equal(sanitizeSettings({}).name, "");
  assert.equal(sanitizeSettings({ name: "  Linh  " }).name, "Linh");
  assert.equal(sanitizeSettings({ name: 42 }).name, "");
  assert.equal(sanitizeSettings({ name: "x".repeat(50) }).name.length, 30);
});

test("interface language accepts en, vi, zh and falls back to vi", () => {
  assert.equal(sanitizeSettings({ lang: "en" }).lang, "en");
  assert.equal(sanitizeSettings({ lang: "zh" }).lang, "zh");
  assert.equal(sanitizeSettings({ lang: "fr" }).lang, "vi");
});

test("review log keeps valid entries, drops invalid ones and keeps the newest 5,000", () => {
  const ok = { id: "a", t: 5, k: "recall", g: 3, ms: 1200, st: 0 };
  const bad = [{ ...ok, k: "nope" }, { ...ok, g: 5 }, { ...ok, st: 4 }, { ...ok, ms: -1 }, { ...ok, id: 3 }, "x"];
  const p = sanitizeProgress({ version: 2, log: [ok, ...bad, { ...ok, id: "b" }] }, "x");
  assert.deepEqual(p.log.map((l) => l.id), ["a", "b"]);
  const many = Array.from({ length: 5100 }, (_, i) => ({ ...ok, id: String(i) }));
  const kept = sanitizeProgress({ version: 2, log: many }, "x").log;
  assert.equal(kept.length, 5000);
  assert.equal(kept[0].id, "100");
  assert.deepEqual(sanitizeProgress({ version: 2 }, "x").log, []);
});

test("days without a session count stay unchanged; a valid session count is kept", () => {
  const day = { n: 1, r: 2, c: 1, t: 30 };
  const p = sanitizeProgress({ version: 2, days: { "2026-10-25": day, "2026-10-26": { ...day, s: 2 }, "2026-10-27": { ...day, s: -1 } } }, "x");
  assert.deepEqual(p.days["2026-10-25"], day);
  assert.equal(p.days["2026-10-26"].s, 2);
  assert.deepEqual(p.days["2026-10-27"], day);
});

test("bumpDay treats a missing session count as 0 and always writes it", () => {
  const p = emptyProgress("x");
  const once = bumpDay(p, { t: 5 });
  assert.equal(once.days[dayKey()].s, 0);
  const done = bumpDay(bumpDay(once, { s: 1 }), { t: 1 });
  assert.equal(done.days[dayKey()].s, 1);
  const old = { ...p, days: { [dayKey()]: { n: 0, r: 0, c: 0, t: 0 } } };
  assert.equal(bumpDay(old, { s: 1 }).days[dayKey()].s, 1);
});
