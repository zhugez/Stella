import { ArrowRight, Check, Lightbulb, RotateCcw, Share2, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { prefetch, useAtlas, useEntry } from "../atlas/context";
import type { Atlas, Entry, Example, WordRef } from "../atlas/types";
import { useT, type TranslationKey } from "../i18n";
import { play, stopAudio } from "../lib/audio";
import { burst } from "../lib/burst";
import { cue } from "../lib/sound";
import { go } from "../lib/router";
import { accepts } from "../lib/spelling";
import { gap, normalize } from "../lib/text";
import { answer, advance, buildSession, glossParts, gradeFor, sessionStats } from "../store/session";
import { Rating } from "../store/srs";
import { store, useStore, type ActiveSession, type QuizKind, type Step } from "../store/store";
import { EntryView, Highlight } from "../ui/EntryView";
import { Illustration } from "../ui/Illustration";
import { Galaxy } from "../galaxy/Galaxy";
import { AmbiencePicker } from "../ui/Ambience";
import { Ring } from "../ui/Ring";
import { Speak } from "../ui/Speak";
import { shareSession } from "../ui/shareSession";

export function Learn() {
  const atlas = useAtlas();
  const session = useStore((s) => s.progress.session);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { progress, settings } = store.get();
    if (!progress.session) {
      const s = buildSession(atlas, progress, settings);
      if (!s.steps.length) {
        go({ page: "today" }, null, true);
        return;
      }
      store.progress((p) => ({ ...p, session: s }));
    }
  }, [atlas]);

  const ids = useMemo(() => [...new Set(session?.steps.map((s) => s.id) ?? [])], [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ids.length) return;
    let live = true;
    // Load the first chunk before rendering, the rest in the background.
    prefetch(atlas, ids.slice(0, 6)).then(() => live && setReady(true));
    void prefetch(atlas, ids);
    return () => {
      live = false;
    };
  }, [atlas, ids]);

  useEffect(() => () => stopAudio(), []);

  if (!session || !ready) return <div className="learn learn-loading"><span className="spinner" /></div>;
  if (session.finished || session.index >= session.steps.length) return <Summary session={session} />;
  return <Runner session={session} />;
}

function Runner({ session }: { session: ActiveSession }) {
  const t = useT();
  const step = session.steps[session.index];
  const total = session.steps.length;
  const exit = () => {
    stopAudio();
    go({ page: "today" });
  };
  return (
    <div className="learn">
      <header className="learn-top">
        <button className="icon-btn" onClick={exit} aria-label={t("pause_return")}>
          <X size={22} />
        </button>
        <div className="learn-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={session.index}>
          <span style={{ transform: `scaleX(${Math.max(0.01, session.index / total)})` }} />
        </div>
        <span className="learn-count">
          {session.index + 1}
          <small>/{total}</small>
        </span>
        <AmbiencePicker />
      </header>
      <main className="learn-stage" key={`${session.id}-${session.index}`}>
        {step.kind === "intro" ? <Intro step={step} /> : step.kind === "recall" ? <Recall step={step} session={session} /> : <Quiz step={step} session={session} />}
      </main>
    </div>
  );
}

function useStepTimer() {
  const t = useRef(performance.now());
  return () => (performance.now() - t.current) / 1000;
}

function Intro({ step }: { step: Step }) {
  const t = useT();
  const atlas = useAtlas();
  const { entry } = useEntry(step.id);
  const settings = useStore((s) => s.settings);
  const elapsed = useStepTimer();
  useEffect(() => {
    if (entry && settings.autoplay) void play(atlas.audio(entry, settings.accent), entry.w, settings.accent);
  }, [entry, atlas, settings.autoplay, settings.accent]);
  const next = useCallback(() => {
    stopAudio();
    if (store.get().settings.sfx) void cue("flip");
    advance(elapsed(), step);
  }, [elapsed, step]);
  useKeys({ Enter: next, " ": next });
  if (!entry) return <span className="spinner" />;
  return (
    <div className="intro">
      <p className="stage-label">
        <span className="dot dot-new" /> {t("first_meeting")}
      </p>
      <EntryView entry={entry} mode="intro" />
      <footer className="learn-actions">
        <button className="btn btn-primary btn-xl" onClick={next} autoFocus>
          {t("know_it")} <ArrowRight size={20} />
        </button>
        <span className="hint-keys">
          <kbd>Enter</kbd> {t("continue_label")}
        </span>
      </footer>
    </div>
  );
}

