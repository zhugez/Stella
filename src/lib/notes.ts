import type { Atlas, Entry, WordRef } from "../atlas/types";
import type { Note } from "../store/store";
import { headwordPattern, IRREGULAR, normalize } from "./text";

export const NOTE_LIMITS = { w: 40, vi: 120, pos: 8, ctx: 400, src: 80 } as const;
export const NOTE_MAX = 2000;

export const isNoteId = (id: string) => id.startsWith("u:");
export const noteId = (word: string) => `u:${normalize(word).replace(/ /g, "-")}`;

export function makeNote(word: string, vi: string, ctx?: string, src?: string, pos?: string): Note {
  const w = word.trim().slice(0, NOTE_LIMITS.w);
  const note: Note = { id: noteId(w), w, vi: vi.trim().slice(0, NOTE_LIMITS.vi), added: Date.now() };
  if (pos) note.pos = pos.slice(0, NOTE_LIMITS.pos);
  if (ctx?.trim()) note.ctx = ctx.trim().slice(0, NOTE_LIMITS.ctx);
  if (src?.trim()) note.src = src.trim().slice(0, NOTE_LIMITS.src);
  return note;
}

/** The learner's own data in the shape of an atlas entry; no audio, image, IPA or translation of the example. */
export function noteEntry(n: Note): Entry {
  return {
    id: n.id,
    w: n.w,
    uk: "",
    us: "",
    senses: [{ pos: n.pos ?? "", zh: "", vi: n.vi, en: "" }],
    ex: n.ctx ? [{ en: n.ctx, zh: "", vi: "" }] : [],
    col: [],
    fam: [],
    syn: [],
    ant: [],
    tip: "",
    cefr: "",
    topic: "",
    m: 0,
    vi_word: n.vi,
  };
}

/** `order` is past the end of the learning path, so notes never collide with atlas positions. */
export function noteRef(n: Note, order: number): WordRef {
  return { id: n.id, word: n.w, zh: `${n.pos ?? ""} ${n.vi}`.trim(), ipa: "", cefr: 0, topic: 0, media: 0, order };
}

interface HeadwordIndex {
  exact: Map<string, string>;
  /** Headwords by their first three letters, so an inflected form is only tested against likely stems. */
  byStart: Map<string, WordRef[]>;
}
const indexes = new WeakMap<WordRef[], HeadwordIndex>();

const ENDING = /^(?:s|es|ed|d|ing|ly|ily|er|ers|est|ies|ied|ier|iest)$/;

/** `headwordPattern` also matches up to four more letters, so "paradigm" would pass for "parade"; an inflection may only add an ending. */
function inflects(headword: string, form: string) {
  const base = headword.toLowerCase();
  if (IRREGULAR.get(base)?.includes(form)) return true;
  let shared = 0;
  while (shared < form.length && form[shared] === base[shared]) shared++;
  // "stop" → "stopped": the last letter doubles.
  return ENDING.test(form.slice(shared).replace(new RegExp(`^${base.slice(-1)}`), ""));
}

/** Atlas id of the headword for `word`, either spelled the same or an inflected form of it ("studies" → study). */
export function findHeadword(atlas: Atlas, word: string): string | undefined {
  let index = indexes.get(atlas.words);
  if (!index) {
    index = { exact: new Map(), byStart: new Map() };
    for (const w of atlas.words) {
      const key = normalize(w.word);
      if (!index.exact.has(key)) index.exact.set(key, w.id);
      const start = key.slice(0, 3);
      const group = index.byStart.get(start);
      if (group) group.push(w);
      else index.byStart.set(start, [w]);
    }
    indexes.set(atlas.words, index);
  }
  const key = normalize(word);
  const exact = index.exact.get(key);
  if (exact || key.length < 3) return exact;
  return index.byStart.get(key.slice(0, 3))?.find((w) => {
    const m = headwordPattern(w.word).exec(key);
    return m && m.index === 0 && m[0].length === key.length && inflects(w.word, key);
  })?.id;
}

/** The sentence of `text` that contains character `index`; sentences end at . ! ? followed by a space. */
export function sentenceAt(text: string, index: number) {
  let start = 0;
  for (const m of text.matchAll(/[.!?]\s+/g)) {
    if (m.index >= index) return text.slice(start, m.index + 1);
    start = m.index + m[0].length;
  }
  return text.slice(start);
}

const SELECTION_WORD = "[a-z'’-]*[a-z][a-z'’-]*";
const SELECTION = new RegExp(`^${SELECTION_WORD}(?: ${SELECTION_WORD}){0,3}$`);

/** A selected 1–4 word phrase ready to note: trimmed, lowercased, spaces collapsed. Null for numbers, punctuation, longer text. */
export function selectionWord(text: string): string | null {
  const s = text.replace(/\s+/g, " ").trim().toLowerCase();
  return s.length <= NOTE_LIMITS.w && SELECTION.test(s) ? s : null;
}

/** The sentence around `index` of a block's text, on one line and without a leading "[1] " paragraph number. */
export const selectionSentence = (block: string, index: number) =>
  sentenceAt(block, index).replace(/\s+/g, " ").replace(/^ ?\[\d+\] /, "").trim().slice(0, NOTE_LIMITS.ctx);

/** Notes that have no review card yet. */
export const unlearnedCount = (notes: Note[], cards: Record<string, unknown>) => notes.filter((n) => !cards[n.id]).length;

/** The atlas, also answering for note ids. `words` stays the atlas path, so the Atlas page, galaxy and level path never list notes. */
export function withNotes(atlas: Atlas, notes: Note[]): Atlas {
  if (!notes.length) return atlas;
  const entries = new Map(notes.map((n) => [n.id, noteEntry(n)]));
  const byId = new Map(atlas.byId);
  notes.forEach((n, i) => byId.set(n.id, noteRef(n, atlas.words.length + i)));
  const own = (ref: WordRef | Entry) => entries.has(ref.id);
  return {
    ...atlas,
    byId,
    peek: (id) => entries.get(id) ?? atlas.peek(id),
    entry: (id) => {
      const e = entries.get(id);
      return e ? Promise.resolve(e) : atlas.entry(id);
    },
    img: (ref, size) => (own(ref) ? null : atlas.img(ref, size)),
    audio: (ref, kind) => (own(ref) ? null : atlas.audio(ref, kind)),
  };
}
