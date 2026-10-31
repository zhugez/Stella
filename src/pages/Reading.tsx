import { ArrowRight, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { prefetch, useAtlas } from "../atlas/context";
import type { Entry } from "../atlas/types";
import { passage } from "../lib/drills";
import { go, openWord } from "../lib/router";
import { shuffle, splitHighlight } from "../lib/text";

const SIZE = 6;

export function Reading() {
  const atlas = useAtlas();
  const [topic, setTopic] = useState(() => atlas.topics[0][0]);
  const [seed, setSeed] = useState(() => Date.now());
  const [lines, setLines] = useState<Entry[] | null>(null);

  useEffect(() => {
    let live = true;
    setLines(null);
    const ti = atlas.topics.findIndex((t) => t[0] === topic);
    const ids = shuffle(
      atlas.words.filter((w) => w.topic === ti),
      seed,
    )
      .slice(0, SIZE * 3)
      .map((w) => w.id);
    void prefetch(atlas, ids).then((list) => {
      if (live) setLines(passage(list.filter((e): e is Entry => !!e), SIZE));
    });
    return () => {
      live = false;
    };
  }, [atlas, topic, seed]);

  return (
    <div className="page reading">
      <header className="page-head">
        <p className="eyebrow">Reading · Topic sentences</p>
        <h1 className="display">Six sentences from the same topic.</h1>
        <p className="lede">
          Real example sentences from one IELTS topic cluster, one per word. They share a subject, not a story. Tap a highlighted
          word to open its card.
        </p>
      </header>

      <div className="chips reading-topics">
        {atlas.topics.map(([key, name]) => (
          <button key={key} className={`chip-btn ${topic === key ? "is-on" : ""}`} onClick={() => setTopic(key)} aria-pressed={topic === key}>
            {name}
          </button>
        ))}
      </div>

      <section className="panel passage">
        {lines === null ? (
          <span className="spinner" />
        ) : lines.length ? (
          <div className="passage-body">
            {lines.map((entry) => (
              <Line key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <p className="muted">This cluster has no illustrated sentences yet. Try another topic.</p>
        )}
        <div className="passage-actions">
          <button className="btn btn-primary" onClick={() => setSeed(Date.now())}>
            <RefreshCw size={18} /> New sentences
          </button>
          <button className="btn btn-ghost" onClick={() => go({ page: "atlas", topic })}>
            Browse in Atlas <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}

function Line({ entry }: { entry: Entry }) {
  const parts = splitHighlight(entry.ex[0].en, entry.w);
  return (
    <p className="passage-line" lang="en">
      {parts ? (
        <>
          {parts[0]}
          <button className="passage-word" onClick={() => openWord(entry.id)} title={`${entry.w} — open card`}>
            {parts[1]}
          </button>
          {parts[2]}
        </>
      ) : (
        entry.ex[0].en
      )}
    </p>
  );
}
