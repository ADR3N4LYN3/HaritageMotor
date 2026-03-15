"use client";

import { useI18n } from "@/lib/i18n";
import { commonI18n } from "@/lib/translations";

export function ManualSheet({ code, setCode, error, onSubmit, onBack }: {
  code: string;
  setCode: (s: string) => void;
  error: string | null;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const { t } = useI18n(commonI18n);

  return (
    <div className="space-y-4 pt-4">
      <h2 className="text-[1.3rem] font-light tracking-[0.03em] text-white leading-[1.2] text-center">
        {t.search === "Search" ? "Enter QR Code" : t.search === "Rechercher" ? "Entrer le code QR" : "QR-Code eingeben"}
      </h2>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={t.searchPlaceholder}
        aria-label="QR token code"
        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] text-white placeholder:text-white/25 border border-white/[0.08] focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors"
      />
      {error && <p className="text-danger text-sm text-center">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl border border-white/[0.08] text-white/50 text-sm font-medium active:scale-[0.98] transition-transform"
        >
          {t.cancel}
        </button>
        <button
          onClick={onSubmit}
          className="flex-1 py-3 rounded-xl bg-gold text-black font-medium text-sm active:scale-[0.98] transition-transform"
          disabled={!code}
        >
          {t.search}
        </button>
      </div>
    </div>
  );
}
