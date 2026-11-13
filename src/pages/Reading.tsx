import { ArrowRight, BookOpen, RefreshCw } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { prefetch, useAtlas } from "../atlas/context";
import type { Entry } from "../atlas/types";
import { topicLabel, tr, useT } from "../i18n";
import { passage } from "../lib/drills";
import { evidenceParagraph, GAP_MAX_CHARS, gapCorrect, isAnswered, optionOrder, parsePassages, type ReadingPassage } from "../lib/reading";
import { findHeadword, noteId, sentenceAt } from "../lib/notes";
import { go, openWord } from "../lib/router";
import { shuffle, splitHighlight } from "../lib/text";
import { readingKey, readingStore, useReadingProgress } from "../store/reading";
import { useStore } from "../store/store";
import { openNoteSheet } from "../ui/NoteSheet";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Reading() {
  const t = useT();
  const atlas = useAtlas();
  const [mode, setMode] = useState<"passage" | "sentences">("passage");
  const [topic, setTopic] = useState(() => atlas.topics[0][0]);
  const [seed, setSeed] = useState(() => Date.now());
  const [lines, setLines] = useState<Entry[] | null>(null);
  const [passages, setPassages] = useState<ReadingPassage[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    setPassages(null);
    fetch(`${BASE}/atlas/reading/passages.json`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error(tr("reading_load_failed")); return r.json(); })
      .then((v: unknown) => { if (!controller.signal.aborted) { const parsed = parsePassages(v); readingStore.library(parsed); setPassages(parsed); } })
      .catch((e: Error) => { if (!controller.signal.aborted) setLoadError(e.message); });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    let live = true;
    setLines(null);
    const ti = atlas.topics.findIndex((tp) => tp[0] === topic);
    const ids = shuffle(atlas.words.filter((w) => w.topic === ti), seed).slice(0, 18).map((w) => w.id);
    void prefetch(atlas, ids).then((list) => { if (live) setLines(passage(list.filter((e): e is Entry => !!e), 6)); });
    return () => { live = false; };
  }, [atlas, topic, seed]);

  const topicPassages = useMemo(() => passages?.filter((p) => p.topic === topic) ?? [], [passages, topic]);
  const current = topicPassages.find((p) => p.id === selected) ?? topicPassages[0];

  return <div className="page reading">
    <header className="page-head">
      <h1 className="display">{t("reading_title")}</h1>
      <p className="lede">{t("reading_lede")}</p>
    </header>
    <div className="chips reading-topics">
      <button className={`chip-btn ${mode === "passage" ? "is-on" : ""}`} aria-pressed={mode === "passage"} onClick={() => setMode("passage")}><BookOpen size={15} /> {t("reading_full_passages")}</button>
      <button className={`chip-btn ${mode === "sentences" ? "is-on" : ""}`} aria-pressed={mode === "sentences"} onClick={() => setMode("sentences")}>{t("reading_topic_sentences")}</button>
    </div>
    <div className="chips chips-scroll reading-topics" role="group" aria-label={t("topic_group")}>{atlas.topics.map(([key, name]) => <button key={key} className={`chip-btn ${topic === key ? "is-on" : ""}`} aria-pressed={topic === key} onClick={() => { setTopic(key); setSelected(null); }}>{topicLabel(t, name)}</button>)}</div>
    {mode === "passage" ? <>
      {loadError ? <section className="panel" role="alert"><p>{loadError} {t("reading_no_grading")}</p><button className="btn btn-primary" onClick={() => setReload((n) => n + 1)}>{t("reading_retry")}</button></section> : passages === null ? <p role="status">{t("reading_loading")}</p> : !current ? <p>{t("reading_no_passages")}</p> : <>
        <div className="chips reading-topics">{topicPassages.map((p, i) => <button key={p.id} className={`chip-btn ${current.id === p.id ? "is-on" : ""}`} aria-pressed={current.id === p.id} onClick={() => setSelected(p.id)}>{t("reading_article").replace("{n}", String(i + 1)).replace("{name}", p.author ?? t("reading_academic_overview"))}</button>)}</div>
        <Reader key={readingKey(current)} passage={current} />
      </>}
    </> : <section className="panel passage">
      <p className="muted">{t("reading_sentences_note")}</p>
      {lines === null ? <p role="status">{t("reading_loading_sentences")}</p> : lines.length ? <div className="passage-body">{lines.map((e) => <Line key={e.id} entry={e} />)}</div> : <p>{t("reading_no_sentences")}</p>}
      <div className="passage-actions"><button className="btn btn-primary" onClick={() => setSeed(Date.now())}><RefreshCw size={18} /> {t("reading_new_sentences")}</button></div>
    </section>}
    <div className="passage-actions"><button className="btn btn-ghost" onClick={() => go({ page: "atlas", topic })}>{t("reading_browse_atlas")} <ArrowRight size={18} /></button></div>
  </div>;
}

