import { ArrowUpRight, Coffee, Database, Github, Sparkles } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { useAtlas } from "../atlas/context";
import { REPO_URL, SUPPORT_URL, UPSTREAM_URL } from "../config";
import { useT } from "../i18n";

const BASE = import.meta.env.BASE_URL;

/** Replaces {name} placeholders in translated text with elements. */
const fill = (text: string, parts: Record<string, ReactNode>) => text.split(/\{(\w+)\}/).map((s, i) => (i % 2 ? <Fragment key={i}>{parts[s]}</Fragment> : s));

export function About() {
  const t = useT();
  const atlas = useAtlas();
  return (
    <div className="page about">
      <header className="about-hero">
        <img src={`${BASE}brand/og.webp`} alt="" width="660" height="660" />
        <div>
          <p className="eyebrow">{t("about_eyebrow")}</p>
          <h1 className="display">{t("about_title")}</h1>
          <p className="lede">
            {t("about_lede_1").replace("{n}", atlas.count.toLocaleString())}
          </p>
          <p className="lede">
            {t("about_lede_2")}
          </p>
          <div className="about-actions">
            <a className="btn btn-primary" href={REPO_URL} target="_blank" rel="noreferrer">
              <Github size={18} /> {t("about_github")}
            </a>
            <a className="btn btn-ghost" href={`${REPO_URL}/tree/main/data`} target="_blank" rel="noreferrer">
              <Database size={18} /> {t("about_dataset")}
            </a>
            <a className="btn btn-ghost" href={SUPPORT_URL} target="_blank" rel="noreferrer">
              <Coffee size={18} /> {t("support_cta")}
            </a>
          </div>
        </div>
      </header>

      <div className="about-grid">
        <section className="panel">
          <h2 className="eyebrow">{t("about_why")}</h2>
          <ul className="feature-list">
            <li>
              <b>{t("about_f1_title")}</b> {t("about_f1")}
            </li>
            <li>
              <b>{t("about_f2_title")}</b> {t("about_f2")}
            </li>
            <li>
              <b>{t("about_f3_title")}</b> {t("about_f3")}
            </li>
            <li>
              <b>{t("about_f4_title")}</b> {t("about_f4")}
            </li>
            <li>
              <b>{t("about_f5_title")}</b> {t("about_f5")}
            </li>
          </ul>
        </section>

        <section className="panel">
          <h2 className="eyebrow">{t("about_shortcuts")}</h2>
          <dl className="keys">
            <div>
              <dt>
                <kbd>⌘</kbd>
                <kbd>K</kbd> {t("about_or")} <kbd>/</kbd>
              </dt>
              <dd>{t("about_key_search")}</dd>
            </div>
            <div>
              <dt>
                <kbd>1</kbd>–<kbd>4</kbd>
              </dt>
              <dd>{t("about_key_option")}</dd>
            </div>
            <div>
              <dt>
                <kbd>Enter</kbd>
              </dt>
              <dd>{t("about_key_submit")}</dd>
            </div>
            <div>
              <dt>
                <kbd>Esc</kbd>
              </dt>
              <dd>{t("about_key_close")}</dd>
            </div>
            <div>
              <dt>
                <kbd>Ctrl</kbd> + <kbd>Space</kbd>
              </dt>
              <dd>{t("about_key_replay")}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2 className="eyebrow">{t("about_credits")}</h2>
          <p className="muted">
            {fill(t("about_credits_1"), {
              author: <b>zhugez</b>,
              upstream: (
                <a href={UPSTREAM_URL} target="_blank" rel="noreferrer">
                  <b>Word Atlas</b>
                </a>
              ),
              repo: <code>designfuchen/word-atlas</code>,
            })}
          </p>
          <p className="muted">
            {t("about_credits_2")}
          </p>
        </section>

        <section className="panel">
          <h2 className="eyebrow">{t("about_developers")}</h2>
          <p className="muted">
            {fill(t("about_developers_text"), { data: <code>data/</code>, public: <code>public/atlas/</code> })}
          </p>
          <a className="link" href={`${REPO_URL}#readme`} target="_blank" rel="noreferrer">
            {t("about_docs")} <ArrowUpRight size={14} />
          </a>
        </section>
      </div>
      <p className="colophon">
        <Sparkles size={14} /> {t("about_colophon")}
      </p>
    </div>
  );
}
