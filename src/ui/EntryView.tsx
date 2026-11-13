import { Bookmark, BookmarkCheck, Lightbulb, Share2 } from "lucide-react";
import type { Entry, WordRef } from "../atlas/types";
import { useAtlas } from "../atlas/context";
import { topicLabel, useT } from "../i18n";
import { splitHighlight, splitPair } from "../lib/text";
import { formatInterval, isMastered } from "../store/srs";
import { toggleBookmark, useStore } from "../store/store";
import { Illustration } from "./Illustration";
import { Speak } from "./Speak";
import { shareWord } from "./share";
import { openWord } from "../lib/router";

export function Highlight({ text, word }: { text: string; word: string }) {
  const parts = splitHighlight(text, word);
  if (!parts) return <>{text}</>;
  return (
    <>
      {parts[0]}
      <mark>{parts[1]}</mark>
      {parts[2]}
    </>
  );
}

export function Pronounce({ entry, refw }: { entry: Entry; refw: WordRef | Entry }) {
  const t = useT();
  const atlas = useAtlas();
  const accent = useStore((s) => s.settings.accent);
  const both = entry.uk && entry.us && entry.uk !== entry.us;
  const items: ["uk" | "us", string, string][] = both
    ? [["uk", t("accent_uk"), entry.uk], ["us", t("accent_us"), entry.us]]
    : [[accent, accent === "uk" ? t("accent_uk") : t("accent_us"), entry.uk || entry.us]];
  if (!both && items[0][2] === "") return null;
  return (
    <div className="pron">
      {(accent === "us" ? [...items].reverse() : items).map(([acc, label, ipa]) => (
        <Speak
          key={acc}
          url={atlas.audio(refw, acc)}
          text={entry.w}
          accent={acc}
          size="sm"
          label={
            <>
              <em>{label}</em>
              <span className="ipa">{ipa}</span>
            </>
          }
        />
      ))}
    </div>
  );
}

