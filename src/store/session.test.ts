import assert from "node:assert/strict";
import { test } from "node:test";
import type { Atlas, WordRef } from "../atlas/types";
import { answer, advance, buildSession, sessionStats } from "./session";
import { Rating } from "./srs";
import { defaultSettings, emptyProgress, exportBackup, importBackup, sanitizeProgress, store } from "./store";

const storage = new Map<string, string>();
Object.assign(globalThis, {
  window: { clearTimeout() {}, setTimeout() { return 0; } },
  localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) },
});
const words: WordRef[] = ["one", "two", "three", "four"].map((id, order) => ({
  id, word: id, zh: `n. ${id}`, vi: id, ipa: "", cefr: 0, topic: 0, media: 0, order,
}));
const atlas = { words, byId: new Map(words.map((w) => [w.id, w])), cefr: ["A1", "A2", "B1", "B2", "C1", "C2"] } as Atlas;

function start() {
  const p = emptyProgress("session-test");
  const s = buildSession(atlas, p, { ...defaultSettings, dailyNew: 1 });
  s.index = s.steps.findIndex((step) => step.kind !== "intro");
  store.progress(() => ({ ...p, session: s }));
  const step = s.steps[s.index];
  assert.notEqual(step.kind, "intro");
  return step as typeof step & { kind: "meaning" };
}

test("serialized sessions resume through intro, quiz, feedback and completion", () => {
  const p = emptyProgress("session-test");
  p.session = buildSession(atlas, p, { ...defaultSettings, dailyNew: 1 });
  store.progress(() => sanitizeProgress(JSON.parse(JSON.stringify(p)), p.datasetId));
  advance(2, store.get().progress.session!.steps[0]);
  const step = store.get().progress.session!.steps[1];
  assert.ok(step.kind !== "intro");
  answer(atlas, step, true, Rating.Good, step.id);
  const saved = store.get().progress;
  store.progress(() => sanitizeProgress(JSON.parse(JSON.stringify(saved)), saved.datasetId));
  assert.equal(store.get().progress.session!.pending!.correct, true);
  advance(2, store.get().progress.session!.steps[1]);
  assert.ok(store.get().progress.session!.finished);
  assert.equal(sessionStats(store.get().progress.session!).accuracy, 100);
});

test("first submitted feedback and retry queue cannot be overwritten", () => {
  const step = start();
  answer(atlas, step, false, Rating.Again, "wrong");
  const first = store.get().progress;
  answer(atlas, step, true, Rating.Good, step.id);
  assert.deepEqual(store.get().progress, first);
  assert.equal(sessionStats(first.session!).accuracy, 0);
});

test("stale answers and duplicate continue events do not skip an unanswered quiz", () => {
  const step = start();
  answer(atlas, step, false, Rating.Again, "wrong");
  advance(3, step);
  const next = store.get().progress;
  answer(atlas, step, true, Rating.Good, step.id);
  advance(3, step);
  assert.deepEqual(store.get().progress, next);
});

test("duplicate feedback continue cannot skip the next introduction", () => {
  const step = start();
  store.progress((p) => ({ ...p, session: { ...p.session!, steps: [...p.session!.steps, { id: "two", kind: "intro" }] } }));
  answer(atlas, step, true, Rating.Good, step.id);
  advance(1, step);
  const next = store.get().progress;
  assert.equal(next.session!.steps[next.session!.index].kind, "intro");
  advance(1, step);
  assert.deepEqual(store.get().progress, next);
});

test("retry feedback does not change first-attempt cards or counters; backups preserve them", () => {
  const step = start();
  answer(atlas, step, false, Rating.Again, "wrong");
  const first = store.get().progress;
  advance(3, step);
  const retry = store.get().progress.session!.steps[store.get().progress.session!.index];
  assert.ok(retry.kind !== "intro" && retry.retry);
  answer(atlas, retry, true, Rating.Good, retry.id);
  const after = store.get().progress;
  assert.deepEqual(after.cards, first.cards);
  assert.equal(sessionStats(after.session!).accuracy, 0);
  const counters = Object.values(after.days)[0];
  assert.equal(counters.r, 1);
  assert.equal(counters.c, 0);
  const backup = exportBackup();
  assert.equal(importBackup(backup).ok, true);
  assert.deepEqual(store.get().progress.cards, after.cards);
  assert.deepEqual(store.get().progress.days, after.days);
  assert.equal(store.get().progress.session, null);
});
