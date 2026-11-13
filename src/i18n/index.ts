import { store, useStore } from "../store/store";
import { en } from "./en";
import { vi } from "./vi";
import { zh } from "./zh";

export type Lang = "en" | "vi" | "zh";
export type TranslationKey = keyof typeof en;

/** A missing value in vi/zh falls back to English. */
export const dict: { en: Record<TranslationKey, string>; vi: Record<TranslationKey, string>; zh: Partial<Record<TranslationKey, string>> } = { en, vi, zh };

export const LOCALE: Record<Lang, string> = { en: "en-US", vi: "vi-VN", zh: "zh-CN" };

const pick = (lang: string | undefined): Lang => (lang === "en" ? "en" : lang === "zh" ? "zh" : "vi");
const lookup = (lang: Lang, key: TranslationKey): string => dict[lang][key] ?? dict.en[key];

/** UI language for code outside React (canvas share images, toasts). */
export const uiLang = (): Lang => pick(store.get().settings.lang);

/** Translate outside React. Components use useT() so they re-render when the language changes. */
export const tr = (key: TranslationKey): string => lookup(uiLang(), key);

export const useLang = (): Lang => useStore((s) => pick(s.settings.lang));

export function useT() {
  const lang = useLang();
  return (key: TranslationKey): string => lookup(lang, key);
}

/** Atlas topic names arrive as English text from the data layer; show them in the UI language. */
export function topicLabel(t: (key: TranslationKey) => string, name: string): string {
  const key = (Object.keys(en) as TranslationKey[]).find((k) => k.startsWith("topic_") && en[k] === name);
  return key ? t(key) : name;
}
