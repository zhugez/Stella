import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useAtlas } from "../atlas/context";
import { useT, type TranslationKey } from "../i18n";
import { store } from "../store/store";

const LEVELS: [string, TranslationKey, TranslationKey][] = [
  ["A1", "level_beginner", "level_desc_a1"],
  ["A2", "level_elementary", "level_desc_a2"],
  ["B1", "level_intermediate", "level_desc_b1"],
  ["B2", "level_upper_int", "level_desc_b2"],
  ["C1", "level_advanced", "level_desc_c1"],
  ["C2", "level_proficient", "level_desc_c2"],
];

export function Onboarding() {
  const atlas = useAtlas();
  const t = useT();
  const [level, setLevel] = useState(2);
  const [goal, setGoal] = useState(10);
  const [name, setName] = useState("");
  const finish = () =>
    store.settings({ onboarded: true, startLevel: atlas.cefr.indexOf(LEVELS[level][0]), dailyNew: goal, name: name.trim() });
  return (
    <div className="onboard" role="dialog" aria-modal="true" aria-label={t("welcome_aria")}>
      <div className="onboard-card">
        <img className="onboard-art" src={`${import.meta.env.BASE_URL}brand/hero.webp`} alt="" />
        <div className="onboard-body">
          <p className="eyebrow">{t("welcome_stella")}</p>
          <h1 className="display">
            {t("onboard_title_stars").replace("{n}", atlas.count.toLocaleString())}
            <br />
            {t("onboard_title_lit")}
          </h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              finish();
            }}
          >
            <fieldset>
              <legend>{t("onboard_name_question")}</legend>
              <input
                className="onboard-name"
                type="text"
                maxLength={30}
                value={name}
                placeholder={t("your_name")}
                aria-label={t("your_name")}
                onChange={(e) => setName(e.target.value)}
              />
            </fieldset>
            <fieldset>
              <legend>{t("onboard_vocab_question")}</legend>
              <p className="muted">{t("onboard_vocab_note")}</p>
              <div className="choice-grid">
                {LEVELS.map(([code, labelKey, descKey], i) => (
                  <button key={code} type="button" className={`choice ${level === i ? "is-on" : ""}`} onClick={() => setLevel(i)} aria-pressed={level === i}>
                    <span className={`chip chip-level lv-${code}`}>{code}</span>
                    <b>{t(labelKey)}</b>
                    <small>{t(descKey)}</small>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>{t("daily_goal")}</legend>
              <div className="segmented segmented-wide">
                {[5, 10, 15, 20].map((n) => (
                  <button key={n} type="button" className={goal === n ? "is-on" : ""} onClick={() => setGoal(n)} aria-pressed={goal === n}>
                    {t("goal_words").replace("{n}", String(n))}{n === 10 ? ` · ${t("goal_recommended")}` : ""}
                  </button>
                ))}
              </div>
            </fieldset>
            <button className="btn btn-primary btn-xl" type="submit">
              {t("start_exploring")} <ArrowRight size={20} />
            </button>
          </form>
          <p className="muted">{t("no_account")}</p>
        </div>
      </div>
    </div>
  );
}