/** Every word of 3+ letters is a button: a known headword opens its card, any other word opens the note sheet. `vocab` maps the highlighted forms to atlas ids. */
function Words({ text, vocab, source }: { text: string; vocab?: Map<string, string>; source?: string }) {
  const t = useT();
  const atlas = useAtlas();
  const notes = useStore((s) => s.progress.notes);
  const pick = (word: string, at: number, known?: string) => {
    const id = known ?? findHeadword(atlas, word);
    if (id) return openWord(id);
    const lower = word.toLowerCase();
    const old = notes.find((n) => n.id === noteId(lower));
    // Opening the sheet is a lookup like any other, so the attempt counts as assisted.
    window.dispatchEvent(new Event("stella:dictionary"));
    openNoteSheet({ word: lower, vi: old?.vi, pos: old?.pos, ctx: sentenceAt(text, at).trim(), src: source, from: old?.id });
  };
  let at = 0;
  return <>{text.split(/([a-zA-Z]{3,})/g).map((part, j) => {
    const start = at;
    at += part.length;
    if (j % 2 === 0) return part;
    const known = vocab?.get(part.toLowerCase());
    return <button key={j} className={known ? "passage-word" : "passage-token"} onClick={() => pick(part, start, known)} title={known ? t("open_card").replace("{word}", part) : undefined}>{part}</button>;
  })}</>;
}