const KIND_LABEL: Record<QuizKind, TranslationKey> = {
  meaning: "quiz_meaning",
  picture: "quiz_picture",
  listen: "quiz_listen",
  spell: "quiz_spell",
  recall: "quiz_recall",
  dictation: "quiz_dictation",
};

type QuizStep = Step & { kind: QuizKind };

const hasCjk = (s: string) => /[\u4e00-\u9fff]/.test(s);
/** Vietnamese text of a sense or example; Chinese-only data is not shown. */
const viText = (x: { vi?: string; zh: string }) => x.vi || (!hasCjk(x.zh) ? x.zh : "");
/** Index gloss for datasets that store a Vietnamese one; empty otherwise. */
const shortGloss = (ref: WordRef) => (hasCjk(ref.zh) ? "" : ref.zh);

/** Which example sentence a step uses; falls back to the first when the second is missing or has no gap. */
function exIndex(step: QuizStep, entry: Entry, atlas: Atlas): 0 | 1 {
  const second = entry.ex[1];
  if (step.ex !== 1 || !second || !gap(second.en, entry.w)) return 0;
  return step.kind === "dictation" && !atlas.audio(entry, "ex2") ? 0 : 1;
}

function StageLabel({ step, session }: { step: QuizStep; session: ActiveSession }) {
  const t = useT();
  const kind = t(step.kind === "picture" && step.plain ? "quiz_cloze" : KIND_LABEL[step.kind]);
  const final = step.kind === "recall" && !step.retry && session.newIds.includes(step.id);
  const text = step.retry ? `${t("review_again")} · ${kind}` : step.practice ? `${t("practice_check")} · ${kind}` : final ? t("final_check") : kind;
  return (
    <p className="stage-label">
      <span className={`dot ${step.retry ? "dot-retry" : step.practice || final ? "dot-new" : "dot-review"}`} />
      {text}
    </p>
  );
}

