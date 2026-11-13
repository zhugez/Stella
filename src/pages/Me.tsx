import { Download, Pencil, RotateCcw, Sparkles, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useAtlas } from "../atlas/context";
import { tr, useT, type TranslationKey } from "../i18n";
import { weakWords } from "../lib/drills";
import { go, openWord } from "../lib/router";
import { buildSession } from "../store/session";
import { isMastered } from "../store/srs";
import { dayKey, exportBackup, importBackup, resetProgress, store, useStore, type Settings } from "../store/store";
import { Illustration } from "../ui/Illustration";
import { toast } from "../ui/Toast";
import { streakOf } from "./Today";

export function Me({ privateAvailable: _privateAvailable }: { privateAvailable: boolean }) {
  const t = useT();
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
    const secs = days.reduce((n, d) => n + d.t, 0);
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
    return { learned: cards.length, mastered: cards.filter(isMastered).length, reviews: r, accuracy: r ? Math.round((c / r) * 100) : 0, minutes: Math.round(secs / 60), forecast };
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
    if (f.size > 30 * 1024 * 1024) return toast(t("backup_too_large"), "warn");
    const r = importBackup(await f.text());
    toast(r.ok ? t("backup_restored").replace("{n}", String(r.cards)) : tr(r.error), r.ok ? "ok" : "warn");
  };
  const maxF = Math.max(1, ...stats.forecast);

  return (
    <div className="page me">
      <header className="page-head">
        <p className="eyebrow">{t("me")}</p>
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
              placeholder={t("me_default_name")}
              aria-label={t("your_name")}
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
            {settings.name ? t("me_hi").replace("{name}", settings.name) : t("me_default_name")}
            <button
              className="name-edit"
              ref={editButton}
              aria-label={t("edit_name")}
              title={t("edit_name")}
              onClick={openName}
            >
              <Pencil size={16} />
            </button>
          </h1>
        )}
      </header>

      <section className="stat-strip">
        <div>
          <dt>{t("stat_streak")}</dt>
          <dd>
            {streakOf(progress.days)}
            <small>{t("stat_days")}</small>
          </dd>
        </div>
        <div>
          <dt>{t("stat_lit_stars")}</dt>
          <dd>{stats.learned.toLocaleString()}</dd>
        </div>
        <div>
          <dt>{t("stat_long_term")}</dt>
          <dd>{stats.mastered.toLocaleString()}</dd>
        </div>
        <div>
          <dt>{t("stat_first_try")}</dt>
          <dd>
            {stats.accuracy}
            <small>%</small>
          </dd>
        </div>
        <div>
          <dt>{t("time_label")}</dt>
          <dd>
            {stats.minutes}
            <small>{t("mins")}</small>
          </dd>
        </div>
      </section>

      <div className="me-grid">
        <section className="panel">
          <h3 className="eyebrow">{t("heatmap_title")}</h3>
          <Heatmap days={progress.days} />
          <p className="muted">{t("heatmap_note")}</p>
        </section>

        <section className="panel">
          <h3 className="eyebrow">{t("forecast_title")}</h3>
          <ol className="forecast">
            {stats.forecast.map((n, i) => (
              <li key={i}>
                <span style={{ height: `${(n / maxF) * 100}%` }} />
                <b>{n}</b>
                <small>{i === 0 ? t("today") : i === 1 ? t("forecast_tomorrow") : t("forecast_in_days").replace("{n}", String(i))}</small>
              </li>
            ))}
          </ol>
        </section>

        <WeakWords />

        <section className="panel settings">
          <h3 className="eyebrow">{t("settings_title")}</h3>
          <Field label={t("setting_daily_new")} hint={t("setting_daily_new_hint")}>
            <div className="segmented">
              {[5, 10, 15, 20, 30].map((n) => (
                <button key={n} className={settings.dailyNew === n ? "is-on" : ""} onClick={() => set({ dailyNew: n })}>
                  {n}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("setting_start_level")} hint={t("setting_start_level_hint")}>
            <div className="segmented">
              {atlas.cefr.map((l, i) => (
                <button key={l} className={settings.startLevel === i ? "is-on" : ""} onClick={() => set({ startLevel: i })}>
                  {l}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("setting_retention")} hint={t("setting_retention_hint")}>
            <div className="segmented">
              {[0.85, 0.9, 0.95].map((n) => (
                <button key={n} className={settings.retention === n ? "is-on" : ""} onClick={() => set({ retention: n })}>
                  {Math.round(n * 100)}%
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("setting_accent")}>
            <div className="segmented">
              <button className={settings.accent === "uk" ? "is-on" : ""} onClick={() => set({ accent: "uk" })}>
                {t("accent_uk_long")}
              </button>
              <button className={settings.accent === "us" ? "is-on" : ""} onClick={() => set({ accent: "us" })}>
                {t("accent_us_long")}
              </button>
            </div>
          </Field>
          <Field label={t("setting_appearance")}>
            <div className="segmented">
              {(
                [
                  ["system", "theme_system"],
                  ["light", "theme_light"],
                  ["dark", "theme_dark"],
                ] as const satisfies readonly (readonly [string, TranslationKey])[]
              ).map(([k, l]) => (
                <button key={k} className={settings.theme === k ? "is-on" : ""} onClick={() => set({ theme: k })}>
                  {t(l)}
                </button>
              ))}
            </div>
          </Field>
          <Toggle label={t("setting_autoplay")} on={settings.autoplay} set={(v) => set({ autoplay: v })} />
          <Toggle label={t("setting_sfx")} on={settings.sfx} set={(v) => set({ sfx: v })} />
          <Toggle label={t("setting_splash")} on={settings.splash} set={(v) => set({ splash: v })} />
          <Toggle label={t("setting_spell")} on={settings.spell} set={(v) => set({ spell: v })} />
        </section>

        <section className="panel">
          <h3 className="eyebrow">{t("data_title")}</h3>
          <p className="muted">{t("data_note")}</p>
          {saveError && <p className="warn-text">{t("data_save_failed")}</p>}
          <div className="data-actions">
            <button className="btn btn-ghost" onClick={download}>
              <Download size={18} /> {t("export_backup")}
            </button>
            <button className="btn btn-ghost" onClick={() => file.current?.click()}>
              <Upload size={18} /> {t("import_backup")}
            </button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0]).finally(() => (e.target.value = ""))} />
            <button
              className="btn btn-ghost btn-danger"
              onClick={() => {
                if (confirm(t("reset_confirm"))) {
                  resetProgress();
                  toast(t("reset_done"));
                }
              }}
            >
              <RotateCcw size={18} /> {t("reset_data")}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function WeakWords() {
  const t = useT();
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
  const ids = useMemo(() => weakWords(progress, 8).filter((id) => atlas.byId.has(id)), [progress, atlas]);

  const drill = () => {
    if (progress.session && !progress.session.finished) return toast(t("drill_finish_first"), "warn");
    const { progress: p, settings } = store.get();
    const s = buildSession(atlas, p, settings, { ids });
    if (!s.steps.length) return toast(t("drill_nothing"), "warn");
    store.progress((prev) => ({ ...prev, session: s }));
    go({ page: "learn" });
  };

  return (
    <section className="panel weak-words">
      <div className="panel-head">
        <h3 className="eyebrow">{t("weak_title")}</h3>
        <span className="muted">{t("weak_sub")}</span>
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
        <p className="muted">{t("weak_empty")}</p>
      )}
      <button className="btn btn-ghost" onClick={drill} disabled={!ids.length}>
        <Sparkles size={18} /> {ids.length ? t("drill_these").replace("{n}", String(ids.length)) : t("drill_these_none")}
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
  const t = useT();
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
    <div className="heatmap" role="img" aria-label={t("study_heatmap")}>
      {cells.map((c) => (
        <span key={c.k} className={`h${c.future ? "x" : lvl(c.v)}`} title={t("day_answered").replace("{day}", c.k).replace("{n}", String(c.v))} />
      ))}
    </div>
  );
}
