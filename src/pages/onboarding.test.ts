import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { Atlas } from "../atlas/types";
import { AtlasContext } from "../atlas/context";

test("onboarding offers A1, keeps B1 selected, and does not convert IELTS bands", async () => {
  const source = readFileSync(new URL("./Onboarding.tsx", import.meta.url), "utf8").replaceAll("import.meta.env.BASE_URL", '"/"');
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, jsxFactory: "React.createElement", module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const imports = compiled.replace(/from "(\.\.[^"]+)"/g, (_, p) => `from "${new URL(p + (p.endsWith("context") ? ".tsx" : ".ts"), import.meta.url).href}"`);
  const moduleSource = `import * as React from "react";\n${imports}`;
  const { Onboarding } = await import(`data:text/javascript,${encodeURIComponent(moduleSource.replace(/from "react"/g, `from "${import.meta.resolve("react")}"`).replace(/from "lucide-react"/g, `from "${import.meta.resolve("lucide-react")}"`))}`);
  const atlas = { count: 7298, cefr: ["A1", "A2", "B1", "B2", "C1", "C2"] } as Atlas;
  const html = renderToStaticMarkup(createElement(AtlasContext.Provider, { value: atlas }, createElement(Onboarding)));
  assert.match(html, /A1/);
  assert.match(html, /aria-pressed="true"><span[^>]*>B1/);
  assert.doesNotMatch(html, /Target IELTS|Aiming for IELTS/);
  assert.match(html, /not a certified level or IELTS score/);
});
