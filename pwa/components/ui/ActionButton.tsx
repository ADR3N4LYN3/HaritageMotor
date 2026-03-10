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
  const base = "font-sans font-semibold rounded-xl transition-all active:scale-[0.98] touch-target flex items-center justify-center gap-2";
  const height = "min-h-[64px] px-6 text-base";

  const variants = {
    primary: "bg-gold text-white hover:bg-[#a07d48] disabled:bg-gold/40",
    danger: "bg-danger text-white hover:bg-[#dc2626] disabled:bg-danger/40",
    secondary: "bg-white/10 text-white hover:bg-white/15 disabled:bg-white/5 disabled:text-white/30",
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
