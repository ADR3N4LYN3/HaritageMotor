"use client";

import { useState, useEffect, useRef } from "react";

export interface SelectOption {
  value: string;
  label: string;
  icon?: string;
  sub?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export function CustomSelect({ value, onChange, options, placeholder, className = "" }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected
    ? `${selected.icon ? selected.icon + " " : ""}${selected.label}`
    : placeholder ?? "Select...";

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.04] border text-sm text-left transition-all duration-200 outline-none ${
          open
            ? "border-gold/40 ring-1 ring-gold/20"
            : "border-white/[0.08] hover:border-white/[0.15]"
        } ${selected ? "text-white" : "text-white/25"}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{displayLabel}</span>
        <svg
          className={`w-4 h-4 text-white/40 shrink-0 ml-2 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 bg-dark border border-white/[0.08] rounded-xl overflow-hidden shadow-[0_12px_32px_rgba(0,0,0,0.5)] z-50 max-h-60 overflow-y-auto"
          role="listbox"
          style={{ animation: "fadeIn 0.2s var(--ease-lux, ease-out)" }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex items-center justify-between w-full px-4 py-3 text-sm transition-colors ${
                opt.value === value
                  ? "text-gold bg-gold/[0.08]"
                  : "text-white/70 hover:bg-white/[0.04]"
              }`}
            >
              <span className="truncate">
                {opt.icon ? `${opt.icon} ` : ""}
                {opt.label}
              </span>
              {opt.sub && <span className="text-xs text-white/30 ml-2 shrink-0">{opt.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
