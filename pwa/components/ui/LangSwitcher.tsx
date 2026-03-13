"use client";

import { useState, useEffect, useRef } from "react";

type Lang = "en" | "fr" | "de";
const langLabels: Record<Lang, string> = { en: "EN", fr: "FR", de: "DE" };
const langNames: Record<Lang, string> = { en: "English", fr: "Français", de: "Deutsch" };
const langOrder: Lang[] = ["en", "fr", "de"];

/* ── SVG flags (inline, no emoji) ── */
function Flag({ lang, size = 16 }: { lang: Lang; size?: number }) {
  const h = Math.round(size * 0.75);
  if (lang === "fr")
    return (
      <svg width={size} height={h} viewBox="0 0 640 480" className="rounded-[2px] shrink-0 block">
        <rect x="0" width="214" height="480" fill="#002395" />
        <rect x="213" width="214" height="480" fill="#fff" />
        <rect x="426" width="214" height="480" fill="#ED2939" />
      </svg>
    );
  if (lang === "de")
    return (
      <svg width={size} height={h} viewBox="0 0 640 480" className="rounded-[2px] shrink-0 block">
        <rect y="0" width="640" height="160" fill="#000" />
        <rect y="160" width="640" height="160" fill="#DD0000" />
        <rect y="320" width="640" height="160" fill="#FFCC00" />
      </svg>
    );
  // EN (UK)
  return (
    <svg width={size} height={h} viewBox="0 0 640 480" className="rounded-[2px] shrink-0 block">
      <rect width="640" height="480" fill="#012169" />
      <path d="M0,0L640,480M640,0L0,480" stroke="#fff" strokeWidth="80" fill="none" />
      <path d="M320,0V480M0,240H640" stroke="#fff" strokeWidth="100" fill="none" />
      <path d="M0,0L640,480" stroke="#C8102E" strokeWidth="36" fill="none" />
      <path d="M640,0L0,480" stroke="#C8102E" strokeWidth="36" fill="none" />
      <path d="M320,0V480M0,240H640" stroke="#C8102E" strokeWidth="60" fill="none" />
    </svg>
  );
}

export function LangSwitcher() {
  const [lang, setLang] = useState<Lang>("en");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("hm-lang") as Lang | null;
    if (saved && saved in langLabels) setLang(saved);
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-[5px] px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/50 hover:border-gold/30 hover:text-gold transition-all duration-300 text-[11px] font-medium tracking-[0.04em] select-none"
        style={{ transitionTimingFunction: "var(--ease-lux)" }}
        aria-label="Change language"
        aria-expanded={open}
      >
        <Flag lang={lang} size={16} />
        {langLabels[lang]}
        <svg className="w-2.5 h-2.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 bg-dark border border-white/[0.08] rounded-[10px] overflow-hidden shadow-[0_12px_32px_rgba(0,0,0,0.5)] z-50 min-w-[120px]"
          style={{ animation: "fadeIn 0.25s var(--ease-lux)" }}
        >
          {langOrder.map((l) => (
            <button
              key={l}
              onClick={() => pick(l)}
              className={`flex items-center gap-2 w-full px-3.5 py-2.5 text-xs font-normal transition-colors ${
                l === lang
                  ? "text-gold bg-gold/[0.08]"
                  : "text-white/60 hover:bg-white/[0.04]"
              }`}
            >
              <Flag lang={l} size={18} />
              {langNames[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