function Quiz({ step, session }: { step: QuizStep; session: ActiveSession }) {
  const t = useT();
  const atlas = useAtlas();
  const ref = atlas.byId.get(step.id)!;
  const { entry } = useEntry(step.id);
  const settings = useStore((s) => s.settings);
  const pending = session.pending;
  const elapsed = useStepTimer();
  const [hints, setHints] = useState(0);
  const options = useMemo(() => (step.options ?? []).map((id) => atlas.byId.get(id)!).filter(Boolean), [atlas, step.options]);
  const typed = step.kind === "spell" || step.kind === "dictation";

  const idx = entry ? exIndex(step, entry, atlas) : 0;
  const example = entry?.ex[idx];
  const sentence = entry && example ? gap(example.en, entry.w) : null;
  // Dictation types the form heard in the sentence; without a gap it falls back to the headword.
  const target = step.kind === "dictation" && sentence ? sentence.hidden : (entry?.w ?? "");

  const submit = useCallback(
    (value: string, correct: boolean) => {
      if (pending || !entry) return;
      const ms = elapsed() * 1000;
      // Two or more hints mean the word was not remembered, even when the typed answer is right.
      const ok = correct && hints < 2;
      if (ok) {
        const el = document.querySelector<HTMLElement>(typed ? ".slots" : `[data-option="${value}"]`);
        const r = el?.getBoundingClientRect();
        if (r) burst(r.left + r.width / 2, r.top + r.height / 2);
      }
      if (settings.sfx) void cue(ok ? "correct" : "wrong");
      answer(atlas, step, ok, gradeFor(step.kind, ok, ms, hints), value, ms);
      void play(atlas.audio(entry, settings.accent), entry.w, settings.accent);
    },
    [pending, elapsed, settings, atlas, step, hints, entry, typed],
  );

  const next = useCallback(() => {
    stopAudio();
    advance(elapsed(), step);
  }, [elapsed, step]);

  useEffect(() => {
    if (step.kind === "listen" && entry && !pending) void play(atlas.audio(entry, settings.accent), entry.w, settings.accent);
  }, [step.kind, entry, atlas, settings.accent, pending]);

  const keys: Record<string, () => void> = {};
  if (pending) {
    keys.Enter = next;
    keys[" "] = next;
  } else {
    options.forEach((o, i) => (keys[String(i + 1)] = () => submit(o.id, o.id === ref.id)));
  }
  useKeys(keys);

  if (!entry) return <span className="spinner" />;
  const meanings = step.kind === "meaning" || step.kind === "listen";

  return (
    <div className={`quiz quiz-${step.kind} ${pending ? (pending.correct ? "is-right" : "is-wrong") : ""}`}>
      <StageLabel step={step} session={session} />

      <section className="prompt">
        {step.kind === "meaning" && (
          <div className="prompt-word">
            <h2 className="headword" lang="en">
              {entry.w}
            </h2>
            <Speak url={atlas.audio(entry, settings.accent)} text={entry.w} accent={settings.accent} label={<span className="ipa">{settings.accent === "us" ? entry.us || entry.uk : entry.uk || entry.us}</span>} />
          </div>
        )}
        {step.kind === "picture" && (
          <div className="prompt-picture">
            {!step.plain && idx === 0 && <Illustration src={atlas.img(entry)} word={entry.w} topic={ref.topic} eager />}
            <p className="cloze" lang="en">
              {sentence ? (
                <>
                  {sentence.before}
                  <span className="blank">{pending ? sentence.hidden : "　　　"}</span>
                  {sentence.after}
                </>
              ) : (
                viText(entry.senses[0])
              )}
            </p>
            {sentence && pending && <p className="cloze-zh">{viText(example!)}</p>}
          </div>
        )}
        {step.kind === "listen" && (
          <div className="prompt-listen">
            <button className="listen-orb" onClick={() => play(atlas.audio(entry, settings.accent), entry.w, settings.accent)} aria-label={t("listen_again")}>
              <Volume2 size={40} strokeWidth={1.6} />
              <span />
            </button>
            <button className="link" onClick={() => play(atlas.audio(entry, settings.accent), entry.w, settings.accent, 0.7)}>
              {t("listen_slower")}
            </button>
          </div>
        )}
        {step.kind === "spell" && <SpellPrompt entry={entry} refw={ref} sentence={sentence} plain={!!step.plain} />}
        {step.kind === "dictation" && <DictationPrompt url={atlas.audio(entry, idx === 1 ? "ex2" : "ex")} text={example?.en ?? entry.w} accent={settings.accent} sentence={sentence} revealed={!!pending} />}
      </section>

      {typed ? (
        <SpellInput target={target} pending={pending} hints={hints} onHint={() => setHints((h) => Math.min(target.split("/")[0].length - 1, h + 1))} onSubmit={(v) => submit(v, accepts(v, target))} />
      ) : (
        <ul className={`options ${meanings ? "options-zh" : "options-en"}`}>
          {options.map((o, i) => {
            const isAnswer = o.id === ref.id;
            const chosen = pending?.value === o.id;
            const cls = pending ? (isAnswer ? "is-answer" : chosen ? "is-chosen" : "is-dim") : "";
            const langPair = settings.langPair || "en-vi";
            let optionLabel = o.word;
            if (meanings) {
              if (langPair === "vi-zh") optionLabel = o.zh_word || o.word;
              else if (langPair === "vi-fr") optionLabel = o.fr_word || o.word;
              else optionLabel = o.vi || (!hasCjk(o.zh) ? o.zh : o.word);
            }
            return (
              <li key={o.id}>
                <button className={`option ${cls}`} data-option={o.id} onClick={() => submit(o.id, isAnswer)} disabled={!!pending}>
                  <kbd>{i + 1}</kbd>
                  <span lang={meanings ? "vi" : "en"}>{optionLabel}</span>
                  {pending && isAnswer && <Check size={20} className="option-mark" />}
                  {pending && chosen && !isAnswer && <X size={20} className="option-mark" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {pending && <Feedback entry={entry} refw={ref} correct={pending.correct} hinted={typed && !pending.correct && accepts(pending.value, target)} example={example} onNext={next} />}
    </div>
  );
}

function SpellPrompt({ entry, refw, sentence, plain }: { entry: Entry; refw: WordRef; sentence: ReturnType<typeof gap>; plain: boolean }) {
  const atlas = useAtlas();
  const { pos, text } = glossParts(shortGloss(refw));
  const vi = viText(entry.senses[0]);
  return (
    <div className={`prompt-spell ${plain ? "is-plain" : ""}`}>
      {!plain && <Illustration src={atlas.img(entry)} word={entry.w} topic={refw.topic} eager className="spell-art" />}
      <div>
        <p className="spell-zh">
          <span className="pos">{pos || entry.senses[0].pos}</span> {text || vi}
        </p>
        {text && vi && vi !== text && <p className="spell-sub">{vi}</p>}
        {sentence && (
          <p className="cloze cloze-sm" lang="en">
            {sentence.before}
            <span className="blank">　　　</span>
            {sentence.after}
          </p>
        )}
      </div>
    </div>
  );
}

function DictationPrompt({ url, text, accent, sentence, revealed }: { url: string | null; text: string; accent: "uk" | "us"; sentence: ReturnType<typeof gap>; revealed: boolean }) {
  const t = useT();
  useEffect(() => {
    void play(url, text, accent);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="prompt-listen prompt-dictation">
      <button className="listen-orb" onClick={() => play(url, text, accent)} aria-label={t("listen_again")}>
        <Volume2 size={40} strokeWidth={1.6} />
        <span />
      </button>
      <button className="link" onClick={() => play(url, text, accent, 0.7)}>
        {t("listen_slower")}
      </button>
      {sentence && (
        <p className="cloze" lang="en">
          {sentence.before}
          <span className="blank">{revealed ? sentence.hidden : "　　　"}</span>
          {sentence.after}
        </p>
      )}
    </div>
  );
}

function SpellInput({ target, pending, hints, onHint, onSubmit }: { target: string; pending?: { correct: boolean; value: string }; hints: number; onHint: () => void; onSubmit: (v: string) => void }) {
  const t = useT();
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  // Alternatives such as "cheque/check" show the first spelling in the boxes; either one is accepted.
  const shape = target.split("/")[0];
  const prefix = shape.slice(0, hints);
  useEffect(() => {
    if (hints && !normalize(value).startsWith(normalize(prefix))) setValue(prefix);
    input.current?.focus();
  }, [hints]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = pending ? pending.value : value;
  const accepted = !!pending && accepts(pending.value, target);
  return (
    <form
      className="spell"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending && value.trim()) onSubmit(value);
      }}
    >
      <div className="slots" aria-hidden="true" onClick={() => input.current?.focus()}>
        {Array.from(shape).map((ch, i) => {
          const typed = shown[i];
          const ok = accepted || (typed !== undefined && typed.toLowerCase() === ch.toLowerCase());
          return (
            <span key={i} className={`slot ${ch === " " ? "slot-space" : ""} ${typed !== undefined ? (pending ? (ok ? "is-ok" : "is-bad") : "is-filled") : ""} ${!pending && i === shown.length ? "is-caret" : ""}`}>
              {pending && !pending.correct ? ch : typed ?? ""}
            </span>
          );
        })}
      </div>
      <input
        ref={input}
        className="spell-input"
        value={shown}
        onChange={(e) => !pending && setValue(e.target.value.slice(0, shape.length + 6))}
        autoFocus
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-label={t("spelling_input").replace("{n}", String(shape.length))}
        readOnly={!!pending}
      />
      {!pending && (
        <div className="spell-actions">
          <button type="button" className="btn btn-ghost" onClick={onHint} disabled={hints >= shape.length - 1}>
            <Lightbulb size={17} /> {t("hint_letter")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
            {t("submit")} <kbd>Enter</kbd>
          </button>
        </div>
      )}
      {!pending && hints > 0 && <p className="hint-rule">{t("hint_rule")}</p>}
    </form>
  );
}

function Recall({ step, session }: { step: QuizStep; session: ActiveSession }) {
  const t = useT();
  const atlas = useAtlas();
  const ref = atlas.byId.get(step.id)!;
  const { entry } = useEntry(step.id);
  const settings = useStore((s) => s.settings);
  const elapsed = useStepTimer();
  const [shown, setShown] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (entry && settings.autoplay) void play(atlas.audio(entry, settings.accent), entry.w, settings.accent);
  }, [entry, atlas, settings.autoplay, settings.accent]);

  const choose = (remembered: boolean) => {
    if (!shown || done.current) return;
    done.current = true;
    const seconds = elapsed();
    if (settings.sfx) void cue(remembered ? "correct" : "wrong");
    answer(atlas, step, remembered, remembered ? Rating.Good : Rating.Again, remembered ? "remembered" : "forgot", seconds * 1000);
    stopAudio();
    advance(seconds, step);
  };
  const reveal = () => setShown(true);

  useKeys(shown ? { "1": () => choose(false), "2": () => choose(true) } : { Enter: reveal, " ": reveal });

  if (!entry) return <span className="spinner" />;
  return (
    <div className="quiz quiz-recall">
      <StageLabel step={step} session={session} />
      <section className="prompt">
        <div className="prompt-recall">
          <div className="prompt-word">
            <h2 className="headword" lang="en">
              {entry.w}
            </h2>
            <Speak url={atlas.audio(entry, settings.accent)} text={entry.w} accent={settings.accent} label={<span className="ipa">{settings.accent === "us" ? entry.us || entry.uk : entry.uk || entry.us}</span>} />
          </div>
          {shown ? (
            <div className="recall-answer">
              <Illustration src={atlas.img(entry, "thumb")} word={entry.w} topic={ref.topic} className="recall-art" />
              <div>
                <p className="recall-gloss">{shortGloss(ref)}</p>
                <p className="feedback-zh">
                  {entry.senses
                    .slice(0, 2)
                    .map((s) => `${s.pos} ${viText(s)}`)
                    .join("　")}
                </p>
                {entry.ex[0] && (
                  <p className="recall-ex" lang="en">
                    <Highlight text={entry.ex[0].en} word={entry.w} />
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              <button className="btn btn-primary btn-xl" onClick={reveal} autoFocus>
                {t("reveal_meaning")} <kbd>Space</kbd>
              </button>
              <p className="recall-hint">{t("recall_hint")}</p>
            </>
          )}
        </div>
      </section>
      {shown && (
        <footer className="learn-actions">
          <button className="btn btn-terra btn-xl" onClick={() => choose(false)}>
            {t("recall_forgot")} <kbd>1</kbd>
          </button>
          <button className="btn btn-sage btn-xl" onClick={() => choose(true)}>
            {t("recall_remembered")} <kbd>2</kbd>
          </button>
        </footer>
      )}
    </div>
  );
}

function Feedback({ entry, refw, correct, hinted, example, onNext }: { entry: Entry; refw: WordRef; correct: boolean; hinted: boolean; example?: Example; onNext: () => void }) {
  const t = useT();
  const atlas = useAtlas();
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus({ preventScroll: true }), []);
  return (
    <div className={`feedback ${correct ? "is-right" : "is-wrong"}`} role="status">
      <div className="feedback-inner">
        <Illustration src={atlas.img(entry, "thumb")} word={entry.w} topic={refw.topic} className="feedback-art" />
        <div className="feedback-text">
          <p className="feedback-verdict">{correct ? t("feedback_correct") : hinted ? t("feedback_hinted") : t("feedback_wrong")}</p>
          <p className="feedback-word">
            <b lang="en">{entry.w}</b>
            <span className="ipa">{entry.uk || entry.us}</span>
          </p>
          <p className="feedback-gloss">{shortGloss(refw)}</p>
          <p className="feedback-zh">
            {entry.senses
              .slice(0, 2)
              .map((s) => `${s.pos} ${viText(s)}`)
              .join("　")}
          </p>
          {example && (
            <p className="feedback-ex" lang="en">
              <Highlight text={example.en} word={entry.w} />
            </p>
          )}
        </div>
        <button ref={btn} className={`btn btn-xl ${correct ? "btn-sage" : "btn-terra"}`} onClick={onNext}>
          {t("continue_label")} <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}

function Summary({ session }: { session: ActiveSession }) {
  const t = useT();
  const atlas = useAtlas();
  useEffect(() => {
    if (store.get().settings.sfx) void cue("complete");
  }, []);
  const stats = sessionStats(session);
  const words = [...new Set(session.steps.map((s) => s.id))].map((id) => atlas.byId.get(id)!).filter(Boolean);
  const wrong = words.filter((w) => session.graded[w.id] === Rating.Again);
  const minutes = Math.max(1, Math.round(((session.finished ?? Date.now()) - session.started) / 60000));
  const done = () => {
    store.progress((p) => ({ ...p, session: null }));
    go({ page: "today" });
  };
  const again = () => {
    const { progress, settings } = store.get();
    store.progress((p) => ({ ...p, session: buildSession(atlas, progress, settings, { ids: wrong.map((w) => w.id) }) }));
  };
  return (
    <div className="learn summary">
      <div className="summary-card">
        <div className="summary-sky">
          <Galaxy mode="mini" highlight={words.map((w) => w.id)} ignite />
          <p>{t("lit_up_today").replace("{n}", String(words.length))}</p>
        </div>
        <p className="eyebrow">{t("session_complete")}</p>
        <h1 className="display">{stats.accuracy >= 90 ? t("summary_excellent") : stats.accuracy >= 60 ? t("summary_steady") : t("summary_missed")}</h1>
        <div className="summary-stats">
          <Ring value={stats.accuracy / 100} size={128} tone={stats.accuracy >= 60 ? "sage" : "terra"}>
            <b>{stats.accuracy}%</b>
            <small>{t("first_try")}</small>
          </Ring>
          <dl>
            <div>
              <dt>{t("new_label")}</dt>
              <dd>{session.newIds.length}</dd>
            </div>
            <div>
              <dt>{t("review_label")}</dt>
              <dd>{session.reviewIds.length}</dd>
            </div>
            <div>
              <dt>{t("time_label")}</dt>
              <dd>
                {minutes}
                <small>{t("mins")}</small>
              </dd>
            </div>
          </dl>
        </div>
        {(stats.recall.n > 0 || stats.choice.n > 0) && (
          <p className="summary-split">
            {stats.recall.n > 0 && <span>{t("summary_recall").replace("{ok}", String(stats.recall.ok)).replace("{n}", String(stats.recall.n))}</span>}
            {stats.choice.n > 0 && <span>{t("summary_choice").replace("{ok}", String(stats.choice.ok)).replace("{n}", String(stats.choice.n))}</span>}
          </p>
        )}
        <ul className="summary-words">
          {words.map((w) => (
            <li key={w.id} className={session.graded[w.id] === Rating.Again ? "is-wrong" : ""}>
              <Illustration src={atlas.img(w, "thumb")} word={w.word} topic={w.topic} />
              <span lang="en">{w.word}</span>
              <small>{w.vi || (!/[\u4e00-\u9fff]/.test(w.zh) ? w.zh : "")}</small>
            </li>
          ))}
        </ul>
        <p className="summary-note">{t("summary_note")}</p>
        <div className="summary-actions">
          {wrong.length > 0 && (
            <button className="btn btn-ghost" onClick={again}>
              <RotateCcw size={18} /> {t("practice_mistakes").replace("{n}", String(wrong.length))}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => shareSession(atlas, session)}>
            <Share2 size={18} /> {t("share_card")}
          </button>
          <button className="btn btn-primary btn-xl" onClick={done} ref={(b) => b?.focus({ preventScroll: true })}>
            {t("finish")} <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Page-level shortcuts that ignore typing in inputs (except Enter, which forms handle). */
export function useKeys(map: Record<string, () => void>) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA";
      if (typing && !(e.key === "Enter" && (t as HTMLInputElement).readOnly)) return;
      if (t.tagName === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;
      const fn = ref.current[e.key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
}
