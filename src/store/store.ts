import { useSyncExternalStore } from "react";
import type { Accent } from "../atlas/types";
import type { TranslationKey } from "../i18n";
import { NOTE_LIMITS, NOTE_MAX, noteId } from "../lib/notes";
import type { CardState, Grade } from "./srs";

export type QuizKind = "meaning" | "picture" | "listen" | "spell" | "recall" | "dictation";
const QUIZ_KINDS: QuizKind[] = ["meaning", "picture", "listen", "spell", "recall", "dictation"];
export type Step =
  | { id: string; kind: "intro" }
  | {
      id: string;
      kind: QuizKind;
      retry?: boolean;
      /** Ungraded check right after an intro. */
      practice?: boolean;
      options?: string[];
      /** Which example sentence the prompt uses. */
      ex?: 0 | 1;
      /** Do not show the illustration. */
      plain?: boolean;
    };

/** One graded first attempt; `st` is the card state before the answer (0 for a new card). */
export interface ReviewLog {
  id: string;
  t: number;
  k: QuizKind;
  g: 1 | 2 | 3 | 4;
  ms: number;
  st: 0 | 1 | 2 | 3;
}

export interface ActiveSession {
  id: string;
  started: number;
  steps: Step[];
  index: number;
  /** First-attempt grade per word; retries never change it. */
  graded: Record<string, Grade>;
  /** Kind of the graded attempt per word; missing in sessions saved before it existed. */
  kinds?: Record<string, QuizKind>;
  newIds: string[];
  reviewIds: string[];
  /** Answer shown but not yet continued; survives reload without double counting. */
  pending?: { correct: boolean; value: string };
  finished?: number;
}

export interface DayStat {
  n: number; // new words met
  r: number; // graded reviews (first attempts)
  c: number; // correct first attempts
  t: number; // active seconds
  s?: number; // sessions finished
}

export interface TypingRound {
  at: number;
  mode: "word" | "sentence" | "dictation" | "cloze";
  items: number;
  wpm: number;
  accuracy: number;
}

/** A word the learner added from a reading; the meaning is their own. */
export interface Note {
  /** "u:" + the word, see noteId. */
  id: string;
  w: string;
  vi: string;
  pos?: string;
  /** The sentence where the learner met the word. */
  ctx?: string;
  /** Where that sentence came from, e.g. the passage title. */
  src?: string;
  added: number;
}

export interface Progress {
  version: 2;
  datasetId: string;
  cards: Record<string, CardState>;
  bookmarks: string[];
  notes: Note[];
  days: Record<string, DayStat>;
  typing: TypingRound[];
  session: ActiveSession | null;
  /** Rolling list of recent mistakes, newest first. */
  mistakes: string[];
  /** Graded attempts, oldest first, newest 5,000 kept. */
  log: ReviewLog[];
}

export type LangPair = "en-vi" | "vi-en" | "zh-vi" | "vi-zh" | "fr-vi" | "vi-fr";

export interface Settings {
  lang: "en" | "vi" | "zh";
  /** Display name shown on the profile page. Empty means unnamed. */
  name: string;
  langPair: LangPair;
  accent: Accent;
  autoplay: boolean;
  dailyNew: number;
  retention: number;
  theme: "system" | "light" | "dark";
  sfx: boolean;
  spell: boolean;
  startLevel: number;
  onboarded: boolean;
  dataset: "open" | "private";
  ambience: "off" | "stars" | "rain" | "sea" | "forest" | "fire" | "voyage" | "cafe";
  ambienceVolume: number;
  splash: boolean;
  /** Ko-fi prompt already shown and dismissed; never ask again. */
  supportPrompted: boolean;
}

export const defaultSettings: Settings = {
  lang: "vi",
  name: "",
  langPair: "en-vi",
  accent: "uk",
  autoplay: true,
  dailyNew: 10,
  retention: 0.9,
  theme: "dark",
  sfx: true,
  spell: true,
  startLevel: 0,
  onboarded: false,
  dataset: "open",
  ambience: "stars",
  ambienceVolume: 0.45,
  splash: true,
  supportPrompted: false,
};

