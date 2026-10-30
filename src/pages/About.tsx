import { ArrowUpRight, Database, Github, Sparkles } from "lucide-react";
import { useAtlas } from "../atlas/context";
import { REPO_URL, UPSTREAM_URL } from "../config";

const BASE = import.meta.env.BASE_URL;

export function About() {
  const atlas = useAtlas();
  return (
    <div className="page about">
      <header className="about-hero">
        <img src={`${BASE}brand/og.webp`} alt="" width="660" height="660" />
        <div>
          <p className="eyebrow">About Stella</p>
          <h1 className="display">One word, one canvas. Light up your IELTS.</h1>
          <p className="lede">
            Stella organizes IELTS vocabulary into {atlas.count.toLocaleString()} illustrated constellation entries. Each word features an original painting, everyday & academic IELTS example sentences, native UK/US audio, and human-edited Vietnamese guidance.
          </p>
          <p className="lede">
            Free, local-first, and open-source. Code is licensed under MIT; vocabulary illustrations and dataset under CC BY 4.0.
          </p>
          <div className="about-actions">
            <a className="btn btn-primary" href={REPO_URL} target="_blank" rel="noreferrer">
              <Github size={18} /> View on GitHub
            </a>
            <a className="btn btn-ghost" href={`${REPO_URL}/tree/main/data`} target="_blank" rel="noreferrer">
              <Database size={18} /> Download Dataset (JSON / CSV)
            </a>
          </div>
        </div>
      </header>

      <div className="about-grid">
        <section className="panel">
          <h2 className="eyebrow">Why it works</h2>
          <ul className="feature-list">
            <li>
              <b>Visual first.</b> Every word is accompanied by a dedicated painting that illustrates the context.
            </li>
            <li>
              <b>Active recall.</b> Practice through meaning selection, cloze completion, listening, and typing.
            </li>
            <li>
              <b>FSRS Spaced Repetition.</b> Powered by the modern Free Spaced Repetition Scheduler — reviewing right before memory decays.
            </li>
            <li>
              <b>Human editorial voice.</b> Real-world Vietnamese tips and collocations written for practical IELTS tests, free of AI clichés.
            </li>
            <li>
              <b>Local-first privacy.</b> No accounts, no telemetry. Your progress belongs to your browser and can be exported at any time.
            </li>
          </ul>
        </section>

        <section className="panel">
          <h2 className="eyebrow">Keyboard Shortcuts</h2>
          <dl className="keys">
            <div>
              <dt>
                <kbd>⌘</kbd>
                <kbd>K</kbd> or <kbd>/</kbd>
              </dt>
              <dd>Search any word</dd>
            </div>
            <div>
              <dt>
                <kbd>1</kbd>–<kbd>4</kbd>
              </dt>
              <dd>Select option</dd>
            </div>
            <div>
              <dt>
                <kbd>Enter</kbd>
              </dt>
              <dd>Submit / Continue</dd>
            </div>
            <div>
              <dt>
                <kbd>Esc</kbd>
              </dt>
              <dd>Close dialog</dd>
            </div>
            <div>
              <dt>
                <kbd>Ctrl</kbd> + <kbd>Space</kbd>
              </dt>
              <dd>Replay the sentence audio (dictation)</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2 className="eyebrow">Attribution & Credits</h2>
          <p className="muted">
            Stella is created and developed by <b>zhugez</b>. It is directly inspired by and built upon the wonderful foundation of <a href={UPSTREAM_URL} target="_blank" rel="noreferrer"><b>Word Atlas</b></a> by Yang Lei (<code>designfuchen/word-atlas</code>), licensed under MIT & CC BY 4.0.
          </p>
          <p className="muted">
            Audio synthesized with ElevenLabs (UK Alice, US Sarah). All contributions, corrections, and pull requests are warmly welcomed on our GitHub repository.
          </p>
        </section>

        <section className="panel">
          <h2 className="eyebrow">For Developers</h2>
          <p className="muted">
            Raw vocabulary datasets are in <code>data/</code>; web chunks, illustrations, and audio are in <code>public/atlas/</code>. Free to reuse for custom Anki decks, extensions, or NLP benchmarks with attribution.
          </p>
          <a className="link" href={`${REPO_URL}#readme`} target="_blank" rel="noreferrer">
            Read Project Documentation <ArrowUpRight size={14} />
          </a>
        </section>
      </div>
      <p className="colophon">
        <Sparkles size={14} /> Built for every IELTS learner aiming for mastery.
      </p>
    </div>
  );
}
