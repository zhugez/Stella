import { ArrowRight, BookOpen, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { prefetch, useAtlas } from "../atlas/context";
import type { Entry } from "../atlas/types";
import { passage } from "../lib/drills";
import { evidenceParagraph, parsePassages, type ReadingPassage } from "../lib/reading";
import { go, openWord } from "../lib/router";
import { shuffle, splitHighlight } from "../lib/text";
import { readingKey, readingStore, useReadingProgress } from "../store/reading";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Reading() {
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
      .then((r) => { if (!r.ok) throw new Error("Reading content could not be loaded."); return r.json(); })
      .then((v: unknown) => { if (!controller.signal.aborted) { const parsed = parsePassages(v); readingStore.library(parsed); setPassages(parsed); } })
      .catch((e: Error) => { if (!controller.signal.aborted) setLoadError(e.message); });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    let live = true;
    setLines(null);
    const ti = atlas.topics.findIndex((t) => t[0] === topic);
    const ids = shuffle(atlas.words.filter((w) => w.topic === ti), seed).slice(0, 18).map((w) => w.id);
    void prefetch(atlas, ids).then((list) => { if (live) setLines(passage(list.filter((e): e is Entry => !!e), 6)); });
    return () => { live = false; };
  }, [atlas, topic, seed]);

  const topicPassages = useMemo(() => passages?.filter((p) => p.topic === topic) ?? [], [passages, topic]);
  const current = topicPassages.find((p) => p.id === selected) ?? topicPassages[0];

  return <div className="page reading">
    <header className="page-head">
      <h1 className="display">Read, understand, explore.</h1>
      <p className="lede">Academic practice and classic extracts. Levels are editorial targets, not certified CEFR levels or IELTS scores.</p>
    </header>
    <div className="chips reading-topics">
      <button className={`chip-btn ${mode === "passage" ? "is-on" : ""}`} aria-pressed={mode === "passage"} onClick={() => setMode("passage")}><BookOpen size={15} /> Full passages</button>
      <button className={`chip-btn ${mode === "sentences" ? "is-on" : ""}`} aria-pressed={mode === "sentences"} onClick={() => setMode("sentences")}>Topic sentences</button>
    </div>
    <div className="chips reading-topics">{atlas.topics.map(([key, name]) => <button key={key} className={`chip-btn ${topic === key ? "is-on" : ""}`} aria-pressed={topic === key} onClick={() => { setTopic(key); setSelected(null); }}>{name}</button>)}</div>
    {mode === "passage" ? <>
      {loadError ? <section className="panel" role="alert"><p>{loadError} No answers will be graded.</p><button className="btn btn-primary" onClick={() => setReload((n) => n + 1)}>Retry loading</button></section> : passages === null ? <p role="status">Loading reading library…</p> : !current ? <p>No passages in this topic yet.</p> : <>
        <div className="chips reading-topics">{topicPassages.map((p, i) => <button key={p.id} className={`chip-btn ${current.id === p.id ? "is-on" : ""}`} aria-pressed={current.id === p.id} onClick={() => setSelected(p.id)}>Article {i + 1}: {p.author ?? "Academic overview"}</button>)}</div>
        <Reader key={readingKey(current)} passage={current} />
      </>}
    </> : <section className="panel passage">
      <p className="muted">Independent example sentences sharing a topic, not a continuous story or comprehension assessment.</p>
      {lines === null ? <p role="status">Loading sentences…</p> : lines.length ? <div className="passage-body">{lines.map((e) => <Line key={e.id} entry={e} />)}</div> : <p>No sentences available. Try another topic.</p>}
      <div className="passage-actions"><button className="btn btn-primary" onClick={() => setSeed(Date.now())}><RefreshCw size={18} /> New sentences</button></div>
    </section>}
    <div className="passage-actions"><button className="btn btn-ghost" onClick={() => go({ page: "atlas", topic })}>Browse in Atlas <ArrowRight size={18} /></button></div>
  </div>;
}