export const emptyProgress = (datasetId: string): Progress => ({
  version: 2,
  datasetId,
  cards: {},
  bookmarks: [],
  notes: [],
  days: {},
  typing: [],
  session: null,
  mistakes: [],
  log: [],
});

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const SETTINGS_KEY = "word-atlas:settings";
const progressKey = (id: string) => `word-atlas:v2:${id}`;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* ---------- validation (backups and stored data are untrusted) ---------- */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, lo = -Infinity, hi = Infinity) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;

function validCard(v: unknown): v is CardState {
  return (
    isObj(v) &&
    num(v.due, 0) &&
    num(v.s, 0) &&
    num(v.d, 0, 11) &&
    num(v.el, 0) &&
    num(v.sd, 0) &&
    num(v.ls, 0) &&
    num(v.reps, 0) &&
    num(v.lapses, 0) &&
    [0, 1, 2, 3].includes(v.st as number) &&
    (v.last === undefined || num(v.last, 0)) &&
    num(v.seen, 0)
  );
}

function validNote(v: unknown): Note | null {
  if (!isObj(v) || typeof v.w !== "string" || typeof v.vi !== "string" || typeof v.id !== "string" || !num(v.added, 0)) return null;
  const note: Note = { id: v.id, w: v.w.slice(0, NOTE_LIMITS.w), vi: v.vi.slice(0, NOTE_LIMITS.vi), added: v.added as number };
  if (!note.w.trim() || !note.vi.trim() || note.id !== noteId(note.w)) return null;
  if (typeof v.pos === "string") note.pos = v.pos.slice(0, NOTE_LIMITS.pos);
  if (typeof v.ctx === "string") note.ctx = v.ctx.slice(0, NOTE_LIMITS.ctx);
  if (typeof v.src === "string") note.src = v.src.slice(0, NOTE_LIMITS.src);
  return note;
}

export function sanitizeProgress(v: unknown, datasetId: string): Progress {
  const out = emptyProgress(datasetId);
  if (!isObj(v) || v.version !== 2) return out;
  if (isObj(v.cards)) for (const [k, c] of Object.entries(v.cards)) if (validCard(c)) out.cards[k] = c;
  if (Array.isArray(v.bookmarks)) out.bookmarks = v.bookmarks.filter((x): x is string => typeof x === "string").slice(0, 20000);
  if (Array.isArray(v.mistakes)) out.mistakes = v.mistakes.filter((x): x is string => typeof x === "string").slice(0, 300);
  if (Array.isArray(v.notes)) {
    const seen = new Set<string>();
    for (const raw of v.notes) {
      const note = validNote(raw);
      if (note && !seen.has(note.id) && seen.size < NOTE_MAX) {
        seen.add(note.id);
        out.notes.push(note);
      }
    }
  }
  if (isObj(v.days))
    for (const [k, d] of Object.entries(v.days))
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && isObj(d) && num(d.n, 0) && num(d.r, 0) && num(d.c, 0) && num(d.t, 0))
        out.days[k] = { n: d.n as number, r: d.r as number, c: d.c as number, t: d.t as number, ...(num(d.s, 0) ? { s: d.s as number } : {}) };
  if (Array.isArray(v.log))
    out.log = v.log
      .filter(
        (l): l is ReviewLog =>
          isObj(l) && typeof l.id === "string" && num(l.t, 0) && QUIZ_KINDS.includes(l.k as QuizKind) && [1, 2, 3, 4].includes(l.g as number) && num(l.ms, 0) && [0, 1, 2, 3].includes(l.st as number),
      )
      .slice(-5000);
  if (Array.isArray(v.typing))
    out.typing = v.typing
      .filter(
        (t): t is TypingRound =>
          isObj(t) && num(t.at, 0) && ["word", "sentence", "dictation", "cloze"].includes(t.mode as string) && num(t.items, 0) && num(t.wpm, 0, 400) && num(t.accuracy, 0, 100),
      )
      .slice(-500);
  const s = v.session;
  if (isObj(s) && typeof s.id === "string" && Array.isArray(s.steps) && num(s.index, 0) && isObj(s.graded))
    out.session = s as unknown as ActiveSession;
  return out;
}

