"use client";

import { ButtonHTMLAttributes } from "react";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "danger" | "secondary";
  loading?: boolean;
  fullWidth?: boolean;
}

export function ActionButton({
  children,
  variant = "primary",
  loading = false,
  fullWidth = true,
  className = "",
  disabled,
  ...props
}: ActionButtonProps) {
  const base = "font-sans font-medium rounded-xl transition-all active:scale-[0.98] touch-target flex items-center justify-center gap-2";
  const height = "min-h-[48px] px-6 text-sm tracking-wide";

  const variants = {
    primary: "bg-gold/90 text-black hover:bg-gold disabled:bg-gold/30 disabled:text-black/50",
    danger: "bg-transparent text-danger border border-danger/30 hover:bg-danger/10 disabled:opacity-40",
    secondary: "bg-white/[0.06] text-white/70 border border-white/[0.08] hover:bg-white/[0.1] disabled:opacity-30",
  };

  return (
    <button
      className={`${base} ${height} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : null}
      {children}
    </button>
  );
}
