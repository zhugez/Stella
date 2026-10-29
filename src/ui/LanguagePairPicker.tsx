import { ArrowLeftRight, Check, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { store, useStore, type LangPair } from "../store/store";

export const PAIRS: { id: LangPair; label: string; desc: string; from: string; to: string }[] = [
  { id: "en-vi", label: "EN ➔ VI", desc: "Học từ tiếng Anh, hiểu nghĩa tiếng Việt", from: "English", to: "Tiếng Việt" },
  { id: "vi-en", label: "VI ➔ EN", desc: "Phản xạ từ nghĩa Việt sang từ vựng Anh", from: "Tiếng Việt", to: "English" },
  { id: "zh-vi", label: "ZH ➔ VI", desc: "Hán tự chữ Hán & nghĩa tiếng Việt", from: "中文", to: "Tiếng Việt" },
  { id: "vi-zh", label: "VI ➔ ZH", desc: "Từ nghĩa Việt tra chữ Hán", from: "Tiếng Việt", to: "中文" },
  { id: "fr-vi", label: "FR ➔ VI", desc: "Từ vựng tiếng Pháp & phát âm bản xứ", from: "Français", to: "Tiếng Việt" },
  { id: "vi-fr", label: "VI ➔ FR", desc: "Từ nghĩa Việt tra tiếng Pháp", from: "Tiếng Việt", to: "Français" },
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
        aria-label={`Language Mode ${active.label}`}
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
                      <span className="pair-title">{p.label} <small style={{ fontWeight: 400, opacity: 0.75 }}>({p.from} ➔ {p.to})</small></span>
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
