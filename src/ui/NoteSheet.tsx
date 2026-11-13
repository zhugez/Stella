import { useState, useSyncExternalStore } from "react";
import { useAtlas } from "../atlas/context";
import { useT } from "../i18n";
import { findHeadword, makeNote, NOTE_LIMITS } from "../lib/notes";
import { openWord } from "../lib/router";
import { saveNote, useStore } from "../store/store";
import { Highlight } from "./EntryView";
import { Sheet } from "./Sheet";
import { Speak } from "./Speak";
import { toast } from "./Toast";

/** What the sheet starts with; `from` is the id of the note being edited. */
export interface NoteDraft {
  word: string;
  vi?: string;
  pos?: string;
  ctx?: string;
  src?: string;
  from?: string;
}

const POS = ["n.", "v.", "adj.", "adv.", "phr."];

let draft: NoteDraft | null = null;
const listeners = new Set<() => void>();
/** One sheet for the whole app; pass null to close it. */
export function openNoteSheet(next: NoteDraft | null) {
  draft = next;
  listeners.forEach((l) => l());
}
const closeNoteSheet = () => openNoteSheet(null);
const useDraft = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => draft,
  );

export function NoteSheet() {
  const t = useT();
  const d = useDraft();
  return (
    <Sheet open={!!d} onClose={closeNoteSheet} label={t("note_title")}>
      {d && <NoteForm key={`${d.from}|${d.word}|${d.ctx}`} draft={d} />}
    </Sheet>
  );
}

function NoteForm({ draft: d }: { draft: NoteDraft }) {
  const t = useT();
  const atlas = useAtlas();
  const accent = useStore((s) => s.settings.accent);
  const [word, setWord] = useState(d.word);
  const [vi, setVi] = useState(d.vi ?? "");
  const [pos, setPos] = useState(d.pos ?? "");
  const ready = !!word.trim() && !!vi.trim();
  // A word the atlas already has gets its card, which can be saved to learn first.
  const hit = d.from ? undefined : findHeadword(atlas, word);

  const openCard = (id: string) => {
    closeNoteSheet();
    openWord(id);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    if (hit) openCard(hit);
    else if (saveNote(makeNote(word, vi, d.ctx, d.src, pos), d.from)) {
      closeNoteSheet();
      toast(t("note_saved"), "ok");
    } else toast(t("drill_finish_first"), "warn");
  };

  return (
    <form className="note-form" onSubmit={submit}>
      <p className="eyebrow">{t("note_title")}</p>
      {hit && (
        <p className="note-hint">
          {t("note_in_atlas")}{" "}
          <button type="button" className="link" onClick={() => openCard(hit)}>
            {t("note_open_card")}
          </button>
        </p>
      )}
      <label className="note-field">
        <span>{t("note_word")}</span>
        <input data-autofocus={d.word ? undefined : ""} value={word} onChange={(e) => setWord(e.target.value)} maxLength={NOTE_LIMITS.w} lang="en" autoCapitalize="off" autoCorrect="off" spellCheck={false} required />
      </label>
      <label className="note-field">
        <span>{t("note_meaning")}</span>
        <textarea data-autofocus={d.word ? "" : undefined} value={vi} onChange={(e) => setVi(e.target.value)} maxLength={NOTE_LIMITS.vi} rows={2} lang="vi" required />
        <small>{t("note_meaning_hint")}</small>
      </label>
      <label className="note-field">
        <span>{t("note_pos")}</span>
        <select value={pos} onChange={(e) => setPos(e.target.value)}>
          <option value="">—</option>
          {POS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      {d.ctx && (
        <div className="note-field">
          <span>{t("note_source")}</span>
          <p className="note-source" lang="en">
            {word.trim() ? <Highlight text={d.ctx} word={word} /> : d.ctx}
          </p>
        </div>
      )}
      <div className="note-actions">
        <Speak url={null} text={word.trim() || d.word} accent={accent} size="sm" label={<span>{t("note_listen")}</span>} />
        <small className="muted">{t("note_device_voice")}</small>
        <button type="button" className="btn btn-ghost" onClick={closeNoteSheet}>
          {t("close")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={!ready}>
          {t("note_save")}
        </button>
      </div>
    </form>
  );
}
