export interface ReadingQuestion {
  type: "mcq" | "tfng";
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface ReadingPassage {
  id: string;
  topic: string;
  topicName: string;
  title: string;
  author?: string;
  source?: string;
  cefr: string;
  paragraphs: string[];
  questions: ReadingQuestion[];
  vocabulary: { word: string; id: string }[];
  wordCount: number;
}

const evidence: Record<string, number[]> = {
  education: [2, 3], work: [1, 3], technology: [2, 3], science: [1, 3],
  environment: [1, 3], health: [2, 3], society: [1, 3], government: [2, 3],
  economy: [2, 3], media: [2, 3], arts: [1, 3], travel: [2, 3], city: [2, 3],
  nature: [2, 3], daily: [2, 3], emotion: [2, 3], thinking: [2, 2], sport: [3, 2], history: [2, 3],
};

export function evidenceParagraph(p: ReadingPassage, index: number) {
  return !p.author && p.id === `reading-${p.topic}-01` ? evidence[p.topic]?.[index] : undefined;
}

export function parsePassages(value: unknown): ReadingPassage[] {
  if (!Array.isArray(value) || !value.length) throw new Error("The reading library is empty.");
  const ids = new Set<string>();
  for (const p of value) {
    if (!p || typeof p !== "object" || typeof p.id !== "string" || !/^[a-z0-9-]+$/.test(p.id) || ids.has(p.id) ||
      ![p.topic, p.topicName, p.title, p.cefr].every((s) => typeof s === "string" && s.trim()) ||
      (p.author !== undefined && typeof p.author !== "string") || (p.source !== undefined && typeof p.source !== "string") ||
      !Array.isArray(p.paragraphs) || !p.paragraphs.length || !p.paragraphs.every((s: unknown) => typeof s === "string" && s.trim()) ||
      !Array.isArray(p.questions) || !p.questions.length || !p.questions.every((q: ReadingQuestion) => q && ["mcq", "tfng"].includes(q.type) &&
        typeof q.question === "string" && q.question.trim() && typeof q.explanation === "string" && q.explanation.trim() &&
        Array.isArray(q.options) && q.options.length >= 2 && q.options.every((s) => typeof s === "string" && s.trim()) &&
        Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length &&
        (q.type !== "tfng" || JSON.stringify(q.options) === JSON.stringify(["TRUE", "FALSE", "NOT GIVEN"]))) ||
      !Array.isArray(p.vocabulary) || !p.vocabulary.every((v: { word: string; id: string }) => v && typeof v.word === "string" && typeof v.id === "string") ||
      !Number.isFinite(p.wordCount) || p.wordCount <= 0) throw new Error("Incomplete or invalid reading content. Grading is unavailable.");
    ids.add(p.id);
  }
  return value as ReadingPassage[];
}

export function contentVersion(p: ReadingPassage) {
  // ponytail: deterministic 64-bit content fingerprint, use SHA-256 if collision resistance becomes a trust requirement.
  let hash = 14695981039346656037n;
  for (const c of JSON.stringify([p.paragraphs, p.questions, evidence[p.topic]])) hash = BigInt.asUintN(64, (hash ^ BigInt(c.codePointAt(0)!)) * 1099511628211n);
  return hash.toString(16);
}

export function gradeReading(p: ReadingPassage, answers: Record<string, number>) {
  if (!p.questions.length || p.questions.some((q, i) => !Number.isInteger(answers[i]) || answers[i] < 0 || answers[i] >= q.options.length || !evidenceParagraph(p, i)))
    throw new Error("Answer every question in a supported practice passage before submitting.");
  return p.questions.reduce((n, q, i) => n + Number(answers[i] === q.answer), 0);
}
