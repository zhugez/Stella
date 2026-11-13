import { NotebookPen } from "lucide-react";
import { useEffect, useRef } from "react";
import { useT } from "../i18n";
import { noteId, selectionSentence, selectionWord, unlearnedCount } from "../lib/notes";
import { closeWord, useLocation } from "../lib/router";
import { store, useStore } from "../store/store";
import { openNoteSheet } from "./NoteSheet";

/** A selection read from the page: pressing the badge can clear it, so it is captured beforehand. */
interface Picked {
  word: string;
  ctx: string;
  /** Title of the reading passage the selection is in. */
  title?: string;
  at: number;
}

const REMEMBER_MS = 10_000;
const BLOCK = "p, li, blockquote, h1, h2, h3, h4, h5, h6, td, dd, figcaption";

function readSelection(): Picked | null {
  const sel = getSelection();
  const active = document.activeElement;
  if (!sel?.rangeCount || sel.isCollapsed || active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return null;
  const word = selectionWord(sel.toString());
  if (!word) return null;
  const range = sel.getRangeAt(0);
  const start = range.startContainer;
  const el = start instanceof Element ? start : start.parentElement;
  const block = el?.closest(BLOCK) ?? el;
  if (!block) return null;
  const before = document.createRange();
  before.selectNodeContents(block);
  before.setEnd(start, range.startOffset);
  const title = block.closest(".passage")?.querySelector("h2")?.textContent?.trim();
  return { word, ctx: selectionSentence(block.textContent ?? "", before.toString().length), title: title || undefined, at: Date.now() };
}

/** Round button on every page: opens the note sheet, prefilled from the text selected on the page. `page` names where the learner is. */
export function NoteBadge({ page }: { page: string }) {
  const t = useT();
  const loc = useLocation();
  const count = useStore((s) => unlearnedCount(s.progress.notes, s.progress.cards));
  const button = useRef<HTMLButtonElement>(null);
  const remembered = useRef<Picked | null>(null);
  const grabbed = useRef<Picked | null>(null);

  useEffect(() => {
    remembered.current = null;
  }, [loc]);

  useEffect(() => {
    const keep = () => {
      const picked = readSelection();
      if (picked) remembered.current = picked;
    };
    document.addEventListener("selectionchange", keep);
    return () => document.removeEventListener("selectionchange", keep);
  }, []);

  const grab = () => {
    const old = remembered.current;
    return readSelection() ?? (old && Date.now() - old.at < REMEMBER_MS ? old : null);
  };

  const open = (picked: Picked | null) => {
    remembered.current = null;
    // A word card and the note sheet never stack, as when a note is edited from its card.
    if (loc.word) closeWord();
    if (!picked) return openNoteSheet({ word: "" });
    const old = store.get().progress.notes.find((n) => n.id === noteId(picked.word));
    openNoteSheet({ word: picked.word, vi: old?.vi, pos: old?.pos, ctx: picked.ctx, src: picked.title ?? page, from: old?.id });
  };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.key.toLowerCase() !== "n") return;
      const target = e.target as HTMLElement;
      // The badge is hidden under other sheets; the shortcut follows it.
      if (target.isContentEditable || target.closest("input, textarea, select") || !button.current?.checkVisibility()) return;
      e.preventDefault();
      open(grab());
    };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  });

  return (
    <button
      ref={button}
      type="button"
      className="note-badge"
      aria-label={t("note_badge")}
      onPointerDown={() => (grabbed.current = grab())}
      // detail 0: activated from the keyboard, no pointerdown came first.
      onClick={(e) => {
        open(e.detail ? (grabbed.current ?? grab()) : grab());
        grabbed.current = null;
      }}
    >
      <NotebookPen className="note-badge-icon" size={22} aria-hidden="true" />
      {count > 0 && (
        <span className="note-badge-count" aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
