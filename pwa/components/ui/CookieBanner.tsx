"use client";

import { useState, useEffect } from "react";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("hm-cookie-consent")) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  function handleAccept() {
    try {
      localStorage.setItem("hm-cookie-consent", "accepted");
    } catch {
      // localStorage unavailable
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[60] pointer-events-none">
      <div className="max-w-lg mx-auto bg-dark/95 backdrop-blur-xl border border-gold/15 rounded-2xl p-4 pointer-events-auto shadow-2xl shadow-black/50">
        <p className="text-xs text-white/50 font-light leading-relaxed">
          This app uses essential cookies for authentication. No tracking or advertising cookies are used.
        </p>
        <div className="flex justify-end mt-3">
          <button
            onClick={handleAccept}
            className="px-4 py-1.5 rounded-lg border border-gold/30 text-gold text-xs tracking-wider uppercase font-medium hover:bg-gold hover:text-black transition-all duration-300"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
