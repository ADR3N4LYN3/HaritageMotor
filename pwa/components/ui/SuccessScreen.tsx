"use client";

import { useEffect } from "react";
import { ActionButton } from "./ActionButton";
import { useI18n } from "@/lib/i18n";
import { commonI18n } from "@/lib/translations";

interface SuccessScreenProps {
  title: string;
  subtitle?: string;
  onDone: () => void;
}

export function SuccessScreen({ title, subtitle, onDone }: SuccessScreenProps) {
  const { t } = useI18n(commonI18n);
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(100);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center px-6">
      <div className="animate-bounce-in">
        <div className="w-20 h-20 rounded-full bg-success flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <h2 className="text-xl font-medium text-white text-center">
        {title}
      </h2>
      {subtitle && (
        <p className="text-white/60 text-center mt-2 text-sm">{subtitle}</p>
      )}
      <div className="w-full max-w-sm mt-8">
        <ActionButton onClick={onDone}>{t.done}</ActionButton>
      </div>
    </div>
  );
}
