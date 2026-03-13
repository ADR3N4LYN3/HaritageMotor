"use client";

import { useState, useEffect, useRef } from "react";

type Lang = "en" | "fr" | "de";
const langMeta: Record<Lang, { flag: string; label: string }> = {
  en: { flag: "\u{1F1EC}\u{1F1E7}", label: "EN" },
  fr: { flag: "\u{1F1EB}\u{1F1F7}", label: "FR" },
  de: { flag: "\u{1F1E9}\u{1F1EA}", label: "DE" },
};

export function LangSwitcher() {
  const [lang, setLang] = useState<Lang>("en");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("hm-lang") as Lang | null;
    if (saved && saved in langMeta) setLang(saved);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function pick(l: Lang) {
    setLang(l);
    localStorage.setItem("hm-lang", l);
    setOpen(false);
  }

  const { flag, label } = langMeta[lang];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-white/40 hover:text-white/60 transition-colors text-xs"
        aria-label="Change language"
      >
        <span className="text-sm">{flag}</span>
        <span className="tracking-wider font-medium">{label}</span>
        <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-dark-2 border border-white/[0.08] rounded-lg overflow-hidden shadow-xl z-50">
          {(Object.keys(langMeta) as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => pick(l)}
              className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors ${
                l === lang ? "text-gold bg-gold/[0.06]" : "text-white/50 hover:bg-white/[0.04] hover:text-white/70"
              }`}
            >
              <span className="text-sm">{langMeta[l].flag}</span>
              <span className="tracking-wider font-medium">{langMeta[l].label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
