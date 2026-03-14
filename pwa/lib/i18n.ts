"use client";

import { useState, useEffect, useCallback } from "react";

export type Lang = "en" | "fr" | "de";

export function getSavedLang(): Lang {
  try {
    const l = localStorage.getItem("hm-lang");
    if (l === "en" || l === "fr" || l === "de") return l;
  } catch {}
  return "en";
}

const listeners = new Set<(lang: Lang) => void>();

export function useI18n<T extends Record<Lang, Record<string, string>>>(dict: T) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    setLang(getSavedLang());
    const handler = (l: Lang) => setLang(l);
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const switchLang = useCallback((l: Lang) => {
    setLang(l);
    try { localStorage.setItem("hm-lang", l); } catch {}
    listeners.forEach((fn) => fn(l));
  }, []);

  const t = dict[lang] as T[Lang];

  return { lang, switchLang, t };
}

/** Notify all useI18n hooks when lang changes (used by LangSwitcher) */
export function broadcastLang(l: Lang) {
  try { localStorage.setItem("hm-lang", l); } catch {}
  listeners.forEach((fn) => fn(l));
}
