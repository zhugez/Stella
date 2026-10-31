import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useAtlas } from "../atlas/context";
import { store } from "../store/store";

const LEVELS = [
  ["A1", "Beginner", "Familiar words and simple phrases"],
  ["A2", "Elementary", "Basic day-to-day vocabulary"],
  ["B1", "Intermediate", "Everyday topics and familiar texts"],
  ["B2", "Upper-Int", "Detailed texts and abstract topics"],
  ["C1", "Advanced", "Complex texts and nuanced meanings"],
  ["C2", "Proficient", "Subtle distinctions and idiomatic language"],
];

export function Onboarding() {
  const atlas = useAtlas();
  const [level, setLevel] = useState(2);
  const [goal, setGoal] = useState(10);
  const [name, setName] = useState("");
  const finish = () =>
    store.settings({ onboarded: true, startLevel: atlas.cefr.indexOf(LEVELS[level][0]), dailyNew: goal, name: name.trim() });
  return (
    <div className="onboard" role="dialog" aria-modal="true" aria-label="Welcome">
      <div className="onboard-card">
        <img className="onboard-art" src={`${import.meta.env.BASE_URL}brand/hero.webp`} alt="" />
        <div className="onboard-body">
          <p className="eyebrow">Welcome to Stella</p>
          <h1 className="display">
            {atlas.count.toLocaleString()} stars,
            <br />
            waiting to be lit up.
          </h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              finish();
            }}
          >
            <fieldset>
              <legend>What should we call you? (optional)</legend>
              <input
                className="onboard-name"
                type="text"
                maxLength={30}
                value={name}
                placeholder="Your name"
                aria-label="Your name"
                onChange={(e) => setName(e.target.value)}
              />
            </fieldset>
            <fieldset>
              <legend>Which vocabulary feels familiar?</legend>
              <p className="muted">Choose a starting point, not a certified level or IELTS score. You can change it later.</p>
              <div className="choice-grid">
                {LEVELS.map(([code, label, desc], i) => (
                  <button key={code} type="button" className={`choice ${level === i ? "is-on" : ""}`} onClick={() => setLevel(i)} aria-pressed={level === i}>
                    <span className={`chip chip-level lv-${code}`}>{code}</span>
                    <b>{label}</b>
                    <small>{desc}</small>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Daily goal (new words):</legend>
              <div className="segmented segmented-wide">
                {[5, 10, 15, 20].map((n) => (
                  <button key={n} type="button" className={goal === n ? "is-on" : ""} onClick={() => setGoal(n)} aria-pressed={goal === n}>
                    {n} words{n === 10 ? " · Rec" : ""}
                  </button>
                ))}
              </div>
            </fieldset>
            <button className="btn btn-primary btn-xl" type="submit">
              Start Exploring <ArrowRight size={20} />
            </button>
          </form>
          <p className="muted">No account needed. Progress is saved locally on your device.</p>
        </div>
      </div>
    </div>
  );
}