export function sanitizeSettings(v: unknown): Settings {
  const s = { ...defaultSettings };
  if (!isObj(v)) return s;
  if (v.lang === "en" || v.lang === "vi" || v.lang === "zh") s.lang = v.lang;
  if (typeof v.name === "string") s.name = v.name.trim().slice(0, 30);
  if (["en-vi", "vi-en", "zh-vi", "vi-zh", "fr-vi", "vi-fr"].includes(v.langPair as string)) {
    s.langPair = v.langPair as LangPair;
  }
  if (v.accent === "uk" || v.accent === "us") s.accent = v.accent;
  if (typeof v.autoplay === "boolean") s.autoplay = v.autoplay;
  if (num(v.dailyNew, 0, 100)) s.dailyNew = Math.round(v.dailyNew as number);
  if (num(v.retention, 0.7, 0.97)) s.retention = v.retention as number;
  if (v.theme === "system" || v.theme === "light" || v.theme === "dark") s.theme = v.theme;
  if (typeof v.sfx === "boolean") s.sfx = v.sfx;
  if (typeof v.spell === "boolean") s.spell = v.spell;
  if (num(v.startLevel, 0, 5)) s.startLevel = Math.round(v.startLevel as number);
  if (typeof v.onboarded === "boolean") s.onboarded = v.onboarded;
  if (v.dataset === "open" || v.dataset === "private") s.dataset = v.dataset;
  if (["off", "stars", "rain", "sea", "forest", "fire", "voyage", "cafe"].includes(v.ambience as string)) s.ambience = v.ambience as Settings["ambience"];
  if (num(v.ambienceVolume, 0, 1)) s.ambienceVolume = v.ambienceVolume as number;
  if (typeof v.splash === "boolean") s.splash = v.splash;
  if (typeof v.supportPrompted === "boolean") s.supportPrompted = v.supportPrompted;
  return s;
}

/* ---------- store ---------- */

interface State {
  progress: Progress;
  settings: Settings;
  saveError: boolean;
}

let state: State = {
  progress: emptyProgress("word-atlas-open"),
  settings: sanitizeSettings(read(SETTINGS_KEY)),
  saveError: false,
};
const listeners = new Set<() => void>();
let saveTimer: number | undefined;
/** Only write when this tab changed something, so idle tabs never clobber newer data. */
let dirty = false;
/** Progress is written only after it has been read from storage for this dataset. */
let loadedId: string | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function scheduleSave() {
  dirty = true;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flush, 250);
}

export function flush() {
  window.clearTimeout(saveTimer);
  if (!dirty) return;
  dirty = false;
  const progressOk = loadedId !== state.progress.datasetId || write(progressKey(state.progress.datasetId), state.progress);
  const ok = progressOk && write(SETTINGS_KEY, state.settings);
  if (ok === state.saveError) {
    state = { ...state, saveError: !ok };
    emit();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  // Another tab saved: adopt its data instead of keeping a stale copy.
  window.addEventListener("storage", (e) => {
    if (!e.newValue) return;
    try {
      if (e.key === SETTINGS_KEY) state = { ...state, settings: sanitizeSettings(JSON.parse(e.newValue)) };
      else if (e.key === progressKey(state.progress.datasetId))
        state = { ...state, progress: sanitizeProgress(JSON.parse(e.newValue), state.progress.datasetId) };
      else return;
      emit();
    } catch {
      /* ignore malformed writes */
    }
  });
}

export const store = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  useDataset(datasetId: string) {
    flush();
    state = { ...state, progress: sanitizeProgress(read(progressKey(datasetId)), datasetId) };
    loadedId = datasetId;
    emit();
  },
  progress(fn: (p: Progress) => Progress) {
    state = { ...state, progress: fn(state.progress) };
    emit();
    scheduleSave();
  },
  settings(patch: Partial<Settings>) {
    state = { ...state, settings: { ...state.settings, ...patch } };
    emit();
    scheduleSave();
  },
};

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(state), () => select(state));
}

