import { tr } from "../i18n";
import { hashSeed, normalize, shuffle } from "./text";

interface QuestionBase {
  question: string;
  explanation: string;
  evidence?: number;
}
export interface ChoiceQuestion extends QuestionBase {
  type: "mcq" | "tfng";
  options: string[];
  answer: number;
}
// Sentence completion: `question` holds one "____" blank; `accept` lists the correct answers (accept[0] is shown as the key).
export interface GapQuestion extends QuestionBase {
  type: "gap";
  accept: string[];
}
export type ReadingQuestion = ChoiceQuestion | GapQuestion;
// Choice questions are answered with an option index, gap questions with typed text.
export type ReadingAnswer = number | string;
export const GAP_MAX_CHARS = 60;
const wordsOf = (s: string) => normalize(s).split(" ").filter(Boolean);

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
  if (p.author) return undefined;
  return p.questions[index]?.evidence ?? (p.id === `reading-${p.topic}-01` ? evidence[p.topic]?.[index] : undefined);
}

function validQuestion(q: ReadingQuestion, paragraphs: number) {
  if (!q || typeof q.question !== "string" || !q.question.trim() || typeof q.explanation !== "string" || !q.explanation.trim() ||
    (q.evidence !== undefined && !(Number.isInteger(q.evidence) && q.evidence >= 1 && q.evidence <= paragraphs))) return false;
  if (q.type === "gap")
    return (q.question.match(/_{4,}/g) ?? []).length === 1 && Array.isArray(q.accept) && q.accept.length >= 1 && q.accept.length <= 3 &&
      q.accept.every((a) => typeof a === "string" && wordsOf(a).length >= 1 && wordsOf(a).length <= 2);
  return ["mcq", "tfng"].includes(q.type) && Array.isArray(q.options) && q.options.length >= 2 && q.options.every((s) => typeof s === "string" && s.trim()) &&
    Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length &&
    (q.type !== "tfng" || JSON.stringify(q.options) === JSON.stringify(["TRUE", "FALSE", "NOT GIVEN"]));
}

export function parsePassages(value: unknown): ReadingPassage[] {
  if (!Array.isArray(value) || !value.length) throw new Error(tr("reading_err_empty_library"));
  const ids = new Set<string>();
  for (const p of value) {
    if (!p || typeof p !== "object" || typeof p.id !== "string" || !/^[a-z0-9-]+$/.test(p.id) || ids.has(p.id) ||
      ![p.topic, p.topicName, p.title, p.cefr].every((s) => typeof s === "string" && s.trim()) ||
      (p.author !== undefined && typeof p.author !== "string") || (p.source !== undefined && typeof p.source !== "string") ||
      !Array.isArray(p.paragraphs) || !p.paragraphs.length || !p.paragraphs.every((s: unknown) => typeof s === "string" && s.trim()) ||
      !Array.isArray(p.questions) || !p.questions.length || !p.questions.every((q: ReadingQuestion) => validQuestion(q, p.paragraphs.length)) ||
      !Array.isArray(p.vocabulary) || !p.vocabulary.every((v: { word: string; id: string }) => v && typeof v.word === "string" && typeof v.id === "string") ||
      !Number.isFinite(p.wordCount) || p.wordCount <= 0) throw new Error(tr("reading_err_invalid_content"));
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

// An answer is valid for its question type; gap text may be empty while typing (see isAnswered).
export function validAnswer(q: ReadingQuestion, a: unknown): a is ReadingAnswer {
  return q.type === "gap" ? typeof a === "string" && a.length <= GAP_MAX_CHARS : Number.isInteger(a) && (a as number) >= 0 && (a as number) < q.options.length;
}

export const isAnswered = (q: ReadingQuestion, a: unknown) => validAnswer(q, a) && (typeof a !== "string" || !!a.trim());

const bare = (s: string) => normalize(s).replace(/^(a|an|the) /, "");

// More than two words is wrong even when an article would make it fit; otherwise ignore case, spacing and one leading article.
export function gapCorrect(q: GapQuestion, answer: string) {
  return wordsOf(answer).length <= 2 && q.accept.some((a) => bare(a) === bare(answer));
}

export function gradeReading(p: ReadingPassage, answers: Record<string, ReadingAnswer>) {
  if (!p.questions.length || p.questions.some((q, i) => !isAnswered(q, answers[i]) || !evidenceParagraph(p, i)))
    throw new Error(tr("reading_err_answer_all"));
  return p.questions.reduce((n, q, i) => n + Number(q.type === "gap" ? gapCorrect(q, answers[i] as string) : answers[i] === q.answer), 0);
}

export function optionOrder(p: ReadingPassage, i: number): number[] {
  const q = p.questions[i];
  if (!q || q.type === "gap") return [];
  const indices = q.options.map((_, idx) => idx);
  if (q.type === "tfng" || JSON.stringify(q.options) === JSON.stringify(["TRUE", "FALSE", "NOT GIVEN"])) {
    return indices;
  }
  if (q.options.some((opt) => /(all|none|both|neither) of the|option [A-D]|\b[A-D] and [A-D]\b/i.test(opt))) {
    return indices;
  }
  return shuffle(indices, hashSeed(`${p.id}:${i}`));
}
