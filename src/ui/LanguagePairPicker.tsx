import { ArrowLeftRight, Check, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { store, useStore, type LangPair } from "../store/store";

export const PAIRS: { id: LangPair; label: string; desc: string; flag: string }[] = [
  { id: "en-vi", label: "EN ➔ VI", desc: "Học từ Anh, hiểu nghĩa Việt", flag: "🇬🇧 ➔ 🇻🇳" },
  { id: "vi-en", label: "VI ➔ EN", desc: "Phản xạ từ nghĩa Việt sang từ Anh", flag: "🇻🇳 ➔ 🇬🇧" },
  { id: "zh-vi", label: "ZH ➔ VI", desc: "Hán tự & nghĩa tiếng Việt", flag: "🇨🇳 ➔ 🇻🇳" },
  { id: "vi-zh", label: "VI ➔ ZH", desc: "Nghĩa Việt sang chữ Hán", flag: "🇻🇳 ➔ 🇨🇳" },
  { id: "fr-vi", label: "FR ➔ VI", desc: "Tiếng Pháp & từ điển Glosbe", flag: "🇫🇷 ➔ 🇻🇳" },
  { id: "vi-fr", label: "VI ➔ FR", desc: "Tiếng Việt sang tiếng Pháp", flag: "🇻🇳 ➔ 🇫🇷" },
];

export function LanguagePairPicker() {
  const currentPair = useStore((s) => s.settings.langPair || "en-vi");
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const active = PAIRS.find((p) => p.id === currentPair) || PAIRS[0];

  const swap = () => {
    let next: LangPair = "en-vi";
    switch (currentPair) {
      case "en-vi": next = "vi-en"; break;
      case "vi-en": next = "en-vi"; break;
      case "zh-vi": next = "vi-zh"; break;
      case "vi-zh": next = "zh-vi"; break;
      case "fr-vi": next = "vi-fr"; break;
      case "vi-fr": next = "fr-vi"; break;
    }
    store.settings({ langPair: next });
  };

  useEffect(() => {
    if (!open) return;
    const clickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, [open]);

  return (
    <div className="lang-picker" ref={popoverRef}>
      <div
        className="lang-pill"
        onClick={() => setOpen((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen((prev) => !prev)}
        aria-label="Language Mode"
      >
        <Globe size={15} />
        <b>{active.label}</b>
        <span
          className="lang-swap-btn"
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            swap();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
              swap();
            }
          }}
          title="Đảo chiều ngôn ngữ (Swap)"
          aria-label="Đảo chiều ngôn ngữ"
        >
          <ArrowLeftRight size={13} />
        </span>
      </div>

      {open && (
        <div className="amb-pop lang-pop" role="dialog" aria-label="Language Mode">
          <p className="eyebrow">Language Mode</p>
          <ul>
            {PAIRS.map((p) => {
              const sel = p.id === currentPair;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={sel ? "is-on" : ""}
                    onClick={() => {
                      store.settings({ langPair: p.id });
                      setOpen(false);
                    }}
                  >
                    <span>
                      <span className="pair-title">{p.flag} ({p.label})</span>
                      <span className="pair-sub">{p.desc}</span>
                    </span>
                    {sel && <Check size={16} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