export function EntryView({ entry, mode = "detail", eager = true }: { entry: Entry; mode?: "detail" | "intro" | "reveal"; eager?: boolean }) {
  const t = useT();
  const atlas = useAtlas();
  const ref = atlas.byId.get(entry.id);
  const card = useStore((s) => s.progress.cards[entry.id]);
  const saved = useStore((s) => s.progress.bookmarks.includes(entry.id));
  const accent = useStore((s) => s.settings.accent);
  const topicIdx = atlas.topics.findIndex((tp) => tp[0] === entry.topic);
  const topic = atlas.topics[topicIdx];
  const exUrls = [atlas.audio(entry, "ex"), atlas.audio(entry, "ex2")];
  const famLinks = entry.fam.map((f) => {
    const w = f.replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase();
    const hit = atlas.words.find((x) => x.word.toLowerCase() === w);
    return { label: f, id: hit?.id };
  });
  const status = card ? (isMastered(card) ? "mastered" : "learning") : null;

  const langPair = useStore((s) => s.settings.langPair || "en-vi");
  const isZh = langPair === "zh-vi" || langPair === "vi-zh";
  const isFr = langPair === "fr-vi" || langPair === "vi-fr";

  return (
    <article className={`entry entry-${mode}`}>
      <div className="entry-art">
        <Illustration src={atlas.img(entry)} word={entry.w} topic={topicIdx} eager={eager} alt={t("illustration_alt").replace("{word}", isFr ? (entry.fr_word || entry.w) : isZh ? (entry.zh_word || entry.w) : entry.w)} />
      </div>
      <div className="entry-body">
        <header className="entry-head">
          <div className="entry-tags">
            <span className={`chip chip-level lv-${entry.cefr}`}>{entry.cefr}</span>
            {topic && <span className="chip">{topicLabel(t, topic[1])}</span>}
            {status && <span className={`chip chip-status ${status === "mastered" ? "is-done" : ""}`}>{t(status === "mastered" ? "status_mastered" : "status_learning")}</span>}
          </div>
          {mode === "detail" && (
            <div className="entry-actions">
              <button className={`icon-btn ${saved ? "is-on" : ""}`} onClick={() => toggleBookmark(entry.id)} aria-pressed={saved} aria-label={saved ? t("remove_bookmark") : t("save_word")} title={saved ? t("remove_bookmark") : t("save_word")}>
                {saved ? <BookmarkCheck size={19} /> : <Bookmark size={19} />}
              </button>
              <button className="icon-btn" onClick={() => shareWord(atlas, entry)} aria-label={t("generate_share_card")} title={t("generate_share_card")}>
                <Share2 size={19} />
              </button>
            </div>
          )}
        </header>
        {ref && (
          <p className="specimen">
            № {String(ref.order + 1).padStart(4, "0")}
            <i />
            Stella · {langPair.toUpperCase()}
          </p>
        )}
        <h2 className="headword" lang="en">
          {langPair === "vi-en" || langPair === "vi-zh" || langPair === "vi-fr"
            ? (entry.vi_word || entry.senses[0]?.vi || entry.w)
            : langPair === "zh-vi"
            ? (entry.zh_word || entry.senses[0]?.zh || entry.w)
            : langPair === "fr-vi"
            ? (entry.fr_word || entry.w)
            : entry.w}
        </h2>
        {(langPair === "en-vi" || langPair === "zh-vi" || langPair === "fr-vi") && entry.vi_word && (
          <p className="entry-gloss" lang="vi">
            {entry.vi_word}
          </p>
        )}
        {(langPair === "vi-en" || langPair === "vi-zh" || langPair === "vi-fr" || langPair === "zh-vi" || langPair === "fr-vi") && (
          <p style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--terra)", marginTop: "-6px", marginBottom: "8px" }}>
            {langPair === "vi-en" && <>English: <b>{entry.w}</b></>}
            {langPair === "vi-zh" && <>中文: <b>{entry.zh_word || entry.senses[0]?.zh}</b> (EN: {entry.w})</>}
            {langPair === "vi-fr" && <>Français: <b>{entry.fr_word || entry.w}</b> (EN: {entry.w})</>}
            {langPair === "zh-vi" && <>English: <b>{entry.w}</b></>}
            {langPair === "fr-vi" && <>English: <b>{entry.w}</b></>}
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
          <Pronounce entry={entry} refw={ref ?? entry} />
          {isFr && entry.fr_audio && (
            <Speak url={entry.fr_audio} text={entry.fr_word || entry.w} accent="uk" size="sm" label="FR (Français)" />
          )}
        </div>

        <ol className="senses">
          {entry.senses.map((s, i) => (
            <li key={i}>
              <span className="pos">{s.pos}</span>
              <span className="zh">
                {isZh ? (
                  <><b>{s.zh}</b> · <span>{s.vi || ""}</span></>
                ) : isFr ? (
                  <><b>{s.vi || s.en}</b> {s.en && <span className="en" lang="en">({s.en})</span>}</>
                ) : (
                  <><b>{s.vi || (!/[\u4e00-\u9fff]/.test(s.zh) ? s.zh : "")}</b> {s.en && <span className="en" lang="en">({s.en})</span>}</>
                )}
              </span>
            </li>
          ))}
        </ol>

        {entry.ex.length > 0 && (
          <section className="block">
            <h3 className="eyebrow">{t("examples")}</h3>
            <ul className="examples">
              {entry.ex.map((x, i) => {
                const mainSent = isFr && x.fr ? x.fr : isZh && x.zh ? x.zh : x.en;
                const audioUrl = isFr || isZh ? null : (exUrls[i] ?? null);
                return (
                  <li key={i}>
                    {entry.ex.length > 1 && <span className={`ex-tag ${i ? "is-ielts" : ""}`}>{i ? t("example_ielts") : t("example_everyday")}</span>}
                    <p className="ex-en" lang={isFr ? "fr" : isZh ? "zh" : "en"}>
                      <Highlight text={mainSent} word={isFr ? (entry.fr_word || entry.w) : isZh ? (entry.zh_word || entry.w) : entry.w} />
                      <Speak url={audioUrl} text={mainSent} accent={i === 1 && exUrls[1] ? "us" : accent} size="sm" className="ex-speak" />
                    </p>
                    <p className="ex-zh">
                      {x.vi || (x.zh && !/[\u4e00-\u9fff]/.test(x.zh) ? x.zh : "")}
                      {(isFr || isZh) && x.en && <small style={{ display: "block", color: "var(--ink-4)", marginTop: "2px" }}>EN: {x.en}</small>}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {(entry.col.length > 0 || entry.col_fr?.length || entry.col_zh?.length) && (
          <section className="block">
            <h3 className="eyebrow">{t("collocations")}</h3>
            <ul className="collocations">
              {(isFr && entry.col_fr?.length ? entry.col_fr : isZh && entry.col_zh?.length ? entry.col_zh : entry.col).map((c) => {
                const { en: headPhrase, zh: subDef } = splitPair(c);
                return (
                  <li key={c}>
                    <span lang={isFr ? "fr" : isZh ? "zh" : "en"}>{headPhrase}</span>
                    {subDef && <small>{subDef}</small>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {(famLinks.length > 0 || entry.syn.length > 0 || entry.ant.length > 0) && (
          <section className="block relations">
            {famLinks.length > 0 && (
              <div>
                <h3 className="eyebrow">{t("word_family")}</h3>
                <p>
                  {famLinks.map((f) =>
                    f.id && mode === "detail" ? (
                      <button key={f.label} className="link" onClick={() => openWord(f.id!)}>
                        {f.label}
                      </button>
                    ) : (
                      <span key={f.label}>{f.label}</span>
                    ),
                  )}
                </p>
              </div>
            )}
            {entry.syn.length > 0 && (
              <div>
                <h3 className="eyebrow">{t("synonyms")}</h3>
                <p>
                  {entry.syn.map((s) => (
                    <span key={s} style={{ display: "inline-block", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: "4px", marginRight: "6px", marginBottom: "4px" }}>
                      {s}
                    </span>
                  ))}
                </p>
              </div>
            )}
            {entry.ant.length > 0 && (
              <div>
                <h3 className="eyebrow">{t("antonyms")}</h3>
                <p>
                  {entry.ant.map((s) => (
                    <span key={s} style={{ display: "inline-block", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: "4px", marginRight: "6px", marginBottom: "4px" }}>
                      {s}
                    </span>
                  ))}
                </p>
              </div>
            )}
          </section>
        )}

        {(() => {
          const tip = isFr && entry.tip_fr ? entry.tip_fr : isZh ? entry.tip || entry.tip_vi : entry.tip_vi;
          if (!tip) return null;
          return (
            <aside className="tip">
              <Lightbulb size={17} strokeWidth={1.8} />
              <p>{tip}</p>
            </aside>
          );
        })()}

        {entry.note && <p className="usage-note">{t("usage_note")}: {entry.note}</p>}

        {mode === "detail" && card && (
          <p className="memory-note">
            {card.due <= Date.now() ? t("memory_ready") : t("memory_next").replace("{interval}", formatInterval(card.due - Date.now(), t))} · {t("memory_stability").replace("{n}", card.s < 1 ? "<1" : String(Math.round(card.s)))} · {t("memory_reviewed").replace("{n}", String(card.reps))}
          </p>
        )}
      </div>
    </article>
  );
}
