import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const ids = (await readdir(new URL("data/reading/", root))).filter((name) => /^reading-[a-z]+-01\.json$/.test(name)).map((name) => name.slice(0, -5)).sort();
const passages = [];
for (const id of ids) {
  const p = JSON.parse(await readFile(new URL(`data/reading/${id}.json`, root), "utf8"));
  if (p.id !== id || p.author || !p.paragraphs?.length || !p.questions?.length) throw new Error(`Invalid practice draft: ${id}`);
  passages.push(p);
}
if (passages.length !== 19) throw new Error("Expected 19 academic practice drafts. Imported classics remain quarantined in data/reading.");
const out = new URL("public/atlas/reading/", root);
await mkdir(out, { recursive: true });
await writeFile(new URL("passages.json", out), JSON.stringify(passages, null, 2) + "\n");
await writeFile(new URL("index.json", out), JSON.stringify(passages.map(({ id, topic, title, cefr, wordCount }) => ({ id, topic, title, cefr, wordCount, status: "draft-practice" })), null, 2) + "\n");
console.log(`Published ${passages.length} draft practice passages to ${fileURLToPath(out)}; imported extracts excluded.`);
