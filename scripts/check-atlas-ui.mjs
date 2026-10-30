import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const url = process.argv[2] || "http://127.0.0.1:5190/#/atlas?level=B2";
const session = `stella-ui-${process.pid}`;
const run = (...args) => execFileSync("agent-browser", ["--session", session, ...args], {
  encoding: "utf8", timeout: 30000, maxBuffer: 4 * 1024 * 1024,
});
const evaluate = (code) => {
  const result = JSON.parse(run("eval", "--json", code));
  assert.ok(result.success, result.error);
  return result.data.result;
};
const act = (...args) => {
  run(...args);
  return run("snapshot", "-i");
};
const count = (expected) => {
  const expression = 'Number(document.querySelector(".result-count").textContent.replace(/[^0-9]/g, ""))';
  if (expected !== undefined) run("wait", "--fn", `${expression} === ${expected}`);
  return evaluate(expression);
};
const first = () => evaluate('document.querySelector(".tile-word,.row-word")?.textContent');
const index = JSON.parse(readFileSync(new URL("../public/atlas/index.json", import.meta.url), "utf8"));
const b2 = index.words.filter((w) => w[4] === index.cefr.indexOf("B2"));

try {
  act("open", url);
  run("storage", "local", "set", "word-atlas:settings", JSON.stringify({
    onboarded: true, theme: "dark", splash: false, ambience: "off", sfx: false, autoplay: false,
  }));
  run("storage", "local", "set", "word-atlas:view", "grid");
  act("reload");
  act("set", "viewport", "1365", "768");
  act("set", "media", "dark", "reduced-motion");
  assert.equal(count(b2.length), b2.length);
  assert.ok(run("snapshot", "-i").includes('link "Stella IELTS"'));

  const contrast = [];
  for (const media of ["light", "dark"]) {
    act("set", "media", media, "reduced-motion");
    contrast.push(...evaluate(`(() => {
      const luminance = color => {
        const c = color.match(/[\\d.]+/g).slice(0, 3).map(n => {
          const x = Number(n) / 255;
          return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
        });
        return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
      };
      const root = document.documentElement, old = root.getAttribute('data-theme');
      const style = document.createElement('style');
      style.textContent = '.chip-btn { transition: none !important }';
      document.head.append(style);
      const ratios = [];
      for (const theme of ['light', 'dark', 'system']) {
        theme === 'system' ? root.removeAttribute('data-theme') : root.setAttribute('data-theme', theme);
        for (const button of document.querySelectorAll('.chip-btn')) {
          const original = button.classList.contains('is-on');
          for (const active of [false, true]) {
            button.classList.toggle('is-on', active);
            const s = getComputedStyle(button), a = luminance(s.color), b = luminance(s.backgroundColor);
            ratios.push((Math.max(a, b) + .05) / (Math.min(a, b) + .05));
          }
          button.classList.toggle('is-on', original);
        }
      }
      old === null ? root.removeAttribute('data-theme') : root.setAttribute('data-theme', old);
      style.remove();
      return ratios;
    })()`));
  }
  assert.ok(contrast.every((ratio) => ratio >= 4.5));

  act("fill", ".atlas-head input", "philosophy");
  assert.equal(count(1), 1);
  assert.equal(first(), "philosophy");
  act("click", ".tile");
  run("wait", ".sheet");
  assert.equal(evaluate('document.querySelector(".sheet").getAttribute("aria-label")'), "philosophy 词条");
  act("press", "Escape");
  assert.equal(evaluate('!!document.querySelector(".sheet")'), false);
  act("click", '[aria-label="Clear search"]');
  assert.equal(count(b2.length), b2.length);

  act("click", ".chip-btn.lv-B2");
  assert.equal(count(index.count), index.count);
  act("click", ".chip-btn.lv-B2");
  act("click", '.chips[aria-label="Topic"] button:nth-child(2)');
  const educationCount = b2.filter((w) => w[5] === 0).length;
  assert.equal(count(educationCount), educationCount);
  act("click", '.chips[aria-label="Topic"] button:first-child');
  act("click", '.segmented[aria-label="学习状态"] button:last-child');
  assert.equal(count(0), 0);
  act("click", '.segmented[aria-label="学习状态"] button:first-child');
  assert.equal(count(b2.length), b2.length);

  for (const view of ["List", "Grid"]) {
    act("click", `[aria-label="${view} view"]`);
    const start = first();
    act("scroll", "down", "5000");
    assert.notEqual(first(), start);
    assert.ok(evaluate('document.querySelectorAll(".row,.tile").length') < 100);
    act("scroll", "up", "6000");
    assert.equal(first(), start);
  }
  act("click", '.topnav a[href="#/me"]');
  run("wait", "--url", "**/#/me");
  act("click", '.topnav a[href="#/atlas"]');
  assert.equal(count(index.count), index.count);
  act("click", ".chip-btn.lv-B2");
  assert.equal(count(b2.length), b2.length);
  act("set", "device", "iPhone 14");
  const mobile = evaluate(`({
    dpr: devicePixelRatio,
    columns: new Set([...document.querySelectorAll('.tile')].map(t => t.style.transform.split(',')[0])).size,
    src: document.querySelector('.tile img').currentSrc,
    sizes: document.querySelector('.tile img').sizes,
  })`);
  assert.equal(mobile.columns, 2);
  assert.ok(mobile.dpr > 1);
  run("wait", "--load", "networkidle");
  assert.ok(evaluate('document.querySelector(".tile img").currentSrc').includes("/atlas/img/"));

  console.log(JSON.stringify({ results: b2.length, contrastChecks: contrast.length,
    minimumContrast: Math.min(...contrast), logo: "Stella IELTS", mobile, regressions: 0 }, null, 2));
} finally {
  run("close");
}
