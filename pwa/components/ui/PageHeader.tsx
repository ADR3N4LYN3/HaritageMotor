"use client";

import { useRouter } from "next/navigation";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: React.ReactNode;
}

/**
 * Page header with back arrow, title, and optional action button.
 * Matches the landing page's luxury typography (Cormorant Garamond 300).
 */
export function PageHeader({ title, subtitle, backHref, action }: PageHeaderProps) {
  const router = useRouter();

  function handleBack() {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleBack}
        className="w-10 h-10 rounded-full border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-white/50 hover:text-gold hover:border-gold/30 transition-all duration-300 shrink-0 active:scale-95"
        style={{ transitionTimingFunction: "var(--ease-lux)" }}
        aria-label="Go back"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="font-display text-2xl font-light tracking-wide text-white truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-white/40 font-light mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
