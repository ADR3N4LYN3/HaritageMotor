"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { ReactNode } from "react";

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  sub?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  loading?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  className = "",
  searchable = false,
  searchPlaceholder = "Search...",
  loading = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (open && searchable) {
      setQuery("");
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open, searchable]);

  const filtered = useMemo(() => {
    if (!searchable || !query) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.sub?.toLowerCase().includes(q)
    );
  }, [options, query, searchable]);

  const selected = options.find((o) => o.value === value);

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
        <span className="truncate flex items-center gap-2">
          {loading ? "Loading..." : selected ? (
            <>{selected.icon && <span className="shrink-0 w-4 h-4">{selected.icon}</span>}{selected.label}</>
          ) : (placeholder ?? "Select...")}
        </span>
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
          className="absolute left-0 right-0 top-full mt-1.5 bg-dark border border-white/[0.08] rounded-xl overflow-hidden shadow-[0_12px_32px_rgba(0,0,0,0.5)] z-50 flex flex-col"
          role="listbox"
          style={{ animation: "fadeIn 0.2s var(--ease-lux, ease-out)" }}
        >
          {searchable && (
            <div className="p-2 border-b border-white/[0.06]">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-gold/40 transition-colors"
              />
            </div>
          )}
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-white/30 text-center">No results</p>
            ) : (
              filtered.map((opt) => (
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
                  <span className="truncate flex items-center gap-2">
                    {opt.icon && <span className="shrink-0 w-4 h-4">{opt.icon}</span>}
                    {opt.label}
                  </span>
                  {opt.sub && <span className="text-xs text-white/30 ml-2 shrink-0">{opt.sub}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
