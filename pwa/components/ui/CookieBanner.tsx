"use client";

import { useState, useEffect, useCallback } from "react";

interface ConsentPrefs {
  essential: boolean;
  analytics: boolean;
  timestamp: string;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [analytics, setAnalytics] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("hm-cookie-consent");
      if (raw) {
        const prefs: ConsentPrefs = JSON.parse(raw);
        if (prefs?.essential) {
          if (!prefs.analytics) {
            localStorage.setItem("plausible_ignore", "true");
          } else {
            localStorage.removeItem("plausible_ignore");
          }
          return;
        }
      }
    } catch {
      // localStorage unavailable or invalid JSON
    }
    setVisible(true);
  }, []);

  const saveConsent = useCallback(
    (analyticsEnabled: boolean) => {
      try {
        localStorage.setItem(
          "hm-cookie-consent",
          JSON.stringify({
            essential: true,
            analytics: analyticsEnabled,
            timestamp: new Date().toISOString(),
          } satisfies ConsentPrefs)
        );
        if (!analyticsEnabled) {
          localStorage.setItem("plausible_ignore", "true");
        } else {
          localStorage.removeItem("plausible_ignore");
        }
      } catch {
        // localStorage unavailable
      }
      setVisible(false);
    },
    []
  );

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="w-full max-w-[480px] bg-[rgba(22,21,18,0.97)] border border-gold/15 rounded-[20px] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        {/* Icon */}
        <div className="w-10 h-10 mb-4 rounded-[10px] bg-gold/10 border border-gold/15 flex items-center justify-center text-xl">
          🔒
        </div>

        {/* Title */}
        <h2 className="font-display font-light text-2xl text-white mb-2 tracking-[0.01em]">
          Privacy preferences
        </h2>

        {/* Description */}
        <p className="text-sm font-light text-white/55 leading-relaxed mb-6">
          We respect your privacy. Choose which data processing you allow. See
          our{" "}
          <a
            href="https://heritagemotor.app/privacy"
            className="text-gold underline underline-offset-2 hover:text-[#d4b07a] transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy Policy
          </a>
          .
        </p>

        {/* Options */}
        <div className="flex flex-col gap-3 mb-7">
          {/* Essential — always on */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-white">Essential</span>
              <span className="text-[0.72rem] font-light text-white/35">
                Authentication cookies, session management
              </span>
            </div>
            <label className="relative w-10 h-[22px] shrink-0 ml-4 opacity-50 cursor-not-allowed">
              <input
                type="checkbox"
                checked
                disabled
                className="opacity-0 w-0 h-0"
              />
              <span className="absolute inset-0 rounded-full bg-gold/25 border border-gold/40 transition-all after:content-[''] after:absolute after:top-0.5 after:left-5 after:w-4 after:h-4 after:rounded-full after:bg-gold after:transition-all" />
            </label>
          </div>

          {/* Analytics — toggleable */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-white">
                Anonymous analytics
              </span>
              <span className="text-[0.72rem] font-light text-white/35">
                Privacy-friendly usage stats (no cookies, no personal data)
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={analytics}
              onClick={() => setAnalytics((v) => !v)}
              className={`relative w-10 h-[22px] shrink-0 ml-4 rounded-full border transition-all cursor-pointer ${
                analytics
                  ? "bg-gold/25 border-gold/40"
                  : "bg-white/[0.08] border-white/10"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                  analytics ? "left-5 bg-gold" : "left-0.5 bg-white/40"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 max-[480px]:flex-col-reverse">
          <button
            onClick={() => saveConsent(analytics)}
            className="flex-1 py-3 px-4 rounded-[10px] bg-transparent border border-white/12 text-white/60 text-xs font-medium tracking-wider uppercase text-center hover:border-white/25 hover:text-white transition-all duration-300"
          >
            Save choices
          </button>
          <button
            onClick={() => saveConsent(true)}
            className="flex-1 py-3 px-4 rounded-[10px] bg-gold border border-gold text-black text-xs font-medium tracking-wider uppercase text-center hover:bg-[#c4a265] hover:border-[#c4a265] transition-all duration-300"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
