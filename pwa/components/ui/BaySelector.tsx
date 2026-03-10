"use client";

import { useState } from "react";
import type { Bay } from "@/lib/types";

interface BaySelectorProps {
  bays: Bay[];
  selectedBayId: string | null;
  onSelect: (bay: Bay) => void;
  loading?: boolean;
}

export function BaySelector({ bays, selectedBayId, onSelect, loading }: BaySelectorProps) {
  const [search, setSearch] = useState("");

  const freeBays = bays.filter(
    (b) => b.status === "free" && b.code.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="skeleton h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search bay..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-black placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-gold/50 text-sm"
      />
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {freeBays.length === 0 ? (
          <p className="text-center text-sm text-black/40 py-4">No available bays</p>
        ) : (
          freeBays.map((bay) => (
            <button
              key={bay.id}
              onClick={() => onSelect(bay)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all touch-target ${
                selectedBayId === bay.id
                  ? "border-gold bg-gold/10 ring-2 ring-gold/20"
                  : "border-black/10 bg-white hover:bg-black/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-black">{bay.code}</span>
                {bay.zone && (
                  <span className="text-xs text-black/40">{bay.zone}</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