function Reader({ passage: p }: { passage: ReadingPassage }) {
  const t = useT();
  const atlas = useAtlas();
  const { progress, error } = useReadingProgress();
  const attempt = progress.attempts[readingKey(p)];
  const submitted = attempt?.submitted !== undefined;
  const supported = p.questions.length > 0 && p.questions.every((_, i) => !!evidenceParagraph(p, i));
  const [message, setMessage] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const vocab = useMemo(() => new Map(p.vocabulary.filter((v) => { const word = atlas.byId.get(v.id); return word && word.cefr >= 2; }).map((v) => [v.word.toLowerCase(), v.id])), [p, atlas]);
  useEffect(() => {
    const assist = () => { if (supported) readingStore.assist(p); };
    window.addEventListener("stella:dictionary", assist);
    if (new URLSearchParams(location.hash.split("?")[1]).has("w")) assist();
    return () => window.removeEventListener("stella:dictionary", assist);
  }, [p, supported]);
  const lookup = (id: string) => openWord(id);
  const allAnswered = p.questions.every((q, i) => isAnswered(q, attempt?.answers[i]));
  const download = () => {
    const url = URL.createObjectURL(new Blob([readingStore.export()], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "stella-reading-backup.json"; a.click(); URL.revokeObjectURL(url);
  };
  if (p.author) return <section className="panel passage"><h2>{p.title}</h2><p role="status">{t("reading_quarantined")}</p></section>;
  return <section className="panel passage">
    <h2>{p.title}</h2>
    <p className="muted">{t("reading_meta").replace("{cefr}", p.cefr).replace("{n}", String(p.wordCount))}{p.author ? ` · ${p.author}` : ""}</p>
    {p.source && <p className="muted">{t("reading_source").replace("{source}", p.source)}</p>}
    <p className="muted">{t("reading_draft")} {supported ? t("reading_submit_note") : t("reading_explore_only")}</p>
    {error && <p role="alert">{error}</p>}
    <div className="passage-body">{p.paragraphs.map((text, i) => <p className="passage-line" lang="en" id={`reading-p${i + 1}`} key={i}><span className="muted">[{i + 1}] </span><Words text={text} vocab={vocab} source={p.title} /></p>)}</div>
    <div className="passage-actions">{p.vocabulary.filter((v) => atlas.byId.has(v.id)).slice(0, 30).map((v) => <button className="chip-btn" key={v.id} onClick={() => lookup(v.id)}>{v.word}</button>)}</div>
    {supported && <div className="reading-questions">
      <h3>{t("reading_questions_title")}</h3>
      {submitted && <p role="status">{t("reading_result").replace("{score}", String(attempt.correct)).replace("{total}", String(p.questions.length)).replace("{mode}", attempt.assisted ? t("reading_assisted") : t("reading_unassisted"))}</p>}
      {p.questions.map((q, i) => {
        const order = optionOrder(p, i);
        const given = attempt?.answers[i];
        const [before, after] = q.type === "gap" ? q.question.split(/_{4,}/) : [];
        const right = q.type === "gap" ? typeof given === "string" && gapCorrect(q, given) : given === q.answer;
        return <Fragment key={i}>
          {q.type !== p.questions[i - 1]?.type && <h4 className="reading-group">{t(`reading_group_${q.type}`)}</h4>}
          <fieldset className="reading-question" disabled={submitted || !!error}>
            {q.type === "gap" ? <>
              <legend>{i + 1}. {before}<input className="reading-gap" type="text" value={typeof given === "string" ? given : ""} maxLength={GAP_MAX_CHARS} autoComplete="off" autoCapitalize="off" spellCheck={false} aria-label={t("reading_gap_label").replace("{n}", String(i + 1))} onChange={(e) => readingStore.answer(p, i, e.target.value)} />{after}</legend>
              <p className="muted">{t("reading_gap_rule")}</p>
            </> : <>
              <legend>{i + 1}. {q.question}</legend>
              {order.map((j) => <label className="reading-option" key={j}><input type="radio" name={`${p.id}-q${i}`} checked={given === j} onChange={() => readingStore.answer(p, i, j)} />{q.options[j]}</label>)}
            </>}
            {submitted && <div className="reading-feedback"><p>{t(right ? "reading_correct" : "reading_incorrect").replace("{answer}", q.type === "gap" ? q.accept[0] : q.options[q.answer])}</p><p>{q.explanation}</p><a href={`#reading-p${evidenceParagraph(p, i)}`} onClick={(e) => { e.preventDefault(); document.getElementById(`reading-p${evidenceParagraph(p, i)}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>{t("reading_evidence").replace("{n}", String(evidenceParagraph(p, i)))}</a></div>}
          </fieldset>
        </Fragment>;
      })}
      {!submitted && <button className="btn btn-primary" disabled={!allAnswered || !!error} onClick={() => { try { readingStore.submit(p); } catch (e) { setMessage((e as Error).message); } }}>{t("reading_submit")}</button>}
    </div>}
    <div className="passage-actions">
      <button className="btn btn-ghost" onClick={download}>{t("reading_export")}</button>
      <button className="btn btn-ghost" disabled={!!error} onClick={() => file.current?.click()}>{t("reading_import")}</button>
      <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => { const selected = e.target.files?.[0]; if (!selected) return; try { readingStore.import(await selected.text()); setMessage(t("reading_merged")); } catch (err) { setMessage((err as Error).message); } e.target.value = ""; }} />
    </div>
    <p className="muted">{t("reading_storage_note")}</p>
    {message && <p role="status">{message}</p>}
  </section>;
}

function Line({ entry }: { entry: Entry }) {
  const parts = splitHighlight(entry.ex[0].en, entry.w);
  return <p className="passage-line" lang="en"><Words text={entry.ex[0].en} vocab={parts ? new Map([[parts[1].toLowerCase(), entry.id]]) : undefined} /></p>;
}
