import { ArrowLeftRight, Check, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { store, useStore, type LangPair } from "../store/store";

export const PAIRS: { id: LangPair; source: string; target: string; label: string; flag: string }[] = [
  { id: "en-vi", source: "English", target: "Tiếng Việt", label: "EN ➔ VI", flag: "🇬🇧 ➔ 🇻🇳" },
  { id: "vi-en", source: "Tiếng Việt", target: "English", label: "VI ➔ EN", flag: "🇻🇳 ➔ 🇬🇧" },
  { id: "zh-vi", source: "中文 (Chinese)", target: "Tiếng Việt", label: "ZH ➔ VI", flag: "🇨🇳 ➔ 🇻🇳" },
  { id: "vi-zh", source: "Tiếng Việt", target: "中文 (Chinese)", label: "VI ➔ ZH", flag: "🇻🇳 ➔ 🇨🇳" },
  { id: "fr-vi", source: "Français", target: "Tiếng Việt", label: "FR ➔ VI", flag: "🇫🇷 ➔ 🇻🇳" },
  { id: "vi-fr", source: "Tiếng Việt", target: "Français", label: "VI ➔ FR", flag: "🇻🇳 ➔ 🇫🇷" },
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
    <div className="relative inline-flex items-center gap-1" ref={popoverRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-glass"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 10px",
          fontSize: "0.82rem",
          fontWeight: 600,
          borderRadius: "9999px",
        }}
        title="Chọn cặp ngôn ngữ học tập"
      >
        <Globe size={15} />
        <span>{active.flag}</span>
      </button>

      <button
        type="button"
        className="icon-btn"
        onClick={swap}
        style={{ width: "30px", height: "30px" }}
        title="Đảo chiều ngôn ngữ học (Swap)"
      >
        <ArrowLeftRight size={14} />
      </button>

      {open && (
        <div
          className="amb-pop"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: "220px",
            zIndex: 100,
          }}
        >
          <p className="eyebrow" style={{ paddingBottom: "6px" }}>Cặp ngôn ngữ học tập</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {PAIRS.map((p) => {
              const sel = p.id === currentPair;
              return (
                <li key={p.id} style={{ margin: "2px 0" }}>
                  <button
                    type="button"
                    className={sel ? "is-on" : ""}
                    onClick={() => {
                      store.settings({ langPair: p.id });
                      setOpen(false);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontSize: "0.84rem",
                    }}
                  >
                    <span>
                      <b>{p.flag}</b> <small style={{ marginLeft: "6px", opacity: 0.8 }}>({p.label})</small>
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
