import { useSyncExternalStore } from "react";
import { contentVersion, gradeReading, type ReadingPassage } from "../lib/reading";

export interface ReadingAttempt {
  passageId: string;
  version: string;
  answers: Record<string, number>;
  assisted: boolean;
  started: number;
  submitted?: number;
  correct?: number;
}
export interface ReadingProgress { version: 1; attempts: Record<string, ReadingAttempt> }
const KEY = "stella:reading:v1";
const empty = (): ReadingProgress => ({ version: 1, attempts: {} });
export const readingKey = (p: ReadingPassage) => `${p.id}:${contentVersion(p)}`;

export function sanitizeReading(value: unknown, passages: ReadingPassage[] = []): ReadingProgress {
  if (!value || typeof value !== "object") throw new Error("Invalid reading backup.");
  const v = value as ReadingProgress;
  if (v.version !== 1 || !v.attempts || typeof v.attempts !== "object" || Array.isArray(v.attempts)) throw new Error("Unsupported reading backup.");
  for (const [key, a] of Object.entries(v.attempts)) {
    if (!a || typeof a.passageId !== "string" || typeof a.version !== "string" || key !== `${a.passageId}:${a.version}` ||
      !Number.isFinite(a.started) || a.started < 0 || typeof a.assisted !== "boolean" || !a.answers || typeof a.answers !== "object" || Array.isArray(a.answers) ||
      Object.entries(a.answers).some(([k, n]) => !/^\d+$/.test(k) || !Number.isInteger(n) || n < 0 || n > 20) ||
      (a.submitted !== undefined && (!Number.isFinite(a.submitted) || a.submitted < a.started || !Number.isInteger(a.correct) || a.correct! < 0 || a.correct! > Object.keys(a.answers).length)))
      throw new Error("Invalid reading attempt. Existing progress was kept.");
  }
  for (const p of passages) {
    const a = v.attempts[readingKey(p)];
    if (!a) continue;
    if (Object.entries(a.answers).some(([i, option]) => !p.questions[Number(i)] || option >= p.questions[Number(i)].options.length) ||
      (a.submitted !== undefined && gradeReading(p, a.answers) !== a.correct)) throw new Error("Reading backup contains an invalid answer or score.");
  }
  return JSON.parse(JSON.stringify(v));
}

export function recordAnswer(progress: ReadingProgress, p: ReadingPassage, index: number, option: number): ReadingProgress {
  const key = readingKey(p), prev = progress.attempts[key];
  if (prev?.submitted !== undefined || !p.questions[index] || !Number.isInteger(option) || option < 0 || option >= p.questions[index].options.length) return progress;
  const a = prev ?? { passageId: p.id, version: contentVersion(p), answers: {}, assisted: false, started: Date.now() };
  return { ...progress, attempts: { ...progress.attempts, [key]: { ...a, answers: { ...a.answers, [index]: option } } } };
}

export function submitReading(progress: ReadingProgress, p: ReadingPassage): ReadingProgress {
  const key = readingKey(p), a = progress.attempts[key];
  if (!a || a.submitted !== undefined) return progress;
  const correct = gradeReading(p, a.answers);
  return { ...progress, attempts: { ...progress.attempts, [key]: { ...a, correct, submitted: Date.now() } } };
}

let library: ReadingPassage[] = [];
let data = empty();
let error = "";
try { const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY); if (raw) data = sanitizeReading(JSON.parse(raw)); } catch { error = "Reading progress could not be loaded. Export or recover the stored data before continuing."; }
const listeners = new Set<() => void>();
function save(next: ReadingProgress) {
  try {
    if (error) return;
    const stored = localStorage.getItem(KEY);
    const latest = stored ? sanitizeReading(JSON.parse(stored), library) : empty();
    if (JSON.stringify(latest) !== JSON.stringify(data)) {
      data = latest;
      error = "Reading progress changed in another tab. Reload before continuing.";
    } else {
      localStorage.setItem(KEY, JSON.stringify(next));
      data = next;
    }
  } catch { error = "Reading progress could not be saved. Free storage and reload before continuing."; }
  listeners.forEach((l) => l());
}
if (typeof window !== "undefined") window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  try { data = e.newValue ? sanitizeReading(JSON.parse(e.newValue), library) : empty(); error = ""; } catch { error = "Another tab saved invalid reading data. Reload before continuing."; }
  listeners.forEach((l) => l());
});

export function useReadingProgress() {
  const progress = useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => data);
  const saveError = useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => error);
  return { progress, error: saveError };
}
export const readingStore = {
  status: () => ({ progress: data, error }),
  library(passages: ReadingPassage[]) {
    library = passages;
    try { sanitizeReading(data, library); } catch (e) { error = (e as Error).message; }
    listeners.forEach((l) => l());
  },
  answer: (p: ReadingPassage, i: number, o: number) => save(recordAnswer(data, p, i, o)),
  submit: (p: ReadingPassage) => save(submitReading(data, p)),
  assist(p: ReadingPassage) {
    const key = readingKey(p), a = data.attempts[key];
    if (a?.submitted !== undefined) return;
    save({ ...data, attempts: { ...data.attempts, [key]: { ...(a ?? { passageId: p.id, version: contentVersion(p), answers: {}, started: Date.now() }), assisted: true } } });
  },
  export: () => error ? localStorage.getItem(KEY) ?? JSON.stringify(data, null, 2) : JSON.stringify(data, null, 2),
  import(text: string) {
    const imported = sanitizeReading(JSON.parse(text), library);
    const attempts = { ...data.attempts };
    for (const [key, a] of Object.entries(imported.attempts)) if (!attempts[key]) attempts[key] = a;
    save({ version: 1, attempts });
  },
};