export function bumpDay(p: Progress, patch: Partial<DayStat>): Progress {
  const k = dayKey();
  const d = p.days[k] ?? { n: 0, r: 0, c: 0, t: 0 };
  return {
    ...p,
    days: {
      ...p.days,
      [k]: { n: d.n + (patch.n ?? 0), r: d.r + (patch.r ?? 0), c: d.c + (patch.c ?? 0), t: d.t + (patch.t ?? 0), s: (d.s ?? 0) + (patch.s ?? 0) },
    },
  };
}

export function toggleBookmark(id: string) {
  store.progress((p) => ({
    ...p,
    bookmarks: p.bookmarks.includes(id) ? p.bookmarks.filter((x) => x !== id) : [id, ...p.bookmarks],
  }));
}

/** A note in an unfinished session cannot go: the session would point at a word that no longer exists. */
const inActiveSession = (p: Progress, id: string) => !!p.session && !p.session.finished && p.session.steps.some((x) => x.id === id);

/** Add or update a note. `from` is the id it had before an edit; a renamed note keeps its card, bookmark and mistake. Returns false when the rename would break the running session. */
export function saveNote(note: Note, from = note.id): boolean {
  if (from !== note.id && inActiveSession(store.get().progress, from)) return false;
  store.progress((p) => {
    const old = p.notes.find((n) => n.id === from) ?? p.notes.find((n) => n.id === note.id);
    const move = (id: string) => (id === from ? note.id : id);
    const { [from]: moved, ...cards } = p.cards;
    return {
      ...p,
      notes: [...p.notes.filter((n) => n.id !== from && n.id !== note.id), { ...note, added: old?.added ?? note.added }],
      cards: from === note.id ? p.cards : { ...cards, ...(moved && !cards[note.id] ? { [note.id]: moved } : {}) },
      bookmarks: [...new Set(p.bookmarks.map(move))],
      mistakes: [...new Set(p.mistakes.map(move))],
    };
  });
  return true;
}

/** Remove a note with its card, bookmark and mistake. Returns false while the running session still uses it. */
export function deleteNote(id: string): boolean {
  if (inActiveSession(store.get().progress, id)) return false;
  store.progress((p) => {
    const { [id]: _card, ...cards } = p.cards;
    return { ...p, notes: p.notes.filter((n) => n.id !== id), cards, bookmarks: p.bookmarks.filter((x) => x !== id), mistakes: p.mistakes.filter((x) => x !== id) };
  });
  return true;
}

/* ---------- backup ---------- */

export function exportBackup() {
  flush();
  const { progress, settings } = state;
  return JSON.stringify({ app: "word-atlas", version: 2, exported: new Date().toISOString(), progress: { ...progress, session: null }, settings }, null, 1);
}

function markDirty() {
  dirty = true;
}

export function importBackup(text: string): { ok: true; cards: number } | { ok: false; error: TranslationKey } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "backup_invalid_json" };
  }
  if (!isObj(data) || data.app !== "word-atlas" || data.version !== 2 || !isObj(data.progress))
    return { ok: false, error: "backup_not_stella" };
  const id = state.progress.datasetId;
  if (data.progress.datasetId !== id) return { ok: false, error: "backup_other_dataset" };
  const progress = sanitizeProgress({ ...data.progress, session: null }, id);
  state = { ...state, progress, settings: { ...sanitizeSettings(data.settings), onboarded: true } };
  emit();
  markDirty();
  flush();
  return { ok: true, cards: Object.keys(progress.cards).length };
}

export function resetProgress() {
  state = { ...state, progress: emptyProgress(state.progress.datasetId) };
  emit();
  markDirty();
  flush();
}