function Reader({ passage: p }: { passage: ReadingPassage }) {
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
  const allAnswered = p.questions.every((_, i) => attempt?.answers[i] !== undefined);
  const download = () => {
    const url = URL.createObjectURL(new Blob([readingStore.export()], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "stella-reading-backup.json"; a.click(); URL.revokeObjectURL(url);
  };
  if (p.author) return <section className="panel passage"><h2>{p.title}</h2><p role="status">This imported extract is quarantined pending source and question verification. It cannot be read or graded here yet. Choose an Academic overview for draft practice.</p></section>;
  return <section className="panel passage">
    <h2>{p.title}</h2>
    <p className="muted">{p.cefr} editorial target · {p.wordCount} words{p.author ? ` · ${p.author}` : ""}</p>
    {p.source && <p className="muted">Source: {p.source}. Extract, not the complete work.</p>}
    <p className="muted">Draft content: practice only, not a validated reading assessment. {supported ? "Submit all answers before feedback. Dictionary use marks this attempt as assisted." : "Explore only: question evidence for this extract has not been verified, so grading is disabled."}</p>
    {error && <p role="alert">{error}</p>}
    <div className="passage-body">{p.paragraphs.map((text, i) => <p className="passage-line" lang="en" id={`reading-p${i + 1}`} key={i}><span className="muted">[{i + 1}] </span>{text.split(/([a-zA-Z]{3,})/g).map((word, j) => { const id = vocab.get(word.toLowerCase()); return id ? <button key={j} className="passage-word" onClick={() => lookup(id)} title={`${word} — open card`}>{word}</button> : word; })}</p>)}</div>
    <div className="passage-actions">{p.vocabulary.filter((v) => atlas.byId.has(v.id)).slice(0, 30).map((v) => <button className="chip-btn" key={v.id} onClick={() => lookup(v.id)}>{v.word}</button>)}</div>
    {supported && <div className="reading-questions">
      <h3>Comprehension practice</h3>
      {submitted && <p role="status">First submission: {attempt.correct}/{p.questions.length} · {attempt.assisted ? "Assisted practice" : "Without dictionary support"}. This is a practice score, not a proficiency estimate. Your first submission is preserved.</p>}
      {p.questions.map((q, i) => <fieldset key={i} className="reading-question" disabled={submitted || !!error}>
        <legend>{i + 1}. {q.question}</legend>
        {q.options.map((option, j) => <label className="reading-option" key={j}><input type="radio" name={`${p.id}-q${i}`} checked={attempt?.answers[i] === j} onChange={() => readingStore.answer(p, i, j)} />{option}</label>)}
        {submitted && <div className="reading-feedback"><p>{attempt.answers[i] === q.answer ? "Correct" : "Incorrect"}. Answer: {q.options[q.answer]}</p><p>{q.explanation}</p><a href={`#reading-p${evidenceParagraph(p, i)}`} onClick={(e) => { e.preventDefault(); document.getElementById(`reading-p${evidenceParagraph(p, i)}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Evidence: paragraph {evidenceParagraph(p, i)}</a></div>}
      </fieldset>)}
      {!submitted && <button className="btn btn-primary" disabled={!allAnswered || !!error} onClick={() => { try { readingStore.submit(p); } catch (e) { setMessage((e as Error).message); } }}>Submit first answers</button>}
    </div>}
    <div className="passage-actions">
      <button className="btn btn-ghost" onClick={download}>Export reading progress</button>
      <button className="btn btn-ghost" disabled={!!error} onClick={() => file.current?.click()}>Import reading progress</button>
      <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => { const selected = e.target.files?.[0]; if (!selected) return; try { readingStore.import(await selected.text()); setMessage("Reading backup merged. Existing attempts were kept."); } catch (err) { setMessage((err as Error).message); } e.target.value = ""; }} />
    </div>
    <p className="muted">Reading progress is saved separately on this device. Export it separately from your vocabulary backup.</p>
    {message && <p role="status">{message}</p>}
  </section>;
}

function Line({ entry }: { entry: Entry }) {
  const parts = splitHighlight(entry.ex[0].en, entry.w);
  return <p className="passage-line" lang="en">{parts ? <>{parts[0]}<button className="passage-word" onClick={() => openWord(entry.id)} title={`${entry.w} — open card`}>{parts[1]}</button>{parts[2]}</> : entry.ex[0].en}</p>;
}
