import { ArrowRight, Blocks, Check, Ear, GitBranch, Headphones, Keyboard, PenLine, Repeat, RotateCcw, Type, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { prefetch, useAtlas } from "../atlas/context";
import type { Entry } from "../atlas/types";
import { clozeTarget, collocationQuestion, familyQuestion, paraphraseQuestion, parseFamily, sentenceCheck, type FamilyMember, type Pos, type SentenceCheck } from "../lib/drills";
import { play, stopAudio } from "../lib/audio";
import { useT, type TranslationKey } from "../i18n";
import { cue } from "../lib/sound";
import { gap, hashSeed, shuffle, splitHighlight, splitPair } from "../lib/text";
import { correctCharacterCount, hidesAnswer, isComplete, maskChar, same, typingDelta, typingMetrics } from "../lib/typing";
import { store, useStore } from "../store/store";
import { AmbiencePicker } from "../ui/Ambience";
import { Illustration } from "../ui/Illustration";
import { Speak } from "../ui/Speak";

type ChoiceMode = "collocation" | "paraphrase" | "family";
type Mode = "word" | "sentence" | "dictation" | "cloze" | "write" | ChoiceMode;
type Source = "recent" | "mistakes" | "saved" | "path";
type TypeMode = Exclude<Mode, ChoiceMode | "write">;

const MODES: [Mode, TranslationKey, TranslationKey, typeof Type][] = [
  ["word", "mode_word", "mode_word_desc", Type],
  ["dictation", "mode_dictation", "mode_dictation_desc", Headphones],
  ["cloze", "mode_cloze", "mode_cloze_desc", Ear],
  ["collocation", "mode_collocation", "mode_collocation_desc", Blocks],
  ["paraphrase", "mode_paraphrase", "mode_paraphrase_desc", Repeat],
  ["family", "mode_family", "mode_family_desc", GitBranch],
  ["write", "mode_write", "mode_write_desc", PenLine],
  ["sentence", "mode_sentence", "mode_sentence_desc", Keyboard],
];
/** Modes that grade nothing by typing speed: the side panel shows the pool size and a note instead of WPM. */
const NOTES: Partial<Record<Mode, TranslationKey>> = {
  collocation: "collocation_note",
  paraphrase: "paraphrase_note",
  family: "family_note",
  write: "write_note",
};
const SOURCES: [Source, TranslationKey][] = [
  ["recent", "pool_recent"],
  ["mistakes", "pool_mistakes"],
  ["saved", "pool_saved"],
  ["path", "pool_path"],
];

export function Practice() {
  const t = useT();
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
  const startLevel = useStore((s) => s.settings.startLevel);
  const [mode, setMode] = useState<Mode>("word");
  const [source, setSource] = useState<Source>(() => (Object.keys(progress.cards).length ? "recent" : "path"));
  const [round, setRound] = useState<{ entries: Entry[]; key: number } | null>(null);

  const pool = useMemo(() => {
    const learned = Object.entries(progress.cards)
      .sort((a, b) => (b[1].last ?? 0) - (a[1].last ?? 0))
      .map(([id]) => id);
    const ids =
      source === "recent" ? learned : source === "mistakes" ? progress.mistakes : source === "saved" ? progress.bookmarks : atlas.words.filter((w) => w.cefr >= startLevel).slice(0, 400).map((w) => w.id);
    return ids.filter((id) => atlas.byId.has(id));
  }, [atlas, progress.cards, progress.mistakes, progress.bookmarks, source, startLevel]);

  const start = async () => {
    const ids = shuffle(pool.slice(0, 60), hashSeed(String(Date.now()))).slice(0, 10);
    const entries = (await prefetch(atlas, ids)).filter(
      (e): e is Entry =>
        !!e &&
        (mode === "word" || mode === "family" || e.ex.length > 0) &&
        (mode !== "collocation" || e.col.length > 0) &&
        (mode !== "paraphrase" || e.syn.length > 0 || e.ant.length > 0) &&
        (mode !== "family" || parseFamily(e).length > 0) &&
        (mode !== "cloze" || !!clozeTarget(e)),
    );
    if (entries.length) setRound({ entries, key: Date.now() });
  };

  if (round)
    return mode === "collocation" || mode === "paraphrase" || mode === "family" ? (
      <ChoiceRound key={round.key} mode={mode} entries={round.entries} onExit={() => setRound(null)} onAgain={start} />
    ) : mode === "write" ? (
      <WriteRound key={round.key} entries={round.entries} onExit={() => setRound(null)} onAgain={start} />
    ) : (
      <TypingRound key={round.key} mode={mode} entries={round.entries} onExit={() => setRound(null)} onAgain={start} />
    );

  const note = NOTES[mode];
  const best = progress.typing.filter((r) => r.mode === mode).reduce((m, r) => Math.max(m, r.wpm), 0);
  return (
    <div className="page practice">
      <header className="page-head">
        <p className="eyebrow">{t("practice_title")}</p>
        <h1 className="display">{t("practice_subtitle")}</h1>
        <p className="lede">{t("practice_lede")}</p>
      </header>
      <div className="practice-grid">
        <section className="panel">
          <h3 className="eyebrow">{t("practice_mode")}</h3>
          <div className="mode-cards">
            {MODES.map(([k, name, desc, Icon]) => (
              <button key={k} className={`mode-card ${mode === k ? "is-on" : ""}`} onClick={() => setMode(k)} aria-pressed={mode === k}>
                <Icon size={22} strokeWidth={1.7} />
                <b>{t(name)}</b>
                <small>{t(desc)}</small>
              </button>
            ))}
          </div>
          <h3 className="eyebrow">{t("word_source")}</h3>
          <div className="segmented segmented-wide">
            {SOURCES.map(([k, label]) => (
              <button key={k} className={source === k ? "is-on" : ""} onClick={() => setSource(k)} aria-pressed={source === k}>
                {t(label)}
              </button>
            ))}
          </div>
          <p className="muted">
            {pool.length
              ? source === "path"
                ? t("pool_path_note")
                : t("pool_available").replace("{n}", String(pool.length))
              : t("pool_empty")}
          </p>
          <button className="btn btn-primary btn-xl" onClick={start} disabled={!pool.length}>
            {t("start_round")}
          </button>
        </section>
        <section className="panel practice-side">
          <img src={`${import.meta.env.BASE_URL}brand/${mode === "dictation" ? "listen" : "typing"}.webp`} alt="" />
          <dl className="mini-stats">
            <div>
              <dt>{note ? t("pool_words") : t("best_speed")}</dt>
              <dd>
                {note ? pool.length : best}
                {!note && <small>WPM</small>}
              </dd>
            </div>
            <div>
              <dt>{t("completed_rounds")}</dt>
              <dd>{progress.typing.length}</dd>
            </div>
          </dl>
          <p className="muted">{note ? t(note) : t("wpm_note")}</p>
        </section>
      </div>
    </div>
  );
}

function TypingRound({ mode, entries, onExit, onAgain }: { mode: TypeMode; entries: Entry[]; onExit: () => void; onAgain: () => void }) {
  const t = useT();
  const atlas = useAtlas();
  const settings = useStore((s) => s.settings);
  const [i, setI] = useState(0);
  const [value, setValue] = useState("");
  const [revealed, setRevealed] = useState(false);
  // Running totals live in a ref so every keystroke is counted exactly once.
  const totalsRef = useRef({ typed: 0, correct: 0, accepted: 0, ms: 0 });
  const [totals, setTotals] = useState(totalsRef.current);
  const [done, setDone] = useState(false);
  const started = useRef<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const e = entries[i];
  const target = mode === "cloze" ? (clozeTarget(e) ?? e.w) : mode === "word" ? e.w : e.ex[0].en;

  useEffect(() => {
    setValue("");
    setRevealed(false);
    started.current = null;
    input.current?.focus();
    if (mode === "dictation" || mode === "cloze") void play(atlas.audio(e, "ex"), e.ex[0].en, settings.accent);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopAudio(), []);

  // Ctrl+Space replays the sentence audio without leaving the keyboard.
  useEffect(() => {
    if (mode !== "dictation" && mode !== "cloze") return;
    const onKey = (ev: KeyboardEvent) => {
      if (!ev.ctrlKey || ev.key !== " " || ev.repeat) return;
      ev.preventDefault();
      void play(atlas.audio(entries[i], "ex"), entries[i].ex[0].en, settings.accent);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, i, atlas, entries, settings.accent]);

  const onChange = (next: string) => {
    if (done) return;
    if (started.current === null && next) started.current = performance.now();
    const d = typingDelta(value, next, target);
    if (settings.sfx && d.total > 0) void cue("key");
    const cur = totalsRef.current;
    totalsRef.current = { ...cur, typed: cur.typed + d.total, correct: cur.correct + d.correct };
    setTotals(totalsRef.current);
    setValue(next);
    if (isComplete(next, target)) finishItem(next);
  };

  const finishItem = (final: string) => {
    const ms = started.current ? performance.now() - started.current : 0;
    const accepted = correctCharacterCount(final, target);
    if (settings.sfx) void cue("correct");
    const cur = totalsRef.current;
    const nt = { ...cur, accepted: cur.accepted + accepted, ms: cur.ms + ms };
    totalsRef.current = nt;
    setTotals(nt);
    if (i + 1 >= entries.length) {
      setDone(true);
      const m = typingMetrics(nt.correct, nt.typed, nt.accepted, nt.ms);
      store.progress((p) => ({ ...p, typing: [...p.typing, { at: Date.now(), mode, items: entries.length, wpm: m.wpm, accuracy: m.accuracy }].slice(-500) }));
    } else window.setTimeout(() => setI(i + 1), 260);
  };

  const langPair = settings.langPair || "en-vi";
  const isZh = langPair.startsWith("zh-") || langPair.endsWith("-zh");
  const isFr = langPair.startsWith("fr-") || langPair.endsWith("-fr");

  const m = typingMetrics(totals.correct, totals.typed, totals.accepted, totals.ms);
  const chars = Array.from(target);
  const typed = Array.from(value);

  if (done)
    return (
      <div className="page practice">
        <section className="panel typing-done">
          <p className="eyebrow">{t("round_complete")}</p>
          <h1 className="display">
            {m.wpm} <small>WPM</small>
          </h1>
          <p className="lede">{t("round_accuracy").replace("{acc}", String(m.accuracy)).replace("{n}", String(entries.length))}</p>
          <div className="summary-actions">
            <button className="btn btn-ghost" onClick={onExit}>
              {t("back")}
            </button>
            <button className="btn btn-primary btn-xl" onClick={onAgain} autoFocus>
              <RotateCcw size={18} /> {t("practice_again")}
            </button>
          </div>
        </section>
      </div>
    );

  const cueSense = isZh
    ? `${e.zh_word || e.senses[0].zh} · ${e.senses[0].vi || ""}`
    : isFr
    ? `${e.fr_word || ""} · ${e.senses[0].vi || ""}`
    : (e.vi_word || e.senses[0].vi || (!/[\u4e00-\u9fff]/.test(e.senses[0].zh) ? e.senses[0].zh : ""));

  const cueSentence = isZh
    ? `${e.ex[0].zh} · ${e.ex[0].vi || ""}`
    : (e.ex[0].vi || (!/[\u4e00-\u9fff]/.test(e.ex[0].zh) ? e.ex[0].zh : ""));

  return (
    <div className="page practice typing">
      <header className="typing-top">
        <button className="btn btn-ghost" onClick={onExit}>
          {t("exit")}
        </button>
        <AmbiencePicker />
        <div className="learn-progress">
          <span style={{ transform: `scaleX(${Math.max(0.01, i / Math.max(1, entries.length))})` }} />
        </div>
        <span className="typing-meter">
          <b>{m.wpm}</b> WPM · <b>{m.accuracy}%</b>
        </span>
      </header>
      <section className="typing-stage" onClick={() => input.current?.focus()}>
        {mode === "word" && (
          <div className="typing-cue">
            <Illustration src={atlas.img(e)} word={e.w} topic={0} eager />
            <p>
              <span className="pos">{e.senses[0].pos}</span> {cueSense}
            </p>
          </div>
        )}
        {mode !== "word" && (
          <p className="typing-zh">
            {(mode === "dictation" || mode === "cloze") && (
              <button className="link" onClick={() => play(atlas.audio(e, "ex"), e.ex[0].en, settings.accent)}>
                {t("listen_again")}
              </button>
            )}
            {mode === "cloze" ? <ClozeSentence entry={e} /> : cueSentence}
          </p>
        )}
        <p className={`typing-text ${mode === "word" || mode === "cloze" ? "is-word" : ""}`} lang="en" aria-hidden="true">
          {chars.map((ch, k) => {
            const tc = typed[k];
            const cls = tc === undefined ? (k === typed.length ? "is-caret" : "") : same(tc, ch) ? "is-ok" : "is-bad";
            const show = tc === undefined && hidesAnswer(mode) && !revealed ? maskChar(ch) : ch;
            return (
              <span key={k} className={cls}>
                {show}
              </span>
            );
          })}
        </p>
        <input
          ref={input}
          className="typing-input"
          value={value}
          onChange={(ev) => onChange(ev.target.value)}
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label={t("type_here")}
        />
        <div className="typing-bottom">
          <p className="muted typing-help">
            {mode === "dictation" ? t("typing_help_dictation") : mode === "cloze" ? t("typing_help_cloze") : t("typing_help_default")} {t("typing_item").replace("{i}", String(i + 1)).replace("{n}", String(entries.length))}
          </p>
          {hidesAnswer(mode) && !revealed && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRevealed(true)}>
              {t("show_answer")}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function ClozeSentence({ entry }: { entry: Entry }) {
  const g = gap(entry.ex[0].en, entry.w);
  if (!g) return <span lang="en">{entry.ex[0].en}</span>;
  return (
    <span className="cloze" lang="en">
      {g.before}
      <span className="blank">{"＿".repeat(Math.min(7, Math.max(3, g.hidden.length)))}</span>
      {g.after}
    </span>
  );
}

type Question = { entry: Entry; answer: string; options: string[] } & (
  | { mode: "collocation"; full: string; gloss: string }
  | { mode: "paraphrase"; kind: "syn" | "ant"; sentence: [string, string, string]; all: string[] }
  | { mode: "family"; pos: Pos; family: FamilyMember[] }
);

const POS_KEY: Record<Pos, TranslationKey> = { n: "pos_n", v: "pos_v", adj: "pos_adj", adv: "pos_adv" };
const CHOICE_COPY: Record<ChoiceMode, { done: TranslationKey; none: TranslationKey; noneNote: TranslationKey }> = {
  collocation: { done: "collocation_done", none: "no_collocations", noneNote: "no_collocations_note" },
  paraphrase: { done: "paraphrase_done", none: "no_questions", noneNote: "no_questions_note" },
  family: { done: "family_done", none: "no_questions", noneNote: "no_questions_note" },
};

function buildQuestions(mode: ChoiceMode, entries: Entry[]): Question[] {
  return entries.flatMap((entry): Question[] => {
    const seed = hashSeed(entry.id);
    if (mode === "collocation") {
      const q = collocationQuestion(entry, entries, seed);
      return q ? [{ entry, mode, ...q }] : [];
    }
    if (mode === "paraphrase") {
      const q = paraphraseQuestion(entry, entries, seed);
      return q ? [{ entry, mode, ...q }] : [];
    }
    const q = familyQuestion(entry, entries, seed);
    return q ? [{ entry, mode, ...q }] : [];
  });
}

function ChoiceRound({ mode, entries, onExit, onAgain }: { mode: ChoiceMode; entries: Entry[]; onExit: () => void; onAgain: () => void }) {
  const t = useT();
  const settings = useStore((s) => s.settings);
  const questions = useMemo(() => buildQuestions(mode, entries), [mode, entries]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const q: Question | undefined = questions[i];

  const pick = (option: string) => {
    if (picked || !q) return;
    setPicked(option);
    if (settings.sfx) void cue(option === q.answer ? "correct" : "wrong");
    if (option === q.answer) setScore((n) => n + 1);
  };
  const next = () => {
    if (i + 1 >= questions.length) setDone(true);
    else {
      setI(i + 1);
      setPicked(null);
    }
  };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || !q) return;
      if (picked) {
        if (e.key === "Enter") {
          e.preventDefault();
          next();
        }
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length) {
        e.preventDefault();
        pick(q.options[n - 1]);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  if (done)
    return (
      <div className="page practice">
        <section className="panel typing-done">
          <p className="eyebrow">{t("round_complete")}</p>
          <h1 className="display">
            {score} <small>/ {questions.length}</small>
          </h1>
          <p className="lede">{t(CHOICE_COPY[mode].done)}</p>
          <div className="summary-actions">
            <button className="btn btn-ghost" onClick={onExit}>
              {t("back")}
            </button>
            <button className="btn btn-primary btn-xl" onClick={onAgain} autoFocus>
              <RotateCcw size={18} /> {t("practice_again")}
            </button>
          </div>
        </section>
      </div>
    );

  if (!q)
    return (
      <div className="page practice">
        <section className="panel typing-done">
          <p className="eyebrow">{t(CHOICE_COPY[mode].none)}</p>
          <p className="lede">{t(CHOICE_COPY[mode].noneNote)}</p>
          <div className="summary-actions">
            <button className="btn btn-ghost" onClick={onExit}>
              {t("back")}
            </button>
          </div>
        </section>
      </div>
    );

  const entryGloss = q.entry.vi_word || q.entry.senses[0]?.vi || (!/[\u4e00-\u9fff]/.test(q.entry.senses[0]?.zh ?? "") ? q.entry.senses[0]?.zh : "");

  return (
    <div className="page practice typing">
      <header className="typing-top">
        <button className="btn btn-ghost" onClick={onExit}>
          {t("exit")}
        </button>
        <div className="learn-progress">
          <span style={{ transform: `scaleX(${Math.max(0.01, i / Math.max(1, questions.length))})` }} />
        </div>
        <span className="typing-meter">
          <b>{score}</b> / {questions.length}
        </span>
      </header>
      <section className="typing-stage">
        <p className="stage-label">
          <span className="dot dot-review" />{" "}
          {t(q.mode === "collocation" ? "collocation_question" : q.mode === "paraphrase" ? (q.kind === "syn" ? "paraphrase_question_syn" : "paraphrase_question_ant") : "mode_family")}
        </p>
        <div className="collocation-prompt">
          {q.mode === "collocation" && (
            <h2 className="headword" lang="en">
              {q.entry.w}
            </h2>
          )}
          {q.mode === "paraphrase" && (
            <p className="paraphrase-sentence" lang="en">
              {q.sentence[0]}
              <mark>{q.sentence[1]}</mark>
              {q.sentence[2]}
            </p>
          )}
          {q.mode === "family" && (
            <p className="paraphrase-sentence">
              {t("family_question").replace("{pos}", t(POS_KEY[q.pos])).split("{word}").flatMap((part, k) => (k ? [<b key={k} lang="en">{q.entry.w}</b>, part] : [part]))}
            </p>
          )}
          {entryGloss && q.mode === "collocation" && <p className="muted">{entryGloss}</p>}
        </div>
        <ul className="options options-en">
          {q.options.map((option, k) => {
            const isAnswer = option === q.answer;
            const chosen = picked === option;
            const cls = picked ? (isAnswer ? "is-answer" : chosen ? "is-chosen" : "is-dim") : "";
            return (
              <li key={option}>
                <button className={`option ${cls}`} data-option={option} onClick={() => pick(option)} disabled={!!picked}>
                  <kbd>{k + 1}</kbd>
                  <span lang="en">{option}</span>
                  {picked && isAnswer && <Check size={20} className="option-mark" />}
                  {picked && chosen && !isAnswer && <X size={20} className="option-mark" />}
                </button>
              </li>
            );
          })}
        </ul>
        {picked && (
          <p className="collocation-reveal" lang="en">
            {q.mode === "collocation" && (
              <>
                <b>{q.full}</b> {q.gloss && <span>— {q.gloss}</span>}
              </>
            )}
            {q.mode === "paraphrase" && (
              <>
                <b>{q.all.join(", ")}</b> {entryGloss && <span>— {entryGloss}</span>}
              </>
            )}
            {q.mode === "family" && (
              <>
                <b>{[`${q.entry.w} (${q.entry.senses[0]?.pos ?? ""})`, ...q.family.map((m) => `${m.word} (${m.pos}.)`)].join(" · ")}</b>
                {entryGloss && <span> — {entryGloss}</span>}
              </>
            )}
          </p>
        )}
        {picked && (
          <div className="collocation-next">
            <button className="btn btn-primary btn-xl" onClick={next} autoFocus>
              {i + 1 >= questions.length ? t("see_result") : t("continue_label")} <ArrowRight size={20} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

const REASON_KEY: Record<SentenceCheck["reason"], TranslationKey> = {
  ok: "write_ok",
  short: "write_reason_short",
  missing: "write_reason_missing",
  copied: "write_reason_copied",
};

function WriteRound({ entries, onExit, onAgain }: { entries: Entry[]; onExit: () => void; onAgain: () => void }) {
  const t = useT();
  const atlas = useAtlas();
  const settings = useStore((s) => s.settings);
  const [i, setI] = useState(0);
  const [value, setValue] = useState("");
  const [check, setCheck] = useState<SentenceCheck | null>(null);
  const [good, setGood] = useState(0);
  const [done, setDone] = useState(false);
  const e = entries[i];

  const next = (isGood: boolean) => {
    if (isGood) setGood((n) => n + 1);
    if (i + 1 >= entries.length) setDone(true);
    else {
      setI(i + 1);
      setValue("");
      setCheck(null);
    }
  };

  if (done)
    return (
      <div className="page practice">
        <section className="panel typing-done">
          <p className="eyebrow">{t("round_complete")}</p>
          <h1 className="display">
            {good} <small>/ {entries.length}</small>
          </h1>
          <p className="lede">{t("write_done").replace("{n}", String(good)).replace("{m}", String(entries.length))}</p>
          <div className="summary-actions">
            <button className="btn btn-ghost" onClick={onExit}>
              {t("back")}
            </button>
            <button className="btn btn-primary btn-xl" onClick={onAgain} autoFocus>
              <RotateCcw size={18} /> {t("practice_again")}
            </button>
          </div>
        </section>
      </div>
    );

  const gloss = e.vi_word || e.senses[0]?.vi || "";
  const cols = e.col.map((c) => splitPair(c).en).filter(Boolean);
  const accepted = check?.ok === true;

  return (
    <div className="page practice typing">
      <header className="typing-top">
        <button className="btn btn-ghost" onClick={onExit}>
          {t("exit")}
        </button>
        <div className="learn-progress">
          <span style={{ transform: `scaleX(${Math.max(0.01, i / Math.max(1, entries.length))})` }} />
        </div>
        <span className="typing-meter">
          <b>{good}</b> / {entries.length}
        </span>
      </header>
      <section className="typing-stage write-stage">
        <p className="stage-label">
          <span className="dot dot-review" /> {t("write_prompt")}
        </p>
        <div className="collocation-prompt">
          <h2 className="headword" lang="en">
            {e.w}
          </h2>
          {gloss && <p className="muted">{gloss}</p>}
          <Speak url={atlas.audio(e, settings.accent)} text={e.w} accent={settings.accent} label={<span className="ipa">{settings.accent === "us" ? e.us || e.uk : e.uk || e.us}</span>} />
          {!accepted && cols.length > 0 && (
            <p className="muted" lang="en">
              {t("write_hint")} {cols.slice(0, 2).join(" · ")}
            </p>
          )}
        </div>
        <textarea
          className="write-input"
          rows={3}
          value={value}
          readOnly={accepted}
          onChange={(ev) => {
            setValue(ev.target.value);
            setCheck(null);
          }}
          autoFocus
          lang="en"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={t("write_placeholder")}
          placeholder={t("write_placeholder")}
        />
        {check && <p className={check.ok ? "write-ok" : "write-reason"} role="alert">{t(REASON_KEY[check.reason])}</p>}
        {!accepted && (
          <button className="btn btn-primary btn-xl" onClick={() => setCheck(sentenceCheck(value, e))} disabled={!value.trim()}>
            {t("write_check")}
          </button>
        )}
        {accepted && (
          <>
            <div className="write-models" lang="en">
              <p className="muted">{t("write_models")}</p>
              {e.ex.slice(0, 2).map((x) => {
                const parts = splitHighlight(x.en, e.w);
                return (
                  <p key={x.en}>
                    {parts ? (
                      <>
                        {parts[0]}
                        <mark>{parts[1]}</mark>
                        {parts[2]}
                      </>
                    ) : (
                      x.en
                    )}
                  </p>
                );
              })}
              {cols.length > 0 && <p className="muted">{cols.join(" · ")}</p>}
            </div>
            <div className="summary-actions">
              <button className="btn btn-ghost" onClick={() => next(false)}>
                {t("write_self_unsure")}
              </button>
              <button className="btn btn-primary btn-xl" onClick={() => next(true)} autoFocus>
                {t("write_self_good")}
              </button>
            </div>
          </>
        )}
        <p className="muted typing-help">
          {t("write_note")} {t("typing_item").replace("{i}", String(i + 1)).replace("{n}", String(entries.length))}
        </p>
      </section>
    </div>
  );
}
