import { Download, Pencil, RotateCcw, Sparkles, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useAtlas } from "../atlas/context";
import { weakWords } from "../lib/drills";
import { go, openWord } from "../lib/router";
import { buildSession } from "../store/session";
import { isMastered } from "../store/srs";
import { dayKey, exportBackup, importBackup, resetProgress, store, useStore, type Settings } from "../store/store";
import { Illustration } from "../ui/Illustration";
import { toast } from "../ui/Toast";
import { streakOf } from "./Today";

export function Me({ privateAvailable: _privateAvailable }: { privateAvailable: boolean }) {
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
  const settings = useStore((s) => s.settings);
  const saveError = useStore((s) => s.saveError);
  const file = useRef<HTMLInputElement>(null);
  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const draft = useRef("");
  const editButton = useRef<HTMLButtonElement>(null);

  const openName = () => {
    draft.current = settings.name;
    setDraftName(settings.name);
    setNaming(true);
  };
  const commitName = (refocus = false) => {
    store.settings({ name: draft.current.trim() });
    setNaming(false);
    if (refocus) requestAnimationFrame(() => editButton.current?.focus());
  };

  const stats = useMemo(() => {
    const cards = Object.values(progress.cards);
    const days = Object.values(progress.days);
    const r = days.reduce((n, d) => n + d.r, 0);
    const c = days.reduce((n, d) => n + d.c, 0);
    const t = days.reduce((n, d) => n + d.t, 0);
    const now = Date.now();
    const forecast = Array.from({ length: 7 }, (_, i) => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      end.setDate(end.getDate() + i);
      const start = new Date(end);
      start.setHours(0, 0, 0, 0);
      return cards.filter((x) => (i === 0 ? x.due <= end.getTime() : x.due >= start.getTime() && x.due <= end.getTime())).length;
    });
    void now;
    return { learned: cards.length, mastered: cards.filter(isMastered).length, reviews: r, accuracy: r ? Math.round((c / r) * 100) : 0, minutes: Math.round(t / 60), forecast };
  }, [progress]);

  const set = (patch: Partial<Settings>) => store.settings(patch);
  const download = () => {
    const blob = new Blob([exportBackup()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `word-atlas-backup-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const restore = async (f: File) => {
    if (f.size > 30 * 1024 * 1024) return toast("File too large to be a valid backup.", "warn");
    const r = importBackup(await f.text());
    toast(r.ok ? `Restored progress for ${r.cards} words` : r.error, r.ok ? "ok" : "warn");
  };
  const maxF = Math.max(1, ...stats.forecast);

  return (
    <div className="page me">
      <header className="page-head">
        <p className="eyebrow">Profile</p>
        {naming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commitName(true);
            }}
          >
            <input
              className="display name-input"
              autoFocus
              maxLength={30}
              value={draftName}
              placeholder="Your Cosmos"
              aria-label="Your name"
              onChange={(e) => {
                draft.current = e.target.value;
                setDraftName(e.target.value);
              }}
              onBlur={() => commitName()}
              onKeyDown={(e) => {
                if (e.key !== "Escape") return;
                draft.current = settings.name;
                setDraftName(settings.name);
                commitName(true);
              }}
            />
          </form>
        ) : (
          <h1 className="display">
            {settings.name ? `Hi, ${settings.name}` : "Your Cosmos"}
            <button
              className="name-edit"
              ref={editButton}
              aria-label="Edit your name"
              title="Edit your name"
              onClick={openName}
            >
              <Pencil size={16} />
            </button>
          </h1>
        )}
      </header>

      <section className="stat-strip">
        <div>
          <dt>Streak</dt>
          <dd>
            {streakOf(progress.days)}
            <small>days</small>
          </dd>
        </div>
        <div>
          <dt>Lit Stars</dt>
          <dd>{stats.learned.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Long-term</dt>
          <dd>{stats.mastered.toLocaleString()}</dd>
        </div>
        <div>
          <dt>First-try</dt>
          <dd>
            {stats.accuracy}
            <small>%</small>
          </dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>
            {stats.minutes}
            <small>mins</small>
          </dd>
        </div>
      </section>

      <div className="me-grid">
        <section className="panel">
          <h3 className="eyebrow">Past 20 Weeks</h3>
          <Heatmap days={progress.days} />
          <p className="muted">Each square is one day. Darker green indicates more answered questions. "Long-term" means FSRS stability exceeding 21 days.</p>
        </section>

        <section className="panel">
          <h3 className="eyebrow">7-Day Review Forecast</h3>
          <ol className="forecast">
            {stats.forecast.map((n, i) => (
              <li key={i}>
                <span style={{ height: `${(n / maxF) * 100}%` }} />
                <b>{n}</b>
                <small>{i === 0 ? "Today" : i === 1 ? "Tomorrow" : `+${i}d`}</small>
              </li>
            ))}
          </ol>
        </section>

        <WeakWords />

        <section className="panel settings">
          <h3 className="eyebrow">Learning Settings</h3>
          <Field label="Daily New Words" hint="Reviews have no cap; FSRS only schedules words you're about to forget.">
            <div className="segmented">
              {[5, 10, 15, 20, 30].map((n) => (
                <button key={n} className={settings.dailyNew === n ? "is-on" : ""} onClick={() => set({ dailyNew: n })}>
                  {n}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Starting CEFR Level" hint="Skip familiar lower-level vocabulary.">
            <div className="segmented">
              {atlas.cefr.map((l, i) => (
                <button key={l} className={settings.startLevel === i ? "is-on" : ""} onClick={() => set({ startLevel: i })}>
                  {l}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Target Retention" hint="Higher retention means more frequent intervals. 90% is the recommended sweet spot.">
            <div className="segmented">
              {[0.85, 0.9, 0.95].map((n) => (
                <button key={n} className={settings.retention === n ? "is-on" : ""} onClick={() => set({ retention: n })}>
                  {Math.round(n * 100)}%
                </button>
              ))}
            </div>
          </Field>
          <Field label="Pronunciation Accent">
            <div className="segmented">
              <button className={settings.accent === "uk" ? "is-on" : ""} onClick={() => set({ accent: "uk" })}>
                UK (British)
              </button>
              <button className={settings.accent === "us" ? "is-on" : ""} onClick={() => set({ accent: "us" })}>
                US (American)
              </button>
            </div>
          </Field>
          <Field label="Appearance">
            <div className="segmented">
              {(
                [
                  ["system", "System"],
                  ["light", "Light"],
                  ["dark", "Dark"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} className={settings.theme === k ? "is-on" : ""} onClick={() => set({ theme: k })}>
                  {l}
                </button>
              ))}
            </div>
          </Field>
          <Toggle label="Autoplay pronunciation audio" on={settings.autoplay} set={(v) => set({ autoplay: v })} />
          <Toggle label="Interface sound effects" on={settings.sfx} set={(v) => set({ sfx: v })} />
          <Toggle label="Opening splash animation" on={settings.splash} set={(v) => set({ splash: v })} />
          <Toggle label="Include spelling questions in review" on={settings.spell} set={(v) => set({ spell: v })} />
        </section>

        <section className="panel">
          <h3 className="eyebrow">Data & Storage</h3>
          <p className="muted">Your progress lives in your browser local storage: no account, no tracking. Export a backup anytime to transfer to another machine.</p>
          {saveError && <p className="warn-text">Browser storage write failed (private browsing or quota full). Please export a backup immediately.</p>}
          <div className="data-actions">
            <button className="btn btn-ghost" onClick={download}>
              <Download size={18} /> Export Backup
            </button>
            <button className="btn btn-ghost" onClick={() => file.current?.click()}>
              <Upload size={18} /> Import Backup
            </button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0]).finally(() => (e.target.value = ""))} />
            <button
              className="btn btn-ghost btn-danger"
              onClick={() => {
                if (confirm("Are you sure you want to reset all learning progress? This cannot be undone.")) {
                  resetProgress();
                  toast("Learning progress reset.");
                }
              }}
            >
              <RotateCcw size={18} /> Reset Data
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function WeakWords() {
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
  const ids = useMemo(() => weakWords(progress, 8).filter((id) => atlas.byId.has(id)), [progress, atlas]);

  const drill = () => {
    if (progress.session && !progress.session.finished) return toast("Finish or pause your current session first.", "warn");
    const { progress: p, settings } = store.get();
    const s = buildSession(atlas, p, settings, { ids });
    if (!s.steps.length) return toast("Nothing to drill yet.", "warn");
    store.progress((prev) => ({ ...prev, session: s }));
    go({ page: "learn" });
  };

  return (
    <section className="panel weak-words">
      <div className="panel-head">
        <h3 className="eyebrow">Words That Slip Away</h3>
        <span className="muted">Ranked by forgotten reviews</span>
      </div>
      {ids.length ? (
        <ul>
          {ids.map((id) => {
            const ref = atlas.byId.get(id)!;
            const card = progress.cards[id];
            return (
              <li key={id}>
                <button onClick={() => openWord(id)}>
                  <Illustration src={atlas.img(ref, "thumb")} word={ref.word} topic={ref.topic} />
                  <span lang="en">{ref.word}</span>
                  <small>{ref.vi || (!/[\u4e00-\u9fff]/.test(ref.zh) ? ref.zh : "")}</small>
                  <em>{card.lapses}×</em>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">No lapsed words yet. Words you forget in review will collect here.</p>
      )}
      <button className="btn btn-ghost" onClick={drill} disabled={!ids.length}>
        <Sparkles size={18} /> Drill these {ids.length || ""}
      </button>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <div>
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="field toggle">
      <b>{label}</b>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => set(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}

function Heatmap({ days }: { days: Record<string, { r: number }> }) {
  const weeks = 20;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (weeks * 7 - 1) - end.getDay());
  const cells: { k: string; v: number; future: boolean }[] = [];
  const d = new Date(start);
  for (let i = 0; i < (weeks + 1) * 7; i++) {
    const k = dayKey(d);
    cells.push({ k, v: days[k]?.r ?? 0, future: d > end });
    d.setDate(d.getDate() + 1);
  }
  const lvl = (v: number) => (v === 0 ? 0 : v < 10 ? 1 : v < 25 ? 2 : v < 50 ? 3 : 4);
  return (
    <div className="heatmap" role="img" aria-label="学习热力图">
      {cells.map((c) => (
        <span key={c.k} className={`h${c.future ? "x" : lvl(c.v)}`} title={`${c.k} · ${c.v} 题`} />
      ))}
    </div>
  );
}
