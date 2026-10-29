import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useAtlas } from "../atlas/context";
import { store } from "../store/store";

const LEVELS = [
  ["A2", "Elementary", "Basic day-to-day vocabulary"],
  ["B1", "Intermediate", "Target IELTS 5.5 – 6.0"],
  ["B2", "Upper-Int", "Target IELTS 6.5 – 7.0"],
  ["C1", "Advanced", "Aiming for IELTS 7.5+"],
];

export function Onboarding() {
  const atlas = useAtlas();
  const [level, setLevel] = useState(1);
  const [goal, setGoal] = useState(10);
  const finish = () => store.settings({ onboarded: true, startLevel: atlas.cefr.indexOf(LEVELS[level][0]), dailyNew: goal });
  return (
    <div className="onboard" role="dialog" aria-modal="true" aria-label="Welcome">
      <div className="onboard-card">
        <img className="onboard-art" src={`${import.meta.env.BASE_URL}brand/hero.webp`} alt="" />
        <div className="onboard-body">
          <p className="eyebrow">Welcome to Word Atlas</p>
          <h1 className="display">
            {atlas.count.toLocaleString()} stars,
            <br />
            waiting to be lit up.
          </h1>
          <fieldset>
            <legend>Where would you like to begin?</legend>
            <div className="choice-grid">
              {LEVELS.map(([code, name, desc], i) => (
                <button key={code} className={`choice ${level === i ? "is-on" : ""}`} onClick={() => setLevel(i)} aria-pressed={level === i}>
                  <span className={`chip chip-level lv-${code}`}>{code}</span>
                  <b>{name}</b>
                  <small>{desc}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Daily goal (new words):</legend>
            <div className="segmented segmented-wide">
              {[5, 10, 15, 20].map((n) => (
                <button key={n} className={goal === n ? "is-on" : ""} onClick={() => setGoal(n)} aria-pressed={goal === n}>
                  {n} words{n === 10 ? " · Rec" : ""}
                </button>
              ))}
            </div>
          </fieldset>
          <button className="btn btn-primary btn-xl" onClick={finish}>
            Start Exploring <ArrowRight size={20} />
          </button>
          <p className="muted">No account needed. Progress is saved locally on your device.</p>
        </div>
      </div>
    </div>
  );
}
